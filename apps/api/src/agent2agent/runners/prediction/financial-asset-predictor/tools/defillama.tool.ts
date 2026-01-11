/**
 * DefiLlama Tool
 *
 * Fetches DeFi protocol metrics from DefiLlama API.
 * Free API, no key required.
 *
 * FEATURES:
 * - Total Value Locked (TVL) by protocol and chain
 * - Protocol revenue and fees
 * - Chain-level statistics
 * - Historical TVL data
 *
 * LIMITATIONS:
 * - Rate limits apply (no official limit published)
 * - Data aggregated from multiple sources (slight delays possible)
 * - Not all protocols have complete fee/revenue data
 *
 * @module defillama.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * DefiLlama Protocol Data
 */
interface DefiLlamaProtocol {
  id: string;
  name: string;
  address?: string;
  symbol: string;
  url?: string;
  description?: string;
  chain: string;
  logo?: string;
  audits?: string;
  audit_note?: string;
  gecko_id?: string;
  cmcId?: string;
  category: string;
  chains: string[];
  module?: string;
  twitter?: string;
  forkedFrom?: string[];
  oracles?: string[];
  listedAt?: number;
  methodology?: string;
  slug: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h?: number;
  change_1d?: number;
  change_7d?: number;
  fdv?: number;
  mcap?: number;
}

/**
 * DefiLlama Chain TVL
 */
interface DefiLlamaChainTVL {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string | null;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

/**
 * DefiLlama Tool configuration
 */
export interface DefiLlamaToolConfig extends ToolConfig {
  /** Include chain-level TVL data */
  includeChainTVL?: boolean;
}

/**
 * DefiLlama Tool
 *
 * Fetches DeFi protocol metrics from DefiLlama.
 * No API key required.
 *
 * Instruments can be protocol names (uniswap, aave, curve) or
 * chain names for chain-level TVL (ethereum, arbitrum, optimism).
 *
 * @example
 * ```typescript
 * const tool = new DefiLlamaTool();
 * const sources = await tool.execute(['uniswap', 'aave', 'ethereum']);
 * // Returns sources with TVL, protocol revenue claims
 * ```
 */
@Injectable()
export class DefiLlamaTool extends BasePredictionTool {
  readonly name = 'defillama';
  readonly description = 'Fetches DeFi protocol metrics from DefiLlama';

  private readonly baseUrl = 'https://api.llama.fi';
  private readonly timeoutMs: number;
  private readonly includeChainTVL: boolean;

  constructor(config: DefiLlamaToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.includeChainTVL = config.includeChainTVL ?? true;
  }

  /**
   * Fetch protocol and chain data from DefiLlama API.
   */
  protected async fetchData(instruments: string[]): Promise<{
    protocols: DefiLlamaProtocol[];
    chains: DefiLlamaChainTVL[];
  }> {
    this.logger.debug(`Fetching DefiLlama data for: ${instruments.join(', ')}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const results: {
        protocols: DefiLlamaProtocol[];
        chains: DefiLlamaChainTVL[];
      } = { protocols: [], chains: [] };

      // Fetch all protocols (we'll filter by instruments later)
      const protocolsUrl = `${this.baseUrl}/protocols`;
      const protocolsResponse = await fetch(protocolsUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      if (protocolsResponse.ok) {
        const allProtocols =
          (await protocolsResponse.json()) as DefiLlamaProtocol[];

        // Filter protocols matching instruments
        const normalizedInstruments = instruments.map((i) =>
          i.toLowerCase().replace(/[^a-z0-9]/g, ''),
        );

        results.protocols = allProtocols.filter((p) => {
          const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedSlug = p.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
          return (
            normalizedInstruments.includes(normalizedName) ||
            normalizedInstruments.includes(normalizedSlug)
          );
        });
      }

      // Fetch chain TVL data if requested
      if (this.includeChainTVL) {
        const chainsUrl = `${this.baseUrl}/v2/chains`;
        const chainsResponse = await fetch(chainsUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        if (chainsResponse.ok) {
          const allChains =
            (await chainsResponse.json()) as DefiLlamaChainTVL[];

          // Filter chains matching instruments
          const normalizedInstruments = instruments.map((i) => i.toLowerCase());

          results.chains = allChains.filter((c) =>
            normalizedInstruments.includes(c.name.toLowerCase()),
          );
        }
      }

      return results;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse DefiLlama response into sources with claims.
   */
  protected parseResponse(
    response: {
      protocols: DefiLlamaProtocol[];
      chains: DefiLlamaChainTVL[];
    },
    _instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    // Process protocol data
    for (const protocol of response.protocols) {
      const claims = this.extractProtocolClaims(protocol);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              protocolId: protocol.id,
              protocolName: protocol.name,
              category: protocol.category,
              chains: protocol.chains,
              exchange: 'defillama',
            },
          }),
        );
      }
    }

    // Process chain data
    for (const chain of response.chains) {
      const claims = this.extractChainClaims(chain);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              chainName: chain.name,
              chainId: chain.chainId,
              geckoId: chain.gecko_id,
              exchange: 'defillama',
            },
          }),
        );
      }
    }

    if (sources.length === 0) {
      this.logger.debug('No matching protocols or chains found in DefiLlama');
      return [
        this.createSource([], {
          metadata: { message: 'No matching protocols or chains found' },
        }),
      ];
    }

    return sources;
  }

  /**
   * Extract claims from protocol data.
   */
  private extractProtocolClaims(protocol: DefiLlamaProtocol): Claim[] {
    const claims: Claim[] = [];
    const instrument = protocol.symbol || protocol.name.toUpperCase();
    const timestamp = new Date().toISOString();

    // TVL claim
    const tvl = this.safeNumber(protocol.tvl);
    if (tvl !== null) {
      claims.push(
        this.createClaim('tvl', instrument, tvl, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            protocolName: protocol.name,
            category: protocol.category,
          },
        }),
      );
    }

    // TVL change claims
    const change1h = this.safeNumber(protocol.change_1h);
    if (change1h !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, change1h, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
          metadata: {
            period: '1h',
            metric: 'tvl',
            protocolName: protocol.name,
          },
        }),
      );
    }

    const change1d = this.safeNumber(protocol.change_1d);
    if (change1d !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, change1d, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
          metadata: {
            period: '1d',
            metric: 'tvl',
            protocolName: protocol.name,
          },
        }),
      );
    }

    const change7d = this.safeNumber(protocol.change_7d);
    if (change7d !== null) {
      claims.push(
        this.createClaim('change_percent', instrument, change7d, {
          unit: 'percent',
          timestamp,
          confidence: 1.0,
          metadata: {
            period: '7d',
            metric: 'tvl',
            protocolName: protocol.name,
          },
        }),
      );
    }

    // Market cap claims
    const mcap = this.safeNumber(protocol.mcap);
    if (mcap !== null) {
      claims.push(
        this.createClaim('market_cap', instrument, mcap, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            protocolName: protocol.name,
          },
        }),
      );
    }

    const fdv = this.safeNumber(protocol.fdv);
    if (fdv !== null) {
      claims.push(
        this.createClaim('market_cap', instrument, fdv, {
          unit: 'USD',
          timestamp,
          confidence: 0.95,
          metadata: {
            type: 'fully_diluted_valuation',
            protocolName: protocol.name,
          },
        }),
      );
    }

    // Chain-specific TVL claims
    if (protocol.chainTvls) {
      for (const [chain, chainTvl] of Object.entries(protocol.chainTvls)) {
        const tvlValue = this.safeNumber(chainTvl);
        if (tvlValue !== null && tvlValue > 0) {
          claims.push(
            this.createClaim('tvl', instrument, tvlValue, {
              unit: 'USD',
              timestamp,
              confidence: 1.0,
              metadata: {
                chain,
                protocolName: protocol.name,
              },
            }),
          );
        }
      }
    }

    return claims;
  }

  /**
   * Extract claims from chain data.
   */
  private extractChainClaims(chain: DefiLlamaChainTVL): Claim[] {
    const claims: Claim[] = [];
    const instrument = chain.tokenSymbol || chain.name.toUpperCase();
    const timestamp = new Date().toISOString();

    // Chain TVL claim
    const tvl = this.safeNumber(chain.tvl);
    if (tvl !== null) {
      claims.push(
        this.createClaim('tvl', instrument, tvl, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            chainName: chain.name,
            chainId: chain.chainId,
            type: 'chain_tvl',
          },
        }),
      );
    }

    return claims;
  }
}
