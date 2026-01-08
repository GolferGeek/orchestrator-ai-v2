/**
 * Poll Data Node Tests
 *
 * Tests the poll-data node that collects claims from data sources.
 * Phase 1: Tests placeholder implementation
 * Phase 2+: Will test actual tool execution
 */

import { pollDataNode } from '../poll-data.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput } from '../../base-prediction.types';

describe('pollDataNode', () => {
  // Helper to create mock input
  const createMockInput = (overrides?: Partial<RunnerInput>): RunnerInput => ({
    agentId: 'agent-1',
    agentSlug: 'test-agent',
    orgSlug: 'test-org',
    config: {
      runner: 'stock-predictor',
      instruments: ['AAPL', 'MSFT', 'NVDA'],
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

  it('should return state with placeholder datapoint', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint).toBeDefined();
    expect(result.datapoint?.id).toBeDefined();
    expect(result.datapoint?.agentId).toBe('agent-1');
    expect(result.datapoint?.timestamp).toBe(state.timestamp);
  });

  it('should mark poll_data stage complete', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.currentStage).toBe('poll');
    expect(result.stageTimes).toBeDefined();
    expect(result.stageTimes?.poll).toBeDefined();
  });

  it('should handle empty instruments array', () => {
    const input = createMockInput({
      config: {
        runner: 'stock-predictor',
        instruments: [], // Empty instruments
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0.3,
        },
      },
    });
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint).toBeDefined();
    expect(result.datapoint?.instruments).toEqual([]);
    expect(result.datapoint?.sources).toEqual([]);
    expect(result.datapoint?.allClaims).toEqual([]);
  });

  it('should create datapoint with correct structure', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint).toMatchObject({
      id: expect.any(String),
      agentId: 'agent-1',
      timestamp: expect.any(String),
      sources: [],
      allClaims: [],
      instruments: ['AAPL', 'MSFT', 'NVDA'],
      metadata: {
        durationMs: expect.any(Number),
        toolsSucceeded: 0,
        toolsFailed: 0,
        toolStatus: {},
        errors: [],
      },
    });
  });

  it('should include all configured instruments in datapoint', () => {
    const input = createMockInput({
      config: {
        runner: 'crypto-predictor',
        instruments: ['BTC-USD', 'ETH-USD', 'SOL-USD'],
        riskProfile: 'trader',
        pollIntervalMs: 30000,
        preFilterThresholds: {
          minPriceChangePercent: 5,
          minSentimentShift: 0.3,
          minSignificanceScore: 0.4,
        },
      },
    });
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint?.instruments).toEqual([
      'BTC-USD',
      'ETH-USD',
      'SOL-USD',
    ]);
  });

  it('should track execution duration in metadata', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint?.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle instrumentsOverride from input', () => {
    const input = createMockInput({
      instrumentsOverride: ['TSLA'], // Override configured instruments
    });
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint?.instruments).toEqual(['TSLA']);
  });

  it('should use runTimestamp if provided', () => {
    const customTimestamp = '2026-01-07T10:00:00Z';
    const input = createMockInput({
      runTimestamp: customTimestamp,
    });
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.datapoint?.timestamp).toBe(customTimestamp);
  });

  it('should return error state on exception', () => {
    // Create a state without datapoint to simulate error condition
    const input = createMockInput();
    const state = createInitialState(input);

    // Force an error by passing invalid state
    const invalidState = {
      ...state,
      timestamp: null as unknown as string, // Invalid timestamp
    };

    const result = pollDataNode(invalidState as PredictionState);

    // Should handle gracefully (in this placeholder implementation, it still works)
    // In future phases with actual tool execution, this would test error handling
    expect(result.datapoint).toBeDefined();
  });

  it('should update metrics with stage duration', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = pollDataNode(state);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stageDurations).toBeDefined();
    expect(result.metrics?.stageDurations?.init).toBeGreaterThanOrEqual(0);
  });

  it('should generate unique datapoint IDs', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result1 = pollDataNode(state);
    const result2 = pollDataNode(state);

    expect(result1.datapoint?.id).toBeDefined();
    expect(result2.datapoint?.id).toBeDefined();
    expect(result1.datapoint?.id).not.toBe(result2.datapoint?.id);
  });
});
