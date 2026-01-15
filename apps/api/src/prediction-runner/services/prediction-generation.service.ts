import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { PredictionRepository } from '../repositories/prediction.repository';
import { PortfolioRepository } from '../repositories/portfolio.repository';
import { PredictorManagementService } from './predictor-management.service';
import { SnapshotService } from './snapshot.service';
import { AnalystEnsembleService } from './analyst-ensemble.service';
import { TargetService } from './target.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import {
  Prediction,
  PredictionDirection,
  CreatePredictionData,
} from '../interfaces/prediction.interface';
import { Predictor } from '../interfaces/predictor.interface';
import {
  ThresholdConfig,
  ThresholdEvaluationResult,
  DEFAULT_THRESHOLD_CONFIG,
} from '../interfaces/threshold-evaluation.interface';
import {
  EnsembleInput,
  EnsembleResult,
} from '../interfaces/ensemble.interface';
import { SnapshotBuildInput } from '../interfaces/snapshot.interface';

/**
 * Tier 3: Prediction Generation Service
 *
 * Creates predictions when predictor threshold is met:
 * - Evaluates threshold conditions
 * - Runs final ensemble for prediction parameters
 * - Creates prediction record
 * - Consumes contributing predictors
 * - Creates snapshot for audit trail
 *
 * Prediction includes:
 * - Direction (up/down/flat)
 * - Magnitude estimate
 * - Time horizon
 * - Confidence level
 */
@Injectable()
export class PredictionGenerationService {
  private readonly logger = new Logger(PredictionGenerationService.name);

  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly portfolioRepository: PortfolioRepository,
    private readonly predictorManagementService: PredictorManagementService,
    private readonly snapshotService: SnapshotService,
    private readonly ensembleService: AnalystEnsembleService,
    private readonly targetService: TargetService,
    private readonly observabilityEventsService: ObservabilityEventsService,
  ) {}

  /**
   * Attempt to generate a prediction for a target
   * Returns null if threshold not met or if an active prediction already exists
   */
  async attemptPredictionGeneration(
    ctx: ExecutionContext,
    targetId: string,
    config?: ThresholdConfig,
  ): Promise<Prediction | null> {
    const effectiveConfig = { ...DEFAULT_THRESHOLD_CONFIG, ...config };

    this.logger.log(`Attempting prediction generation for target: ${targetId}`);

    // Check for existing active prediction - prevent duplicates
    const existingPredictions = await this.predictionRepository.findByTarget(
      targetId,
      'active',
    );
    if (existingPredictions.length > 0) {
      this.logger.debug(
        `Skipping prediction generation for ${targetId}: ` +
          `${existingPredictions.length} active prediction(s) already exist`,
      );
      return null;
    }

    // Evaluate threshold
    const thresholdResult =
      await this.predictorManagementService.evaluateThreshold(
        targetId,
        effectiveConfig,
      );

    if (!thresholdResult.meetsThreshold) {
      this.logger.debug(
        `Threshold not met for ${targetId}: ` +
          `active=${thresholdResult.activeCount}, ` +
          `strength=${thresholdResult.combinedStrength}, ` +
          `consensus=${thresholdResult.directionConsensus.toFixed(2)}`,
      );
      return null;
    }

    // Threshold met - generate prediction
    return this.generatePrediction(
      ctx,
      targetId,
      thresholdResult,
      effectiveConfig,
    );
  }

  /**
   * Generate a prediction (called when threshold is confirmed met)
   */
  async generatePrediction(
    ctx: ExecutionContext,
    targetId: string,
    thresholdResult: ThresholdEvaluationResult,
    _config: ThresholdConfig,
  ): Promise<Prediction> {
    this.logger.log(`Generating prediction for target: ${targetId}`);

    const target = await this.targetService.findByIdOrThrow(targetId);

    // Get active predictors (will be consumed)
    const predictors =
      await this.predictorManagementService.getActivePredictors(targetId);

    // Run final ensemble evaluation for prediction parameters
    const ensembleInput: EnsembleInput = {
      targetId,
      content: this.buildPredictionContext(predictors, thresholdResult),
      direction: thresholdResult.dominantDirection,
    };

    const ensembleResult = await this.ensembleService.runEnsemble(
      ctx,
      target,
      ensembleInput,
    );

    // Map direction from predictor to prediction vocabulary
    const direction = this.mapPredictorToPredictonDirection(
      thresholdResult.dominantDirection,
    );

    // Calculate prediction parameters
    const magnitude = this.estimateMagnitude(predictors, ensembleResult);
    const horizonHours = this.determineHorizon(predictors);
    const confidence = this.calculateFinalConfidence(
      thresholdResult,
      ensembleResult,
    );

    // Create prediction record
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + horizonHours);

    // Convert numeric magnitude to categorical
    const magnitudeCategory = this.categorizeMagnitude(magnitude);

    // Capture context versions for traceability
    const contextVersions = await this.captureContextVersions(
      target.universe_id,
      targetId,
      ensembleResult,
    );

    // Calculate recommended position sizing
    const positionSizing = await this.calculateRecommendedPositionSize(
      ctx,
      target,
      direction,
      confidence,
      magnitude,
    );

    const predictionData: CreatePredictionData = {
      target_id: targetId,
      direction,
      magnitude: magnitudeCategory,
      confidence,
      timeframe_hours: horizonHours,
      expires_at: expiresAt.toISOString(),
      reasoning: ensembleResult.aggregated.reasoning,
      analyst_ensemble: {
        predictor_count: predictors.length,
        combined_strength: thresholdResult.combinedStrength,
        direction_consensus: thresholdResult.directionConsensus,
      },
      llm_ensemble: {
        direction: ensembleResult.aggregated.direction,
        confidence: ensembleResult.aggregated.confidence,
        consensus_strength: ensembleResult.aggregated.consensus_strength,
      },
      status: 'active',
      // Context version traceability
      runner_context_version_id: contextVersions.runnerContextVersionId,
      analyst_context_version_ids: contextVersions.analystContextVersionIds,
      universe_context_version_id: contextVersions.universeContextVersionId,
      target_context_version_id: contextVersions.targetContextVersionId,
      // Position sizing recommendation
      recommended_quantity: positionSizing.quantity,
      quantity_reasoning: positionSizing.reasoning,
    };

    const prediction = await this.predictionRepository.create(predictionData);

    this.logger.log(
      `Created prediction ${prediction.id} for ${target.symbol}: ` +
        `${direction} ${magnitude.toFixed(1)}% over ${horizonHours}h ` +
        `(confidence: ${(confidence * 100).toFixed(0)}%)`,
    );

    // Consume predictors
    await this.predictorManagementService.consumePredictors(
      targetId,
      prediction.id,
    );

    // Create snapshot for audit trail
    await this.createPredictionSnapshot(
      prediction,
      predictors,
      thresholdResult,
      ensembleResult,
    );

    // Emit prediction.created event for observability
    await this.observabilityEventsService.push({
      context: ctx,
      source_app: 'prediction-runner',
      hook_event_type: 'prediction.created',
      status: 'created',
      message: `Prediction created: ${target.symbol} ${direction} ${magnitudeCategory} (${(confidence * 100).toFixed(0)}% confidence)`,
      progress: null,
      step: 'prediction-created',
      payload: {
        predictionId: prediction.id,
        targetId,
        targetSymbol: target.symbol,
        direction,
        magnitude: magnitudeCategory,
        magnitudePercent: magnitude,
        confidence,
        timeframeHours: horizonHours,
        expiresAt: expiresAt.toISOString(),
        predictorCount: predictors.length,
        combinedStrength: thresholdResult.combinedStrength,
        directionConsensus: thresholdResult.directionConsensus,
      },
      timestamp: Date.now(),
    });

    return prediction;
  }

  /**
   * Build context string from predictors for final ensemble
   */
  private buildPredictionContext(
    predictors: Predictor[],
    threshold: ThresholdEvaluationResult,
  ): string {
    const parts = [
      `Prediction Generation Context`,
      `Active Predictors: ${predictors.length}`,
      `Combined Strength: ${threshold.combinedStrength}`,
      `Direction Consensus: ${(threshold.directionConsensus * 100).toFixed(0)}%`,
      `Dominant Direction: ${threshold.dominantDirection}`,
      '',
      'Contributing Predictors:',
    ];

    for (const p of predictors) {
      parts.push(
        `- ${p.direction} (strength: ${p.strength}, confidence: ${(p.confidence * 100).toFixed(0)}%)`,
      );
      if (p.reasoning) {
        parts.push(`  Reasoning: ${p.reasoning}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Map predictor direction vocabulary to prediction direction
   * Predictor: bullish/bearish/neutral
   * Prediction: up/down/flat
   */
  private mapPredictorToPredictonDirection(
    direction: 'bullish' | 'bearish' | 'neutral',
  ): PredictionDirection {
    switch (direction) {
      case 'bullish':
        return 'up';
      case 'bearish':
        return 'down';
      case 'neutral':
        return 'flat';
    }
  }

  /**
   * Estimate magnitude based on predictor strengths and ensemble confidence
   */
  private estimateMagnitude(
    predictors: Predictor[],
    ensemble: EnsembleResult,
  ): number {
    // Base magnitude from average predictor strength
    const avgStrength =
      predictors.reduce((sum, p) => sum + p.strength, 0) / predictors.length;

    // Scale by ensemble confidence
    // Max magnitude ~10% for perfect confidence and strength
    const baseMagnitude = avgStrength * 1.0; // 1% per strength point
    const scaledMagnitude = baseMagnitude * ensemble.aggregated.confidence;

    return Math.round(scaledMagnitude * 10) / 10; // Round to 1 decimal
  }

  /**
   * Determine prediction horizon based on predictor expiration
   */
  private determineHorizon(predictors: Predictor[]): number {
    // Use the earliest predictor expiration as the horizon
    // Default to 24 hours if no expiration set
    const now = Date.now();
    const expirations = predictors
      .filter((p) => p.expires_at)
      .map((p) => new Date(p.expires_at).getTime() - now);

    if (expirations.length === 0) {
      return 24;
    }

    // Convert to hours, minimum 1 hour
    const minExpirationMs = Math.min(...expirations);
    return Math.max(1, Math.round(minExpirationMs / (1000 * 60 * 60)));
  }

  /**
   * Calculate final confidence combining threshold and ensemble
   */
  private calculateFinalConfidence(
    threshold: ThresholdEvaluationResult,
    ensemble: EnsembleResult,
  ): number {
    // Weight: 40% consensus, 40% ensemble confidence, 20% predictor avg confidence
    const consensusWeight = threshold.directionConsensus * 0.4;
    const ensembleWeight = ensemble.aggregated.confidence * 0.4;
    const avgConfidenceWeight = threshold.details.avgConfidence * 0.2;

    return (
      Math.round(
        (consensusWeight + ensembleWeight + avgConfidenceWeight) * 100,
      ) / 100
    );
  }

  /**
   * Categorize numeric magnitude into small/medium/large
   */
  private categorizeMagnitude(magnitude: number): 'small' | 'medium' | 'large' {
    if (magnitude < 2.5) {
      return 'small';
    } else if (magnitude < 6) {
      return 'medium';
    }
    return 'large';
  }

  /**
   * Create snapshot capturing prediction state at creation time
   */
  private async createPredictionSnapshot(
    prediction: Prediction,
    predictors: Predictor[],
    threshold: ThresholdEvaluationResult,
    ensemble: EnsembleResult,
  ): Promise<void> {
    const snapshotInput: SnapshotBuildInput = {
      predictionId: prediction.id,
      predictorSnapshots: predictors.map((p) => ({
        predictor_id: p.id,
        signal_content: p.reasoning || '',
        direction: p.direction,
        strength: p.strength,
        confidence: p.confidence,
        analyst_slug: p.analyst_slug,
        created_at: p.created_at,
      })),
      rejectedSignals: [],
      analystAssessments: ensemble.assessments,
      llmEnsemble: {
        tiers_used: ensemble.assessments.map((a) => a.tier),
        tier_results: ensemble.assessments.reduce(
          (acc, a) => {
            acc[a.tier] = {
              direction: a.direction,
              confidence: a.confidence,
              model: 'ensemble',
              provider: 'mixed',
            };
            return acc;
          },
          {} as Record<
            string,
            {
              direction: string;
              confidence: number;
              model: string;
              provider: string;
            }
          >,
        ),
        agreement_level: ensemble.aggregated.consensus_strength,
      },
      learnings: ensemble.assessments.flatMap((a) =>
        a.learnings_applied.map((id) => ({
          learning_id: id,
          type: 'pattern',
          content: '',
          scope: 'target',
          applied_to: a.analyst.slug,
        })),
      ),
      thresholdEval: {
        min_predictors: 3,
        actual_predictors: threshold.activeCount,
        min_combined_strength: 15,
        actual_combined_strength: threshold.combinedStrength,
        min_consensus: 0.6,
        actual_consensus: threshold.directionConsensus,
        passed: threshold.meetsThreshold,
      },
      timeline: [
        {
          timestamp: new Date().toISOString(),
          event_type: 'prediction_generated',
          details: {
            prediction_id: prediction.id,
            direction: prediction.direction,
            confidence: prediction.confidence,
          },
        },
      ],
    };

    const snapshotData = this.snapshotService.buildSnapshotData(snapshotInput);
    await this.snapshotService.createSnapshot(snapshotData);

    this.logger.debug(`Created snapshot for prediction ${prediction.id}`);
  }

  /**
   * Calculate recommended position size based on confidence and risk management
   *
   * Position sizing formula:
   * quantity = (portfolio_balance * risk_percent) / (entry_price * stop_distance_percent)
   *
   * Risk percent scales with confidence:
   * - 80%+ confidence: 2% risk per trade
   * - 70-80% confidence: 1.5% risk per trade
   * - 60-70% confidence: 1% risk per trade
   * - Below 60%: 0.5% risk per trade
   *
   * Stop distance is based on magnitude:
   * - Large magnitude: 5% stop
   * - Medium magnitude: 3% stop
   * - Small magnitude: 2% stop
   */
  private async calculateRecommendedPositionSize(
    ctx: ExecutionContext,
    target: { symbol: string },
    direction: PredictionDirection,
    confidence: number,
    magnitudePercent: number,
  ): Promise<{ quantity: number; reasoning: string }> {
    try {
      // Get user's portfolio balance
      const portfolio = await this.portfolioRepository.getUserPortfolio(
        ctx.userId,
        ctx.orgSlug,
      );

      if (!portfolio) {
        return {
          quantity: 0,
          reasoning:
            'No portfolio found - create a portfolio to get position sizing recommendations',
        };
      }

      // Get current price (using a placeholder - in production this would come from price feed)
      const entryPrice = this.getCurrentPrice(target.symbol);
      if (!entryPrice || entryPrice <= 0) {
        return {
          quantity: 0,
          reasoning: 'Unable to determine current price for position sizing',
        };
      }

      // Determine risk percent based on confidence
      let riskPercent: number;
      let riskReason: string;
      if (confidence >= 0.8) {
        riskPercent = 0.02; // 2%
        riskReason = 'high confidence (80%+)';
      } else if (confidence >= 0.7) {
        riskPercent = 0.015; // 1.5%
        riskReason = 'good confidence (70-80%)';
      } else if (confidence >= 0.6) {
        riskPercent = 0.01; // 1%
        riskReason = 'moderate confidence (60-70%)';
      } else {
        riskPercent = 0.005; // 0.5%
        riskReason = 'lower confidence (<60%)';
      }

      // Determine stop distance based on magnitude
      let stopDistancePercent: number;
      let stopReason: string;
      if (magnitudePercent >= 6) {
        stopDistancePercent = 0.05; // 5%
        stopReason = 'large expected move';
      } else if (magnitudePercent >= 2.5) {
        stopDistancePercent = 0.03; // 3%
        stopReason = 'medium expected move';
      } else {
        stopDistancePercent = 0.02; // 2%
        stopReason = 'small expected move';
      }

      // Calculate position size
      // quantity = (balance * risk%) / (price * stop%)
      const riskAmount = portfolio.current_balance * riskPercent;
      const riskPerShare = entryPrice * stopDistancePercent;
      const quantity = riskAmount / riskPerShare;

      // Round to appropriate precision (whole shares for stocks, 8 decimals for crypto)
      const isCrypto = this.isCryptoAsset(target.symbol);
      const roundedQuantity = isCrypto
        ? Math.floor(quantity * 100000000) / 100000000
        : Math.floor(quantity);

      const reasoning = [
        `Position sizing for ${target.symbol} (${direction}):`,
        `- Portfolio balance: $${portfolio.current_balance.toLocaleString()}`,
        `- Risk per trade: ${(riskPercent * 100).toFixed(1)}% (${riskReason})`,
        `- Stop distance: ${(stopDistancePercent * 100).toFixed(0)}% (${stopReason})`,
        `- Entry price: $${entryPrice.toFixed(2)}`,
        `- Risk amount: $${riskAmount.toFixed(2)}`,
        `- Recommended quantity: ${roundedQuantity}`,
      ].join('\n');

      return {
        quantity: roundedQuantity,
        reasoning,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to calculate position size: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        quantity: 0,
        reasoning: `Position sizing unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get current price for a target
   * Uses the metadata.last_price field if available, or returns null
   * In production, this would integrate with a real-time price feed service
   */
  private getCurrentPrice(_symbol: string): number | null {
    // Try to get the latest price from the target's metadata
    // Price data is typically stored in metadata.last_price or metadata.current_price
    try {
      // We already have the target from the caller context, but need to get it here
      // In production, this would call a price feed service
      // For now, return null - the position sizing will indicate price unavailable
      // The actual price would be fetched when the user opens a position
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if symbol is a crypto asset (for decimal precision)
   */
  private isCryptoAsset(symbol: string): boolean {
    // Simple heuristic: check for common crypto suffixes or patterns
    const cryptoSuffixes = ['USD', 'USDT', 'BTC', 'ETH'];
    const upperSymbol = symbol.toUpperCase();
    return (
      cryptoSuffixes.some((suffix) => upperSymbol.endsWith(suffix)) ||
      upperSymbol.includes('-') || // e.g., BTC-USD
      upperSymbol.includes('/') // e.g., BTC/USD
    );
  }

  /**
   * Capture current context versions for traceability
   * Returns version IDs for runner, universe, target, and all analysts
   */
  private async captureContextVersions(
    universeId: string,
    targetId: string,
    ensembleResult: EnsembleResult,
  ): Promise<{
    runnerContextVersionId?: string;
    universeContextVersionId?: string;
    targetContextVersionId?: string;
    analystContextVersionIds?: Record<string, string>;
  }> {
    try {
      // Get current context versions in parallel
      const [
        runnerVersion,
        universeVersion,
        targetVersion,
        analystVersionsMap,
      ] = await Promise.all([
        this.portfolioRepository
          .getCurrentRunnerContextVersion('stock-predictor')
          .catch(() => null),
        this.portfolioRepository
          .getCurrentUniverseContextVersion(universeId)
          .catch(() => null),
        this.portfolioRepository
          .getCurrentTargetContextVersion(targetId)
          .catch(() => null),
        // Get user fork versions for predictions (user fork is the official version)
        this.portfolioRepository
          .getAllCurrentAnalystContextVersions('user')
          .catch(() => new Map<string, string>()),
      ]);

      // Build analyst context version IDs from the assessments
      const analystContextVersionIds: Record<string, string> = {};
      for (const assessment of ensembleResult.assessments) {
        const analystId = assessment.analyst.analyst_id;
        const versionId = analystVersionsMap.get(analystId);
        if (versionId) {
          analystContextVersionIds[analystId] = versionId;
        }
      }

      return {
        runnerContextVersionId: runnerVersion?.id,
        universeContextVersionId: universeVersion?.id,
        targetContextVersionId: targetVersion?.id,
        analystContextVersionIds:
          Object.keys(analystContextVersionIds).length > 0
            ? analystContextVersionIds
            : undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to capture context versions: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Return empty - context versioning is optional
      return {};
    }
  }
}
