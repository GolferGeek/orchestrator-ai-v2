/**
 * Triage Node Tests
 *
 * Tests the triage node that determines which bundles proceed to specialist analysis.
 * Phase 1: Tests placeholder rule-based triage
 * Phase 2+: Will test LLM-based triage with voting
 */

import { triageNode } from '../triage.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput, EnrichedClaimBundle } from '../../base-prediction.types';

describe('triageNode', () => {
  // Helper to create mock input
  const createMockInput = (overrides?: Partial<RunnerInput>): RunnerInput => ({
    agentId: 'agent-1',
    agentSlug: 'test-agent',
    orgSlug: 'test-org',
    config: {
      runner: 'stock-predictor',
      instruments: ['AAPL', 'MSFT'],
      riskProfile: 'moderate',
      pollIntervalMs: 60000,
      preFilterThresholds: {
        minPriceChangePercent: 2,
        minSentimentShift: 0.2,
        minSignificanceScore: 0.3,
      },
    },
    executionContext: {
      taskId: 'task-1',
      userId: 'user-1',
    },
    ...overrides,
  });

  // Helper to create mock enriched bundle
  const createMockBundle = (
    instrument: string,
    significanceScore: number,
    shouldProceed = true,
  ): EnrichedClaimBundle => ({
    instrument,
    currentClaims: [
      {
        type: 'price',
        instrument,
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ],
    sources: ['yahoo-finance'],
    historicalClaims: [],
    claimsDiff: {
      newClaims: [],
      changedClaims: [],
      removedClaims: [],
      significanceScore,
    },
    shouldProceed,
    proceedReason: 'Test bundle',
  });

  it('should create triage results for each bundle', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [
        createMockBundle('AAPL', 0.5),
        createMockBundle('MSFT', 0.6),
      ],
    };

    const result = triageNode(stateWithBundles);

    expect(result.triageResults).toBeDefined();
    expect(result.triageResults?.length).toBe(2);
    expect(result.triageResults?.map((r) => r.instrument)).toContain('AAPL');
    expect(result.triageResults?.map((r) => r.instrument)).toContain('MSFT');
  });

  it('should set proceed=true for bundles that passed pre-filter', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5, true)],
    };

    const result = triageNode(stateWithBundles);

    const triageResult = result.triageResults?.[0];
    expect(triageResult?.proceed).toBe(true);
  });

  it('should mark triage stage complete', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5)],
    };

    const result = triageNode(stateWithBundles);

    expect(result.currentStage).toBe('triage');
    expect(result.stageTimes).toBeDefined();
  });

  it('should skip bundles that did not pass pre-filter', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [
        createMockBundle('AAPL', 0.5, true), // Should proceed
        createMockBundle('MSFT', 0.2, false), // Should not proceed
      ],
    };

    const result = triageNode(stateWithBundles);

    expect(result.triageResults?.length).toBe(1);
    expect(result.triageResults?.[0]?.instrument).toBe('AAPL');
  });

  it('should determine urgency based on significance score', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // Test different significance scores
    const testCases = [
      { score: 0.9, expectedUrgency: 'critical' as const },
      { score: 0.7, expectedUrgency: 'high' as const },
      { score: 0.5, expectedUrgency: 'medium' as const },
      { score: 0.3, expectedUrgency: 'low' as const },
    ];

    for (const testCase of testCases) {
      const stateWithBundles: PredictionState = {
        ...state,
        instrumentBundles: [createMockBundle('AAPL', testCase.score)],
      };

      const result = triageNode(stateWithBundles);
      const triageResult = result.triageResults?.[0];

      expect(triageResult?.urgency).toBe(testCase.expectedUrgency);
    }
  });

  it('should assign default specialist teams', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5)],
    };

    const result = triageNode(stateWithBundles);

    const triageResult = result.triageResults?.[0];
    expect(triageResult?.specialistTeams).toContain('technical');
    expect(triageResult?.specialistTeams).toContain('fundamental');
  });

  it('should include rationale in triage result', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5)],
    };

    const result = triageNode(stateWithBundles);

    const triageResult = result.triageResults?.[0];
    expect(triageResult?.rationale).toBeDefined();
    expect(triageResult?.rationale).toContain('claims');
    expect(triageResult?.rationale).toContain('significance');
  });

  it('should include vote information', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5)],
    };

    const result = triageNode(stateWithBundles);

    const triageResult = result.triageResults?.[0];
    expect(triageResult?.votes).toBeDefined();
    expect(triageResult?.votes.length).toBeGreaterThan(0);

    const vote = triageResult?.votes[0];
    expect(vote?.agent).toBe('rule-based-triage');
    expect(vote?.proceed).toBe(true);
    expect(vote?.confidence).toBe(0.5); // Matches significance score
    expect(vote?.reason).toContain('Phase 1');
  });

  it('should handle multiple bundles with different scores', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [
        createMockBundle('AAPL', 0.9), // Critical (> 0.8)
        createMockBundle('MSFT', 0.3), // Low (<= 0.4)
        createMockBundle('NVDA', 0.7), // High (> 0.6)
      ],
    };

    const result = triageNode(stateWithBundles);

    expect(result.triageResults?.length).toBe(3);

    const aaplTriage = result.triageResults?.find(
      (r) => r.instrument === 'AAPL',
    );
    expect(aaplTriage?.urgency).toBe('critical');

    const msftTriage = result.triageResults?.find(
      (r) => r.instrument === 'MSFT',
    );
    expect(msftTriage?.urgency).toBe('low');

    const nvdaTriage = result.triageResults?.find(
      (r) => r.instrument === 'NVDA',
    );
    expect(nvdaTriage?.urgency).toBe('high');
  });

  it('should handle empty bundles list', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [],
    };

    const result = triageNode(stateWithBundles);

    expect(result.triageResults).toBeDefined();
    expect(result.triageResults?.length).toBe(0);
  });

  it('should handle bundles with multiple claims', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const bundleWithMultipleClaims: EnrichedClaimBundle = {
      instrument: 'AAPL',
      currentClaims: [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 150,
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'volume',
          instrument: 'AAPL',
          value: 1000000,
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'sentiment',
          instrument: 'AAPL',
          value: 0.8,
          confidence: 0.7,
          timestamp: new Date().toISOString(),
        },
      ],
      sources: ['yahoo-finance', 'news-api'],
      historicalClaims: [],
      claimsDiff: {
        newClaims: [],
        changedClaims: [],
        removedClaims: [],
        significanceScore: 0.6,
      },
      shouldProceed: true,
      proceedReason: 'Test',
    };

    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [bundleWithMultipleClaims],
    };

    const result = triageNode(stateWithBundles);

    const triageResult = result.triageResults?.[0];
    expect(triageResult?.rationale).toContain('3 claims');
  });

  it('should return error on exception', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // Create invalid state to trigger error
    const invalidState = {
      ...state,
      instrumentBundles: null as unknown as EnrichedClaimBundle[],
    };

    const result = triageNode(invalidState as PredictionState);

    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.status).toBe('failed');
  });

  it('should update metrics with stage duration', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithBundles: PredictionState = {
      ...state,
      instrumentBundles: [createMockBundle('AAPL', 0.5)],
    };

    const result = triageNode(stateWithBundles);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stageDurations).toBeDefined();
  });
});
