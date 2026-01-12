import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PredictorRepository } from '../repositories/predictor.repository';
import { SignalRepository } from '../repositories/signal.repository';
import { TargetRepository } from '../repositories/target.repository';
import { UniverseRepository } from '../repositories/universe.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * Expiration Runner - Phase 7, Step 7-7
 *
 * Manages lifecycle expiration for predictors and signals to maintain system health
 * and prevent data staleness.
 *
 * Schedule: Every hour (via @Cron decorator)
 *
 * What this runner does:
 * 1. Expires stale predictors that are past their TTL (expires_at timestamp)
 * 2. Expires old signals that were never processed (pending signals older than 24 hours)
 * 3. Emits observability events when expirations occur
 *
 * Why expiration is needed:
 * - Predictors have a time-to-live based on their time_window (e.g., "30d_up" predictor expires after 30 days)
 * - Signals that aren't processed within 24 hours are considered stale and should be marked expired
 * - Expiration keeps the system clean and prevents acting on outdated predictions/signals
 *
 * Integration with observability:
 * - Emits `prediction.expired` events after each batch run
 * - Events include counts of expired predictors and signals
 * - Allows monitoring of system health and expiration patterns
 */
@Injectable()
export class ExpirationRunner {
  private readonly logger = new Logger(ExpirationRunner.name);
  private isRunning = false;

  // Default TTL for signals that were never processed (24 hours)
  private readonly signalTtlHours = 24;

  constructor(
    private readonly predictorRepository: PredictorRepository,
    private readonly signalRepository: SignalRepository,
    private readonly targetRepository: TargetRepository,
    private readonly universeRepository: UniverseRepository,
    private readonly observabilityEvents: ObservabilityEventsService,
  ) {}

  /**
   * Main cron job - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runExpiration(): Promise<void> {
    await this.runExpirationBatch();
  }

  /**
   * Run expiration batch
   */
  async runExpirationBatch(): Promise<{
    predictorsExpired: number;
    signalsExpired: number;
    errors: number;
  }> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping expiration run - previous run still in progress',
      );
      return {
        predictorsExpired: 0,
        signalsExpired: 0,
        errors: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log('Starting expiration batch');

    let predictorsExpired = 0;
    let signalsExpired = 0;
    let errors = 0;

    try {
      // Step 1: Expire predictors
      const predictorResult = await this.expirePredictors();
      predictorsExpired = predictorResult.expired;
      errors += predictorResult.errors;

      // Step 2: Expire signals
      const signalResult = await this.expireSignals();
      signalsExpired = signalResult.expired;
      errors += signalResult.errors;

      const duration = Date.now() - startTime;
      this.logger.log(
        `Expiration batch complete: ${predictorsExpired} predictors, ` +
          `${signalsExpired} signals expired (${duration}ms)`,
      );

      // Emit observability event for monitoring
      await this.observabilityEvents.push({
        context: {
          orgSlug: 'system',
          userId: 'prediction-runner',
          conversationId: NIL_UUID,
          taskId: `expiration-${Date.now()}`,
          planId: NIL_UUID,
          deliverableId: NIL_UUID,
          agentSlug: 'prediction-runner',
          agentType: 'system',
          provider: NIL_UUID,
          model: NIL_UUID,
        },
        source_app: 'prediction-runner',
        hook_event_type: 'prediction.expired',
        status: 'completed',
        message: `${predictorsExpired} predictors and ${signalsExpired} signals expired`,
        progress: 100,
        step: 'expiration',
        payload: {
          predictorsExpired,
          signalsExpired,
          errors,
          durationMs: duration,
        },
        timestamp: Date.now(),
      });

      return { predictorsExpired, signalsExpired, errors };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Expire predictors past their TTL
   */
  private async expirePredictors(): Promise<{
    expired: number;
    errors: number;
  }> {
    let expired = 0;
    let errors = 0;

    try {
      // Get all universes
      const universes = await this.universeRepository.findAllActive();

      for (const universe of universes) {
        // Get active targets
        const targets = await this.targetRepository.findActiveByUniverse(
          universe.id,
        );

        for (const target of targets) {
          try {
            // This method expires predictors past their expires_at time
            const expiredCount =
              await this.predictorRepository.expireOldPredictors(target.id);

            if (expiredCount > 0) {
              expired += expiredCount;
              this.logger.debug(
                `Expired ${expiredCount} predictors for target ${target.symbol}`,
              );
            }
          } catch (error) {
            errors++;
            this.logger.error(
              `Failed to expire predictors for target ${target.id}: ` +
                `${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }
    } catch (error) {
      errors++;
      this.logger.error(
        `Failed to expire predictors: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { expired, errors };
  }

  /**
   * Expire signals that have been pending too long
   */
  private async expireSignals(): Promise<{
    expired: number;
    errors: number;
  }> {
    let expired = 0;
    let errors = 0;

    try {
      // Calculate cutoff time
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.signalTtlHours);

      // Get all universes
      const universes = await this.universeRepository.findAllActive();

      for (const universe of universes) {
        // Get active targets
        const targets = await this.targetRepository.findActiveByUniverse(
          universe.id,
        );

        for (const target of targets) {
          try {
            // Find old pending signals
            const oldSignals = await this.signalRepository.findPendingSignals(
              target.id,
              1000, // Get up to 1000 old signals
            );

            // Filter to signals older than cutoff
            const signalsToExpire = oldSignals.filter((signal) => {
              const signalTime = new Date(signal.detected_at);
              return signalTime < cutoffTime;
            });

            // Expire each signal
            for (const signal of signalsToExpire) {
              try {
                await this.signalRepository.update(signal.id, {
                  disposition: 'expired',
                });
                expired++;
              } catch (error) {
                // Ignore individual signal errors
                this.logger.debug(
                  `Failed to expire signal ${signal.id}: ` +
                    `${error instanceof Error ? error.message : 'Unknown error'}`,
                );
              }
            }
          } catch (error) {
            errors++;
            this.logger.error(
              `Failed to expire signals for target ${target.id}: ` +
                `${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }
    } catch (error) {
      errors++;
      this.logger.error(
        `Failed to expire signals: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return { expired, errors };
  }

  /**
   * Manually trigger expiration for a specific target
   */
  async expireForTargetManually(targetId: string): Promise<{
    predictorsExpired: number;
    signalsExpired: number;
    error?: string;
  }> {
    try {
      // Expire predictors
      const predictorsExpired =
        await this.predictorRepository.expireOldPredictors(targetId);

      // Expire signals
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.signalTtlHours);

      const oldSignals = await this.signalRepository.findPendingSignals(
        targetId,
        1000,
      );

      let signalsExpired = 0;
      for (const signal of oldSignals) {
        const signalTime = new Date(signal.detected_at);
        if (signalTime < cutoffTime) {
          await this.signalRepository.update(signal.id, {
            disposition: 'expired',
          });
          signalsExpired++;
        }
      }

      return { predictorsExpired, signalsExpired };
    } catch (error) {
      return {
        predictorsExpired: 0,
        signalsExpired: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get expiration statistics
   */
  getExpirationStats(): {
    pendingPredictors: number;
    expiringWithin1Hour: number;
    pendingSignals: number;
    oldPendingSignals: number;
  } {
    // This would query the database for stats
    // For now, return placeholder
    return {
      pendingPredictors: 0,
      expiringWithin1Hour: 0,
      pendingSignals: 0,
      oldPendingSignals: 0,
    };
  }
}
