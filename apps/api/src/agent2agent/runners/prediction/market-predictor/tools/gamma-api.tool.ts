/**
 * Gamma Markets API Tool
 *
 * Fetches detailed Polymarket data from Gamma Markets API.
 * Provides additional market metadata and analytics not available in CLOB API.
 *
 * FEATURES:
 * - Market metadata and descriptions
 * - Category and tag information
 * - Market status and resolution data
 * - Enhanced market discovery
 *
 * API DOCUMENTATION:
 * - Base URL: https://gamma-api.polymarket.com
 * - Free, no API key required
 * - Complements CLOB API with metadata
 *
 * @module gamma-api.tool
 */

import { Injectable } from '@nestjs/common';
import {
  BasePredictionTool,
  ToolConfig,
} from '../../financial-asset-predictor/tools/base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Gamma API market response
 */
interface GammaMarket {
  id?: string;
  question?: string;
  description?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  market_slug?: string;
  end_date_iso?: string;
  game_start_time?: string;
  outcomes?: string[];
  outcome_prices?: string[];
  category?: string;
  tags?: string[];
  volume?: string;
  liquidity?: string;
  volume_24hr?: string;
  notifications?: {
    type?: string;
    message?: string;
  }[];
  umaBond?: string;
  umaReward?: string;
}

/**
 * Gamma API Tool configuration
 */
export interface GammaApiToolConfig extends ToolConfig {
  /** Include market descriptions */
  includeDescriptions?: boolean;
}

/**
 * Gamma Markets API Tool
 *
 * Fetches market metadata and analytics from Gamma API.
 * No API key required - uses the free public API.
 *
 * NOTE: Instruments are Polymarket market slugs or condition IDs.
 *
 * @example
 * ```typescript
 * const tool = new GammaApiTool();
 * const sources = await tool.execute(['market-slug-1', 'market-slug-2']);
 * // Returns sources with metadata, volume, liquidity claims
 * ```
 */
@Injectable()
export class GammaApiTool extends BasePredictionTool {
  readonly name = 'gamma-api';
  readonly description =
    'Fetches market metadata and analytics from Gamma Markets API';

  private readonly baseUrl = 'https://gamma-api.polymarket.com';
  private readonly timeoutMs: number;
  private readonly includeDescriptions: boolean;

  constructor(config: GammaApiToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.includeDescriptions = config.includeDescriptions ?? true;
  }

  /**
   * Fetch market data from Gamma API.
   */
  protected async fetchData(instruments: string[]): Promise<GammaMarket[]> {
    this.logger.debug(`Fetching Gamma API data for: ${instruments.join(', ')}`);

    const markets: GammaMarket[] = [];

    // Fetch market data for each instrument
    for (const instrument of instruments) {
      try {
        const market = await this.fetchMarket(instrument);
        if (market) {
          markets.push(market);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch Gamma data for ${instrument}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return markets;
  }

  /**
   * Fetch individual market from Gamma API
   */
  private async fetchMarket(marketSlug: string): Promise<GammaMarket | null> {
    // Try market slug endpoint first
    let url = `${this.baseUrl}/markets/${encodeURIComponent(marketSlug)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      // If not found, try events endpoint (alternative API structure)
      if (!response.ok && response.status === 404) {
        url = `${this.baseUrl}/events?slug=${encodeURIComponent(marketSlug)}`;
        response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        this.logger.debug(
          `Market not found in Gamma: ${marketSlug} (${response.status})`,
        );
        return null;
      }

      const data = (await response.json()) as GammaMarket | GammaMarket[];

      // Handle both single market and array responses
      if (Array.isArray(data)) {
        return data.length > 0 ? (data[0] ?? null) : null;
      }

      return data;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.logger.debug(
          `Error fetching Gamma market ${marketSlug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Gamma API response into sources with claims.
   */
  protected parseResponse(
    response: GammaMarket[],
    instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    // Create a source for each successfully fetched market
    for (const market of response) {
      if (!market.id && !market.market_slug) continue;

      const claims = this.extractClaims(market);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              marketId: market.id,
              question: market.question,
              marketSlug: market.market_slug,
              description: this.includeDescriptions
                ? market.description
                : undefined,
              category: market.category,
              tags: market.tags,
              active: market.active,
              closed: market.closed,
              endDate: market.end_date_iso,
            },
          }),
        );
      }
    }

    // Log any instruments that weren't found
    const foundSlugs = new Set(response.map((m) => m.market_slug || m.id));
    const missingSlugs = instruments.filter((i) => !foundSlugs.has(i));
    if (missingSlugs.length > 0) {
      this.logger.warn(
        `Markets not found in Gamma API: ${missingSlugs.join(', ')}`,
      );
    }

    return sources;
  }

  /**
   * Extract claims from Gamma market data.
   */
  private extractClaims(market: GammaMarket): Claim[] {
    const claims: Claim[] = [];
    const instrument = market.market_slug || market.id!;
    const timestamp = new Date().toISOString();

    // Volume claim
    const totalVolume = this.safeNumber(market.volume);
    if (totalVolume !== null && totalVolume > 0) {
      claims.push(
        this.createClaim('volume', instrument, totalVolume, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            source: 'gamma',
            timeframe: 'total',
          },
        }),
      );
    }

    // 24-hour volume claim
    const volume24hr = this.safeNumber(market.volume_24hr);
    if (volume24hr !== null && volume24hr > 0) {
      claims.push(
        this.createClaim('volume', instrument, volume24hr, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            source: 'gamma',
            timeframe: '24hr',
          },
        }),
      );
    }

    // Liquidity claim
    const liquidity = this.safeNumber(market.liquidity);
    if (liquidity !== null && liquidity > 0) {
      claims.push(
        this.createClaim('custom', instrument, liquidity, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            claimSubtype: 'liquidity',
            source: 'gamma',
          },
        }),
      );
    }

    // Outcome probability claims from outcome_prices
    if (
      market.outcomes &&
      market.outcome_prices &&
      market.outcomes.length === market.outcome_prices.length
    ) {
      for (let i = 0; i < market.outcomes.length; i++) {
        const outcome = market.outcomes[i];
        const price = this.safeNumber(market.outcome_prices[i]);

        if (price !== null) {
          // Probability claim
          claims.push(
            this.createClaim('probability', instrument, price, {
              unit: 'probability',
              timestamp,
              confidence: 1.0,
              metadata: {
                outcome,
                source: 'gamma',
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
                  outcome,
                  source: 'gamma',
                },
              }),
            );
          }
        }
      }
    }

    // Event claims for notifications
    if (market.notifications && market.notifications.length > 0) {
      for (const notification of market.notifications) {
        if (notification.type && notification.message) {
          claims.push(
            this.createClaim('event', instrument, notification.message, {
              timestamp,
              confidence: 0.9,
              metadata: {
                eventType: notification.type,
                source: 'gamma',
              },
            }),
          );
        }
      }
    }

    // Custom claims for UMA bond/reward (indicator of market quality/security)
    const umaBond = this.safeNumber(market.umaBond);
    if (umaBond !== null && umaBond > 0) {
      claims.push(
        this.createClaim('custom', instrument, umaBond, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            claimSubtype: 'uma_bond',
            source: 'gamma',
          },
        }),
      );
    }

    const umaReward = this.safeNumber(market.umaReward);
    if (umaReward !== null && umaReward > 0) {
      claims.push(
        this.createClaim('custom', instrument, umaReward, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            claimSubtype: 'uma_reward',
            source: 'gamma',
          },
        }),
      );
    }

    return claims;
  }
}
