import { Injectable, Logger } from '@nestjs/common';
import { SourceRepository } from '../repositories/source.repository';
import { SourceCrawlRepository } from '../repositories/source-crawl.repository';
import { SourceSeenItemRepository } from '../repositories/source-seen-item.repository';
import { SignalRepository } from '../repositories/signal.repository';
import { FirecrawlService } from './firecrawl.service';
import { ContentHashService } from './content-hash.service';
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

/**
 * SourceCrawlerService - Crawls sources and creates signals
 *
 * Handles:
 * - Web page scraping (via Firecrawl)
 * - RSS feed parsing
 * - Twitter/X search (via API)
 * - Generic API sources
 * - Content deduplication
 * - Signal creation from crawled content
 */
@Injectable()
export class SourceCrawlerService {
  private readonly logger = new Logger(SourceCrawlerService.name);

  constructor(
    private readonly sourceRepository: SourceRepository,
    private readonly sourceCrawlRepository: SourceCrawlRepository,
    private readonly sourceSeenItemRepository: SourceSeenItemRepository,
    private readonly signalRepository: SignalRepository,
    private readonly firecrawlService: FirecrawlService,
    private readonly contentHashService: ContentHashService,
  ) {}

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
  }> {
    // Create crawl record
    const crawl = await this.sourceCrawlRepository.create({
      source_id: source.id,
    });

    const startTime = Date.now();
    let result: CrawlResult;
    let signalsCreated = 0;
    let duplicatesSkipped = 0;

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
        default: {
          const sourceType: string = source.source_type;
          throw new Error(`Unknown source type: ${sourceType}`);
        }
      }

      if (!result.success) {
        throw new Error(result.error || 'Crawl failed');
      }

      // Process crawled items
      for (const item of result.items) {
        const { isNew, signalId } = await this.processItem(
          source,
          item,
          targetId,
        );

        if (isNew && signalId) {
          signalsCreated++;
        } else if (!isNew) {
          duplicatesSkipped++;
        }
      }

      // Mark crawl success
      await this.sourceCrawlRepository.markSuccess(crawl.id, {
        items_found: result.items.length,
        signals_created: signalsCreated,
        duplicates_skipped: duplicatesSkipped,
        crawl_duration_ms: Date.now() - startTime,
      });

      // Update source status
      await this.sourceRepository.markCrawlSuccess(source.id);

      return {
        crawl: await this.sourceCrawlRepository.findByIdOrThrow(crawl.id),
        result,
        signalsCreated,
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
      };
    }
  }

  /**
   * Process a crawled item - deduplicate and create signal if new
   */
  private async processItem(
    source: Source,
    item: CrawledItem,
    targetId: string,
  ): Promise<{ isNew: boolean; signalId?: string }> {
    // Generate content hash
    const contentHash = this.contentHashService.hashArticle(
      item.title || '',
      item.content,
    );

    // Check if we've seen this content before
    const { isNew, seenItem } = await this.sourceSeenItemRepository.markSeen(
      source.id,
      contentHash,
      item.url,
      undefined,
      item.metadata,
    );

    if (!isNew) {
      this.logger.debug(
        `Skipping duplicate content: ${contentHash.substring(0, 8)}...`,
      );
      return { isNew: false };
    }

    // Create signal from item
    const signalData: CreateSignalData = {
      target_id: targetId,
      source_id: source.id,
      content: this.formatSignalContent(item),
      direction: this.inferDirection(item.content),
      detected_at: item.published_at || new Date().toISOString(),
      url: item.url,
      metadata: {
        title: item.title,
        source_type: source.source_type,
        content_hash: contentHash,
        ...item.metadata,
      },
    };

    const signal = await this.signalRepository.create(signalData);

    // Update seen item with signal ID
    if (seenItem) {
      // Note: We don't have an update method for signal_id, but it's stored in metadata
      this.logger.debug(
        `Created signal ${signal.id} for content ${contentHash.substring(0, 8)}...`,
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
