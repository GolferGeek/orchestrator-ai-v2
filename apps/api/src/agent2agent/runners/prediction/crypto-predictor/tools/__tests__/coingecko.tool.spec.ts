/**
 * CoinGecko Tool Tests
 *
 * Tests the CoinGeckoTool for fetching cryptocurrency market data.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { CoinGeckoTool, CoinGeckoToolConfig } from '../coingecko.tool';
import type { Source, Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('CoinGeckoTool', () => {
  let tool: CoinGeckoTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new CoinGeckoTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('coingecko');
      expect(tool.description).toBe(
        'Fetches cryptocurrency market data from CoinGecko',
      );
    });

    it('should accept custom config', () => {
      const config: CoinGeckoToolConfig = {
        timeoutMs: 20000,
        includeExtendedPriceChanges: false,
      };
      const customTool = new CoinGeckoTool(config);
      expect(customTool.name).toBe('coingecko');
    });
  });

  describe('execute', () => {
    const mockMarketResponse = [
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://example.com/btc.png',
        current_price: 45000,
        market_cap: 880000000000,
        market_cap_rank: 1,
        fully_diluted_valuation: 945000000000,
        total_volume: 35000000000,
        high_24h: 45500,
        low_24h: 43000,
        price_change_24h: 1500,
        price_change_percentage_24h: 3.45,
        market_cap_change_24h: 29400000000,
        market_cap_change_percentage_24h: 3.45,
        circulating_supply: 19500000,
        total_supply: 21000000,
        max_supply: 21000000,
        ath: 69000,
        ath_change_percentage: -34.78,
        ath_date: '2021-11-10T14:24:11.849Z',
        atl: 67.81,
        atl_change_percentage: 66245.67,
        atl_date: '2013-07-06T00:00:00.000Z',
        last_updated: '2024-01-08T12:00:00.000Z',
        price_change_percentage_1h_in_currency: 0.5,
        price_change_percentage_7d_in_currency: 5.2,
        price_change_percentage_30d_in_currency: 12.8,
      },
    ];

    it('should fetch market data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('coingecko');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract price claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const priceClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'price' && !c.metadata?.type,
      );

      expect(priceClaim).toBeDefined();
      expect(priceClaim?.value).toBe(45000);
      expect(priceClaim?.instrument).toBe('BTC');
      expect(priceClaim?.unit).toBe('USD');
      expect(priceClaim?.confidence).toBe(1.0);
      expect(priceClaim?.metadata?.coinId).toBe('bitcoin');
    });

    it('should extract market cap claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const marketCapClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'market_cap' && !c.metadata?.type,
      );

      expect(marketCapClaim).toBeDefined();
      expect(marketCapClaim?.value).toBe(880000000000);
      expect(marketCapClaim?.unit).toBe('USD');
      expect(marketCapClaim?.metadata?.rank).toBe(1);
    });

    it('should extract fully diluted valuation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const fdvClaim = sources[0]?.claims.find(
        (c: Claim) =>
          c.type === 'market_cap' &&
          c.metadata?.type === 'fully_diluted_valuation',
      );

      expect(fdvClaim).toBeDefined();
      expect(fdvClaim?.value).toBe(945000000000);
      expect(fdvClaim?.confidence).toBe(0.95);
    });

    it('should extract volume claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const volumeClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'volume',
      );

      expect(volumeClaim).toBeDefined();
      expect(volumeClaim?.value).toBe(35000000000);
      expect(volumeClaim?.unit).toBe('USD');
      expect(volumeClaim?.metadata?.type).toBe('total_volume_24h');
    });

    it('should extract 24h high/low claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const highClaim = claims.find((c: Claim) => c.type === 'high');
      expect(highClaim?.value).toBe(45500);
      expect(highClaim?.metadata?.period).toBe('24h');

      const lowClaim = claims.find((c: Claim) => c.type === 'low');
      expect(lowClaim?.value).toBe(43000);
      expect(lowClaim?.metadata?.period).toBe('24h');
    });

    it('should extract price change claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const changeClaim = claims.find((c: Claim) => c.type === 'change');
      expect(changeClaim?.value).toBe(1500);
      expect(changeClaim?.metadata?.period).toBe('24h');

      const changePercentClaim = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '24h',
      );
      expect(changePercentClaim?.value).toBe(3.45);
    });

    it('should extract extended price changes when enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const change1h = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '1h',
      );
      expect(change1h?.value).toBe(0.5);

      const change7d = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '7d',
      );
      expect(change7d?.value).toBe(5.2);

      const change30d = claims.find(
        (c: Claim) =>
          c.type === 'change_percent' && c.metadata?.period === '30d',
      );
      expect(change30d?.value).toBe(12.8);
    });

    it('should extract supply claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const circulatingClaim = claims.find(
        (c: Claim) => c.metadata?.type === 'circulating_supply',
      );
      expect(circulatingClaim?.value).toBe(19500000);
      expect(circulatingClaim?.unit).toBe('btc');

      const totalClaim = claims.find(
        (c: Claim) => c.metadata?.type === 'total_supply',
      );
      expect(totalClaim?.value).toBe(21000000);

      const maxClaim = claims.find(
        (c: Claim) => c.metadata?.type === 'max_supply',
      );
      expect(maxClaim?.value).toBe(21000000);
    });

    it('should extract all-time high/low claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['BTC']);
      const claims = sources[0]?.claims || [];

      const athClaim = claims.find(
        (c: Claim) => c.metadata?.type === 'all_time_high',
      );
      expect(athClaim?.value).toBe(69000);
      expect(athClaim?.metadata?.athDate).toBe('2021-11-10T14:24:11.849Z');
      expect(athClaim?.metadata?.athChangePercent).toBe(-34.78);

      const atlClaim = claims.find(
        (c: Claim) => c.metadata?.type === 'all_time_low',
      );
      expect(atlClaim?.value).toBe(67.81);
      expect(atlClaim?.metadata?.atlDate).toBe('2013-07-06T00:00:00.000Z');
    });

    it('should handle multiple instruments', async () => {
      const multiResponse = [
        {
          ...mockMarketResponse[0],
          id: 'bitcoin',
          symbol: 'btc',
          current_price: 45000,
        },
        {
          ...mockMarketResponse[0],
          id: 'ethereum',
          symbol: 'eth',
          current_price: 3000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiResponse),
      });

      const sources = await tool.execute(['BTC', 'ETH']);

      expect(sources.length).toBe(2);

      const btcSource = sources.find(
        (s: Source) => s.metadata?.coinId === 'bitcoin',
      );
      const ethSource = sources.find(
        (s: Source) => s.metadata?.coinId === 'ethereum',
      );

      expect(btcSource).toBeDefined();
      expect(ethSource).toBeDefined();
    });

    it('should normalize symbol to CoinGecko ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      await tool.execute(['BTC']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('bitcoin'),
        expect.anything(),
      );
    });

    it('should convert ETH to ethereum', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              ...mockMarketResponse[0],
              id: 'ethereum',
              symbol: 'eth',
            },
          ]),
      });

      await tool.execute(['ETH']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ethereum'),
        expect.anything(),
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
      const response = [
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: 45000,
          market_cap: 880000000000,
          market_cap_rank: 1,
          total_volume: 35000000000,
          high_24h: 45500,
          low_24h: 43000,
          price_change_24h: 1500,
          price_change_percentage_24h: 3.45,
          market_cap_change_24h: 29400000000,
          market_cap_change_percentage_24h: 3.45,
          circulating_supply: 19500000,
          ath: 69000,
          ath_change_percentage: -34.78,
          ath_date: '2021-11-10T14:24:11.849Z',
          atl: 67.81,
          atl_change_percentage: 66245.67,
          atl_date: '2013-07-06T00:00:00.000Z',
          last_updated: '2024-01-08T12:00:00.000Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const sources = await tool.execute(['BTC']);

      expect(sources[0]?.metadata).toMatchObject({
        coinId: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        exchange: 'coingecko',
        marketCapRank: 1,
        lastUpdated: '2024-01-08T12:00:00.000Z',
      });
    });
  });

  describe('symbol mapping', () => {
    it('should map common symbols to CoinGecko IDs', async () => {
      const symbolTests = [
        { input: 'BTC', expected: 'bitcoin' },
        { input: 'ETH', expected: 'ethereum' },
        { input: 'BNB', expected: 'binancecoin' },
        { input: 'ADA', expected: 'cardano' },
        { input: 'SOL', expected: 'solana' },
      ];

      for (const { input, expected } of symbolTests) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: expected,
                symbol: input.toLowerCase(),
                name: input,
                current_price: 1000,
                market_cap: 1000000,
                market_cap_rank: 1,
                total_volume: 100000,
                high_24h: 1100,
                low_24h: 900,
                price_change_24h: 50,
                price_change_percentage_24h: 5,
                market_cap_change_24h: 50000,
                market_cap_change_percentage_24h: 5,
                circulating_supply: 1000,
                ath: 2000,
                ath_change_percentage: -50,
                ath_date: '2021-01-01T00:00:00.000Z',
                atl: 10,
                atl_change_percentage: 9900,
                atl_date: '2020-01-01T00:00:00.000Z',
                last_updated: '2024-01-08T12:00:00.000Z',
              },
            ]),
        });

        await tool.execute([input]);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(expected),
          expect.anything(),
        );

        mockFetch.mockClear();
      }
    });

    it('should handle unknown symbols by lowercasing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await tool.execute(['UNKNOWN']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        expect.anything(),
      );
    });
  });
});
