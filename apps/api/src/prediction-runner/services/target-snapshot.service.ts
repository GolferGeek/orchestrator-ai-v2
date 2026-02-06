import { Injectable, Logger } from '@nestjs/common';
import { TargetSnapshotRepository } from '../repositories/target-snapshot.repository';
import { TargetRepository } from '../repositories/target.repository';
import { UniverseRepository } from '../repositories/universe.repository';
import {
  TargetSnapshot,
  CreateTargetSnapshotData,
  PriceMove,
  MoveDetectionConfig,
  DEFAULT_MOVE_DETECTION_CONFIG,
  SnapshotSource,
} from '../interfaces/target-snapshot.interface';
import { Target } from '../interfaces/target.interface';

/**
 * TargetSnapshotService - Captures and manages target price/value history
 *
 * Used for:
 * - Outcome tracking (comparing predictions against actual values)
 * - Missed opportunity detection (finding significant moves without predictions)
 * - Historical analysis
 */
@Injectable()
export class TargetSnapshotService {
  private readonly logger = new Logger(TargetSnapshotService.name);

  constructor(
    private readonly snapshotRepository: TargetSnapshotRepository,
    private readonly targetRepository: TargetRepository,
    private readonly universeRepository: UniverseRepository,
  ) {}

  /**
   * Capture current value for a target
   * Also updates target.current_price for quick access
   */
  async captureSnapshot(
    targetId: string,
    value: number,
    source: SnapshotSource,
    metadata?: Record<string, unknown>,
  ): Promise<TargetSnapshot> {
    const target = await this.targetRepository.findByIdOrThrow(targetId);

    const snapshotData: CreateTargetSnapshotData = {
      target_id: targetId,
      value,
      value_type: this.getValueType(target.target_type),
      source,
      metadata,
    };

    // Create the snapshot in history table
    const snapshot = await this.snapshotRepository.create(snapshotData);

    // Also update the target's current_price for quick access
    await this.targetRepository.updateCurrentPrice(targetId, value);

    return snapshot;
  }

  /**
   * Capture snapshots for multiple targets in batch
   */
  async captureSnapshots(
    snapshots: Array<{
      targetId: string;
      value: number;
      source: SnapshotSource;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<TargetSnapshot[]> {
    const snapshotData: CreateTargetSnapshotData[] = [];

    for (const s of snapshots) {
      const target = await this.targetRepository.findById(s.targetId);
      if (target) {
        snapshotData.push({
          target_id: s.targetId,
          value: s.value,
          value_type: this.getValueType(target.target_type),
          source: s.source,
          metadata: s.metadata,
        });
      }
    }

    return this.snapshotRepository.createBatch(snapshotData);
  }

  /**
   * Get the latest value for a target
   * First checks target.current_price (cached), falls back to snapshot query
   */
  async getLatestValue(targetId: string): Promise<number | null> {
    // Try cached current_price first
    const target = await this.targetRepository.findById(targetId);
    if (target?.current_price !== null && target?.current_price !== undefined) {
      return target.current_price;
    }

    // Fall back to snapshot query
    const snapshot = await this.snapshotRepository.findLatest(targetId);
    return snapshot?.value ?? null;
  }

  /**
   * Get value at a specific time
   */
  async getValueAtTime(
    targetId: string,
    timestamp: string,
  ): Promise<number | null> {
    return this.snapshotRepository.getValueAtTime(targetId, timestamp);
  }

  /**
   * Calculate price change between two times
   */
  async calculateChange(
    targetId: string,
    startTime: string,
    endTime: string,
  ): Promise<{
    start_value: number | null;
    end_value: number | null;
    change_absolute: number | null;
    change_percent: number | null;
  }> {
    return this.snapshotRepository.calculateChange(
      targetId,
      startTime,
      endTime,
    );
  }

  /**
   * Detect significant price moves for a target
   */
  async detectMoves(
    targetId: string,
    config?: Partial<MoveDetectionConfig>,
  ): Promise<PriceMove[]> {
    const target = await this.targetRepository.findByIdOrThrow(targetId);
    const universe = await this.universeRepository.findByIdOrThrow(
      target.universe_id,
    );

    // Get domain-specific config with fallback defaults
    const defaultConfig: MoveDetectionConfig = {
      min_change_percent: 5,
      lookback_hours: 48,
      min_duration_hours: 4,
    };
    const domainConfig =
      DEFAULT_MOVE_DETECTION_CONFIG[universe.domain] ?? defaultConfig;

    const fullConfig: MoveDetectionConfig = {
      min_change_percent:
        config?.min_change_percent ?? domainConfig.min_change_percent,
      lookback_hours: config?.lookback_hours ?? domainConfig.lookback_hours,
      min_duration_hours:
        config?.min_duration_hours ?? domainConfig.min_duration_hours,
    };

    return this.snapshotRepository.detectMoves(targetId, fullConfig);
  }

  /**
   * Detect moves across all targets in a universe
   */
  async detectMovesInUniverse(
    universeId: string,
    config?: Partial<MoveDetectionConfig>,
  ): Promise<Map<string, PriceMove[]>> {
    const targets = await this.targetRepository.findAll(universeId);
    const moves = new Map<string, PriceMove[]>();

    for (const target of targets) {
      const targetMoves = await this.detectMoves(target.id, config);
      if (targetMoves.length > 0) {
        moves.set(target.id, targetMoves);
      }
    }

    return moves;
  }

  /**
   * Get historical snapshots for a target
   */
  async getHistory(targetId: string, hours: number): Promise<TargetSnapshot[]> {
    return this.snapshotRepository.findRecent(targetId, hours);
  }

  /**
   * Get snapshots in a time range
   */
  async getHistoryInRange(
    targetId: string,
    startTime: string,
    endTime: string,
  ): Promise<TargetSnapshot[]> {
    return this.snapshotRepository.findInRange(targetId, startTime, endTime);
  }

  /**
   * Fetch and capture value from external API based on target type
   * This is a dispatcher that calls domain-specific fetchers
   */
  async fetchAndCaptureValue(targetId: string): Promise<TargetSnapshot | null> {
    const target = await this.targetRepository.findByIdOrThrow(targetId);
    const universe = await this.universeRepository.findByIdOrThrow(
      target.universe_id,
    );

    let value: number | null = null;
    let source: SnapshotSource = 'other';
    let metadata: Record<string, unknown> = {};

    switch (universe.domain) {
      case 'stocks': {
        const stockData = await this.fetchStockPrice(target);
        if (stockData) {
          value = stockData.price;
          source = 'polygon';
          metadata = stockData;
        }
        break;
      }

      case 'crypto': {
        const cryptoData = await this.fetchCryptoPrice(target);
        if (cryptoData) {
          value = cryptoData.price;
          source = 'coingecko';
          metadata = cryptoData;
        }
        break;
      }

      case 'polymarket': {
        const marketData = await this.fetchPolymarketPrice(target);
        if (marketData) {
          value = marketData.probability;
          source = 'polymarket';
          metadata = marketData;
        }
        break;
      }

      case 'elections':
        // Elections typically don't have real-time prices
        // They use polling data or prediction market prices
        this.logger.debug(`Election targets use external polling data`);
        return null;

      default: {
        // Exhaustive check - this should never happen
        const exhaustiveCheck: never = universe.domain;
        this.logger.warn(`Unknown domain: ${String(exhaustiveCheck)}`);
        return null;
      }
    }

    if (value === null) {
      this.logger.warn(
        `Failed to fetch value for target ${targetId} (${target.symbol})`,
      );
      return null;
    }

    return this.captureSnapshot(targetId, value, source, metadata);
  }

  /**
   * Fetch stock price from Polygon
   */
  private async fetchStockPrice(target: Target): Promise<{
    price: number;
    high: number;
    low: number;
    open: number;
    close: number;
    volume: number;
  } | null> {
    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      this.logger.warn('POLYGON_API_KEY not configured');
      return null;
    }

    try {
      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${target.symbol}/prev?apiKey=${apiKey}`,
      );

      if (!response.ok) {
        this.logger.error(
          `Polygon API error: ${response.status} - ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        results?: Array<{
          c: number;
          h: number;
          l: number;
          o: number;
          v: number;
        }>;
      };
      const result = data.results?.[0];

      if (!result) {
        return null;
      }

      return {
        price: result.c, // Close price
        high: result.h,
        low: result.l,
        open: result.o,
        close: result.c,
        volume: result.v,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch stock price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Fetch crypto price from CoinGecko
   */
  /** Map ticker symbols to CoinGecko coin IDs */
  private static readonly CRYPTO_SYMBOL_TO_COINGECKO: Record<string, string> = {
    btc: 'bitcoin',
    eth: 'ethereum',
    sol: 'solana',
    avax: 'avalanche-2',
    ada: 'cardano',
    dot: 'polkadot',
    matic: 'matic-network',
    link: 'chainlink',
    uni: 'uniswap',
    atom: 'cosmos',
    xrp: 'ripple',
    doge: 'dogecoin',
    shib: 'shiba-inu',
    ltc: 'litecoin',
    bnb: 'binancecoin',
    near: 'near',
    arb: 'arbitrum',
    op: 'optimism',
    sui: 'sui',
    apt: 'aptos',
  };

  private async fetchCryptoPrice(target: Target): Promise<{
    price: number;
    market_cap: number;
    volume_24h: number;
    change_24h: number;
  } | null> {
    try {
      // CoinGecko uses coin IDs (e.g. 'bitcoin'), not ticker symbols (e.g. 'BTC')
      const symbolLower = target.symbol.toLowerCase();
      const coinId =
        TargetSnapshotService.CRYPTO_SYMBOL_TO_COINGECKO[symbolLower] ||
        symbolLower;

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`,
      );

      if (!response.ok) {
        this.logger.error(
          `CoinGecko API error: ${response.status} - ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as Record<
        string,
        {
          usd: number;
          usd_market_cap: number;
          usd_24h_vol: number;
          usd_24h_change: number;
        }
      >;
      const coinData = data[coinId];

      if (!coinData) {
        return null;
      }

      return {
        price: coinData.usd,
        market_cap: coinData.usd_market_cap,
        volume_24h: coinData.usd_24h_vol,
        change_24h: coinData.usd_24h_change,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch crypto price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Fetch Polymarket probability
   */
  private async fetchPolymarketPrice(target: Target): Promise<{
    probability: number;
    volume: number;
    liquidity: number;
  } | null> {
    // Polymarket API integration
    // Note: Polymarket has a GraphQL API
    const apiKey = process.env.POLYMARKET_API_KEY;

    try {
      // This is a simplified example - actual implementation would use
      // the Polymarket GraphQL API or CLOB API
      const marketId = target.symbol; // Assume symbol is the market ID

      const response = await fetch(
        `https://clob.polymarket.com/markets/${marketId}`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        },
      );

      if (!response.ok) {
        this.logger.error(
          `Polymarket API error: ${response.status} - ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        outcomePrices?: number[];
        volume?: number;
        liquidity?: number;
      };

      return {
        probability: data.outcomePrices?.[0] ?? 0.5,
        volume: data.volume ?? 0,
        liquidity: data.liquidity ?? 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch Polymarket price: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Determine value type based on target type
   */
  private getValueType(
    targetType: string,
  ): 'price' | 'probability' | 'index' | 'other' {
    switch (targetType) {
      case 'stock':
      case 'crypto':
      case 'commodity':
      case 'forex':
        return 'price';
      case 'election':
      case 'polymarket':
        return 'probability';
      case 'index':
        return 'index';
      default:
        return 'other';
    }
  }

  /**
   * Cleanup old snapshots to manage storage
   */
  async cleanupOldSnapshots(
    targetId: string,
    retentionDays = 90,
  ): Promise<number> {
    return this.snapshotRepository.cleanupOldSnapshots(targetId, retentionDays);
  }
}
