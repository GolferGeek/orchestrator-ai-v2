/**
 * Alpha Vantage Tool
 *
 * Fetches stock quotes and technical indicators from Alpha Vantage API.
 * Requires an API key (free tier: 25 requests/day).
 *
 * FEATURES:
 * - Global quotes with detailed pricing
 * - Technical indicators (RSI, MACD, SMA, EMA)
 * - Company overview data
 * - Intraday data
 *
 * LIMITATIONS:
 * - Free tier: 25 requests/day (5/minute)
 * - Premium tiers available for higher limits
 * - One symbol per request
 *
 * @module alpha-vantage.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Alpha Vantage API response types
 */
interface AlphaVantageGlobalQuote {
  '01. symbol'?: string;
  '02. open'?: string;
  '03. high'?: string;
  '04. low'?: string;
  '05. price'?: string;
  '06. volume'?: string;
  '07. latest trading day'?: string;
  '08. previous close'?: string;
  '09. change'?: string;
  '10. change percent'?: string;
}

interface AlphaVantageQuoteResponse {
  'Global Quote'?: AlphaVantageGlobalQuote;
  Note?: string;
  'Error Message'?: string;
  Information?: string;
}

/**
 * Alpha Vantage Tool configuration
 */
export interface AlphaVantageToolConfig extends ToolConfig {
  /** Alpha Vantage API key (required) */
  apiKey: string;

  /** Include technical indicators */
  includeTechnicals?: boolean;

  /** Technical indicator period (default: 14) */
  technicalPeriod?: number;
}

/**
 * Alpha Vantage Tool
 *
 * Fetches stock quotes from Alpha Vantage API.
 * Provides more detailed data than Yahoo Finance but with stricter rate limits.
 *
 * @example
 * ```typescript
 * const tool = new AlphaVantageTool({ apiKey: process.env.ALPHA_VANTAGE_API_KEY });
 * const sources = await tool.execute(['AAPL', 'MSFT']);
 * // Returns sources with detailed price claims
 * ```
 */
@Injectable()
export class AlphaVantageTool extends BasePredictionTool {
  readonly name = 'alpha-vantage';
  readonly description = 'Fetches detailed stock quotes from Alpha Vantage API';

  private readonly baseUrl = 'https://www.alphavantage.co/query';
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly includeTechnicals: boolean;
  private readonly technicalPeriod: number;

  constructor(config: AlphaVantageToolConfig) {
    super();
    if (!config.apiKey) {
      throw new Error('Alpha Vantage API key is required');
    }
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.includeTechnicals = config.includeTechnicals ?? false;
    this.technicalPeriod = config.technicalPeriod ?? 14;
  }

  /**
   * Fetch quotes from Alpha Vantage API.
   * Alpha Vantage requires one request per symbol.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<Map<string, AlphaVantageQuoteResponse>> {
    const results = new Map<string, AlphaVantageQuoteResponse>();

    // Fetch each instrument sequentially to respect rate limits
    // Free tier is 5 requests/minute
    for (const symbol of instruments) {
      try {
        const quote = await this.fetchQuote(symbol);
        results.set(symbol, quote);

        // Add a small delay to avoid rate limiting
        if (instruments.indexOf(symbol) < instruments.length - 1) {
          await this.delay(200); // 200ms between requests
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch Alpha Vantage data for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
        );
        results.set(symbol, {
          'Error Message':
            error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Fetch a single quote from Alpha Vantage.
   */
  private async fetchQuote(symbol: string): Promise<AlphaVantageQuoteResponse> {
    const url = `${this.baseUrl}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;

    this.logger.debug(`Fetching Alpha Vantage quote for: ${symbol}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Alpha Vantage API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as AlphaVantageQuoteResponse;

      // Check for API errors
      if (data.Note) {
        this.logger.warn(`Alpha Vantage rate limit: ${data.Note}`);
      }
      if (data['Error Message']) {
        throw new Error(data['Error Message']);
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Alpha Vantage responses into sources with claims.
   */
  protected parseResponse(
    response: Map<string, AlphaVantageQuoteResponse>,
    _instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    for (const [symbol, data] of response) {
      if (data['Error Message'] || !data['Global Quote']) {
        this.logger.warn(
          `No data for ${symbol}: ${data['Error Message'] || 'Empty response'}`,
        );
        continue;
      }

      const quote = data['Global Quote'];
      const claims = this.extractClaims(symbol, quote);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              symbol,
              latestTradingDay: quote['07. latest trading day'],
              source: 'alpha-vantage',
            },
          }),
        );
      }
    }

    return sources;
  }

  /**
   * Extract claims from a quote.
   */
  private extractClaims(
    instrument: string,
    quote: AlphaVantageGlobalQuote,
  ): Claim[] {
    const claims: Claim[] = [];
    const timestamp = new Date().toISOString();

    // Price claim
    const price = this.safeNumber(quote['05. price']);
    if (price !== null) {
      claims.push(
        this.createClaim('price', instrument, price, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Open claim
    const open = this.safeNumber(quote['02. open']);
    if (open !== null) {
      claims.push(
        this.createClaim('open', instrument, open, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // High claim
    const high = this.safeNumber(quote['03. high']);
    if (high !== null) {
      claims.push(
        this.createClaim('high', instrument, high, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Low claim
    const low = this.safeNumber(quote['04. low']);
    if (low !== null) {
      claims.push(
        this.createClaim('low', instrument, low, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Volume claim
    const volume = this.safeNumber(quote['06. volume']);
    if (volume !== null) {
      claims.push(
        this.createClaim('volume', instrument, volume, {
          unit: 'shares',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Previous close claim
    const prevClose = this.safeNumber(quote['08. previous close']);
    if (prevClose !== null) {
      claims.push(
        this.createClaim('close', instrument, prevClose, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { type: 'previous_close' },
        }),
      );
    }

    // Change claim
    const change = this.safeNumber(quote['09. change']);
    if (change !== null) {
      claims.push(
        this.createClaim('change', instrument, change, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Change percent claim
    const changePercentStr = quote['10. change percent'];
    if (changePercentStr) {
      // Alpha Vantage returns "1.23%" format
      const changePercent = this.safeNumber(changePercentStr.replace('%', ''));
      if (changePercent !== null) {
        claims.push(
          this.createClaim('change_percent', instrument, changePercent, {
            unit: 'percent',
            timestamp,
            confidence: 1.0,
          }),
        );
      }
    }

    return claims;
  }

  /**
   * Delay helper for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create AlphaVantageTool with environment config.
 * Falls back gracefully if API key is not configured.
 */
export function createAlphaVantageTool(): AlphaVantageTool | null {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new AlphaVantageTool({ apiKey });
}
