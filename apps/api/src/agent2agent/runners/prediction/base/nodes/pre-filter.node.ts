/**
 * Pre-Filter Node
 *
 * Rule-based filtering using PreFilterThresholds from config.
 * Quickly filters out bundles that don't meet minimum significance thresholds.
 *
 * RESPONSIBILITIES:
 * 1. Group claims by instrument into bundles
 * 2. Fetch historical claims for comparison
 * 3. Calculate claims diff (new, changed, removed)
 * 4. Apply pre-filter thresholds
 * 5. Mark bundles as shouldProceed or not
 *
 * @module pre-filter.node
 */

import {
  PredictionState,
  PredictionStateUpdate,
  markStageComplete,
} from '../base-prediction.state';
import { EnrichedClaimBundle, ClaimBundle } from '../base-prediction.types';

/**
 * Apply rule-based pre-filtering to claim bundles.
 *
 * NOTE: This is a placeholder implementation for Phase 1.
 * Phase 2 will implement actual historical comparison using PredictionDbService.
 *
 * @param state - Current prediction state
 * @returns State update with enriched bundles
 */
export function preFilterNode(state: PredictionState): PredictionStateUpdate {
  try {
    if (!state.datapoint) {
      throw new Error('No datapoint to filter');
    }

    // Group claims by instrument
    const instrumentMap = new Map<string, ClaimBundle>();

    for (const claim of state.datapoint.allClaims) {
      if (!instrumentMap.has(claim.instrument)) {
        instrumentMap.set(claim.instrument, {
          instrument: claim.instrument,
          currentClaims: [],
          sources: [],
        });
      }

      const bundle = instrumentMap.get(claim.instrument)!;
      bundle.currentClaims.push(claim);
    }

    // Add sources to bundles
    for (const source of state.datapoint.sources) {
      for (const claim of source.claims) {
        const bundle = instrumentMap.get(claim.instrument);
        if (bundle && !bundle.sources.includes(source.tool)) {
          bundle.sources.push(source.tool);
        }
      }
    }

    // TODO Phase 2: Fetch historical claims and calculate diffs
    // For now, create enriched bundles without historical context
    const enrichedBundles: EnrichedClaimBundle[] = Array.from(
      instrumentMap.values(),
    ).map((bundle) => ({
      ...bundle,
      historicalClaims: [],
      claimsDiff: {
        newClaims: bundle.currentClaims, // All claims are "new" without history
        changedClaims: [],
        removedClaims: [],
        significanceScore: 0.5, // Default medium significance
      },
      shouldProceed: true, // Phase 1: proceed with all bundles
      proceedReason: 'Pre-filter placeholder - all bundles proceed in Phase 1',
    }));

    // Apply thresholds (Phase 1: simple pass-through)
    const thresholds = state.config.preFilterThresholds;
    const filteredBundles = enrichedBundles.filter(
      (bundle) =>
        bundle.claimsDiff.significanceScore >= thresholds.minSignificanceScore,
    );

    return markStageComplete(state, 'group', {
      instrumentBundles: filteredBundles,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error in pre-filter node';

    return {
      errors: [errorMessage],
      status: 'failed',
      currentStage: 'failed',
    };
  }
}
