import { Controller, Get, Res, UseGuards, Logger, Query } from '@nestjs/common';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from './observability-events.service';
import { Subscription } from 'rxjs';

/**
 * Observability Stream Controller
 *
 * Provides admin-only SSE endpoint for real-time monitoring of all agent executions.
 * Broadcasts all observability events to connected admin clients.
 *
 * Endpoint: GET /observability/stream
 * Auth: Requires admin:audit permission
 * Response: Server-Sent Events stream
 */
@Controller('observability')
@UseGuards(JwtAuthGuard)
export class ObservabilityStreamController {
  private readonly logger = new Logger(ObservabilityStreamController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly supabaseService: SupabaseService,
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  /**
   * Stream all observability events to admin clients
   * GET /observability/stream
   *
   * Optional query params for filtering (client-side filtering is preferred):
   * - userId: Filter by user ID
   * - agentSlug: Filter by agent
   * - conversationId: Filter by conversation
   */
  @Get('stream')
  @RequirePermission('admin:audit')
  async streamEvents(
    @Res() response: Response,
    @Query('userId') userId?: string,
    @Query('agentSlug') agentSlug?: string,
    @Query('conversationId') conversationId?: string,
  ): Promise<void> {
    this.logger.log('🔌 Admin connected to observability stream');
    this.logger.log(
      `📋 Filters: userId=${userId || 'none'}, agentSlug=${agentSlug || 'none'}, conversationId=${conversationId || 'none'}`,
    );

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection confirmation
    const connectionEvent = { event_type: 'connected', message: 'Observability stream connected' };
    response.write(`data: ${JSON.stringify(connectionEvent)}\n\n`);
    this.logger.log('📡 SSE connection established, sent connection event');

    // Send recent events on connection
    try {
      const { data: recentEvents, error } = await this.supabaseService
        .getServiceClient()
        .from('observability_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        this.logger.warn('Failed to fetch recent events:', error.message);
      } else if (recentEvents && recentEvents.length > 0) {
        for (const event of recentEvents.reverse()) {
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        this.logger.log(`📦 Sent ${recentEvents.length} recent events`);
      }
    } catch (error) {
      this.logger.error('Error loading recent events:', error);
    }

    // Event types to listen for
    // Focus on high-value events: LLM calls, PII detection, agent-specific events
    const eventTypes = [
      // LLM Events (critical for cost/performance/PII monitoring)
      'agent.llm.started',
      'agent.llm.completed',
      'agent.llm.failed',

      // PII Events (critical for compliance)
      'agent.pii.detected',
      'agent.pii.sanitized',
      'agent.pii.check.started',
      'agent.pii.check.completed',

      // Agent-specific events (let agents decide what to emit)
      'agent.rag.search',
      'agent.rag.documents_found',
      'agent.api.call_started',
      'agent.api.call_completed',
      'agent.context.loaded',

      // Streaming (useful for real-time feedback)
      'agent.stream.chunk',
      'agent.stream.complete',
      'agent.stream.error',

      // Human-in-the-loop (critical for HITL workflows)
      'human_input.required',
      'human_input.response',
      'human_input.timeout',

      // Workflow events (from n8n integrations)
      'workflow.step.progress',
      'workflow.status.update',
    ];

    // Create event listener
    const eventListener = (eventData: Record<string, unknown>) => {
      // Apply server-side filtering if specified
      if (userId && eventData.user_id !== userId) return;
      if (agentSlug && eventData.agent_slug !== agentSlug) return;
      if (conversationId && eventData.conversation_id !== conversationId)
        return;

      // Send event to client
      try {
        response.write(`data: ${JSON.stringify(eventData)}\n\n`);
      } catch (error) {
        this.logger.error('Failed to write event to stream:', error);
      }
    };

    // Create wrapper that adds event type to payload
    const wrappedListener =
      (eventType: string) => (eventData: Record<string, unknown>) => {
        this.logger.debug(`📥 Received event: ${eventType}`);
        eventListener({ ...eventData, event_type: eventType });
      };

    // Subscribe to legacy event types (non-observability, for compatibility)
    const listeners: Array<{
      type: string;
      handler: (data: Record<string, unknown>) => void;
    }> = [];

    for (const eventType of eventTypes) {
      const handler = wrappedListener(eventType);
      this.eventEmitter.on(eventType, handler);
      listeners.push({ type: eventType, handler });
    }

    // Subscribe to canonical observability stream (RxJS-based)
    this.logger.log(
      `📡 [SSE] Subscribing to observability events stream with filters: userId=${userId || 'none'}, agentSlug=${agentSlug || 'none'}, conversationId=${conversationId || 'none'}`,
    );
    this.logger.log(
      `📡 [SSE] Current buffer size: ${this.observabilityEvents.getSnapshot().length} events`,
    );
    const observabilitySubscription: Subscription =
      this.observabilityEvents.events$.subscribe({
        next: (event) => {
          this.logger.log(
            `📨 [SSE] Received event from buffer: ${event.hook_event_type} for task ${event.task_id || 'unknown'}`,
          );
          this.logger.debug(
            `📨 [SSE] Event fields: user_id=${event.user_id}, agent_slug=${event.agent_slug}, conversation_id=${event.conversation_id}`,
          );

          // Apply filters - check both snake_case and camelCase variants
          if (
            userId &&
            event.user_id !== userId &&
            (event as any).userId !== userId
          ) {
            this.logger.debug(
              `📨 [SSE] Event filtered out - userId mismatch (event.user_id=${event.user_id}, event.userId=${(event as any).userId} !== ${userId})`,
            );
            return;
          }
          if (
            agentSlug &&
            event.agent_slug !== agentSlug &&
            (event as any).agentSlug !== agentSlug
          ) {
            this.logger.debug(
              `📨 [SSE] Event filtered out - agentSlug mismatch (${event.agent_slug} !== ${agentSlug})`,
            );
            return;
          }
          if (
            conversationId &&
            event.conversation_id !== conversationId &&
            (event as any).conversationId !== conversationId
          ) {
            this.logger.debug(
              `📨 [SSE] Event filtered out - conversationId mismatch (${event.conversation_id} !== ${conversationId})`,
            );
            return;
          }

          this.logger.log(`✅ [SSE] Event passed filters, writing to stream`);
          this.writeEvent(response, event);
        },
        error: (error) => {
          this.logger.error(
            `❌ [SSE] Observability stream subscription error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        },
      });

    this.logger.log(
      `📡 Subscribed to ${eventTypes.length} legacy event types and observability stream`,
    );

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      try {
        response.write(': heartbeat\n\n');
      } catch {
        this.logger.warn('Failed to send heartbeat, client disconnected');
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Handle client disconnect
    response.on('close', () => {
      this.logger.log('🔌 Admin disconnected from observability stream');
      clearInterval(heartbeatInterval);
      // Unsubscribe from all event types
      for (const { type, handler } of listeners) {
        this.eventEmitter.off(type, handler);
      }
      observabilitySubscription.unsubscribe();
    });
  }

  private writeEvent(
    response: Response,
    event: ObservabilityEventRecord,
  ): void {
    try {
      this.logger.log(
        `✍️ [SSE] Writing event to client: ${event.hook_event_type}`,
      );
      const eventJson = JSON.stringify(event);
      this.logger.debug(
        `✍️ [SSE] Event JSON length: ${eventJson.length} bytes`,
      );
      response.write(`data: ${eventJson}\n\n`);
      this.logger.log(`✅ [SSE] Event written successfully`);
    } catch (error) {
      this.logger.error(`❌ [SSE] Failed to write event to stream:`, error);
    }
  }
}
