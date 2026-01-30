import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BaselinePredictionService } from '../services/baseline-prediction.service';

/**
 * Baseline Prediction Runner
 *
 * Creates baseline "flat" predictions for all instruments that don't have
 * explicit predictions at end of day.
 *
 * Schedule: Runs at 4:30 PM ET (21:30 UTC in winter, 20:30 UTC in summer)
 * Using 21:30 UTC as a reasonable compromise
 *
 * This ensures every instrument has a prediction (explicit or baseline)
 * for the learning system to evaluate.
 */
@Injectable()
export class BaselinePredictionRunner {
  private readonly logger = new Logger(BaselinePredictionRunner.name);
  private isRunning = false;

  constructor(
    private readonly baselinePredictionService: BaselinePredictionService,
  ) {}

  /**
   * Check if baseline prediction is disabled via master environment variable
   */
  private isDisabled(): boolean {
    return process.env.DISABLE_PREDICTION_RUNNERS === 'true';
  }

  /**
   * Main cron job - runs at 4:30 PM ET (21:30 UTC) Monday-Friday
   * After market close but before end-of-day processing
   */
  @Cron('30 21 * * 1-5') // 21:30 UTC, Monday-Friday
  async runBaselineCreation(): Promise<void> {
    if (this.isDisabled()) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await this.runForDate(today);
  }

  /**
   * Run baseline creation for a specific date
   */
  async runForDate(
    date: string,
    universeId?: string,
  ): Promise<{
    created: number;
    skipped: number;
    errors: number;
    targets: string[];
  } | null> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping baseline creation - previous run still in progress',
      );
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log(`Starting baseline prediction creation for ${date}`);

    try {
      const result =
        await this.baselinePredictionService.createBaselinePredictions(
          date,
          universeId,
        );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Baseline creation complete for ${date}: ` +
          `${result.created} created, ${result.skipped} skipped, ` +
          `${result.errors} errors (${duration}ms)`,
      );

      if (result.created > 0) {
        this.logger.log(
          `Baseline targets: ${result.targets.slice(0, 10).join(', ')}${result.targets.length > 10 ? '...' : ''}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Baseline creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for baseline creation
   */
  async manualRun(
    date: string,
    universeId?: string,
  ): Promise<{
    created: number;
    skipped: number;
    errors: number;
    targets: string[];
  } | null> {
    this.logger.log(`Manual baseline creation triggered for ${date}`);
    return this.runForDate(date, universeId);
  }

  /**
   * Get runner status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}
