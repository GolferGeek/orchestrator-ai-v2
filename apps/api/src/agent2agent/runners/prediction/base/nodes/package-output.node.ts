/**
 * Package Output Node
 *
 * Creates final recommendations from specialist analyses and evaluator challenges.
 * Applies risk profile to determine position sizing and timing.
 *
 * RESPONSIBILITIES:
 * 1. Aggregate specialist analyses by instrument
 * 2. Apply evaluator challenge results
 * 3. Calculate consensus confidence
 * 4. Apply risk profile for sizing
 * 5. Package as actionable recommendations
 * 6. Set timing windows based on urgency
 *
 * @module package-output.node
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PredictionState,
  PredictionStateUpdate,
  markStageComplete,
} from '../base-prediction.state';
import { Recommendation } from '../base-prediction.types';

/**
 * Package specialist analyses into final recommendations.
 *
 * NOTE: This is a placeholder implementation for Phase 1.
 * Phase 2+ will implement sophisticated consensus building and risk-adjusted sizing.
 *
 * @param state - Current prediction state
 * @returns State update with recommendations
 */
export function packageOutputNode(
  state: PredictionState,
): PredictionStateUpdate {
  try {
    const recommendations: Recommendation[] = [];

    // Phase 1: Create placeholder recommendations for triaged instruments
    for (const triageResult of state.triageResults) {
      if (!triageResult.proceed) {
        continue;
      }

      // Create a basic recommendation
      const recommendation: Recommendation = {
        id: uuidv4(),
        instrument: triageResult.instrument,
        action: 'hold', // Phase 1: default to hold
        confidence: 0.5, // Phase 1: default medium confidence
        rationale: `Placeholder recommendation for ${triageResult.instrument}. Phase 2 will implement specialist consensus.`,
        evidence: [],
      };

      recommendations.push(recommendation);
    }

    // Mark execution as complete
    return markStageComplete(state, 'complete', {
      recommendations,
      status: 'completed',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error in package-output node';

    return {
      errors: [errorMessage],
      status: 'failed',
      currentStage: 'failed',
    };
  }
}
