import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentCardBuilderService } from './services/agent-card-builder.service';
import { AgentExecutionGateway } from './services/agent-execution-gateway.service';
import { TaskRequestDto } from './dto/task-request.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  Agent2AgentTasksService,
  LlmSelection,
  ConversationMessage,
} from './services/agent-tasks.service';
import { Agent2AgentTaskStatusService } from './services/agent-task-status.service';
import { Agent2AgentConversationsService } from './services/agent-conversations.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AgentTaskMode,
  NormalizedTaskRequestDto,
} from './dto/task-request.dto';
import { AgentRegistryService } from '../agent-platform/services/agent-registry.service';
import { AgentRecord } from '../agent-platform/interfaces/agent.interface';
import { Public } from '../auth/decorators/public.decorator';
import { Agent2AgentDeliverablesService } from './services/agent2agent-deliverables.service';
import {
  A2ATaskSuccessResponse,
  A2ATaskErrorResponse,
  NIL_UUID,
  AgentStreamChunkData,
  AgentStreamCompleteData,
  AgentStreamErrorData,
  AgentStreamChunkSSEEvent,
  AgentStreamCompleteSSEEvent,
  AgentStreamErrorSSEEvent,
  SSEEvent,
} from '@orchestrator-ai/transport-types';
import { Response, Request } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateStreamTokenDto } from './dto/create-stream-token.dto';
import {
  StreamTokenClaims,
  StreamTokenService,
} from '../auth/services/stream-token.service';
import { TaskStatusService } from './tasks/task-status.service';
import { TasksService } from './tasks/tasks.service';
import { DeliverablesService } from './deliverables/deliverables.service';
import {
  DeliverableFormat,
  DeliverableVersionCreationType,
} from './deliverables/dto';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from '../observability/observability-events.service';
import { Subscription } from 'rxjs';

interface NormalizedTaskRequest {
  dto: NormalizedTaskRequestDto;
  jsonrpc?: {
    id: string | number | null;
    method?: string | null;
  };
}

interface TaskExecutionResult {
  taskCompletionHandled?: boolean;
  metadata?: {
    taskCompletionHandled?: boolean;
    [key: string]: unknown;
  };
  deliverableId?: string;
  [key: string]: unknown;
}

interface RequestWithStreamData extends Request {
  sanitizedUrl?: string;
  streamTokenClaims?: StreamTokenClaims;
}

interface FrontendTaskRequest {
  jsonrpc?: string;
  mode?: string;
  method?: string;
  prompt?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  conversationId?: string;
  params?: Record<string, unknown>;
  llmSelection?: LlmSelection;
  executionMode?: string;
  taskId?: string;
  timeoutSeconds?: number;
  metadata?: Record<string, unknown>;
  id?: string;
  [key: string]: unknown;
}

// Use shared protocol types
type JsonRpcSuccessEnvelope = A2ATaskSuccessResponse;
type JsonRpcErrorEnvelope = A2ATaskErrorResponse;

type AgentTaskRecord = NonNullable<
  Awaited<ReturnType<Agent2AgentTasksService['getTaskById']>>
>;

@Controller()
export class Agent2AgentController {
  constructor(
    private readonly cardBuilder: AgentCardBuilderService,
    private readonly gateway: AgentExecutionGateway,
    private readonly tasksService: Agent2AgentTasksService,
    private readonly agentTaskStatusService: Agent2AgentTaskStatusService,
    private readonly taskStatusCache: TaskStatusService,
    private readonly agentConversationsService: Agent2AgentConversationsService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly agentDeliverablesService: Agent2AgentDeliverablesService,
    private readonly streamTokenService: StreamTokenService,
    private readonly eventEmitter: EventEmitter2,
    private readonly deliverablesService: DeliverablesService,
    private readonly taskUpdateService: TasksService,
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  private readonly logger = new Logger(Agent2AgentController.name);

  /**
   * Create conversation for database agents
   * Route: POST /agent-to-agent/conversations
   */
  @Post('agent-to-agent/conversations')
  @UseGuards(JwtAuthGuard)
  async createConversation(
    @Body()
    body: {
      agentName: string;
      organization: string;
      conversationId?: string;
      metadata?: Record<string, unknown>;
    },
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ) {
    const conversation =
      await this.agentConversationsService.createConversation(
        {
          userId: currentUser.id,
          orgSlug: body.organization,
        },
        body.agentName,
        {
          metadata: body.metadata,
        },
      );

    return conversation;
  }

  /**
   * Get hierarchy of database agents (A2A protocol)
   * Route: GET /agent-to-agent/.well-known/hierarchy
   */
  @Get('agent-to-agent/.well-known/hierarchy')
  @Public()
  async getAgentHierarchy(
    @Headers('x-organization-slug') organizationHeader?: string,
  ) {
    const effectiveHeader = organizationHeader;
    const organizations = effectiveHeader
      ? effectiveHeader
          .split(',')
          .map((org) => org.trim())
          .filter(Boolean)
      : undefined;

    try {
      const databaseAgents = await this.fetchDatabaseAgents(organizations);
      const hierarchy = this.buildDatabaseHierarchy(databaseAgents);

      return {
        success: true,
        data: hierarchy,
        metadata: {
          totalAgents: databaseAgents.length,
          rootNodes: hierarchy.length,
          organizations: organizations ?? 'all',
          source: 'database',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Error fetching agent hierarchy:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        metadata: {
          totalAgents: 0,
          rootNodes: 0,
          organizations: organizations ?? 'all',
          source: 'database',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  @Get([
    'agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json',
    'agents/:orgSlug/:agentSlug/.well-known/agent.json',
  ])
  async getAgentCard(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Query('includePrivate') includePrivate?: string,
    @Query('include_private') includePrivateSnake?: string,
  ) {
    const org = orgSlug === 'global' ? null : orgSlug;
    const includePrivateFields = this.resolveBooleanQuery(
      includePrivate,
      includePrivateSnake,
    );

    const options =
      includePrivateFields === undefined ? undefined : { includePrivateFields };

    return this.cardBuilder.build(org, agentSlug, options);
  }

  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks')
  @UseGuards(JwtAuthGuard)
  async executeTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Body() body: FrontendTaskRequest,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: RequestWithStreamData,
  ): Promise<TaskResponseDto | JsonRpcSuccessEnvelope | JsonRpcErrorEnvelope> {
    this.logger.log(
      `🔍 [A2A-CTRL] Request received - org: ${orgSlug}, agent: ${agentSlug}, body.method: ${(body as Record<string, unknown>)?.method}`,
    );

    // ADAPTER: Transform frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
    const adaptedBody = this.adaptFrontendRequest(body);
    const { dto, jsonrpc } = await this.normalizeTaskRequest(adaptedBody);

    this.logger.log(
      `🔍 [A2A-CTRL] After normalization - mode: ${dto.mode}, payload.method: ${(dto.payload as Record<string, unknown>)?.method}, taskId: ${dto.context?.taskId}`,
    );

    // =========================================================================
    // EXECUTION CONTEXT HANDLING
    // The context is created by frontend and flows through unchanged.
    // Backend can ONLY mutate: taskId, deliverableId, planId (when first created)
    // Backend must VALIDATE: userId matches JWT auth
    // =========================================================================

    // 1. VALIDATE: Context must exist (created by frontend)
    if (!dto.context) {
      throw new BadRequestException(
        'ExecutionContext is required. Frontend must send context in request params.',
      );
    }

    // 2. VALIDATE: userId must match authenticated user
    if (dto.context.userId !== currentUser.id) {
      throw new UnauthorizedException(
        'Context userId does not match authenticated user',
      );
    }

    // 3. VALIDATE: Agent exists
    const agentRecord = await this.agentRegistry.getAgent(
      dto.context.orgSlug,
      dto.context.agentSlug,
    );
    if (!agentRecord) {
      throw new NotFoundException(
        `Agent ${dto.context.agentSlug} not found in organization ${dto.context.orgSlug || 'global'}`,
      );
    }

    // Context reference - we only mutate taskId when creating a new task
    const context = dto.context;

    try {
      // Check if this is an HITL method (hitl.resume, hitl.status, etc.)
      // These methods operate on existing tasks, not create new ones
      const payloadMethod =
        typeof dto.payload?.method === 'string' ? dto.payload.method : null;
      const isHitlMethod =
        payloadMethod?.startsWith('hitl.') || dto.mode === AgentTaskMode.HITL;

      // For HITL operations, taskId should already be set in context
      const hasExistingTask = context.taskId && context.taskId !== NIL_UUID;

      if (isHitlMethod && hasExistingTask) {
        // HITL operations use the existing task - don't create a new one
        this.logger.log(
          `🔄 HITL operation (${payloadMethod || dto.mode}) using existing task: ${context.taskId}`,
        );
      } else {
        // Build conversation history from messages
        const conversationHistoryFromMessages: ConversationMessage[] =
          dto.messages?.map((msg) => {
            const content =
              typeof msg.content === 'string'
                ? msg.content
                : msg.content && typeof msg.content === 'object'
                  ? JSON.stringify(msg.content)
                  : '';
            return {
              role: msg.role,
              content,
              timestamp: new Date().toISOString(),
            };
          }) || [];

        // Create task - this is the ONE place we can set taskId
        const task = await this.tasksService.createTask(
          {
            userId: context.userId,
            orgSlug: context.orgSlug,
            conversationId:
              context.conversationId !== NIL_UUID
                ? context.conversationId
                : undefined,
          },
          context.agentSlug,
          {
            method: dto.mode,
            prompt: dto.userMessage || '',
            taskId: hasExistingTask ? context.taskId : undefined,
            metadata: dto.metadata || {},
            llmSelection: {
              provider: context.provider,
              model: context.model,
            },
            conversationHistory: conversationHistoryFromMessages,
          },
        );

        // MUTATION: Set taskId when first created (from NIL_UUID)
        if (context.taskId === NIL_UUID) {
          context.taskId = task.id;
        }
      }

      // Mark task as running before execution starts
      await this.agentTaskStatusService.updateTaskStatus(context, {
        status: 'running',
      });

      // Execute the agent - context flows through unchanged
      const result = await this.gateway.execute(context, dto);
      this.attachStreamMetadata(result, {
        request,
        organizationSlug: context.orgSlug,
        agentSlug: context.agentSlug,
        taskId: context.taskId,
        conversationId: context.conversationId || null,
      });

      // Check if task completion was already handled by the agent
      const typedResult = result as unknown as TaskExecutionResult;
      const taskAlreadyHandled =
        result &&
        (typedResult.taskCompletionHandled === true ||
          (typedResult.metadata &&
            typedResult.metadata.taskCompletionHandled === true));

      if (!taskAlreadyHandled) {
        // Create deliverable - this is where deliverableId can be set
        const deliverableId =
          await this.agentDeliverablesService.createFromTaskResult(
            result,
            context.userId,
            context.taskId,
            context.agentSlug,
            context.conversationId,
            dto.mode,
          );

        // MUTATION: Set deliverableId when first created (from NIL_UUID)
        if (deliverableId) {
          if (context.deliverableId === NIL_UUID) {
            context.deliverableId = deliverableId;
          }
          if (typeof result === 'object' && result !== null) {
            typedResult.deliverableId = deliverableId;
          }
        }

        // Update task with result
        await this.agentTaskStatusService.completeTask(context, result);
      }

      this.logRequest({
        org: context.orgSlug,
        agentSlug: context.agentSlug,
        dto,
        jsonrpc,
        status: 'success',
        error: null,
      });

      if (jsonrpc) {
        return {
          jsonrpc: '2.0',
          id: jsonrpc.id ?? null,
          result,
        } as A2ATaskSuccessResponse;
      }

      return result;
    } catch (error) {
      this.logger.error(
        `❌ [Agent2AgentController] Error executing task:`,
        error,
      );

      if (!jsonrpc) {
        this.logRequest({
          org: context.orgSlug,
          agentSlug: context.agentSlug,
          dto,
          jsonrpc: null,
          status: 'error',
          error,
        });
        throw error;
      }

      this.logRequest({
        org: context.orgSlug,
        agentSlug: context.agentSlug,
        dto,
        jsonrpc,
        status: 'error',
        error,
      });

      return this.buildJsonRpcError(jsonrpc.id ?? null, error);
    }
  }

  /**
   * Completion callback endpoint for async agents (e.g., n8n workflows)
   * This is NOT authenticated - n8n sends results here with taskId/userId in body
   * Route: POST /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/complete
   */
  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/complete')
  @HttpCode(200)
  async handleTaskCompletion(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      conversationId: string;
      status: 'success' | 'failed';
      results?: unknown;
      error?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const org = this.normalizeOrgSlug(orgSlug);

      // Update task status
      if (body.status === 'failed') {
        await this.taskUpdateService.updateTask(taskId, body.userId, {
          status: 'failed',
          progress: 0,
          progressMessage: body.error || 'Task failed',
        });

        // Emit failure event for async agents waiting for completion
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          error: body.error || 'Task failed',
        });

        return {
          success: true,
          message: 'Task marked as failed',
        };
      }

      // Success case - update task and create deliverable
      // Extract deliverable type from results if available
      const resultsObj = body.results as
        | { type?: string; payload?: { type?: string } }
        | undefined;
      const deliverableType =
        resultsObj?.type || resultsObj?.payload?.type || null;

      await this.taskUpdateService.updateTask(taskId, body.userId, {
        status: 'completed',
        progress: 100,
        progressMessage: 'Task completed successfully',
        response: body.results ? JSON.stringify(body.results) : undefined,
        ...(deliverableType && { deliverableType }),
      });

      // Create deliverable with results
      if (body.results && body.conversationId) {
        // Format results based on agent type
        const formattedContent = this.formatCompletionResults(
          agentSlug,
          body.results,
        );

        await this.deliverablesService.create(
          {
            title: `Results from ${agentSlug}`,
            conversationId: body.conversationId,
            agentName: agentSlug,
            initialContent: formattedContent,
            initialFormat: DeliverableFormat.MARKDOWN,
            initialCreationType:
              DeliverableVersionCreationType.CONVERSATION_TASK,
            initialTaskId: taskId,
            initialMetadata: {
              completedAt: new Date().toISOString(),
              agentSlug,
              organizationSlug: org,
            },
          },
          body.userId,
        );

        // Emit event for async agents waiting for completion
        this.eventEmitter.emit(`task.completion.${taskId}`, {
          deliverable: formattedContent,
        });
      }

      return {
        success: true,
        message: 'Task completed and deliverable created',
      };
    } catch (error) {
      this.logger.error(
        `Failed to handle completion callback for task ${taskId}:`,
        error,
      );
      throw error;
    }
  }

  @Post('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream-token')
  @UseGuards(JwtAuthGuard)
  async createStreamToken(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Body() body: CreateStreamTokenDto,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
  ) {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);

    const task = await this.ensureTaskOwnership(taskId, currentUser.id);
    this.assertTaskContext(task, agentSlug, organizationSlug);

    const { token, expiresAt } = this.streamTokenService.issueToken({
      user: currentUser,
      taskId,
      agentSlug,
      organizationSlug,
      streamId: body.streamId,
      conversationId: task.agentConversationId ?? null,
    });

    return {
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  @Get('agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream')
  @UseGuards(JwtAuthGuard)
  async streamAgentTask(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
    @Param('taskId') taskId: string,
    @Query('streamId') streamIdParam: string | undefined,
    @CurrentUser() currentUser: SupabaseAuthUserDto,
    @Req() request: RequestWithStreamData,
    @Res() response: Response,
  ): Promise<void> {
    const organizationSlug = this.normalizeOrgSlug(orgSlug);
    const claims = request.streamTokenClaims;

    if (claims) {
      if (
        claims.taskId !== taskId ||
        claims.agentSlug !== agentSlug ||
        claims.organizationSlug !== organizationSlug
      ) {
        throw new UnauthorizedException('Stream token does not match request');
      }
    }

    const task = await this.ensureTaskOwnership(taskId, currentUser.id);
    this.assertTaskContext(task, agentSlug, organizationSlug);

    const streamId = streamIdParam || claims?.streamId;
    const expectedConversationId = task.agentConversationId ?? null;

    let streamSessionId: string | null = null;
    let observabilitySubscription: Subscription | null = null;
    try {
      streamSessionId = this.taskStatusCache.registerStreamSession({
        taskId,
        userId: currentUser.id,
        agentSlug,
        organizationSlug,
        streamId: streamId ?? null,
        conversationId: expectedConversationId,
      });
    } catch (error) {
      this.logger.warn('Failed to register stream session', {
        taskId,
        streamId: streamId ?? null,
        error: (error as Error)?.message,
      });
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    response.flushHeaders?.();
    response.write(': connected\n\n');

    const keepAlive = setInterval(() => {
      response.write(': keepalive\n\n');
    }, 15000);

    let streamActive = true;
    const observabilityFilters = {
      taskId,
      agentSlug,
      organizationSlug,
      conversationId: expectedConversationId,
    };

    const cleanup = (cleanupReason?: string) => {
      if (!streamActive) {
        return;
      }
      streamActive = false;
      clearInterval(keepAlive);
      if (observabilitySubscription) {
        observabilitySubscription.unsubscribe();
        observabilitySubscription = null;
      }
      if (streamSessionId) {
        this.taskStatusCache.unregisterStreamSession(
          streamSessionId,
          cleanupReason ?? 'connection_cleanup',
        );
        streamSessionId = null;
      }
    };

    const endStream = (reason: string) => {
      cleanup(reason);
      if (!response.writableEnded) {
        response.end();
      }
    };

    // Replay recent observability events for this task
    const replayEvents = this.observabilityEvents
      .getSnapshot()
      .filter((event) =>
        this.matchesObservabilityEvent(event, observabilityFilters),
      );
    for (const eventRecord of replayEvents) {
      if (
        eventRecord.hook_event_type === 'agent.completed' ||
        eventRecord.hook_event_type === 'agent.failed'
      ) {
        continue;
      }
      const chunkEvent = this.toChunkSseEventFromObservability(eventRecord);
      if (chunkEvent) {
        this.writeSseEvent(response, chunkEvent);
      }
    }

    observabilitySubscription = this.observabilityEvents.events$.subscribe({
      next: (eventRecord) => {
        if (
          !this.matchesObservabilityEvent(eventRecord, observabilityFilters) ||
          !streamActive
        ) {
          return;
        }

        const hookType = eventRecord.hook_event_type;
        if (hookType === 'agent.completed' || hookType === 'task.completed') {
          const completeEvent =
            this.toCompleteSseEventFromObservability(eventRecord);
          if (completeEvent) {
            this.writeSseEvent(response, completeEvent);
          }
          endStream('complete');
          return;
        }

        if (hookType === 'agent.failed' || hookType === 'task.failed') {
          const errorEvent = this.toErrorSseEventFromObservability(eventRecord);
          if (errorEvent) {
            this.writeSseEvent(response, errorEvent);
          }
          endStream('error');
          return;
        }

        const chunkEvent = this.toChunkSseEventFromObservability(eventRecord);
        if (chunkEvent) {
          this.writeSseEvent(response, chunkEvent);
        }
      },
      error: (error) => {
        this.logger.warn(
          `Observability stream error for task ${taskId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      },
    });

    request.on('close', () => endStream('client_closed'));
    request.on('error', () => endStream('client_error'));
    response.on('close', () => endStream('response_closed'));
    response.on('error', () => endStream('response_error'));
  }

  /**
   * Minimal health endpoint for A2A agents
   * Route: GET /agent-to-agent/:orgSlug/:agentSlug/health
   * Public: returns a simple status payload without secrets
   */
  private normalizeOrgSlug(orgSlug: string): string {
    // 'global' is now an explicit organization slug for shared agents
    // No longer converting to null
    return orgSlug || 'global';
  }

  private attachStreamMetadata(
    result: TaskResponseDto,
    params: {
      request: Request;
      organizationSlug: string;
      agentSlug: string;
      taskId: string;
      conversationId: string | null;
    },
  ): void {
    if (!result || typeof result !== 'object' || !result.payload) {
      return;
    }

    const payload = result.payload;
    const metadata =
      (payload.metadata as Record<string, unknown> | undefined) ?? {};

    payload.metadata = metadata;

    const streamId = this.extractStreamId(result);
    const basePath = `/agent-to-agent/${params.organizationSlug}/${params.agentSlug}/tasks/${params.taskId}`;
    const streamPath = `${basePath}/stream`;
    const tokenPath = `${basePath}/stream-token`;
    const baseUrl = this.buildBaseUrl(params.request);
    const streamUrl = baseUrl ? `${baseUrl}${streamPath}` : streamPath;
    const tokenUrl = baseUrl ? `${baseUrl}${tokenPath}` : tokenPath;

    metadata.streamEndpoint = streamPath;
    metadata.streamTokenEndpoint = tokenPath;

    const existingStreaming =
      (metadata.streaming as Record<string, unknown> | undefined) ?? {};

    const streamingMetadata: Record<string, unknown> = {
      ...existingStreaming,
      streamEndpoint: streamPath,
      streamTokenEndpoint: tokenPath,
      streamUrl,
      streamTokenUrl: tokenUrl,
    };

    if (streamId) {
      streamingMetadata.streamId = streamId;
    }
    if (params.conversationId) {
      streamingMetadata.conversationId = params.conversationId;
    }

    metadata.streaming = streamingMetadata;
  }

  private extractStreamId(result: TaskResponseDto): string | undefined {
    const metadata = result.payload?.metadata as
      | Record<string, unknown>
      | undefined;
    if (!metadata) {
      return undefined;
    }

    const streaming = metadata.streaming as { streamId?: unknown } | undefined;
    const candidates: Array<unknown> = [metadata.streamId, streaming?.streamId];

    for (const candidate of candidates) {
      const value = this.asString(candidate);
      if (value) {
        return value;
      }
    }

    return undefined;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private buildBaseUrl(request: Request): string | null {
    const host =
      request.get('x-forwarded-host') ??
      request.get('host') ??
      request.headers['host'];

    if (!host || typeof host !== 'string') {
      return null;
    }

    const proto =
      request.get('x-forwarded-proto') ??
      request.protocol ??
      (request.secure ? 'https' : 'http');

    return `${proto}://${host}`;
  }

  private async ensureTaskOwnership(
    taskId: string,
    userId: string,
  ): Promise<AgentTaskRecord> {
    const task = await this.tasksService.getTaskById({ taskId, userId });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  private assertTaskContext(
    task: AgentTaskRecord,
    agentSlug: string,
    organizationSlug: string,
  ): void {
    if (task.agentName !== agentSlug) {
      throw new UnauthorizedException(
        'Task does not belong to the requested agent',
      );
    }

    // Normalize task organization: null → 'global', empty → 'global'
    const taskOrg =
      !task.organization || task.organization === ''
        ? 'global'
        : task.organization;

    if (taskOrg !== organizationSlug) {
      throw new UnauthorizedException(
        `Task does not belong to the requested organization (task: ${taskOrg}, requested: ${organizationSlug})`,
      );
    }
  }

  private matchesObservabilityEvent(
    event: ObservabilityEventRecord,
    filters: {
      taskId: string;
      agentSlug: string;
      organizationSlug: string;
      conversationId?: string | null;
    },
  ): boolean {
    if (event.task_id !== filters.taskId) {
      return false;
    }

    const eventOrg = this.normalizeOrgValue(event.organization_slug);
    if (eventOrg !== filters.organizationSlug) {
      return false;
    }

    if (filters.conversationId) {
      return event.conversation_id === filters.conversationId;
    }

    return true;
  }

  private toChunkSseEventFromObservability(
    event: ObservabilityEventRecord,
  ): AgentStreamChunkSSEEvent | null {
    const chunkData = this.buildChunkEventFromObservability(event);
    if (!chunkData) {
      return null;
    }
    return this.toChunkSseEvent(chunkData);
  }

  private toCompleteSseEventFromObservability(
    event: ObservabilityEventRecord,
  ): AgentStreamCompleteSSEEvent | null {
    if (!event.context) {
      this.logger.warn(
        `Observability event missing context for task ${event.task_id}`,
      );
      return null;
    }

    const completeEvent: AgentStreamCompleteData = {
      context: event.context,
      streamId: event.task_id,
      mode: event.mode ?? 'converse',
      userMessage: event.message || '',
      timestamp: new Date(event.timestamp).toISOString(),
      type: 'complete',
    };
    return this.toCompleteSseEvent(completeEvent);
  }

  private toErrorSseEventFromObservability(
    event: ObservabilityEventRecord,
  ): AgentStreamErrorSSEEvent | null {
    if (!event.context) {
      this.logger.warn(
        `Observability event missing context for task ${event.task_id}`,
      );
      return null;
    }

    const errorEvent: AgentStreamErrorData = {
      context: event.context,
      streamId: event.task_id,
      mode: event.mode ?? 'converse',
      userMessage: event.message || '',
      timestamp: new Date(event.timestamp).toISOString(),
      type: 'error',
      error:
        event.message ||
        (event.payload?.error as string) ||
        event.status ||
        'Agent task failed',
    };
    return this.toErrorSseEvent(errorEvent);
  }

  /**
   * Build chunk event from observability record
   * Uses the ExecutionContext stored with the event
   */
  private buildChunkEventFromObservability(
    event: ObservabilityEventRecord,
  ): AgentStreamChunkData | null {
    // Context should be present - it's stored with the event
    if (!event.context) {
      this.logger.warn(
        `Observability event missing context for task ${event.task_id}`,
      );
      return null;
    }

    return {
      context: event.context,
      streamId: event.task_id,
      mode: event.mode ?? 'converse',
      userMessage: event.message || '',
      timestamp: new Date(event.timestamp).toISOString(),
      chunk: {
        type: 'progress',
        content: this.resolveObservabilityContent(event),
        metadata: {
          progress: event.progress ?? undefined,
          step: event.step ?? undefined,
          message: event.message ?? undefined,
          status: event.status,
          hookEventType: event.hook_event_type,
          payload: event.payload,
          sequence: event.sequence ?? undefined,
          totalSteps: event.totalSteps ?? undefined,
        },
      },
    };
  }

  private resolveObservabilityContent(event: ObservabilityEventRecord): string {
    if (typeof event.message === 'string' && event.message.trim().length > 0) {
      return event.message;
    }
    const payloadMessage = event.payload?.message;
    if (
      typeof payloadMessage === 'string' &&
      payloadMessage.trim().length > 0
    ) {
      return payloadMessage;
    }
    return event.hook_event_type;
  }

  private normalizeOrgValue(value: string | null | undefined): string {
    if (value && value.trim().length > 0) {
      return value;
    }
    return 'global';
  }

  /**
   * Transform chunk event data to SSE event
   * Events now include full ExecutionContext - just wrap in SSE envelope
   */
  private toChunkSseEvent(
    event: AgentStreamChunkData,
  ): AgentStreamChunkSSEEvent {
    return {
      event: 'agent_stream_chunk',
      data: event,
    };
  }

  /**
   * Transform complete event data to SSE event
   * Events now include full ExecutionContext - just wrap in SSE envelope
   */
  private toCompleteSseEvent(
    event: AgentStreamCompleteData,
  ): AgentStreamCompleteSSEEvent {
    return {
      event: 'agent_stream_complete',
      data: event,
    };
  }

  /**
   * Transform error event data to SSE event
   * Events now include full ExecutionContext - just wrap in SSE envelope
   */
  private toErrorSseEvent(
    event: AgentStreamErrorData,
  ): AgentStreamErrorSSEEvent {
    return {
      event: 'agent_stream_error',
      data: event,
    };
  }

  private writeSseEvent(response: Response, event: SSEEvent): void {
    response.write(`event: ${event.event}\n`);
    response.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }

  @Get('agent-to-agent/:orgSlug/:agentSlug/health')
  getHealth(
    @Param('orgSlug') orgSlug: string,
    @Param('agentSlug') agentSlug: string,
  ) {
    const org = orgSlug === 'global' ? null : orgSlug;
    // We do not fetch agent details here to avoid side effects; this is a simple liveness check
    return {
      ok: true,
      service: 'agent-to-agent',
      organization: org ?? 'global',
      agent: agentSlug,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Adapt frontend CreateTaskDto format to Agent2Agent TaskRequestDto format
   * Frontend sends: { method, prompt, conversationHistory, llmSelection, ... }
   * Backend expects: { mode, userMessage, messages, payload, metadata, ... }
   */
  private adaptFrontendRequest(body: FrontendTaskRequest): FrontendTaskRequest {
    // Check if it's JSON-RPC format (frontend now sends this for database agents)
    if (body.jsonrpc === '2.0') {
      return body; // Let normalizeTaskRequest handle JSON-RPC
    }

    // If it already has 'mode' field, assume it's already in correct format
    if (body.mode) {
      return body;
    }

    // Transform frontend format to backend format
    const adapted: FrontendTaskRequest = {
      // Map 'method' to 'mode' enum
      mode: body.method || 'converse',

      // Map 'prompt' to 'userMessage'
      userMessage: body.prompt,

      // Map 'conversationHistory' to 'messages'
      messages: body.conversationHistory?.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),

      // Pass through standard fields
      conversationId: body.conversationId,

      // Pack additional data into payload
      payload: {
        ...(body.params || {}),
        llmSelection: body.llmSelection,
        executionMode: body.executionMode,
        taskId: body.taskId,
        timeoutSeconds: body.timeoutSeconds,
      },

      // Preserve metadata
      metadata: body.metadata,
    };

    return adapted;
  }

  private async normalizeTaskRequest(
    payload: unknown,
  ): Promise<NormalizedTaskRequest> {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Request body must be a JSON object.');
    }

    const typedPayload = payload as {
      jsonrpc?: unknown;
      params?: unknown;
      method?: unknown;
      mode?: unknown;
      id?: unknown;
    };

    const isJsonRpc =
      typeof typedPayload.jsonrpc === 'string' &&
      typedPayload.jsonrpc.length > 0;

    // For JSON-RPC, params may contain both standard DTO fields AND arbitrary params (like taskId for HITL)
    // We need to preserve all params in the payload field so they're not stripped by whitelist validation
    const paramsObj = isJsonRpc
      ? ((typedPayload.params ?? {}) as Record<string, unknown>)
      : {};

    const candidateSource = isJsonRpc
      ? (typedPayload.params ?? {})
      : typedPayload;
    const candidate = { ...(candidateSource as Record<string, unknown>) };

    // For JSON-RPC, ensure all params are preserved in payload (including taskId, decision, etc.)
    // This prevents whitelist validation from stripping non-standard DTO fields
    if (isJsonRpc) {
      const existingPayload =
        (candidate as Record<string, unknown>).payload || {};
      (candidate as Record<string, unknown>).payload = {
        ...(existingPayload as Record<string, unknown>),
        ...paramsObj, // Preserve all JSON-RPC params
        method: typedPayload.method, // Also store the JSON-RPC method
      };
    }

    if (
      isJsonRpc &&
      !(candidate as Record<string, unknown>).mode &&
      typeof typedPayload.method === 'string'
    ) {
      const mapped = this.mapMethodToMode(typedPayload.method);
      if (mapped) {
        (candidate as Record<string, unknown>).mode = mapped;
      }
    }

    const dto = plainToInstance(TaskRequestDto, candidate);
    const errors = await validate(dto, {
      whitelist: true,
      forbidUnknownValues: false,
      forbidNonWhitelisted: false,
    });

    if (errors.length) {
      throw new BadRequestException(this.formatValidationErrors(errors));
    }

    // Ensure mode is always set (default to converse if not specified)
    if (!dto.mode) {
      dto.mode = AgentTaskMode.CONVERSE;
    }

    let jsonrpc: NormalizedTaskRequest['jsonrpc'] | undefined;

    if (isJsonRpc) {
      const jsonrpcContext: NonNullable<NormalizedTaskRequest['jsonrpc']> = {
        id:
          typeof typedPayload.id === 'string' ||
          typeof typedPayload.id === 'number'
            ? typedPayload.id
            : null,
        method:
          typeof typedPayload.method === 'string' ? typedPayload.method : null,
      };

      dto.metadata = {
        ...(dto.metadata ?? {}),
        jsonrpc: jsonrpcContext,
      };

      jsonrpc = jsonrpcContext;
    }

    return { dto: dto as NormalizedTaskRequestDto, jsonrpc };
  }

  private mapMethodToMode(method: string): AgentTaskMode | undefined {
    const normalized = method.trim().toLowerCase();
    switch (normalized) {
      case 'converse':
      case 'agent.converse':
      case 'tasks.converse':
        return AgentTaskMode.CONVERSE;
      case 'plan':
      case 'agent.plan':
      case 'tasks.plan':
        return AgentTaskMode.PLAN;
      case 'build':
      case 'agent.build':
      case 'tasks.build':
        return AgentTaskMode.BUILD;
      case 'hitl':
      case 'hitl.resume':
      case 'hitl.status':
      case 'hitl.history':
      case 'agent.hitl':
      case 'tasks.hitl':
        return AgentTaskMode.HITL;
      default:
        return undefined;
    }
  }

  private formatValidationErrors(
    errors: Array<{
      constraints?: Record<string, string>;
      children?: Array<{
        constraints?: Record<string, string>;
        children?: unknown[];
      }>;
    }>,
  ): string {
    const messages = errors
      .map((error) => {
        if (error.constraints) {
          return Object.values(error.constraints).join(', ');
        }
        if (error.children && error.children.length) {
          return this.formatValidationErrors(
            error.children as unknown as Array<{
              constraints?: Record<string, string>;
              children?: Array<{
                constraints?: Record<string, string>;
                children?: unknown[];
              }>;
            }>,
          );
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length
      ? messages.join('; ')
      : 'Invalid task request payload.';
  }

  private buildJsonRpcError(
    id: string | number | null,
    error: unknown,
  ): JsonRpcErrorEnvelope {
    const { code, message, data } = this.mapExceptionToError(error);

    // Return JSON-RPC 2.0 error response
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data,
      },
    } as A2ATaskErrorResponse;
  }

  private mapExceptionToError(error: unknown): {
    code: number;
    message: string;
    data?: unknown;
  } {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      const response = error.getResponse();
      const payload =
        typeof response === 'string'
          ? { message: response, statusCode: status }
          : response;

      return {
        code: this.statusToJsonRpcCode(status),
        message: this.extractMessage(payload) ?? error.message,
        data: payload,
      };
    }

    const fallbackMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return {
      code: -32603,
      message: fallbackMessage || 'Internal server error',
    };
  }

  private statusToJsonRpcCode(status: number): number {
    switch (status) {
      case 400:
      case 422:
        return -32602; // Invalid params
      case 401:
        return -32001; // Unauthorized
      case 403:
        return -32003; // Forbidden
      case 404:
        return -32004; // Not found
      case 409:
        return -32009; // Conflict
      case 429:
        return -32042; // Rate limited
      case 500:
        return -32603; // Internal error
      default:
        if (status >= 500) {
          return -32603;
        }
        return -32000; // Server error (generic)
    }
  }

  private extractMessage(payload: unknown): string | null {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string') {
      return payload;
    }
    const typedPayload = payload as {
      message?: unknown;
    };
    if (typeof typedPayload.message === 'string') {
      return typedPayload.message;
    }
    if (Array.isArray(typedPayload.message) && typedPayload.message.length) {
      return typedPayload.message.join(', ');
    }
    return null;
  }

  private logRequest(params: {
    org: string | null;
    agentSlug: string;
    dto: TaskRequestDto;
    jsonrpc: NormalizedTaskRequest['jsonrpc'] | null | undefined;
    status: 'success' | 'error';
    error: unknown;
  }) {
    const { org, agentSlug, dto, jsonrpc, status, error } = params;
    const base = {
      organization: org ?? 'global',
      agent: agentSlug,
      mode: dto.mode,
      conversationId: dto.context?.conversationId ?? null,
      planId: dto.context?.planId ?? null,
      jsonrpc: jsonrpc
        ? {
            id: jsonrpc.id ?? null,
            method: jsonrpc.method ?? null,
          }
        : null,
    };

    if (status === 'success') {
      this.logger.log({
        ...base,
        status,
      });
      return;
    }

    const mapped = this.mapExceptionToError(error);

    this.logger.warn({
      ...base,
      status,
      error: {
        code: mapped.code,
        message: mapped.message,
      },
    });
  }

  private resolveBooleanQuery(
    ...candidates: Array<string | undefined>
  ): boolean | undefined {
    for (const value of candidates) {
      if (value === undefined) {
        continue;
      }
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  }

  /**
   * Fetch database agents filtered by organization slugs
   */
  private async fetchDatabaseAgents(
    organizations?: string[],
  ): Promise<AgentRecord[]> {
    if (organizations && organizations.length > 0) {
      const normalized = organizations
        .map((org) => (org && org.trim().length ? org.trim() : null))
        .map((org) => (org === 'global' ? null : org));
      return this.agentRegistry.listAgentsForOrganizations(normalized);
    }

    return this.agentRegistry.listAllAgents();
  }

  /**
   * Build hierarchy structure from database agent records
   */
  private buildDatabaseHierarchy(records: AgentRecord[]): unknown[] {
    if (!records.length) {
      return [];
    }

    // Group agents by organization (now an array)
    const grouped = new Map<string, AgentRecord[]>();
    for (const record of records) {
      const keys =
        record.organization_slug.length > 0
          ? record.organization_slug
          : ['global'];
      for (const key of keys) {
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(record);
      }
    }

    const createNode = (
      record: AgentRecord,
      children: unknown[] = [],
    ): unknown => {
      const metadataObj = (record.metadata as Record<string, unknown>) || {};
      const isTool = metadataObj.agent_category === 'tool';
      const isOrchestrator =
        record.capabilities.includes('orchestrate') || metadataObj.orchestrator;
      const category = isTool
        ? 'tool'
        : isOrchestrator
          ? 'orchestrator'
          : record.agent_type;
      const executionModes = this.extractExecutionModes(record);
      const orgSlug = record.organization_slug.join(',') || 'global';

      return {
        id: record.slug,
        name: record.slug,
        displayName: record.name,
        type: isTool ? 'tool' : record.agent_type,
        path: `db://${orgSlug}/${record.slug}`,
        relativePath: record.slug,
        organization: orgSlug,
        organizationPath: `db://${orgSlug}/${record.slug}`,
        execution_modes: executionModes.length > 0 ? executionModes : undefined,
        metadata: {
          description: record.description,
          version: record.version,
          category,
          agentType: record.agent_type,
          source: 'database',
          organization: orgSlug,
          isTool: isTool || undefined,
          isOrchestrator: isOrchestrator || undefined,
          // Expose execution fields from metadata for frontend
          execution_profile: metadataObj.execution_profile ?? undefined,
          execution_capabilities:
            metadataObj.execution_capabilities ?? undefined,
          execution_modes:
            executionModes.length > 0 ? executionModes : undefined,
        },
        children,
      };
    };

    const roots: unknown[] = [];

    grouped.forEach((agents, _orgKey) => {
      // Group agents by logical hierarchy based on naming patterns
      const orchestrators = agents.filter(
        (a) =>
          a.capabilities?.includes('orchestrate') ||
          ((a.metadata as Record<string, unknown>)?.orchestrator as boolean),
      );
      const nonOrchestrators = agents.filter(
        (a) =>
          !a.capabilities?.includes('orchestrate') &&
          !((a.metadata as Record<string, unknown>)?.orchestrator as boolean),
      );

      // Create orchestrator nodes with their related children
      orchestrators.forEach((orc) => {
        // Find children that belong to this orchestrator based on naming pattern
        const orcPrefix = orc.slug
          .replace('-orchestrator', '')
          .replace('_orchestrator', '');
        const children = nonOrchestrators
          .filter((agent) => {
            // Match agents with same prefix (e.g., "hiverarchy-*" for "hiverarchy-orchestrator")
            return (
              agent.slug.startsWith(orcPrefix + '-') ||
              agent.slug.startsWith(orcPrefix + '_')
            );
          })
          .map((child) => createNode(child));

        roots.push(createNode(orc, children));
      });

      // Add standalone agents (not belonging to any orchestrator)
      const standaloneAgents = nonOrchestrators.filter((agent) => {
        // Check if this agent belongs to any orchestrator
        return !orchestrators.some((orc) => {
          const orcPrefix = orc.slug
            .replace('-orchestrator', '')
            .replace('_orchestrator', '');
          return (
            agent.slug.startsWith(orcPrefix + '-') ||
            agent.slug.startsWith(orcPrefix + '_')
          );
        });
      });

      standaloneAgents.forEach((agent) => {
        roots.push(createNode(agent, []));
      });
    });

    return roots;
  }

  private extractExecutionModes(record: AgentRecord): string[] {
    const modes = new Set<string>();

    const metadataObj = record.metadata as {
      execution_modes?: unknown;
      executionModes?: unknown;
    } | null;
    const configExecutionModes =
      metadataObj?.execution_modes ?? metadataObj?.executionModes;

    if (Array.isArray(configExecutionModes)) {
      for (const mode of configExecutionModes) {
        if (typeof mode === 'string' && mode.trim().length > 0) {
          modes.add(mode);
        }
      }
    }

    if (modes.size === 0) {
      modes.add('immediate');
    }

    return Array.from(modes);
  }

  /**
   * Format completion results from async agents into markdown
   */
  private formatCompletionResults(agentSlug: string, results: unknown): string {
    // Handle marketing swarm specific format
    if (agentSlug.includes('marketing')) {
      const resultsObj = results as Record<string, unknown>;
      const sections: string[] = ['# Marketing Content Package\n'];

      if (resultsObj.webPost) {
        sections.push('## Web Post\n');
        sections.push(
          typeof resultsObj.webPost === 'string'
            ? resultsObj.webPost
            : JSON.stringify(resultsObj.webPost, null, 2),
        );
        sections.push('\n');
      }

      if (resultsObj.seoContent) {
        sections.push('## SEO Content\n');
        sections.push(
          typeof resultsObj.seoContent === 'string'
            ? resultsObj.seoContent
            : JSON.stringify(resultsObj.seoContent, null, 2),
        );
        sections.push('\n');
      }

      if (resultsObj.socialMedia) {
        sections.push('## Social Media\n');
        sections.push(
          typeof resultsObj.socialMedia === 'string'
            ? resultsObj.socialMedia
            : JSON.stringify(resultsObj.socialMedia, null, 2),
        );
        sections.push('\n');
      }

      return sections.join('\n');
    }

    // Default format - JSON
    return '```json\n' + JSON.stringify(results, null, 2) + '\n```';
  }
}
