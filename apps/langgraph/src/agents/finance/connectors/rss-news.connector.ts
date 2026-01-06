/**
 * RSS News Connector
 *
 * Free open-source news ingestion via RSS feeds.
 * Aggregates multiple financial news RSS sources.
 */

import { NewsConnector } from "./connector.interface";
import { NewsItem } from "../finance.state";
import { v4 as uuidv4 } from "uuid";

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

interface RSSChannel {
  title?: string;
  item?: RSSItem | RSSItem[];
}

interface RSSFeed {
  rss?: {
    channel?: RSSChannel;
  };
}

// Default financial news RSS feeds (free, publicly available)
const DEFAULT_RSS_FEEDS = [
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
  },
  {
    name: "MarketWatch",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
  },
  {
    name: "Reuters Business",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
  },
  {
    name: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
];

export class RSSNewsConnector implements NewsConnector {
  readonly name = "rss-aggregator";
  private readonly feeds: Array<{ name: string; url: string }>;

  constructor(customFeeds?: Array<{ name: string; url: string }>) {
    this.feeds = customFeeds || DEFAULT_RSS_FEEDS;
  }

  isConfigured(): boolean {
    return this.feeds.length > 0;
  }

  async fetchNews(
    since: string,
    keywords?: string[],
    sources?: string[],
  ): Promise<NewsItem[]> {
    const newsItems: NewsItem[] = [];
    const sinceDate = new Date(since);

    const feedsToFetch = sources
      ? this.feeds.filter((f) =>
          sources.some((s) => f.name.toLowerCase().includes(s.toLowerCase())),
        )
      : this.feeds;

    for (const feed of feedsToFetch) {
      try {
        const items = await this.fetchRSSFeed(feed.url, feed.name);

        for (const item of items) {
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();

          if (pubDate < sinceDate) {
            continue;
          }

          // Filter by keywords if provided
          if (keywords && keywords.length > 0) {
            const content =
              `${item.title || ""} ${item.description || ""}`.toLowerCase();
            const hasKeyword = keywords.some((kw) =>
              content.includes(kw.toLowerCase()),
            );
            if (!hasKeyword) {
              continue;
            }
          }

          newsItems.push({
            id: uuidv4(),
            source: feed.name,
            publishedAt: pubDate.toISOString(),
            url: item.link,
            title: item.title || "Untitled",
            snippet: this.cleanSnippet(item.description || ""),
          });
        }
      } catch (error) {
        console.warn(`RSS: Failed to fetch from ${feed.name}:`, error);
      }
    }

    // Sort by publish date, most recent first
    return newsItems.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  async fetchNewsForInstruments(
    symbols: string[],
    since: string,
  ): Promise<NewsItem[]> {
    // For RSS feeds, we use symbols as keywords
    // This is a simple approach; more sophisticated connectors would use specialized APIs
    return this.fetchNews(since, symbols);
  }

  private async fetchRSSFeed(
    url: string,
    sourceName: string,
  ): Promise<RSSItem[]> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FinanceResearchAgent/1.0)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      if (!response.ok) {
        console.warn(`RSS: HTTP error from ${sourceName}: ${response.status}`);
        return [];
      }

      const text = await response.text();
      const items = this.parseRSSXML(text);
      return items;
    } catch (error) {
      console.warn(`RSS: Fetch error from ${sourceName}:`, error);
      return [];
    }
  }

  private parseRSSXML(xml: string): RSSItem[] {
    // Simple XML parsing for RSS feeds
    // In production, consider using a proper XML parser like fast-xml-parser
    const items: RSSItem[] = [];

    try {
      // Extract items using regex (simple approach)
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];

        const title = this.extractTag(itemXml, "title");
        const link = this.extractTag(itemXml, "link");
        const description = this.extractTag(itemXml, "description");
        const pubDate = this.extractTag(itemXml, "pubDate");
        const guid = this.extractTag(itemXml, "guid");

        items.push({
          title,
          link,
          description,
          pubDate,
          guid,
        });
      }
    } catch (error) {
      console.warn("RSS: XML parsing error:", error);
    }

    return items;
  }

  private extractTag(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(
      `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
      "i",
    );
    const match = regex.exec(xml);
    return match ? (match[1] || match[2])?.trim() : undefined;
  }

  private cleanSnippet(html: string): string {
    // Remove HTML tags and clean up whitespace
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ") // Replace &nbsp;
      .replace(/&amp;/g, "&") // Replace &amp;
      .replace(/&lt;/g, "<") // Replace &lt;
      .replace(/&gt;/g, ">") // Replace &gt;
      .replace(/&quot;/g, '"') // Replace &quot;
      .replace(/&#39;/g, "'") // Replace &#39;
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .substring(0, 500); // Limit length
  }
}
