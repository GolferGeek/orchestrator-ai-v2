/**
 * Evaluators Node Tests
 *
 * Tests the evaluators node that challenges specialist analyses.
 * Phase 1: Tests placeholder implementation (no-op pass-through)
 * Phase 2+: Will test evaluator challenges and red-teaming
 */

import { evaluatorsNode } from '../evaluators.node';
import {
  createInitialState,
  PredictionState,
} from '../../base-prediction.state';
import { RunnerInput, SpecialistAnalysis } from '../../base-prediction.types';

describe('evaluatorsNode', () => {
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

  // Helper to create mock specialist analysis
  const createMockAnalysis = (instrument: string): SpecialistAnalysis => ({
    specialist: 'technical-analyst',
    instrument,
    conclusion: 'bullish',
    confidence: 0.8,
    analysis: 'Strong upward momentum',
    keyClaims: [
      {
        type: 'price',
        instrument,
        value: 150,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ],
    suggestedAction: 'buy',
    riskFactors: ['Market volatility'],
  });

  it('should return state unchanged (placeholder)', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [createMockAnalysis('AAPL')],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    // Phase 1: No evaluator challenges yet
    expect(result.evaluatorChallenges).toBeDefined();
    expect(result.evaluatorChallenges?.length).toBe(0);
  });

  it('should mark evaluators stage complete', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [createMockAnalysis('AAPL')],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    expect(result.currentStage).toBe('evaluators');
    expect(result.stageTimes).toBeDefined();
  });

  it('should handle empty specialist analyses', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    expect(result.evaluatorChallenges).toBeDefined();
    expect(result.evaluatorChallenges?.length).toBe(0);
  });

  it('should handle multiple specialist analyses', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [
        createMockAnalysis('AAPL'),
        createMockAnalysis('MSFT'),
        createMockAnalysis('NVDA'),
      ],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    // Phase 1: All analyses pass through, but no challenges yet
    expect(result.evaluatorChallenges?.length).toBe(0);
  });

  it('should preserve other state properties', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [createMockAnalysis('AAPL')],
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

    const result = evaluatorsNode(stateWithAnalyses);

    // State should not have errors or fail status
    expect(result.errors).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('should update metrics with stage duration', () => {
    const input = createMockInput();
    const state = createInitialState(input);
    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [createMockAnalysis('AAPL')],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.stageDurations).toBeDefined();
  });

  it('should work with empty state', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const result = evaluatorsNode(state);

    expect(result.evaluatorChallenges).toBeDefined();
    expect(result.evaluatorChallenges?.length).toBe(0);
    expect(result.currentStage).toBe('evaluators');
  });

  it('should not modify existing evaluator challenges', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    // Create state with existing challenges (shouldn't happen in Phase 1, but test anyway)
    const stateWithChallenges: PredictionState = {
      ...state,
      evaluatorChallenges: [
        {
          evaluator: 'contrarian-evaluator',
          recommendationId: 'rec-1',
          passed: false,
          challengeType: 'contrarian',
          challenge: 'Historical pattern suggests otherwise',
          confidence: 0.7,
        },
      ],
      specialistAnalyses: [createMockAnalysis('MSFT')],
    };

    const result = evaluatorsNode(stateWithChallenges);

    // Phase 1: Returns empty array, so existing challenges are replaced
    expect(result.evaluatorChallenges).toEqual([]);
  });

  it('should handle different specialist conclusions', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const bullishAnalysis: SpecialistAnalysis = {
      ...createMockAnalysis('AAPL'),
      conclusion: 'bullish',
    };

    const bearishAnalysis: SpecialistAnalysis = {
      ...createMockAnalysis('MSFT'),
      specialist: 'fundamental-analyst',
      conclusion: 'bearish',
      suggestedAction: 'sell',
    };

    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [bullishAnalysis, bearishAnalysis],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    // Phase 1: No challenges regardless of conclusion
    expect(result.evaluatorChallenges?.length).toBe(0);
  });

  it('should handle analyses with low confidence', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const lowConfidenceAnalysis: SpecialistAnalysis = {
      ...createMockAnalysis('AAPL'),
      confidence: 0.3, // Low confidence
    };

    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [lowConfidenceAnalysis],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    // Phase 1: No challenges even for low confidence
    expect(result.evaluatorChallenges?.length).toBe(0);
  });

  it('should handle analyses with multiple risk factors', () => {
    const input = createMockInput();
    const state = createInitialState(input);

    const riskyAnalysis: SpecialistAnalysis = {
      ...createMockAnalysis('AAPL'),
      riskFactors: [
        'Market volatility',
        'Economic uncertainty',
        'Regulatory changes',
      ],
    };

    const stateWithAnalyses: PredictionState = {
      ...state,
      specialistAnalyses: [riskyAnalysis],
    };

    const result = evaluatorsNode(stateWithAnalyses);

    // Phase 1: No challenges even for high-risk analyses
    expect(result.evaluatorChallenges?.length).toBe(0);
  });
});
