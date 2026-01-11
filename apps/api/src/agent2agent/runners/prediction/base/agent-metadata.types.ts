/**
 * Agent Metadata Types for Prediction Runners
 *
 * This file documents the contract for how prediction runner configuration
 * is stored in the agents.metadata JSONB column.
 *
 * WHY METADATA (not a separate config column):
 * 1. Metadata is already flexible JSONB - no schema migration needed
 * 2. Agent description, capabilities, and runner config logically belong together
 * 3. Simpler - one column to manage instead of two
 * 4. Consistent with how other agent types store their configuration
 *
 * STRUCTURE:
 * ```json
 * {
 *   "description": "Human-readable agent description",
 *   "capabilities": ["capability-1", "capability-2"],
 *   "runnerConfig": {
 *     "runner": "stock-predictor",
 *     "instruments": ["AAPL", "MSFT"],
 *     "riskProfile": "moderate",
 *     "pollIntervalMs": 60000,
 *     "preFilterThresholds": { ... },
 *     "modelConfig": { ... },
 *     "learningConfig": { ... }
 *   }
 * }
 * ```
 *
 * MODEL CONFIGURATION:
 * The modelConfig section allows per-stage model overrides:
 *
 * ```json
 * {
 *   "modelConfig": {
 *     "triage": {
 *       "provider": "anthropic",
 *       "model": "claude-3-5-haiku-20241022",
 *       "temperature": 0.3
 *     },
 *     "specialists": {
 *       "provider": "anthropic",
 *       "model": "claude-sonnet-4-20250514",
 *       "temperature": 0.5
 *     },
 *     "evaluators": {
 *       "provider": "anthropic",
 *       "model": "claude-sonnet-4-20250514",
 *       "temperature": 0.7
 *     },
 *     "learning": {
 *       "provider": "anthropic",
 *       "model": "claude-sonnet-4-20250514",
 *       "temperature": 0.5
 *     }
 *   }
 * }
 * ```
 *
 * HOW MODELS ARE USED:
 * 1. Agent's llm_config provides the default provider/model (for ExecutionContext)
 * 2. metadata.runnerConfig.modelConfig provides stage-specific overrides
 * 3. ExecutionContext flows through UNCHANGED (immutable for observability)
 * 4. Stage-specific provider/model passed in LLMRequestOptions
 *
 * Example runner code:
 * ```typescript
 * const triageConfig = runnerConfig.modelConfig?.triage;
 * const response = await llmService.generateResponse(
 *   executionContext,  // Unchanged, has default model
 *   systemPrompt,
 *   userMessage,
 *   {
 *     executionContext,
 *     provider: triageConfig?.provider,  // Override for this call
 *     model: triageConfig?.model,        // Override for this call
 *     temperature: triageConfig?.temperature,
 *   }
 * );
 * ```
 *
 * @module agent-metadata.types
 */

import {
  PredictionRunnerConfig,
  PredictionRunnerType,
  RiskProfile,
  PreFilterThresholds,
  StageModelConfig,
  LearningConfig,
} from './base-prediction.types';

// Re-export for convenience
export type {
  PredictionRunnerConfig,
  PredictionRunnerType,
  RiskProfile,
  PreFilterThresholds,
  StageModelConfig,
  LearningConfig,
};

/**
 * Full agent metadata structure for prediction agents.
 * This is what gets stored in agents.metadata column.
 */
export interface PredictionAgentMetadata {
  /** Human-readable description */
  description?: string;

  /** List of capabilities (for discovery/filtering) */
  capabilities?: string[];

  /** Runner configuration - required for prediction agents */
  runnerConfig: PredictionRunnerConfig;

  /** Additional metadata fields */
  [key: string]: unknown;
}

/**
 * Type guard to check if metadata contains valid runner config
 */
export function hasPredictionRunnerConfig(
  metadata: unknown,
): metadata is PredictionAgentMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const m = metadata as Record<string, unknown>;
  if (!m.runnerConfig || typeof m.runnerConfig !== 'object') {
    return false;
  }

  const config = m.runnerConfig as Record<string, unknown>;
  return (
    typeof config.runner === 'string' &&
    Array.isArray(config.instruments) &&
    typeof config.riskProfile === 'string'
  );
}

/**
 * Extract runner config from metadata with validation.
 *
 * @throws Error if runnerConfig is missing or invalid
 */
export function extractRunnerConfig(
  metadata: unknown,
  agentSlug: string,
): PredictionRunnerConfig {
  if (!hasPredictionRunnerConfig(metadata)) {
    throw new Error(
      `Agent '${agentSlug}' metadata does not contain valid runnerConfig. ` +
        `Expected: { runnerConfig: { runner, instruments, riskProfile, ... } }`,
    );
  }

  return metadata.runnerConfig;
}

/**
 * Get model config for a specific stage, with fallback.
 * Returns undefined if no override exists (use ExecutionContext default).
 */
export function getStageModel(
  config: PredictionRunnerConfig,
  stage: keyof StageModelConfig,
):
  | {
      provider: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
    }
  | undefined {
  return config.modelConfig?.[stage];
}

/**
 * Default pre-filter thresholds by runner type.
 * Used when agent config doesn't specify thresholds.
 */
export const DEFAULT_PREFILTER_THRESHOLDS: Record<
  PredictionRunnerType,
  PreFilterThresholds
> = {
  'financial-asset-predictor': {
    minPriceChangePercent: 2, // 2% for stocks, higher for crypto detected dynamically
    minSentimentShift: 0.2,
    minSignificanceScore: 0.3,
  },
  'stock-predictor': {
    minPriceChangePercent: 2,
    minSentimentShift: 0.2,
    minSignificanceScore: 0.3,
  },
  'crypto-predictor': {
    minPriceChangePercent: 5,
    minSentimentShift: 0.3,
    minSignificanceScore: 0.25,
  },
  'market-predictor': {
    minPriceChangePercent: 5, // 5% odds shift
    minSentimentShift: 0.25,
    minSignificanceScore: 0.2,
  },
  'election-predictor': {
    minPriceChangePercent: 3, // 3% poll shift
    minSentimentShift: 0.2,
    minSignificanceScore: 0.25,
  },
};

/**
 * Default poll intervals by runner type (in milliseconds).
 */
export const DEFAULT_POLL_INTERVALS: Record<PredictionRunnerType, number> = {
  'financial-asset-predictor': 60000, // 1 minute (adaptive for crypto)
  'stock-predictor': 60000, // 1 minute (market hours)
  'crypto-predictor': 30000, // 30 seconds (24/7)
  'market-predictor': 300000, // 5 minutes (prediction markets)
  'election-predictor': 3600000, // 1 hour (polls don't change fast)
};
