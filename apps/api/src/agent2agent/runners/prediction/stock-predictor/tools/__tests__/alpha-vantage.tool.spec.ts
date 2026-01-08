/**
 * Alpha Vantage Tool Tests
 *
 * Tests the AlphaVantageTool for fetching stock quotes.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import {
  AlphaVantageTool,
  AlphaVantageToolConfig,
  createAlphaVantageTool,
} from '../alpha-vantage.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AlphaVantageTool', () => {
  let tool: AlphaVantageTool;
  const testApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new AlphaVantageTool({ apiKey: testApiKey });
  });

  describe('constructor', () => {
    it('should create tool with required API key', () => {
      expect(tool.name).toBe('alpha-vantage');
      expect(tool.description).toBe(
        'Fetches detailed stock quotes from Alpha Vantage API',
      );
    });

    it('should throw if API key is missing', () => {
      expect(() => {
        new AlphaVantageTool({ apiKey: '' });
      }).toThrow('Alpha Vantage API key is required');
    });

    it('should accept custom config', () => {
      const config: AlphaVantageToolConfig = {
        apiKey: testApiKey,
        timeoutMs: 5000,
        includeTechnicals: true,
        technicalPeriod: 20,
      };
      const customTool = new AlphaVantageTool(config);
      expect(customTool.name).toBe('alpha-vantage');
    });
  });

  describe('execute', () => {
    const mockQuoteResponse = {
      'Global Quote': {
        '01. symbol': 'AAPL',
        '02. open': '173.00',
        '03. high': '176.00',
        '04. low': '172.50',
        '05. price': '175.50',
        '06. volume': '50000000',
        '07. latest trading day': '2026-01-07',
        '08. previous close': '173.00',
        '09. change': '2.50',
        '10. change percent': '1.45%',
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
      expect(source.tool).toBe('alpha-vantage');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should include API key in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuoteResponse),
      });

      await tool.execute(['AAPL']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`apikey=${testApiKey}`),
        expect.any(Object),
      );
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
      expect(changePercentClaim?.unit).toBe('percent');
    });

    it('should handle multiple instruments sequentially', async () => {
      const msftResponse = {
        'Global Quote': {
          '01. symbol': 'MSFT',
          '05. price': '380.25',
          '06. volume': '30000000',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(msftResponse),
        });

      const sources = await tool.execute(['AAPL', 'MSFT']);

      // Should make separate requests for each symbol
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(2);

      const aaplSource = sources.find((s) => s.metadata?.symbol === 'AAPL');
      const msftSource = sources.find((s) => s.metadata?.symbol === 'MSFT');

      expect(aaplSource).toBeDefined();
      expect(msftSource).toBeDefined();
    });

    it('should handle rate limit warning', async () => {
      const rateLimitResponse = {
        Note: 'Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute.',
        'Global Quote': mockQuoteResponse['Global Quote'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(rateLimitResponse),
      });

      const sources = await tool.execute(['AAPL']);

      // Should still return data despite warning
      expect(sources.length).toBe(1);
      expect(sources[0]?.claims.length).toBeGreaterThan(0);
    });

    it('should handle API error response', async () => {
      const errorResponse = {
        'Error Message':
          'Invalid API call. Please retry or visit the documentation.',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(errorResponse),
      });

      const sources = await tool.execute(['INVALID']);

      // Should still return something (empty source for this symbol)
      expect(sources.length).toBe(0);
    });

    it('should return error source on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0); // No valid data returned
    });

    it('should return error source on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['AAPL']);

      // Error is logged but we get empty results for failed symbols
      expect(sources.length).toBe(0);
    });

    it('should handle empty Global Quote response', async () => {
      const emptyResponse = {
        'Global Quote': {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyResponse),
      });

      const sources = await tool.execute(['AAPL']);

      // No claims extracted from empty quote
      expect(sources.length).toBe(0);
    });

    it('should handle timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['AAPL']);

      expect(sources.length).toBe(0); // No data on timeout
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      const response = {
        'Global Quote': {
          '01. symbol': 'AAPL',
          '05. price': '175.50',
          '07. latest trading day': '2026-01-07',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(response),
      });

      const sources = await tool.execute(['AAPL']);

      expect(sources[0]?.metadata).toEqual({
        symbol: 'AAPL',
        latestTradingDay: '2026-01-07',
        source: 'alpha-vantage',
      });
    });
  });

  describe('createAlphaVantageTool factory', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return null if API key not configured', () => {
      delete process.env.ALPHA_VANTAGE_API_KEY;
      const tool = createAlphaVantageTool();
      expect(tool).toBeNull();
    });

    it('should create tool if API key is configured', () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
      const tool = createAlphaVantageTool();
      expect(tool).toBeInstanceOf(AlphaVantageTool);
    });
  });
});
