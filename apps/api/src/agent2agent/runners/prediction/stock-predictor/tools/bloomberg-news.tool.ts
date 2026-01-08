/**
 * Bloomberg News Tool
 *
 * Fetches stock news from Bloomberg RSS feeds.
 * Extracts news headlines, summaries, and timestamps as claims.
 *
 * FEATURES:
 * - Real-time financial news from Bloomberg
 * - Company-specific news filtering
 * - High confidence news claims from reputable source
 *
 * LIMITATIONS:
 * - RSS feed may not have all companies
 * - Limited to recent articles (typically last 24 hours)
 * - May require rate limiting to avoid blocking
 *
 * @module bloomberg-news.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * RSS feed item structure
 */
interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  guid?: string;
}

/**
 * RSS channel structure
 */
interface RssChannel {
  item?: RssItem[];
}

/**
 * RSS root structure
 */
interface RssFeed {
  rss?: {
    channel?: RssChannel;
  };
}

/**
 * Bloomberg News Tool configuration
 */
export interface BloombergNewsToolConfig extends ToolConfig {
  /** RSS feed URL (default: Bloomberg markets feed) */
  feedUrl?: string;

  /** Max articles to process per call */
  maxArticles?: number;
}

/**
 * Bloomberg News Tool
 *
 * Fetches financial news from Bloomberg RSS feeds.
 * Creates news claims for relevant stock mentions.
 *
 * @example
 * ```typescript
 * const tool = new BloombergNewsTool();
 * const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);
 * // Returns sources with news claims for matching articles
 * ```
 */
@Injectable()
export class BloombergNewsTool extends BasePredictionTool {
  readonly name = 'bloomberg-news';
  readonly description = 'Fetches financial news from Bloomberg RSS feeds';

  private readonly feedUrl: string;
  private readonly maxArticles: number;
  private readonly timeoutMs: number;

  constructor(config: BloombergNewsToolConfig = {}) {
    super();
    this.feedUrl =
      config.feedUrl || 'https://feeds.bloomberg.com/markets/news.rss';
    this.maxArticles = config.maxArticles ?? 50;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Fetch RSS feed from Bloomberg.
   */
  protected async fetchData(_instruments: string[]): Promise<RssFeed> {
    this.logger.debug(`Fetching Bloomberg RSS feed: ${this.feedUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.feedUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Bloomberg RSS fetch failed: ${response.status} ${response.statusText}`,
        );
      }

      const xmlText = await response.text();
      const feed = this.parseXml(xmlText);

      return feed;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Bloomberg RSS request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse RSS feed into sources with news claims.
   */
  protected parseResponse(feed: RssFeed, instruments: string[]): Source[] {
    const sources: Source[] = [];
    const items = feed.rss?.channel?.item || [];

    this.logger.debug(
      `Parsing ${items.length} Bloomberg articles for ${instruments.length} instruments`,
    );

    // Create a regex pattern to match any of the instruments
    const instrumentPattern = new RegExp(
      `\\b(${instruments.join('|')})\\b`,
      'gi',
    );

    // Process each article
    for (const item of items.slice(0, this.maxArticles)) {
      if (!item.title || !item.link) {
        continue;
      }

      // Check if article mentions any of our instruments
      const titleMatches = item.title.match(instrumentPattern) || [];
      const descMatches = item.description?.match(instrumentPattern) || [];
      const matchedInstruments = new Set([
        ...titleMatches.map((m) => m.toUpperCase()),
        ...descMatches.map((m) => m.toUpperCase()),
      ]);

      // If this article mentions any of our instruments, create claims
      if (matchedInstruments.size > 0) {
        const claims: Claim[] = [];
        const publishedAt = item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString();

        // Create a news claim for each mentioned instrument
        for (const instrument of Array.from(matchedInstruments)) {
          claims.push(
            this.createClaim('news', instrument, item.title, {
              confidence: 0.9, // High confidence from Bloomberg
              timestamp: publishedAt,
              metadata: {
                headline: item.title,
                summary: item.description || '',
                url: item.link,
                source: 'Bloomberg',
              },
            }),
          );
        }

        if (claims.length > 0) {
          sources.push(
            this.createSource(claims, {
              articleUrl: item.link,
              articleTitle: item.title,
              publishedAt,
              metadata: {
                source: 'Bloomberg',
                matchedInstruments: Array.from(matchedInstruments),
              },
            }),
          );
        }
      }
    }

    this.logger.debug(
      `Found ${sources.length} Bloomberg articles mentioning tracked instruments`,
    );

    return sources;
  }

  /**
   * Parse XML string into RSS feed object.
   * Simple XML parser for RSS feeds (no external dependencies).
   */
  private parseXml(xmlText: string): RssFeed {
    const items: RssItem[] = [];

    // Extract all <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      const itemContent = itemMatch[1];
      if (!itemContent) continue;

      const item: RssItem = {};
      const title = this.extractTag(itemContent, 'title');
      const description = this.extractTag(itemContent, 'description');
      const link = this.extractTag(itemContent, 'link');
      const pubDate = this.extractTag(itemContent, 'pubDate');
      const guid = this.extractTag(itemContent, 'guid');

      if (title) item.title = title;
      if (description) item.description = description;
      if (link) item.link = link;
      if (pubDate) item.pubDate = pubDate;
      if (guid) item.guid = guid;

      items.push(item);
    }

    return {
      rss: {
        channel: {
          item: items,
        },
      },
    };
  }

  /**
   * Extract content from an XML tag.
   */
  private extractTag(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(
      `<${tagName}(?:[^>]*)>([\\s\\S]*?)<\\/${tagName}>`,
      'i',
    );
    const match = xml.match(regex);
    if (!match || !match[1]) return undefined;

    // Decode HTML entities and strip CDATA
    let content = match[1].trim();
    content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    content = this.decodeHtmlEntities(content);

    return content;
  }

  /**
   * Decode common HTML entities.
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }
}
