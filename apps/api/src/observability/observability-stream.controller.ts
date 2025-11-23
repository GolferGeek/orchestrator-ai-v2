import { Controller, Get, Res, UseGuards, Logger, Query } from '@nestjs/common';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { SupabaseService } from '../supabase/supabase.service';

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
    this.logger.log(
      '🔌 Admin connected to observability stream - method entry',
    );
    this.logger.debug(
      `Filters: userId=${userId}, agentSlug=${agentSlug}, conversationId=${conversationId}`,
    );

    // Set SSE headers IMMEDIATELY to establish connection
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Cache-Control, Content-Type, Authorization',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection confirmation
    response.write(
      `data: ${JSON.stringify({ event_type: 'connected', message: 'Observability stream connected' })}\n\n`,
    );
    this.logger.log('📡 SSE headers sent, connection established');

    // Send recent events on connection (last 100 events) - don't block if table doesn't exist
    try {
      const { data: recentEvents, error } = await this.supabaseService
        .getServiceClient()
        .from('observability_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        this.logger.warn(
          'Failed to fetch recent events (table may not exist):',
          error.message,
        );
        response.write(
          `data: ${JSON.stringify({ event_type: 'info', message: 'No historical events available' })}\n\n`,
        );
      } else if (recentEvents && recentEvents.length > 0) {
        // Send recent events in chronological order (oldest first)
        for (const event of recentEvents.reverse()) {
          response.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        this.logger.log(
          `📦 Sent ${recentEvents.length} recent events to admin`,
        );
      } else {
        response.write(
          `data: ${JSON.stringify({ event_type: 'info', message: 'No historical events' })}\n\n`,
        );
      }
    } catch (error) {
      this.logger.error('Error sending recent events:', error);
      response.write(
        `data: ${JSON.stringify({ event_type: 'error', message: 'Failed to load historical events' })}\n\n`,
      );
    }

    // Create event listener for new events
    const eventListener = (eventData: Record<string, unknown>) => {
      // Optional server-side filtering (client-side preferred)
      if (userId && eventData.user_id !== userId) {
        return;
      }
      if (agentSlug && eventData.agent_slug !== agentSlug) {
        return;
      }
      if (conversationId && eventData.conversation_id !== conversationId) {
        return;
      }

      // Send event to admin client
      try {
        response.write(`data: ${JSON.stringify(eventData)}\n\n`);
      } catch (error) {
        this.logger.error('Failed to write event to stream:', error);
      }
    };

    // Subscribe to all observability-relevant events
    const eventTypes = [
      'observability.event',
      // Task lifecycle events
      'task.created',
      'task.started',
      'task.progress',
      'task.completed',
      'task.failed',
      'task.cancelled',
      'task.status_changed',
      'task.message',
      'task.resumed',
      // Agent streaming events
      'agent.stream.start',
      'agent.stream.chunk',
      'agent.stream.complete',
      'agent.stream.error',
      // Human-in-the-loop events
      'human_input.required',
      'human_input.response',
      'human_input.timeout',
      // Workflow events
      'workflow.step.progress',
      'workflow.status.update',
      'workflow.status_update',
      // Context optimization
      'context_optimization.metrics',
    ];

    // Create wrapper that adds event type to payload
    const wrappedListener =
      (eventType: string) => (eventData: Record<string, unknown>) => {
        this.logger.debug(`📥 Received event: ${eventType}`);
        eventListener({ ...eventData, event_type: eventType });
      };

    // Subscribe to all event types
    const listeners: Array<{
      type: string;
      handler: (data: Record<string, unknown>) => void;
    }> = [];
    for (const eventType of eventTypes) {
      const handler = wrappedListener(eventType);
      this.eventEmitter.on(eventType, handler);
      listeners.push({ type: eventType, handler });
    }

    this.logger.log(`📡 Subscribed to ${eventTypes.length} event types`);

    // Send heartbeat every 30 seconds to keep connection alive
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
      response.end();
    });
  }
}
