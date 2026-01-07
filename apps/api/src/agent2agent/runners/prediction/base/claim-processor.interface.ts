/**
 * ClaimProcessor Interface
 *
 * Defines the contract for processing claims from data sources.
 * The ClaimProcessor is responsible for:
 * 1. Grouping claims by instrument
 * 2. Enriching with historical context
 * 3. Determining if claims should proceed to specialists
 *
 * @module claim-processor.interface
 */

import {
  Claim,
  ClaimBundle,
  EnrichedClaimBundle,
  ClaimsDiff,
  Datapoint,
  PreFilterThresholds,
} from './base-prediction.types';

/**
 * Interface for claim processing operations.
 * Implementations can be domain-specific if needed.
 */
export interface IClaimProcessor {
  /**
   * Group claims from a datapoint by instrument.
   *
   * @param datapoint - The datapoint containing all collected claims
   * @returns Array of claim bundles, one per instrument
   *
   * @example
   * ```typescript
   * const bundles = processor.groupClaims(datapoint);
   * // Returns: [
   * //   { instrument: 'AAPL', currentClaims: [...], sources: ['yahoo-finance'] },
   * //   { instrument: 'MSFT', currentClaims: [...], sources: ['yahoo-finance', 'alpha-vantage'] }
   * // ]
   * ```
   */
  groupClaims(datapoint: Datapoint): ClaimBundle[];

  /**
   * Enrich claim bundles with historical context from the database.
   *
   * @param bundles - Claim bundles to enrich
   * @param agentId - Agent ID for historical lookups
   * @param lookbackHours - How far back to look for historical claims
   * @returns Enriched claim bundles with history and diff
   */
  enrichWithHistory(
    bundles: ClaimBundle[],
    agentId: string,
    lookbackHours: number,
  ): Promise<EnrichedClaimBundle[]>;

  /**
   * Determine if a bundle should proceed to specialist analysis.
   * This is the pre-filter stage - rule-based, no LLM calls.
   *
   * @param bundle - Enriched claim bundle to evaluate
   * @param thresholds - Pre-filter thresholds from config
   * @returns Updated bundle with shouldProceed flag and reason
   */
  shouldProceedToSpecialists(
    bundle: EnrichedClaimBundle,
    thresholds: PreFilterThresholds,
  ): EnrichedClaimBundle;

  /**
   * Calculate the diff between current and historical claims.
   *
   * @param currentClaims - Claims from current poll
   * @param historicalClaims - Claims from previous polls
   * @returns Structured diff with significance score
   */
  calculateClaimsDiff(
    currentClaims: Claim[],
    historicalClaims: Claim[],
  ): ClaimsDiff;
}

/**
 * Configuration for the claim processor
 */
export interface ClaimProcessorConfig {
  /** Default lookback period for historical context (hours) */
  defaultLookbackHours: number;

  /** Minimum claims required to calculate meaningful diff */
  minClaimsForDiff: number;

  /** Weight factors for significance calculation */
  significanceWeights: {
    priceChange: number;
    volumeChange: number;
    sentimentShift: number;
    newClaims: number;
  };
}

/**
 * Default configuration for claim processor
 */
export const DEFAULT_CLAIM_PROCESSOR_CONFIG: ClaimProcessorConfig = {
  defaultLookbackHours: 24,
  minClaimsForDiff: 3,
  significanceWeights: {
    priceChange: 0.4,
    volumeChange: 0.2,
    sentimentShift: 0.3,
    newClaims: 0.1,
  },
};
