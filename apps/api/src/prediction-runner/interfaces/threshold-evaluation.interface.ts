/**
 * Threshold evaluation interface - for determining when to create predictions
 */

export interface ThresholdConfig {
  min_predictors: number; // Minimum number of active predictors
  min_combined_strength: number; // Minimum sum of strengths (1-10)
  min_direction_consensus: number; // Minimum % agreement (0.0-1.0)
  predictor_ttl_hours: number; // Hours until predictor expires
}

export interface ThresholdEvaluationResult {
  meetsThreshold: boolean;
  activeCount: number;
  combinedStrength: number;
  directionConsensus: number;
  dominantDirection: 'bullish' | 'bearish' | 'neutral';
  details: {
    bullishCount: number;
    bearishCount: number;
    neutralCount: number;
    avgConfidence: number;
  };
}

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  min_predictors: 3,
  min_combined_strength: 15,
  min_direction_consensus: 0.6,
  predictor_ttl_hours: 24,
};
