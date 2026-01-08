/**
 * Whale Alert Tool Tests
 *
 * Tests the WhaleAlertTool for fetching large cryptocurrency transaction alerts.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { WhaleAlertTool, WhaleAlertToolConfig } from '../whale-alerts.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('WhaleAlertTool', () => {
  let tool: WhaleAlertTool;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WHALE_ALERT_API_KEY;
    tool = new WhaleAlertTool({ apiKey: 'test-api-key' });
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('whale-alert');
      expect(tool.description).toBe(
        'Fetches large cryptocurrency transaction alerts',
      );
    });

    it('should accept custom config', () => {
      const config: WhaleAlertToolConfig = {
        timeoutMs: 5000,
        minTransactionUsd: 5_000_000,
        maxResults: 20,
        apiKey: 'custom-key',
      };
      const customTool = new WhaleAlertTool(config);
      expect(customTool.name).toBe('whale-alert');
    });

    it('should use mock data when no API key is configured', () => {
      const toolWithoutKey = new WhaleAlertTool();
      expect(toolWithoutKey.name).toBe('whale-alert');
    });
  });

  describe('execute with API key', () => {
    const mockWhaleAlertResponse = {
      result: 'success',
      cursor: 'abc123',
      count: 3,
      transactions: [
        {
          blockchain: 'bitcoin',
          symbol: 'BTC',
          id: 'tx-1',
          transaction_type: 'transfer',
          hash: '0xabc123',
          from: {
            address: '0x1234567890abcdef',
            owner: 'unknown',
          },
          to: {
            address: '0xabcdef1234567890',
            owner: 'Binance',
            owner_type: 'exchange',
          },
          timestamp: Math.floor(Date.now() / 1000) - 1800,
          amount: 100.5,
          amount_usd: 4_500_000,
        },
        {
          blockchain: 'ethereum',
          symbol: 'ETH',
          id: 'tx-2',
          transaction_type: 'transfer',
          hash: '0xdef456',
          from: {
            address: '0x9876543210fedcba',
            owner: 'Coinbase',
            owner_type: 'exchange',
          },
          to: {
            address: '0xfedcba0987654321',
            owner: 'unknown',
          },
          timestamp: Math.floor(Date.now() / 1000) - 900,
          amount: 1500.25,
          amount_usd: 4_500_750,
        },
        {
          blockchain: 'bitcoin',
          symbol: 'BTC',
          id: 'tx-3',
          transaction_type: 'transfer',
          hash: '0xghi789',
          from: {
            address: '0xaabbccdd11223344',
            owner: 'unknown',
          },
          to: {
            address: '0x44332211ddccbbaa',
            owner: 'Kraken',
            owner_type: 'exchange',
          },
          timestamp: Math.floor(Date.now() / 1000) - 600,
          amount: 75.8,
          amount_usd: 3_400_000,
        },
      ],
    };

    it('should fetch whale transactions successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBeGreaterThan(0);
    });

    it('should extract whale transaction claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);
      const btcSource = sources.find((s) => s.metadata?.transactionCount === 2);

      expect(btcSource).toBeDefined();
      const whaleTransactionClaims = btcSource?.claims.filter(
        (c: Claim) => c.type === 'whale_transaction',
      );
      expect(whaleTransactionClaims?.length).toBeGreaterThan(0);
    });

    it('should include transaction metadata in claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);
      const btcSource = sources.find((s) => s.metadata?.transactionCount === 2);
      const whaleClaim = btcSource?.claims.find(
        (c: Claim) => c.type === 'whale_transaction',
      );

      expect(whaleClaim).toBeDefined();
      expect(whaleClaim?.value).toBeGreaterThan(0);
      expect(whaleClaim?.unit).toBe('USD');
      expect(whaleClaim?.metadata?.blockchain).toBeDefined();
      expect(whaleClaim?.metadata?.hash).toBeDefined();
      expect(whaleClaim?.metadata?.type).toBe('transfer');
    });

    it('should extract whale volume aggregates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);
      const btcSource = sources.find((s) => s.metadata?.transactionCount === 2);

      const volumeClaim = btcSource?.claims.find(
        (c: Claim) =>
          c.type === 'volume' && c.metadata?.type === 'whale_volume_1h',
      );

      expect(volumeClaim).toBeDefined();
      expect(volumeClaim?.unit).toBe('USD');
      expect(volumeClaim?.value).toBeGreaterThan(0);
    });

    it('should extract exchange inflow claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);
      const btcSource = sources.find((s) => s.metadata?.transactionCount === 2);

      const inflowClaim = btcSource?.claims.find(
        (c: Claim) =>
          c.type === 'custom' && c.metadata?.type === 'exchange_inflow_1h',
      );

      expect(inflowClaim).toBeDefined();
      expect(inflowClaim?.value).toBeGreaterThan(0);
    });

    it('should extract exchange outflow claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);
      const ethSource = sources.find((s) => s.metadata?.transactionCount === 1);

      const outflowClaim = ethSource?.claims.find(
        (c: Claim) =>
          c.type === 'custom' && c.metadata?.type === 'exchange_outflow_1h',
      );

      expect(outflowClaim).toBeDefined();
      expect(outflowClaim?.value).toBeGreaterThan(0);
    });

    it('should group transactions by symbol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhaleAlertResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);

      // Should have separate sources for BTC and ETH
      expect(sources.length).toBe(2);

      const btcSource = sources.find((s) => s.metadata?.transactionCount === 2);
      const ethSource = sources.find((s) => s.metadata?.transactionCount === 1);

      expect(btcSource).toBeDefined();
      expect(ethSource).toBeDefined();
    });

    it('should return empty source when no transactions found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: 'success',
            count: 0,
            transactions: [],
          }),
      });

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBe(0);
      expect(sources[0]?.metadata?.message).toContain(
        'No whale transactions in the last hour',
      );
    });

    it('should return error source on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('429');
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network error');
    });
  });

  describe('execute with mock data (no API key)', () => {
    beforeEach(() => {
      tool = new WhaleAlertTool(); // No API key
    });

    it('should return mock data when no API key', async () => {
      const sources = await tool.execute(['BTC', 'ETH']);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(sources.length).toBeGreaterThan(0);
    });

    it('should generate whale transaction claims from mock data', async () => {
      const sources = await tool.execute(['BTC']);

      const btcSource = sources.find((s) =>
        s.claims.some((c: Claim) => c.instrument === 'BTC'),
      );

      expect(btcSource).toBeDefined();

      const whaleTransactionClaims = btcSource?.claims.filter(
        (c: Claim) => c.type === 'whale_transaction',
      );
      expect(whaleTransactionClaims?.length).toBeGreaterThan(0);
    });

    it('should include exchange inflows in mock data', async () => {
      const sources = await tool.execute(['BTC']);

      const btcSource = sources.find((s) =>
        s.claims.some((c: Claim) => c.instrument === 'BTC'),
      );

      const inflowClaim = btcSource?.claims.find(
        (c: Claim) =>
          c.type === 'custom' && c.metadata?.type === 'exchange_inflow_1h',
      );

      expect(inflowClaim).toBeDefined();
    });

    it('should include exchange outflows in mock data', async () => {
      const sources = await tool.execute(['BTC']);

      const btcSource = sources.find((s) =>
        s.claims.some((c: Claim) => c.instrument === 'BTC'),
      );

      const outflowClaim = btcSource?.claims.find(
        (c: Claim) =>
          c.type === 'custom' && c.metadata?.type === 'exchange_outflow_1h',
      );

      expect(outflowClaim).toBeDefined();
    });

    it('should limit mock data to 3 instruments', async () => {
      const sources = await tool.execute(['BTC', 'ETH', 'BNB', 'ADA', 'SOL']);

      // Mock data generation limits to 3 instruments
      const uniqueInstruments = new Set(
        sources.flatMap((s) => s.claims.map((c: Claim) => c.instrument)),
      );

      expect(uniqueInstruments.size).toBeLessThanOrEqual(3);
    });

    it('should include realistic mock transaction amounts', async () => {
      const sources = await tool.execute(['BTC']);

      const btcSource = sources.find((s) =>
        s.claims.some((c: Claim) => c.instrument === 'BTC'),
      );

      const whaleTransactionClaim = btcSource?.claims.find(
        (c: Claim) => c.type === 'whale_transaction',
      );

      expect(whaleTransactionClaim?.value).toBeGreaterThanOrEqual(2_000_000);
      expect(whaleTransactionClaim?.value).toBeLessThanOrEqual(15_000_000);
    });
  });

  describe('source metadata', () => {
    it('should include transaction count in metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: 'success',
            count: 2,
            transactions: [
              {
                blockchain: 'bitcoin',
                symbol: 'BTC',
                id: 'tx-1',
                transaction_type: 'transfer',
                hash: '0xabc123',
                from: { address: '0x1234', owner: 'unknown' },
                to: {
                  address: '0x5678',
                  owner: 'Binance',
                  owner_type: 'exchange',
                },
                timestamp: Math.floor(Date.now() / 1000),
                amount: 100,
                amount_usd: 4_500_000,
              },
              {
                blockchain: 'bitcoin',
                symbol: 'BTC',
                id: 'tx-2',
                transaction_type: 'transfer',
                hash: '0xdef456',
                from: { address: '0x9876', owner: 'unknown' },
                to: {
                  address: '0x5432',
                  owner: 'Coinbase',
                  owner_type: 'exchange',
                },
                timestamp: Math.floor(Date.now() / 1000),
                amount: 50,
                amount_usd: 2_250_000,
              },
            ],
          }),
      });

      const sources = await tool.execute(['BTC']);

      expect(sources[0]?.metadata).toMatchObject({
        exchange: 'whale-alert',
        transactionCount: 2,
      });
      expect(sources[0]?.metadata?.blockchains).toContain('bitcoin');
    });
  });
});
