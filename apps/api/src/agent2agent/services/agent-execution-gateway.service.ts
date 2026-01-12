import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { JsonObject } from '@orchestrator-ai/transport-types';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { AgentRecord } from '@agent-platform/interfaces/agent.interface';
import { ConversationPlanRecord } from '@agent-platform/interfaces/conversation-plan-record.interface';
import { AgentTaskMode, TaskRequestDto } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentModeRouterService } from './agent-mode-router.service';
import { RoutingPolicyAdapterService } from './routing-policy-adapter.service';
import { PlanEngineService } from '@agent-platform/services/plan-engine.service';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeExecutionService } from '@agent-platform/services/agent-runtime-execution.service';
import { AgentRuntimeAgentMetadata } from '@agent-platform/interfaces/agent-runtime-agent-metadata.interface';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentRuntimeStreamService } from '@agent-platform/services/agent-runtime-stream.service';
import { HumanApprovalsRepository } from '@agent-platform/repositories/human-approvals.repository';

@Injectable()
export class AgentExecutionGateway {
  private readonly logger = new Logger(AgentExecutionGateway.name);

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly runtimeExecution: AgentRuntimeExecutionService,
    private readonly routingPolicy: RoutingPolicyAdapterService,
    private readonly modeRouter: AgentModeRouterService,
    private readonly planEngine: PlanEngineService,
    private readonly streamService: AgentRuntimeStreamService,
    private readonly approvals: HumanApprovalsRepository,
    @Inject(HttpService) private readonly httpService?: HttpService,
  ) {}

  async execute(
    context: ExecutionContext,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const agent = await this.agentRegistry.getAgent(
      context.orgSlug,
      context.agentSlug,
    );

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const definition = this.runtimeDefinitions.buildDefinition(agent);
    const agentMetadata = this.runtimeExecution.getAgentMetadataFromDefinition(
      definition,
      context.orgSlug,
    );

    // Observability: Agent execution started
    this.emitAgentLifecycleEvent('agent.started', 'Agent execution started', {
      definition,
      request,
      organizationSlug: context.orgSlug,
    });

    // Skip routing policy for dashboard mode (pure data operations, no LLM calls)
    // Cast mode to string to handle custom modes not in AgentTaskMode enum
    const isDashboardMode = (request.mode as unknown as string) === 'dashboard';
    let routingMetadata: Record<string, unknown> = { agentMetadata };

    if (!isDashboardMode) {
      const assessment = await this.routingPolicy.evaluate(request, agent);
      routingMetadata = {
        ...(assessment.metadata ?? {}),
        agentMetadata,
      };

      if (assessment.showstopper) {
        return TaskResponseDto.human(
          assessment.humanMessage ?? 'Routing policy requires human review.',
          'routing_showstopper',
        );
      }
    }

    // Enforce execution capabilities before routing
    this.logger.debug(
      `🔍 [GATEWAY-DEBUG] exec capabilities: canBuild=${definition.execution.canBuild}, canPlan=${definition.execution.canPlan}, canConverse=${definition.execution.canConverse}, modeProfile=${definition.execution.modeProfile}`,
    );
    const unsupported = this.checkUnsupportedMode(definition, request.mode!);
    if (unsupported) {
      this.logger.warn(
        `🔍 [GATEWAY-DEBUG] Mode ${request.mode} is NOT supported by agent ${context.agentSlug}`,
      );
    } else {
      this.logger.debug(
        `🔍 [GATEWAY-DEBUG] Mode ${request.mode} IS supported by agent ${context.agentSlug}`,
      );
    }
    if (unsupported) {
      this.emitAgentLifecycleEvent('agent.failed', 'Unsupported mode', {
        definition,
        request,
        organizationSlug: context.orgSlug,
      });
      return unsupported;
    }

    try {
      let response: TaskResponseDto;

      // All modes delegate to mode router with ExecutionContext
      this.logger.debug(
        `🔍 [GATEWAY-DEBUG] About to call modeRouter.execute() - mode: ${request.mode}, agentType: ${definition.agentType}, agentSlug: ${context.agentSlug}`,
      );
      switch (request.mode!) {
        case AgentTaskMode.CONVERSE:
        case AgentTaskMode.PLAN:
        case AgentTaskMode.BUILD:
        case AgentTaskMode.HITL:
          this.logger.debug(
            `🔍 [GATEWAY-DEBUG] Entering modeRouter.execute() switch case for mode: ${request.mode}`,
          );
          try {
            response = await this.modeRouter.execute({
              context,
              definition,
              request,
              routingMetadata,
            });
            this.logger.debug(
              `🔍 [GATEWAY-DEBUG] modeRouter.execute() returned: success=${response?.success}`,
            );
          } catch (routerError) {
            this.logger.error(
              `🔍 [GATEWAY-DEBUG] modeRouter.execute() threw error:`,
              routerError,
            );
            throw routerError;
          }
          break;
        default:
          // Handle custom modes (e.g., 'dashboard' for prediction agents)
          // Route through modeRouter which delegates to type-specific runners
          this.logger.debug(
            `🔍 [GATEWAY-DEBUG] Custom mode detected: ${request.mode}, routing to modeRouter`,
          );
          try {
            response = await this.modeRouter.execute({
              context,
              definition,
              request,
              routingMetadata,
            });
            this.logger.debug(
              `🔍 [GATEWAY-DEBUG] modeRouter.execute() for custom mode returned: success=${response?.success}`,
            );
          } catch (routerError) {
            this.logger.error(
              `🔍 [GATEWAY-DEBUG] modeRouter.execute() for custom mode threw error:`,
              routerError,
            );
            throw routerError;
          }
      }

      // Emit completion or failure based on response
      if (response.success) {
        this.emitAgentLifecycleEvent(
          'agent.completed',
          'Agent execution completed',
          {
            definition,
            request,
            organizationSlug: context.orgSlug,
          },
        );
      } else {
        this.emitAgentLifecycleEvent('agent.failed', 'Agent execution failed', {
          definition,
          request,
          organizationSlug: context.orgSlug,
        });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.emitAgentLifecycleEvent(
        'agent.failed',
        `Agent execution error: ${errorMessage}`,
        {
          definition,
          request,
          organizationSlug: context.orgSlug,
        },
      );
      throw error;
    }
  }

  private checkUnsupportedMode(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode,
  ): TaskResponseDto | null {
    const exec = definition.execution;
    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return exec.canConverse
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.PLAN:
        return exec.canPlan
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.BUILD:
        return exec.canBuild
          ? null
          : TaskResponseDto.failure(mode, 'Mode not supported by agent');
      case AgentTaskMode.HITL:
        // HITL is always allowed - it's for resuming interrupted workflows
        // The actual capability check happens when the workflow was started
        return null;
      default:
        return null;
    }
  }

  private async handlePlan(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
  ): Promise<TaskResponseDto> {
    const conversationId = request.context?.conversationId;
    if (!conversationId) {
      throw new BadRequestException(
        'conversationId is required for plan generation',
      );
    }

    const fallbackPlan: JsonObject = {
      summary: request.userMessage ?? 'Plan draft not provided',
    };
    const draftPlan = this.toJsonObject(
      request.payload?.planDraft,
      fallbackPlan,
    );

    const metadata = this.runtimeExecution.collectRequestMetadata(request);
    const createdByValue = metadata.createdBy;
    const createdBy =
      typeof createdByValue === 'string' ? createdByValue : null;

    const summaryValue = request.payload?.summary;
    const summary = typeof summaryValue === 'string' ? summaryValue : null;

    const planRecord = await this.planEngine.generateDraft({
      conversationId,
      organizationSlug,
      agentSlug: agent.slug,
      summary,
      draftPlan,
      createdBy,
      agentMetadata,
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content: planRecord,
      metadata: {
        agentSlug: definition.slug,
        organizationSlug,
      },
    });
  }

  private async handleBuild(
    organizationSlug: string | null,
    agent: AgentRecord,
    definition: AgentRuntimeDefinition,
    agentMetadata: AgentRuntimeAgentMetadata,
    request: TaskRequestDto,
    routingMetadata?: Record<string, unknown>,
  ): Promise<TaskResponseDto> {
    // AgentExecutionContext expects context from the request, definition, and routingMetadata
    return this.modeRouter.execute({
      context: request.context,
      definition,
      request,
      routingMetadata,
    });
  }

  // REMOVED: startOrchestrationFromRequest method (292 lines)
  // Orchestration logic is no longer needed - agent runner handles delegation

  // REMOVED: validatePromptInputs method (orchestration-specific)

  private async resolvePlanForExecution(
    organizationSlug: string | null,
    agent: AgentRecord,
    request: TaskRequestDto,
  ): Promise<ConversationPlanRecord> {
    const planId = request.context?.planId;
    if (!planId) {
      throw new BadRequestException('planId is required for plan execution');
    }

    const plan = await this.planEngine.getPlan(planId);

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const normalizedOrg = organizationSlug ?? null;
    if ((plan.organization_slug ?? null) !== normalizedOrg) {
      throw new BadRequestException('Plan belongs to a different organization');
    }

    if (plan.agent_slug !== agent.slug) {
      throw new BadRequestException('Plan is not associated with this agent');
    }

    if (plan.conversation_id !== request.context?.conversationId) {
      throw new BadRequestException('Plan is tied to a different conversation');
    }

    return plan;
  }

  private attachAgentMetadata(
    draft: Record<string, unknown>,
    definition: AgentRuntimeDefinition,
  ): Record<string, unknown> {
    if (!draft || typeof draft !== 'object') {
      return draft;
    }

    const enriched = { ...draft };
    const draftWithMeta = enriched as Record<string, unknown> & {
      _meta?: Record<string, unknown>;
    };
    const existingMeta = draftWithMeta._meta ?? {};
    draftWithMeta._meta = {
      ...existingMeta,
      agent: {
        slug: definition.slug,
        name: definition.name,
        agentType: definition.agentType,
        modeProfile: definition.execution.modeProfile,
        organizationSlug: definition.organizationSlug,
      },
    };

    return enriched;
  }

  // NOTE: Removed handlePlan and handleBuild methods as they are now handled by mode router

  private collectMetadata(request: TaskRequestDto): Record<string, unknown> {
    return {
      ...(request.payload?.metadata ?? {}),
      ...(request.metadata ?? {}),
    };
  }

  // REMOVED: triggerRunProcessing method (orchestration-specific)

  private maybeStartStream(
    request: TaskRequestDto,
    organizationSlug: string | null,
    agent: AgentRecord,
    mode: AgentTaskMode,
  ) {
    const payloadOptions = request.payload?.options as
      | Record<string, unknown>
      | undefined;
    const metadata = request.metadata;
    const payloadMetadata = request.payload?.metadata as
      | Record<string, unknown>
      | undefined;

    const wantsStream = Boolean(payloadOptions?.stream || metadata?.stream);

    if (!wantsStream) {
      return null;
    }

    const streamIdValue = metadata?.streamId || payloadMetadata?.streamId;
    const providedStreamId =
      typeof streamIdValue === 'string' ? streamIdValue : undefined;

    return this.streamService.start(
      {
        conversationId: request.context?.conversationId,
        sessionId: request.context?.taskId,
        organizationSlug,
        agentSlug: agent.slug,
        mode,
      },
      providedStreamId,
    );
  }

  private publishStreamChunk(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    chunk: { type: 'partial' | 'final'; content: string },
  ) {
    if (!session) {
      return;
    }

    session.publishChunk(chunk);
  }

  private completeStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ) {
    if (!session) {
      return;
    }

    session.complete();
  }

  private errorStream(
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
    error: unknown,
  ) {
    if (!session) {
      return;
    }

    session.error(error);
  }

  private attachStreamId(
    metadata: Record<string, unknown>,
    session: ReturnType<AgentRuntimeStreamService['start']> | null,
  ): Record<string, unknown> {
    if (!session) {
      return metadata;
    }

    return {
      ...metadata,
      streamId: session.streamId,
    };
  }

  private notImplemented(mode: AgentTaskMode): TaskResponseDto {
    return TaskResponseDto.failure(
      mode,
      'Orchestration mode not implemented yet',
    );
  }

  // REMOVED: resolveCheckpointAndMaybeResume method (orchestration-specific)

  private toJsonObject(value: unknown, fallback: JsonObject): JsonObject {
    if (this.isJsonObject(value)) {
      return { ...value } as JsonObject;
    }

    return { ...fallback } as JsonObject;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Emit agent lifecycle event for observability.
   * Fire-and-forget to avoid blocking agent execution.
   */
  private emitAgentLifecycleEvent(
    eventType: string,
    message: string,
    context: {
      definition: AgentRuntimeDefinition;
      request: TaskRequestDto;
      organizationSlug: string | null;
    },
  ): void {
    try {
      const userId = this.resolveUserId(context.request);
      const conversationId = context.request.context?.conversationId || null;
      const taskId = (context.request.payload as Record<string, unknown>)
        ?.taskId as string | null;

      // Fire webhook call (non-blocking)
      const apiPort = process.env.API_PORT || '6100';
      const webhookUrl = `http://localhost:${apiPort}/webhooks/status`;
      if (this.httpService) {
        this.httpService
          .post(webhookUrl, {
            taskId: taskId || conversationId || 'unknown',
            status: eventType,
            timestamp: new Date().toISOString(),
            message,
            userId: userId || undefined,
            conversationId: conversationId || undefined,
            agentSlug: context.definition.slug,
            organizationSlug: context.organizationSlug || 'global',
            mode: context.request.mode || undefined,
          })
          .toPromise()
          .catch((error: Error) => {
            // Log but don't throw - observability should never break execution
            this.logger.warn(
              `Failed to emit observability event (${eventType}): ${error.message}`,
            );
          });
      }
    } catch (error) {
      // Silently catch - observability is non-critical
      this.logger.debug(
        `Error preparing observability event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private resolveUserId(request: TaskRequestDto): string | null {
    return (
      ((request.metadata as Record<string, unknown>)?.userId as string) ||
      ((request.payload as Record<string, unknown>)?.userId as string) ||
      null
    );
  }
}
