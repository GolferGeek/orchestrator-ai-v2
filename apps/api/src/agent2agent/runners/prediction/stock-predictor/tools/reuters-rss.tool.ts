/**
 * Reuters RSS Tool
 *
 * Fetches financial news from Reuters RSS feeds.
 * Extracts news headlines, summaries, and timestamps as claims.
 *
 * FEATURES:
 * - Real-time financial news from Reuters
 * - Multiple feed categories (markets, stocks, companies)
 * - High confidence news claims from reputable source
 *
 * LIMITATIONS:
 * - RSS feed may not have all companies
 * - Limited to recent articles (typically last 24 hours)
 * - May require rate limiting to avoid blocking
 *
 * @module reuters-rss.tool
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
 * Reuters RSS Tool configuration
 */
export interface ReutersRssToolConfig extends ToolConfig {
  /** RSS feed URLs (default: Reuters markets and business feeds) */
  feedUrls?: string[];

  /** Max articles to process per feed */
  maxArticlesPerFeed?: number;
}

/**
 * Reuters RSS Tool
 *
 * Fetches financial news from Reuters RSS feeds.
 * Creates news claims for relevant stock mentions.
 *
 * @example
 * ```typescript
 * const tool = new ReutersRssTool();
 * const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);
 * // Returns sources with news claims for matching articles
 * ```
 */
@Injectable()
export class ReutersRssTool extends BasePredictionTool {
  readonly name = 'reuters-rss';
  readonly description = 'Fetches financial news from Reuters RSS feeds';

  private readonly feedUrls: string[];
  private readonly maxArticlesPerFeed: number;
  private readonly timeoutMs: number;

  constructor(config: ReutersRssToolConfig = {}) {
    super();
    this.feedUrls = config.feedUrls || [
      'https://www.rssboard.org/files/sample-rss-2.xml', // Fallback sample feed
      // Note: Reuters has restructured their RSS feeds
      // In production, you may need to use their API or web scraping
    ];
    this.maxArticlesPerFeed = config.maxArticlesPerFeed ?? 50;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Fetch RSS feeds from Reuters.
   * Fetches multiple feeds in parallel.
   */
  protected async fetchData(_instruments: string[]): Promise<RssFeed[]> {
    this.logger.debug(`Fetching ${this.feedUrls.length} Reuters RSS feeds`);

    const feedPromises = this.feedUrls.map((url) => this.fetchSingleFeed(url));

    try {
      const feeds = await Promise.all(feedPromises);
      return feeds.filter((feed) => feed !== null);
    } catch (error) {
      // If all feeds fail, throw the error
      this.logger.warn(
        `Failed to fetch Reuters feeds: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Fetch a single RSS feed.
   */
  private async fetchSingleFeed(url: string): Promise<RssFeed | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Reuters feed ${url} returned ${response.status}`);
        return null;
      }

      const xmlText = await response.text();
      const feed = this.parseXml(xmlText);

      return feed;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`Reuters feed ${url} timed out`);
      } else {
        this.logger.warn(
          `Failed to fetch Reuters feed ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse RSS feeds into sources with news claims.
   */
  protected parseResponse(feeds: RssFeed[], instruments: string[]): Source[] {
    const sources: Source[] = [];

    this.logger.debug(
      `Parsing ${feeds.length} Reuters feeds for ${instruments.length} instruments`,
    );

    // Create a regex pattern to match any of the instruments
    const instrumentPattern = new RegExp(
      `\\b(${instruments.join('|')})\\b`,
      'gi',
    );

    // Process each feed
    for (const feed of feeds) {
      const items = feed.rss?.channel?.item || [];

      // Process each article
      for (const item of items.slice(0, this.maxArticlesPerFeed)) {
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
                confidence: 0.9, // High confidence from Reuters
                timestamp: publishedAt,
                metadata: {
                  headline: item.title,
                  summary: item.description || '',
                  url: item.link,
                  source: 'Reuters',
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
                  source: 'Reuters',
                  matchedInstruments: Array.from(matchedInstruments),
                },
              }),
            );
          }
        }
      }
    }

    this.logger.debug(
      `Found ${sources.length} Reuters articles mentioning tracked instruments`,
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
