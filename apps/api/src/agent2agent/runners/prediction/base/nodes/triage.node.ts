/**
 * Triage Node
 *
 * LLM-based triage deciding which bundles proceed to specialist analysis.
 * Uses multi-agent triage with voting to determine urgency and specialist teams.
 *
 * RESPONSIBILITIES:
 * 1. Analyze each enriched claim bundle
 * 2. Determine if bundle warrants specialist analysis
 * 3. Assess urgency level (low, medium, high, critical)
 * 4. Select which specialist teams to engage
 * 5. Record triage votes and rationale
 *
 * @module triage.node
 */

import {
  PredictionState,
  PredictionStateUpdate,
  markStageComplete,
} from '../base-prediction.state';
import { TriageResult } from '../base-prediction.types';

/**
 * Perform LLM-based triage on claim bundles.
 *
 * NOTE: This is a placeholder implementation for Phase 1.
 * Phase 2 will implement actual LLM-based triage using LLMGenerationService.
 *
 * @param state - Current prediction state
 * @returns State update with triage results
 */
export function triageNode(state: PredictionState): PredictionStateUpdate {
  try {
    const triageResults: TriageResult[] = [];

    // Process each bundle that passed pre-filter
    for (const bundle of state.instrumentBundles) {
      if (!bundle.shouldProceed) {
        continue;
      }

      // TODO Phase 2: Use LLM to perform triage
      // For now, create a simple rule-based triage
      const significance = bundle.claimsDiff.significanceScore;

      // Determine urgency based on significance
      let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (significance > 0.8) {
        urgency = 'critical';
      } else if (significance > 0.6) {
        urgency = 'high';
      } else if (significance > 0.4) {
        urgency = 'medium';
      }

      // Determine specialist teams (Phase 1: default teams)
      const specialistTeams = ['technical', 'fundamental'];

      // Create triage result
      const result: TriageResult = {
        instrument: bundle.instrument,
        proceed: true, // Phase 1: all bundles proceed
        urgency,
        specialistTeams,
        rationale: `Bundle has ${bundle.currentClaims.length} claims with significance ${significance.toFixed(2)}`,
        votes: [
          {
            agent: 'rule-based-triage',
            proceed: true,
            confidence: significance,
            reason: 'Phase 1 placeholder triage',
          },
        ],
      };

      triageResults.push(result);
    }

    return markStageComplete(state, 'triage', {
      triageResults,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error in triage node';

    return {
      errors: [errorMessage],
      status: 'failed',
      currentStage: 'failed',
    };
  }
}
