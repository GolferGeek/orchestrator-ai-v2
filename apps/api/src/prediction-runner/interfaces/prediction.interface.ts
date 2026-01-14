/**
 * Prediction entity interface - represents an actionable prediction
 * Based on prediction.predictions table
 */

/**
 * Prediction lifecycle status
 * - active: Active prediction being tracked
 * - resolved: Outcome determined
 * - expired: Timeframe elapsed without resolution
 * - cancelled: Manually cancelled
 */
export type PredictionStatus = 'active' | 'resolved' | 'expired' | 'cancelled';

/**
 * Prediction direction (outcome vocabulary)
 * Note: Different from signal sentiment (bullish/bearish)
 * - up: Predicts upward movement
 * - down: Predicts downward movement
 * - flat: Predicts minimal movement
 */
export type PredictionDirection = 'up' | 'down' | 'flat';

export interface Prediction {
  id: string;
  target_id: string;
  task_id: string | null;
  direction: PredictionDirection;
  confidence: number;
  magnitude: 'small' | 'medium' | 'large' | null;
  reasoning: string;
  timeframe_hours: number;
  predicted_at: string;
  expires_at: string;
  entry_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  analyst_ensemble: Record<string, unknown>;
  llm_ensemble: Record<string, unknown>;
  status: PredictionStatus;
  outcome_value: number | null;
  outcome_captured_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  /** Flag indicating if this is test data */
  is_test_data?: boolean | null;
  /** Test scenario ID if this is test data */
  test_scenario_id?: string | null;
}

export interface CreatePredictionData {
  target_id: string;
  task_id?: string;
  direction: PredictionDirection;
  confidence: number;
  magnitude?: 'small' | 'medium' | 'large';
  reasoning: string;
  timeframe_hours: number;
  predicted_at?: string;
  expires_at: string;
  entry_price?: number;
  target_price?: number;
  stop_loss?: number;
  analyst_ensemble: Record<string, unknown>;
  llm_ensemble: Record<string, unknown>;
  status?: PredictionStatus;
}

export interface UpdatePredictionData {
  direction?: PredictionDirection;
  confidence?: number;
  magnitude?: 'small' | 'medium' | 'large' | null;
  reasoning?: string;
  status?: PredictionStatus;
  outcome_value?: number;
  outcome_captured_at?: string;
  resolution_notes?: string;
}
