/**
 * Prediction Database Service
 *
 * Handles all database operations for the prediction runner system.
 * Stores datapoints, triage results, specialist analyses, and recommendations
 * in the predictions schema.
 *
 * SCHEMA NOTES:
 * - The predictions schema may not exist yet (created in Phase 2)
 * - Currently using JSONB columns for flexibility
 * - Tables: prediction_datapoints, prediction_triage, prediction_specialists, prediction_recommendations
 *
 * @module prediction-db.service
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import {
  Datapoint,
  Claim,
  ClaimsDiff,
  TriageResult,
  SpecialistAnalysis,
  Recommendation,
  Source,
  DatapointMetadata,
} from '../base-prediction.types';

/**
 * Database row type for prediction_datapoints table
 */
interface DatapointRow {
  id: string;
  agent_id: string;
  timestamp: string;
  sources: Source[];
  all_claims: Claim[];
  instruments: string[];
  metadata: DatapointMetadata;
}

@Injectable()
export class PredictionDbService {
  private readonly logger = new Logger(PredictionDbService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Store a datapoint to the predictions schema.
   * Datapoints contain all sources and claims from a single poll cycle.
   *
   * @param datapoint - The datapoint to store
   */
  async storeDatapoint(datapoint: Datapoint): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { error } = await client.from('prediction_datapoints').insert({
        id: datapoint.id,
        agent_id: datapoint.agentId,
        timestamp: datapoint.timestamp,
        sources: datapoint.sources,
        all_claims: datapoint.allClaims,
        instruments: datapoint.instruments,
        metadata: datapoint.metadata,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(
          `Failed to store datapoint ${datapoint.id}: ${error.message}`,
        );
        throw new Error(`Failed to store datapoint: ${error.message}`);
      }

      this.logger.debug(
        `Stored datapoint ${datapoint.id} for agent ${datapoint.agentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing datapoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get claims for a specific instrument within a lookback window.
   * Used for historical comparison during triage.
   *
   * @param agentId - Agent ID
   * @param instrument - Instrument identifier (e.g., AAPL, BTC-USD)
   * @param lookbackHours - How many hours to look back
   * @returns Array of historical claims
   */
  async getClaimsForInstrument(
    agentId: string,
    instrument: string,
    lookbackHours: number,
  ): Promise<Claim[]> {
    try {
      const client = this.supabaseService.getServiceClient();
      const cutoffTime = new Date(
        Date.now() - lookbackHours * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await client
        .from('prediction_datapoints')
        .select('all_claims')
        .eq('agent_id', agentId)
        .contains('instruments', [instrument])
        .gte('timestamp', cutoffTime)
        .order('timestamp', { ascending: false });

      if (error) {
        this.logger.error(
          `Failed to fetch claims for ${instrument}: ${error.message}`,
        );
        throw new Error(`Failed to fetch claims: ${error.message}`);
      }

      // Flatten all claims from all datapoints
      const claims: Claim[] = [];
      if (data) {
        for (const row of data) {
          const allClaims = row.all_claims as Claim[];
          // Filter to only claims for this instrument
          claims.push(
            ...allClaims.filter((claim) => claim.instrument === instrument),
          );
        }
      }

      this.logger.debug(
        `Found ${claims.length} historical claims for ${instrument} (lookback: ${lookbackHours}h)`,
      );

      return claims;
    } catch (error) {
      this.logger.error(
        `Error fetching claims: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Compare current claims with historical claims to detect changes.
   * This is used during triage to determine significance.
   *
   * @param current - Current claims from poll
   * @param historical - Historical claims from DB
   * @returns ClaimsDiff showing what changed
   */
  getClaimsDiff(current: Claim[], historical: Claim[]): ClaimsDiff {
    const newClaims: Claim[] = [];
    const changedClaims: Array<{
      claim: Claim;
      previousValue: number | string | boolean;
      changePercent?: number;
    }> = [];
    const removedClaims: Claim[] = [];

    // Build a map of historical claims by type
    const historicalMap = new Map<string, Claim>();
    for (const claim of historical) {
      const key = `${claim.type}-${claim.instrument}`;
      // Keep the most recent claim for each type
      if (
        !historicalMap.has(key) ||
        claim.timestamp > historicalMap.get(key)!.timestamp
      ) {
        historicalMap.set(key, claim);
      }
    }

    // Check current claims against historical
    for (const claim of current) {
      const key = `${claim.type}-${claim.instrument}`;
      const historicalClaim = historicalMap.get(key);

      if (!historicalClaim) {
        newClaims.push(claim);
      } else if (historicalClaim.value !== claim.value) {
        const changePercent =
          typeof claim.value === 'number' &&
          typeof historicalClaim.value === 'number'
            ? ((claim.value - historicalClaim.value) / historicalClaim.value) *
              100
            : undefined;

        changedClaims.push({
          claim,
          previousValue: historicalClaim.value,
          changePercent,
        });
      }
    }

    // Find removed claims (in historical but not in current)
    const currentMap = new Map<string, Claim>();
    for (const claim of current) {
      currentMap.set(`${claim.type}-${claim.instrument}`, claim);
    }

    for (const [key, historicalClaim] of historicalMap) {
      if (!currentMap.has(key)) {
        removedClaims.push(historicalClaim);
      }
    }

    // Calculate significance score (0-1)
    // Factors: number of new claims, magnitude of changes, number of changed claims
    let significanceScore = 0;

    // New claims contribute to significance
    significanceScore += Math.min(newClaims.length * 0.1, 0.3);

    // Changed claims contribute based on magnitude
    for (const change of changedClaims) {
      if (change.changePercent !== undefined) {
        const magnitude = Math.min(Math.abs(change.changePercent) / 100, 0.1);
        significanceScore += magnitude;
      } else {
        // Non-numeric changes get a fixed weight
        significanceScore += 0.05;
      }
    }

    // Removed claims contribute slightly
    significanceScore += Math.min(removedClaims.length * 0.05, 0.1);

    // Cap at 1.0
    significanceScore = Math.min(significanceScore, 1.0);

    return {
      newClaims,
      changedClaims,
      removedClaims,
      significanceScore,
    };
  }

  /**
   * Get recent datapoints for a specific instrument.
   * Used for context during specialist analysis.
   *
   * @param agentId - Agent ID
   * @param instrument - Instrument identifier
   * @param limit - Max number of datapoints to return
   * @returns Array of recent datapoints
   */
  async getDatapointsForInstrument(
    agentId: string,
    instrument: string,
    limit: number,
  ): Promise<Datapoint[]> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { data, error } = await client
        .from('prediction_datapoints')
        .select('*')
        .eq('agent_id', agentId)
        .contains('instruments', [instrument])
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error(
          `Failed to fetch datapoints for ${instrument}: ${error.message}`,
        );
        throw new Error(`Failed to fetch datapoints: ${error.message}`);
      }

      const datapoints: Datapoint[] = (data || []).map((row: DatapointRow) => ({
        id: row.id,
        agentId: row.agent_id,
        timestamp: row.timestamp,
        sources: row.sources,
        allClaims: row.all_claims,
        instruments: row.instruments,
        metadata: row.metadata,
      }));

      this.logger.debug(
        `Found ${datapoints.length} datapoints for ${instrument}`,
      );

      return datapoints;
    } catch (error) {
      this.logger.error(
        `Error fetching datapoints: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Store triage result for a datapoint.
   *
   * @param result - Triage result
   * @param datapointId - Associated datapoint ID
   */
  async storeTriageResult(
    result: TriageResult,
    datapointId: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { error } = await client.from('prediction_triage').insert({
        datapoint_id: datapointId,
        instrument: result.instrument,
        proceed: result.proceed,
        urgency: result.urgency,
        specialist_teams: result.specialistTeams,
        rationale: result.rationale,
        votes: result.votes,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(
          `Failed to store triage result for ${result.instrument}: ${error.message}`,
        );
        throw new Error(`Failed to store triage result: ${error.message}`);
      }

      this.logger.debug(
        `Stored triage result for ${result.instrument} (proceed: ${result.proceed})`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing triage result: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Store specialist analysis for a datapoint.
   *
   * @param analysis - Specialist analysis
   * @param datapointId - Associated datapoint ID
   */
  async storeSpecialistAnalysis(
    analysis: SpecialistAnalysis,
    datapointId: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { error } = await client.from('prediction_specialists').insert({
        datapoint_id: datapointId,
        specialist: analysis.specialist,
        instrument: analysis.instrument,
        conclusion: analysis.conclusion,
        confidence: analysis.confidence,
        analysis: analysis.analysis,
        key_claims: analysis.keyClaims,
        suggested_action: analysis.suggestedAction,
        risk_factors: analysis.riskFactors,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(
          `Failed to store specialist analysis for ${analysis.instrument}: ${error.message}`,
        );
        throw new Error(
          `Failed to store specialist analysis: ${error.message}`,
        );
      }

      this.logger.debug(
        `Stored specialist analysis for ${analysis.instrument} by ${analysis.specialist}`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing specialist analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Store a recommendation.
   *
   * @param rec - Recommendation to store
   * @param agentId - Agent that produced this recommendation
   */
  async storeRecommendation(
    rec: Recommendation,
    agentId: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { error } = await client.from('prediction_recommendations').insert({
        id: rec.id,
        agent_id: agentId,
        instrument: rec.instrument,
        action: rec.action,
        confidence: rec.confidence,
        sizing: rec.sizing,
        rationale: rec.rationale,
        timing_window: rec.timingWindow,
        entry_style: rec.entryStyle,
        target_price: rec.targetPrice,
        evidence: rec.evidence,
        created_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error(
          `Failed to store recommendation ${rec.id}: ${error.message}`,
        );
        throw new Error(`Failed to store recommendation: ${error.message}`);
      }

      this.logger.debug(
        `Stored recommendation ${rec.id} for ${rec.instrument} (${rec.action})`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
