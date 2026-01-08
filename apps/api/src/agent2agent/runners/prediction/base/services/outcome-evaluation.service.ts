/**
 * Outcome Evaluation Service
 *
 * Evaluates recommendation outcomes by comparing predictions to actual market behavior.
 * Domain-aware evaluation for stocks, crypto, and prediction markets.
 *
 * @module outcome-evaluation.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import {
  Recommendation,
  RecommendationAction,
  PredictionRunnerType,
} from '../base-prediction.types';

/**
 * Outcome classification
 */
export type OutcomeClassification =
  | 'correct'
  | 'incorrect'
  | 'partial'
  | 'inconclusive';

/**
 * Outcome evaluation result
 */
export interface OutcomeEvaluationResult {
  recommendationId: string;
  instrument: string;
  outcome: OutcomeClassification;
  actualReturnPercent: number | null;
  benchmarkReturnPercent: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  entryTimestamp: string | null;
  exitTimestamp: string | null;
  evaluationMethod: 'auto' | 'manual' | 'market_close';
  evaluationNotes: string;
  resolutionValue?: string; // For prediction markets
  resolutionTimestamp?: string;
}

/**
 * Price data for evaluation
 */
interface PriceData {
  price: number;
  timestamp: string;
}

@Injectable()
export class OutcomeEvaluationService {
  private readonly logger = new Logger(OutcomeEvaluationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Evaluate the outcome of a recommendation.
   *
   * @param recommendation - The recommendation to evaluate
   * @param runnerType - Type of prediction runner (for domain-specific logic)
   * @param entryPriceData - Price at entry (when recommendation was made)
   * @param exitPriceData - Price at exit (evaluation time)
   * @returns Outcome evaluation result
   */
  async evaluateOutcome(
    recommendation: Recommendation,
    runnerType: PredictionRunnerType,
    entryPriceData: PriceData,
    exitPriceData: PriceData,
  ): Promise<OutcomeEvaluationResult> {
    this.logger.debug(
      `Evaluating outcome for recommendation ${recommendation.id} (${recommendation.instrument})`,
    );

    // Calculate returns
    const actualReturn = this.calculateActualReturn(
      recommendation.action,
      entryPriceData.price,
      exitPriceData.price,
    );

    const benchmarkReturn = this.calculateBenchmarkReturn(
      entryPriceData.price,
      exitPriceData.price,
    );

    // Classify outcome based on runner type
    const outcome = this.classifyOutcome(
      recommendation,
      runnerType,
      actualReturn,
      benchmarkReturn,
    );

    const result: OutcomeEvaluationResult = {
      recommendationId: recommendation.id,
      instrument: recommendation.instrument,
      outcome,
      actualReturnPercent: actualReturn,
      benchmarkReturnPercent: benchmarkReturn,
      entryPrice: entryPriceData.price,
      exitPrice: exitPriceData.price,
      entryTimestamp: entryPriceData.timestamp,
      exitTimestamp: exitPriceData.timestamp,
      evaluationMethod: 'auto',
      evaluationNotes: this.generateEvaluationNotes(
        recommendation,
        outcome,
        actualReturn,
        benchmarkReturn,
      ),
    };

    this.logger.debug(
      `Outcome for ${recommendation.id}: ${outcome} (return: ${actualReturn?.toFixed(2)}%)`,
    );

    return result;
  }

  /**
   * Evaluate a prediction market outcome (e.g., Polymarket).
   *
   * @param recommendation - The recommendation to evaluate
   * @param resolution - 'yes' or 'no' resolution
   * @param resolutionTimestamp - When the market resolved
   * @returns Outcome evaluation result
   */
  async evaluatePredictionMarketOutcome(
    recommendation: Recommendation,
    resolution: 'yes' | 'no',
    resolutionTimestamp: string,
  ): Promise<OutcomeEvaluationResult> {
    this.logger.debug(
      `Evaluating prediction market outcome for ${recommendation.id}: ${resolution}`,
    );

    const wasCorrect =
      (recommendation.action === 'bet_yes' && resolution === 'yes') ||
      (recommendation.action === 'bet_no' && resolution === 'no');

    // Calculate return based on confidence (simplified)
    // In reality, this would factor in actual odds at entry
    const actualReturn = wasCorrect
      ? (1 / recommendation.confidence - 1) * 100
      : -100;

    const result: OutcomeEvaluationResult = {
      recommendationId: recommendation.id,
      instrument: recommendation.instrument,
      outcome: wasCorrect ? 'correct' : 'incorrect',
      actualReturnPercent: actualReturn,
      benchmarkReturnPercent: null,
      entryPrice: recommendation.confidence, // Entry odds as "price"
      exitPrice: resolution === 'yes' ? 1 : 0,
      entryTimestamp: recommendation.timingWindow?.validFrom || null,
      exitTimestamp: resolutionTimestamp,
      evaluationMethod: 'market_close',
      evaluationNotes: `Market resolved ${resolution}. Recommendation was ${recommendation.action} with ${(recommendation.confidence * 100).toFixed(0)}% confidence.`,
      resolutionValue: resolution,
      resolutionTimestamp,
    };

    return result;
  }

  /**
   * Calculate actual return based on action and price movement.
   */
  calculateActualReturn(
    action: RecommendationAction,
    entryPrice: number,
    exitPrice: number,
  ): number {
    const priceChange = ((exitPrice - entryPrice) / entryPrice) * 100;

    switch (action) {
      case 'buy':
      case 'accumulate':
        return priceChange;

      case 'sell':
      case 'reduce':
        return -priceChange; // Short position

      case 'hold':
        return 0; // No position change

      case 'bet_yes':
      case 'bet_no':
        // Handled separately in evaluatePredictionMarketOutcome
        return 0;

      case 'wait':
        return 0;

      default:
        return 0;
    }
  }

  /**
   * Calculate benchmark (buy-and-hold) return.
   */
  calculateBenchmarkReturn(entryPrice: number, exitPrice: number): number {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }

  /**
   * Classify the outcome based on action, returns, and domain.
   */
  private classifyOutcome(
    recommendation: Recommendation,
    runnerType: PredictionRunnerType,
    actualReturn: number | null,
    benchmarkReturn: number | null,
  ): OutcomeClassification {
    if (actualReturn === null || benchmarkReturn === null) {
      return 'inconclusive';
    }

    // Domain-specific thresholds
    const thresholds = this.getThresholdsForRunner(runnerType);

    // For buy/sell actions, check if we beat the benchmark
    if (
      recommendation.action === 'buy' ||
      recommendation.action === 'accumulate'
    ) {
      if (actualReturn > thresholds.minPositiveReturn) {
        return 'correct';
      } else if (actualReturn < -thresholds.minNegativeReturn) {
        return 'incorrect';
      } else {
        return 'partial';
      }
    }

    if (
      recommendation.action === 'sell' ||
      recommendation.action === 'reduce'
    ) {
      // For sells, we want the price to go down
      if (actualReturn > thresholds.minPositiveReturn) {
        return 'correct';
      } else if (actualReturn < -thresholds.minNegativeReturn) {
        return 'incorrect';
      } else {
        return 'partial';
      }
    }

    if (recommendation.action === 'hold') {
      // Hold is correct if price stayed relatively flat
      if (Math.abs(benchmarkReturn) < thresholds.holdThreshold) {
        return 'correct';
      } else if (benchmarkReturn > thresholds.holdThreshold) {
        return 'partial'; // Should have bought
      } else {
        return 'partial'; // Should have sold
      }
    }

    return 'inconclusive';
  }

  /**
   * Get classification thresholds based on runner type.
   */
  private getThresholdsForRunner(runnerType: PredictionRunnerType): {
    minPositiveReturn: number;
    minNegativeReturn: number;
    holdThreshold: number;
  } {
    switch (runnerType) {
      case 'stock-predictor':
        return {
          minPositiveReturn: 1.0, // 1% return
          minNegativeReturn: 2.0, // 2% loss
          holdThreshold: 1.5, // Price moved <1.5%
        };

      case 'crypto-predictor':
        return {
          minPositiveReturn: 3.0, // 3% return (more volatile)
          minNegativeReturn: 5.0, // 5% loss
          holdThreshold: 3.0, // Price moved <3%
        };

      case 'market-predictor':
        return {
          minPositiveReturn: 5.0, // Higher threshold for prediction markets
          minNegativeReturn: 10.0,
          holdThreshold: 5.0,
        };

      default:
        return {
          minPositiveReturn: 2.0,
          minNegativeReturn: 3.0,
          holdThreshold: 2.0,
        };
    }
  }

  /**
   * Generate evaluation notes.
   */
  private generateEvaluationNotes(
    recommendation: Recommendation,
    outcome: OutcomeClassification,
    actualReturn: number | null,
    benchmarkReturn: number | null,
  ): string {
    const returnStr =
      actualReturn !== null ? `${actualReturn.toFixed(2)}%` : 'N/A';
    const benchmarkStr =
      benchmarkReturn !== null ? `${benchmarkReturn.toFixed(2)}%` : 'N/A';

    return `Action: ${recommendation.action}, Confidence: ${(recommendation.confidence * 100).toFixed(0)}%, Return: ${returnStr}, Benchmark: ${benchmarkStr}, Outcome: ${outcome}`;
  }

  /**
   * Store an outcome in the database.
   */
  async storeOutcome(result: OutcomeEvaluationResult): Promise<string> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.outcomes')
      .insert({
        recommendation_id: result.recommendationId,
        instrument: result.instrument,
        outcome: result.outcome,
        actual_return_percent: result.actualReturnPercent,
        benchmark_return_percent: result.benchmarkReturnPercent,
        entry_price: result.entryPrice,
        exit_price: result.exitPrice,
        entry_timestamp: result.entryTimestamp,
        exit_timestamp: result.exitTimestamp,
        evaluation_method: result.evaluationMethod,
        evaluation_notes: result.evaluationNotes,
        resolution_value: result.resolutionValue,
        resolution_timestamp: result.resolutionTimestamp,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`Failed to store outcome: ${error.message}`);
      throw new Error(`Failed to store outcome: ${error.message}`);
    }

    this.logger.debug(
      `Stored outcome ${data.id} for ${result.recommendationId}`,
    );
    return data.id;
  }

  /**
   * Get pending recommendations that need evaluation.
   *
   * @param predictionAgentId - Agent to get recommendations for
   * @param olderThanHours - Only get recommendations older than this
   * @returns Array of recommendations needing evaluation
   */
  async getPendingEvaluations(
    predictionAgentId: string,
    olderThanHours: number = 24,
  ): Promise<Recommendation[]> {
    const client = this.supabaseService.getServiceClient();
    const cutoff = new Date(
      Date.now() - olderThanHours * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await client
      .from('predictions.recommendations')
      .select('*')
      .eq('prediction_agent_id', predictionAgentId)
      .eq('status', 'active')
      .lt('created_at', cutoff)
      .not('id', 'in', `(SELECT recommendation_id FROM predictions.outcomes)`);

    if (error) {
      this.logger.error(`Failed to get pending evaluations: ${error.message}`);
      throw new Error(`Failed to get pending evaluations: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      instrument: row.instrument,
      action: row.action as RecommendationAction,
      confidence: row.confidence,
      sizing: row.sizing,
      rationale: row.rationale,
      timingWindow: row.timing_window,
      entryStyle: row.entry_style,
      targetPrice: row.target_price,
      evidence: row.evidence || [],
    }));
  }
}
