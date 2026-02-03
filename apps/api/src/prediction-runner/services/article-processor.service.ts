import { Injectable, Logger } from '@nestjs/common';
import {
  SourceSubscriptionRepository,
  CrawlerArticle,
} from '../repositories/source-subscription.repository';
import { SignalRepository } from '../repositories/signal.repository';
import { TargetRepository } from '../repositories/target.repository';
import {
  CreateSignalData,
  SignalDirection,
} from '../interfaces/signal.interface';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { Article as CrawlerServiceArticle } from '@/crawler/interfaces';

/**
 * Result of processing articles for a subscription
 */
export interface ArticleProcessResult {
  subscription_id: string;
  target_id: string;
  articles_processed: number;
  signals_created: number;
  signals_skipped: number;
  errors: string[];
}

/**
 * ArticleProcessorService
 *
 * Pulls articles from the central crawler and converts them to prediction signals.
 * This replaces the direct crawling logic that was in SourceCrawlerService.
 *
 * Flow:
 * 1. Pull new articles from subscribed sources (via SourceSubscriptionRepository)
 * 2. For each article, create a signal if it passes filters
 * 3. Update the subscription watermark
 *
 * The actual crawling is now handled by the central crawler module.
 */
@Injectable()
export class ArticleProcessorService {
  private readonly logger = new Logger(ArticleProcessorService.name);

  constructor(
    private readonly subscriptionRepository: SourceSubscriptionRepository,
    private readonly signalRepository: SignalRepository,
    private readonly targetRepository: TargetRepository,
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
      taskId: `article-processor-${targetId}-${Date.now()}`,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'article-processor',
      agentType: 'service',
      provider: NIL_UUID,
      model: NIL_UUID,
    };
  }

  /**
   * Process new articles for a specific subscription
   */
  async processSubscription(
    subscriptionId: string,
    limit: number = 100,
  ): Promise<ArticleProcessResult> {
    const subscription =
      await this.subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const result: ArticleProcessResult = {
      subscription_id: subscriptionId,
      target_id: subscription.target_id,
      articles_processed: 0,
      signals_created: 0,
      signals_skipped: 0,
      errors: [],
    };

    try {
      // Pull new articles since last processed
      const articles = await this.subscriptionRepository.getNewArticles(
        subscriptionId,
        limit,
      );

      this.logger.debug(
        `Found ${articles.length} new articles for subscription ${subscriptionId}`,
      );

      // Get target for signal creation
      const target = await this.targetRepository.findById(
        subscription.target_id,
      );
      if (!target) {
        throw new Error(`Target not found: ${subscription.target_id}`);
      }

      // Process each article
      let latestArticleTime: Date | null = null;

      for (const article of articles) {
        try {
          // Test targets have T_ prefix per INV-04
          const isTestTarget = target.symbol.startsWith('T_');
          const signalCreated = await this.processArticle(
            article,
            subscription.target_id,
            subscription.filter_config,
            isTestTarget,
          );

          result.articles_processed++;
          if (signalCreated) {
            result.signals_created++;
          } else {
            result.signals_skipped++;
          }

          // Track latest article time for watermark
          const articleTime = new Date(article.first_seen_at);
          if (!latestArticleTime || articleTime > latestArticleTime) {
            latestArticleTime = articleTime;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(
            `Failed to process article ${article.id}: ${errorMessage}`,
          );
          this.logger.error(
            `Failed to process article ${article.id}: ${errorMessage}`,
          );
        }
      }

      // Update watermark if we processed any articles
      if (latestArticleTime) {
        await this.subscriptionRepository.updateWatermark(
          subscriptionId,
          latestArticleTime,
        );
      }

      this.logger.log(
        `Processed ${result.articles_processed} articles for subscription ${subscriptionId}: ` +
          `${result.signals_created} signals created, ${result.signals_skipped} skipped`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Subscription processing failed: ${errorMessage}`);
      this.logger.error(
        `Failed to process subscription ${subscriptionId}: ${errorMessage}`,
      );
      return result;
    }
  }

  /**
   * Process new articles for a target across all its subscriptions
   */
  async processTarget(
    targetId: string,
    limit: number = 100,
  ): Promise<ArticleProcessResult> {
    const result: ArticleProcessResult = {
      subscription_id: 'all',
      target_id: targetId,
      articles_processed: 0,
      signals_created: 0,
      signals_skipped: 0,
      errors: [],
    };

    try {
      // Get target
      const target = await this.targetRepository.findById(targetId);
      if (!target) {
        throw new Error(`Target not found: ${targetId}`);
      }

      // Pull new articles across all subscriptions for this target
      const articlesWithSub =
        await this.subscriptionRepository.getNewArticlesForTarget(
          targetId,
          limit,
        );

      this.logger.debug(
        `Found ${articlesWithSub.length} new articles for target ${targetId}`,
      );

      // Group by subscription to update watermarks efficiently
      const articlesBySubscription = new Map<
        string,
        {
          articles: (CrawlerArticle & { subscription_id: string })[];
          latestTime: Date | null;
        }
      >();

      for (const article of articlesWithSub) {
        if (!articlesBySubscription.has(article.subscription_id)) {
          articlesBySubscription.set(article.subscription_id, {
            articles: [],
            latestTime: null,
          });
        }
        const sub = articlesBySubscription.get(article.subscription_id)!;
        sub.articles.push(article);

        const articleTime = new Date(article.first_seen_at);
        if (!sub.latestTime || articleTime > sub.latestTime) {
          sub.latestTime = articleTime;
        }
      }

      // Process all articles
      for (const article of articlesWithSub) {
        try {
          // Get subscription to access filter config
          const subscription = await this.subscriptionRepository.findById(
            article.subscription_id,
          );
          const filterConfig = subscription?.filter_config ?? {};

          // Test targets have T_ prefix per INV-04
          const isTestTarget = target.symbol.startsWith('T_');
          const signalCreated = await this.processArticle(
            article,
            targetId,
            filterConfig,
            isTestTarget,
          );

          result.articles_processed++;
          if (signalCreated) {
            result.signals_created++;
          } else {
            result.signals_skipped++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(
            `Failed to process article ${article.id}: ${errorMessage}`,
          );
        }
      }

      // Update watermarks for all subscriptions
      for (const [subId, subData] of articlesBySubscription) {
        if (subData.latestTime) {
          await this.subscriptionRepository.updateWatermark(
            subId,
            subData.latestTime,
          );
        }
      }

      this.logger.log(
        `Processed ${result.articles_processed} articles for target ${targetId}: ` +
          `${result.signals_created} signals created, ${result.signals_skipped} skipped`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Target processing failed: ${errorMessage}`);
      this.logger.error(
        `Failed to process target ${targetId}: ${errorMessage}`,
      );
      return result;
    }
  }

  /**
   * Process a single article and create a signal if it passes filters
   */
  private async processArticle(
    article: CrawlerArticle,
    targetId: string,
    filterConfig: {
      keywords_include?: string[];
      keywords_exclude?: string[];
      min_relevance_score?: number;
    },
    isTestTarget: boolean,
  ): Promise<boolean> {
    // Check if signal already exists for this article+target combination
    const existingSignal = await this.signalRepository.findByArticleAndTarget(
      article.id,
      targetId,
    );
    if (existingSignal) {
      this.logger.debug(
        `Signal already exists for article ${article.id} and target ${targetId}, skipping`,
      );
      return false;
    }

    // Apply keyword filters
    if (!this.passesFilters(article, filterConfig)) {
      this.logger.debug(`Article ${article.id} filtered out by keyword rules`);
      return false;
    }

    // Determine signal direction from content (placeholder - could be enhanced with LLM)
    const direction = this.inferDirection(article);

    // Create signal from article
    const signalData: CreateSignalData = {
      target_id: targetId,
      source_id: article.source_id,
      content: article.content ?? article.summary ?? article.title ?? '',
      url: article.url,
      direction,
      detected_at: article.first_seen_at,
      metadata: {
        crawler_article_id: article.id,
        headline: article.title,
        content_hash: article.content_hash,
        key_phrases: article.key_phrases,
        raw_data: article.raw_data,
      },
      is_test: isTestTarget || article.is_test,
    };

    await this.signalRepository.create(signalData);
    this.logger.debug(`Created signal from article ${article.id}`);
    return true;
  }

  /**
   * Check if article passes keyword filters
   */
  private passesFilters(
    article: CrawlerArticle,
    filterConfig: {
      keywords_include?: string[];
      keywords_exclude?: string[];
    },
  ): boolean {
    const text =
      `${article.title ?? ''} ${article.content ?? ''}`.toLowerCase();

    // Check exclude keywords first
    const excludeKeywords = filterConfig.keywords_exclude ?? [];
    for (const keyword of excludeKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    // Check include keywords (if specified, at least one must match)
    const includeKeywords = filterConfig.keywords_include ?? [];
    if (includeKeywords.length > 0) {
      const hasMatch = includeKeywords.some((keyword) =>
        text.includes(keyword.toLowerCase()),
      );
      if (!hasMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process a freshly crawled article for all subscriptions that use its source
   *
   * Called by the SourceCrawlerRunner when new articles are discovered.
   * Creates signals for each subscription (target) that is linked to the source.
   *
   * @param article - The newly crawled article from crawler.articles
   * @param source - The source that was crawled
   * @returns Number of signals created
   */
  async processArticleForSubscriptions(
    article: CrawlerServiceArticle,
    source: { id: string; organization_slug: string },
  ): Promise<number> {
    // Convert CrawlerServiceArticle to CrawlerArticle format for processing
    const crawlerArticle: CrawlerArticle = {
      id: article.id,
      organization_slug: article.organization_slug,
      source_id: article.source_id,
      url: article.url,
      title: article.title ?? null,
      content: article.content ?? null,
      summary: article.summary ?? null,
      author: article.author ?? null,
      published_at: article.published_at ?? null,
      content_hash: article.content_hash,
      title_normalized: article.title_normalized ?? null,
      key_phrases: article.key_phrases ?? null,
      fingerprint_hash: article.fingerprint_hash ?? null,
      raw_data: article.raw_data ?? null,
      is_test: article.is_test,
      first_seen_at: article.first_seen_at,
      metadata: article.metadata,
    };

    // Find all active subscriptions for this source
    const subscriptions = await this.subscriptionRepository.findBySourceId(
      source.id,
    );

    if (subscriptions.length === 0) {
      this.logger.debug(`No subscriptions found for source ${source.id}`);
      return 0;
    }

    let signalsCreated = 0;

    for (const subscription of subscriptions) {
      if (!subscription.is_active) continue;

      try {
        // Get target to check if it's a test target
        const target = await this.targetRepository.findById(
          subscription.target_id,
        );
        if (!target) {
          this.logger.warn(
            `Target not found for subscription: ${subscription.id}`,
          );
          continue;
        }

        // Test targets have T_ prefix per INV-04
        const isTestTarget = target.symbol.startsWith('T_');

        // Process the article with this subscription's filter config
        const signalCreated = await this.processArticle(
          crawlerArticle,
          subscription.target_id,
          subscription.filter_config ?? {},
          isTestTarget || crawlerArticle.is_test,
        );

        if (signalCreated) {
          signalsCreated++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to process article ${crawlerArticle.id} for subscription ${subscription.id}: ${errorMessage}`,
        );
      }
    }

    return signalsCreated;
  }

  /**
   * Infer signal direction from article content
   * Uses expanded keyword lists and more aggressive matching
   * The ensemble will refine this initial direction
   */
  private inferDirection(article: CrawlerArticle): SignalDirection {
    const text =
      `${article.title ?? ''} ${article.content ?? ''}`.toLowerCase();

    // Expanded keyword lists for better coverage
    const bullishKeywords = [
      // Strong bullish
      'surge',
      'rally',
      'soar',
      'jump',
      'spike',
      'breakout',
      'bullish',
      // Moderate bullish
      'gain',
      'rise',
      'climb',
      'advance',
      'up',
      'higher',
      'increase',
      'growth',
      'positive',
      'strong',
      'beat',
      'exceed',
      'outperform',
      // Financial bullish
      'upgrade',
      'buy',
      'accumulate',
      'overweight',
      'optimistic',
      'record high',
      'all-time high',
      'momentum',
      'boost',
      'expand',
    ];
    const bearishKeywords = [
      // Strong bearish
      'crash',
      'plunge',
      'collapse',
      'tumble',
      'plummet',
      'bearish',
      // Moderate bearish
      'drop',
      'fall',
      'decline',
      'slip',
      'down',
      'lower',
      'decrease',
      'loss',
      'negative',
      'weak',
      'miss',
      'below',
      'underperform',
      // Financial bearish
      'downgrade',
      'sell',
      'reduce',
      'underweight',
      'concern',
      'risk',
      'warning',
      'cut',
      'layoff',
      'slowdown',
      'pressure',
      'struggle',
    ];

    let bullishScore = 0;
    let bearishScore = 0;

    for (const keyword of bullishKeywords) {
      if (text.includes(keyword)) bullishScore++;
    }
    for (const keyword of bearishKeywords) {
      if (text.includes(keyword)) bearishScore++;
    }

    // More decisive: if ANY signal found, pick direction
    // Only return neutral if truly no signals
    if (bullishScore > bearishScore) return 'bullish';
    if (bearishScore > bullishScore) return 'bearish';
    if (bullishScore > 0 && bearishScore > 0) return 'neutral'; // True tie with signals

    // No keywords found - let the ensemble decide (mark as neutral for now)
    // The ensemble will evaluate the full content
    return 'neutral';
  }
}
