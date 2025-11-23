import { Controller, Sse, UseGuards, Logger, Query, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, merge, interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
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
  @Sse('stream')
  @RequirePermission('admin:audit')
  streamEvents(
    @Query('userId') userId?: string,
    @Query('agentSlug') agentSlug?: string,
    @Query('conversationId') conversationId?: string,
  ): Observable<MessageEvent> {
    this.logger.log('🔌 Admin connected to observability stream');
    this.logger.debug(
      `Filters: userId=${userId}, agentSlug=${agentSlug}, conversationId=${conversationId}`,
    );

    // Event types to listen for
    const eventTypes = [
      'observability.event',
      'task.created',
      'task.started',
      'task.progress',
      'task.completed',
      'task.failed',
      'task.cancelled',
      'task.status_changed',
      'task.message',
      'task.resumed',
      'agent.stream.start',
      'agent.stream.chunk',
      'agent.stream.complete',
      'agent.stream.error',
      'human_input.required',
      'human_input.response',
      'human_input.timeout',
      'workflow.step.progress',
      'workflow.status.update',
      'workflow.status_update',
      'context_optimization.metrics',
    ];

    // Create observables for each event type
    const eventObservables = eventTypes.map((eventType) =>
      fromEvent(this.eventEmitter, eventType).pipe(
        map((eventData: any) => {
          this.logger.debug(`📥 Received event: ${eventType}`);
          
          // Apply server-side filtering if specified
          if (userId && eventData.user_id !== userId) return null;
          if (agentSlug && eventData.agent_slug !== agentSlug) return null;
          if (conversationId && eventData.conversation_id !== conversationId) return null;

          return {
            data: { ...eventData, event_type: eventType },
          } as MessageEvent;
        }),
      ),
    );

    // Heartbeat every 30 seconds
    const heartbeat$ = interval(30000).pipe(
      map(() => ({ data: { event_type: 'heartbeat' } } as MessageEvent)),
    );

    // Load and send recent events on connection
    const initialEvents$ = new Observable<MessageEvent>((subscriber) => {
      (async () => {
        try {
          const { data: recentEvents, error } = await this.supabaseService
            .getServiceClient()
            .from('observability_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

          if (error) {
            this.logger.warn('Failed to fetch recent events:', error.message);
            subscriber.next({
              data: { event_type: 'info', message: 'No historical events available' },
            } as MessageEvent);
          } else if (recentEvents && recentEvents.length > 0) {
            // Send connection message first
            subscriber.next({
              data: { event_type: 'connected', message: 'Observability stream connected' },
            } as MessageEvent);
            
            // Send recent events in chronological order
            for (const event of recentEvents.reverse()) {
              subscriber.next({ data: event } as MessageEvent);
            }
            this.logger.log(`📦 Sent ${recentEvents.length} recent events to admin`);
          } else {
            subscriber.next({
              data: { event_type: 'connected', message: 'Observability stream connected' },
            } as MessageEvent);
          }
          subscriber.complete();
        } catch (error: any) {
          this.logger.error('Error loading recent events:', error);
          subscriber.next({
            data: { event_type: 'error', message: 'Failed to load historical events' },
          } as MessageEvent);
          subscriber.complete();
        }
      })();
    });

    this.logger.log(`📡 Subscribed to ${eventTypes.length} event types`);

    // Merge all observables: initial events, then live events + heartbeat
    return merge(initialEvents$, ...eventObservables, heartbeat$).pipe(
      // Filter out null values from filtering
      map((event) => event as MessageEvent),
    );
  }
}
