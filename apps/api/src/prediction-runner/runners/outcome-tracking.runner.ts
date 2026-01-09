import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PredictionRepository } from '../repositories/prediction.repository';
import { TargetSnapshotRepository } from '../repositories/target-snapshot.repository';
import { OutcomeTrackingService } from '../services/outcome-tracking.service';
import { TargetSnapshotService } from '../services/target-snapshot.service';
import { Prediction } from '../interfaces/prediction.interface';

/**
 * Outcome Tracking Runner - Phase 7, Step 7-4
 *
 * Captures outcomes, resolves predictions, and checks expirations.
 *
 * Schedule: Every 15 minutes
 *
 * Responsibilities:
 * 1. Capture current prices for targets with active predictions
 * 2. Resolve predictions that have reached their timeframe
 * 3. Expire predictions past their expiration time
 * 4. Track prediction outcomes for evaluation
 */
@Injectable()
export class OutcomeTrackingRunner {
  private readonly logger = new Logger(OutcomeTrackingRunner.name);
  private isRunning = false;

  constructor(
    private readonly predictionRepository: PredictionRepository,
    private readonly targetSnapshotRepository: TargetSnapshotRepository,
    private readonly outcomeTrackingService: OutcomeTrackingService,
    private readonly targetSnapshotService: TargetSnapshotService,
  ) {}

  /**
   * Main cron job - runs every 15 minutes
   */
  @Cron('*/15 * * * *')
  async trackOutcomes(): Promise<void> {
    await this.runOutcomeTracking();
  }

  /**
   * Run outcome tracking
   */
  async runOutcomeTracking(): Promise<{
    snapshotsCaptured: number;
    predictionsResolved: number;
    predictionsExpired: number;
    errors: number;
  }> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping outcome tracking - previous run still in progress',
      );
      return {
        snapshotsCaptured: 0,
        predictionsResolved: 0,
        predictionsExpired: 0,
        errors: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log('Starting outcome tracking');

    let snapshotsCaptured = 0;
    let predictionsResolved = 0;
    let predictionsExpired = 0;
    let errors = 0;

    try {
      // Step 1: Capture price snapshots for active predictions
      const snapshotsResult = await this.captureSnapshots();
      snapshotsCaptured = snapshotsResult.captured;
      errors += snapshotsResult.errors;

      // Step 2: Resolve predictions that have reached their timeframe
      const resolveResult = await this.resolvePendingPredictions();
      predictionsResolved = resolveResult.resolved;
      errors += resolveResult.errors;

      // Step 3: Expire predictions past their expiration
      const expireResult = await this.expireOldPredictions();
      predictionsExpired = expireResult.expired;
      errors += expireResult.errors;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Outcome tracking complete: ${snapshotsCaptured} snapshots, ` +
          `${predictionsResolved} resolved, ${predictionsExpired} expired, ` +
          `${errors} errors (${duration}ms)`,
      );

      return {
        snapshotsCaptured,
        predictionsResolved,
        predictionsExpired,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Capture current price snapshots for targets with active predictions
   */
  private async captureSnapshots(): Promise<{
    captured: number;
    errors: number;
  }> {
    let captured = 0;
    let errors = 0;

    try {
      // Get all active predictions
      const activePredictions =
        await this.predictionRepository.findActivePredictions();

      // Get unique target IDs
      const targetIds = [...new Set(activePredictions.map((p) => p.target_id))];

      this.logger.debug(
        `Capturing snapshots for ${targetIds.length} targets with active predictions`,
      );

      for (const targetId of targetIds) {
        try {
          await this.targetSnapshotService.fetchAndCaptureValue(targetId);
          captured++;
        } catch (error) {
          errors++;
          this.logger.error(
            `Failed to capture snapshot for target ${targetId}: ` +
              `${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      errors++;
      this.logger.error(
        `Failed to capture snapshots: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { captured, errors };
  }

  /**
   * Resolve predictions that have reached their timeframe end
   */
  private async resolvePendingPredictions(): Promise<{
    resolved: number;
    errors: number;
  }> {
    let resolved = 0;
    let errors = 0;

    try {
      // Get predictions pending resolution
      const pendingPredictions =
        await this.outcomeTrackingService.getPendingResolutionPredictions();

      this.logger.debug(
        `Found ${pendingPredictions.length} predictions pending resolution`,
      );

      for (const prediction of pendingPredictions) {
        try {
          // Get the outcome value from latest snapshot
          const outcomeValue = await this.calculateOutcomeValue(prediction);

          if (outcomeValue !== null) {
            await this.outcomeTrackingService.resolvePrediction(
              prediction.id,
              outcomeValue,
            );
            resolved++;
            this.logger.debug(
              `Resolved prediction ${prediction.id} with outcome ${outcomeValue}%`,
            );
          }
        } catch (error) {
          errors++;
          this.logger.error(
            `Failed to resolve prediction ${prediction.id}: ` +
              `${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }
    } catch (error) {
      errors++;
      this.logger.error(
        `Failed to resolve predictions: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { resolved, errors };
  }

  /**
   * Expire predictions that are past their expiration time
   */
  private async expireOldPredictions(): Promise<{
    expired: number;
    errors: number;
  }> {
    let expired = 0;
    let errors = 0;

    try {
      const expiredPredictions =
        await this.outcomeTrackingService.expirePredictions();
      expired = expiredPredictions.length;
    } catch (error) {
      errors++;
      this.logger.error(
        `Failed to expire predictions: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { expired, errors };
  }

  /**
   * Calculate the outcome value for a prediction
   * Returns percentage change from prediction time to current
   */
  private async calculateOutcomeValue(
    prediction: Prediction,
  ): Promise<number | null> {
    try {
      // Get snapshot at prediction time
      const predictionSnapshot =
        await this.targetSnapshotRepository.findClosestToTime(
          prediction.target_id,
          new Date(prediction.predicted_at),
        );

      // Get latest snapshot
      const latestSnapshot = await this.targetSnapshotRepository.findLatest(
        prediction.target_id,
      );

      if (!predictionSnapshot || !latestSnapshot) {
        this.logger.debug(
          `Missing snapshots for prediction ${prediction.id} - cannot calculate outcome`,
        );
        return null;
      }

      // Calculate percentage change
      const startValue = predictionSnapshot.value;
      const endValue = latestSnapshot.value;

      if (startValue === 0) {
        return null;
      }

      const percentageChange = ((endValue - startValue) / startValue) * 100;

      return Math.round(percentageChange * 100) / 100; // Round to 2 decimals
    } catch (error) {
      this.logger.error(
        `Failed to calculate outcome for prediction ${prediction.id}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Manually capture outcome for a specific prediction
   */
  async captureOutcomeManually(
    predictionId: string,
    outcomeValue: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.outcomeTrackingService.captureOutcome(
        predictionId,
        outcomeValue,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manually resolve a specific prediction
   */
  async resolveManually(
    predictionId: string,
    outcomeValue: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.outcomeTrackingService.resolvePrediction(
        predictionId,
        outcomeValue,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
