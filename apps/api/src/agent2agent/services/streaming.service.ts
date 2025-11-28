import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskStatusService } from '../tasks/task-status.service';

/**
 * Stream metadata for taskId -> streamId mapping
 */
interface StreamMetadata {
  streamId: string;
  taskId: string;
  agentSlug: string;
  organizationSlug: string;
  mode: string;
  conversationId: string | null;
  userId: string;
  createdAt: Date;
}

/**
 * StreamingService
 *
 * Centralized service for managing SSE streaming:
 * - Registers stream sessions and creates taskId <-> streamId mappings
 * - Emits properly formatted A2A SSE events
 * - Used by both BaseAgentRunner (when creating tasks) and WebhookController (when receiving updates)
 *
 * This ensures all streaming logic follows the A2A protocol consistently.
 */
@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  // In-memory mapping of taskId -> streamMetadata
  // In production, this could be Redis or a database
  private readonly streamRegistry = new Map<string, StreamMetadata>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly taskStatusService: TaskStatusService,
  ) {}

  /**
   * Register a new stream session for a task
   * Called by agent runners when creating a task in SSE mode
   *
   * @returns streamId to be returned to the frontend
   */
  registerStream(
    taskId: string,
    agentSlug: string,
    organizationSlug: string,
    mode: string,
    conversationId: string | null,
    userId: string,
  ): string {
    // Use taskId as streamId for simplicity - frontend already knows the taskId
    const streamId = taskId;

    const metadata: StreamMetadata = {
      streamId,
      taskId,
      agentSlug,
      organizationSlug,
      mode,
      conversationId,
      userId,
      createdAt: new Date(),
    };

    this.streamRegistry.set(taskId, metadata);

    // Register stream session in task-status service
    // This allows SSE connections to find the stream
    this.taskStatusService.registerStreamSession({
      taskId,
      streamId,
      agentSlug,
      organizationSlug: organizationSlug || 'global',
      userId,
      conversationId,
    });

    return streamId;
  }

  /**
   * Look up stream metadata by taskId
   */
  getStreamMetadata(taskId: string): StreamMetadata | undefined {
    return this.streamRegistry.get(taskId);
  }

  /**
   * Emit a progress update (chunk) event
   * Called by webhook controller when receiving status updates
   */
  emitProgress(
    taskId: string,
    content: string,
    metadata?: {
      step?: string;
      progress?: number;
      status?: string;
      sequence?: number;
      totalSteps?: number;
      [key: string]: unknown;
    },
  ): void {
    const streamMeta = this.streamRegistry.get(taskId);

    if (!streamMeta) {
      return;
    }

    const eventPayload = {
      streamId: streamMeta.streamId,
      taskId: streamMeta.taskId,
      conversationId: streamMeta.conversationId,
      organizationSlug: streamMeta.organizationSlug,
      agentSlug: streamMeta.agentSlug,
      mode: streamMeta.mode,
      chunk: {
        type: 'progress',
        content,
        metadata: metadata || {},
      },
    };

    // Emit A2A formatted stream chunk event
    this.eventEmitter.emit('agent.stream.chunk', eventPayload);
  }

  /**
   * Emit a completion event
   * Called when task completes successfully
   */
  emitComplete(taskId: string, completionData?: Record<string, unknown>): void {
    const streamMeta = this.streamRegistry.get(taskId);

    if (!streamMeta) {
      return;
    }

    // Emit A2A formatted complete event
    this.eventEmitter.emit('agent.stream.complete', {
      streamId: streamMeta.streamId,
      taskId: streamMeta.taskId,
      conversationId: streamMeta.conversationId,
      organizationSlug: streamMeta.organizationSlug,
      agentSlug: streamMeta.agentSlug,
      mode: streamMeta.mode,
      data: completionData,
    });

    // Clean up registration after completion
    this.streamRegistry.delete(taskId);
  }

  /**
   * Emit an error event
   * Called when task fails
   */
  emitError(taskId: string, error: string): void {
    const streamMeta = this.streamRegistry.get(taskId);

    if (!streamMeta) {
      return;
    }

    this.logger.error(`❌ Stream error for task ${taskId}: ${error}`);

    // Emit A2A formatted error event
    this.eventEmitter.emit('agent.stream.error', {
      streamId: streamMeta.streamId,
      taskId: streamMeta.taskId,
      conversationId: streamMeta.conversationId,
      organizationSlug: streamMeta.organizationSlug,
      agentSlug: streamMeta.agentSlug,
      mode: streamMeta.mode,
      error,
    });

    // Clean up registration after error
    this.streamRegistry.delete(taskId);
  }

  /**
   * Clean up old stream registrations (called periodically)
   */
  cleanupOldStreams(maxAgeMinutes: number = 60): void {
    const now = new Date();
    let cleaned = 0;

    for (const [taskId, metadata] of this.streamRegistry.entries()) {
      const ageMinutes =
        (now.getTime() - metadata.createdAt.getTime()) / 1000 / 60;

      if (ageMinutes > maxAgeMinutes) {
        this.streamRegistry.delete(taskId);
        cleaned++;
      }
    }
  }

  /**
   * NEW: Register stream using ExecutionContext
   */
  registerStreamWithContext(context: ExecutionContext, mode: string): string {
    if (!context.taskId) {
      throw new Error('Task ID must be present in context to register stream');
    }

    return this.registerStream(
      context.taskId,
      context.agentSlug || 'unknown',
      context.orgSlug,
      mode,
      context.conversationId,
      context.userId,
    );
  }
}
