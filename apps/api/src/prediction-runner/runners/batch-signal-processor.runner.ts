import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { SignalRepository } from '../repositories/signal.repository';
import { TargetRepository } from '../repositories/target.repository';
import { UniverseRepository } from '../repositories/universe.repository';
import { SignalDetectionService } from '../services/signal-detection.service';
import { FastPathService } from '../services/fast-path.service';
import { LlmTierResolverService } from '../services/llm-tier-resolver.service';
import { Signal } from '../interfaces/signal.interface';

/**
 * Batch Signal Processor Runner - Phase 7, Step 7-2
 *
 * Processes pending signals through Tier 1 (Signal Detection)
 * to create predictors.
 *
 * Schedule: Every 15 minutes
 *
 * Features:
 * - Atomic signal claiming with FOR UPDATE SKIP LOCKED pattern
 * - Fast path for urgent signals (confidence >= 0.90)
 * - Batch processing with configurable batch size
 * - Worker ID tracking for debugging
 */
@Injectable()
export class BatchSignalProcessorRunner {
  private readonly logger = new Logger(BatchSignalProcessorRunner.name);
  private readonly workerId = uuidv4(); // UUID required by processing_worker column
  private readonly batchSize = 200;
  private isRunning = false;

  constructor(
    private readonly signalRepository: SignalRepository,
    private readonly targetRepository: TargetRepository,
    private readonly universeRepository: UniverseRepository,
    private readonly signalDetectionService: SignalDetectionService,
    private readonly fastPathService: FastPathService,
    private readonly llmTierResolver: LlmTierResolverService,
  ) {}

  /**
   * Main cron job - runs every 15 minutes
   */
  @Cron('*/15 * * * *')
  async processSignalsBatch(): Promise<void> {
    await this.runBatchProcessing();
  }

  /**
   * Run batch signal processing
   */
  async runBatchProcessing(): Promise<{
    processed: number;
    predictorsCreated: number;
    rejected: number;
    fastPathTriggered: number;
    errors: number;
  }> {
    if (this.isRunning) {
      this.logger.warn('Skipping batch run - previous run still in progress');
      return {
        processed: 0,
        predictorsCreated: 0,
        rejected: 0,
        fastPathTriggered: 0,
        errors: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    this.logger.log(
      `Starting batch signal processing (worker: ${this.workerId})`,
    );

    let processed = 0;
    let predictorsCreated = 0;
    let rejected = 0;
    let fastPathTriggered = 0;
    let errors = 0;

    try {
      // Get all universes to process their targets
      const universes = await this.universeRepository.findAllActive();

      for (const universe of universes) {
        // Get active targets in this universe
        const targets = await this.targetRepository.findActiveByUniverse(
          universe.id,
        );

        for (const target of targets) {
          try {
            const result = await this.processTargetSignals(target.id);
            processed += result.processed;
            predictorsCreated += result.predictorsCreated;
            rejected += result.rejected;
            fastPathTriggered += result.fastPathTriggered;
            errors += result.errors;
          } catch (error) {
            errors++;
            this.logger.error(
              `Error processing signals for target ${target.id}: ` +
                `${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Batch signal processing complete: ${processed} processed, ` +
          `${predictorsCreated} predictors created, ${rejected} rejected, ` +
          `${fastPathTriggered} fast-path, ${errors} errors (${duration}ms)`,
      );

      return {
        processed,
        predictorsCreated,
        rejected,
        fastPathTriggered,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process all pending signals for a specific target
   */
  private async processTargetSignals(targetId: string): Promise<{
    processed: number;
    predictorsCreated: number;
    rejected: number;
    fastPathTriggered: number;
    errors: number;
  }> {
    let processed = 0;
    let predictorsCreated = 0;
    let rejected = 0;
    let fastPathTriggered = 0;
    let errors = 0;

    // Get pending signals for this target
    const pendingSignals = await this.signalRepository.findPendingSignals(
      targetId,
      this.batchSize,
    );

    if (pendingSignals.length === 0) {
      return {
        processed: 0,
        predictorsCreated: 0,
        rejected: 0,
        fastPathTriggered: 0,
        errors: 0,
      };
    }

    this.logger.debug(
      `Processing ${pendingSignals.length} pending signals for target ${targetId}`,
    );

    for (const signal of pendingSignals) {
      try {
        // Claim the signal atomically
        const claimed = await this.signalRepository.claimSignal(
          signal.id,
          this.workerId,
        );

        if (!claimed) {
          // Signal was claimed by another worker
          continue;
        }

        // Process the signal
        const result = await this.processSignal(claimed, targetId);
        processed++;

        if (result.shouldCreatePredictor) {
          predictorsCreated++;

          // Check for fast path
          if (result.urgency === 'urgent') {
            fastPathTriggered++;
            await this.triggerFastPath(claimed);
          }
        } else {
          rejected++;
        }
      } catch (error) {
        errors++;
        this.logger.error(
          `Error processing signal ${signal.id}: ` +
            `${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return {
      processed,
      predictorsCreated,
      rejected,
      fastPathTriggered,
      errors,
    };
  }

  /**
   * Process a single signal through signal detection
   */
  private async processSignal(
    signal: Signal,
    targetId: string,
  ): Promise<{ shouldCreatePredictor: boolean; urgency: string }> {
    // Resolve LLM provider/model from tier resolver (respects DEFAULT_LLM env vars)
    const resolved = await this.llmTierResolver.resolveTier('silver');

    // Create execution context for this processing
    const ctx: ExecutionContext = {
      orgSlug: 'system',
      userId: 'system',
      conversationId: `batch-${Date.now()}`,
      taskId: uuidv4(),
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'batch-signal-processor',
      agentType: 'context',
      provider: resolved.provider,
      model: resolved.model,
    };

    const result = await this.signalDetectionService.processSignal(ctx, {
      signal,
      targetId,
    });

    return {
      shouldCreatePredictor: result.shouldCreatePredictor,
      urgency: result.urgency,
    };
  }

  /**
   * Trigger fast path processing for urgent signals
   */
  private async triggerFastPath(signal: Signal): Promise<void> {
    try {
      // Resolve LLM provider/model from tier resolver (respects DEFAULT_LLM env vars)
      const resolved = await this.llmTierResolver.resolveTier('silver');

      const ctx: ExecutionContext = {
        orgSlug: 'system',
        userId: 'system',
        conversationId: `fastpath-${Date.now()}`,
        taskId: uuidv4(),
        planId: NIL_UUID,
        deliverableId: NIL_UUID,
        agentSlug: 'fast-path-processor',
        agentType: 'context',
        provider: resolved.provider,
        model: resolved.model,
      };

      await this.fastPathService.processFastPath(ctx, signal);
    } catch (error) {
      this.logger.error(
        `Fast path processing failed for signal ${signal.id}: ` +
          `${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Manually trigger processing for a specific target
   */
  async processTargetManually(targetId: string): Promise<{
    processed: number;
    predictorsCreated: number;
    rejected: number;
    fastPathTriggered: number;
    errors: number;
  }> {
    return this.processTargetSignals(targetId);
  }
}
