/**
 * Binance Tool Tests
 *
 * Tests the BinanceTool for fetching cryptocurrency market data.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { BinanceTool, BinanceToolConfig } from '../binance.tool';
import type { Source, Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('BinanceTool', () => {
  let tool: BinanceTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new BinanceTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('binance');
      expect(tool.description).toBe(
        'Fetches real-time cryptocurrency prices from Binance',
      );
    });

    it('should accept custom config', () => {
      const config: BinanceToolConfig = {
        timeoutMs: 5000,
        includeOrderBook: false,
      };
      const customTool = new BinanceTool(config);
      expect(customTool.name).toBe('binance');
    });
  });

  describe('execute', () => {
    const mockTickerResponse = {
      symbol: 'BTCUSDT',
      priceChange: '1500.00',
      priceChangePercent: '3.45',
      weightedAvgPrice: '44500.00',
      prevClosePrice: '43500.00',
      lastPrice: '45000.00',
      lastQty: '0.1',
      bidPrice: '44995.00',
      bidQty: '2.5',
      askPrice: '45005.00',
      askQty: '1.8',
      openPrice: '43500.00',
      highPrice: '45500.00',
      lowPrice: '43000.00',
      volume: '25000.50',
      quoteVolume: '1100000000.00',
      openTime: Date.now() - 86400000,
      closeTime: Date.now(),
      firstId: 1000000,
      lastId: 2000000,
      count: 1000000,
    };

    it('should fetch ticker successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('binance');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract price claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const priceClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'price' && !c.metadata?.type,
      );

      expect(priceClaim).toBeDefined();
      expect(priceClaim?.value).toBe(45000);
      expect(priceClaim?.instrument).toBe('BTCUSDT');
      expect(priceClaim?.unit).toBe('USDT');
      expect(priceClaim?.confidence).toBe(1.0);
    });

    it('should extract change claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const changeClaim = claims.find((c: Claim) => c.type === 'change');
      expect(changeClaim?.value).toBe(1500);

      const changePercentClaim = claims.find(
        (c: Claim) => c.type === 'change_percent',
      );
      expect(changePercentClaim?.value).toBe(3.45);
    });

    it('should extract volume claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const volumeClaim = claims.find(
        (c: Claim) => c.type === 'volume' && c.unit === 'base_asset',
      );
      expect(volumeClaim?.value).toBe(25000.5);

      const quoteVolumeClaim = claims.find(
        (c: Claim) =>
          c.type === 'volume' && c.metadata?.type === 'quote_volume',
      );
      expect(quoteVolumeClaim?.value).toBe(1100000000);
      expect(quoteVolumeClaim?.unit).toBe('USDT');
    });

    it('should extract OHLC claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const openClaim = claims.find((c: Claim) => c.type === 'open');
      expect(openClaim?.value).toBe(43500);

      const highClaim = claims.find((c: Claim) => c.type === 'high');
      expect(highClaim?.value).toBe(45500);

      const lowClaim = claims.find((c: Claim) => c.type === 'low');
      expect(lowClaim?.value).toBe(43000);

      const closeClaim = claims.find((c: Claim) => c.type === 'close');
      expect(closeClaim?.value).toBe(43500);
    });

    it('should extract bid/ask claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const bidClaim = claims.find((c: Claim) => c.type === 'bid');
      expect(bidClaim?.value).toBe(44995);
      expect(bidClaim?.metadata?.size).toBe('2.5');

      const askClaim = claims.find((c: Claim) => c.type === 'ask');
      expect(askClaim?.value).toBe(45005);
      expect(askClaim?.metadata?.size).toBe('1.8');
    });

    it('should calculate spread correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const spreadClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'spread',
      );

      expect(spreadClaim).toBeDefined();
      expect(spreadClaim?.unit).toBe('percent');
      // (45005 - 44995) / ((44995 + 45005) / 2) * 100 = ~0.022%
      expect(spreadClaim?.value).toBeCloseTo(0.022, 2);
    });

    it('should extract weighted average price', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const weightedPriceClaim = claims.find(
        (c: Claim) =>
          c.type === 'price' && c.metadata?.type === 'weighted_average',
      );
      expect(weightedPriceClaim?.value).toBe(44500);
    });

    it('should handle multiple instruments', async () => {
      const multiResponse = [
        {
          ...mockTickerResponse,
          symbol: 'BTCUSDT',
          lastPrice: '45000.00',
        },
        {
          ...mockTickerResponse,
          symbol: 'ETHUSDT',
          lastPrice: '3000.00',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);

      expect(sources.length).toBe(2);

      const btcSource = sources.find(
        (s: Source) => s.metadata?.symbol === 'BTCUSDT',
      );
      const ethSource = sources.find(
        (s: Source) => s.metadata?.symbol === 'ETHUSDT',
      );

      expect(btcSource).toBeDefined();
      expect(ethSource).toBeDefined();
    });

    it('should normalize symbol to Binance format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTickerResponse),
      });

      await tool.execute(['DOGE']); // Use DOGE instead of BTC since BTC is a quote currency

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('DOGEUSDT'),
        expect.anything(),
      );
    });

    it('should return error source on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('500');
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network error');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['BTC']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      const response = {
        symbol: 'BTCUSDT',
        priceChange: '1500.00',
        priceChangePercent: '3.45',
        weightedAvgPrice: '44500.00',
        prevClosePrice: '43500.00',
        lastPrice: '45000.00',
        lastQty: '0.1',
        bidPrice: '44995.00',
        bidQty: '2.5',
        askPrice: '45005.00',
        askQty: '1.8',
        openPrice: '43500.00',
        highPrice: '45500.00',
        lowPrice: '43000.00',
        volume: '25000.50',
        quoteVolume: '1100000000.00',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1000000,
        lastId: 2000000,
        count: 1000000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const sources = await tool.execute(['BTC']);

      expect(sources[0]?.metadata).toMatchObject({
        symbol: 'BTCUSDT',
        exchange: 'binance',
        tradeCount: 1000000,
      });
      expect(sources[0]?.metadata?.openTime).toBeDefined();
      expect(sources[0]?.metadata?.closeTime).toBeDefined();
    });
  });

  describe('symbol normalization', () => {
    it('should convert DOGE to DOGEUSDT', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            symbol: 'DOGEUSDT',
            lastPrice: '0.08',
            volume: '1000000000',
            quoteVolume: '80000000',
            openTime: Date.now(),
            closeTime: Date.now(),
            count: 100,
          }),
      });

      await tool.execute(['DOGE']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('DOGEUSDT'),
        expect.anything(),
      );
    });

    it('should handle already formatted symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            symbol: 'BTCUSDT',
            lastPrice: '45000.00',
            volume: '1000',
            quoteVolume: '45000000',
            openTime: Date.now(),
            closeTime: Date.now(),
            count: 100,
          }),
      });

      await tool.execute(['BTCUSDT']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('BTCUSDT'),
        expect.anything(),
      );
    });
  });
});
