/**
 * Gamma API Tool Tests
 *
 * Tests the GammaApiTool for fetching market metadata.
 * Uses mocked fetch to avoid actual API calls in unit tests.
 */

import { GammaApiTool } from '../gamma-api.tool';
import type { Claim } from '../../../base/base-prediction.types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('GammaApiTool', () => {
  let tool: GammaApiTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new GammaApiTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('gamma-api');
      expect(tool.description).toBe(
        'Fetches market metadata and analytics from Gamma Markets API',
      );
    });

    it('should accept custom config', () => {
      const customTool = new GammaApiTool({
        timeoutMs: 5000,
        includeDescriptions: false,
      });
      expect(customTool.name).toBe('gamma-api');
    });
  });

  describe('execute', () => {
    const mockGammaResponse = {
      id: 'gamma-market-123',
      question: 'Will Bitcoin reach $100k by 2024?',
      description: 'Detailed market description here',
      active: true,
      closed: false,
      archived: false,
      market_slug: 'bitcoin-100k-2024',
      end_date_iso: '2024-12-31T23:59:59Z',
      outcomes: ['Yes', 'No'],
      outcome_prices: ['0.42', '0.58'],
      category: 'Crypto',
      tags: ['bitcoin', 'crypto', 'price'],
      volume: '1250000',
      liquidity: '350000',
      volume_24hr: '85000',
      notifications: [
        {
          type: 'price_alert',
          message: 'Odds shifted significantly',
        },
      ],
      umaBond: '10000',
      umaReward: '500',
    };

    it('should fetch market metadata successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('gamma-api');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract volume claims correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const volumeClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'volume',
      );

      expect(volumeClaims?.length).toBe(2); // Total and 24hr

      const totalVolume = volumeClaims?.find(
        (c: Claim) => c.metadata?.timeframe === 'total',
      );
      expect(totalVolume?.value).toBe(1250000);
      expect(totalVolume?.unit).toBe('USD');

      const volume24hr = volumeClaims?.find(
        (c: Claim) => c.metadata?.timeframe === '24hr',
      );
      expect(volume24hr?.value).toBe(85000);
    });

    it('should extract liquidity claim correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const liquidityClaim = sources[0]?.claims.find(
        (c: Claim) => c.metadata?.claimSubtype === 'liquidity',
      );

      expect(liquidityClaim).toBeDefined();
      expect(liquidityClaim?.type).toBe('custom');
      expect(liquidityClaim?.value).toBe(350000);
      expect(liquidityClaim?.unit).toBe('USD');
      expect(liquidityClaim?.metadata?.source).toBe('gamma');
    });

    it('should extract probability claims from outcome_prices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const probabilityClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'probability',
      );

      expect(probabilityClaims?.length).toBe(2);

      const yesClaim = probabilityClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'Yes',
      );
      expect(yesClaim?.value).toBe(0.42);
      expect(yesClaim?.unit).toBe('probability');

      const noClaim = probabilityClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'No',
      );
      expect(noClaim?.value).toBe(0.58);
    });

    it('should extract odds claims from outcome_prices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const oddsClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'odds',
      );

      expect(oddsClaims?.length).toBe(2);

      const yesOdds = oddsClaims?.find(
        (c: Claim) => c.metadata?.outcome === 'Yes',
      );
      // Odds = 0.42 / (1 - 0.42) = 0.42 / 0.58 = 0.724
      expect(yesOdds?.value).toBeCloseTo(0.724, 2);
      expect(yesOdds?.unit).toBe('decimal');
    });

    it('should extract event claims from notifications', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const eventClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaims?.length).toBe(1);
      expect(eventClaims?.[0]?.value).toBe('Odds shifted significantly');
      expect(eventClaims?.[0]?.metadata?.eventType).toBe('price_alert');
      expect(eventClaims?.[0]?.metadata?.source).toBe('gamma');
    });

    it('should extract UMA bond and reward claims', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const customClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'custom',
      );

      const bondClaim = customClaims?.find(
        (c: Claim) => c.metadata?.claimSubtype === 'uma_bond',
      );
      expect(bondClaim?.value).toBe(10000);
      expect(bondClaim?.unit).toBe('USD');

      const rewardClaim = customClaims?.find(
        (c: Claim) => c.metadata?.claimSubtype === 'uma_reward',
      );
      expect(rewardClaim?.value).toBe(500);
      expect(rewardClaim?.unit).toBe('USD');
    });

    it('should try events endpoint on 404', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([mockGammaResponse]),
        });

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(sources.length).toBe(1);
    });

    it('should handle array responses from events endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockGammaResponse]),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(sources.length).toBe(1);
      expect(sources[0]?.metadata?.marketId).toBe('gamma-market-123');
    });

    it('should handle empty array response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const sources = await tool.execute(['invalid-market']);

      expect(sources.length).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(sources.length).toBe(0);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(sources.length).toBe(0);
    });

    it('should handle timeout errors gracefully', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const sources = await tool.execute(['bitcoin-100k-2024']);

      expect(sources.length).toBe(0);
    });

    it('should handle multiple instruments', async () => {
      const market1 = { ...mockGammaResponse, id: 'market-1' };
      const market2 = { ...mockGammaResponse, id: 'market-2' };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(market1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(market2),
        });

      const sources = await tool.execute(['market-1', 'market-2']);

      expect(sources.length).toBe(2);
      expect(sources[0]?.metadata?.marketId).toBe('market-1');
      expect(sources[1]?.metadata?.marketId).toBe('market-2');
    });

    it('should skip claims for zero values', async () => {
      const responseWithZeros = {
        ...mockGammaResponse,
        volume: '0',
        liquidity: '0',
        volume_24hr: '0',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithZeros),
      });

      const sources = await tool.execute(['bitcoin-100k-2024']);
      const volumeClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'volume',
      );
      const liquidityClaims = sources[0]?.claims.filter(
        (c: Claim) => c.metadata?.claimSubtype === 'liquidity',
      );

      expect(volumeClaims?.length).toBe(0);
      expect(liquidityClaims?.length).toBe(0);
    });

    it('should exclude descriptions when configured', async () => {
      const toolWithoutDesc = new GammaApiTool({
        includeDescriptions: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGammaResponse),
      });

      const sources = await toolWithoutDesc.execute(['bitcoin-100k-2024']);

      expect(sources[0]?.metadata?.description).toBeUndefined();
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata with descriptions', async () => {
      const mockResponse = {
        id: 'test-123',
        question: 'Test question?',
        description: 'Test description',
        market_slug: 'test-market',
        active: true,
        closed: false,
        end_date_iso: '2024-12-31T23:59:59Z',
        category: 'Politics',
        tags: ['test', 'demo'],
        outcome_prices: ['0.5'],
        outcomes: ['Yes'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const sources = await tool.execute(['test-123']);

      expect(sources[0]?.metadata).toEqual({
        marketId: 'test-123',
        question: 'Test question?',
        marketSlug: 'test-market',
        description: 'Test description',
        category: 'Politics',
        tags: ['test', 'demo'],
        active: true,
        closed: false,
        endDate: '2024-12-31T23:59:59Z',
      });
    });
  });
});
