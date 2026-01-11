/**
 * Yahoo Finance Tool Tests
 *
 * Tests the YahooFinanceTool for fetching stock quotes.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import {
  YahooFinanceTool,
  YahooFinanceToolConfig,
} from '../yahoo-finance.tool';
import type { Source, Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('YahooFinanceTool', () => {
  let tool: YahooFinanceTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new YahooFinanceTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('yahoo-finance');
      expect(tool.description).toBe(
        'Fetches real-time stock quotes from Yahoo Finance',
      );
    });

    it('should accept custom config', () => {
      const config: YahooFinanceToolConfig = {
        timeoutMs: 5000,
        includeFundamentals: false,
      };
      const customTool = new YahooFinanceTool(config);
      expect(customTool.name).toBe('yahoo-finance');
    });
  });

  describe('execute', () => {
    const mockQuoteResponse = {
      quoteResponse: {
        result: [
          {
            symbol: 'AAPL',
            shortName: 'Apple Inc.',
            regularMarketPrice: 175.5,
            regularMarketChange: 2.5,
            regularMarketChangePercent: 1.45,
            regularMarketVolume: 50000000,
            regularMarketOpen: 173.0,
            regularMarketDayHigh: 176.0,
            regularMarketDayLow: 172.5,
            regularMarketPreviousClose: 173.0,
            bid: 175.45,
            ask: 175.55,
            bidSize: 100,
            askSize: 200,
            marketCap: 2800000000000,
            trailingPE: 28.5,
            forwardPE: 25.0,
            epsTrailingTwelveMonths: 6.15,
            currency: 'USD',
            exchange: 'NASDAQ',
            quoteType: 'EQUITY',
            regularMarketTime: Math.floor(Date.now() / 1000),
          },
        ],
      },
    };

    it('should fetch quotes successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('yahoo-finance');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract price claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const priceClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'price',
      );

      expect(priceClaim).toBeDefined();
      expect(priceClaim?.value).toBe(175.5);
      expect(priceClaim?.instrument).toBe('AAPL');
      expect(priceClaim?.unit).toBe('USD');
      expect(priceClaim?.confidence).toBe(1.0);
    });

    it('should extract change claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const claims = sources[0]?.claims || [];

      const changeClaim = claims.find((c: Claim) => c.type === 'change');
      expect(changeClaim?.value).toBe(2.5);

      const changePercentClaim = claims.find(
        (c: Claim) => c.type === 'change_percent',
      );
      expect(changePercentClaim?.value).toBe(1.45);
    });

    it('should extract volume claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const volumeClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'volume',
      );

      expect(volumeClaim?.value).toBe(50000000);
      expect(volumeClaim?.unit).toBe('shares');
    });

    it('should extract OHLC claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const claims = sources[0]?.claims || [];

      const openClaim = claims.find((c: Claim) => c.type === 'open');
      expect(openClaim?.value).toBe(173.0);

      const highClaim = claims.find((c: Claim) => c.type === 'high');
      expect(highClaim?.value).toBe(176.0);

      const lowClaim = claims.find((c: Claim) => c.type === 'low');
      expect(lowClaim?.value).toBe(172.5);

      const closeClaim = claims.find((c: Claim) => c.type === 'close');
      expect(closeClaim?.value).toBe(173.0);
    });

    it('should extract bid/ask claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const claims = sources[0]?.claims || [];

      const bidClaim = claims.find((c: Claim) => c.type === 'bid');
      expect(bidClaim?.value).toBe(175.45);
      expect(bidClaim?.metadata?.size).toBe(100);

      const askClaim = claims.find((c: Claim) => c.type === 'ask');
      expect(askClaim?.value).toBe(175.55);
      expect(askClaim?.metadata?.size).toBe(200);
    });

    it('should calculate spread correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      const sources = await tool.execute(['AAPL']);
      const spreadClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'spread',
      );

      expect(spreadClaim).toBeDefined();
      expect(spreadClaim?.unit).toBe('percent');
      // (175.55 - 175.45) / ((175.45 + 175.55) / 2) * 100 = ~0.057%
      expect(spreadClaim?.value).toBeCloseTo(0.057, 2);
    });

    it('should extract fundamental claims when enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      // Default includes fundamentals
      const sources = await tool.execute(['AAPL']);
      const claims = sources[0]?.claims || [];

      const marketCapClaim = claims.find((c: Claim) => c.type === 'market_cap');
      expect(marketCapClaim?.value).toBe(2800000000000);

      const peClaim = claims.find(
        (c: Claim) => c.type === 'pe_ratio' && c.metadata?.type === 'trailing',
      );
      expect(peClaim?.value).toBe(28.5);

      const epsClaim = claims.find((c: Claim) => c.type === 'eps');
      expect(epsClaim?.value).toBe(6.15);
    });

    it('should handle multiple instruments', async () => {
      const multiResponse = {
        quoteResponse: {
          result: [
            {
              symbol: 'AAPL',
              regularMarketPrice: 175.5,
              regularMarketVolume: 50000000,
              currency: 'USD',
            },
            {
              symbol: 'MSFT',
              regularMarketPrice: 380.25,
              regularMarketVolume: 30000000,
              currency: 'USD',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiResponse),
      });

      const sources = await tool.execute(['AAPL', 'MSFT']);

      expect(sources.length).toBe(2);

      const aaplSource = sources.find(
        (s: Source) => s.metadata?.symbol === 'AAPL',
      );
      const msftSource = sources.find(
        (s: Source) => s.metadata?.symbol === 'MSFT',
      );

      expect(aaplSource).toBeDefined();
      expect(msftSource).toBeDefined();
    });

    it('should return error source on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('500');
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
      expect(sources[0]?.metadata?.errorMessage).toContain('Network error');
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        quoteResponse: {
          error: {
            code: 'INVALID_SYMBOL',
            description: 'Invalid symbol: INVALID',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      const sources = await tool.execute(['INVALID']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });

    it('should handle empty results for missing symbols', async () => {
      const partialResponse = {
        quoteResponse: {
          result: [
            {
              symbol: 'AAPL',
              regularMarketPrice: 175.5,
              currency: 'USD',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(partialResponse),
      });

      const sources = await tool.execute(['AAPL', 'INVALID_SYMBOL']);

      // Should only return source for valid symbol
      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.symbol).toBe('AAPL');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.error).toBe(true);
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      const response = {
        quoteResponse: {
          result: [
            {
              symbol: 'AAPL',
              shortName: 'Apple Inc.',
              longName: 'Apple Inc.',
              regularMarketPrice: 175.5,
              currency: 'USD',
              exchange: 'NASDAQ',
              quoteType: 'EQUITY',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.metadata).toEqual({
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        currency: 'USD',
        quoteType: 'EQUITY',
        companyName: 'Apple Inc.',
      });
    });
  });
});
