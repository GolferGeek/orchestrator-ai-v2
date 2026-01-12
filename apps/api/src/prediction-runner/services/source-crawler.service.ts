import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { SourceRepository } from '../repositories/source.repository';
import { SourceCrawlRepository } from '../repositories/source-crawl.repository';
import { SourceSeenItemRepository } from '../repositories/source-seen-item.repository';
import { SignalRepository } from '../repositories/signal.repository';
import { SignalFingerprintRepository } from '../repositories/signal-fingerprint.repository';
import { FirecrawlService } from './firecrawl.service';
import { ContentHashService } from './content-hash.service';
import { TestDbSourceCrawlerService } from './test-db-source-crawler.service';
import { Source, SourceCrawl } from '../interfaces/source.interface';
import {
  CrawledItem,
  CrawlResult,
  RssFeedItem,
} from '../interfaces/crawl-config.interface';
import {
  CreateSignalData,
  SignalDirection,
} from '../interfaces/signal.interface';
import {
  DeduplicationMetrics,
  ProcessItemResult,
} from '../interfaces/signal-fingerprint.interface';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';

/**
 * Default deduplication configuration
 */
const DEFAULT_DEDUP_CONFIG = {
  fuzzy_dedup_enabled: true,
  cross_source_dedup: true,
  title_similarity_threshold: 0.85,
  phrase_overlap_threshold: 0.7,
  dedup_hours_back: 72,
};

/**
 * SourceCrawlerService - Crawls sources and creates signals
 *
 * Handles:
 * - Web page scraping (via Firecrawl)
 * - RSS feed parsing
 * - Twitter/X search (via API)
 * - Generic API sources
 * - DB-backed test articles (test_db) - Phase 2 Test Input Infrastructure
 * - 4-Layer Content Deduplication
 * - Signal creation from crawled content
 *
 * DEDUPLICATION LAYERS (PRD Phase 2):
 * - Layer 1: Exact hash match within same source
 * - Layer 2: Cross-source hash check for same target
 * - Layer 3: Fuzzy title matching (Jaccard similarity > 0.85)
 * - Layer 4: Key phrase overlap (> 70% overlap)
 *
 * TEST DATA ISOLATION (PRD Phase 2):
 * - INV-02: Signals from is_test=true sources MUST have is_test=true
 * - INV-04: Test predictors can ONLY affect T_ prefixed targets
 * - test_db sources automatically set is_test=true on all signals
 */
@Injectable()
export class SourceCrawlerService {
  private readonly logger = new Logger(SourceCrawlerService.name);

  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly sourceCrawlRepository: SourceCrawlRepository,
    private readonly sourceSeenItemRepository: SourceSeenItemRepository,
    private readonly signalRepository: SignalRepository,
    private readonly signalFingerprintRepository: SignalFingerprintRepository,
    private readonly firecrawlService: FirecrawlService,
    private readonly contentHashService: ContentHashService,
    @Inject(forwardRef(() => TestDbSourceCrawlerService))
    private readonly testDbSourceCrawlerService: TestDbSourceCrawlerService,
    private readonly observabilityEventsService: ObservabilityEventsService,
  ) {}

  /**
   * Create execution context for observability events
   */
  private createObservabilityContext(sourceId: string): ExecutionContext {
    return {
      orgSlug: 'system',
      userId: NIL_UUID,
      conversationId: NIL_UUID,
      taskId: `source-crawl-${sourceId}-${Date.now()}`,
      planId: NIL_UUID,
      deliverableId: NIL_UUID,
      agentSlug: 'source-crawler',
      agentType: 'service',
      provider: NIL_UUID,
      model: NIL_UUID,
    };
  }

  /**
   * Crawl a source and create signals from new content
   *
   * @param source - Source to crawl
   * @param targetId - Target ID for created signals
   * @returns Crawl result with statistics
   */
  async crawlSource(
    source: Source,
    targetId: string,
  ): Promise<{
    crawl: SourceCrawl;
    result: CrawlResult;
    signalsCreated: number;
    dedupMetrics: DeduplicationMetrics;
  }> {
    // Create crawl record
    const crawl = await this.sourceCrawlRepository.create({
      source_id: source.id,
    });

    const startTime = Date.now();
    let result: CrawlResult;
    let signalsCreated = 0;

    // Initialize dedup metrics
    const dedupMetrics: DeduplicationMetrics = {
      duplicates_exact: 0,
      duplicates_cross_source: 0,
      duplicates_fuzzy_title: 0,
      duplicates_phrase_overlap: 0,
    };

    // Track article IDs for test_db sources (to mark as processed)
    let testDbArticleIds: string[] = [];

    try {
      // Crawl based on source type
      switch (source.source_type) {
        case 'web':
          result = await this.firecrawlService.scrapeSource(source);
          break;
        case 'rss':
          result = await this.crawlRss(source);
          break;
        case 'twitter_search':
          result = await this.crawlTwitter(source);
          break;
        case 'api':
          result = await this.crawlApi(source);
          break;
        case 'test_db': {
          // Phase 2: DB-backed test article crawling
          const testDbResult =
            await this.testDbSourceCrawlerService.crawlTestDbSource(source);
          result = testDbResult;
          testDbArticleIds = testDbResult.article_ids;
          break;
        }
        default: {
          const sourceType: string = source.source_type;
          throw new Error(`Unknown source type: ${sourceType}`);
        }
      }

      if (!result.success) {
        throw new Error(result.error || 'Crawl failed');
      }

      // Process crawled items with 4-layer deduplication
      for (const item of result.items) {
        const processResult = await this.processItem(source, item, targetId);

        if (processResult.isNew && processResult.signalId) {
          signalsCreated++;
        } else if (!processResult.isNew && processResult.reason) {
          // Track dedup metrics by layer
          switch (processResult.reason) {
            case 'exact_hash_match':
              dedupMetrics.duplicates_exact++;
              break;
            case 'cross_source_duplicate':
              dedupMetrics.duplicates_cross_source++;
              break;
            case 'fuzzy_title_match':
              dedupMetrics.duplicates_fuzzy_title++;
              break;
            case 'phrase_overlap':
              dedupMetrics.duplicates_phrase_overlap++;
              break;
          }
        }
      }

      const totalDuplicates =
        dedupMetrics.duplicates_exact +
        dedupMetrics.duplicates_cross_source +
        dedupMetrics.duplicates_fuzzy_title +
        dedupMetrics.duplicates_phrase_overlap;

      // Mark crawl success with dedup metrics
      await this.sourceCrawlRepository.markSuccess(crawl.id, {
        items_found: result.items.length,
        items_new: signalsCreated,
        signals_created: signalsCreated,
        duplicates_skipped: totalDuplicates,
        duplicates_exact: dedupMetrics.duplicates_exact,
        duplicates_cross_source: dedupMetrics.duplicates_cross_source,
        duplicates_fuzzy_title: dedupMetrics.duplicates_fuzzy_title,
        duplicates_phrase_overlap: dedupMetrics.duplicates_phrase_overlap,
        crawl_duration_ms: Date.now() - startTime,
      });

      // Update source status
      await this.sourceRepository.markCrawlSuccess(source.id);

      // Mark test_db articles as processed after successful crawl
      if (
        source.source_type === 'test_db' &&
        testDbArticleIds.length > 0 &&
        signalsCreated > 0
      ) {
        await this.testDbSourceCrawlerService.markArticlesProcessed(
          testDbArticleIds,
        );
      }

      return {
        crawl: await this.sourceCrawlRepository.findByIdOrThrow(crawl.id),
        result,
        signalsCreated,
        dedupMetrics,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Mark crawl error
      await this.sourceCrawlRepository.markError(
        crawl.id,
        errorMessage,
        Date.now() - startTime,
      );

      // Update source status
      await this.sourceRepository.markCrawlError(source.id, errorMessage);

      return {
        crawl: await this.sourceCrawlRepository.findByIdOrThrow(crawl.id),
        result: {
          success: false,
          source_id: source.id,
          items: [],
          error: errorMessage,
          duration_ms: Date.now() - startTime,
        },
        signalsCreated: 0,
        dedupMetrics,
      };
    }
  }

  /**
   * Process a crawled item with 4-layer deduplication
   *
   * Layer 1: Exact hash match (same source)
   * Layer 2: Cross-source hash check
   * Layer 3: Fuzzy title matching (Jaccard similarity)
   * Layer 4: Key phrase overlap
   */
  private async processItem(
    source: Source,
    item: CrawledItem,
    targetId: string,
  ): Promise<ProcessItemResult> {
    // Get dedup config with defaults
    const config = {
      ...DEFAULT_DEDUP_CONFIG,
      ...source.crawl_config,
    };

    const title = item.title || '';
    const content = item.content;

    // Generate content hash
    const contentHash = this.contentHashService.hashArticle(title, content);

    // Generate normalized title and key phrases for fuzzy matching
    const titleNormalized = this.contentHashService.normalizeContent(title);
    const keyPhrases = this.contentHashService.extractKeyPhrases(content, 15);
    const fingerprintHash = this.contentHashService.hash(keyPhrases.join('|'));

    // ═══════════════════════════════════════════════════════════════════
    // LAYER 1: Exact hash match (same source)
    // ═══════════════════════════════════════════════════════════════════
    const { isNew, seenItem } = await this.sourceSeenItemRepository.markSeen(
      source.id,
      contentHash,
      item.url,
      undefined,
      {
        ...item.metadata,
        title_normalized: titleNormalized,
        key_phrases: keyPhrases,
        fingerprint_hash: fingerprintHash,
      },
    );

    if (!isNew) {
      this.logger.debug(
        `[Layer 1] Exact hash duplicate: ${contentHash.substring(0, 8)}...`,
      );
      return { isNew: false, reason: 'exact_hash_match' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // LAYER 2: Cross-source hash check
    // ═══════════════════════════════════════════════════════════════════
    if (config.cross_source_dedup) {
      const seenInOtherSource =
        await this.sourceSeenItemRepository.hasBeenSeenForTarget(
          contentHash,
          targetId,
        );

      if (seenInOtherSource) {
        this.logger.debug(
          `[Layer 2] Cross-source duplicate: ${contentHash.substring(0, 8)}...`,
        );
        return { isNew: false, reason: 'cross_source_duplicate' };
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LAYERS 3 & 4: Fuzzy matching (only if enabled)
    // ═══════════════════════════════════════════════════════════════════
    if (config.fuzzy_dedup_enabled) {
      // Get recent fingerprints for fuzzy comparison
      const recentFingerprints =
        await this.signalFingerprintRepository.findRecentForTarget(
          targetId,
          config.dedup_hours_back,
          100,
        );

      // ═══════════════════════════════════════════════════════════════════
      // LAYER 3: Fuzzy title matching (Jaccard similarity)
      // ═══════════════════════════════════════════════════════════════════
      for (const fp of recentFingerprints) {
        if (
          this.contentHashService.isSimilar(
            titleNormalized,
            fp.title_normalized,
            config.title_similarity_threshold,
          )
        ) {
          this.logger.debug(
            `[Layer 3] Fuzzy title match with signal ${fp.signal_id}`,
          );
          return {
            isNew: false,
            reason: 'fuzzy_title_match',
            similarSignalId: fp.signal_id,
          };
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // LAYER 4: Key phrase overlap
      // ═══════════════════════════════════════════════════════════════════
      if (keyPhrases.length > 0) {
        const candidates =
          await this.signalFingerprintRepository.findByPhraseOverlap(
            targetId,
            keyPhrases,
            config.dedup_hours_back,
            50,
          );

        for (const candidate of candidates) {
          // Calculate overlap percentage
          const overlapPercentage = candidate.overlap_count / keyPhrases.length;

          if (overlapPercentage >= config.phrase_overlap_threshold) {
            this.logger.debug(
              `[Layer 4] Phrase overlap (${(overlapPercentage * 100).toFixed(1)}%) with signal ${candidate.signal_id}`,
            );
            return {
              isNew: false,
              reason: 'phrase_overlap',
              similarSignalId: candidate.signal_id,
            };
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PASSED ALL LAYERS - Create new signal
    // ═══════════════════════════════════════════════════════════════════

    // Determine is_test flag: INV-02 - Signals from test sources MUST be is_test=true
    // Test sources include: is_test=true flag OR test_db source type
    const isTestSignal =
      source.is_test === true || source.source_type === 'test_db';

    // Extract scenario_run_id from item metadata if present (for test data lineage)
    const scenarioRunId =
      (item.metadata?.scenario_run_id as string) ||
      (item.metadata?.scenario_id as string) ||
      undefined;

    const signalData: CreateSignalData = {
      target_id: targetId,
      source_id: source.id,
      content: this.formatSignalContent(item),
      direction: this.inferDirection(content),
      detected_at: item.published_at || new Date().toISOString(),
      url: item.url,
      metadata: {
        title: title,
        source_type: source.source_type,
        content_hash: contentHash,
        // Propagate is_test flag in metadata for downstream processing
        is_test: isTestSignal,
        // Include scenario_run_id for test data lineage (INV-10)
        ...(scenarioRunId && { scenario_run_id: scenarioRunId }),
        ...item.metadata,
      },
      // Set is_test flag on signal (INV-02 compliance)
      is_test: isTestSignal,
      // Link to scenario run for test data (INV-10)
      scenario_run_id: scenarioRunId,
    };

    const signal = await this.signalRepository.create(signalData);

    // Create fingerprint for future deduplication
    await this.signalFingerprintRepository.create({
      signal_id: signal.id,
      target_id: targetId,
      title_normalized: titleNormalized,
      key_phrases: keyPhrases,
      fingerprint_hash: fingerprintHash,
    });

    this.logger.debug(
      `Created signal ${signal.id} for content ${contentHash.substring(0, 8)}...`,
    );

    // Emit article.discovered event for observability
    const ctx = this.createObservabilityContext(source.id);
    await this.observabilityEventsService.push({
      context: ctx,
      source_app: 'prediction-runner',
      hook_event_type: 'article.discovered',
      status: 'discovered',
      message: `New article discovered: ${title.substring(0, 100)}${title.length > 100 ? '...' : ''}`,
      progress: null,
      step: 'article-discovered',
      payload: {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.source_type,
        targetId,
        signalId: signal.id,
        articleTitle: title,
        articleUrl: item.url,
        isTest: isTestSignal,
        direction: signal.direction,
      },
      timestamp: Date.now(),
    });

    // Update seen item with signal ID if we have the seenItem
    if (seenItem) {
      // The signal_id is stored in metadata for tracking
      this.logger.debug(
        `Linked signal ${signal.id} to seen item ${seenItem.id}`,
      );
    }

    return { isNew: true, signalId: signal.id };
  }

  /**
   * Format signal content from crawled item
   */
  private formatSignalContent(item: CrawledItem): string {
    const parts: string[] = [];

    if (item.title) {
      parts.push(`# ${item.title}`);
      parts.push('');
    }

    parts.push(item.content);

    if (item.url) {
      parts.push('');
      parts.push(`Source: ${item.url}`);
    }

    return parts.join('\n');
  }

  /**
   * Infer signal direction from content
   * This is a basic heuristic - actual direction determination
   * is done by the analyst ensemble during signal detection
   */
  private inferDirection(content: string): SignalDirection {
    const lowerContent = content.toLowerCase();

    // Count positive vs negative indicators
    const positiveTerms = [
      'bullish',
      'surge',
      'soar',
      'rally',
      'gain',
      'growth',
      'beat',
      'exceed',
      'strong',
      'positive',
      'upgrade',
      'buy',
      'outperform',
      'breakout',
      'moon',
    ];

    const negativeTerms = [
      'bearish',
      'plunge',
      'crash',
      'fall',
      'drop',
      'decline',
      'miss',
      'weak',
      'negative',
      'downgrade',
      'sell',
      'underperform',
      'breakdown',
      'dump',
    ];

    let positiveScore = 0;
    let negativeScore = 0;

    for (const term of positiveTerms) {
      if (lowerContent.includes(term)) {
        positiveScore++;
      }
    }

    for (const term of negativeTerms) {
      if (lowerContent.includes(term)) {
        negativeScore++;
      }
    }

    if (positiveScore > negativeScore) {
      return 'bullish';
    } else if (negativeScore > positiveScore) {
      return 'bearish';
    }

    return 'neutral';
  }

  /**
   * Crawl an RSS feed
   */
  private async crawlRss(source: Source): Promise<CrawlResult> {
    const startTime = Date.now();

    try {
      // Fetch RSS feed
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'OrchestratorAI/1.0 RSS Reader',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          source_id: source.id,
          items: [],
          error: `RSS fetch failed: ${response.status}`,
          duration_ms: Date.now() - startTime,
        };
      }

      const text = await response.text();
      const items = this.parseRss(text);

      const crawledItems: CrawledItem[] = items.map((item) => ({
        content: item.content || item.description || '',
        title: item.title || null,
        url: item.link || source.url,
        published_at: item.pubDate || null,
        metadata: {
          author: item.author,
          categories: item.categories,
          guid: item.guid,
        },
      }));

      return {
        success: true,
        source_id: source.id,
        items: crawledItems,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        source_id: source.id,
        items: [],
        error: error instanceof Error ? error.message : 'RSS crawl failed',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Parse RSS XML into items
   * Note: This is a basic parser - consider using a library like rss-parser
   */
  private parseRss(xml: string): RssFeedItem[] {
    const items: RssFeedItem[] = [];

    // Basic regex-based parsing (simplified)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1] ?? '';

      const getTag = (tag: string): string | undefined => {
        const tagMatch = new RegExp(
          `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
          'i',
        ).exec(itemXml);
        return tagMatch?.[1]?.trim();
      };

      items.push({
        title: getTag('title'),
        description: getTag('description'),
        content: getTag('content:encoded') || getTag('content'),
        link: getTag('link'),
        pubDate: getTag('pubDate'),
        author: getTag('author') || getTag('dc:creator'),
        guid: getTag('guid'),
      });
    }

    return items;
  }

  /**
   * Crawl Twitter/X search
   * Note: Requires Twitter API credentials
   */
  private crawlTwitter(source: Source): Promise<CrawlResult> {
    const startTime = Date.now();

    // TODO: Implement Twitter API integration
    this.logger.warn('Twitter crawling not yet implemented');

    return Promise.resolve({
      success: false,
      source_id: source.id,
      items: [],
      error: 'Twitter crawling not yet implemented',
      duration_ms: Date.now() - startTime,
    });
  }

  /**
   * Crawl a generic API source
   */
  private async crawlApi(source: Source): Promise<CrawlResult> {
    const startTime = Date.now();

    try {
      // Build headers from auth config
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...source.crawl_config.headers,
      };

      // TODO: Add auth header handling

      const response = await fetch(source.url, { headers });

      if (!response.ok) {
        return {
          success: false,
          source_id: source.id,
          items: [],
          error: `API fetch failed: ${response.status}`,
          duration_ms: Date.now() - startTime,
        };
      }

      const data: unknown = await response.json();

      // Assume API returns array of items or object with items array
      let rawItems: Record<string, unknown>[] = [];
      if (Array.isArray(data)) {
        rawItems = data as Record<string, unknown>[];
      } else if (data && typeof data === 'object') {
        const dataObj = data as Record<string, unknown>;
        const items = dataObj.items || dataObj.data || dataObj.results || [];
        rawItems = Array.isArray(items)
          ? (items as Record<string, unknown>[])
          : [];
      }

      const crawledItems: CrawledItem[] = rawItems.map(
        (item: Record<string, unknown>) => ({
          content:
            (item.content as string) ||
            (item.text as string) ||
            (item.body as string) ||
            JSON.stringify(item),
          title: (item.title as string) || null,
          url: (item.url as string) || (item.link as string) || source.url,
          published_at:
            (item.published_at as string) ||
            (item.created_at as string) ||
            (item.date as string) ||
            null,
          metadata: item,
        }),
      );

      return {
        success: true,
        source_id: source.id,
        items: crawledItems,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        source_id: source.id,
        items: [],
        error: error instanceof Error ? error.message : 'API crawl failed',
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Test crawl a source without creating signals
   * Used for source configuration validation
   */
  async testCrawl(source: Source): Promise<{
    success: boolean;
    items: CrawledItem[];
    preview: string;
    error?: string;
    duration_ms: number;
  }> {
    const startTime = Date.now();

    let result: CrawlResult;

    switch (source.source_type) {
      case 'web':
        result = await this.firecrawlService.scrapeSource(source);
        break;
      case 'rss':
        result = await this.crawlRss(source);
        break;
      case 'api':
        result = await this.crawlApi(source);
        break;
      case 'test_db':
        result =
          await this.testDbSourceCrawlerService.crawlTestDbSource(source);
        break;
      default:
        return {
          success: false,
          items: [],
          preview: '',
          error: `Unsupported source type: ${source.source_type}`,
          duration_ms: Date.now() - startTime,
        };
    }

    // Generate preview
    let preview = '';
    const firstItem = result.items[0];
    if (firstItem) {
      preview = `Title: ${firstItem.title || 'N/A'}\n\nContent Preview:\n${firstItem.content.substring(0, 500)}...`;
    }

    return {
      success: result.success,
      items: result.items,
      preview,
      error: result.error,
      duration_ms: Date.now() - startTime,
    };
  }
}
