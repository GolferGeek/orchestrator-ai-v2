import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Status types for LangGraph workflow execution
 */
export type LangGraphStatus =
  | 'started'
  | 'processing'
  | 'hitl_waiting'
  | 'hitl_resumed'
  | 'completed'
  | 'failed'
  | 'tool_calling'
  | 'tool_completed';

/**
 * Observability event payload for LangGraph workflows
 */
export interface LangGraphObservabilityEvent {
  taskId: string;
  threadId: string;
  status: LangGraphStatus;
  agentSlug: string;
  userId: string;
  conversationId?: string;
  organizationSlug?: string;
  message?: string;
  step?: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}

/**
 * ObservabilityService for LangGraph
 *
 * Sends observability events to the Orchestrator AI API's webhook endpoint.
 * This replaces WebhookStatusService and provides a cleaner interface
 * specifically designed for LangGraph workflow events.
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly apiBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiPort = this.configService.get<string>('API_PORT');
    if (!apiPort) {
      throw new Error(
        'API_PORT environment variable is required. ' +
        'Please set API_PORT in your .env file (e.g., API_PORT=6100).',
      );
    }

    const apiHost = this.configService.get<string>('API_HOST') || 'localhost';
    this.apiBaseUrl = `http://${apiHost}:${apiPort}`;
  }

  /**
   * Send an observability event to the Orchestrator AI API
   * Non-blocking - failures are logged but don't throw
   */
  async emit(event: LangGraphObservabilityEvent): Promise<void> {
    try {
      const url = `${this.apiBaseUrl}/webhooks/status`;

      const payload = {
        taskId: event.taskId,
        status: this.mapStatusToEventType(event.status),
        timestamp: new Date().toISOString(),
        conversationId: event.conversationId,
        userId: event.userId,
        agentSlug: event.agentSlug,
        organizationSlug: event.organizationSlug,
        message: event.message,
        step: event.step,
        percent: event.progress,
        data: {
          hook_event_type: this.mapStatusToEventType(event.status),
          source_app: 'langgraph',
          session_id: event.conversationId || event.taskId,
          threadId: event.threadId,
          ...event.metadata,
        },
      };

      this.logger.debug(`Emitting observability event: ${event.status}`, {
        taskId: event.taskId,
        threadId: event.threadId,
        agentSlug: event.agentSlug,
      });

      await firstValueFrom(
        this.httpService.post(url, payload, {
          timeout: 2000, // 2 second timeout - don't block
          validateStatus: () => true, // Accept any status
        }),
      );
    } catch (error) {
      // Log but don't throw - observability failures shouldn't break workflow execution
      this.logger.warn(
        `Failed to send observability event (non-blocking): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Map LangGraph status to observability event type
   */
  private mapStatusToEventType(status: LangGraphStatus): string {
    const statusMap: Record<LangGraphStatus, string> = {
      started: 'langgraph.started',
      processing: 'langgraph.processing',
      hitl_waiting: 'langgraph.hitl_waiting',
      hitl_resumed: 'langgraph.hitl_resumed',
      completed: 'langgraph.completed',
      failed: 'langgraph.failed',
      tool_calling: 'langgraph.tool_calling',
      tool_completed: 'langgraph.tool_completed',
    };
    return statusMap[status] || `langgraph.${status}`;
  }

  /**
   * Convenience: Emit workflow started event
   */
  async emitStarted(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    message?: string;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'started',
      message: params.message || 'Workflow started',
    });
  }

  /**
   * Convenience: Emit processing/progress event
   */
  async emitProgress(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    message: string;
    step?: string;
    progress?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'processing',
    });
  }

  /**
   * Convenience: Emit HITL waiting event
   */
  async emitHitlWaiting(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    message?: string;
    pendingContent?: unknown;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'hitl_waiting',
      message: params.message || 'Awaiting human review',
      metadata: { pendingContent: params.pendingContent },
    });
  }

  /**
   * Convenience: Emit HITL resumed event
   */
  async emitHitlResumed(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    decision: 'approve' | 'edit' | 'reject';
    message?: string;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'hitl_resumed',
      message: params.message || `Human review decision: ${params.decision}`,
      metadata: { decision: params.decision },
    });
  }

  /**
   * Convenience: Emit tool calling event
   */
  async emitToolCalling(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    toolName: string;
    toolInput?: unknown;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'tool_calling',
      message: `Calling tool: ${params.toolName}`,
      step: params.toolName,
      metadata: { toolName: params.toolName, toolInput: params.toolInput },
    });
  }

  /**
   * Convenience: Emit tool completed event
   */
  async emitToolCompleted(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    toolName: string;
    toolResult?: unknown;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'tool_completed',
      message: params.success
        ? `Tool completed: ${params.toolName}`
        : `Tool failed: ${params.toolName}`,
      step: params.toolName,
      metadata: {
        toolName: params.toolName,
        toolResult: params.toolResult,
        success: params.success,
        error: params.error,
      },
    });
  }

  /**
   * Convenience: Emit workflow completed event
   */
  async emitCompleted(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    result?: unknown;
    duration?: number;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'completed',
      message: 'Workflow completed successfully',
      metadata: { result: params.result, duration: params.duration },
    });
  }

  /**
   * Convenience: Emit workflow failed event
   */
  async emitFailed(params: {
    taskId: string;
    threadId: string;
    agentSlug: string;
    userId: string;
    conversationId?: string;
    organizationSlug?: string;
    error: string;
    duration?: number;
  }): Promise<void> {
    await this.emit({
      ...params,
      status: 'failed',
      message: `Workflow failed: ${params.error}`,
      metadata: { error: params.error, duration: params.duration },
    });
  }
}
