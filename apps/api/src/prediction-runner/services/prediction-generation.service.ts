import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { PredictionRepository } from '../repositories/prediction.repository';
import { PredictorManagementService } from './predictor-management.service';
import { SnapshotService } from './snapshot.service';
import { AnalystEnsembleService } from './analyst-ensemble.service';
import { TargetService } from './target.service';
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
    private readonly predictorManagementService: PredictorManagementService,
    private readonly snapshotService: SnapshotService,
    private readonly ensembleService: AnalystEnsembleService,
    private readonly targetService: TargetService,
  ) {}

  /**
   * Attempt to generate a prediction for a target
   * Returns null if threshold not met
   */
  async attemptPredictionGeneration(
    ctx: ExecutionContext,
    targetId: string,
    config?: ThresholdConfig,
  ): Promise<Prediction | null> {
    const effectiveConfig = { ...DEFAULT_THRESHOLD_CONFIG, ...config };

    this.logger.log(`Attempting prediction generation for target: ${targetId}`);

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
}
