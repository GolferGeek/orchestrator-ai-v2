/**
 * Connector Factory
 *
 * Factory for creating configured market data and news connectors.
 * Supports fallback chains when primary connectors fail.
 */

import {
  MarketDataConnector,
  NewsConnector,
  MarketDataConnectorType,
  NewsConnectorType,
  ConnectorFactory,
} from "./connector.interface";
import { YahooFinanceConnector } from "./yahoo-finance.connector";
import { AlphaVantageConnector } from "./alpha-vantage.connector";
import { RSSNewsConnector } from "./rss-news.connector";
import { MockMarketDataConnector, MockNewsConnector } from "./mock.connector";

/**
 * Default connector factory implementation
 */
export class DefaultConnectorFactory implements ConnectorFactory {
  createMarketDataConnector(
    type: MarketDataConnectorType,
  ): MarketDataConnector {
    switch (type) {
      case "yahoo":
        return new YahooFinanceConnector();
      case "alpha_vantage":
        return new AlphaVantageConnector();
      case "mock":
        return new MockMarketDataConnector();
      case "bloomberg":
        // Placeholder for future licensed connector
        throw new Error(
          "Bloomberg connector not implemented - requires licensed API access",
        );
      default:
        return new MockMarketDataConnector();
    }
  }

  createNewsConnector(type: NewsConnectorType): NewsConnector {
    switch (type) {
      case "rss":
        return new RSSNewsConnector();
      case "gdelt":
        // GDELT would be similar to RSS but with different feeds
        // For now, fall through to RSS
        return new RSSNewsConnector();
      case "mock":
        return new MockNewsConnector();
      case "refinitiv":
        // Placeholder for future licensed connector
        throw new Error(
          "Refinitiv connector not implemented - requires licensed API access",
        );
      default:
        return new MockNewsConnector();
    }
  }
}

/**
 * Connector chain that tries multiple connectors in order
 * Returns data from the first connector that succeeds
 */
export class MarketDataConnectorChain implements MarketDataConnector {
  readonly name = "connector-chain";
  private readonly connectors: MarketDataConnector[];

  constructor(connectors: MarketDataConnector[]) {
    this.connectors = connectors.filter((c) => c.isConfigured());
    if (this.connectors.length === 0) {
      // Always have mock as fallback
      this.connectors.push(new MockMarketDataConnector());
    }
  }

  isConfigured(): boolean {
    return this.connectors.length > 0;
  }

  async fetchBars(
    symbols: string[],
    since: string,
    until?: string,
  ): Promise<import("../finance.state").MarketBar[]> {
    for (const connector of this.connectors) {
      try {
        const bars = await connector.fetchBars(symbols, since, until);
        if (bars.length > 0) {
          console.log(
            `MarketDataChain: Got ${bars.length} bars from ${connector.name}`,
          );
          return bars;
        }
      } catch (error) {
        console.warn(
          `MarketDataChain: ${connector.name} failed, trying next:`,
          error,
        );
      }
    }
    console.warn("MarketDataChain: All connectors failed, returning empty");
    return [];
  }

  async fetchQuotes(
    symbols: string[],
  ): Promise<import("../finance.state").MarketBar[]> {
    for (const connector of this.connectors) {
      try {
        const quotes = await connector.fetchQuotes(symbols);
        if (quotes.length > 0) {
          return quotes;
        }
      } catch (error) {
        console.warn(
          `MarketDataChain: ${connector.name} quote fetch failed:`,
          error,
        );
      }
    }
    return [];
  }
}

/**
 * News connector chain with fallback
 */
export class NewsConnectorChain implements NewsConnector {
  readonly name = "news-connector-chain";
  private readonly connectors: NewsConnector[];

  constructor(connectors: NewsConnector[]) {
    this.connectors = connectors.filter((c) => c.isConfigured());
    if (this.connectors.length === 0) {
      this.connectors.push(new MockNewsConnector());
    }
  }

  isConfigured(): boolean {
    return this.connectors.length > 0;
  }

  async fetchNews(
    since: string,
    keywords?: string[],
    sources?: string[],
  ): Promise<import("../finance.state").NewsItem[]> {
    const allNews: import("../finance.state").NewsItem[] = [];

    // Aggregate news from all connectors
    for (const connector of this.connectors) {
      try {
        const news = await connector.fetchNews(since, keywords, sources);
        allNews.push(...news);
      } catch (error) {
        console.warn(`NewsChain: ${connector.name} failed:`, error);
      }
    }

    // Deduplicate by title similarity (simple approach)
    const seen = new Set<string>();
    return allNews.filter((item) => {
      const key = item.title.toLowerCase().substring(0, 50);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async fetchNewsForInstruments(
    symbols: string[],
    since: string,
  ): Promise<import("../finance.state").NewsItem[]> {
    const allNews: import("../finance.state").NewsItem[] = [];

    for (const connector of this.connectors) {
      try {
        const news = await connector.fetchNewsForInstruments(symbols, since);
        allNews.push(...news);
      } catch (error) {
        console.warn(
          `NewsChain: ${connector.name} instrument fetch failed:`,
          error,
        );
      }
    }

    return allNews;
  }
}

/**
 * Create a production-ready connector chain
 * Order: real connectors first, mock as fallback
 */
export function createMarketDataChain(): MarketDataConnectorChain {
  const factory = new DefaultConnectorFactory();
  return new MarketDataConnectorChain([
    factory.createMarketDataConnector("yahoo"),
    factory.createMarketDataConnector("alpha_vantage"),
    factory.createMarketDataConnector("mock"),
  ]);
}

export function createNewsChain(): NewsConnectorChain {
  const factory = new DefaultConnectorFactory();
  return new NewsConnectorChain([
    factory.createNewsConnector("rss"),
    factory.createNewsConnector("mock"),
  ]);
}
