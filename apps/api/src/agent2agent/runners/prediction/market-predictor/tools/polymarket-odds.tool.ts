/**
 * Polymarket Odds Tool
 *
 * Fetches current odds, liquidity, and volume from Polymarket CLOB API.
 * This is a free API that doesn't require authentication.
 *
 * FEATURES:
 * - Current yes/no probabilities for markets
 * - Market liquidity and volume
 * - Order book depth
 * - Last traded price
 *
 * API DOCUMENTATION:
 * - Base URL: https://clob.polymarket.com
 * - Free, no API key required
 * - Rate limits apply
 *
 * @module polymarket-odds.tool
 */

import { Injectable } from '@nestjs/common';
import {
  BasePredictionTool,
  ToolConfig,
} from '../../financial-asset-predictor/tools/base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Polymarket market data from CLOB API
 */
interface PolymarketMarket {
  condition_id?: string;
  question?: string;
  market_slug?: string;
  end_date_iso?: string;
  game_start_time?: string;
  tokens?: Array<{
    token_id?: string;
    outcome?: string;
    price?: string;
    winner?: boolean;
  }>;
  clob_token_ids?: string[];
  active?: boolean;
  closed?: boolean;
  accepting_orders?: boolean;
  seconds_delay?: number;
  minimum_order_size?: string;
  minimum_tick_size?: string;
}

interface PolymarketOrderBook {
  market?: string;
  asset_id?: string;
  bids?: Array<{ price?: string; size?: string }>;
  asks?: Array<{ price?: string; size?: string }>;
  timestamp?: number;
}

interface PolymarketTrade {
  market?: string;
  asset_id?: string;
  outcome?: string;
  price?: string;
  size?: string;
  timestamp?: number;
  side?: 'BUY' | 'SELL';
}

/**
 * Polymarket Odds Tool configuration
 */
export interface PolymarketOddsToolConfig extends ToolConfig {
  /** Include order book depth */
  includeOrderBook?: boolean;

  /** Include recent trades */
  includeRecentTrades?: boolean;
}

/**
 * Polymarket Odds Tool
 *
 * Fetches real-time market odds and liquidity from Polymarket.
 * No API key required - uses the free public CLOB API.
 *
 * NOTE: Instruments are Polymarket condition IDs or market slugs.
 *
 * @example
 * ```typescript
 * const tool = new PolymarketOddsTool();
 * const sources = await tool.execute(['condition-id-1', 'condition-id-2']);
 * // Returns sources with odds, volume, liquidity claims
 * ```
 */
@Injectable()
export class PolymarketOddsTool extends BasePredictionTool {
  readonly name = 'polymarket-odds';
  readonly description =
    'Fetches real-time market odds and liquidity from Polymarket CLOB API';

  private readonly baseUrl = 'https://clob.polymarket.com';
  private readonly timeoutMs: number;
  private readonly includeOrderBook: boolean;
  private readonly includeRecentTrades: boolean;

  constructor(config: PolymarketOddsToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.includeOrderBook = config.includeOrderBook ?? true;
    this.includeRecentTrades = config.includeRecentTrades ?? false;
  }

  /**
   * Fetch market data from Polymarket CLOB API.
   */
  protected async fetchData(instruments: string[]): Promise<{
    markets: PolymarketMarket[];
    orderBooks: Map<string, PolymarketOrderBook>;
    trades: Map<string, PolymarketTrade[]>;
  }> {
    this.logger.debug(
      `Fetching Polymarket data for: ${instruments.join(', ')}`,
    );

    const markets: PolymarketMarket[] = [];
    const orderBooks = new Map<string, PolymarketOrderBook>();
    const trades = new Map<string, PolymarketTrade[]>();

    // Fetch market data for each instrument
    for (const instrument of instruments) {
      try {
        const market = await this.fetchMarket(instrument);
        if (market) {
          markets.push(market);

          // Fetch order book if enabled
          if (this.includeOrderBook && market.clob_token_ids?.length) {
            for (const tokenId of market.clob_token_ids) {
              const orderBook = await this.fetchOrderBook(tokenId);
              if (orderBook) {
                orderBooks.set(tokenId, orderBook);
              }
            }
          }

          // Fetch recent trades if enabled
          if (this.includeRecentTrades && market.clob_token_ids?.length) {
            for (const tokenId of market.clob_token_ids) {
              const recentTrades = await this.fetchRecentTrades(tokenId);
              if (recentTrades?.length) {
                trades.set(tokenId, recentTrades);
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch data for ${instrument}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { markets, orderBooks, trades };
  }

  /**
   * Fetch individual market data
   */
  private async fetchMarket(
    conditionId: string,
  ): Promise<PolymarketMarket | null> {
    const url = `${this.baseUrl}/markets/${encodeURIComponent(conditionId)}`;

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
        this.logger.debug(
          `Market not found: ${conditionId} (${response.status})`,
        );
        return null;
      }

      const data = (await response.json()) as PolymarketMarket;
      return data;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.logger.debug(
          `Error fetching market ${conditionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch order book for a token
   */
  private async fetchOrderBook(
    tokenId: string,
  ): Promise<PolymarketOrderBook | null> {
    const url = `${this.baseUrl}/book?token_id=${encodeURIComponent(tokenId)}`;

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
        return null;
      }

      const data = (await response.json()) as PolymarketOrderBook;
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch recent trades for a token
   */
  private async fetchRecentTrades(
    tokenId: string,
  ): Promise<PolymarketTrade[] | null> {
    const url = `${this.baseUrl}/trades?token_id=${encodeURIComponent(tokenId)}&limit=10`;

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
        return null;
      }

      const data = (await response.json()) as PolymarketTrade[];
      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Polymarket response into sources with claims.
   */
  protected parseResponse(
    response: {
      markets: PolymarketMarket[];
      orderBooks: Map<string, PolymarketOrderBook>;
      trades: Map<string, PolymarketTrade[]>;
    },
    instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    // Create a source for each successfully fetched market
    for (const market of response.markets) {
      if (!market.condition_id) continue;

      const claims = this.extractClaims(
        market,
        response.orderBooks,
        response.trades,
      );

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              conditionId: market.condition_id,
              question: market.question,
              marketSlug: market.market_slug,
              active: market.active,
              closed: market.closed,
              endDate: market.end_date_iso,
            },
          }),
        );
      }
    }

    // Log any instruments that weren't found
    const foundConditions = new Set(
      response.markets.map((m) => m.condition_id),
    );
    const missingConditions = instruments.filter(
      (i) => !foundConditions.has(i),
    );
    if (missingConditions.length > 0) {
      this.logger.warn(
        `Markets not found in Polymarket: ${missingConditions.join(', ')}`,
      );
    }

    return sources;
  }

  /**
   * Extract claims from market data.
   */
  private extractClaims(
    market: PolymarketMarket,
    orderBooks: Map<string, PolymarketOrderBook>,
    trades: Map<string, PolymarketTrade[]>,
  ): Claim[] {
    const claims: Claim[] = [];
    const instrument = market.condition_id!;
    const timestamp = new Date().toISOString();

    // Extract odds/probability claims from tokens
    if (market.tokens && market.tokens.length > 0) {
      for (const token of market.tokens) {
        if (!token.outcome || token.price === undefined) continue;

        const price = this.safeNumber(token.price);
        if (price !== null) {
          // Probability claim (price is between 0 and 1)
          claims.push(
            this.createClaim('probability', instrument, price, {
              unit: 'probability',
              timestamp,
              confidence: 1.0,
              metadata: {
                outcome: token.outcome,
                tokenId: token.token_id,
              },
            }),
          );

          // Odds claim (convert probability to odds)
          const odds = price > 0 && price < 1 ? price / (1 - price) : null;
          if (odds !== null) {
            claims.push(
              this.createClaim('odds', instrument, odds, {
                unit: 'decimal',
                timestamp,
                confidence: 1.0,
                metadata: {
                  outcome: token.outcome,
                  tokenId: token.token_id,
                },
              }),
            );
          }
        }
      }
    }

    // Extract liquidity claims from order books
    if (market.clob_token_ids) {
      for (const tokenId of market.clob_token_ids) {
        const orderBook = orderBooks.get(tokenId);
        if (!orderBook) continue;

        // Calculate total liquidity
        const bidLiquidity = (orderBook.bids || []).reduce((sum, bid) => {
          const size = this.safeNumber(bid.size) || 0;
          const price = this.safeNumber(bid.price) || 0;
          return sum + size * price;
        }, 0);

        const askLiquidity = (orderBook.asks || []).reduce((sum, ask) => {
          const size = this.safeNumber(ask.size) || 0;
          const price = this.safeNumber(ask.price) || 0;
          return sum + size * price;
        }, 0);

        const totalLiquidity = bidLiquidity + askLiquidity;

        if (totalLiquidity > 0) {
          claims.push(
            this.createClaim('custom', instrument, totalLiquidity, {
              unit: 'USD',
              timestamp,
              confidence: 1.0,
              metadata: {
                claimSubtype: 'liquidity',
                tokenId,
                bidLiquidity,
                askLiquidity,
              },
            }),
          );
        }

        // Spread claim
        const bestBid = orderBook.bids?.[0];
        const bestAsk = orderBook.asks?.[0];
        if (bestBid?.price && bestAsk?.price) {
          const bidPrice = this.safeNumber(bestBid.price);
          const askPrice = this.safeNumber(bestAsk.price);
          if (
            bidPrice !== null &&
            askPrice !== null &&
            bidPrice > 0 &&
            askPrice > 0
          ) {
            const spread = askPrice - bidPrice;
            const spreadPercent = (spread / ((bidPrice + askPrice) / 2)) * 100;
            claims.push(
              this.createClaim('spread', instrument, spreadPercent, {
                unit: 'percent',
                timestamp,
                confidence: 1.0,
                metadata: {
                  tokenId,
                  spreadValue: spread,
                },
              }),
            );
          }
        }
      }
    }

    // Extract volume claims from recent trades
    if (market.clob_token_ids) {
      for (const tokenId of market.clob_token_ids) {
        const recentTrades = trades.get(tokenId);
        if (!recentTrades?.length) continue;

        // Calculate volume from recent trades
        const volume = recentTrades.reduce((sum, trade) => {
          const size = this.safeNumber(trade.size) || 0;
          const price = this.safeNumber(trade.price) || 0;
          return sum + size * price;
        }, 0);

        if (volume > 0) {
          claims.push(
            this.createClaim('volume', instrument, volume, {
              unit: 'USD',
              timestamp,
              confidence: 0.9, // Recent trades, not full volume
              metadata: {
                tokenId,
                tradeCount: recentTrades.length,
                timeframe: 'recent',
              },
            }),
          );
        }

        // Last trade price
        const lastTrade = recentTrades[0];
        if (lastTrade?.price) {
          const lastPrice = this.safeNumber(lastTrade.price);
          if (lastPrice !== null) {
            claims.push(
              this.createClaim('price', instrument, lastPrice, {
                unit: 'probability',
                timestamp: lastTrade.timestamp
                  ? new Date(lastTrade.timestamp * 1000).toISOString()
                  : timestamp,
                confidence: 1.0,
                metadata: {
                  tokenId,
                  side: lastTrade.side,
                },
              }),
            );
          }
        }
      }
    }

    return claims;
  }
}
