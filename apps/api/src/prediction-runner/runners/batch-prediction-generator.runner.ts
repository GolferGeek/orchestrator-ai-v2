import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { TargetRepository } from '../repositories/target.repository';
import { UniverseRepository } from '../repositories/universe.repository';
import { PredictionGenerationService } from '../services/prediction-generation.service';
import { PredictorManagementService } from '../services/predictor-management.service';
import { StrategyService } from '../services/strategy.service';

/**
 * Batch Prediction Generator Runner - Phase 7, Step 7-3
 *
 * Evaluates predictor thresholds and generates predictions
 * when conditions are met.
 *
 * Schedule: Every 30 minutes
 *
 * Flow:
 * 1. Get all active targets
 * 2. For each target, evaluate predictor threshold
 * 3. If threshold met, generate prediction
 * 4. Apply strategy-specific settings
 */
@Injectable()
export class BatchPredictionGeneratorRunner {
  private readonly logger = new Logger(BatchPredictionGeneratorRunner.name);
  private isRunning = false;

  constructor(
    private readonly targetRepository: TargetRepository,
    private readonly universeRepository: UniverseRepository,
    private readonly predictionGenerationService: PredictionGenerationService,
    private readonly predictorManagementService: PredictorManagementService,
    private readonly strategyService: StrategyService,
  ) {}

  /**
   * Main cron job - runs every 30 minutes
   */
  @Cron('*/30 * * * *')
  async generatePredictionsBatch(): Promise<void> {
    await this.runBatchGeneration();
  }

  /**
   * Run batch prediction generation
   */
  async runBatchGeneration(): Promise<{
    targetsEvaluated: number;
    predictionsCreated: number;
    thresholdsNotMet: number;
    errors: number;
  }> {
    if (this.isRunning) {
      this.logger.warn('Skipping batch run - previous run still in progress');
      return {
        targetsEvaluated: 0,
        predictionsCreated: 0,
        thresholdsNotMet: 0,
        errors: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log('Starting batch prediction generation');

    let targetsEvaluated = 0;
    let predictionsCreated = 0;
    let thresholdsNotMet = 0;
    let errors = 0;

    try {
      // Get all universes
      const universes = await this.universeRepository.findAllActive();

      for (const universe of universes) {
        // Get applied strategy for this universe
        const appliedStrategy = await this.strategyService.getAppliedStrategy(
          universe.id,
        );

        // Get active targets
        const targets = await this.targetRepository.findActiveByUniverse(
          universe.id,
        );

        for (const target of targets) {
          try {
            targetsEvaluated++;

            // Get threshold config from applied strategy parameters
            const thresholdConfig = appliedStrategy
              ? {
                  min_predictors:
                    appliedStrategy.effective_parameters.min_predictors,
                  min_combined_strength:
                    appliedStrategy.effective_parameters.min_combined_strength,
                  min_direction_consensus:
                    appliedStrategy.effective_parameters
                      .min_direction_consensus,
                  predictor_ttl_hours:
                    appliedStrategy.effective_parameters.predictor_ttl_hours,
                }
              : undefined;

            // Check predictor threshold
            const thresholdResult =
              await this.predictorManagementService.evaluateThreshold(
                target.id,
                thresholdConfig,
              );

            if (!thresholdResult.meetsThreshold) {
              thresholdsNotMet++;
              this.logger.debug(
                `Threshold not met for ${target.symbol}: ` +
                  `${thresholdResult.activeCount} predictors, ` +
                  `strength=${thresholdResult.combinedStrength}, ` +
                  `consensus=${(thresholdResult.directionConsensus * 100).toFixed(0)}%`,
              );
              continue;
            }

            // Create execution context
            const ctx: ExecutionContext = {
              orgSlug: universe.organization_slug || 'system',
              userId: 'system',
              conversationId: `batch-prediction-${Date.now()}`,
              taskId: uuidv4(),
              planId: NIL_UUID,
              deliverableId: NIL_UUID,
              agentSlug: 'batch-prediction-generator',
              agentType: 'context',
              provider: 'anthropic',
              model: 'claude-sonnet-4-20250514',
            };

            // Generate prediction
            const prediction =
              await this.predictionGenerationService.attemptPredictionGeneration(
                ctx,
                target.id,
                thresholdConfig,
              );

            if (prediction) {
              predictionsCreated++;
              this.logger.log(
                `Created prediction ${prediction.id} for ${target.symbol}: ` +
                  `${prediction.direction} (confidence: ${(prediction.confidence * 100).toFixed(0)}%)`,
              );
            }
          } catch (error) {
            errors++;
            this.logger.error(
              `Error generating prediction for target ${target.id}: ` +
                `${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch prediction generation complete: ${targetsEvaluated} evaluated, ` +
          `${predictionsCreated} predictions created, ` +
          `${thresholdsNotMet} below threshold, ${errors} errors (${duration}ms)`,
      );

      return { targetsEvaluated, predictionsCreated, thresholdsNotMet, errors };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger prediction generation for a specific target
   */
  async generateForTargetManually(targetId: string): Promise<{
    success: boolean;
    predictionId?: string;
    error?: string;
  }> {
    try {
      const target = await this.targetRepository.findByIdOrThrow(targetId);

      const ctx: ExecutionContext = {
        orgSlug: 'system',
        userId: 'system',
        conversationId: `manual-prediction-${Date.now()}`,
        taskId: uuidv4(),
        planId: NIL_UUID,
        deliverableId: NIL_UUID,
        agentSlug: 'manual-prediction-generator',
        agentType: 'context',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      };

      const prediction =
        await this.predictionGenerationService.attemptPredictionGeneration(
          ctx,
          target.id,
        );

      if (prediction) {
        return { success: true, predictionId: prediction.id };
      }

      return { success: false, error: 'Threshold not met' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get predictor stats for a target (useful for debugging)
   */
  async getTargetStats(targetId: string): Promise<{
    activeCount: number;
    totalStrength: number;
    avgConfidence: number;
    byDirection: Record<string, number>;
    meetsThreshold: boolean;
  }> {
    const stats =
      await this.predictorManagementService.getPredictorStats(targetId);
    const thresholdResult =
      await this.predictorManagementService.evaluateThreshold(targetId);

    return {
      ...stats,
      meetsThreshold: thresholdResult.meetsThreshold,
    };
  }
}
