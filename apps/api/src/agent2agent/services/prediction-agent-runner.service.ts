/**
 * Prediction Agent Runner Service
 *
 * Handles execution of prediction agents - agents that manage prediction universes,
 * targets, signals, learnings, and the test-based learning loop.
 *
 * Extends BaseAgentRunner to inherit standard mode handling (CONVERSE, PLAN, BUILD, HITL)
 * and adds custom 'dashboard' mode for UI data access operations.
 *
 * Dashboard Mode:
 * - method: 'dashboard.<entity>.<operation>' (e.g., 'dashboard.universes.list')
 * - params.mode: 'dashboard'
 * - params.payload: DashboardRequestPayload with action, params, filters, pagination
 * - params.context: ExecutionContext
 *
 * Supported Dashboard Entities:
 * - universes, targets, predictions, sources, analysts
 * - learnings, learning-queue, review-queue, strategies
 * - missed-opportunities, tool-requests, learning-promotion
 * - test-scenarios, test-articles, test-price-data, test-target-mirrors
 * - analytics
 *
 * @module prediction-agent-runner.service
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
import { PredictionDashboardRouter } from '@/prediction-runner/task-router/prediction-dashboard.router';
import type {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

/**
 * Custom dashboard mode identifier
 * Frontend sends mode: 'dashboard' for prediction UI operations
 */
const DASHBOARD_MODE = 'dashboard';

@Injectable()
export class PredictionAgentRunnerService extends BaseAgentRunner {
  protected readonly logger = new Logger(PredictionAgentRunnerService.name);

  constructor(
    llmService: LLMService,
    contextOptimization: ContextOptimizationService,
    plansService: PlansService,
    conversationsService: Agent2AgentConversationsService,
    deliverablesService: DeliverablesService,
    streamingService: StreamingService,
    @Inject(forwardRef(() => PredictionDashboardRouter))
    private readonly dashboardRouter: PredictionDashboardRouter,
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
   * Execute a prediction agent task
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
      `[PREDICTION-RUNNER] execute() - agent: ${definition.slug}, mode: ${mode}`,
    );

    // Handle dashboard mode (custom mode for prediction UI)
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
   * For prediction agents, BUILD mode is not typically used directly.
   * Dashboard mode handles data operations instead.
   * This implementation returns an error directing users to use dashboard mode.
   */
  protected executeBuild(
    definition: AgentRuntimeDefinition,
    _request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    this.logger.warn(
      `[PREDICTION-RUNNER] BUILD mode called for ${definition.slug} - use dashboard mode instead`,
    );
    return Promise.resolve(
      TaskResponseDto.failure(
        AgentTaskMode.BUILD,
        'Prediction agents use dashboard mode for data operations. Use mode: "dashboard" with action in payload.',
      ),
    );
  }

  /**
   * Handle dashboard mode request
   *
   * Routes to PredictionDashboardRouter which handles entity-specific operations.
   */
  protected async handleDashboard(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    _organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    this.logger.debug(
      `[PREDICTION-RUNNER] handleDashboard() - agent: ${definition.slug}`,
    );

    try {
      // Extract action from payload
      const payload = request.payload as DashboardRequestPayload | undefined;
      const action = payload?.action;

      if (!action) {
        this.logger.warn('[PREDICTION-RUNNER] No action provided in payload');
        return TaskResponseDto.failure(
          DASHBOARD_MODE,
          'Dashboard request requires action in payload',
        );
      }

      // Get context from request
      const context = request.context as ExecutionContext | undefined;

      if (!context) {
        this.logger.warn('[PREDICTION-RUNNER] No context provided');
        return TaskResponseDto.failure(
          DASHBOARD_MODE,
          'Dashboard request requires ExecutionContext',
        );
      }

      this.logger.debug(
        `[PREDICTION-RUNNER] Routing to dashboard: action=${action}, org=${context.orgSlug}`,
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
        `[PREDICTION-RUNNER] Dashboard execution error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      return TaskResponseDto.failure(
        DASHBOARD_MODE,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
