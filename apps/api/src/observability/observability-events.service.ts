import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * ObservabilityEventRecord
 *
 * Record structure for observability events.
 * - `context` is REQUIRED - the ExecutionContext capsule for SSE streaming
 * - Flat fields (user_id, conversation_id, etc.) are kept for database storage/querying
 *   These are derived from context and stored flat for SQL index efficiency
 */
export interface ObservabilityEventRecord {
  /** ExecutionContext capsule - REQUIRED for SSE streaming */
  context: ExecutionContext;
  /** Source application identifier */
  source_app: string;
  /** Session identifier (usually conversationId or taskId) */
  session_id: string | null;
  /** Event type (e.g., 'langgraph.started', 'agent.progress') */
  hook_event_type: string;
  /** User ID (from context, stored flat for DB queries) */
  user_id: string | null;
  /** Username (resolved from userId) */
  username: string | null;
  /** Conversation ID (from context, stored flat for DB queries) */
  conversation_id: string | null;
  /** Task ID (from context, stored flat for DB queries) */
  task_id: string;
  /** Agent slug (from context, stored flat for DB queries) */
  agent_slug: string | null;
  /** Organization slug (from context, stored flat for DB queries) */
  organization_slug: string | null;
  /** Mode (plan, build, converse) */
  mode: string | null;
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
  /** Additional fields for extensibility */
  [key: string]: unknown;
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

  constructor() {
    this.bufferSize = Math.max(
      Number(process.env.OBSERVABILITY_EVENT_BUFFER ?? 500),
      1,
    );
    this.subject = new ReplaySubject<ObservabilityEventRecord>(this.bufferSize);
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
   */
  push(event: ObservabilityEventRecord): void {
    try {
      this.buffer.push(event);
      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      this.subject.next(event);
    } catch (error) {
      this.logger.error(
        `❌ [BUFFER] Failed to push observability event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.logger.error(error);
    }
  }
}
