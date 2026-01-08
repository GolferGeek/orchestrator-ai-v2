/**
 * Resolution Tracker Tool Tests
 *
 * Tests the ResolutionTrackerTool for tracking market resolutions.
 * Uses mocked custom sources to simulate resolution tracking.
 */

import { ResolutionTrackerTool } from '../resolution-tracker.tool';
import type { Claim } from '../../../base/base-prediction.types';

describe('ResolutionTrackerTool', () => {
  let tool: ResolutionTrackerTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new ResolutionTrackerTool();
  });

  describe('constructor', () => {
    it('should create tool with default config', () => {
      expect(tool.name).toBe('resolution-tracker');
      expect(tool.description).toBe(
        'Tracks market resolution from official sources',
      );
    });

    it('should accept custom config', () => {
      const customTool = new ResolutionTrackerTool({
        timeoutMs: 5000,
        checkUmaResolution: false,
      });
      expect(customTool.name).toBe('resolution-tracker');
    });
  });

  describe('execute', () => {
    it('should return empty sources when no resolutions found', async () => {
      const sources = await tool.execute(['test-market-123']);

      expect(sources.length).toBe(0);
    });

    it('should track resolution from custom source', async () => {
      const customSource = jest.fn().mockResolvedValue({
        instrument: 'election-market-123',
        resolved: true,
        outcome: 'Yes',
        sourceType: 'official_api',
        sourceName: 'AP Election Results',
        sourceUrl: 'https://example.com/results',
        confidence: 1.0,
        timestamp: '2024-11-05T23:00:00Z',
      });

      tool.registerCustomSource('election-market-123', customSource);
      const sources = await tool.execute(['election-market-123']);

      expect(customSource).toHaveBeenCalled();
      expect(sources.length).toBe(1);

      const source = sources[0]!;
      expect(source.tool).toBe('resolution-tracker');
      expect(source.claims.length).toBeGreaterThan(0);
    });

    it('should extract resolution claim correctly', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'official_api',
          sourceName: 'Official Source',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const resolutionClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'resolution',
      );

      expect(resolutionClaim).toBeDefined();
      expect(resolutionClaim?.value).toBe(true);
      expect(resolutionClaim?.confidence).toBe(1.0);
      expect(resolutionClaim?.metadata?.outcome).toBe('Yes');
      expect(resolutionClaim?.metadata?.sourceType).toBe('official_api');
      expect(resolutionClaim?.metadata?.sourceName).toBe('Official Source');
    });

    it('should extract event claim when market resolves', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'official_api',
          sourceName: 'Official Source',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const eventClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'event',
      );

      expect(eventClaim).toBeDefined();
      expect(eventClaim?.value).toContain('Market resolved');
      expect(eventClaim?.value).toContain('Yes');
      expect(eventClaim?.metadata?.eventType).toBe('resolution');
    });

    it('should create probability claim for binary yes outcome', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'official_api',
          sourceName: 'Official Source',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const probabilityClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'probability',
      );

      expect(probabilityClaim).toBeDefined();
      expect(probabilityClaim?.value).toBe(1.0);
      expect(probabilityClaim?.unit).toBe('probability');
      expect(probabilityClaim?.confidence).toBe(0.95);
      expect(probabilityClaim?.metadata?.sourceType).toBe('resolution');
    });

    it('should create probability claim for binary no outcome', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'No',
          sourceType: 'official_website',
          sourceName: 'Official Website',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const probabilityClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'probability',
      );

      expect(probabilityClaim).toBeDefined();
      expect(probabilityClaim?.value).toBe(0.0);
      expect(probabilityClaim?.confidence).toBe(0.9);
    });

    it('should handle case-insensitive yes/no outcomes', async () => {
      tool.registerCustomSource('test-market-1', () =>
        Promise.resolve({
          instrument: 'test-market-1',
          resolved: true,
          outcome: 'YES',
          sourceType: 'official_api',
          sourceName: 'Test',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      tool.registerCustomSource('test-market-2', () =>
        Promise.resolve({
          instrument: 'test-market-2',
          resolved: true,
          outcome: 'no',
          sourceType: 'official_api',
          sourceName: 'Test',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources1 = await tool.execute(['test-market-1']);
      const sources2 = await tool.execute(['test-market-2']);

      const prob1 = sources1[0]?.claims.find(
        (c: Claim) => c.type === 'probability',
      );
      const prob2 = sources2[0]?.claims.find(
        (c: Claim) => c.type === 'probability',
      );

      expect(prob1?.value).toBe(1.0);
      expect(prob2?.value).toBe(0.0);
    });

    it('should not create probability claim for non-binary outcomes', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Option A',
          sourceType: 'official_api',
          sourceName: 'Official Source',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const probabilityClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'probability',
      );

      // Should still have resolution and event claims, but no probability
      expect(sources[0]?.claims.length).toBeGreaterThan(0);
      expect(probabilityClaim).toBeUndefined();
    });

    it('should handle unresolved market from custom source', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: false,
          sourceType: 'official_api',
          sourceName: 'Official Source',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['test-market']);
      const resolutionClaim = sources[0]?.claims.find(
        (c: Claim) => c.type === 'resolution',
      );

      expect(resolutionClaim?.value).toBe(false);

      // Should not have event or probability claims for unresolved market
      const eventClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'event',
      );
      const probabilityClaims = sources[0]?.claims.filter(
        (c: Claim) => c.type === 'probability',
      );

      expect(eventClaims?.length).toBe(0);
      expect(probabilityClaims?.length).toBe(0);
    });

    it('should handle custom source returning null', async () => {
      tool.registerCustomSource('test-market', () => Promise.resolve(null));

      const sources = await tool.execute(['test-market']);

      expect(sources.length).toBe(0);
    });

    it('should handle custom source throwing error', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.reject(new Error('Custom source error')),
      );

      const sources = await tool.execute(['test-market']);

      expect(sources.length).toBe(0);
    });

    it('should handle multiple instruments', async () => {
      tool.registerCustomSource('market-1', () =>
        Promise.resolve({
          instrument: 'market-1',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'official_api',
          sourceName: 'Source 1',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      tool.registerCustomSource('market-2', () =>
        Promise.resolve({
          instrument: 'market-2',
          resolved: true,
          outcome: 'No',
          sourceType: 'official_api',
          sourceName: 'Source 2',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
        }),
      );

      const sources = await tool.execute(['market-1', 'market-2']);

      expect(sources.length).toBe(2);
    });

    it('should support different source types', async () => {
      const sourceTypes = [
        'official_api',
        'official_website',
        'news_consensus',
        'polymarket_uma',
      ] as const;

      for (const sourceType of sourceTypes) {
        tool.unregisterCustomSource('test-market');
        tool.registerCustomSource('test-market', () =>
          Promise.resolve({
            instrument: 'test-market',
            resolved: true,
            outcome: 'Yes',
            sourceType,
            sourceName: `Source: ${sourceType}`,
            confidence: 0.9,
            timestamp: new Date().toISOString(),
          }),
        );

        const sources = await tool.execute(['test-market']);
        const resolutionClaim = sources[0]?.claims.find(
          (c: Claim) => c.type === 'resolution',
        );

        expect(resolutionClaim?.metadata?.sourceType).toBe(sourceType);
      }
    });

    it('should include additional metadata from resolution data', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'official_api',
          sourceName: 'Official Source',
          sourceUrl: 'https://example.com/resolution',
          confidence: 1.0,
          timestamp: '2024-11-05T23:00:00Z',
          metadata: {
            voteTally: { yes: 100, no: 50 },
            certificationDate: '2024-11-06',
          },
        }),
      );

      const sources = await tool.execute(['test-market']);

      expect(sources[0]?.articleUrl).toBe('https://example.com/resolution');
      expect(sources[0]?.publishedAt).toBe('2024-11-05T23:00:00Z');
      expect(sources[0]?.metadata?.voteTally).toEqual({ yes: 100, no: 50 });
      expect(sources[0]?.metadata?.certificationDate).toBe('2024-11-06');
    });
  });

  describe('custom source management', () => {
    it('should register custom source', () => {
      const sourceFn = jest.fn().mockResolvedValue(null);
      tool.registerCustomSource('test-market', sourceFn);

      // Should be able to execute without error
      expect(() => tool.execute(['test-market'])).not.toThrow();
    });

    it('should unregister custom source', async () => {
      const sourceFn = jest.fn().mockResolvedValue({
        instrument: 'test-market',
        resolved: true,
        outcome: 'Yes',
        sourceType: 'official_api',
        sourceName: 'Test',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      });

      tool.registerCustomSource('test-market', sourceFn);
      tool.unregisterCustomSource('test-market');

      const sources = await tool.execute(['test-market']);

      expect(sourceFn).not.toHaveBeenCalled();
      expect(sources.length).toBe(0);
    });

    it('should allow re-registration of custom source', async () => {
      const source1 = jest.fn().mockResolvedValue(null);
      const source2 = jest.fn().mockResolvedValue({
        instrument: 'test-market',
        resolved: true,
        outcome: 'Yes',
        sourceType: 'official_api',
        sourceName: 'Test',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      });

      tool.registerCustomSource('test-market', source1);
      tool.registerCustomSource('test-market', source2);

      const sources = await tool.execute(['test-market']);

      expect(source1).not.toHaveBeenCalled();
      expect(source2).toHaveBeenCalled();
      expect(sources.length).toBe(1);
    });
  });

  describe('source metadata', () => {
    it('should include correct metadata in source', async () => {
      tool.registerCustomSource('test-market', () =>
        Promise.resolve({
          instrument: 'test-market',
          resolved: true,
          outcome: 'Yes',
          sourceType: 'news_consensus',
          sourceName: 'Multiple News Sources',
          sourceUrl: 'https://example.com',
          confidence: 0.85,
          timestamp: '2024-11-05T23:00:00Z',
          metadata: {
            newsCount: 5,
            firstReported: '2024-11-05T20:00:00Z',
          },
        }),
      );

      const sources = await tool.execute(['test-market']);

      expect(sources[0]?.metadata).toEqual({
        sourceType: 'news_consensus',
        sourceName: 'Multiple News Sources',
        resolved: true,
        outcome: 'Yes',
        newsCount: 5,
        firstReported: '2024-11-05T20:00:00Z',
      });
    });
  });
});
