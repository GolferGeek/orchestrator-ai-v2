/**
 * Predictor entity interface - represents an assessed article/signal ready to contribute to a prediction
 * Based on prediction.predictors table
 *
 * Predictors can be created from:
 * - Articles directly (new flow): article_id is set, signal_id is null
 * - Signals (legacy flow): signal_id is set, article_id may be null
 */

/**
 * Predictor lifecycle status
 * - active: Ready to be consumed by a prediction
 * - consumed: Used in a prediction
 * - expired: TTL exceeded without being consumed
 * - invalidated: Manually invalidated or superseded
 */
export type PredictorStatus = 'active' | 'consumed' | 'expired' | 'invalidated';

/**
 * Predictor directional assessment
 * - bullish: Predicts upward movement
 * - bearish: Predicts downward movement
 * - neutral: No clear directional signal
 */
export type PredictorDirection = 'bullish' | 'bearish' | 'neutral';

export interface Predictor {
  id: string;
  signal_id: string | null; // Legacy: nullable after signal removal
  article_id: string | null; // New: reference to crawler.articles
  target_id: string;
  direction: PredictorDirection;
  strength: number; // 1-10
  confidence: number; // 0.00-1.00
  reasoning: string;
  analyst_slug: string;
  analyst_assessment: AnalystAssessment;
  llm_usage_id: string | null;
  status: PredictorStatus;
  consumed_at: string | null;
  consumed_by_prediction_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Analyst's detailed assessment of a signal
 */
export interface AnalystAssessment {
  direction: PredictorDirection;
  confidence: number;
  reasoning: string;
  key_factors: string[];
  risks: string[];
}

export interface CreatePredictorData {
  signal_id?: string | null; // Legacy: optional after signal removal
  article_id?: string | null; // New: reference to crawler.articles
  target_id: string;
  direction: PredictorDirection;
  strength: number;
  confidence: number;
  reasoning: string;
  analyst_slug: string;
  analyst_assessment: AnalystAssessment;
  llm_usage_id?: string;
  expires_at: string;
  status?: PredictorStatus;
  // INV-03: Must match is_test from source article/signal
  is_test?: boolean;
}

export interface UpdatePredictorData {
  status?: PredictorStatus;
  consumed_at?: string;
  consumed_by_prediction_id?: string;
}
