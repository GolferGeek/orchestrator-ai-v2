/**
 * DefaultClaimProcessor Implementation
 *
 * Default implementation of the ClaimProcessor interface.
 * Handles grouping, enriching, and filtering claims for the prediction pipeline.
 *
 * Uses existing services:
 * - PredictionDbService for historical claim retrieval (to be created)
 * - ObservabilityEventsService for emitting observability events
 * - No LLM calls in pre-filter stage - this is rule-based only
 *
 * NOTE: This is the pre-filter stage. LLM calls happen in triage/specialists/evaluators.
 *
 * @module default-claim-processor
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from '@/observability/observability-events.service';
import {
  IClaimProcessor,
  ClaimProcessorConfig,
  DEFAULT_CLAIM_PROCESSOR_CONFIG,
} from './claim-processor.interface';
import {
  Claim,
  ClaimBundle,
  EnrichedClaimBundle,
  ClaimsDiff,
  Datapoint,
  PreFilterThresholds,
} from './base-prediction.types';

@Injectable()
export class DefaultClaimProcessor implements IClaimProcessor {
  private readonly logger = new Logger(DefaultClaimProcessor.name);
  private readonly config: ClaimProcessorConfig;

  constructor(
    @Optional()
    @Inject(ObservabilityEventsService)
    private readonly observabilityService?: ObservabilityEventsService,
    config?: Partial<ClaimProcessorConfig>,
  ) {
    this.config = {
      ...DEFAULT_CLAIM_PROCESSOR_CONFIG,
      ...config,
    };
  }

  /**
   * Emit an observability event for claim processing operations.
   * Non-blocking - failures are logged but don't throw.
   */
  private emitObservabilityEvent(
    context: ExecutionContext,
    eventType: string,
    message: string,
    payload?: Record<string, unknown>,
  ): void {
    if (!this.observabilityService) return;

    try {
      const event: ObservabilityEventRecord = {
        context,
        source_app: 'prediction-runner',
        hook_event_type: eventType,
        status: eventType,
        message,
        progress: null,
        step: 'claim-processor',
        payload: payload ?? {},
        timestamp: Date.now(),
      };

      void this.observabilityService.push(event);
    } catch (error) {
      this.logger.debug(
        `Failed to emit observability event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Group claims from a datapoint by instrument.
   */
  groupClaims(datapoint: Datapoint): ClaimBundle[] {
    const bundleMap = new Map<string, ClaimBundle>();

    for (const claim of datapoint.allClaims) {
      const existing = bundleMap.get(claim.instrument);

      if (existing) {
        existing.currentClaims.push(claim);
      } else {
        bundleMap.set(claim.instrument, {
          instrument: claim.instrument,
          currentClaims: [claim],
          sources: [],
        });
      }
    }

    // Add sources to each bundle
    for (const source of datapoint.sources) {
      const instrumentsInSource = new Set(
        source.claims.map((c) => c.instrument),
      );

      for (const instrument of instrumentsInSource) {
        const bundle = bundleMap.get(instrument);
        if (bundle && !bundle.sources.includes(source.tool)) {
          bundle.sources.push(source.tool);
        }
      }
    }

    const bundles = Array.from(bundleMap.values());
    this.logger.debug(
      `Grouped ${datapoint.allClaims.length} claims into ${bundles.length} bundles`,
    );

    return bundles;
  }

  /**
   * Enrich claim bundles with historical context.
   *
   * NOTE: This is a stub implementation. The actual implementation will
   * use PredictionDbService to fetch historical claims from the database.
   */
  // Note: This is intentionally not async until DB integration is added
  // eslint-disable-next-line @typescript-eslint/require-await
  async enrichWithHistory(
    bundles: ClaimBundle[],
    _agentId: string,
    lookbackHours: number,
  ): Promise<EnrichedClaimBundle[]> {
    const enrichedBundles: EnrichedClaimBundle[] = [];

    for (const bundle of bundles) {
      // TODO: Replace with actual DB call via PredictionDbService
      // const historicalClaims = await this.predictionDb.getClaimsForInstrument(
      //   _agentId,
      //   bundle.instrument,
      //   lookbackHours
      // );
      const historicalClaims: Claim[] = []; // Stub - will be replaced

      const claimsDiff = this.calculateClaimsDiff(
        bundle.currentClaims,
        historicalClaims,
      );

      enrichedBundles.push({
        ...bundle,
        historicalClaims,
        claimsDiff,
        shouldProceed: false, // Will be set by shouldProceedToSpecialists
        proceedReason: undefined,
      });
    }

    this.logger.debug(
      `Enriched ${bundles.length} bundles with historical context (lookback: ${lookbackHours}h)`,
    );

    return enrichedBundles;
  }

  /**
   * Determine if a bundle should proceed to specialist analysis.
   * This is rule-based pre-filtering - no LLM calls.
   */
  shouldProceedToSpecialists(
    bundle: EnrichedClaimBundle,
    thresholds: PreFilterThresholds,
  ): EnrichedClaimBundle {
    const reasons: string[] = [];
    let shouldProceed = false;

    // Check significance score threshold
    if (
      bundle.claimsDiff.significanceScore >= thresholds.minSignificanceScore
    ) {
      shouldProceed = true;
      reasons.push(
        `Significance score ${bundle.claimsDiff.significanceScore.toFixed(2)} >= ${thresholds.minSignificanceScore}`,
      );
    }

    // Check price change threshold
    const priceChange = this.findPriceChange(bundle);
    if (
      priceChange !== null &&
      Math.abs(priceChange) >= thresholds.minPriceChangePercent
    ) {
      shouldProceed = true;
      reasons.push(
        `Price change ${priceChange.toFixed(2)}% >= ${thresholds.minPriceChangePercent}%`,
      );
    }

    // Check sentiment shift threshold
    const sentimentShift = this.findSentimentShift(bundle);
    if (
      sentimentShift !== null &&
      Math.abs(sentimentShift) >= thresholds.minSentimentShift
    ) {
      shouldProceed = true;
      reasons.push(
        `Sentiment shift ${sentimentShift.toFixed(2)} >= ${thresholds.minSentimentShift}`,
      );
    }

    // Check for new significant claims
    if (bundle.claimsDiff.newClaims.length > 0) {
      const significantNewClaims = bundle.claimsDiff.newClaims.filter(
        (c) => c.type === 'event' || c.type === 'news' || c.type === 'filing',
      );
      if (significantNewClaims.length > 0) {
        shouldProceed = true;
        reasons.push(
          `${significantNewClaims.length} new significant claims (events/news/filings)`,
        );
      }
    }

    // Check custom thresholds
    if (thresholds.custom) {
      for (const [key, threshold] of Object.entries(thresholds.custom)) {
        const customValue = this.findCustomMetric(bundle, key);
        if (customValue !== null && Math.abs(customValue) >= threshold) {
          shouldProceed = true;
          reasons.push(`Custom metric ${key}: ${customValue} >= ${threshold}`);
        }
      }
    }

    const proceedReason = shouldProceed
      ? reasons.join('; ')
      : `No thresholds met (sig=${bundle.claimsDiff.significanceScore.toFixed(2)}, price=${priceChange?.toFixed(2) || 'N/A'}%, sentiment=${sentimentShift?.toFixed(2) || 'N/A'})`;

    this.logger.debug(
      `Pre-filter for ${bundle.instrument}: ${shouldProceed ? 'PROCEED' : 'SKIP'} - ${proceedReason}`,
    );

    return {
      ...bundle,
      shouldProceed,
      proceedReason,
    };
  }

  /**
   * Calculate the diff between current and historical claims.
   */
  calculateClaimsDiff(
    currentClaims: Claim[],
    historicalClaims: Claim[],
  ): ClaimsDiff {
    const newClaims: Claim[] = [];
    const changedClaims: ClaimsDiff['changedClaims'] = [];
    const removedClaims: Claim[] = [];

    // Build a map of historical claims by type+instrument for comparison
    const historicalMap = new Map<string, Claim>();
    for (const claim of historicalClaims) {
      const key = `${claim.type}:${claim.instrument}`;
      // Keep the most recent historical claim for each type
      const existing = historicalMap.get(key);
      if (!existing || claim.timestamp > existing.timestamp) {
        historicalMap.set(key, claim);
      }
    }

    // Compare current claims to historical
    const currentKeys = new Set<string>();
    for (const claim of currentClaims) {
      const key = `${claim.type}:${claim.instrument}`;
      currentKeys.add(key);

      const historical = historicalMap.get(key);
      if (!historical) {
        newClaims.push(claim);
      } else if (this.claimValueChanged(claim, historical)) {
        const changePercent = this.calculateChangePercent(claim, historical);
        changedClaims.push({
          claim,
          previousValue: historical.value,
          changePercent,
        });
      }
    }

    // Find removed claims
    for (const [key, claim] of historicalMap) {
      if (!currentKeys.has(key)) {
        removedClaims.push(claim);
      }
    }

    // Calculate overall significance score
    const significanceScore = this.calculateSignificanceScore(
      newClaims,
      changedClaims,
      removedClaims,
    );

    return {
      newClaims,
      changedClaims,
      removedClaims,
      significanceScore,
    };
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private claimValueChanged(current: Claim, historical: Claim): boolean {
    if (typeof current.value !== typeof historical.value) {
      return true;
    }

    if (typeof current.value === 'number') {
      // For numeric values, check if change is > 0.01%
      const percentChange =
        Math.abs(
          (current.value - (historical.value as number)) /
            (historical.value as number),
        ) * 100;
      return percentChange > 0.01;
    }

    return current.value !== historical.value;
  }

  private calculateChangePercent(
    current: Claim,
    historical: Claim,
  ): number | undefined {
    if (
      typeof current.value === 'number' &&
      typeof historical.value === 'number' &&
      historical.value !== 0
    ) {
      return ((current.value - historical.value) / historical.value) * 100;
    }
    return undefined;
  }

  private calculateSignificanceScore(
    newClaims: Claim[],
    changedClaims: ClaimsDiff['changedClaims'],
    _removedClaims: Claim[], // Future: may factor in removed claims
  ): number {
    const weights = this.config.significanceWeights;
    let score = 0;

    // New claims contribution
    score += Math.min(newClaims.length * 0.1, weights.newClaims);

    // Changed claims contribution (weighted by change magnitude)
    for (const changed of changedClaims) {
      if (changed.changePercent !== undefined) {
        if (changed.claim.type === 'price' || changed.claim.type === 'close') {
          score += Math.min(
            Math.abs(changed.changePercent) * 0.05,
            weights.priceChange,
          );
        } else if (changed.claim.type === 'volume') {
          score += Math.min(
            Math.abs(changed.changePercent) * 0.02,
            weights.volumeChange,
          );
        } else if (
          changed.claim.type === 'sentiment' ||
          changed.claim.type === 'sentiment_score'
        ) {
          score += Math.min(
            Math.abs(changed.changePercent) * 0.1,
            weights.sentimentShift,
          );
        }
      }
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  private findPriceChange(bundle: EnrichedClaimBundle): number | null {
    const priceChangeClaim = bundle.claimsDiff.changedClaims.find(
      (c) =>
        c.claim.type === 'price' ||
        c.claim.type === 'close' ||
        c.claim.type === 'change_percent',
    );

    if (priceChangeClaim?.changePercent !== undefined) {
      return priceChangeClaim.changePercent;
    }

    // Check for explicit change_percent claim
    const changeClaim = bundle.currentClaims.find(
      (c) => c.type === 'change_percent',
    );
    if (changeClaim && typeof changeClaim.value === 'number') {
      return changeClaim.value;
    }

    return null;
  }

  private findSentimentShift(bundle: EnrichedClaimBundle): number | null {
    const sentimentChangeClaim = bundle.claimsDiff.changedClaims.find(
      (c) => c.claim.type === 'sentiment' || c.claim.type === 'sentiment_score',
    );

    if (sentimentChangeClaim?.changePercent !== undefined) {
      return sentimentChangeClaim.changePercent;
    }

    return null;
  }

  private findCustomMetric(
    bundle: EnrichedClaimBundle,
    metricKey: string,
  ): number | null {
    // Look for a claim that matches the custom metric key
    const claim = bundle.currentClaims.find(
      (c) => c.type === metricKey || c.metadata?.[metricKey] !== undefined,
    );

    if (claim && typeof claim.value === 'number') {
      return claim.value;
    }

    return null;
  }
}
