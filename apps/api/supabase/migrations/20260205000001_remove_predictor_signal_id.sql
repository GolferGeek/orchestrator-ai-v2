-- =============================================================================
-- REMOVE PREDICTOR SIGNAL_ID COLUMN
-- =============================================================================
-- The new article processing flow goes directly from Article → Predictor,
-- bypassing the legacy Signal step. Signal_id is no longer needed.
--
-- New Flow: Article → (ensemble evaluation) → Predictor → Prediction
-- Old Flow: Signal → Predictor → Prediction (deprecated)
-- =============================================================================

ALTER TABLE prediction.predictors DROP COLUMN IF EXISTS signal_id;
