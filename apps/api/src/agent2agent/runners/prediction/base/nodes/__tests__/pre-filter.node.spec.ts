/**
 * Pre-Filter Node Tests
 *
 * Tests the pre-filter node that applies rule-based filtering to claim bundles.
 * Phase 1: Tests placeholder implementation with basic threshold filtering
 * Phase 2+: Will test historical comparison and significance scoring
 */

import { preFilterNode } from '../pre-filter.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput, Datapoint, Claim } from '../../base-prediction.types';

describe('preFilterNode', () => {
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

  // Helper to create mock datapoint with claims
  const createMockDatapoint = (claims: Claim[]): Datapoint => ({
    id: 'dp-1',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    sources: [
      {
        tool: 'yahoo-finance',
        fetchedAt: new Date().toISOString(),
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

  it('should filter bundles based on significance threshold', () => {
    const input = createMockInput({
      config: {
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0.8, // High threshold
        },
      },
    });

    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    // Phase 1: Default significance is 0.5, so it should be filtered out
    expect(result.instrumentBundles).toBeDefined();
    expect(result.instrumentBundles?.length).toBe(0);
  });

  it('should keep bundles above threshold', () => {
    const input = createMockInput({
      config: {
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0.3, // Low threshold
        },
      },
    });

    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    // Phase 1: Default significance is 0.5, should pass 0.3 threshold
    expect(result.instrumentBundles).toBeDefined();
    expect(result.instrumentBundles?.length).toBe(1);
    expect(result.instrumentBundles?.[0]?.instrument).toBe('AAPL');
  });

  it('should remove bundles below threshold', () => {
    const input = createMockInput({
      config: {
        runner: 'stock-predictor',
        instruments: ['AAPL', 'MSFT'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0.7, // Will filter out default 0.5
        },
      },
    });

    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
      {
        type: 'price',
        instrument: 'MSFT',
        value: 300,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    // Both should be filtered out
    expect(result.instrumentBundles?.length).toBe(0);
  });

  it('should handle missing thresholds with defaults', () => {
    const input = createMockInput({
      config: {
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0,
        },
      },
    });

    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    // With minSignificanceScore of 0, all bundles should pass
    expect(result.instrumentBundles?.length).toBe(1);
  });

  it('should mark pre_filter stage complete', () => {
    const input = createMockInput();
    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    expect(result.currentStage).toBe('group');
    expect(result.stageTimes).toBeDefined();
  });

  it('should group claims by instrument', () => {
    const input = createMockInput();
    const claims: Claim[] = [
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
        type: 'price',
        instrument: 'MSFT',
        value: 300,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    expect(result.instrumentBundles?.length).toBe(2);

    const aaplBundle = result.instrumentBundles?.find(
      (b) => b.instrument === 'AAPL',
    );
    expect(aaplBundle).toBeDefined();
    expect(aaplBundle?.currentClaims.length).toBe(2);

    const msftBundle = result.instrumentBundles?.find(
      (b) => b.instrument === 'MSFT',
    );
    expect(msftBundle).toBeDefined();
    expect(msftBundle?.currentClaims.length).toBe(1);
  });

  it('should include source information in bundles', () => {
    const input = createMockInput();
    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const datapoint: Datapoint = {
      id: 'dp-1',
      agentId: 'agent-1',
      timestamp: new Date().toISOString(),
      sources: [
        {
          tool: 'yahoo-finance',
          fetchedAt: new Date().toISOString(),
          claims,
        },
        {
          tool: 'alpha-vantage',
          fetchedAt: new Date().toISOString(),
          claims: [],
        },
      ],
      allClaims: claims,
      instruments: ['AAPL'],
      metadata: {
        durationMs: 100,
        toolsSucceeded: 2,
        toolsFailed: 0,
        toolStatus: {},
      },
    };

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint,
    };

    const result = preFilterNode(stateWithDatapoint);

    const aaplBundle = result.instrumentBundles?.find(
      (b) => b.instrument === 'AAPL',
    );
    expect(aaplBundle?.sources).toContain('yahoo-finance');
  });

  it('should set shouldProceed to true in Phase 1', () => {
    const input = createMockInput();
    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    const bundle = result.instrumentBundles?.[0];
    expect(bundle?.shouldProceed).toBe(true);
    expect(bundle?.proceedReason).toContain('Phase 1');
  });

  it('should create enriched bundles with empty historical claims', () => {
    const input = createMockInput();
    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    const bundle = result.instrumentBundles?.[0];
    expect(bundle?.historicalClaims).toEqual([]);
    expect(bundle?.claimsDiff).toBeDefined();
    expect(bundle?.claimsDiff.newClaims).toEqual(claims);
    expect(bundle?.claimsDiff.changedClaims).toEqual([]);
    expect(bundle?.claimsDiff.removedClaims).toEqual([]);
  });

  it('should handle empty datapoint', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // State without datapoint
    const result = preFilterNode(state);

    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0]).toContain('No datapoint');
    expect(result.status).toBe('failed');
  });

  it('should handle datapoint with no claims', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint([]),
    };

    const result = preFilterNode(stateWithDatapoint);

    expect(result.instrumentBundles).toBeDefined();
    expect(result.instrumentBundles?.length).toBe(0);
  });

  it('should calculate default significance score', () => {
    const input = createMockInput();
    const claims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    const state = createInitialState(input);
    const stateWithDatapoint: PredictionState = {
      ...state,
      datapoint: createMockDatapoint(claims),
    };

    const result = preFilterNode(stateWithDatapoint);

    const bundle = result.instrumentBundles?.[0];
    expect(bundle?.claimsDiff.significanceScore).toBe(0.5);
  });
});
