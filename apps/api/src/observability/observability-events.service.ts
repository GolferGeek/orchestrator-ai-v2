import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * ObservabilityEventRecord
 *
 * Record structure for observability events.
 * All identity fields come from context - no duplication.
 */
export interface ObservabilityEventRecord {
  /** ExecutionContext capsule - contains all identity fields */
  context: ExecutionContext;
  /** Source application identifier */
  source_app: string;
  /** Event type (e.g., 'langgraph.started', 'agent.progress') */
  hook_event_type: string;
  /** Event status */
  status: string;
  /** Human-readable message */
  message: string | null;
  /** Progress percentage (0-100) */
  progress: number | null;
  /** Current step/phase name */
  step: string | null;
  /** Full event payload */
  payload: Record<string, unknown>;
  /** Unix timestamp (milliseconds) */
  timestamp: number;
}

/**
 * ObservabilityEventsService
 *
 * Maintains an in-memory, reactive buffer of the most recent observability
 * events so multiple consumers (admin SSE, task SSE, debugging tools) can
 * subscribe to the same stream without duplicating plumbing.
 */
@Injectable()
export class ObservabilityEventsService {
  private readonly logger = new Logger(ObservabilityEventsService.name);
  private readonly bufferSize: number;
  private readonly subject: ReplaySubject<ObservabilityEventRecord>;
  private readonly buffer: ObservabilityEventRecord[] = [];

  // Cache of userId -> username mappings
  private readonly userCache = new Map<string, string>();
  // Track pending lookups to avoid duplicate requests
  private readonly pendingLookups = new Set<string>();

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.bufferSize = Math.max(
      Number(process.env.OBSERVABILITY_EVENT_BUFFER ?? 500),
      1,
    );
    this.subject = new ReplaySubject<ObservabilityEventRecord>(this.bufferSize);
  }

  /**
   * Get username for userId - from cache or fetch from database (once)
   */
  async resolveUsername(userId: string): Promise<string | undefined> {
    if (!userId) return undefined;

    // Check cache first
    const cached = this.userCache.get(userId);
    if (cached) {
      return cached;
    }

    // Don't duplicate pending lookups
    if (this.pendingLookups.has(userId)) {
      return undefined;
    }

    // Fetch from database (one-time hit per user)
    this.pendingLookups.add(userId);
    try {
      const profile = await this.authService.getUserProfile(userId);
      const username = profile?.displayName || profile?.email;
      if (username) {
        this.userCache.set(userId, username);
        this.logger.log(`📝 Cached username: ${userId} -> ${username}`);
        return username;
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve username for ${userId}: ${err}`);
    } finally {
      this.pendingLookups.delete(userId);
    }

    return undefined;
  }

  /**
   * Cache a userId -> username mapping (called when username comes in from event)
   */
  cacheUsername(userId: string, username: string): void {
    if (userId && username && username !== userId) {
      this.userCache.set(userId, username);
      this.logger.debug(`📝 Cached username from event: ${userId} -> ${username}`);
    }
  }

  /**
   * Observable stream of events for subscribers.
   */
  get events$(): Observable<ObservabilityEventRecord> {
    return this.subject.asObservable();
  }

  /**
   * Snapshot of the current in-memory buffer (FIFO with configured size).
   */
  getSnapshot(): ObservabilityEventRecord[] {
    return [...this.buffer];
  }

  /**
   * Push a new event into the buffer and notify subscribers.
   * Enriches events with username (from cache or database lookup).
   */
  async push(event: ObservabilityEventRecord): Promise<void> {
    try {
      const userId = event.context?.userId;
      const payloadUsername = event.payload?.username as string | undefined;

      // Learn: If event already has a username in payload, cache it
      if (userId && payloadUsername && payloadUsername !== userId) {
        this.cacheUsername(userId, payloadUsername);
      }

      // Enrich: If event doesn't have username, resolve it (from cache or DB)
      if (userId && !payloadUsername) {
        const username = await this.resolveUsername(userId);
        if (username) {
          event.payload = {
            ...event.payload,
            username,
          };
        }
      }

      this.logger.log(
        `📥 [BUFFER] Pushing event: ${event.hook_event_type} for task ${event.context.taskId || 'unknown'}, username=${event.payload?.username || 'unknown'}`,
      );
      this.buffer.push(event);
      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      this.subject.next(event);
      this.logger.log(
        `✅ [BUFFER] Event pushed successfully, buffer size: ${this.buffer.length}, subscribers notified`,
      );

      // Persist to database (fire and forget, don't block)
      this.persistToDatabase(event).catch((err) => {
        this.logger.warn(`Failed to persist event to database: ${err}`);
      });
    } catch (error) {
      this.logger.error(
        `❌ [BUFFER] Failed to push observability event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.logger.error(error);
    }
  }

  /**
   * Persist event to database for historical queries
   */
  private async persistToDatabase(
    event: ObservabilityEventRecord,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { error } = await client.from('observability_events').insert({
        source_app: event.source_app,
        session_id: event.context.conversationId || event.context.taskId,
        hook_event_type: event.hook_event_type,
        user_id: event.context.userId || null,
        username: (event.payload?.username as string) || null,
        conversation_id: event.context.conversationId || null,
        task_id: event.context.taskId || 'unknown',
        agent_slug: event.context.agentSlug || null,
        organization_slug: event.context.orgSlug || null,
        mode: (event.payload?.mode as string) || null,
        status: event.status,
        message: event.message,
        progress: event.progress,
        step: event.step,
        sequence: (event.payload?.sequence as number) || null,
        total_steps: (event.payload?.totalSteps as number) || null,
        payload: event.payload,
        timestamp: event.timestamp,
      });

      if (error) {
        this.logger.warn(`Database insert error: ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to persist event: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Query historical events from database
   * @param since Timestamp (ms) - fetch events from this time onwards
   * @param limit Max number of events to return
   * @param until Optional timestamp (ms) - fetch events up to this time
   */
  async getHistoricalEvents(
    since: number,
    limit = 1000,
    until?: number,
  ): Promise<ObservabilityEventRecord[]> {
    try {
      const client = this.supabaseService.getServiceClient();

      let query = client
        .from('observability_events')
        .select('*')
        .gte('timestamp', since);

      // Add upper bound if specified
      if (until) {
        query = query.lte('timestamp', until);
      }

      const { data, error } = await query
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error(`Failed to query historical events: ${error.message}`);
        return [];
      }

      // Map database records to ObservabilityEventRecord format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data || []).map((row: any) => ({
        context: {
          conversationId: row.conversation_id,
          taskId: row.task_id,
          userId: row.user_id,
          agentSlug: row.agent_slug,
          orgSlug: row.organization_slug,
        } as ExecutionContext,
        source_app: row.source_app,
        hook_event_type: row.hook_event_type,
        status: row.status || '',
        message: row.message,
        progress: row.progress,
        step: row.step,
        payload: {
          ...(row.payload || {}),
          username: row.username,
          mode: row.mode,
          sequence: row.sequence,
          totalSteps: row.total_steps,
        },
        timestamp: row.timestamp,
        id: row.id,
        created_at: row.created_at,
      }));
    } catch (err) {
      this.logger.error(
        `Failed to query historical events: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
