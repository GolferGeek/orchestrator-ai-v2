/**
 * Yahoo Finance Connector
 *
 * Free tier market data connector using Yahoo Finance API.
 * Rate limited but sufficient for development and small-scale use.
 */

import { MarketDataConnector } from "./connector.interface";
import { MarketBar } from "../finance.state";
import { v4 as uuidv4 } from "uuid";

interface YahooQuoteResponse {
  chart?: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        regularMarketTime: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: number[];
          high?: number[];
          low?: number[];
          close?: number[];
          volume?: number[];
        }>;
      };
    }>;
    error?: {
      code: string;
      description: string;
    };
  };
}

export class YahooFinanceConnector implements MarketDataConnector {
  readonly name = "yahoo-finance";
  private readonly baseUrl = "https://query1.finance.yahoo.com/v8/finance";

  isConfigured(): boolean {
    // Yahoo Finance API doesn't require API key for basic queries
    return true;
  }

  async fetchBars(
    symbols: string[],
    since: string,
    until?: string,
  ): Promise<MarketBar[]> {
    const bars: MarketBar[] = [];
    const period1 = Math.floor(new Date(since).getTime() / 1000);
    const period2 = until
      ? Math.floor(new Date(until).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    for (const symbol of symbols) {
      try {
        const url = `${this.baseUrl}/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FinanceResearchAgent/1.0)",
          },
        });

        if (!response.ok) {
          console.warn(
            `Yahoo Finance: Failed to fetch ${symbol}: ${response.status}`,
          );
          continue;
        }

        const data: YahooQuoteResponse = await response.json();

        if (data.chart?.error) {
          console.warn(
            `Yahoo Finance: API error for ${symbol}: ${data.chart.error.description}`,
          );
          continue;
        }

        const result = data.chart?.result?.[0];
        if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
          continue;
        }

        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp;

        for (let i = 0; i < timestamps.length; i++) {
          if (
            quote.open?.[i] != null &&
            quote.high?.[i] != null &&
            quote.low?.[i] != null &&
            quote.close?.[i] != null
          ) {
            bars.push({
              id: uuidv4(),
              instrument: symbol,
              ts: new Date(timestamps[i] * 1000).toISOString(),
              open: quote.open[i],
              high: quote.high[i],
              low: quote.low[i],
              close: quote.close[i],
              volume: quote.volume?.[i] ?? 0,
              vendor: this.name,
            });
          }
        }
      } catch (error) {
        console.error(`Yahoo Finance: Error fetching ${symbol}:`, error);
      }
    }

    return bars;
  }

  async fetchQuotes(symbols: string[]): Promise<MarketBar[]> {
    const bars: MarketBar[] = [];

    for (const symbol of symbols) {
      try {
        const url = `${this.baseUrl}/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FinanceResearchAgent/1.0)",
          },
        });

        if (!response.ok) {
          continue;
        }

        const data: YahooQuoteResponse = await response.json();
        const result = data.chart?.result?.[0];

        if (result?.meta) {
          bars.push({
            id: uuidv4(),
            instrument: symbol,
            ts: new Date(result.meta.regularMarketTime * 1000).toISOString(),
            open: result.meta.regularMarketPrice,
            high: result.meta.regularMarketPrice,
            low: result.meta.regularMarketPrice,
            close: result.meta.regularMarketPrice,
            volume: 0,
            vendor: this.name,
          });
        }
      } catch (error) {
        console.error(
          `Yahoo Finance: Error fetching quote for ${symbol}:`,
          error,
        );
      }
    }

    return bars;
  }
}
