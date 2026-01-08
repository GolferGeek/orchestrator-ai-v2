/**
 * Package Output Node Tests
 *
 * Tests the package-output node that creates final recommendations.
 * Phase 1: Tests placeholder implementation with basic recommendations
 * Phase 2+: Will test consensus building and risk-adjusted sizing
 */

import { packageOutputNode } from '../package-output.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput, TriageResult } from '../../base-prediction.types';

describe('packageOutputNode', () => {
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

  // Helper to create mock triage result
  const createMockTriageResult = (
    instrument: string,
    proceed = true,
  ): TriageResult => ({
    instrument,
    proceed,
    urgency: 'medium',
    specialistTeams: ['technical', 'fundamental'],
    rationale: 'Test triage',
    votes: [
      {
        agent: 'triage-1',
        proceed,
        confidence: 0.8,
        reason: 'Test',
      },
    ],
  });

  it('should create recommendations from triage results', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [
        createMockTriageResult('AAPL'),
        createMockTriageResult('MSFT'),
      ],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.recommendations).toBeDefined();
    expect(result.recommendations?.length).toBe(2);
    expect(result.recommendations?.map((r) => r.instrument)).toContain('AAPL');
    expect(result.recommendations?.map((r) => r.instrument)).toContain('MSFT');
  });

  it('should set correct action based on bundle', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    // Phase 1: Default to 'hold'
    expect(recommendation?.action).toBe('hold');
  });

  it('should set correct confidence', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    // Phase 1: Default confidence is 0.5
    expect(recommendation?.confidence).toBe(0.5);
  });

  it('should mark package_output stage complete', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.currentStage).toBe('complete');
    expect(result.stageTimes).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should skip bundles that did not proceed', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [
        createMockTriageResult('AAPL', true), // Proceed
        createMockTriageResult('MSFT', false), // Don't proceed
      ],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.recommendations?.length).toBe(1);
    expect(result.recommendations?.[0]?.instrument).toBe('AAPL');
  });

  it('should include rationale in recommendation', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation?.rationale).toBeDefined();
    expect(recommendation?.rationale).toContain('Placeholder');
    expect(recommendation?.rationale).toContain('AAPL');
  });

  it('should generate unique recommendation IDs', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [
        createMockTriageResult('AAPL'),
        createMockTriageResult('MSFT'),
      ],
    };

    const result = packageOutputNode(stateWithTriage);

    const ids = result.recommendations?.map((r) => r.id) || [];
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBeDefined();
  });

  it('should include empty evidence array in Phase 1', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation?.evidence).toEqual([]);
  });

  it('should handle empty triage results', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.recommendations).toBeDefined();
    expect(result.recommendations?.length).toBe(0);
    expect(result.status).toBe('completed');
  });

  it('should handle multiple instruments', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [
        createMockTriageResult('AAPL'),
        createMockTriageResult('MSFT'),
        createMockTriageResult('NVDA'),
        createMockTriageResult('TSLA'),
      ],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.recommendations?.length).toBe(4);
    expect(result.recommendations?.map((r) => r.instrument)).toContain('AAPL');
    expect(result.recommendations?.map((r) => r.instrument)).toContain('MSFT');
    expect(result.recommendations?.map((r) => r.instrument)).toContain('NVDA');
    expect(result.recommendations?.map((r) => r.instrument)).toContain('TSLA');
  });

  it('should handle different risk profiles', () => {
    const riskProfiles = ['conservative', 'moderate', 'aggressive'] as const;

    for (const riskProfile of riskProfiles) {
      const input = createMockInput({
        config: {
          runner: 'stock-predictor',
          instruments: ['AAPL'],
          riskProfile,
          pollIntervalMs: 60000,
          preFilterThresholds: {
            minPriceChangePercent: 2,
            minSentimentShift: 0.2,
            minSignificanceScore: 0.3,
          },
        },
      });

      const state = createInitialState(input);
      const stateWithTriage: PredictionState = {
        ...state,
        triageResults: [createMockTriageResult('AAPL')],
      };

      const result = packageOutputNode(stateWithTriage);

      // Phase 1: Risk profile doesn't affect output yet
      expect(result.recommendations?.length).toBe(1);
    }
  });

  it('should return error on exception', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // Create invalid state to trigger error
    const invalidState = {
      ...state,
      triageResults: null as unknown as TriageResult[],
    };

    const result = packageOutputNode(invalidState as PredictionState);

    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.status).toBe('failed');
  });

  it('should update metrics with stage duration', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stageDurations).toBeDefined();
  });

  it('should not include sizing in Phase 1', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation?.sizing).toBeUndefined();
  });

  it('should not include timing window in Phase 1', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation?.timingWindow).toBeUndefined();
  });

  it('should not include entry style in Phase 1', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation?.entryStyle).toBeUndefined();
  });

  it('should create valid recommendation structure', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = packageOutputNode(stateWithTriage);

    const recommendation = result.recommendations?.[0];
    expect(recommendation).toMatchObject({
      id: expect.any(String),
      instrument: 'AAPL',
      action: 'hold',
      confidence: 0.5,
      rationale: expect.any(String),
      evidence: [],
    });
  });
});
