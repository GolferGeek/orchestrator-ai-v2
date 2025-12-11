import { Controller, Get, Res, UseGuards, Logger, Query } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from './observability-events.service';
import { Subscription } from 'rxjs';
// NIL_UUID removed - unused

/**
 * Observability Stream Controller
 *
 * Provides admin-only SSE endpoint for real-time monitoring of all agent executions.
 * Broadcasts all observability events to connected admin clients.
 *
 * Events flow through ObservabilityEventsService (RxJS ReplaySubject buffer).
 * All event producers must push to that service for events to appear here.
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
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  /**
   * Stream all observability events to admin clients
   * GET /observability/stream
   *
   * Optional query params for filtering:
   * - filterUserId: Filter by user ID
   * - filterAgentSlug: Filter by agent
   * - filterConversationId: Filter by conversation
   */
  @Get('stream')
  @RequirePermission('admin:audit')
  streamEvents(
    @Res() response: Response,
    @Query('userId') filterUserId?: string,
    @Query('agentSlug') filterAgentSlug?: string,
    @Query('conversationId') filterConversationId?: string,
  ): void {
    this.logger.log('🔌 Admin connected to observability stream');
    this.logger.log(
      `📋 Filters: userId=${filterUserId || 'none'}, agentSlug=${filterAgentSlug || 'none'}, conversationId=${filterConversationId || 'none'}`,
    );

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection confirmation
    const connectionEvent = {
      event_type: 'connected',
      message: 'Observability stream connected',
    };
    response.write(`data: ${JSON.stringify(connectionEvent)}\n\n`);
    this.logger.log('📡 SSE connection established, sent connection event');

    // Send buffered events from ReplaySubject (recent in-memory events)
    const bufferedEvents = this.observabilityEvents.getSnapshot();
    if (bufferedEvents.length > 0) {
      for (const event of bufferedEvents) {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      this.logger.log(
        `📦 Sent ${bufferedEvents.length} buffered events from memory`,
      );
    }

    // Subscribe to live observability stream (RxJS-based)
    this.logger.log(
      `📡 Subscribing to ObservabilityEventsService. Current buffer size: ${this.observabilityEvents.getSnapshot().length}`,
    );

    const subscription: Subscription =
      this.observabilityEvents.events$.subscribe({
        next: (event) => {
          this.logger.log(
            `📨 Received event: ${event.hook_event_type} for task ${event.context.taskId || 'unknown'}`,
          );

          // Apply query param filters
          if (filterUserId && event.context.userId !== filterUserId) {
            this.logger.debug(`📨 Filtered out - userId mismatch`);
            return;
          }
          if (filterAgentSlug && event.context.agentSlug !== filterAgentSlug) {
            this.logger.debug(`📨 Filtered out - agentSlug mismatch`);
            return;
          }
          if (
            filterConversationId &&
            event.context.conversationId !== filterConversationId
          ) {
            this.logger.debug(`📨 Filtered out - conversationId mismatch`);
            return;
          }

          this.logger.log(`✅ Event passed filters, writing to stream`);
          this.writeEvent(response, event);
        },
        error: (error) => {
          this.logger.error(
            `❌ Subscription error: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      });

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
      subscription.unsubscribe();
    });
  }

  private writeEvent(
    response: Response,
    event: ObservabilityEventRecord,
  ): void {
    try {
      const eventJson = JSON.stringify(event);
      this.logger.log(
        `✍️ Writing event: ${event.hook_event_type} (${eventJson.length} bytes)`,
      );
      response.write(`data: ${eventJson}\n\n`);
      this.logger.log(`✅ Event written successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to write event to stream:`, error);
    }
  }

  /**
   * Get historical events from database
   * GET /observability/history?since=<timestamp>&until=<timestamp>&limit=<number>
   *
   * Query params:
   * - since: Unix timestamp (ms) - defaults to 1 hour ago
   * - until: Unix timestamp (ms) - defaults to now (optional end time for custom ranges)
   * - limit: Max events to return (default 1000, max 5000)
   */
  @Get('history')
  @RequirePermission('admin:audit')
  async getHistory(
    @Query('since') sinceParam?: string,
    @Query('until') untilParam?: string,
    @Query('limit') limitParam?: string,
  ): Promise<{ events: ObservabilityEventRecord[]; count: number }> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const since = sinceParam ? parseInt(sinceParam, 10) : oneHourAgo;
    const until = untilParam ? parseInt(untilParam, 10) : undefined;
    const limit = Math.min(
      Math.max(parseInt(limitParam || '1000', 10), 1),
      5000,
    );

    this.logger.log(
      `📚 Fetching historical events since ${new Date(since).toISOString()}${until ? ` until ${new Date(until).toISOString()}` : ''}, limit ${limit}`,
    );

    const events = await this.observabilityEvents.getHistoricalEvents(
      since,
      limit,
      until,
    );

    this.logger.log(`📚 Found ${events.length} historical events`);

    return {
      events,
      count: events.length,
    };
  }
}
