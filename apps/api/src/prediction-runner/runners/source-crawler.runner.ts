import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SourceRepository } from '../repositories/source.repository';
import { TargetRepository } from '../repositories/target.repository';
import { SourceCrawlerService } from '../services/source-crawler.service';
import { BackpressureService } from '../services/backpressure.service';
import { CrawlFrequency, Source } from '../interfaces/source.interface';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * Source Crawler Runner - Phase 7, Step 7-1
 *
 * Runs scheduled crawls of sources based on their configured frequency.
 * Implements frequency-based scheduling:
 * - 5 min: Breaking news sources
 * - 10 min: High-priority sources
 * - 15 min: Default frequency
 * - 30 min: Regular sources
 * - 60 min: Hourly sources
 *
 * Features:
 * - Per-frequency cron jobs
 * - Exponential backoff for failed sources
 * - Max 5 consecutive errors before source is skipped
 */
@Injectable()
export class SourceCrawlerRunner {
  private readonly logger = new Logger(SourceCrawlerRunner.name);
  private isRunning: Record<CrawlFrequency, boolean> = {
    5: false,
    10: false,
    15: false,
    30: false,
    60: false,
  };

  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly targetRepository: TargetRepository,
    private readonly sourceCrawlerService: SourceCrawlerService,
    private readonly observabilityEventsService: ObservabilityEventsService,
    private readonly backpressureService: BackpressureService,
  ) {}

  /**
   * 5-minute crawl for breaking news sources
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async crawl5MinSources(): Promise<void> {
    await this.crawlByFrequency(5);
  }

  /**
   * 10-minute crawl for high-priority sources
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async crawl10MinSources(): Promise<void> {
    await this.crawlByFrequency(10);
  }

  /**
   * 15-minute crawl for default frequency sources
   */
  @Cron('*/15 * * * *')
  async crawl15MinSources(): Promise<void> {
    await this.crawlByFrequency(15);
  }

  /**
   * 30-minute crawl for regular sources
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async crawl30MinSources(): Promise<void> {
    await this.crawlByFrequency(30);
  }

  /**
   * Hourly crawl for low-frequency sources
   */
  @Cron(CronExpression.EVERY_HOUR)
  async crawlHourlySources(): Promise<void> {
    await this.crawlByFrequency(60);
  }

  /**
   * Crawl all sources with a specific frequency
   */
  async crawlByFrequency(frequency: CrawlFrequency): Promise<{
    total: number;
    successful: number;
    failed: number;
    signalsCreated: number;
  }> {
    // Prevent overlapping runs for same frequency
    if (this.isRunning[frequency]) {
      this.logger.warn(
        `Skipping ${frequency}-min crawl - previous run still in progress`,
      );
      return { total: 0, successful: 0, failed: 0, signalsCreated: 0 };
    }

    this.isRunning[frequency] = true;
    const startTime = Date.now();

    // Create execution context for observability
    const ctx: ExecutionContext = {
      orgSlug: 'system',
      userId: NIL_UUID,
      conversationId: NIL_UUID,
      taskId: `crawl-${frequency}min-${Date.now()}`,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'prediction-runner',
      agentType: 'runner',
      provider: NIL_UUID,
      model: NIL_UUID,
    };

    this.logger.log(`Starting ${frequency}-minute source crawl`);

    // Emit source.crawl.started event
    await this.observabilityEventsService.push({
      context: ctx,
      source_app: 'prediction-runner',
      hook_event_type: 'source.crawl.started',
      status: 'started',
      message: `Starting ${frequency}-minute source crawl`,
      progress: 0,
      step: 'crawl-started',
      payload: {
        frequency,
        crawlType: 'scheduled',
      },
      timestamp: Date.now(),
    });

    let total = 0;
    let successful = 0;
    let failed = 0;
    let signalsCreated = 0;

    try {
      // Get sources due for crawl
      const sources = await this.sourceRepository.findDueForCrawl(frequency);
      total = sources.length;

      if (total === 0) {
        this.logger.debug(`No ${frequency}-min sources due for crawl`);

        // Emit completed event even for empty crawls
        await this.observabilityEventsService.push({
          context: ctx,
          source_app: 'prediction-runner',
          hook_event_type: 'source.crawl.completed',
          status: 'completed',
          message: `No ${frequency}-min sources due for crawl`,
          progress: 100,
          step: 'crawl-completed',
          payload: {
            frequency,
            total: 0,
            successful: 0,
            failed: 0,
            signalsCreated: 0,
            durationMs: Date.now() - startTime,
          },
          timestamp: Date.now(),
        });

        return { total: 0, successful: 0, failed: 0, signalsCreated: 0 };
      }

      this.logger.log(`Found ${total} sources due for ${frequency}-min crawl`);

      // Process each source
      for (const source of sources) {
        try {
          const result = await this.crawlSource(source);
          if (result.success) {
            successful++;
            signalsCreated += result.signalsCreated;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
          this.logger.error(
            `Error crawling source ${source.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Completed ${frequency}-min crawl: ${successful}/${total} successful, ` +
          `${signalsCreated} signals created (${duration}ms)`,
      );

      // Emit source.crawl.completed event
      await this.observabilityEventsService.push({
        context: ctx,
        source_app: 'prediction-runner',
        hook_event_type: 'source.crawl.completed',
        status: 'completed',
        message: `Completed ${frequency}-min crawl: ${successful}/${total} successful, ${signalsCreated} signals created`,
        progress: 100,
        step: 'crawl-completed',
        payload: {
          frequency,
          total,
          successful,
          failed,
          signalsCreated,
          durationMs: duration,
        },
        timestamp: Date.now(),
      });

      return { total, successful, failed, signalsCreated };
    } finally {
      this.isRunning[frequency] = false;
    }
  }

  /**
   * Crawl a single source and create signals
   * Applies backpressure controls before crawling
   */
  private async crawlSource(
    source: Source,
  ): Promise<{ success: boolean; signalsCreated: number; skipped?: boolean }> {
    // Check backpressure before starting crawl
    const crawlCheck = this.backpressureService.canStartCrawl(source.id);
    if (!crawlCheck.allowed) {
      this.logger.debug(
        `Skipping source ${source.id} due to backpressure: ${crawlCheck.reason}`,
      );
      return { success: false, signalsCreated: 0, skipped: true };
    }

    // Record crawl start for backpressure tracking
    this.backpressureService.recordCrawlStart(source.id);

    try {
      // Get target ID for the source
      // Sources can be scoped at runner/domain/universe/target level
      // We need to find the appropriate target(s) to create signals for
      const targetId = await this.resolveTargetForSource(source);

      if (!targetId) {
        this.logger.warn(
          `Could not resolve target for source ${source.id} (scope: ${source.scope_level})`,
        );
        return { success: false, signalsCreated: 0 };
      }

      const result = await this.sourceCrawlerService.crawlSource(
        source,
        targetId,
      );

      return {
        success: result.result.success,
        signalsCreated: result.signalsCreated,
      };
    } finally {
      // Always record crawl completion for backpressure tracking
      this.backpressureService.recordCrawlComplete(source.id);
    }
  }

  /**
   * Resolve the target ID for a source based on its scope
   */
  private async resolveTargetForSource(source: Source): Promise<string | null> {
    switch (source.scope_level) {
      case 'target':
        // Target-scoped sources have direct target_id
        return source.target_id || null;

      case 'universe':
        // Universe-scoped sources - return first active target in universe
        // In practice, universe sources would be crawled for each target
        if (source.universe_id) {
          const targets = await this.targetRepository.findActiveByUniverse(
            source.universe_id,
          );
          return targets[0]?.id || null;
        }
        return null;

      case 'domain':
      case 'runner':
        // Domain/runner-scoped sources need broader handling
        // For now, skip these - they need to be processed differently
        this.logger.debug(
          `Source ${source.id} has ${source.scope_level} scope - skipping direct crawl`,
        );
        return null;

      default:
        return null;
    }
  }

  /**
   * Manually trigger a crawl for a specific source (for testing/debugging)
   */
  async crawlSingleSource(sourceId: string): Promise<{
    success: boolean;
    signalsCreated: number;
    error?: string;
  }> {
    try {
      const source = await this.sourceRepository.findByIdOrThrow(sourceId);
      return await this.crawlSource(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, signalsCreated: 0, error: message };
    }
  }
}
