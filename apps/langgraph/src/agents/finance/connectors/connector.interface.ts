/**
 * Finance Data Connector Interfaces
 *
 * Abstract interfaces for market data and news ingestion.
 * Enables pluggable data sources (free tier vs licensed).
 */

import { MarketBar, NewsItem } from "../finance.state";

/**
 * Market data connector interface
 * Implementations: YahooFinanceConnector, AlphaVantageConnector, (future: BloombergConnector)
 */
export interface MarketDataConnector {
  /**
   * Connector name for logging/metrics
   */
  name: string;

  /**
   * Check if connector is properly configured
   */
  isConfigured(): boolean;

  /**
   * Fetch historical bars for instruments
   * @param symbols - Array of instrument symbols
   * @param since - ISO date string for start of range
   * @param until - ISO date string for end of range (optional, defaults to now)
   * @returns Array of market bars
   */
  fetchBars(
    symbols: string[],
    since: string,
    until?: string,
  ): Promise<MarketBar[]>;

  /**
   * Fetch real-time quote for instruments
   * @param symbols - Array of instrument symbols
   * @returns Array of latest bars (single bar per symbol)
   */
  fetchQuotes(symbols: string[]): Promise<MarketBar[]>;
}

/**
 * News/world events connector interface
 * Implementations: RSSConnector, GDELTConnector, (future: RefinitivConnector)
 */
export interface NewsConnector {
  /**
   * Connector name for logging/metrics
   */
  name: string;

  /**
   * Check if connector is properly configured
   */
  isConfigured(): boolean;

  /**
   * Fetch recent news items
   * @param since - ISO date string for start of range
   * @param keywords - Optional array of keywords to filter by
   * @param sources - Optional array of source names to filter by
   * @returns Array of news items
   */
  fetchNews(
    since: string,
    keywords?: string[],
    sources?: string[],
  ): Promise<NewsItem[]>;

  /**
   * Fetch news for specific instruments
   * @param symbols - Array of instrument symbols
   * @param since - ISO date string for start of range
   * @returns Array of news items related to the instruments
   */
  fetchNewsForInstruments(
    symbols: string[],
    since: string,
  ): Promise<NewsItem[]>;
}

/**
 * Aggregated connector response with metadata
 */
export interface ConnectorResponse<T> {
  data: T[];
  source: string;
  fetchedAt: string;
  metadata?: {
    rateLimit?: {
      remaining: number;
      resetAt: string;
    };
    warnings?: string[];
  };
}

/**
 * Connector factory for creating configured connectors
 */
export interface ConnectorFactory {
  createMarketDataConnector(type: MarketDataConnectorType): MarketDataConnector;
  createNewsConnector(type: NewsConnectorType): NewsConnector;
}

export type MarketDataConnectorType =
  | "yahoo"
  | "alpha_vantage"
  | "mock"
  | "bloomberg";
export type NewsConnectorType = "rss" | "gdelt" | "mock" | "refinitiv";
