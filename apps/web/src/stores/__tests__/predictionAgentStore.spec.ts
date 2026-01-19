/**
 * Unit Tests for Prediction Agent Store
 * Tests pure state management for prediction agents
 *
 * Key Testing Areas:
 * - Store initialization
 * - State mutations (setters)
 * - Computed properties and getters
 * - History filtering and pagination
 * - Loading and error states
 * - Reset operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePredictionAgentStore } from '../predictionAgentStore';
import type {
  AgentStatus,
  Datapoint as _Datapoint,
  PredictionHistory,
  PredictionRunnerConfig,
  Recommendation,
  ToolStatus,
  CurrentAgentState,
} from '@/types/prediction-agent';

describe('PredictionAgentStore', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia());
  });

  describe('Store Initialization', () => {
    it('should initialize with empty state', () => {
      const store = usePredictionAgentStore();

      expect(store.agentId).toBeNull();
      expect(store.agentStatus).toBeNull();
      expect(store.latestDatapoint).toBeNull();
      expect(store.activeRecommendations).toEqual([]);
      expect(store.instruments).toEqual([]);
      expect(store.config).toBeNull();
      expect(store.toolsStatus).toEqual([]);
      expect(store.history).toEqual([]);
      expect(store.isLoading).toBe(false);
      expect(store.isExecuting).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should have default history filters', () => {
      const store = usePredictionAgentStore();

      expect(store.historyFilters).toEqual({
        instrument: null,
        outcome: 'all',
        startDate: null,
        endDate: null,
      });
    });

    it('should have default pagination values', () => {
      const store = usePredictionAgentStore();

      expect(store.historyPage).toBe(1);
      expect(store.historyPageSize).toBe(20);
      expect(store.historyTotal).toBe(0);
    });
  });

  describe('Agent Status Mutations', () => {
    it('should set agent ID', () => {
      const store = usePredictionAgentStore();

      store.setAgentId('agent-123');

      expect(store.agentId).toBe('agent-123');
    });

    it('should set agent status', () => {
      const store = usePredictionAgentStore();

      const status: AgentStatus = {
        state: 'running',
        startedAt: '2026-01-07T10:00:00Z',
        lastPollAt: '2026-01-07T11:00:00Z',
        nextPollAt: '2026-01-07T11:05:00Z',
        stats: {
          pollCount: 10,
          errorCount: 0,
          recommendationCount: 5,
          avgPollDurationMs: 2500,
        },
      };

      store.setAgentStatus(status);

      expect(store.agentStatus).toEqual(status);
    });

    it('should set current state with all fields', () => {
      const store = usePredictionAgentStore();

      const currentState: CurrentAgentState = {
        agentStatus: {
          state: 'running',
          stats: {
            pollCount: 5,
            errorCount: 0,
            recommendationCount: 3,
            avgPollDurationMs: 2000,
          },
        },
        latestDatapoint: {
          id: 'dp-1',
          agentId: 'agent-123',
          timestamp: '2026-01-07T11:00:00Z',
          sources: [],
        },
        activeRecommendations: [
          {
            id: 'rec-1',
            instrument: 'AAPL',
            action: 'buy',
            confidence: 0.85,
            createdAt: '2026-01-07T11:00:00Z',
          } as Recommendation,
        ],
        instruments: ['AAPL', 'MSFT'],
        config: {
          runner: 'stock-predictor',
          instruments: ['AAPL', 'MSFT'],
          riskProfile: 'moderate',
        },
        toolsStatus: [
          {
            name: 'yahoo-finance',
            status: 'active',
            lastRun: '2026-01-07T11:00:00Z',
            claimsCount: 10,
          },
        ],
      };

      store.setCurrentState(currentState);

      expect(store.agentStatus).toEqual(currentState.agentStatus);
      expect(store.latestDatapoint).toEqual(currentState.latestDatapoint);
      expect(store.activeRecommendations).toEqual(currentState.activeRecommendations);
      expect(store.instruments).toEqual(currentState.instruments);
      expect(store.config).toEqual(currentState.config);
      expect(store.toolsStatus).toEqual(currentState.toolsStatus);
    });
  });

  describe('Derived State Computed Properties', () => {
    it('should compute isRunning correctly', () => {
      const store = usePredictionAgentStore();

      expect(store.isRunning).toBe(false);

      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 0, errorCount: 0, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      expect(store.isRunning).toBe(true);
    });

    it('should compute isPaused correctly', () => {
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'paused',
        stats: { pollCount: 0, errorCount: 0, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      expect(store.isPaused).toBe(true);
      expect(store.isRunning).toBe(false);
    });

    it('should compute isStopped correctly', () => {
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'stopped',
        stats: { pollCount: 0, errorCount: 0, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      expect(store.isStopped).toBe(true);
    });

    it('should compute hasError correctly', () => {
      const store = usePredictionAgentStore();

      store.setAgentStatus({
        state: 'error',
        stats: { pollCount: 0, errorCount: 1, recommendationCount: 0, avgPollDurationMs: 0 },
      });

      expect(store.hasError).toBe(true);
    });
  });

  describe('Recommendations Mutations', () => {
    it('should set active recommendations', () => {
      const store = usePredictionAgentStore();

      const recommendations: Recommendation[] = [
        {
          id: 'rec-1',
          instrument: 'AAPL',
          action: 'buy',
          confidence: 0.85,
          createdAt: '2026-01-07T11:00:00Z',
        } as Recommendation,
        {
          id: 'rec-2',
          instrument: 'MSFT',
          action: 'sell',
          confidence: 0.75,
          createdAt: '2026-01-07T11:00:00Z',
        } as Recommendation,
      ];

      store.setActiveRecommendations(recommendations);

      expect(store.activeRecommendations).toHaveLength(2);
    });

    it('should add new recommendation', () => {
      const store = usePredictionAgentStore();

      const recommendation: Recommendation = {
        id: 'rec-1',
        instrument: 'AAPL',
        action: 'buy',
        confidence: 0.85,
        createdAt: '2026-01-07T11:00:00Z',
      } as Recommendation;

      store.addRecommendation(recommendation);

      expect(store.activeRecommendations).toHaveLength(1);
      expect(store.activeRecommendations[0]).toEqual(recommendation);
    });

    it('should update existing recommendation', () => {
      const store = usePredictionAgentStore();

      store.addRecommendation({
        id: 'rec-1',
        instrument: 'AAPL',
        action: 'buy',
        confidence: 0.85,
        createdAt: '2026-01-07T11:00:00Z',
      } as Recommendation);

      store.addRecommendation({
        id: 'rec-1',
        instrument: 'AAPL',
        action: 'buy',
        confidence: 0.90, // Updated confidence
        createdAt: '2026-01-07T11:00:00Z',
      } as Recommendation);

      expect(store.activeRecommendations).toHaveLength(1);
      expect(store.activeRecommendations[0].confidence).toBe(0.90);
    });

    it('should remove recommendation', () => {
      const store = usePredictionAgentStore();

      store.setActiveRecommendations([
        { id: 'rec-1', instrument: 'AAPL' } as Recommendation,
        { id: 'rec-2', instrument: 'MSFT' } as Recommendation,
      ]);

      store.removeRecommendation('rec-1');

      expect(store.activeRecommendations).toHaveLength(1);
      expect(store.activeRecommendations[0].id).toBe('rec-2');
    });

    it('should get recommendation by ID', () => {
      const store = usePredictionAgentStore();

      const rec: Recommendation = {
        id: 'rec-1',
        instrument: 'AAPL',
        action: 'buy',
        confidence: 0.85,
      } as Recommendation;

      store.setActiveRecommendations([rec]);

      expect(store.getRecommendationById('rec-1')).toEqual(rec);
      expect(store.getRecommendationById('non-existent')).toBeUndefined();
    });
  });

  describe('Instruments Mutations', () => {
    it('should set instruments', () => {
      const store = usePredictionAgentStore();

      store.setInstruments(['AAPL', 'MSFT', 'GOOGL']);

      expect(store.instruments).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    it('should add instrument', () => {
      const store = usePredictionAgentStore();

      store.setInstruments(['AAPL', 'MSFT']);
      store.addInstrument('GOOGL');

      expect(store.instruments).toEqual(['AAPL', 'MSFT', 'GOOGL']);
    });

    it('should not add duplicate instrument', () => {
      const store = usePredictionAgentStore();

      store.setInstruments(['AAPL', 'MSFT']);
      store.addInstrument('AAPL');

      expect(store.instruments).toHaveLength(2);
    });

    it('should remove instrument', () => {
      const store = usePredictionAgentStore();

      store.setInstruments(['AAPL', 'MSFT', 'GOOGL']);
      store.removeInstrument('MSFT');

      expect(store.instruments).toEqual(['AAPL', 'GOOGL']);
    });
  });

  describe('Configuration Mutations', () => {
    it('should set config', () => {
      const store = usePredictionAgentStore();

      const config: PredictionRunnerConfig = {
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 300000,
      };

      store.setConfig(config);

      expect(store.config).toEqual(config);
    });

    it('should update config partially', () => {
      const store = usePredictionAgentStore();

      store.setConfig({
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 300000,
      });

      store.updateConfig({ riskProfile: 'aggressive' });

      expect(store.config?.riskProfile).toBe('aggressive');
      expect(store.config?.pollIntervalMs).toBe(300000); // Unchanged
    });

    it('should not update config if not set', () => {
      const store = usePredictionAgentStore();

      store.updateConfig({ riskProfile: 'aggressive' });

      expect(store.config).toBeNull();
    });
  });

  describe('Tools Status Mutations', () => {
    it('should set tools status', () => {
      const store = usePredictionAgentStore();

      const toolsStatus: ToolStatus[] = [
        { name: 'yahoo-finance', status: 'active', lastRun: '2026-01-07T11:00:00Z', claimsCount: 10 },
        { name: 'bloomberg-news', status: 'active', lastRun: '2026-01-07T11:00:00Z', claimsCount: 5 },
      ];

      store.setToolsStatus(toolsStatus);

      expect(store.toolsStatus).toHaveLength(2);
    });

    it('should update individual tool status', () => {
      const store = usePredictionAgentStore();

      store.setToolsStatus([
        { name: 'yahoo-finance', status: 'active', claimsCount: 10 },
      ]);

      store.updateToolStatus('yahoo-finance', { status: 'error', claimsCount: 15 });

      expect(store.toolsStatus[0].status).toBe('error');
      expect(store.toolsStatus[0].claimsCount).toBe(15);
    });

    it('should compute active tools count', () => {
      const store = usePredictionAgentStore();

      store.setToolsStatus([
        { name: 'tool-1', status: 'active', claimsCount: 10 },
        { name: 'tool-2', status: 'error', claimsCount: 0 },
        { name: 'tool-3', status: 'active', claimsCount: 5 },
      ]);

      expect(store.activToolsCount).toBe(2);
    });

    it('should compute error tools count', () => {
      const store = usePredictionAgentStore();

      store.setToolsStatus([
        { name: 'tool-1', status: 'active', claimsCount: 10 },
        { name: 'tool-2', status: 'error', claimsCount: 0 },
        { name: 'tool-3', status: 'error', claimsCount: 0 },
      ]);

      expect(store.errorToolsCount).toBe(2);
    });

    it('should compute total claims count', () => {
      const store = usePredictionAgentStore();

      store.setToolsStatus([
        { name: 'tool-1', status: 'active', claimsCount: 10 },
        { name: 'tool-2', status: 'active', claimsCount: 15 },
        { name: 'tool-3', status: 'active', claimsCount: 25 },
      ]);

      expect(store.totalClaimsCount).toBe(50);
    });

    it('should get tool status by name', () => {
      const store = usePredictionAgentStore();

      const tool: ToolStatus = { name: 'yahoo-finance', status: 'active', claimsCount: 10 };
      store.setToolsStatus([tool]);

      expect(store.getToolStatusByName('yahoo-finance')).toEqual(tool);
      expect(store.getToolStatusByName('non-existent')).toBeUndefined();
    });
  });

  describe('History Mutations', () => {
    it('should set history', () => {
      const store = usePredictionAgentStore();

      const history: PredictionHistory[] = [
        { id: 'pred-1', instrument: 'AAPL', timestamp: '2026-01-07T10:00:00Z' } as PredictionHistory,
        { id: 'pred-2', instrument: 'MSFT', timestamp: '2026-01-07T09:00:00Z' } as PredictionHistory,
      ];

      store.setHistory(history);

      expect(store.history).toHaveLength(2);
    });

    it('should add new history item at beginning', () => {
      const store = usePredictionAgentStore();

      store.setHistory([
        { id: 'pred-1', instrument: 'AAPL', timestamp: '2026-01-07T10:00:00Z' } as PredictionHistory,
      ]);

      store.addHistory({
        id: 'pred-2',
        instrument: 'MSFT',
        timestamp: '2026-01-07T11:00:00Z',
      } as PredictionHistory);

      expect(store.history).toHaveLength(2);
      expect(store.history[0].id).toBe('pred-2'); // New item first
    });

    it('should update existing history item', () => {
      const store = usePredictionAgentStore();

      store.setHistory([
        {
          id: 'pred-1',
          instrument: 'AAPL',
          timestamp: '2026-01-07T10:00:00Z',
          outcome: { status: 'pending' },
        } as PredictionHistory,
      ]);

      store.addHistory({
        id: 'pred-1',
        instrument: 'AAPL',
        timestamp: '2026-01-07T10:00:00Z',
        outcome: { status: 'correct' },
      } as PredictionHistory);

      expect(store.history).toHaveLength(1);
      expect(store.history[0].outcome?.status).toBe('correct');
    });

    it('should update prediction outcome', () => {
      const store = usePredictionAgentStore();

      store.setHistory([
        {
          id: 'pred-1',
          instrument: 'AAPL',
          timestamp: '2026-01-07T10:00:00Z',
          outcome: { status: 'pending' },
        } as PredictionHistory,
      ]);

      store.updatePredictionOutcome('pred-1', { status: 'correct', actualValue: 180 });

      expect(store.history[0].outcome).toEqual({ status: 'correct', actualValue: 180 });
    });

    it('should get prediction by ID', () => {
      const store = usePredictionAgentStore();

      const pred: PredictionHistory = {
        id: 'pred-1',
        instrument: 'AAPL',
        timestamp: '2026-01-07T10:00:00Z',
      } as PredictionHistory;

      store.setHistory([pred]);

      expect(store.getPredictionById('pred-1')).toEqual(pred);
      expect(store.getPredictionById('non-existent')).toBeUndefined();
    });
  });

  describe('History Filtering', () => {
    const mockHistory: PredictionHistory[] = [
      {
        id: 'pred-1',
        instrument: 'AAPL',
        timestamp: '2026-01-07T10:00:00Z',
        outcome: { status: 'correct' },
      } as PredictionHistory,
      {
        id: 'pred-2',
        instrument: 'MSFT',
        timestamp: '2026-01-06T10:00:00Z',
        outcome: { status: 'incorrect' },
      } as PredictionHistory,
      {
        id: 'pred-3',
        instrument: 'AAPL',
        timestamp: '2026-01-05T10:00:00Z',
        outcome: { status: 'pending' },
      } as PredictionHistory,
    ];

    it('should filter by instrument', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistory);

      store.setHistoryFilters({ instrument: 'AAPL' });

      expect(store.filteredHistory).toHaveLength(2);
      expect(store.filteredHistory.every((h) => h.instrument === 'AAPL')).toBe(true);
    });

    it('should filter by outcome status', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistory);

      store.setHistoryFilters({ outcome: 'correct' });

      expect(store.filteredHistory).toHaveLength(1);
      expect(store.filteredHistory[0].outcome?.status).toBe('correct');
    });

    it('should filter by date range', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistory);

      store.setHistoryFilters({
        startDate: '2026-01-06T00:00:00Z',
        endDate: '2026-01-07T23:59:59Z',
      });

      expect(store.filteredHistory).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistory);

      store.setHistoryFilters({
        instrument: 'AAPL',
        outcome: 'correct',
      });

      expect(store.filteredHistory).toHaveLength(1);
      expect(store.filteredHistory[0].instrument).toBe('AAPL');
      expect(store.filteredHistory[0].outcome?.status).toBe('correct');
    });

    it('should clear history filters', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistory);

      store.setHistoryFilters({ instrument: 'AAPL', outcome: 'correct' });
      store.clearHistoryFilters();

      expect(store.historyFilters.instrument).toBeNull();
      expect(store.historyFilters.outcome).toBe('all');
    });
  });

  describe('History Pagination', () => {
    it('should set history page', () => {
      const store = usePredictionAgentStore();

      store.setHistoryPage(3);

      expect(store.historyPage).toBe(3);
    });

    it('should set history page size', () => {
      const store = usePredictionAgentStore();

      store.setHistoryPageSize(50);

      expect(store.historyPageSize).toBe(50);
    });

    it('should set history total', () => {
      const store = usePredictionAgentStore();

      store.setHistoryTotal(150);

      expect(store.historyTotal).toBe(150);
    });

    it('should compute history pages correctly', () => {
      const store = usePredictionAgentStore();

      store.setHistoryTotal(55);
      store.setHistoryPageSize(20);

      expect(store.historyPages).toBe(3); // ceil(55/20) = 3
    });
  });

  describe('Outcome Statistics', () => {
    const mockHistoryWithOutcomes: PredictionHistory[] = [
      { id: 'pred-1', outcome: { status: 'correct' } } as PredictionHistory,
      { id: 'pred-2', outcome: { status: 'correct' } } as PredictionHistory,
      { id: 'pred-3', outcome: { status: 'incorrect' } } as PredictionHistory,
      { id: 'pred-4', outcome: { status: 'pending' } } as PredictionHistory,
      { id: 'pred-5', outcome: { status: 'pending' } } as PredictionHistory,
    ];

    it('should compute pending outcomes', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistoryWithOutcomes);

      expect(store.pendingOutcomes).toHaveLength(2);
    });

    it('should compute correct predictions', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistoryWithOutcomes);

      expect(store.correctPredictions).toHaveLength(2);
    });

    it('should compute incorrect predictions', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistoryWithOutcomes);

      expect(store.incorrectPredictions).toHaveLength(1);
    });

    it('should compute accuracy rate', () => {
      const store = usePredictionAgentStore();
      store.setHistory(mockHistoryWithOutcomes);

      // 2 correct / (2 correct + 1 incorrect) = 66.67%
      expect(store.accuracyRate).toBeCloseTo(66.67, 1);
    });

    it('should return 0 accuracy rate when no resolved predictions', () => {
      const store = usePredictionAgentStore();
      store.setHistory([{ id: 'pred-1', outcome: { status: 'pending' } } as PredictionHistory]);

      expect(store.accuracyRate).toBe(0);
    });
  });

  describe('Loading and Error States', () => {
    it('should set loading state', () => {
      const store = usePredictionAgentStore();

      store.setLoading(true);
      expect(store.isLoading).toBe(true);

      store.setLoading(false);
      expect(store.isLoading).toBe(false);
    });

    it('should set executing state', () => {
      const store = usePredictionAgentStore();

      store.setExecuting(true);
      expect(store.isExecuting).toBe(true);

      store.setExecuting(false);
      expect(store.isExecuting).toBe(false);
    });

    it('should set error message', () => {
      const store = usePredictionAgentStore();

      store.setError('Something went wrong');
      expect(store.error).toBe('Something went wrong');
    });

    it('should clear error', () => {
      const store = usePredictionAgentStore();

      store.setError('Error message');
      store.clearError();

      expect(store.error).toBeNull();
    });
  });

  describe('Reset State', () => {
    it('should reset all state to initial values', () => {
      const store = usePredictionAgentStore();

      // Set various state
      store.setAgentId('agent-123');
      store.setAgentStatus({
        state: 'running',
        stats: { pollCount: 10, errorCount: 0, recommendationCount: 5, avgPollDurationMs: 2000 },
      });
      store.setInstruments(['AAPL', 'MSFT']);
      store.setHistory([{ id: 'pred-1', instrument: 'AAPL' } as PredictionHistory]);
      store.setError('Some error');

      // Reset
      store.resetState();

      // Verify all reset
      expect(store.agentId).toBeNull();
      expect(store.agentStatus).toBeNull();
      expect(store.instruments).toEqual([]);
      expect(store.history).toEqual([]);
      expect(store.error).toBeNull();
      expect(store.historyPage).toBe(1);
    });
  });
});
