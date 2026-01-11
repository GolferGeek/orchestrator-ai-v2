/**
 * Binance Tool
 *
 * Fetches cryptocurrency market data from Binance public API.
 * This is a free API that doesn't require an API key.
 *
 * FEATURES:
 * - Real-time crypto prices (BTC, ETH, etc.)
 * - 24-hour price change, volume, high/low
 * - Bid/ask spread
 * - Trading volume in quote currency
 *
 * LIMITATIONS:
 * - Rate limited to 1200 requests/minute (weight system)
 * - Only supports Binance-listed pairs
 * - Must use correct trading pair format (BTCUSDT, ETHUSDT, etc.)
 *
 * @module binance.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Binance 24hr Ticker Response
 * https://binance-docs.github.io/apidocs/spot/en/#24hr-ticker-price-change-statistics
 */
interface Binance24hrTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string; // Base asset volume
  quoteVolume: string; // Quote asset volume (e.g., USDT)
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number; // Number of trades
}

/**
 * Binance Tool configuration
 */
export interface BinanceToolConfig extends ToolConfig {
  /** Include bid/ask data */
  includeOrderBook?: boolean;
}

/**
 * Binance Tool
 *
 * Fetches real-time cryptocurrency prices from Binance public API.
 * No API key required.
 *
 * Instruments should be in Binance pair format: BTCUSDT, ETHUSDT, BNBUSDT, etc.
 * For convenience, this tool will convert common formats:
 * - BTC, ETH -> BTCUSDT, ETHUSDT
 * - BTC-USD -> BTCUSDT
 *
 * @example
 * ```typescript
 * const tool = new BinanceTool();
 * const sources = await tool.execute(['BTC', 'ETH', 'BNBUSDT']);
 * // Returns sources with price, volume, change claims
 * ```
 */
@Injectable()
export class BinanceTool extends BasePredictionTool {
  readonly name = 'binance';
  readonly description = 'Fetches real-time cryptocurrency prices from Binance';

  private readonly baseUrl = 'https://api.binance.com/api/v3';
  private readonly timeoutMs: number;
  private readonly includeOrderBook: boolean;

  constructor(config: BinanceToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.includeOrderBook = config.includeOrderBook ?? true;
  }

  /**
   * Fetch 24hr ticker data from Binance API.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<Binance24hrTicker[]> {
    // Normalize instrument symbols to Binance format
    const symbols = instruments.map((i) => this.normalizeToBinanceSymbol(i));

    this.logger.debug(`Fetching Binance tickers for: ${symbols.join(', ')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // If only one symbol, use single ticker endpoint
      if (symbols.length === 1) {
        const url = `${this.baseUrl}/ticker/24hr?symbol=${symbols[0]}`;
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Binance API error: ${response.status} ${response.statusText}`,
          );
        }

        const data = (await response.json()) as Binance24hrTicker;
        return [data];
      }

      // For multiple symbols, use bulk endpoint
      const symbolsParam = JSON.stringify(symbols);
      const url = `${this.baseUrl}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Binance API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as Binance24hrTicker[];
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Binance response into sources with claims.
   */
  protected parseResponse(
    response: Binance24hrTicker[],
    instruments: string[],
  ): Source[] {
    const sources: Source[] = [];
    const tickers = Array.isArray(response) ? response : [response];

    // Create a source for each successfully fetched ticker
    for (const ticker of tickers) {
      if (!ticker.symbol) continue;

      const claims = this.extractClaims(ticker);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              symbol: ticker.symbol,
              exchange: 'binance',
              tradeCount: ticker.count,
              openTime: new Date(ticker.openTime).toISOString(),
              closeTime: new Date(ticker.closeTime).toISOString(),
            },
          }),
        );
      }
    }

    // Log any instruments that weren't found
    const foundSymbols = new Set(
      tickers.map((t) => this.normalizeToBinanceSymbol(t.symbol)),
    );
    const normalizedInstruments = instruments.map((i) =>
      this.normalizeToBinanceSymbol(i),
    );
    const missingSymbols = normalizedInstruments.filter(
      (i) => !foundSymbols.has(i),
    );
    if (missingSymbols.length > 0) {
      this.logger.warn(
        `Symbols not found in Binance: ${missingSymbols.join(', ')}`,
      );
    }

    return sources;
  }

  /**
   * Extract claims from a ticker result.
   */
  private extractClaims(ticker: Binance24hrTicker): Claim[] {
    const claims: Claim[] = [];
    const instrument = ticker.symbol;
    const timestamp = new Date(ticker.closeTime).toISOString();

    // Determine quote currency (usually USDT, BUSD, BTC, ETH)
    const quoteCurrency = this.extractQuoteCurrency(ticker.symbol);

    // Price claim (last price)
    const price = this.safeNumber(ticker.lastPrice);
    if (price !== null) {
      claims.push(
        this.createClaim('price', instrument, price, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Change claims
    const change = this.safeNumber(ticker.priceChange);
    if (change !== null) {
      claims.push(
        this.createClaim('change', instrument, change, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const changePercent = this.safeNumber(ticker.priceChangePercent);
    if (changePercent !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, changePercent, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    // Volume claims
    const volume = this.safeNumber(ticker.volume);
    if (volume !== null) {
      claims.push(
        this.createClaim('volume', instrument, volume, {
          unit: 'base_asset',
          timestamp,
          confidence: 1.0,
          metadata: { baseAsset: this.extractBaseCurrency(ticker.symbol) },
        }),
      );
    }

    const quoteVolume = this.safeNumber(ticker.quoteVolume);
    if (quoteVolume !== null) {
      claims.push(
        this.createClaim('volume', instrument, quoteVolume, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
          metadata: { type: 'quote_volume' },
        }),
      );
    }

    // OHLC claims
    const open = this.safeNumber(ticker.openPrice);
    if (open !== null) {
      claims.push(
        this.createClaim('open', instrument, open, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const high = this.safeNumber(ticker.highPrice);
    if (high !== null) {
      claims.push(
        this.createClaim('high', instrument, high, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const low = this.safeNumber(ticker.lowPrice);
    if (low !== null) {
      claims.push(
        this.createClaim('low', instrument, low, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
        }),
      );
    }

    const close = this.safeNumber(ticker.prevClosePrice);
    if (close !== null) {
      claims.push(
        this.createClaim('close', instrument, close, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
          metadata: { type: 'previous_close' },
        }),
      );
    }

    // Bid/Ask claims (if enabled)
    if (this.includeOrderBook) {
      const bid = this.safeNumber(ticker.bidPrice);
      if (bid !== null) {
        claims.push(
          this.createClaim('bid', instrument, bid, {
            unit: quoteCurrency,
            timestamp,
            confidence: 1.0,
            metadata: { size: ticker.bidQty },
          }),
        );
      }

      const ask = this.safeNumber(ticker.askPrice);
      if (ask !== null) {
        claims.push(
          this.createClaim('ask', instrument, ask, {
            unit: quoteCurrency,
            timestamp,
            confidence: 1.0,
            metadata: { size: ticker.askQty },
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
    }

    // Weighted average price
    const weightedAvgPrice = this.safeNumber(ticker.weightedAvgPrice);
    if (weightedAvgPrice !== null) {
      claims.push(
        this.createClaim('price', instrument, weightedAvgPrice, {
          unit: quoteCurrency,
          timestamp,
          confidence: 1.0,
          metadata: { type: 'weighted_average' },
        }),
      );
    }

    return claims;
  }

  /**
   * Normalize instrument symbol to Binance format.
   * Converts: BTC -> BTCUSDT, BTC-USD -> BTCUSDT, BTC-USDT -> BTCUSDT
   */
  private normalizeToBinanceSymbol(symbol: string): string {
    // Remove hyphens and convert to uppercase
    let normalized = symbol.replace(/-/g, '').toUpperCase();

    // If it doesn't end with a known quote currency, append USDT
    const quoteCurrencies = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USD'];
    const hasQuoteCurrency = quoteCurrencies.some((quote) =>
      normalized.endsWith(quote),
    );

    if (!hasQuoteCurrency) {
      normalized = `${normalized}USDT`;
    }

    return normalized;
  }

  /**
   * Extract base currency from trading pair symbol.
   * Example: BTCUSDT -> BTC, ETHBTC -> ETH
   */
  private extractBaseCurrency(symbol: string): string {
    const quoteCurrencies = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USD'];
    for (const quote of quoteCurrencies) {
      if (symbol.endsWith(quote)) {
        return symbol.slice(0, -quote.length);
      }
    }
    return symbol;
  }

  /**
   * Extract quote currency from trading pair symbol.
   * Example: BTCUSDT -> USDT, ETHBTC -> BTC
   */
  private extractQuoteCurrency(symbol: string): string {
    const quoteCurrencies = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USD'];
    for (const quote of quoteCurrencies) {
      if (symbol.endsWith(quote)) {
        return quote;
      }
    }
    return 'USDT'; // Default fallback
  }
}
