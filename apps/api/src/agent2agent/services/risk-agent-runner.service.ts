/**
 * Risk Agent Runner Service
 *
 * Handles execution of risk analysis agents - agents that manage multi-factor
 * risk assessments, dimension analysis, debates, and learning loops.
 *
 * Extends BaseAgentRunner to inherit standard mode handling (CONVERSE, PLAN, BUILD, HITL)
 * and adds custom 'dashboard' mode for UI data access operations.
 *
 * Dashboard Mode:
 * - method: 'dashboard.<entity>.<operation>' (e.g., 'dashboard.scopes.list')
 * - params.mode: 'dashboard'
 * - params.payload: DashboardRequestPayload with action, params, filters, pagination
 * - params.context: ExecutionContext
 *
 * Supported Dashboard Entities:
 * - scopes, subjects, dimensions, dimension-contexts
 * - assessments, composite-scores, debates, debate-contexts
 * - alerts, learnings, learning-queue, evaluations
 *
 * @module risk-agent-runner.service
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { LLMService } from '@llm/llm.service';
import { BaseAgentRunner } from './base-agent-runner.service';
import { Agent2AgentConversationsService } from './agent-conversations.service';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { ContextOptimizationService } from '../context-optimization/context-optimization.service';
import { DeliverablesService } from '../deliverables/deliverables.service';
import { PlansService } from '../plans/services/plans.service';
import { StreamingService } from './streaming.service';
import { RiskDashboardRouter } from '@/risk-runner/task-router/risk-dashboard.router';
import type {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

/**
 * Custom dashboard mode identifier
 * Frontend sends mode: 'dashboard' for risk UI operations
 */
const DASHBOARD_MODE = 'dashboard';

@Injectable()
export class RiskAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(RiskAgentRunnerService.name);

  constructor(
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
    @Inject(forwardRef(() => RiskDashboardRouter))
    private readonly dashboardRouter: RiskDashboardRouter,
  ) {
    super(
      llmService,
      contextOptimization,
      plansService,
      conversationsService,
      deliverablesService,
      streamingService,
    );
  }

  /**
   * Execute a risk agent task
   *
   * Overrides base execute to add dashboard mode handling.
   * Falls through to parent for standard modes (CONVERSE, PLAN, BUILD, HITL).
   */
  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Check for dashboard mode (custom mode not in AgentTaskMode enum)
    const mode = request.mode || this.extractModeFromPayload(request);

    this.logger.debug(
      `[RISK-RUNNER] execute() - agent: ${definition.slug}, mode: ${mode}`,
    );

    // Handle dashboard mode (custom mode for risk UI)
    if (mode === DASHBOARD_MODE) {
      return this.handleDashboard(definition, request, organizationSlug);
    }

    // Delegate to parent for standard modes
    return super.execute(definition, request, organizationSlug);
  }

  /**
   * Extract mode from payload if not set directly
   * Frontend sends mode in params.mode for dashboard requests
   */
  private extractModeFromPayload(request: TaskRequestDto): string | undefined {
    const payload = request.payload;
    if (payload?.mode && typeof payload.mode === 'string') {
      return payload.mode;
    }
    return undefined;
  }

  /**
   * Implement abstract executeBuild from BaseAgentRunner
   *
   * For risk agents, BUILD mode is not typically used directly.
   * Dashboard mode handles data operations instead.
   * This implementation returns an error directing users to use dashboard mode.
   */
  protected executeBuild(
    definition: AgentRuntimeDefinition,
    _request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    this.logger.warn(
      `[RISK-RUNNER] BUILD mode called for ${definition.slug} - use dashboard mode instead`,
    );
    return Promise.resolve(
      TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Risk agents use dashboard mode for data operations. Use mode: "dashboard" with action in payload.',
      ),
    );
  }

  /**
   * Handle dashboard mode request
   *
   * Routes to RiskDashboardRouter which handles entity-specific operations.
   */
  protected async handleDashboard(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    this.logger.debug(
      `[RISK-RUNNER] handleDashboard() - agent: ${definition.slug}`,
    );

    try {
      // Extract action from payload
      const payload = request.payload as DashboardRequestPayload | undefined;
      const action = payload?.action;

      if (!action) {
        this.logger.warn('[RISK-RUNNER] No action provided in payload');
        return TaskResponseDto.failure(
          DASHBOARD_MODE,
          'Dashboard request requires action in payload',
        );
      }

      // Get context from request
      const context = request.context as ExecutionContext | undefined;

      if (!context) {
        this.logger.warn('[RISK-RUNNER] No context provided');
        return TaskResponseDto.failure(
          DASHBOARD_MODE,
          'Dashboard request requires ExecutionContext',
        );
      }

      this.logger.debug(
        `[RISK-RUNNER] Routing to dashboard: action=${action}, org=${context.orgSlug}`,
      );

      // Route to dashboard handler
      const result = await this.dashboardRouter.route(action, payload, context);

      if (!result.success) {
        return TaskResponseDto.failure(
          DASHBOARD_MODE,
          result.error?.message || 'Dashboard request failed',
        );
      }

      // Return success with content and metadata
      return TaskResponseDto.success(DASHBOARD_MODE, {
        content: result.content,
        metadata: result.metadata || {},
      });
    } catch (error) {
      this.logger.error(
        `[RISK-RUNNER] Dashboard execution error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      return TaskResponseDto.failure(
        DASHBOARD_MODE,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
