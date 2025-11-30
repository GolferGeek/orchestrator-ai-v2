import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

export interface ObservabilityEventRecord {
  /** Full ExecutionContext capsule - required for SSE streaming */
  context?: ExecutionContext;
  source_app: string;
  session_id: string | null;
  hook_event_type: string;
  user_id: string | null;
  username: string | null;
  conversation_id: string | null;
  task_id: string;
  agent_slug: string | null;
  organization_slug: string | null;
  mode: string | null;
  status: string;
  message: string | null;
  progress: number | null;
  step: string | null;
  payload: Record<string, unknown>;
  timestamp: number;
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


