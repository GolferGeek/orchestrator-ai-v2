/**
 * Whale Alert Tool
 *
 * Fetches large cryptocurrency transaction alerts from Whale Alert API.
 * Monitors whale movements across major blockchains.
 *
 * FEATURES:
 * - Large transaction alerts (whale movements)
 * - Exchange inflows/outflows
 * - Cross-chain transfers
 * - USD value estimates
 *
 * LIMITATIONS:
 * - Requires API key (free tier: 10 calls/minute)
 * - Historical data requires paid tier
 * - Focus on largest transactions only
 *
 * @module whale-alerts.tool
 */

import { Injectable } from '@nestjs/common';
import { BasePredictionTool, ToolConfig } from './base-tool';
import { Source, Claim } from '../../base/base-prediction.types';

/**
 * Whale Alert Transaction
 */
interface WhaleAlertTransaction {
  blockchain: string;
  symbol: string;
  id: string;
  transaction_type: string;
  hash: string;
  from: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  to: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  timestamp: number;
  amount: number;
  amount_usd: number;
  transaction_count?: number;
}

interface WhaleAlertResponse {
  result: string;
  cursor?: string;
  count: number;
  transactions: WhaleAlertTransaction[];
}

/**
 * Whale Alert Tool configuration
 */
export interface WhaleAlertToolConfig extends ToolConfig {
  /** Minimum transaction size in USD */
  minTransactionUsd?: number;

  /** Maximum results to fetch */
  maxResults?: number;
}

/**
 * Whale Alert Tool
 *
 * Fetches large cryptocurrency transaction alerts from Whale Alert.
 * Requires WHALE_ALERT_API_KEY environment variable or mock mode.
 *
 * If no API key is available, returns mock data for demonstration.
 *
 * @example
 * ```typescript
 * const tool = new WhaleAlertTool();
 * const sources = await tool.execute(['BTC', 'ETH']);
 * // Returns sources with whale transaction claims
 * ```
 */
@Injectable()
export class WhaleAlertTool extends BasePredictionTool {
  readonly name = 'whale-alert';
  readonly description = 'Fetches large cryptocurrency transaction alerts';

  private readonly baseUrl = 'https://api.whale-alert.io/v1';
  private readonly timeoutMs: number;
  private readonly apiKey?: string;
  private readonly minTransactionUsd: number;
  private readonly maxResults: number;
  private readonly useMockData: boolean;

  constructor(config: WhaleAlertToolConfig = {}) {
    super();
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.apiKey = config.apiKey || process.env.WHALE_ALERT_API_KEY;
    this.minTransactionUsd = config.minTransactionUsd ?? 1_000_000; // $1M default
    this.maxResults = config.maxResults ?? 10;
    this.useMockData = !this.apiKey;

    if (this.useMockData) {
      this.logger.debug('Whale Alert API key not configured - using mock data');
    }
  }

  /**
   * Fetch whale alerts from Whale Alert API.
   */
  protected async fetchData(
    instruments: string[],
  ): Promise<WhaleAlertResponse> {
    // If no API key, return mock data
    if (this.useMockData) {
      return this.getMockData(instruments);
    }

    this.logger.debug(
      `Fetching Whale Alert transactions for: ${instruments.join(', ')}`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Get transactions from the last hour
      const now = Math.floor(Date.now() / 1000);
      const start = now - 3600; // Last hour
      const end = now;

      const url = `${this.baseUrl}/transactions?api_key=${this.apiKey}&start=${start}&end=${end}&min_value=${this.minTransactionUsd}&limit=${this.maxResults}`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Whale Alert API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as WhaleAlertResponse;

      if (data.result !== 'success') {
        throw new Error('Whale Alert API returned unsuccessful result');
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse Whale Alert response into sources with claims.
   */
  protected parseResponse(
    response: WhaleAlertResponse,
    _instruments: string[],
  ): Source[] {
    const sources: Source[] = [];

    if (!response.transactions || response.transactions.length === 0) {
      this.logger.debug('No whale transactions found');
      return [
        this.createSource([], {
          metadata: { message: 'No whale transactions in the last hour' },
        }),
      ];
    }

    // Group transactions by symbol
    const transactionsBySymbol = new Map<string, WhaleAlertTransaction[]>();
    for (const tx of response.transactions) {
      const symbol = tx.symbol.toUpperCase();
      if (!transactionsBySymbol.has(symbol)) {
        transactionsBySymbol.set(symbol, []);
      }
      transactionsBySymbol.get(symbol)!.push(tx);
    }

    // Create sources for each symbol
    for (const [symbol, transactions] of transactionsBySymbol.entries()) {
      const claims = this.extractClaimsFromTransactions(symbol, transactions);

      if (claims.length > 0) {
        sources.push(
          this.createSource(claims, {
            metadata: {
              exchange: 'whale-alert',
              transactionCount: transactions.length,
              blockchains: [...new Set(transactions.map((t) => t.blockchain))],
            },
          }),
        );
      }
    }

    return sources;
  }

  /**
   * Extract claims from whale transactions.
   */
  private extractClaimsFromTransactions(
    symbol: string,
    transactions: WhaleAlertTransaction[],
  ): Claim[] {
    const claims: Claim[] = [];

    for (const tx of transactions) {
      const timestamp = new Date(tx.timestamp * 1000).toISOString();

      // Whale transaction claim
      claims.push(
        this.createClaim('whale_transaction', symbol, tx.amount_usd, {
          unit: 'USD',
          timestamp,
          confidence: 1.0,
          metadata: {
            amount: tx.amount,
            amountUsd: tx.amount_usd,
            blockchain: tx.blockchain,
            hash: tx.hash,
            type: tx.transaction_type,
            from: tx.from.owner || tx.from.address.substring(0, 10),
            to: tx.to.owner || tx.to.address.substring(0, 10),
            fromType: tx.from.owner_type,
            toType: tx.to.owner_type,
          },
        }),
      );
    }

    // Aggregate statistics
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalVolumeUsd = transactions.reduce(
      (sum, tx) => sum + tx.amount_usd,
      0,
    );

    // Total whale volume claim
    claims.push(
      this.createClaim('volume', symbol, totalVolumeUsd, {
        unit: 'USD',
        timestamp: new Date().toISOString(),
        confidence: 1.0,
        metadata: {
          type: 'whale_volume_1h',
          totalVolume,
          transactionCount: transactions.length,
        },
      }),
    );

    // Categorize by transaction type
    const exchangeInflows = transactions.filter(
      (t) => t.to.owner_type === 'exchange',
    );
    const exchangeOutflows = transactions.filter(
      (t) => t.from.owner_type === 'exchange',
    );

    if (exchangeInflows.length > 0) {
      const inflowVolumeUsd = exchangeInflows.reduce(
        (sum, tx) => sum + tx.amount_usd,
        0,
      );
      claims.push(
        this.createClaim('custom', symbol, inflowVolumeUsd, {
          unit: 'USD',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          metadata: {
            type: 'exchange_inflow_1h',
            transactionCount: exchangeInflows.length,
          },
        }),
      );
    }

    if (exchangeOutflows.length > 0) {
      const outflowVolumeUsd = exchangeOutflows.reduce(
        (sum, tx) => sum + tx.amount_usd,
        0,
      );
      claims.push(
        this.createClaim('custom', symbol, outflowVolumeUsd, {
          unit: 'USD',
          timestamp: new Date().toISOString(),
          confidence: 1.0,
          metadata: {
            type: 'exchange_outflow_1h',
            transactionCount: exchangeOutflows.length,
          },
        }),
      );
    }

    return claims;
  }

  /**
   * Generate mock data for demonstration when API key is not available.
   */
  private getMockData(instruments: string[]): WhaleAlertResponse {
    const transactions: WhaleAlertTransaction[] = [];
    const now = Math.floor(Date.now() / 1000);

    // Generate 2-3 mock transactions per instrument
    for (const instrument of instruments.slice(0, 3)) {
      // Limit to 3 instruments
      const symbol = instrument.replace(/-.*/, '').toUpperCase();

      // Mock exchange inflow
      transactions.push({
        blockchain: symbol === 'BTC' ? 'bitcoin' : 'ethereum',
        symbol: symbol,
        id: `mock-${symbol}-1`,
        transaction_type: 'transfer',
        hash: `0x${Math.random().toString(16).substring(2, 42)}`,
        from: {
          address: '0x1234...5678',
          owner: 'unknown',
        },
        to: {
          address: '0xabcd...efgh',
          owner: 'Binance',
          owner_type: 'exchange',
        },
        timestamp: now - Math.floor(Math.random() * 3600),
        amount: 100 + Math.random() * 500,
        amount_usd: 5_000_000 + Math.random() * 10_000_000,
      });

      // Mock exchange outflow
      transactions.push({
        blockchain: symbol === 'BTC' ? 'bitcoin' : 'ethereum',
        symbol: symbol,
        id: `mock-${symbol}-2`,
        transaction_type: 'transfer',
        hash: `0x${Math.random().toString(16).substring(2, 42)}`,
        from: {
          address: '0xabcd...efgh',
          owner: 'Coinbase',
          owner_type: 'exchange',
        },
        to: {
          address: '0x9876...5432',
          owner: 'unknown',
        },
        timestamp: now - Math.floor(Math.random() * 3600),
        amount: 50 + Math.random() * 250,
        amount_usd: 2_000_000 + Math.random() * 5_000_000,
      });
    }

    return {
      result: 'success',
      count: transactions.length,
      transactions,
    };
  }
}
