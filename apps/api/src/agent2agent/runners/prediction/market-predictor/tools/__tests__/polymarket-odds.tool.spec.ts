/**
 * Polymarket Odds Tool Tests
 *
 * Tests the PolymarketOddsTool for fetching market odds from CLOB API.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { PolymarketOddsTool } from '../polymarket-odds.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('PolymarketOddsTool', () => {
  let tool: PolymarketOddsTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new PolymarketOddsTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('polymarket-odds');
      expect(tool.description).toBe(
        'Fetches real-time market odds and liquidity from Polymarket CLOB API',
      );
    });

    it('should accept custom config', () => {
      const customTool = new PolymarketOddsTool({
        timeoutMs: 5000,
        includeOrderBook: false,
        includeRecentTrades: true,
      });
      expect(customTool.name).toBe('polymarket-odds');
    });
  });

  describe('execute', () => {
    const mockMarketResponse = {
      condition_id: 'test-condition-123',
      question: 'Will Trump win 2024?',
      market_slug: 'trump-2024',
      end_date_iso: '2024-11-05T23:59:59Z',
      active: true,
      closed: false,
      tokens: [
        {
          token_id: 'token-yes',
          outcome: 'Yes',
          price: '0.65',
          winner: false,
        },
        {
          token_id: 'token-no',
          outcome: 'No',
          price: '0.35',
          winner: false,
        },
      ],
      clob_token_ids: ['token-yes', 'token-no'],
    };

    const mockOrderBookResponse = {
      market: 'test-condition-123',
      asset_id: 'token-yes',
      bids: [
        { price: '0.64', size: '1000' },
        { price: '0.63', size: '500' },
      ],
      asks: [
        { price: '0.66', size: '800' },
        { price: '0.67', size: '1200' },
      ],
      timestamp: Date.now() / 1000,
    };

    it('should fetch market data successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketResponse),
        })
        // Mock order book requests (2 tokens)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        });

      const sources = await tool.execute(['test-condition-123']);

      // Should call market + 2 order books
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('polymarket-odds');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract probability claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['test-condition-123']);
      const probabilityClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'probability',
      );

      expect(probabilityClaims?.length).toBe(2);

      const yesClaim = probabilityClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'Yes',
      );
      expect(yesClaim?.value).toBe(0.65);
      expect(yesClaim?.unit).toBe('probability');
      expect(yesClaim?.confidence).toBe(1.0);

      const noClaim = probabilityClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'No',
      );
      expect(noClaim?.value).toBe(0.35);
    });

    it('should extract odds claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      const sources = await tool.execute(['test-condition-123']);
      const oddsClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'odds',
      );

      expect(oddsClaims?.length).toBe(2);

      const yesOdds = oddsClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'Yes',
      );
      // Odds = price / (1 - price) = 0.65 / 0.35 = 1.857
      expect(yesOdds?.value).toBeCloseTo(1.857, 2);
      expect(yesOdds?.unit).toBe('decimal');
    });

    it('should fetch and parse order book when enabled', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        });

      const sources = await tool.execute(['test-condition-123']);

      // Should have market + 2 order books (yes/no)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const liquidityClaims = sources[0]?.claims.filter(
        (c: Claim) => c.metadata?.claimSubtype === 'liquidity',
      );
      expect(liquidityClaims?.length).toBeGreaterThan(0);
    });

    it('should calculate liquidity from order book', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        });

      const sources = await tool.execute(['test-condition-123']);
      const liquidityClaim = sources[0]?.claims.find(
        (c: Claim) => c.metadata?.claimSubtype === 'liquidity',
      );

      expect(liquidityClaim).toBeDefined();
      expect(liquidityClaim?.type).toBe('custom');
      expect(liquidityClaim?.unit).toBe('USD');

      // Bid liquidity: 1000*0.64 + 500*0.63 = 640 + 315 = 955
      // Ask liquidity: 800*0.66 + 1200*0.67 = 528 + 804 = 1332
      // Total: 955 + 1332 = 2287
      expect(liquidityClaim?.value).toBeCloseTo(2287, 0);
    });

    it('should calculate spread from order book', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrderBookResponse),
        });

      const sources = await tool.execute(['test-condition-123']);
      const spreadClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'spread',
      );

      expect(spreadClaim).toBeDefined();
      expect(spreadClaim?.unit).toBe('percent');

      // Spread = (0.66 - 0.64) / ((0.64 + 0.66) / 2) * 100
      // = 0.02 / 0.65 * 100 = 3.08%
      expect(spreadClaim?.value).toBeCloseTo(3.08, 1);
    });

    it('should skip order book when disabled', async () => {
      const toolWithoutOrderBook = new PolymarketOddsTool({
        includeOrderBook: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMarketResponse),
      });

      await toolWithoutOrderBook.execute(['test-condition-123']);

      // Should only fetch market data, not order books
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch recent trades when enabled', async () => {
      const toolWithTrades = new PolymarketOddsTool({
        includeRecentTrades: true,
        includeOrderBook: false, // Disable order book for simpler test
      });

      const mockTradesResponse = [
        {
          market: 'test-condition-123',
          asset_id: 'token-yes',
          outcome: 'Yes',
          price: '0.66',
          size: '100',
          timestamp: Date.now() / 1000,
          side: 'BUY' as const,
        },
        {
          market: 'test-condition-123',
          asset_id: 'token-yes',
          outcome: 'Yes',
          price: '0.65',
          size: '200',
          timestamp: Date.now() / 1000 - 60,
          side: 'SELL' as const,
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockMarketResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTradesResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTradesResponse),
        });

      const sources = await toolWithTrades.execute(['test-condition-123']);

      const volumeClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'volume',
      );
      expect(volumeClaims).toBeDefined();
      expect(volumeClaims!.length).toBeGreaterThan(0);

      // Volume = 100*0.66 + 200*0.65 = 66 + 130 = 196
      // Should have 2 volume claims (one per token)
      const volumeSum = volumeClaims!.reduce(
        (sum, claim) => sum + (claim.value as number),
        0,
      );
      expect(volumeSum).toBeCloseTo(392, 0); // 196 * 2 tokens
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['test-condition-123']);

      // Should return empty array on error
      expect(sources.length).toBe(0);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['test-condition-123']);

      expect(sources.length).toBe(0);
    });

    it('should handle timeout errors gracefully', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['test-condition-123']);

      expect(sources.length).toBe(0);
    });

    it('should handle missing market gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const sources = await tool.execute(['invalid-market']);

      expect(sources.length).toBe(0);
    });

    it('should handle multiple instruments', async () => {
      const toolWithoutOrderBook = new PolymarketOddsTool({
        includeOrderBook: false,
      });

      const market1 = { ...mockMarketResponse, condition_id: 'market-1' };
      const market2 = { ...mockMarketResponse, condition_id: 'market-2' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(market1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(market2),
        });

      const sources = await toolWithoutOrderBook.execute([
        'market-1',
        'market-2',
      ]);

      expect(sources.length).toBe(2);
      expect(sources[0]?.metadata?.conditionId).toBe('market-1');
      expect(sources[1]?.metadata?.conditionId).toBe('market-2');
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata', async () => {
      const mockResponse = {
        condition_id: 'test-123',
        question: 'Test question?',
        market_slug: 'test-market',
        active: true,
        closed: false,
        end_date_iso: '2024-12-31T23:59:59Z',
        tokens: [
          {
            token_id: 'token-1',
            outcome: 'Yes',
            price: '0.5',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const sources = await tool.execute(['test-123']);

      expect(sources[0]?.metadata).toEqual({
        conditionId: 'test-123',
        question: 'Test question?',
        marketSlug: 'test-market',
        active: true,
        closed: false,
        endDate: '2024-12-31T23:59:59Z',
      });
    });
  });
});
