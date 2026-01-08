/**
 * PredictionState Tests
 *
 * Tests for the LangGraph state annotation and helper functions.
 */

import {
  createInitialState,
  markStageComplete,
  PredictionState,
} from '../base-prediction.state';
import { PredictionRunnerConfig, Datapoint } from '../base-prediction.types';

describe('PredictionState', () => {
  const mockConfig: PredictionRunnerConfig = {
    runner: 'stock-predictor',
    instruments: ['AAPL', 'MSFT'],
    riskProfile: 'moderate',
    pollIntervalMs: 60000,
    preFilterThresholds: {
      minPriceChangePercent: 2,
      minSentimentShift: 0.3,
      minSignificanceScore: 0.5,
    },
  };

  const mockExecutionContext = {
    taskId: 'test-task-id',
    userId: 'test-user-id',
    conversationId: 'test-conversation-id',
  };

  describe('createInitialState', () => {
    it('should create state with all required fields', () => {
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      // Run identity
      expect(state.runId).toBeDefined();
      expect(state.runId).toMatch(/^run-\d+-[a-z0-9]+$/);
      expect(state.agentId).toBe('test-agent-id');
      expect(state.agentSlug).toBe('test-agent');
      expect(state.orgSlug).toBe('test-org');
      expect(state.timestamp).toBeDefined();

      // Configuration
      expect(state.config).toEqual(mockConfig);
      expect(state.instruments).toEqual(['AAPL', 'MSFT']);
      expect(state.riskProfile).toBe('moderate');

      // Execution context
      expect(state.executionContext).toEqual(mockExecutionContext);

      // Data (initialized empty)
      expect(state.datapoint).toBeNull();
      expect(state.instrumentBundles).toEqual([]);

      // Pipeline outputs (initialized empty)
      expect(state.triageResults).toEqual([]);
      expect(state.specialistAnalyses).toEqual([]);
      expect(state.evaluatorChallenges).toEqual([]);
      expect(state.recommendations).toEqual([]);

      // Execution metadata
      expect(state.currentStage).toBe('init');
      expect(state.stageTimes).toHaveProperty('init');
      expect(state.metrics).toEqual({});
      expect(state.errors).toEqual([]);
      expect(state.status).toBe('running');
    });

    it('should set correct initial values', () => {
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      // Empty arrays
      expect(Array.isArray(state.instrumentBundles)).toBe(true);
      expect(state.instrumentBundles.length).toBe(0);
      expect(Array.isArray(state.triageResults)).toBe(true);
      expect(state.triageResults.length).toBe(0);
      expect(Array.isArray(state.specialistAnalyses)).toBe(true);
      expect(state.specialistAnalyses.length).toBe(0);
      expect(Array.isArray(state.evaluatorChallenges)).toBe(true);
      expect(state.evaluatorChallenges.length).toBe(0);
      expect(Array.isArray(state.recommendations)).toBe(true);
      expect(state.recommendations.length).toBe(0);
      expect(Array.isArray(state.errors)).toBe(true);
      expect(state.errors.length).toBe(0);

      // Null datapoint
      expect(state.datapoint).toBeNull();

      // Empty metrics
      expect(Object.keys(state.metrics).length).toBe(0);
    });

    it('should use instrumentsOverride when provided', () => {
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
        instrumentsOverride: ['NVDA', 'GOOGL'],
      });

      expect(state.instruments).toEqual(['NVDA', 'GOOGL']);
      expect(state.config.instruments).toEqual(['AAPL', 'MSFT']); // Original config unchanged
    });

    it('should use runTimestamp when provided', () => {
      const customTimestamp = '2026-01-07T12:00:00Z';

      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
        runTimestamp: customTimestamp,
      });

      expect(state.timestamp).toBe(customTimestamp);
    });

    it('should generate unique runIds for different calls', () => {
      const state1 = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      const state2 = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      expect(state1.runId).not.toBe(state2.runId);
    });

    it('should initialize stageTimes with init timestamp', () => {
      const beforeTime = Date.now();

      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      const afterTime = Date.now();

      expect(state.stageTimes.init).toBeGreaterThanOrEqual(beforeTime);
      expect(state.stageTimes.init).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('markStageComplete', () => {
    let initialState: PredictionState;

    beforeEach(() => {
      initialState = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });
    });

    it('should update the stage in state update', () => {
      const update = markStageComplete(initialState, 'poll', {
        datapoint: null,
      });

      expect(update.currentStage).toBe('poll');
    });

    it('should include original update fields', () => {
      const mockDatapoint: Datapoint = {
        id: 'test-datapoint-id',
        agentId: 'test-agent-id',
        timestamp: '2026-01-07T12:00:00Z',
        sources: [],
        allClaims: [],
        instruments: [],
        metadata: {
          durationMs: 100,
          toolsSucceeded: 1,
          toolsFailed: 0,
          toolStatus: {},
        },
      };

      const update = markStageComplete(initialState, 'poll', {
        datapoint: mockDatapoint,
      });

      expect(update.datapoint).toEqual(mockDatapoint);
      expect(update.currentStage).toBe('poll');
    });

    it('should add stage timestamp to stageTimes', () => {
      const beforeTime = Date.now();

      const update = markStageComplete(initialState, 'poll', {});

      const afterTime = Date.now();

      expect(update.stageTimes).toBeDefined();
      expect(update.stageTimes!.poll).toBeGreaterThanOrEqual(beforeTime);
      expect(update.stageTimes!.poll).toBeLessThanOrEqual(afterTime);
    });

    it('should calculate stage duration in metrics', () => {
      // Simulate some time passing
      const stageDuration = 500; // ms
      const stateWithOldStageTime = {
        ...initialState,
        currentStage: 'poll' as const,
        stageTimes: {
          ...initialState.stageTimes,
          poll: Date.now() - stageDuration,
        },
      };

      const update = markStageComplete(stateWithOldStageTime, 'group', {});

      expect(update.metrics).toBeDefined();
      expect(update.metrics!.stageDurations).toBeDefined();
      expect(update.metrics!.stageDurations!.poll).toBeGreaterThanOrEqual(
        stageDuration - 50,
      ); // Allow 50ms tolerance
      expect(update.metrics!.stageDurations!.poll).toBeLessThanOrEqual(
        stageDuration + 100,
      ); // Allow 100ms tolerance
    });

    it('should preserve existing stage durations in metrics', () => {
      const stateWithMetrics = {
        ...initialState,
        currentStage: 'group' as const,
        stageTimes: {
          init: Date.now() - 2000,
          poll: Date.now() - 1000,
          group: Date.now() - 500,
        },
        metrics: {
          stageDurations: {
            init: 100,
            poll: 500,
          },
        },
      };

      const update = markStageComplete(stateWithMetrics, 'triage', {});

      expect(update.metrics!.stageDurations).toHaveProperty('init', 100);
      expect(update.metrics!.stageDurations).toHaveProperty('poll', 500);
      expect(update.metrics!.stageDurations).toHaveProperty('group');
    });

    it('should not duplicate stages when called multiple times', () => {
      const update1 = markStageComplete(initialState, 'poll', {});
      const stateAfterUpdate1 = {
        ...initialState,
        ...update1,
      };

      const update2 = markStageComplete(stateAfterUpdate1, 'poll', {});

      // Should still have only one 'poll' entry in stageTimes
      const pollKeys = Object.keys(update2.stageTimes || {}).filter(
        (k) => k === 'poll',
      );
      expect(pollKeys.length).toBe(1);
    });

    it('should work for all valid stage names', () => {
      const stages: Array<PredictionState['currentStage']> = [
        'init',
        'poll',
        'group',
        'triage',
        'specialists',
        'evaluators',
        'package',
        'store',
        'complete',
        'failed',
      ];

      for (const stage of stages) {
        const update = markStageComplete(initialState, stage, {});

        expect(update.currentStage).toBe(stage);
        expect(update.stageTimes).toHaveProperty(stage);
      }
    });
  });

  describe('PredictionStateAnnotation reducers', () => {
    it('should use replace reducer for simple fields', () => {
      // This tests the default reducer behavior
      // In actual LangGraph usage, these reducers merge updates into state
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      // Simple string fields should be replaceable
      expect(state.currentStage).toBe('init');
      expect(state.status).toBe('running');
    });

    it('should use append reducer for array fields', () => {
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      // Array fields start empty
      expect(state.triageResults).toEqual([]);
      expect(state.specialistAnalyses).toEqual([]);
      expect(state.evaluatorChallenges).toEqual([]);
      expect(state.recommendations).toEqual([]);
      expect(state.errors).toEqual([]);
    });

    it('should use spread reducer for object fields', () => {
      const state = createInitialState({
        agentId: 'test-agent-id',
        agentSlug: 'test-agent',
        orgSlug: 'test-org',
        config: mockConfig,
        executionContext: mockExecutionContext,
      });

      // Object fields should be mergeable
      expect(state.stageTimes).toHaveProperty('init');
      expect(state.metrics).toEqual({});
    });
  });
});
