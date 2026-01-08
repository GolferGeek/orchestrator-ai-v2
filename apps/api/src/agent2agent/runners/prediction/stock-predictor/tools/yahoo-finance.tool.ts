/**
 * Yahoo Finance Tool
 *
 * Fetches stock quotes and market data from Yahoo Finance API.
 * This is a free API that doesn't require an API key.
 *
 * FEATURES:
 * - Real-time quotes (price, volume, change)
 * - Market cap, P/E ratio, EPS
 * - 52-week high/low
 * - Bid/ask spread
 *
 * LIMITATIONS:
 * - Rate limited to ~2000 requests/hour
 * - Delayed quotes (15-20 minutes for some exchanges)
 * - May require user-agent spoofing
 *
 * @module yahoo-finance.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Yahoo Finance API response types
 */
interface YahooQuoteResult {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  bid?: number;
  ask?: number;
  bidSize?: number;
  askSize?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  epsTrailingTwelveMonths?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  averageVolume?: number;
  regularMarketTime?: number;
  currency?: string;
  exchange?: string;
  quoteType?: string;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: YahooQuoteResult[];
    error?: {
      code?: string;
      description?: string;
    };
  };
}

/**
 * Yahoo Finance Tool configuration
 */
export interface YahooFinanceToolConfig extends ToolConfig {
  /** Include extended trading hours data */
  includeExtendedHours?: boolean;

  /** Include fundamental data (P/E, EPS, etc.) */
  includeFundamentals?: boolean;
}

/**
 * Yahoo Finance Tool
 *
 * Fetches real-time stock quotes from Yahoo Finance.
 * No API key required - uses the free public API.
 *
 * @example
 * ```typescript
 * const tool = new YahooFinanceTool();
 * const sources = await tool.execute(['AAPL', 'MSFT', 'GOOGL']);
 * // Returns sources with price, volume, change claims
 * ```
 */
@Injectable()
export class YahooFinanceTool extends BasePredictionTool {
  readonly name = 'yahoo-finance';
  readonly description = 'Fetches real-time stock quotes from Yahoo Finance';

  private readonly baseUrl =
    'https://query1.finance.yahoo.com/v7/finance/quote';
  private readonly timeoutMs: number;
  private readonly includeFundamentals: boolean;

  constructor(config: YahooFinanceToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.includeFundamentals = config.includeFundamentals ?? true;
  }

  /**
   * Fetch quotes from Yahoo Finance API.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<YahooQuoteResponse> {
    const symbols = instruments.join(',');
    const url = `${this.baseUrl}?symbols=${encodeURIComponent(symbols)}`;

    this.logger.debug(`Fetching Yahoo Finance quotes for: ${symbols}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Yahoo Finance API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as YahooQuoteResponse;
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Yahoo Finance response into sources with claims.
   */
  protected parseResponse(
    response: YahooQuoteResponse,
    instruments: string[],
  ): Source[] {
    const sources: Source[] = [];
    const results = response.quoteResponse?.result ?? [];

    if (response.quoteResponse?.error) {
      this.logger.warn(
        `Yahoo Finance API error: ${response.quoteResponse.error.description}`,
      );
      return [
        this.createErrorSource(
          response.quoteResponse.error.description || 'Unknown error',
        ),
      ];
    }

    // Create a source for each successfully fetched instrument
    for (const quote of results) {
      if (!quote.symbol) continue;

      const claims = this.extractClaims(quote);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              symbol: quote.symbol,
              exchange: quote.exchange,
              currency: quote.currency,
              quoteType: quote.quoteType,
              companyName: quote.longName || quote.shortName,
            },
          }),
        );
      }
    }

    // Log any instruments that weren't found
    const foundSymbols = new Set(results.map((r) => r.symbol?.toUpperCase()));
    const missingSymbols = instruments.filter(
      (i) => !foundSymbols.has(i.toUpperCase()),
    );
    if (missingSymbols.length > 0) {
      this.logger.warn(
        `Symbols not found in Yahoo Finance: ${missingSymbols.join(', ')}`,
      );
    }

    return sources;
  }

  /**
   * Extract claims from a quote result.
   */
  private extractClaims(quote: YahooQuoteResult): Claim[] {
    const claims: Claim[] = [];
    const instrument = quote.symbol!;
    const timestamp = quote.regularMarketTime
      ? new Date(quote.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();

    // Price claim
    const price = this.safeNumber(quote.regularMarketPrice);
    if (price !== null) {
      claims.push(
        this.createClaim('price', instrument, price, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Change claims
    const change = this.safeNumber(quote.regularMarketChange);
    if (change !== null) {
      claims.push(
        this.createClaim('change', instrument, change, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const changePercent = this.safeNumber(quote.regularMarketChangePercent);
    if (changePercent !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, changePercent, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Volume claim
    const volume = this.safeNumber(quote.regularMarketVolume);
    if (volume !== null) {
      claims.push(
        this.createClaim('volume', instrument, volume, {
          unit: 'shares',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // OHLC claims
    const open = this.safeNumber(quote.regularMarketOpen);
    if (open !== null) {
      claims.push(
        this.createClaim('open', instrument, open, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const high = this.safeNumber(quote.regularMarketDayHigh);
    if (high !== null) {
      claims.push(
        this.createClaim('high', instrument, high, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const low = this.safeNumber(quote.regularMarketDayLow);
    if (low !== null) {
      claims.push(
        this.createClaim('low', instrument, low, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const close = this.safeNumber(quote.regularMarketPreviousClose);
    if (close !== null) {
      claims.push(
        this.createClaim('close', instrument, close, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { type: 'previous_close' },
        }),
      );
    }

    // Bid/Ask claims
    const bid = this.safeNumber(quote.bid);
    if (bid !== null) {
      claims.push(
        this.createClaim('bid', instrument, bid, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { size: quote.bidSize },
        }),
      );
    }

    const ask = this.safeNumber(quote.ask);
    if (ask !== null) {
      claims.push(
        this.createClaim('ask', instrument, ask, {
          unit: quote.currency || 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { size: quote.askSize },
        }),
      );
    }

    // Spread claim (derived)
    if (bid !== null && ask !== null && bid > 0 && ask > 0) {
      const spread = ask - bid;
      const spreadPercent = (spread / ((bid + ask) / 2)) * 100;
      claims.push(
        this.createClaim('spread', instrument, spreadPercent, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
          metadata: { spreadValue: spread },
        }),
      );
    }

    // Fundamental claims (if enabled)
    if (this.includeFundamentals) {
      const marketCap = this.safeNumber(quote.marketCap);
      if (marketCap !== null) {
        claims.push(
          this.createClaim('market_cap', instrument, marketCap, {
            unit: quote.currency || 'USD',
            timestamp,
            confidence: 1.0,
          }),
        );
      }

      const pe = this.safeNumber(quote.trailingPE);
      if (pe !== null) {
        claims.push(
          this.createClaim('pe_ratio', instrument, pe, {
            unit: 'ratio',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'trailing' },
          }),
        );
      }

      const forwardPe = this.safeNumber(quote.forwardPE);
      if (forwardPe !== null) {
        claims.push(
          this.createClaim('pe_ratio', instrument, forwardPe, {
            unit: 'ratio',
            timestamp,
            confidence: 0.9, // Forward estimates are less certain
            metadata: { type: 'forward' },
          }),
        );
      }

      const eps = this.safeNumber(quote.epsTrailingTwelveMonths);
      if (eps !== null) {
        claims.push(
          this.createClaim('eps', instrument, eps, {
            unit: quote.currency || 'USD',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'ttm' },
          }),
        );
      }
    }

    return claims;
  }
}
