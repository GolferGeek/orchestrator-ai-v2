/**
 * DefaultClaimProcessor Tests
 *
 * Tests for the default claim processor implementation.
 * Tests grouping, enrichment, and pre-filter logic.
 */

import { DefaultClaimProcessor } from '../default-claim-processor';
import {
  Claim,
  ClaimBundle,
  EnrichedClaimBundle,
  Datapoint,
  PreFilterThresholds,
} from '../base-prediction.types';

describe('DefaultClaimProcessor', () => {
  let processor: DefaultClaimProcessor;

  const mockThresholds: PreFilterThresholds = {
    minPriceChangePercent: 2,
    minSentimentShift: 0.3,
    minSignificanceScore: 0.5,
  };

  const createClaim = (overrides: Partial<Claim> = {}): Claim => ({
    type: 'price',
    instrument: 'AAPL',
    value: 178.5,
    confidence: 0.95,
    timestamp: '2026-01-07T12:00:00Z',
    ...overrides,
  });

  const createDatapoint = (claims: Claim[] = []): Datapoint => ({
    id: 'dp-123',
    agentId: 'agent-123',
    timestamp: '2026-01-07T12:00:00Z',
    sources: [
      {
        tool: 'yahoo-finance',
        fetchedAt: '2026-01-07T12:00:00Z',
        claims,
      },
    ],
    allClaims: claims,
    instruments: [...new Set(claims.map((c) => c.instrument))],
    metadata: {
      durationMs: 100,
      toolsSucceeded: 1,
      toolsFailed: 0,
      toolStatus: { 'yahoo-finance': 'success' },
    },
  });

  beforeEach(() => {
    processor = new DefaultClaimProcessor(undefined);
  });

  describe('groupClaims', () => {
    it('should group claims by instrument', () => {
      const claims = [
        createClaim({ instrument: 'AAPL', type: 'price', value: 178.5 }),
        createClaim({ instrument: 'AAPL', type: 'volume', value: 1000000 }),
        createClaim({ instrument: 'MSFT', type: 'price', value: 380.0 }),
      ];
      const datapoint = createDatapoint(claims);

      const bundles = processor.groupClaims(datapoint);

      expect(bundles).toHaveLength(2);

      const aaplBundle = bundles.find((b) => b.instrument === 'AAPL');
      const msftBundle = bundles.find((b) => b.instrument === 'MSFT');

      expect(aaplBundle).toBeDefined();
      expect(aaplBundle!.currentClaims).toHaveLength(2);
      expect(msftBundle).toBeDefined();
      expect(msftBundle!.currentClaims).toHaveLength(1);
    });

    it('should track sources for each bundle', () => {
      const claims = [createClaim({ instrument: 'AAPL', type: 'price' })];
      const datapoint = createDatapoint(claims);

      const bundles = processor.groupClaims(datapoint);

      expect(bundles[0]?.sources).toContain('yahoo-finance');
    });

    it('should return empty array for empty datapoint', () => {
      const datapoint = createDatapoint([]);

      const bundles = processor.groupClaims(datapoint);

      expect(bundles).toEqual([]);
    });

    it('should handle multiple sources for same instrument', () => {
      const datapoint: Datapoint = {
        id: 'dp-123',
        agentId: 'agent-123',
        timestamp: '2026-01-07T12:00:00Z',
        sources: [
          {
            tool: 'yahoo-finance',
            fetchedAt: '2026-01-07T12:00:00Z',
            claims: [createClaim({ instrument: 'AAPL' })],
          },
          {
            tool: 'alpha-vantage',
            fetchedAt: '2026-01-07T12:00:00Z',
            claims: [createClaim({ instrument: 'AAPL' })],
          },
        ],
        allClaims: [
          createClaim({ instrument: 'AAPL' }),
          createClaim({ instrument: 'AAPL' }),
        ],
        instruments: ['AAPL'],
        metadata: {
          durationMs: 100,
          toolsSucceeded: 2,
          toolsFailed: 0,
          toolStatus: {},
        },
      };

      const bundles = processor.groupClaims(datapoint);

      expect(bundles[0]?.sources).toContain('yahoo-finance');
      expect(bundles[0]?.sources).toContain('alpha-vantage');
    });
  });

  describe('enrichWithHistory', () => {
    it('should enrich bundles with empty historical claims (stub)', async () => {
      const bundles: ClaimBundle[] = [
        {
          instrument: 'AAPL',
          currentClaims: [createClaim()],
          sources: ['yahoo-finance'],
        },
      ];

      const enriched = await processor.enrichWithHistory(
        bundles,
        'agent-123',
        24,
      );

      expect(enriched).toHaveLength(1);
      expect(enriched[0]?.historicalClaims).toEqual([]);
      expect(enriched[0]?.claimsDiff).toBeDefined();
      expect(enriched[0]?.shouldProceed).toBe(false);
    });

    it('should preserve original bundle data', async () => {
      const bundles: ClaimBundle[] = [
        {
          instrument: 'AAPL',
          currentClaims: [createClaim()],
          sources: ['yahoo-finance'],
        },
      ];

      const enriched = await processor.enrichWithHistory(
        bundles,
        'agent-123',
        24,
      );

      expect(enriched[0]?.instrument).toBe('AAPL');
      expect(enriched[0]?.currentClaims).toEqual(bundles[0]?.currentClaims);
      expect(enriched[0]?.sources).toEqual(['yahoo-finance']);
    });
  });

  describe('shouldProceedToSpecialists', () => {
    const createEnrichedBundle = (
      overrides: Partial<EnrichedClaimBundle> = {},
    ): EnrichedClaimBundle => ({
      instrument: 'AAPL',
      currentClaims: [createClaim()],
      sources: ['yahoo-finance'],
      historicalClaims: [],
      claimsDiff: {
        newClaims: [],
        changedClaims: [],
        removedClaims: [],
        significanceScore: 0.3,
      },
      shouldProceed: false,
      ...overrides,
    });

    it('should proceed when significance score exceeds threshold', () => {
      const bundle = createEnrichedBundle({
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.7,
        },
      });

      const result = processor.shouldProceedToSpecialists(
        bundle,
        mockThresholds,
      );

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('Significance score');
    });

    it('should proceed when price change exceeds threshold', () => {
      const bundle = createEnrichedBundle({
        claimsDiff: {
          newClaims: [],
          changedClaims: [
            {
              claim: createClaim({ type: 'price', value: 185.0 }),
              previousValue: 178.5,
              changePercent: 3.64,
            },
          ],
          removedClaims: [],
          significanceScore: 0.2,
        },
      });

      const result = processor.shouldProceedToSpecialists(
        bundle,
        mockThresholds,
      );

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('Price change');
    });

    it('should proceed when sentiment shift exceeds threshold', () => {
      const bundle = createEnrichedBundle({
        claimsDiff: {
          newClaims: [],
          changedClaims: [
            {
              claim: createClaim({ type: 'sentiment', value: 0.8 }),
              previousValue: 0.3,
              changePercent: 166.67,
            },
          ],
          removedClaims: [],
          significanceScore: 0.2,
        },
      });
      const thresholds: PreFilterThresholds = {
        ...mockThresholds,
        minSentimentShift: 100,
      };

      const result = processor.shouldProceedToSpecialists(bundle, thresholds);

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('Sentiment shift');
    });

    it('should proceed when new significant claims exist', () => {
      const bundle = createEnrichedBundle({
        claimsDiff: {
          newClaims: [
            createClaim({ type: 'event', value: 'Earnings released' }),
          ],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.2,
        },
      });

      const result = processor.shouldProceedToSpecialists(
        bundle,
        mockThresholds,
      );

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('new significant claims');
    });

    it('should not proceed when no thresholds met', () => {
      const bundle = createEnrichedBundle({
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.1,
        },
      });

      const result = processor.shouldProceedToSpecialists(
        bundle,
        mockThresholds,
      );

      expect(result.shouldProceed).toBe(false);
      expect(result.proceedReason).toContain('No thresholds met');
    });

    it('should check custom thresholds', () => {
      const bundle = createEnrichedBundle({
        currentClaims: [createClaim({ type: 'custom', value: 15 })],
      });
      const thresholds: PreFilterThresholds = {
        ...mockThresholds,
        custom: { custom: 10 },
      };

      const result = processor.shouldProceedToSpecialists(bundle, thresholds);

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('Custom metric custom');
    });
  });

  describe('calculateClaimsDiff', () => {
    it('should identify new claims', () => {
      const current = [createClaim({ type: 'price', value: 180 })];
      const historical: Claim[] = [];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.newClaims).toHaveLength(1);
      expect(diff.changedClaims).toHaveLength(0);
      expect(diff.removedClaims).toHaveLength(0);
    });

    it('should identify changed claims', () => {
      const current = [
        createClaim({
          type: 'price',
          value: 185,
          timestamp: '2026-01-07T13:00:00Z',
        }),
      ];
      const historical = [
        createClaim({
          type: 'price',
          value: 175,
          timestamp: '2026-01-07T12:00:00Z',
        }),
      ];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.newClaims).toHaveLength(0);
      expect(diff.changedClaims).toHaveLength(1);
      expect(diff.changedClaims[0]?.previousValue).toBe(175);
      expect(diff.changedClaims[0]?.changePercent).toBeCloseTo(5.71, 1);
    });

    it('should identify removed claims', () => {
      const current: Claim[] = [];
      const historical = [createClaim({ type: 'price', value: 175 })];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.newClaims).toHaveLength(0);
      expect(diff.changedClaims).toHaveLength(0);
      expect(diff.removedClaims).toHaveLength(1);
    });

    it('should calculate significance score based on changes', () => {
      const current = [
        createClaim({ type: 'price', value: 185 }),
        createClaim({ type: 'volume', value: 2000000 }),
      ];
      const historical = [
        createClaim({ type: 'price', value: 175 }),
        createClaim({ type: 'volume', value: 1000000 }),
      ];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.significanceScore).toBeGreaterThan(0);
      expect(diff.significanceScore).toBeLessThanOrEqual(1);
    });

    it('should not count minor numeric changes as changes', () => {
      const current = [createClaim({ type: 'price', value: 178.500001 })];
      const historical = [createClaim({ type: 'price', value: 178.5 })];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.changedClaims).toHaveLength(0);
    });

    it('should detect string value changes as changes', () => {
      const current = [
        createClaim({ type: 'sentiment_label', value: 'bullish' }),
      ];
      const historical = [
        createClaim({ type: 'sentiment_label', value: 'bearish' }),
      ];

      const diff = processor.calculateClaimsDiff(current, historical);

      expect(diff.changedClaims).toHaveLength(1);
    });
  });
});
