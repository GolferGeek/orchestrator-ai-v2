/**
 * Missed Opportunity Service
 *
 * Detects and analyzes significant market moves that the agent didn't predict or act on.
 * Used to improve pre-filter thresholds and specialist sensitivity.
 *
 * @module missed-opportunity.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/require-await */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import { LLMGenerationService } from '../../../../../llms/services/llm-generation.service';
import type { ExecutionContext as _ExecutionContext } from '@orchestrator-ai/transport-types';
import { Claim, PreFilterThresholds } from '../base-prediction.types';

/**
 * Types of missed opportunities
 */
export type MissedOpportunityType =
  | 'price_move'
  | 'news_event'
  | 'earnings_surprise'
  | 'market_shift';

/**
 * Reasons why we failed to detect the opportunity
 */
export type DetectionFailureReason =
  | 'below_threshold'
  | 'no_data'
  | 'filtered_out'
  | 'specialist_disagreement'
  | 'evaluator_rejected';

/**
 * Missed opportunity record
 */
export interface MissedOpportunity {
  id?: string;
  predictionAgentId: string;
  instrument: string;
  missedType: MissedOpportunityType;
  description: string;
  moveStartTimestamp: string;
  moveEndTimestamp: string | null;
  startPrice: number | null;
  endPrice: number | null;
  movePercent: number;
  detectionFailureReason: DetectionFailureReason;
  availableSignals: Array<{
    source: string;
    signal: string;
    value: number | string;
  }>;
  signalAnalysis: string | null;
  whatWouldHaveHelped: string[];
  preFilterResult: {
    priceChange: number;
    threshold: number;
    wouldHavePassed: boolean;
  } | null;
  suggestedThresholdChanges: Record<string, number>;
  appliedToContext: boolean;
  appliedAt: string | null;
}

/**
 * Price move detection result
 */
interface DetectedMove {
  instrument: string;
  startPrice: number;
  endPrice: number;
  movePercent: number;
  startTimestamp: string;
  endTimestamp: string;
}

@Injectable()
export class MissedOpportunityService {
  private readonly logger = new Logger(MissedOpportunityService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly llmService: LLMGenerationService,
  ) {}

  /**
   * Detect missed opportunities by comparing significant moves to recommendations.
   *
   * @param predictionAgentId - Agent to check
   * @param instrument - Instrument to check
   * @param priceHistory - Recent price claims
   * @param thresholds - Current pre-filter thresholds
   * @param lookbackHours - How far back to check
   * @returns Array of missed opportunities
   */
  async detectMissedOpportunities(
    predictionAgentId: string,
    instrument: string,
    priceHistory: Claim[],
    thresholds: PreFilterThresholds,
    lookbackHours: number = 24,
  ): Promise<MissedOpportunity[]> {
    this.logger.debug(
      `Detecting missed opportunities for ${instrument} (lookback: ${lookbackHours}h)`,
    );

    // Find significant price moves in the history
    const significantMoves = this.findSignificantMoves(
      priceHistory,
      thresholds.minPriceChangePercent,
    );

    if (significantMoves.length === 0) {
      this.logger.debug(`No significant moves found for ${instrument}`);
      return [];
    }

    // Check which moves we didn't act on
    const missedMoves = await this.filterMissedMoves(
      predictionAgentId,
      instrument,
      significantMoves,
    );

    // Analyze why we missed each one
    const opportunities: MissedOpportunity[] = [];
    for (const move of missedMoves) {
      const opportunity = await this.analyzeWhyMissed(
        predictionAgentId,
        instrument,
        move,
        priceHistory,
        thresholds,
      );
      opportunities.push(opportunity);
    }

    // Store missed opportunities
    for (const opp of opportunities) {
      const id = await this.storeMissedOpportunity(opp);
      opp.id = id;
    }

    this.logger.debug(
      `Detected ${opportunities.length} missed opportunities for ${instrument}`,
    );
    return opportunities;
  }

  /**
   * Find significant price moves in the price history.
   */
  private findSignificantMoves(
    priceHistory: Claim[],
    minMovePercent: number,
  ): DetectedMove[] {
    const moves: DetectedMove[] = [];

    // Sort by timestamp
    const sortedPrices = priceHistory
      .filter((c) => c.type === 'price' || c.type === 'close')
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    if (sortedPrices.length < 2) {
      return moves;
    }

    // Find local min/max points and calculate moves
    const firstPrice = sortedPrices[0]!;
    let localMin = firstPrice;
    let localMax = firstPrice;

    for (let i = 1; i < sortedPrices.length; i++) {
      const current = sortedPrices[i]!;
      const currentPrice = current.value as number;
      const minPrice = localMin.value as number;
      const maxPrice = localMax.value as number;

      // Check for significant upward move from local min
      const upMove = ((currentPrice - minPrice) / minPrice) * 100;
      if (upMove >= minMovePercent) {
        moves.push({
          instrument: current.instrument,
          startPrice: minPrice,
          endPrice: currentPrice,
          movePercent: upMove,
          startTimestamp: localMin.timestamp,
          endTimestamp: current.timestamp,
        });
        localMin = current; // Reset
      }

      // Check for significant downward move from local max
      const downMove = ((maxPrice - currentPrice) / maxPrice) * 100;
      if (downMove >= minMovePercent) {
        moves.push({
          instrument: current.instrument,
          startPrice: maxPrice,
          endPrice: currentPrice,
          movePercent: -downMove,
          startTimestamp: localMax.timestamp,
          endTimestamp: current.timestamp,
        });
        localMax = current; // Reset
      }

      // Update local min/max
      if (currentPrice < minPrice) localMin = current;
      if (currentPrice > maxPrice) localMax = current;
    }

    return moves;
  }

  /**
   * Filter moves to only those we didn't act on.
   */
  private async filterMissedMoves(
    predictionAgentId: string,
    instrument: string,
    moves: DetectedMove[],
  ): Promise<DetectedMove[]> {
    const client = this.supabaseService.getServiceClient();

    const missedMoves: DetectedMove[] = [];

    for (const move of moves) {
      // Check if we had a recommendation during this move period
      const { data } = await client
        .from('predictions.recommendations')
        .select('id, action')
        .eq('prediction_agent_id', predictionAgentId)
        .eq('instrument', instrument)
        .gte('created_at', move.startTimestamp)
        .lte('created_at', move.endTimestamp)
        .limit(1);

      if (!data || data.length === 0) {
        // No recommendation during this period - missed opportunity
        missedMoves.push(move);
      } else {
        // Had a recommendation - check if it was in the right direction
        const rec = data[0]!;
        const moveUp = move.movePercent > 0;
        const correctAction =
          (moveUp && (rec.action === 'buy' || rec.action === 'accumulate')) ||
          (!moveUp && (rec.action === 'sell' || rec.action === 'reduce'));

        if (!correctAction) {
          // Had wrong recommendation - also a missed opportunity
          missedMoves.push(move);
        }
      }
    }

    return missedMoves;
  }

  /**
   * Analyze why we missed a specific opportunity.
   */
  private async analyzeWhyMissed(
    predictionAgentId: string,
    instrument: string,
    move: DetectedMove,
    priceHistory: Claim[],
    thresholds: PreFilterThresholds,
  ): Promise<MissedOpportunity> {
    // Find what signals we had at the start of the move
    const signalsAtStart = priceHistory
      .filter(
        (c) =>
          new Date(c.timestamp).getTime() <=
            new Date(move.startTimestamp).getTime() + 3600000 && // Within 1 hour
          c.instrument === instrument,
      )
      .slice(-10); // Last 10 claims

    // Extract available signals
    const availableSignals = signalsAtStart.map((c) => ({
      source: 'price-history',
      signal: c.type as string,
      value: typeof c.value === 'boolean' ? String(c.value) : c.value,
    }));

    // Determine why we failed to detect
    let detectionFailureReason: DetectionFailureReason = 'below_threshold';
    const priceChange = Math.abs(move.movePercent);

    // Check pre-filter result
    const wouldHavePassed = priceChange >= thresholds.minPriceChangePercent;
    const preFilterResult = {
      priceChange,
      threshold: thresholds.minPriceChangePercent,
      wouldHavePassed,
    };

    if (!wouldHavePassed) {
      detectionFailureReason = 'below_threshold';
    } else if (signalsAtStart.length === 0) {
      detectionFailureReason = 'no_data';
    } else {
      detectionFailureReason = 'filtered_out';
    }

    // Suggest threshold changes
    const suggestedThresholdChanges: Record<string, number> = {};
    if (priceChange < thresholds.minPriceChangePercent * 1.5) {
      // Move was significant but below our threshold
      suggestedThresholdChanges['minPriceChangePercent'] = Math.max(
        priceChange * 0.8, // Set threshold to 80% of this move
        1.0, // But not lower than 1%
      );
    }

    // Determine what would have helped
    const whatWouldHaveHelped: string[] = [];
    if (detectionFailureReason === 'below_threshold') {
      whatWouldHaveHelped.push(
        `Lower pre-filter threshold from ${thresholds.minPriceChangePercent}% to ${(priceChange * 0.8).toFixed(1)}%`,
      );
    }
    if (signalsAtStart.length < 3) {
      whatWouldHaveHelped.push('More frequent data polling');
      whatWouldHaveHelped.push('Additional data sources for this instrument');
    }

    const missedType: MissedOpportunityType =
      Math.abs(move.movePercent) > 10 ? 'price_move' : 'price_move';

    return {
      predictionAgentId,
      instrument,
      missedType,
      description: `${move.movePercent > 0 ? 'Upward' : 'Downward'} move of ${Math.abs(move.movePercent).toFixed(2)}% not acted upon`,
      moveStartTimestamp: move.startTimestamp,
      moveEndTimestamp: move.endTimestamp,
      startPrice: move.startPrice,
      endPrice: move.endPrice,
      movePercent: move.movePercent,
      detectionFailureReason,
      availableSignals,
      signalAnalysis: null,
      whatWouldHaveHelped,
      preFilterResult,
      suggestedThresholdChanges,
      appliedToContext: false,
      appliedAt: null,
    };
  }

  /**
   * Store a missed opportunity in the database.
   */
  private async storeMissedOpportunity(
    opportunity: MissedOpportunity,
  ): Promise<string> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.missed_opportunities')
      .insert({
        prediction_agent_id: opportunity.predictionAgentId,
        instrument: opportunity.instrument,
        missed_type: opportunity.missedType,
        description: opportunity.description,
        move_start_timestamp: opportunity.moveStartTimestamp,
        move_end_timestamp: opportunity.moveEndTimestamp,
        start_price: opportunity.startPrice,
        end_price: opportunity.endPrice,
        move_percent: opportunity.movePercent,
        detection_failure_reason: opportunity.detectionFailureReason,
        available_signals: opportunity.availableSignals,
        signal_analysis: opportunity.signalAnalysis,
        what_would_have_helped: opportunity.whatWouldHaveHelped,
        pre_filter_result: opportunity.preFilterResult,
        suggested_threshold_changes: opportunity.suggestedThresholdChanges,
        applied_to_context: false,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`Failed to store missed opportunity: ${error.message}`);
      throw new Error(`Failed to store missed opportunity: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get missed opportunities for an agent.
   */
  async getMissedOpportunities(
    predictionAgentId: string,
    instrument: string | null = null,
    minMovePercent: number = 5.0,
    limit: number = 10,
  ): Promise<MissedOpportunity[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_missed_opportunities', {
      p_prediction_agent_id: predictionAgentId,
      p_instrument: instrument,
      p_min_move_percent: minMovePercent,
      p_limit: limit,
    });

    if (error) {
      this.logger.error(`Failed to get missed opportunities: ${error.message}`);
      throw new Error(`Failed to get missed opportunities: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.missed_id as string,
      predictionAgentId,
      instrument: row.instrument as string,
      missedType: row.missed_type as MissedOpportunityType,
      description: row.description as string,
      moveStartTimestamp: '',
      moveEndTimestamp: null,
      startPrice: null,
      endPrice: null,
      movePercent: row.move_percent as number,
      detectionFailureReason:
        row.detection_failure_reason as DetectionFailureReason,
      availableSignals: [],
      signalAnalysis: null,
      whatWouldHaveHelped: (row.what_would_have_helped || []) as string[],
      preFilterResult: null,
      suggestedThresholdChanges: (row.suggested_threshold_changes ||
        {}) as Record<string, number>,
      appliedToContext: row.applied_to_context as boolean,
      appliedAt: null,
    }));
  }

  /**
   * Mark a missed opportunity as applied to context.
   */
  async markAsApplied(opportunityId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('predictions.missed_opportunities')
      .update({
        applied_to_context: true,
        applied_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);

    if (error) {
      this.logger.error(
        `Failed to mark missed opportunity as applied: ${error.message}`,
      );
      throw new Error(
        `Failed to mark missed opportunity as applied: ${error.message}`,
      );
    }

    this.logger.debug(`Marked missed opportunity ${opportunityId} as applied`);
  }
}
