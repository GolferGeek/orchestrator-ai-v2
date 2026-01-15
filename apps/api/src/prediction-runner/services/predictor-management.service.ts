import { Injectable, Logger } from '@nestjs/common';
import { PredictorRepository } from '../repositories/predictor.repository';
import {
  Predictor,
  PredictorDirection,
} from '../interfaces/predictor.interface';
import {
  ThresholdConfig,
  ThresholdEvaluationResult,
  DEFAULT_THRESHOLD_CONFIG,
} from '../interfaces/threshold-evaluation.interface';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * Tier 2: Predictor Management Service
 *
 * Manages the predictor pool for each target:
 * - Tracks active predictors
 * - Evaluates threshold conditions
 * - Determines when to create predictions
 * - Manages predictor lifecycle (active -> consumed/expired)
 *
 * Threshold evaluation determines:
 * - Do we have enough predictors?
 * - Is the combined strength sufficient?
 * - Is there enough directional consensus?
 */
@Injectable()
export class PredictorManagementService {
  private readonly logger = new Logger(PredictorManagementService.name);

  constructor(
    private readonly predictorRepository: PredictorRepository,
    private readonly observabilityEventsService: ObservabilityEventsService,
  ) {}

  /**
   * Create execution context for observability events
   */
  private createObservabilityContext(targetId: string): ExecutionContext {
    return {
      orgSlug: 'system',
      userId: NIL_UUID,
      conversationId: NIL_UUID,
      taskId: `predictor-eval-${targetId}-${Date.now()}`,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'predictor-management',
      agentType: 'service',
      provider: NIL_UUID,
      model: NIL_UUID,
    };
  }

  /**
   * Get active predictors for a target
   */
  async getActivePredictors(targetId: string): Promise<Predictor[]> {
    // First, expire any old predictors
    await this.predictorRepository.expireOldPredictors(targetId);

    // Then get active ones
    return this.predictorRepository.findActiveByTarget(targetId);
  }

  /**
   * Evaluate if predictors meet threshold for prediction creation
   */
  async evaluateThreshold(
    targetId: string,
    config?: ThresholdConfig,
  ): Promise<ThresholdEvaluationResult> {
    const effectiveConfig = { ...DEFAULT_THRESHOLD_CONFIG, ...config };

    const predictors = await this.getActivePredictors(targetId);

    // Count by direction
    const bullishPredictors = predictors.filter(
      (p) => p.direction === 'bullish',
    );
    const bearishPredictors = predictors.filter(
      (p) => p.direction === 'bearish',
    );
    const neutralPredictors = predictors.filter(
      (p) => p.direction === 'neutral',
    );

    const bullishCount = bullishPredictors.length;
    const bearishCount = bearishPredictors.length;
    const neutralCount = neutralPredictors.length;
    const activeCount = predictors.length;

    // Calculate combined strength
    const combinedStrength = predictors.reduce((sum, p) => sum + p.strength, 0);

    // Calculate average confidence
    const avgConfidence =
      activeCount > 0
        ? predictors.reduce((sum, p) => sum + p.confidence, 0) / activeCount
        : 0;

    // Determine dominant direction
    let dominantDirection: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount > bearishCount && bullishCount > neutralCount) {
      dominantDirection = 'bullish';
    } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
      dominantDirection = 'bearish';
    } else {
      dominantDirection = 'neutral';
    }

    // Calculate direction consensus (% of predictors agreeing with dominant)
    const dominantCount =
      dominantDirection === 'bullish'
        ? bullishCount
        : dominantDirection === 'bearish'
          ? bearishCount
          : neutralCount;
    const directionConsensus =
      activeCount > 0 ? dominantCount / activeCount : 0;

    // Check if thresholds are met
    const meetsThreshold =
      activeCount >= effectiveConfig.min_predictors &&
      combinedStrength >= effectiveConfig.min_combined_strength &&
      directionConsensus >= effectiveConfig.min_direction_consensus;

    const result: ThresholdEvaluationResult = {
      meetsThreshold,
      activeCount,
      combinedStrength,
      directionConsensus,
      dominantDirection,
      details: {
        bullishCount,
        bearishCount,
        neutralCount,
        avgConfidence,
      },
    };

    this.logger.debug(
      `Threshold evaluation for ${targetId}: ` +
        `meets=${meetsThreshold}, active=${activeCount}, ` +
        `strength=${combinedStrength}, consensus=${directionConsensus.toFixed(2)}`,
    );

    // Emit predictor.ready event when threshold is met
    if (meetsThreshold) {
      const ctx = this.createObservabilityContext(targetId);
      await this.observabilityEventsService.push({
        context: ctx,
        source_app: 'prediction-runner',
        hook_event_type: 'predictor.ready',
        status: 'ready',
        message: `Predictor threshold met for target: ${activeCount} predictors, ${combinedStrength} combined strength, ${(directionConsensus * 100).toFixed(0)}% consensus (${dominantDirection})`,
        progress: null,
        step: 'predictor-ready',
        payload: {
          targetId,
          activeCount,
          combinedStrength,
          directionConsensus,
          dominantDirection,
          bullishCount,
          bearishCount,
          neutralCount,
          avgConfidence,
        },
        timestamp: Date.now(),
      });
    }

    return result;
  }

  /**
   * Consume predictors when a prediction is created
   * Marks all active predictors as consumed by the prediction
   */
  async consumePredictors(
    targetId: string,
    predictionId: string,
  ): Promise<Predictor[]> {
    const predictors = await this.getActivePredictors(targetId);

    const consumedPredictors: Predictor[] = [];
    for (const predictor of predictors) {
      const consumed = await this.predictorRepository.consumePredictor(
        predictor.id,
        predictionId,
      );
      consumedPredictors.push(consumed);
    }

    this.logger.log(
      `Consumed ${consumedPredictors.length} predictors for prediction ${predictionId}`,
    );

    return consumedPredictors;
  }

  /**
   * Get summary statistics for a target's predictors
   */
  async getPredictorStats(targetId: string): Promise<{
    activeCount: number;
    totalStrength: number;
    avgConfidence: number;
    byDirection: Record<PredictorDirection, number>;
  }> {
    const predictors = await this.getActivePredictors(targetId);

    const byDirection: Record<PredictorDirection, number> = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };

    let totalStrength = 0;
    let totalConfidence = 0;

    for (const p of predictors) {
      byDirection[p.direction]++;
      totalStrength += p.strength;
      totalConfidence += p.confidence;
    }

    return {
      activeCount: predictors.length,
      totalStrength,
      avgConfidence:
        predictors.length > 0 ? totalConfidence / predictors.length : 0,
      byDirection,
    };
  }

  /**
   * Check if adding a new predictor would trigger threshold
   * Useful for deciding whether to queue for HITL review
   */
  async wouldMeetThreshold(
    targetId: string,
    newPredictorStrength: number,
    newPredictorDirection: PredictorDirection,
    config?: ThresholdConfig,
  ): Promise<boolean> {
    const effectiveConfig = { ...DEFAULT_THRESHOLD_CONFIG, ...config };

    const predictors = await this.getActivePredictors(targetId);
    const simulatedCount = predictors.length + 1;

    if (simulatedCount < effectiveConfig.min_predictors) {
      return false;
    }

    const simulatedStrength =
      predictors.reduce((sum, p) => sum + p.strength, 0) + newPredictorStrength;

    if (simulatedStrength < effectiveConfig.min_combined_strength) {
      return false;
    }

    // Calculate consensus with new predictor
    const directionCounts: Record<PredictorDirection, number> = {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };
    for (const p of predictors) {
      directionCounts[p.direction]++;
    }
    directionCounts[newPredictorDirection]++;

    const maxCount = Math.max(...Object.values(directionCounts));
    const consensus = maxCount / simulatedCount;

    return consensus >= effectiveConfig.min_direction_consensus;
  }
}
