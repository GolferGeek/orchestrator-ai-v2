import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SourceSubscriptionRepository,
  CrawlerArticle,
} from '../repositories/source-subscription.repository';
import { PredictorRepository } from '../repositories/predictor.repository';
import { TargetRepository } from '../repositories/target.repository';
import { AnalystEnsembleService } from './analyst-ensemble.service';
import { LlmTierResolverService } from './llm-tier-resolver.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { Article as CrawlerServiceArticle } from '@/crawler/interfaces';
import { Target } from '../interfaces/target.interface';
import { EnsembleInput } from '../interfaces/ensemble.interface';
import {
  CreatePredictorData,
  PredictorDirection,
} from '../interfaces/predictor.interface';
import {
  ThresholdConfig,
  DEFAULT_THRESHOLD_CONFIG,
} from '../interfaces/threshold-evaluation.interface';

/**
 * Result of processing articles for a subscription
 */
export interface ArticleProcessResult {
  subscription_id: string;
  target_id: string;
  articles_processed: number;
  predictors_created: number;
  articles_skipped: number;
  errors: string[];
}

/**
 * Result of analyzing which instruments an article affects
 */
export interface InstrumentRelevanceResult {
  article_id: string;
  relevant_targets: Array<{
    target: Target;
    relevance_score: number;
    direction_hint: PredictorDirection;
  }>;
}

/**
 * ArticleProcessorService
 *
 * Processes articles from the central crawler and creates predictors directly.
 * This replaces the signals layer - articles go straight to predictors.
 *
 * Flow:
 * 1. Pull new articles from subscribed sources
 * 2. Analyze which instruments (targets) each article affects
 * 3. For each relevant instrument, run ensemble and create predictor
 * 4. Update the subscription watermark
 *
 * Key Changes from Signal-Based Approach:
 * - NO signals created - articles → predictors directly
 * - LLM determines instrument relevance (not keyword matching per target)
 * - Single article read, multiple predictors (only for relevant instruments)
 */
@Injectable()
export class ArticleProcessorService {
  private readonly logger = new Logger(ArticleProcessorService.name);
  private readonly config: ThresholdConfig = DEFAULT_THRESHOLD_CONFIG;

  constructor(
    private readonly subscriptionRepository: SourceSubscriptionRepository,
    private readonly predictorRepository: PredictorRepository,
    private readonly targetRepository: TargetRepository,
    private readonly ensembleService: AnalystEnsembleService,
    private readonly llmTierResolver: LlmTierResolverService,
    private readonly observabilityEventsService: ObservabilityEventsService,
  ) {}

  /**
   * Create execution context for observability events
   */
  private createObservabilityContext(taskId: string): ExecutionContext {
    return {
      orgSlug: 'system',
      userId: NIL_UUID,
      conversationId: NIL_UUID,
      taskId,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'article-processor',
      agentType: 'service',
      provider: NIL_UUID,
      model: NIL_UUID,
    };
  }

  /**
   * Process new articles for all active targets
   * This is the main entry point called by the runner
   */
  async processAllTargets(limit: number = 100): Promise<{
    articles_processed: number;
    predictors_created: number;
    targets_affected: number;
    errors: string[];
  }> {
    const result = {
      articles_processed: 0,
      predictors_created: 0,
      targets_affected: 0,
      errors: [] as string[],
    };

    try {
      // Get all active targets
      const targets = await this.targetRepository.findAllActive();
      if (targets.length === 0) {
        this.logger.debug('No active targets found');
        return result;
      }

      // Get unique articles across all subscriptions
      const processedArticleIds = new Set<string>();

      for (const target of targets) {
        // Skip test targets (T_ prefix)
        if (target.symbol.startsWith('T_')) continue;

        const subscriptions = await this.subscriptionRepository.findByTarget(
          target.id,
        );

        for (const subscription of subscriptions) {
          if (!subscription.is_active) continue;

          const articles = await this.subscriptionRepository.getNewArticles(
            subscription.id,
            limit,
          );

          for (const article of articles) {
            // Skip if already processed in this run
            if (processedArticleIds.has(article.id)) continue;
            processedArticleIds.add(article.id);

            try {
              const predictorCount = await this.processArticleForAllTargets(
                article,
                targets,
              );
              result.articles_processed++;
              result.predictors_created += predictorCount;
              if (predictorCount > 0) {
                result.targets_affected++;
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

          // Update watermark
          if (articles.length > 0) {
            const latestTime = new Date(
              Math.max(
                ...articles.map((a) => new Date(a.first_seen_at).getTime()),
              ),
            );
            await this.subscriptionRepository.updateWatermark(
              subscription.id,
              latestTime,
            );
          }
        }
      }

      this.logger.log(
        `Processed ${result.articles_processed} articles: ` +
          `${result.predictors_created} predictors created`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Processing failed: ${errorMessage}`);
      this.logger.error(`Failed to process articles: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Process a single article and determine which targets it affects
   * Creates predictors for each relevant target
   */
  async processArticleForAllTargets(
    article: CrawlerArticle,
    targets: Target[],
  ): Promise<number> {
    const taskId = `article-${article.id}-${Date.now()}`;
    const ctx = this.createObservabilityContext(taskId);

    // Analyze which instruments this article is relevant to
    const relevantTargets = await this.analyzeInstrumentRelevance(
      ctx,
      article,
      targets,
    );

    if (relevantTargets.length === 0) {
      this.logger.debug(
        `Article ${article.id} not relevant to any tracked instruments`,
      );
      return 0;
    }

    let predictorsCreated = 0;

    // For each relevant target, run ensemble and create predictor
    for (const { target, direction_hint } of relevantTargets) {
      try {
        const predictor = await this.createPredictorFromArticle(
          ctx,
          article,
          target,
          direction_hint,
        );
        if (predictor) {
          predictorsCreated++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to create predictor for ${target.symbol} from article ${article.id}: ${errorMessage}`,
        );
      }
    }

    // Emit observability event
    await this.observabilityEventsService.push({
      context: ctx,
      source_app: 'prediction-runner',
      hook_event_type: 'article.processed',
      status: predictorsCreated > 0 ? 'completed' : 'skipped',
      message: `Article processed: ${predictorsCreated} predictors created for ${relevantTargets.length} instruments`,
      progress: 100,
      step: 'article-processed',
      payload: {
        articleId: article.id,
        articleTitle: article.title,
        articleUrl: article.url,
        relevantInstruments: relevantTargets.map((t) => t.target.symbol),
        predictorsCreated,
      },
      timestamp: Date.now(),
    });

    return predictorsCreated;
  }

  /**
   * Analyze which instruments an article is relevant to
   * Uses keyword matching for efficiency, LLM could be added for more accuracy
   */
  private async analyzeInstrumentRelevance(
    ctx: ExecutionContext,
    article: CrawlerArticle,
    targets: Target[],
  ): Promise<
    Array<{
      target: Target;
      relevance_score: number;
      direction_hint: PredictorDirection;
    }>
  > {
    const text =
      `${article.title ?? ''} ${article.content ?? ''}`.toLowerCase();
    const relevant: Array<{
      target: Target;
      relevance_score: number;
      direction_hint: PredictorDirection;
    }> = [];

    for (const target of targets) {
      // Skip test targets
      if (target.symbol.startsWith('T_')) continue;

      // Check if article mentions this instrument
      const mentions = this.checkInstrumentMention(text, target);
      if (mentions.mentioned) {
        // Infer direction from content
        const direction = this.inferDirection(text);
        relevant.push({
          target,
          relevance_score: mentions.score,
          direction_hint: direction,
        });
      }
    }

    return relevant;
  }

  /**
   * Check if article mentions an instrument
   */
  private checkInstrumentMention(
    text: string,
    target: Target,
  ): { mentioned: boolean; score: number } {
    const symbol = target.symbol.toLowerCase();
    const name = target.name.toLowerCase();

    // Check for direct symbol mention
    const symbolPattern = new RegExp(`\\b${symbol}\\b`, 'i');
    const hasSymbol = symbolPattern.test(text);

    // Check for company name mention
    const hasName = text.includes(name);

    // Check for partial company name (first word)
    const firstName = name.split(' ')[0] || '';
    const hasFirstName = firstName.length > 3 && text.includes(firstName);

    if (hasSymbol) {
      return { mentioned: true, score: 1.0 };
    } else if (hasName) {
      return { mentioned: true, score: 0.9 };
    } else if (hasFirstName) {
      return { mentioned: true, score: 0.7 };
    }

    return { mentioned: false, score: 0 };
  }

  /**
   * Infer direction from article content using keyword analysis
   */
  private inferDirection(text: string): PredictorDirection {
    const bullishKeywords = [
      'surge',
      'rally',
      'soar',
      'jump',
      'spike',
      'breakout',
      'bullish',
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
      'crash',
      'plunge',
      'collapse',
      'tumble',
      'plummet',
      'bearish',
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

    if (bullishScore > bearishScore) return 'bullish';
    if (bearishScore > bullishScore) return 'bearish';
    return 'neutral';
  }

  /**
   * Create a predictor from an article for a specific target
   * Runs ensemble evaluation and creates predictor if approved
   */
  private async createPredictorFromArticle(
    ctx: ExecutionContext,
    article: CrawlerArticle,
    target: Target,
    directionHint: PredictorDirection,
  ): Promise<boolean> {
    // Resolve LLM provider/model
    const resolved = await this.llmTierResolver.resolveTier('silver');
    const ensembleCtx: ExecutionContext = {
      ...ctx,
      provider: resolved.provider,
      model: resolved.model,
    };

    // Build ensemble input from article
    const ensembleInput: EnsembleInput = {
      targetId: target.id,
      content: this.buildArticleContent(article),
      direction: directionHint,
      metadata: {
        article_id: article.id,
        article_title: article.title,
        article_url: article.url,
        source_id: article.source_id,
      },
    };

    // Run ensemble evaluation
    const ensembleResult = await this.ensembleService.runEnsemble(
      ensembleCtx,
      target,
      ensembleInput,
    );

    const { aggregated } = ensembleResult;

    // Determine if we should create a predictor
    // Threshold: confidence >= 0.5 and consensus_strength >= 0.6
    const shouldCreate =
      aggregated.confidence >= 0.5 && aggregated.consensus_strength >= 0.6;

    if (!shouldCreate) {
      this.logger.debug(
        `Article ${article.id} rejected for ${target.symbol}: ` +
          `confidence=${aggregated.confidence}, consensus=${aggregated.consensus_strength}`,
      );
      return false;
    }

    // Calculate strength from confidence (1-10 scale)
    const strength = Math.round(aggregated.confidence * 10);

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.config.predictor_ttl_hours);

    // Map direction
    const direction = this.mapDirection(aggregated.direction);

    // Extract key factors and risks from ensemble
    const keyFactors = ensembleResult.assessments
      .flatMap((a) => a.key_factors)
      .slice(0, 5);
    const risks = ensembleResult.assessments
      .flatMap((a) => a.risks)
      .slice(0, 5);

    const predictorData: CreatePredictorData = {
      article_id: article.id,
      target_id: target.id,
      direction,
      strength,
      confidence: aggregated.confidence,
      reasoning: aggregated.reasoning,
      analyst_slug: 'ensemble',
      analyst_assessment: {
        direction,
        confidence: aggregated.confidence,
        reasoning: aggregated.reasoning,
        key_factors: keyFactors,
        risks,
      },
      status: 'active',
      expires_at: expiresAt.toISOString(),
      is_test: article.is_test,
    };

    const predictor = await this.predictorRepository.create(predictorData);

    this.logger.log(
      `Created predictor ${predictor.id} for ${target.symbol} from article ${article.id} ` +
        `(direction: ${direction}, strength: ${strength})`,
    );

    // Emit predictor.created event
    await this.observabilityEventsService.push({
      context: ensembleCtx,
      source_app: 'prediction-runner',
      hook_event_type: 'predictor.created',
      status: 'completed',
      message: `Predictor created for ${target.symbol}: ${direction} (confidence: ${(aggregated.confidence * 100).toFixed(0)}%)`,
      progress: 100,
      step: 'predictor-created',
      payload: {
        predictorId: predictor.id,
        articleId: article.id,
        targetId: target.id,
        targetSymbol: target.symbol,
        direction,
        confidence: aggregated.confidence,
        strength,
        keyFactors,
        risks,
      },
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Build content string from article for ensemble evaluation
   */
  private buildArticleContent(article: CrawlerArticle): string {
    const parts = [
      `Title: ${article.title ?? 'Unknown'}`,
      `Source: ${article.source_id}`,
      `Content: ${article.content ?? article.summary ?? 'No content'}`,
    ];

    if (article.key_phrases && article.key_phrases.length > 0) {
      parts.push(`Key phrases: ${article.key_phrases.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Map ensemble direction to predictor direction type
   */
  private mapDirection(direction: string): PredictorDirection {
    const normalized = direction.toLowerCase();
    if (normalized === 'bullish' || normalized === 'up') return 'bullish';
    if (normalized === 'bearish' || normalized === 'down') return 'bearish';
    return 'neutral';
  }

  /**
   * Legacy method - process a specific target (kept for backward compatibility)
   * @deprecated Use processAllTargets instead
   */
  async processTarget(
    targetId: string,
    limit: number = 100,
  ): Promise<ArticleProcessResult> {
    const result: ArticleProcessResult = {
      subscription_id: 'all',
      target_id: targetId,
      articles_processed: 0,
      predictors_created: 0,
      articles_skipped: 0,
      errors: [],
    };

    try {
      const target = await this.targetRepository.findById(targetId);
      if (!target) {
        throw new Error(`Target not found: ${targetId}`);
      }

      const allTargets = await this.targetRepository.findAllActive();
      const subscriptions =
        await this.subscriptionRepository.findByTarget(targetId);

      for (const subscription of subscriptions) {
        if (!subscription.is_active) continue;

        const articles = await this.subscriptionRepository.getNewArticles(
          subscription.id,
          limit,
        );

        for (const article of articles) {
          try {
            const predictorCount = await this.processArticleForAllTargets(
              article,
              allTargets,
            );
            result.articles_processed++;
            result.predictors_created += predictorCount;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(
              `Failed to process article ${article.id}: ${errorMessage}`,
            );
          }
        }

        // Update watermark
        if (articles.length > 0) {
          const latestTime = new Date(
            Math.max(
              ...articles.map((a) => new Date(a.first_seen_at).getTime()),
            ),
          );
          await this.subscriptionRepository.updateWatermark(
            subscription.id,
            latestTime,
          );
        }
      }

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
   * Legacy method - process subscription (kept for backward compatibility)
   * @deprecated Use processAllTargets instead
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
    return this.processTarget(subscription.target_id, limit);
  }

  /**
   * Legacy method - process article for subscriptions
   * @deprecated Predictors are now created directly
   */
  async processArticleForSubscriptions(
    article: CrawlerServiceArticle,
    source: { id: string; organization_slug: string },
  ): Promise<number> {
    const targets = await this.targetRepository.findAllActive();
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

    return this.processArticleForAllTargets(crawlerArticle, targets);
  }
}
