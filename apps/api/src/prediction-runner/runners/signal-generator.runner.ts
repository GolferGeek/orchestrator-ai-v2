import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArticleProcessorService } from '../services/article-processor.service';
import { TargetRepository } from '../repositories/target.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * SignalGeneratorRunner - Pull articles and create signals
 *
 * This runner pulls new articles from crawler.articles and creates
 * prediction signals for each target based on their subscriptions.
 *
 * Flow:
 * 1. Get all active targets
 * 2. For each target, pull new articles via subscriptions
 * 3. Create signals from articles that pass filters
 * 4. Update subscription watermarks
 *
 * The actual crawling is handled by the central CrawlerRunner in the
 * crawler module. This runner just creates signals from those articles.
 *
 * Schedule: Every 5 minutes (can be adjusted)
 */
@Injectable()
export class SignalGeneratorRunner {
  private readonly logger = new Logger(SignalGeneratorRunner.name);
  private isRunning = false;

  constructor(
    private readonly articleProcessorService: ArticleProcessorService,
    private readonly targetRepository: TargetRepository,
    private readonly observabilityEventsService: ObservabilityEventsService,
  ) {}

  /**
   * Check if signal generation is disabled via environment variable
   * Checks both individual flag and master DISABLE_PREDICTION_RUNNERS flag
   */
  private isSignalGenerationDisabled(): boolean {
    return (
      process.env.DISABLE_SIGNAL_GENERATION === 'true' ||
      process.env.DISABLE_PREDICTION_RUNNERS === 'true'
    );
  }

  /**
   * Process articles every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processArticles(): Promise<void> {
    if (this.isSignalGenerationDisabled()) return;
    await this.generateSignalsForAllTargets();
  }

  /**
   * Generate signals for all active targets
   */
  async generateSignalsForAllTargets(): Promise<{
    targets_processed: number;
    total_articles: number;
    total_signals: number;
    errors: string[];
  }> {
    // Prevent overlapping runs
    if (this.isRunning) {
      this.logger.warn(
        'Skipping signal generation - previous run still in progress',
      );
      return {
        targets_processed: 0,
        total_articles: 0,
        total_signals: 0,
        errors: [],
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    // Create execution context for observability
    const ctx: ExecutionContext = {
      orgSlug: 'system',
      userId: NIL_UUID,
      conversationId: NIL_UUID,
      taskId: `signal-gen-${Date.now()}`,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'signal-generator',
      agentType: 'runner',
      provider: NIL_UUID,
      model: NIL_UUID,
    };

    this.logger.log('Starting signal generation from crawler articles');

    await this.observabilityEventsService.push({
      context: ctx,
      source_app: 'prediction-runner',
      hook_event_type: 'signal.generation.started',
      status: 'started',
      message: 'Starting signal generation from crawler articles',
      progress: 0,
      step: 'signal-gen-started',
      payload: {},
      timestamp: Date.now(),
    });

    let targets_processed = 0;
    let total_articles = 0;
    let total_signals = 0;
    const errors: string[] = [];

    try {
      // Get all active targets
      const targets = await this.targetRepository.findAllActive();

      if (targets.length === 0) {
        this.logger.debug('No active targets found');
        return {
          targets_processed: 0,
          total_articles: 0,
          total_signals: 0,
          errors: [],
        };
      }

      this.logger.log(`Processing ${targets.length} active targets`);

      // Process each target
      for (const target of targets) {
        try {
          const result = await this.articleProcessorService.processTarget(
            target.id,
          );

          targets_processed++;
          total_articles += result.articles_processed;
          total_signals += result.signals_created;

          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }

          this.logger.debug(
            `Target ${target.symbol}: ${result.articles_processed} articles, ${result.signals_created} signals`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to process target ${target.id}: ${errorMessage}`);
          this.logger.error(
            `Error processing target ${target.id}: ${errorMessage}`,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Signal generation complete: ${targets_processed} targets, ` +
          `${total_articles} articles processed, ${total_signals} signals created (${duration}ms)`,
      );

      await this.observabilityEventsService.push({
        context: ctx,
        source_app: 'prediction-runner',
        hook_event_type: 'signal.generation.completed',
        status: 'completed',
        message: `Signal generation complete: ${total_signals} signals from ${total_articles} articles`,
        progress: 100,
        step: 'signal-gen-completed',
        payload: {
          targets_processed,
          total_articles,
          total_signals,
          errors_count: errors.length,
          durationMs: duration,
        },
        timestamp: Date.now(),
      });

      return { targets_processed, total_articles, total_signals, errors };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger signal generation for a specific target
   */
  async generateSignalsForTarget(targetId: string): Promise<{
    articles_processed: number;
    signals_created: number;
    errors: string[];
  }> {
    try {
      const result = await this.articleProcessorService.processTarget(targetId);
      return {
        articles_processed: result.articles_processed,
        signals_created: result.signals_created,
        errors: result.errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { articles_processed: 0, signals_created: 0, errors: [message] };
    }
  }
}
