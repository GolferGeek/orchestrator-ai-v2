import { Injectable, Logger } from '@nestjs/common';
import { TaskRequestDto, AgentTaskMode } from '../dto/task-request.dto';
import { TaskResponseDto } from '../dto/task-response.dto';
import { AgentRecord } from '@agent-platform/interfaces/agent.interface';
import { AgentRegistryService } from '@agent-platform/services/agent-registry.service';
import { AgentRuntimeDefinitionService } from '@agent-platform/services/agent-runtime-definition.service';
import { AgentRuntimeDefinition } from '@agent-platform/interfaces/agent.interface';
import { AgentRunnerRegistryService } from './agent-runner-registry.service';

export interface AgentExecutionContext {
  organizationSlug?: string | null;
  agentSlug?: string;
  agent?: AgentRecord;
  definition?: AgentRuntimeDefinition;
  request: TaskRequestDto;
  routingMetadata?: Record<string, unknown>;
}

type HydratedExecutionContext = AgentExecutionContext & {
  organizationSlug: string | null;
  agentSlug: string;
  agent: AgentRecord;
  definition: AgentRuntimeDefinition;
};

@Injectable()
export class AgentModeRouterService {
  private readonly logger = new Logger(AgentModeRouterService.name);

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly runtimeDefinitions: AgentRuntimeDefinitionService,
    private readonly runnerRegistry: AgentRunnerRegistryService,
  ) {}

  async execute(context: AgentExecutionContext): Promise<TaskResponseDto> {
    // Check if this is an HITL method (uses 'method' field in payload)
    const payload = context.request.payload as Record<string, unknown> | undefined;
    const method = payload?.method as string | undefined;

    this.logger.log(
      `🔍 [MODE-ROUTER] execute() called - mode: ${context.request.mode}, payload.method: ${method}, agentSlug: ${context.agentSlug}`,
    );

    // Route HITL methods (hitl.resume, hitl.status, hitl.history, hitl.pending)
    if (method?.startsWith('hitl.')) {
      this.logger.log(`🔍 [MODE-ROUTER] Routing to HITL method handler: ${method}`);
      return this.routeHitlMethod(method, context);
    }

    const hydrated = await this.hydrateContext(context);

    if (!hydrated) {
      return TaskResponseDto.failure(
        context.request.mode!,
        'Agent record unavailable for execution',
      );
    }

    // Route to the appropriate runner based on agent type
    const agentType = hydrated.definition.agentType;
    const runner = this.runnerRegistry.getRunner(agentType);

    if (!runner) {
      this.logger.error(
        `No runner registered for agent type ${agentType}. Agent: ${hydrated.agentSlug}`,
      );
      return TaskResponseDto.failure(
        hydrated.request.mode!,
        `No runner available for agent type: ${agentType}`,
      );
    }

    this.logger.log(
      `Routing ${hydrated.request.mode} request to ${agentType} runner for agent ${hydrated.agentSlug}`,
    );
    return await runner.execute(
      hydrated.definition,
      hydrated.request,
      hydrated.organizationSlug,
    );
  }

  /**
   * Route HITL-specific methods
   * All HITL methods are handled by the API agent runner
   *
   * Methods:
   * - hitl.resume: Resume workflow with decision
   * - hitl.status: Get HITL status for a task
   * - hitl.history: Get version history for a task
   * - hitl.pending: Get all pending HITL reviews (cross-agent, uses _system)
   */
  private async routeHitlMethod(
    method: string,
    context: AgentExecutionContext,
  ): Promise<TaskResponseDto> {
    this.logger.log(`Routing HITL method: ${method}`);

    // For hitl.pending, we don't need an agent - it's a cross-agent query
    const agentSlug = context.agentSlug;
    if (method === 'hitl.pending' || agentSlug === '_system') {
      return this.handleSystemHitlMethod(method, context);
    }

    // For other HITL methods, we need to hydrate the context to get agent info
    const hydrated = await this.hydrateContext(context);

    if (!hydrated) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'Agent record unavailable for HITL execution',
      );
    }

    // Get API runner (handles HITL for all agent types)
    const apiRunner = this.runnerRegistry.getRunner('api');

    if (!apiRunner) {
      this.logger.error('API runner not registered - required for HITL');
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'API runner not available for HITL operations',
      );
    }

    // Pass the HITL method in request so runner knows what to do
    const hitlRequest: TaskRequestDto = {
      ...hydrated.request,
      mode: AgentTaskMode.HITL,
      payload: {
        ...(hydrated.request.payload as Record<string, unknown>),
        hitlMethod: method, // hitl.resume, hitl.status, hitl.history
      },
    };

    return apiRunner.execute(
      hydrated.definition,
      hitlRequest,
      hydrated.organizationSlug,
    );
  }

  /**
   * Handle system-level HITL methods (like hitl.pending)
   * These don't require a specific agent definition
   */
  private async handleSystemHitlMethod(
    method: string,
    context: AgentExecutionContext,
  ): Promise<TaskResponseDto> {
    // Only hitl.pending is supported for system-level queries
    if (method !== 'hitl.pending') {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        `Method ${method} not supported for _system agent. Only hitl.pending is allowed.`,
      );
    }

    // Get API runner
    const apiRunner = this.runnerRegistry.getRunner('api');

    if (!apiRunner) {
      return TaskResponseDto.failure(
        AgentTaskMode.HITL,
        'API runner not available for HITL pending query',
      );
    }

    // Build request with null definition (system-level query)
    const hitlRequest: TaskRequestDto = {
      ...context.request,
      mode: AgentTaskMode.HITL,
      payload: {
        ...(context.request.payload as Record<string, unknown>),
        hitlMethod: 'hitl.pending',
      },
    };

    // Execute with null definition - API runner will handle system queries
    return apiRunner.execute(
      null as unknown as AgentRuntimeDefinition, // System-level, no agent needed
      hitlRequest,
      context.organizationSlug ?? null,
    );
  }

  private async hydrateContext(
    context: AgentExecutionContext,
  ): Promise<HydratedExecutionContext | null> {
    const existingAgent = context.agent;
    const agentSlug = context.agentSlug ?? existingAgent?.slug;
    const organizationSlug =
      context.organizationSlug ?? existingAgent?.organization_slug ?? null;

    if (!agentSlug) {
      this.logger.warn('Agent slug missing from execution context');
      return null;
    }

    let agentRecord: AgentRecord | null = existingAgent ?? null;
    if (!agentRecord) {
      // Convert organizationSlug to first element if array, or use as is
      const orgSlugParam: string | null =
        Array.isArray(organizationSlug) && organizationSlug.length > 0
          ? (organizationSlug[0] ?? null)
          : typeof organizationSlug === 'string'
            ? organizationSlug
            : null;

      agentRecord = await this.agentRegistry.getAgent(orgSlugParam, agentSlug);
    }

    if (!agentRecord) {
      const orgDisplay = Array.isArray(organizationSlug)
        ? organizationSlug.join(',')
        : (organizationSlug ?? 'global');
      this.logger.warn(
        `Agent ${agentSlug} not found for organization ${orgDisplay}`,
      );
      return null;
    }

    const definition =
      context.definition ??
      this.runtimeDefinitions.buildDefinition(agentRecord);

    // For organizationSlug in context, use first element if array
    const contextOrgSlug: string | null =
      Array.isArray(organizationSlug) && organizationSlug.length > 0
        ? (organizationSlug[0] ?? null)
        : typeof organizationSlug === 'string'
          ? organizationSlug
          : null;

    return {
      ...context,
      organizationSlug: contextOrgSlug,
      agentSlug,
      agent: agentRecord,
      definition,
    };
  }
}
