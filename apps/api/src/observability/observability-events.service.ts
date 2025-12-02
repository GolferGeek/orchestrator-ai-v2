import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

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
      this.logger.log(
        `📥 [BUFFER] Pushing event: ${event.hook_event_type} for task ${event.context.taskId || 'unknown'}`,
      );
      this.buffer.push(event);
      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }

      this.subject.next(event);
      this.logger.log(
        `✅ [BUFFER] Event pushed successfully, buffer size: ${this.buffer.length}, subscribers notified`,
      );
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
