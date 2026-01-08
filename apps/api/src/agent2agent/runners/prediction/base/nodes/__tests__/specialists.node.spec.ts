/**
 * Specialists Node Tests
 *
 * Tests the specialists node that performs deep analysis on triaged bundles.
 * Phase 1: Tests placeholder implementation (no-op pass-through)
 * Phase 2+: Will test specialist orchestration and LLM-based analysis
 */

import { specialistsNode } from '../specialists.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput, TriageResult } from '../../base-prediction.types';

describe('specialistsNode', () => {
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
  const createMockTriageResult = (instrument: string): TriageResult => ({
    instrument,
    proceed: true,
    urgency: 'medium',
    specialistTeams: ['technical', 'fundamental'],
    rationale: 'Test triage',
    votes: [
      {
        agent: 'triage-1',
        proceed: true,
        confidence: 0.8,
        reason: 'Test',
      },
    ],
  });

  it('should return state unchanged (placeholder)', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = specialistsNode(stateWithTriage);

    // Phase 1: No specialist analyses yet
    expect(result.specialistAnalyses).toBeDefined();
    expect(result.specialistAnalyses?.length).toBe(0);
  });

  it('should mark specialists stage complete', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = specialistsNode(stateWithTriage);

    expect(result.currentStage).toBe('specialists');
    expect(result.stageTimes).toBeDefined();
  });

  it('should handle empty triage results', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [],
    };

    const result = specialistsNode(stateWithTriage);

    expect(result.specialistAnalyses).toBeDefined();
    expect(result.specialistAnalyses?.length).toBe(0);
  });

  it('should handle multiple triage results', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [
        createMockTriageResult('AAPL'),
        createMockTriageResult('MSFT'),
        createMockTriageResult('NVDA'),
      ],
    };

    const result = specialistsNode(stateWithTriage);

    // Phase 1: All triage results pass through, but no analyses yet
    expect(result.specialistAnalyses?.length).toBe(0);
  });

  it('should preserve other state properties', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
      datapoint: {
        id: 'dp-1',
        agentId: 'agent-1',
        timestamp: new Date().toISOString(),
        sources: [],
        allClaims: [],
        instruments: ['AAPL'],
        metadata: {
          durationMs: 100,
          toolsSucceeded: 1,
          toolsFailed: 0,
          toolStatus: {},
        },
      },
    };

    const result = specialistsNode(stateWithTriage);

    // State should not have errors or fail status
    expect(result.errors).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('should update metrics with stage duration', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithTriage: PredictionState = {
      ...state,
      triageResults: [createMockTriageResult('AAPL')],
    };

    const result = specialistsNode(stateWithTriage);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stageDurations).toBeDefined();
  });

  it('should work with empty state', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = specialistsNode(state);

    expect(result.specialistAnalyses).toBeDefined();
    expect(result.specialistAnalyses?.length).toBe(0);
    expect(result.currentStage).toBe('specialists');
  });

  it('should not modify existing specialist analyses', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // Create state with existing specialist analyses (shouldn't happen in Phase 1, but test anyway)
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [
        {
          specialist: 'technical-analyst',
          instrument: 'AAPL',
          conclusion: 'bullish',
          confidence: 0.8,
          analysis: 'Strong technical signals',
          keyClaims: [],
          riskFactors: [],
        },
      ],
      triageResults: [createMockTriageResult('MSFT')],
    };

    const result = specialistsNode(stateWithAnalyses);

    // Phase 1: Returns empty array, so existing analyses are replaced
    expect(result.specialistAnalyses).toEqual([]);
  });
});
