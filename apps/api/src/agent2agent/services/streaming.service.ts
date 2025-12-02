import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionContext,
  AgentStreamChunkData,
  AgentStreamCompleteData,
  AgentStreamErrorData,
} from '@orchestrator-ai/transport-types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskStatusService } from '../tasks/task-status.service';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from '../../observability/observability-events.service';

/**
 * StreamingService
 *
 * Centralized service for managing SSE streaming:
 * - Registers stream sessions and creates taskId <-> streamId mappings
 * - Emits properly formatted A2A SSE events with full ExecutionContext
 * - Pushes events to ObservabilityEventsService for admin monitoring
 * - Used by both BaseAgentRunner (when creating tasks) and WebhookController (when receiving updates)
 *
 * This ensures all streaming logic follows the A2A protocol consistently.
 *
 * MIGRATION: All emit methods now require ExecutionContext as the first parameter.
 * The context is passed through to events - no storage changes needed.
 */
@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly taskStatusService: TaskStatusService,
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  /**
   * Register a new stream session for a task
   * Called by agent runners when creating a task in SSE mode
   *
   * @returns streamId to be returned to the frontend
   */
  registerStream(
    context: ExecutionContext,
    mode: string,
    userMessage: string,
  ): string {
    // Use taskId as streamId for simplicity - frontend already knows the taskId
    const streamId = context.taskId;

    // Register stream session in task-status service
    // This allows SSE connections to find the stream
    this.taskStatusService.registerStreamSession({
      taskId: context.taskId,
      streamId,
      agentSlug: context.agentSlug,
      organizationSlug: context.orgSlug || 'global',
      userId: context.userId,
      conversationId: context.conversationId,
    });

    return streamId;
  }

  /**
   * Emit a progress update (chunk) event
   * Called by webhook controller when receiving status updates
   */
  emitProgress(
    context: ExecutionContext,
    content: string,
    userMessage: string,
    metadata?: {
      step?: string;
      progress?: number;
      status?: string;
      sequence?: number;
      totalSteps?: number;
      mode?: string;
      [key: string]: unknown;
    },
  ): void {
    const eventPayload: AgentStreamChunkData = {
      context,
      streamId: context.taskId,
      mode: metadata?.mode || 'build',
      userMessage,
      timestamp: new Date().toISOString(),
      chunk: {
        type: 'progress',
        content,
        metadata: metadata || {},
      },
    };

    // Emit A2A formatted stream chunk event (for user-facing SSE)
    this.eventEmitter.emit('agent.stream.chunk', eventPayload);

    // Push to observability buffer (for admin monitoring)
    this.pushToObservability(context, 'agent.stream.chunk', content, metadata);
  }

  /**
   * Push event to ObservabilityEventsService for admin monitoring
   */
  private pushToObservability(
    context: ExecutionContext,
    eventType: string,
    message: string | null,
    metadata?: Record<string, unknown>,
  ): void {
    const observabilityEvent: ObservabilityEventRecord = {
      context,
      source_app: 'orchestrator-ai',
      hook_event_type: eventType,
      status: eventType,
      message,
      progress: (metadata?.progress as number) ?? null,
      step: (metadata?.step as string) ?? null,
      payload: metadata || {},
      timestamp: Date.now(),
    };

    this.logger.log(
      `📊 Pushing ${eventType} to observability buffer for task ${context.taskId}`,
    );
    this.observabilityEvents.push(observabilityEvent);
  }

  /**
   * Emit an observability-only event (no user-facing SSE)
   * Used by emitObservabilityEvent in BaseAgentRunner for agent lifecycle events
   *
   * @param context - ExecutionContext
   * @param eventType - Event type (e.g., 'agent.started', 'agent.progress', 'agent.completed')
   * @param message - Human-readable message
   * @param metadata - Additional metadata (progress, step, mode, etc.)
   */
  emitObservabilityOnly(
    context: ExecutionContext,
    eventType: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    // Push directly to observability buffer without emitting user-facing SSE
    this.pushToObservability(context, eventType, message, metadata);
  }

  /**
   * Emit a completion event
   * Called when task completes successfully
   */
  emitComplete(
    context: ExecutionContext,
    userMessage: string,
    mode: string,
  ): void {
    const eventPayload: AgentStreamCompleteData = {
      context,
      streamId: context.taskId,
      mode,
      userMessage,
      timestamp: new Date().toISOString(),
      type: 'complete',
    };

    // Emit A2A formatted complete event
    this.eventEmitter.emit('agent.stream.complete', eventPayload);
  }

  /**
   * Emit an error event
   * Called when task fails
   */
  emitError(
    context: ExecutionContext,
    userMessage: string,
    mode: string,
    error: string,
  ): void {
    this.logger.error(`❌ Stream error for task ${context.taskId}: ${error}`);

    const eventPayload: AgentStreamErrorData = {
      context,
      streamId: context.taskId,
      mode,
      userMessage,
      timestamp: new Date().toISOString(),
      type: 'error',
      error,
    };

    // Emit A2A formatted error event
    this.eventEmitter.emit('agent.stream.error', eventPayload);
  }
}
