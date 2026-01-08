/**
 * CoinGecko Tool
 *
 * Fetches cryptocurrency market data from CoinGecko public API.
 * This is a free API that doesn't require an API key (free tier).
 *
 * FEATURES:
 * - Market cap, fully diluted valuation
 * - Circulating/total/max supply
 * - Price changes (1h, 24h, 7d, 30d)
 * - All-time high/low
 * - Market data across multiple exchanges
 *
 * LIMITATIONS:
 * - Rate limited to 10-50 requests/minute (free tier)
 * - API key recommended for production use
 * - Coin IDs must match CoinGecko format (bitcoin, ethereum, etc.)
 *
 * @module coingecko.tool
 */

import { Injectable } from '@nestjs/common';
import {
  BasePredictionTool,
  ToolConfig,
} from '../../stock-predictor/tools/base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * CoinGecko Coin Market Data
 * https://www.coingecko.com/api/documentation
 */
interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply?: number;
  max_supply?: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi?: {
    times: number;
    currency: string;
    percentage: number;
  };
  last_updated: string;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
}

/**
 * CoinGecko Tool configuration
 */
export interface CoinGeckoToolConfig extends ToolConfig {
  /** Include price change percentages (1h, 7d, 30d) */
  includeExtendedPriceChanges?: boolean;
}

/**
 * CoinGecko Tool
 *
 * Fetches cryptocurrency market data from CoinGecko.
 * No API key required for basic usage (free tier).
 *
 * Instruments should be CoinGecko coin IDs: bitcoin, ethereum, binancecoin, etc.
 * For convenience, this tool will convert common symbols:
 * - BTC -> bitcoin
 * - ETH -> ethereum
 * - BNB -> binancecoin
 *
 * @example
 * ```typescript
 * const tool = new CoinGeckoTool();
 * const sources = await tool.execute(['BTC', 'ETH', 'bitcoin']);
 * // Returns sources with market cap, supply, price claims
 * ```
 */
@Injectable()
export class CoinGeckoTool extends BasePredictionTool {
  readonly name = 'coingecko';
  readonly description = 'Fetches cryptocurrency market data from CoinGecko';

  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly timeoutMs: number;
  private readonly includeExtendedPriceChanges: boolean;
  private readonly apiKey?: string;

  constructor(config: CoinGeckoToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.includeExtendedPriceChanges =
      config.includeExtendedPriceChanges ?? true;
    this.apiKey = config.apiKey || process.env.COINGECKO_API_KEY;
  }

  /**
   * Fetch market data from CoinGecko API.
   */
  protected async fetchData(instruments: string[]): Promise<CoinGeckoMarket[]> {
    // Normalize instrument symbols to CoinGecko IDs
    const coinIds = instruments.map((i) => this.normalizeToCoinGeckoId(i));

    this.logger.debug(
      `Fetching CoinGecko market data for: ${coinIds.join(', ')}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Build URL with comma-separated coin IDs
      const idsParam = coinIds.join(',');
      const priceChangeParams = this.includeExtendedPriceChanges
        ? '&price_change_percentage=1h,7d,30d'
        : '';

      const url = `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsParam)}${priceChangeParams}`;

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      // Add API key if available
      if (this.apiKey) {
        headers['x-cg-demo-api-key'] = this.apiKey;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `CoinGecko API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as CoinGeckoMarket[];
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse CoinGecko response into sources with claims.
   */
  protected parseResponse(
    response: CoinGeckoMarket[],
    instruments: string[],
  ): Source[] {
    const sources: Source[] = [];
    const markets = Array.isArray(response) ? response : [response];

    // Create a source for each successfully fetched market
    for (const market of markets) {
      if (!market.id) continue;

      const claims = this.extractClaims(market);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              coinId: market.id,
              symbol: market.symbol,
              name: market.name,
              exchange: 'coingecko',
              marketCapRank: market.market_cap_rank,
              lastUpdated: market.last_updated,
            },
          }),
        );
      }
    }

    // Log any instruments that weren't found
    const foundIds = new Set(markets.map((m) => m.id));
    const normalizedInstruments = instruments.map((i) =>
      this.normalizeToCoinGeckoId(i),
    );
    const missingIds = normalizedInstruments.filter((i) => !foundIds.has(i));
    if (missingIds.length > 0) {
      this.logger.warn(
        `Coin IDs not found in CoinGecko: ${missingIds.join(', ')}`,
      );
    }

    return sources;
  }

  /**
   * Extract claims from a market data result.
   */
  private extractClaims(market: CoinGeckoMarket): Claim[] {
    const claims: Claim[] = [];
    const instrument = market.symbol.toUpperCase();
    const timestamp = new Date(market.last_updated).toISOString();

    // Price claim
    const price = this.safeNumber(market.current_price);
    if (price !== null) {
      claims.push(
        this.createClaim('price', instrument, price, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { coinId: market.id },
        }),
      );
    }

    // Market cap claim
    const marketCap = this.safeNumber(market.market_cap);
    if (marketCap !== null) {
      claims.push(
        this.createClaim('market_cap', instrument, marketCap, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { rank: market.market_cap_rank },
        }),
      );
    }

    // Fully diluted valuation
    const fdv = this.safeNumber(market.fully_diluted_valuation);
    if (fdv !== null) {
      claims.push(
        this.createClaim('market_cap', instrument, fdv, {
          unit: 'USD',
          timestamp,
          confidence: 0.95,
          metadata: { type: 'fully_diluted_valuation' },
        }),
      );
    }

    // Volume claim
    const volume = this.safeNumber(market.total_volume);
    if (volume !== null) {
      claims.push(
        this.createClaim('volume', instrument, volume, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { type: 'total_volume_24h' },
        }),
      );
    }

    // 24h high/low
    const high24h = this.safeNumber(market.high_24h);
    if (high24h !== null) {
      claims.push(
        this.createClaim('high', instrument, high24h, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { period: '24h' },
        }),
      );
    }

    const low24h = this.safeNumber(market.low_24h);
    if (low24h !== null) {
      claims.push(
        this.createClaim('low', instrument, low24h, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { period: '24h' },
        }),
      );
    }

    // Price change claims
    const priceChange24h = this.safeNumber(market.price_change_24h);
    if (priceChange24h !== null) {
      claims.push(
        this.createClaim('change', instrument, priceChange24h, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: { period: '24h' },
        }),
      );
    }

    const priceChangePercent24h = this.safeNumber(
      market.price_change_percentage_24h,
    );
    if (priceChangePercent24h !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, priceChangePercent24h, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
          metadata: { period: '24h' },
        }),
      );
    }

    // Extended price changes (if available)
    if (this.includeExtendedPriceChanges) {
      const priceChange1h = this.safeNumber(
        market.price_change_percentage_1h_in_currency,
      );
      if (priceChange1h !== null) {
        claims.push(
          this.createClaim('change_percent', instrument, priceChange1h, {
            unit: 'percent',
            timestamp,
            confidence: 1.0,
            metadata: { period: '1h' },
          }),
        );
      }

      const priceChange7d = this.safeNumber(
        market.price_change_percentage_7d_in_currency,
      );
      if (priceChange7d !== null) {
        claims.push(
          this.createClaim('change_percent', instrument, priceChange7d, {
            unit: 'percent',
            timestamp,
            confidence: 1.0,
            metadata: { period: '7d' },
          }),
        );
      }

      const priceChange30d = this.safeNumber(
        market.price_change_percentage_30d_in_currency,
      );
      if (priceChange30d !== null) {
        claims.push(
          this.createClaim('change_percent', instrument, priceChange30d, {
            unit: 'percent',
            timestamp,
            confidence: 1.0,
            metadata: { period: '30d' },
          }),
        );
      }
    }

    // Supply claims
    const circulatingSupply = this.safeNumber(market.circulating_supply);
    if (circulatingSupply !== null) {
      claims.push(
        this.createClaim('custom', instrument, circulatingSupply, {
          unit: market.symbol.toLowerCase(),
          timestamp,
          confidence: 1.0,
          metadata: { type: 'circulating_supply' },
        }),
      );
    }

    const totalSupply = this.safeNumber(market.total_supply);
    if (totalSupply !== null) {
      claims.push(
        this.createClaim('custom', instrument, totalSupply, {
          unit: market.symbol.toLowerCase(),
          timestamp,
          confidence: 0.95,
          metadata: { type: 'total_supply' },
        }),
      );
    }

    const maxSupply = this.safeNumber(market.max_supply);
    if (maxSupply !== null) {
      claims.push(
        this.createClaim('custom', instrument, maxSupply, {
          unit: market.symbol.toLowerCase(),
          timestamp,
          confidence: 1.0,
          metadata: { type: 'max_supply' },
        }),
      );
    }

    // All-time high/low
    const ath = this.safeNumber(market.ath);
    if (ath !== null) {
      claims.push(
        this.createClaim('custom', instrument, ath, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            type: 'all_time_high',
            athDate: market.ath_date,
            athChangePercent: market.ath_change_percentage,
          },
        }),
      );
    }

    const atl = this.safeNumber(market.atl);
    if (atl !== null) {
      claims.push(
        this.createClaim('custom', instrument, atl, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            type: 'all_time_low',
            atlDate: market.atl_date,
            atlChangePercent: market.atl_change_percentage,
          },
        }),
      );
    }

    return claims;
  }

  /**
   * Normalize instrument symbol to CoinGecko coin ID.
   * Converts common symbols to CoinGecko IDs.
   */
  private normalizeToCoinGeckoId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      BTC: 'bitcoin',
      ETH: 'ethereum',
      BNB: 'binancecoin',
      ADA: 'cardano',
      SOL: 'solana',
      XRP: 'ripple',
      DOT: 'polkadot',
      DOGE: 'dogecoin',
      AVAX: 'avalanche-2',
      MATIC: 'matic-network',
      LINK: 'chainlink',
      UNI: 'uniswap',
      ATOM: 'cosmos',
      LTC: 'litecoin',
      BCH: 'bitcoin-cash',
      NEAR: 'near',
      ALGO: 'algorand',
      VET: 'vechain',
      ICP: 'internet-computer',
      FIL: 'filecoin',
    };

    const upperSymbol = symbol.toUpperCase();
    return symbolMap[upperSymbol] || symbol.toLowerCase();
  }
}
