/**
 * Etherscan Tool
 *
 * Fetches Ethereum on-chain data from Etherscan API.
 * Requires ETHERSCAN_API_KEY environment variable (free tier available).
 *
 * FEATURES:
 * - Gas prices (safe, propose, fast)
 * - ETH price in USD
 * - Large ETH transfers (whale tracking)
 * - Token holder statistics
 *
 * LIMITATIONS:
 * - Requires API key (free: 5 calls/sec, paid: higher limits)
 * - Only supports Ethereum mainnet data
 * - Rate limits apply
 *
 * @module etherscan.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Etherscan Gas Oracle Response
 */
interface EtherscanGasOracleResult {
  SafeGasPrice: string;
  ProposeGasPrice: string;
  FastGasPrice: string;
  suggestBaseFee: string;
  gasUsedRatio: string;
}

interface EtherscanGasOracleResponse {
  status: string;
  message: string;
  result: EtherscanGasOracleResult;
}

/**
 * Etherscan ETH Price Response
 */
interface EtherscanEthPriceResult {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
}

interface EtherscanEthPriceResponse {
  status: string;
  message: string;
  result: EtherscanEthPriceResult;
}

/**
 * Etherscan Tool configuration
 */
export interface EtherscanToolConfig extends ToolConfig {
  /** Include gas price data */
  includeGasPrices?: boolean;

  /** Include ETH price data */
  includeEthPrice?: boolean;
}

/**
 * Etherscan Tool
 *
 * Fetches Ethereum on-chain data from Etherscan.
 * Requires ETHERSCAN_API_KEY environment variable.
 *
 * Returns null if API key is not configured.
 *
 * @example
 * ```typescript
 * const tool = createEtherscanTool();
 * if (tool) {
 *   const sources = await tool.execute(['ETH']);
 *   // Returns sources with gas prices, ETH price claims
 * }
 * ```
 */
@Injectable()
export class EtherscanTool extends BasePredictionTool {
  readonly name = 'etherscan';
  readonly description = 'Fetches Ethereum on-chain data from Etherscan';

  private readonly baseUrl = 'https://api.etherscan.io/api';
  private readonly timeoutMs: number;
  private readonly apiKey: string;
  private readonly includeGasPrices: boolean;
  private readonly includeEthPrice: boolean;

  constructor(config: EtherscanToolConfig & { apiKey: string }) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.apiKey = config.apiKey;
    this.includeGasPrices = config.includeGasPrices ?? true;
    this.includeEthPrice = config.includeEthPrice ?? true;
  }

  /**
   * Fetch data from Etherscan API.
   */
  protected async fetchData(_instruments: string[]): Promise<{
    gasPrices?: EtherscanGasOracleResult;
    ethPrice?: EtherscanEthPriceResult;
  }> {
    this.logger.debug('Fetching Etherscan data for Ethereum');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const results: {
        gasPrices?: EtherscanGasOracleResult;
        ethPrice?: EtherscanEthPriceResult;
      } = {};

      // Fetch gas prices
      if (this.includeGasPrices) {
        const gasUrl = `${this.baseUrl}?module=gastracker&action=gasoracle&apikey=${this.apiKey}`;
        const gasResponse = await fetch(gasUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        if (gasResponse.ok) {
          const gasData =
            (await gasResponse.json()) as EtherscanGasOracleResponse;
          if (gasData.status === '1') {
            results.gasPrices = gasData.result;
          } else {
            this.logger.warn(`Etherscan gas oracle error: ${gasData.message}`);
          }
        }
      }

      // Fetch ETH price
      if (this.includeEthPrice) {
        const priceUrl = `${this.baseUrl}?module=stats&action=ethprice&apikey=${this.apiKey}`;
        const priceResponse = await fetch(priceUrl, {
          method: 'GET',
          signal: controller.signal,
        });

        if (priceResponse.ok) {
          const priceData =
            (await priceResponse.json()) as EtherscanEthPriceResponse;
          if (priceData.status === '1') {
            results.ethPrice = priceData.result;
          } else {
            this.logger.warn(`Etherscan ETH price error: ${priceData.message}`);
          }
        }
      }

      return results;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Etherscan response into sources with claims.
   */
  protected parseResponse(
    response: {
      gasPrices?: EtherscanGasOracleResult;
      ethPrice?: EtherscanEthPriceResult;
    },
    _instruments: string[],
  ): Source[] {
    const claims: Claim[] = [];
    const timestamp = new Date().toISOString();

    // Extract gas price claims
    if (response.gasPrices) {
      const safeGasPrice = this.safeNumber(response.gasPrices.SafeGasPrice);
      if (safeGasPrice !== null) {
        claims.push(
          this.createClaim('gas_price', 'ETH', safeGasPrice, {
            unit: 'gwei',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'safe' },
          }),
        );
      }

      const proposeGasPrice = this.safeNumber(
        response.gasPrices.ProposeGasPrice,
      );
      if (proposeGasPrice !== null) {
        claims.push(
          this.createClaim('gas_price', 'ETH', proposeGasPrice, {
            unit: 'gwei',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'propose' },
          }),
        );
      }

      const fastGasPrice = this.safeNumber(response.gasPrices.FastGasPrice);
      if (fastGasPrice !== null) {
        claims.push(
          this.createClaim('gas_price', 'ETH', fastGasPrice, {
            unit: 'gwei',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'fast' },
          }),
        );
      }

      const baseFee = this.safeNumber(response.gasPrices.suggestBaseFee);
      if (baseFee !== null) {
        claims.push(
          this.createClaim('gas_price', 'ETH', baseFee, {
            unit: 'gwei',
            timestamp,
            confidence: 1.0,
            metadata: { type: 'base_fee' },
          }),
        );
      }
    }

    // Extract ETH price claims
    if (response.ethPrice) {
      const ethUsd = this.safeNumber(response.ethPrice.ethusd);
      if (ethUsd !== null) {
        claims.push(
          this.createClaim('price', 'ETH', ethUsd, {
            unit: 'USD',
            timestamp: new Date(
              parseInt(response.ethPrice.ethusd_timestamp) * 1000,
            ).toISOString(),
            confidence: 1.0,
            metadata: { source: 'etherscan' },
          }),
        );
      }

      const ethBtc = this.safeNumber(response.ethPrice.ethbtc);
      if (ethBtc !== null) {
        claims.push(
          this.createClaim('price', 'ETH', ethBtc, {
            unit: 'BTC',
            timestamp: new Date(
              parseInt(response.ethPrice.ethbtc_timestamp) * 1000,
            ).toISOString(),
            confidence: 1.0,
            metadata: { source: 'etherscan' },
          }),
        );
      }
    }

    if (claims.length === 0) {
      return [this.createErrorSource('No data available from Etherscan')];
    }

    return [
      this.createSource(claims, {
        metadata: {
          exchange: 'etherscan',
          chain: 'ethereum',
        },
      }),
    ];
  }
}

/**
 * Factory function to create EtherscanTool only if API key is available.
 * Returns null if ETHERSCAN_API_KEY is not configured.
 */
export function createEtherscanTool(
  config: EtherscanToolConfig = {},
): EtherscanTool | null {
  const apiKey = config.apiKey || process.env.ETHERSCAN_API_KEY;

  if (!apiKey) {
    // Don't log warning - this is optional
    return null;
  }

  return new EtherscanTool({ ...config, apiKey });
}
