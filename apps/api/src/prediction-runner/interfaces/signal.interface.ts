/**
 * Signal entity interface - represents a raw signal (news, event, social media post, etc.)
 * Based on prediction.signals table
 */

/**
 * Signal processing disposition
 * - pending: Not yet processed
 * - processing: Currently being evaluated
 * - predictor_created: Successfully generated a predictor
 * - rejected: Deemed not relevant/actionable
 * - review_pending: Needs human review
 * - expired: TTL exceeded without processing
 */
export type SignalDisposition =
  | 'pending'
  | 'processing'
  | 'predictor_created'
  | 'rejected'
  | 'review_pending'
  | 'expired';

/**
 * Signal urgency level
 * - urgent: Immediate attention required
 * - notable: Important but not time-critical
 * - routine: Normal processing
 */
export type SignalUrgency = 'urgent' | 'notable' | 'routine';

/**
 * Signal sentiment direction
 * - bullish: Positive sentiment
 * - bearish: Negative sentiment
 * - neutral: Mixed or neutral sentiment
 */
export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

export interface Signal {
  id: string;
  target_id: string;
  source_id: string;
  content: string;
  direction: SignalDirection;
  detected_at: string;
  url: string | null;
  metadata: Record<string, unknown>;
  disposition: SignalDisposition;
  urgency: SignalUrgency | null;
  processing_worker: string | null;
  processing_started_at: string | null;
  evaluation_result: EvaluationResult | null;
  review_queue_id: string | null;
  created_at: string;
  updated_at: string;
  expired_at: string | null;
}

/**
 * Evaluation result from analyst assessment
 */
export interface EvaluationResult {
  confidence: number;
  analyst_slug: string;
  reasoning: string;
}

export interface CreateSignalData {
  target_id: string;
  source_id: string;
  content: string;
  direction: SignalDirection;
  detected_at?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  disposition?: SignalDisposition;
}

export interface UpdateSignalData {
  content?: string;
  direction?: SignalDirection;
  url?: string;
  metadata?: Record<string, unknown>;
  disposition?: SignalDisposition;
  urgency?: SignalUrgency | null;
  processing_worker?: string | null;
  processing_started_at?: string | null;
  evaluation_result?: EvaluationResult;
  review_queue_id?: string | null;
  expired_at?: string | null;
}
