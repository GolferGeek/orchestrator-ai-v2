import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksService } from '../agent2agent/tasks/tasks.service';
import { StreamingService } from '../agent2agent/services/streaming.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ObservabilityWebhookService } from '../observability/observability-webhook.service';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from '../observability/observability-events.service';
import {
  ExecutionContext,
  isExecutionContext,
} from '@orchestrator-ai/transport-types';

/**
 * Workflow Status Update
 * This can come from LangGraph, coded function agents, or any external workflow system.
 * ExecutionContext is REQUIRED - it's the capsule that flows through the entire system.
 */
interface WorkflowStatusUpdate {
  // Required fields
  taskId: string; // Keep for URL routing/logging
  status: string;
  timestamp: string;

  // ExecutionContext capsule - REQUIRED
  // All context (userId, conversationId, agentSlug, orgSlug) comes from here
  context: ExecutionContext;

  // User message that triggered the task
  userMessage?: string;

  // Mode (plan, build, converse)
  mode?: string;

  // Optional workflow identification (for n8n/external systems)
  executionId?: string;
  workflowId?: string;
  workflowName?: string;

  // Optional progress fields
  step?: string;
  percent?: number;
  message?: string;
  node?: string;
  stage?: string;
  results?: Record<string, unknown>;

  // Optional sequence tracking
  sequence?: number;
  totalSteps?: number;

  // Nested data object that may contain sequence/totalSteps
  data?: {
    sequence?: number;
    totalSteps?: number;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  // Store status history per task
  private taskStatusHistory: Map<string, Record<string, unknown>[]> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    private readonly streamingService: StreamingService,
    private readonly supabaseService: SupabaseService,
    private readonly observabilityService: ObservabilityWebhookService,
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  /**
   * Receive status updates from workflow systems (LangGraph, coded agents, etc.)
   * POST /webhooks/status
   *
   * ExecutionContext is REQUIRED - webhooks without valid context are rejected.
   */
  @Post('status')
  @HttpCode(204)
  async handleStatusUpdate(
    @Body() update: WorkflowStatusUpdate,
  ): Promise<void> {
    // Validate required fields
    if (!update.taskId) {
      this.logger.warn('Webhook rejected: missing taskId');
      return;
    }

    // ExecutionContext is REQUIRED - no fallbacks
    if (!update.context || !isExecutionContext(update.context)) {
      this.logger.warn(
        `Webhook rejected: missing or invalid ExecutionContext for task ${update.taskId}`,
      );
      return;
    }

    // Extract context fields - context is the single source of truth
    const { userId, conversationId, agentSlug, orgSlug } = update.context;

    try {
      // Build status history for this task
      if (!this.taskStatusHistory.has(update.taskId)) {
        this.taskStatusHistory.set(update.taskId, []);
      }

      const history = this.taskStatusHistory.get(update.taskId)!;

      // Add this status update to history
      const sequence =
        update.sequence || update.data?.sequence || history.length + 1;
      const totalStepsFromUpdate = update.totalSteps || update.data?.totalSteps;

      const statusEntry = {
        timestamp: update.timestamp || new Date().toISOString(),
        status: update.status,
        step: update.step,
        message: update.message,
        sequence: sequence,
        totalSteps: totalStepsFromUpdate,
        data: update,
      };

      history.push(statusEntry);

      // Map workflow status update to our WorkflowStepProgressEvent format
      const stepName =
        update.step || update.stage || update.node || update.status;
      const stepIndex = this.calculateStepIndex(update.status, update.step);
      const totalStepsEstimated = this.estimateTotalSteps(update.status);
      const progress = update.percent ?? this.calculateProgress(update.status);

      // Emit workflow step progress event
      this.eventEmitter.emit('workflow.step.progress', {
        taskId: update.taskId,
        step: stepName,
        stepIndex,
        totalSteps: totalStepsEstimated,
        status: update.status,
        message: update.message,
        progress,
      });

      // Create task message for progress update (shows in message bubble)
      if (update.message) {
        try {
          await this.tasksService.emitTaskMessage(
            update.taskId,
            userId,
            update.message,
            'progress',
            progress,
            {
              step: stepName,
              sequence,
              totalSteps: totalStepsFromUpdate,
              status: update.status,
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to create task message for ${update.taskId}:`,
            error,
          );
        }
      }

      // Emit SSE chunk event via StreamingService for real-time streaming to frontend (USER STREAM)
      this.streamingService.emitProgress(
        update.context,
        update.message || stepName,
        update.userMessage || '',
        {
          step: stepName,
          sequence,
          totalSteps: totalStepsFromUpdate,
          status: update.status,
          progress,
          mode: update.mode,
        },
      );

      // Webhooks only emit progress - never completion
      // The stream will be cleaned up when the API call completes and returns to frontend

      // Send the COMPLETE status history via event
      const eventData = {
        executionId: update.executionId,
        workflowId: update.workflowId,
        workflowName: update.workflowName,
        status: update.status,
        step: stepName,
        progress,
        timestamp: update.timestamp,
        conversationId,
        statusHistory: history,
        data: update,
      };

      this.eventEmitter.emit('workflow.status.update', {
        taskId: update.taskId,
        event: 'workflow_status_update',
        data: eventData,
      });

      // Emit event for other services that might care
      this.eventEmitter.emit('workflow.status_update', {
        taskId: update.taskId,
        conversationId,
        executionId: update.executionId,
        status: update.status,
        progress,
        data: update,
      });

      // Emit observability event for admin monitoring and store in database (ADMIN STREAM)
      await this.storeAndBroadcastObservabilityEvent(update, {
        stepName,
        progress,
        sequence,
        totalStepsFromUpdate,
      });
    } catch (error) {
      this.logger.error('Error processing workflow status update', error);
    }
  }

  /**
   * Store observability event in database and broadcast to admin clients
   * Context is guaranteed to be valid (validated in handleStatusUpdate)
   */
  private async storeAndBroadcastObservabilityEvent(
    update: WorkflowStatusUpdate,
    computed: {
      stepName: string;
      progress: number;
      sequence: number;
      totalStepsFromUpdate?: number;
    },
  ): Promise<void> {
    try {
      const now = Date.now();

      // Context is the single source of truth - no fallbacks
      const { userId, conversationId, agentSlug, orgSlug } = update.context;

      // Resolve username from userId
      let username: string | null = null;
      try {
        const userProfile = await this.observabilityService[
          'authService'
        ].getUserProfile(userId);
        username = userProfile?.displayName || userProfile?.email || userId;
      } catch {
        username = userId; // Fallback to userId if resolution fails
      }

      const eventData: ObservabilityEventRecord = {
        // ExecutionContext capsule - REQUIRED for SSE streaming
        context: update.context,
        // Flat fields for database storage/querying (derived from context)
        source_app: 'orchestrator-ai',
        session_id: conversationId || update.taskId,
        hook_event_type: update.status,
        user_id: userId,
        username,
        conversation_id: conversationId,
        task_id: update.taskId,
        agent_slug: agentSlug,
        organization_slug: orgSlug,
        mode: update.mode || null,
        status: update.status,
        message: update.message || null,
        progress: computed.progress,
        step: computed.stepName,
        sequence: computed.sequence,
        total_steps: computed.totalStepsFromUpdate ?? null,
        payload: update,
        timestamp: now,
      };

      // Store in database
      const { error: dbError } = await this.supabaseService
        .getServiceClient()
        .from('observability_events')
        .insert(eventData);

      if (dbError) {
        this.logger.error(
          `Failed to store observability event: ${dbError.message}`,
          dbError,
        );
      }

      // Emit to admin clients via EventEmitter (ADMIN STREAM)
      this.eventEmitter.emit('observability.event', {
        ...eventData,
        eventType: update.status,
      });
      // Push into in-memory reactive buffer for shared SSE streams
      this.observabilityEvents.push(eventData);
    } catch (error) {
      this.logger.error(
        'Failed to process observability event',
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Calculate step index based on status
   */
  private calculateStepIndex(status: string, step?: string): number {
    // Map common statuses to step indices
    const statusMap: Record<string, number> = {
      started: 0,
      initialization: 0,
      in_progress: 1,
      processing: 2,
      web_post_generated: 1,
      seo_content_generated: 2,
      social_content_generated: 3,
      completed: 4,
    };

    return statusMap[status] ?? statusMap[step || ''] ?? 1;
  }

  /**
   * Estimate total steps based on workflow type
   */
  private estimateTotalSteps(_status: string): number {
    // Marketing swarm typically has 5 steps
    // This could be made configurable per workflow
    return 5;
  }

  /**
   * Calculate progress percentage from status
   */
  private calculateProgress(status: string): number {
    const progressMap: Record<string, number> = {
      started: 1,
      initialization: 1,
      in_progress: 25,
      web_post_generated: 25,
      seo_content_generated: 50,
      social_content_generated: 75,
      completed: 100,
      failed: 0,
      error: 0,
    };

    return progressMap[status] ?? 50;
  }
}
