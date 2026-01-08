/**
 * Prediction Agent Store - State + Synchronous Mutations Only
 *
 * Architecture: Stores contain ONLY state and synchronous mutations
 * For async operations, use predictionAgentService
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  AgentStatus,
  CurrentAgentState,
  Datapoint,
  PredictionHistory,
  PredictionRunnerConfig,
  Recommendation,
  ToolStatus,
  OutcomeStatus,
} from '@/types/prediction-agent';

interface PredictionAgentState {
  // Current agent state
  agentId: string | null;
  agentStatus: AgentStatus | null;
  latestDatapoint: Datapoint | null;
  activeRecommendations: Recommendation[];
  instruments: string[];
  config: PredictionRunnerConfig | null;
  toolsStatus: ToolStatus[];

  // History
  history: PredictionHistory[];
  historyFilters: {
    instrument: string | null;
    outcome: OutcomeStatus | 'all';
    startDate: string | null;
    endDate: string | null;
  };
  historyPage: number;
  historyPageSize: number;
  historyTotal: number;

  // Loading/error state
  isLoading: boolean;
  isExecuting: boolean;
  error: string | null;
}

export const usePredictionAgentStore = defineStore('predictionAgent', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = ref<PredictionAgentState>({
    agentId: null,
    agentStatus: null,
    latestDatapoint: null,
    activeRecommendations: [],
    instruments: [],
    config: null,
    toolsStatus: [],
    history: [],
    historyFilters: {
      instrument: null,
      outcome: 'all',
      startDate: null,
      endDate: null,
    },
    historyPage: 1,
    historyPageSize: 20,
    historyTotal: 0,
    isLoading: false,
    isExecuting: false,
    error: null,
  });

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const agentId = computed(() => state.value.agentId);
  const agentStatus = computed(() => state.value.agentStatus);
  const latestDatapoint = computed(() => state.value.latestDatapoint);
  const activeRecommendations = computed(() => state.value.activeRecommendations);
  const instruments = computed(() => state.value.instruments);
  const config = computed(() => state.value.config);
  const toolsStatus = computed(() => state.value.toolsStatus);
  const history = computed(() => state.value.history);
  const historyFilters = computed(() => state.value.historyFilters);
  const historyPage = computed(() => state.value.historyPage);
  const historyPageSize = computed(() => state.value.historyPageSize);
  const historyTotal = computed(() => state.value.historyTotal);
  const isLoading = computed(() => state.value.isLoading);
  const isExecuting = computed(() => state.value.isExecuting);
  const error = computed(() => state.value.error);

  // Derived state
  const isRunning = computed(() => state.value.agentStatus?.state === 'running');
  const isPaused = computed(() => state.value.agentStatus?.state === 'paused');
  const isStopped = computed(() => state.value.agentStatus?.state === 'stopped');
  const hasError = computed(() => state.value.agentStatus?.state === 'error');

  const activToolsCount = computed(() =>
    state.value.toolsStatus.filter((t) => t.status === 'active').length
  );

  const errorToolsCount = computed(() =>
    state.value.toolsStatus.filter((t) => t.status === 'error').length
  );

  const totalClaimsCount = computed(() =>
    state.value.toolsStatus.reduce((sum, t) => sum + t.claimsCount, 0)
  );

  const pendingOutcomes = computed(() =>
    state.value.history.filter((h) => h.outcome?.status === 'pending')
  );

  const correctPredictions = computed(() =>
    state.value.history.filter((h) => h.outcome?.status === 'correct')
  );

  const incorrectPredictions = computed(() =>
    state.value.history.filter((h) => h.outcome?.status === 'incorrect')
  );

  const accuracyRate = computed(() => {
    const total = correctPredictions.value.length + incorrectPredictions.value.length;
    if (total === 0) return 0;
    return (correctPredictions.value.length / total) * 100;
  });

  const filteredHistory = computed(() => {
    let filtered = state.value.history;

    if (state.value.historyFilters.instrument) {
      filtered = filtered.filter(
        (h) => h.instrument === state.value.historyFilters.instrument
      );
    }

    if (state.value.historyFilters.outcome !== 'all') {
      filtered = filtered.filter(
        (h) => h.outcome?.status === state.value.historyFilters.outcome
      );
    }

    if (state.value.historyFilters.startDate) {
      filtered = filtered.filter(
        (h) => h.timestamp >= state.value.historyFilters.startDate!
      );
    }

    if (state.value.historyFilters.endDate) {
      filtered = filtered.filter(
        (h) => h.timestamp <= state.value.historyFilters.endDate!
      );
    }

    return filtered;
  });

  const historyPages = computed(() =>
    Math.ceil(state.value.historyTotal / state.value.historyPageSize)
  );

  // ============================================================================
  // GETTERS (Functions)
  // ============================================================================

  function getRecommendationById(id: string): Recommendation | undefined {
    return state.value.activeRecommendations.find((r) => r.id === id);
  }

  function getToolStatusByName(name: string): ToolStatus | undefined {
    return state.value.toolsStatus.find((t) => t.name === name);
  }

  function getPredictionById(id: string): PredictionHistory | undefined {
    return state.value.history.find((h) => h.id === id);
  }

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    state.value.isLoading = loading;
  }

  function setExecuting(executing: boolean) {
    state.value.isExecuting = executing;
  }

  function setError(error: string | null) {
    state.value.error = error;
  }

  function clearError() {
    state.value.error = null;
  }

  function setAgentId(agentId: string | null) {
    state.value.agentId = agentId;
  }

  function setCurrentState(currentState: CurrentAgentState) {
    state.value.agentStatus = currentState.agentStatus;
    state.value.latestDatapoint = currentState.latestDatapoint || null;
    state.value.activeRecommendations = currentState.activeRecommendations;
    state.value.instruments = currentState.instruments;
    state.value.config = currentState.config;
    state.value.toolsStatus = currentState.toolsStatus;
  }

  function setAgentStatus(status: AgentStatus) {
    state.value.agentStatus = status;
  }

  function setLatestDatapoint(datapoint: Datapoint | null) {
    state.value.latestDatapoint = datapoint;
  }

  function setActiveRecommendations(recommendations: Recommendation[]) {
    state.value.activeRecommendations = recommendations;
  }

  function addRecommendation(recommendation: Recommendation) {
    const existing = state.value.activeRecommendations.findIndex(
      (r) => r.id === recommendation.id
    );
    if (existing >= 0) {
      state.value.activeRecommendations[existing] = recommendation;
    } else {
      state.value.activeRecommendations.push(recommendation);
    }
  }

  function removeRecommendation(recommendationId: string) {
    state.value.activeRecommendations = state.value.activeRecommendations.filter(
      (r) => r.id !== recommendationId
    );
  }

  function setInstruments(instruments: string[]) {
    state.value.instruments = instruments;
  }

  function addInstrument(instrument: string) {
    if (!state.value.instruments.includes(instrument)) {
      state.value.instruments.push(instrument);
    }
  }

  function removeInstrument(instrument: string) {
    state.value.instruments = state.value.instruments.filter((i) => i !== instrument);
  }

  function setConfig(config: PredictionRunnerConfig) {
    state.value.config = config;
  }

  function updateConfig(updates: Partial<PredictionRunnerConfig>) {
    if (state.value.config) {
      state.value.config = {
        ...state.value.config,
        ...updates,
      };
    }
  }

  function setToolsStatus(toolsStatus: ToolStatus[]) {
    state.value.toolsStatus = toolsStatus;
  }

  function updateToolStatus(name: string, updates: Partial<ToolStatus>) {
    const index = state.value.toolsStatus.findIndex((t) => t.name === name);
    if (index >= 0) {
      state.value.toolsStatus[index] = {
        ...state.value.toolsStatus[index],
        ...updates,
      };
    }
  }

  function setHistory(history: PredictionHistory[]) {
    state.value.history = history;
  }

  function addHistory(prediction: PredictionHistory) {
    const existing = state.value.history.findIndex((h) => h.id === prediction.id);
    if (existing >= 0) {
      state.value.history[existing] = prediction;
    } else {
      state.value.history.unshift(prediction);
    }
  }

  function updatePredictionOutcome(
    predictionId: string,
    outcome: PredictionHistory['outcome']
  ) {
    const index = state.value.history.findIndex((h) => h.id === predictionId);
    if (index >= 0) {
      state.value.history[index] = {
        ...state.value.history[index],
        outcome,
      };
    }
  }

  function setHistoryFilters(filters: Partial<PredictionAgentState['historyFilters']>) {
    state.value.historyFilters = {
      ...state.value.historyFilters,
      ...filters,
    };
  }

  function clearHistoryFilters() {
    state.value.historyFilters = {
      instrument: null,
      outcome: 'all',
      startDate: null,
      endDate: null,
    };
  }

  function setHistoryPage(page: number) {
    state.value.historyPage = page;
  }

  function setHistoryPageSize(pageSize: number) {
    state.value.historyPageSize = pageSize;
  }

  function setHistoryTotal(total: number) {
    state.value.historyTotal = total;
  }

  function resetState() {
    state.value.agentId = null;
    state.value.agentStatus = null;
    state.value.latestDatapoint = null;
    state.value.activeRecommendations = [];
    state.value.instruments = [];
    state.value.config = null;
    state.value.toolsStatus = [];
    state.value.history = [];
    state.value.historyFilters = {
      instrument: null,
      outcome: 'all',
      startDate: null,
      endDate: null,
    };
    state.value.historyPage = 1;
    state.value.historyTotal = 0;
    state.value.error = null;
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    agentId,
    agentStatus,
    latestDatapoint,
    activeRecommendations,
    instruments,
    config,
    toolsStatus,
    history,
    historyFilters,
    historyPage,
    historyPageSize,
    historyTotal,
    isLoading,
    isExecuting,
    error,

    // Derived state
    isRunning,
    isPaused,
    isStopped,
    hasError,
    activToolsCount,
    errorToolsCount,
    totalClaimsCount,
    pendingOutcomes,
    correctPredictions,
    incorrectPredictions,
    accuracyRate,
    filteredHistory,
    historyPages,

    // Getters (functions)
    getRecommendationById,
    getToolStatusByName,
    getPredictionById,

    // Mutations
    setLoading,
    setExecuting,
    setError,
    clearError,
    setAgentId,
    setCurrentState,
    setAgentStatus,
    setLatestDatapoint,
    setActiveRecommendations,
    addRecommendation,
    removeRecommendation,
    setInstruments,
    addInstrument,
    removeInstrument,
    setConfig,
    updateConfig,
    setToolsStatus,
    updateToolStatus,
    setHistory,
    addHistory,
    updatePredictionOutcome,
    setHistoryFilters,
    clearHistoryFilters,
    setHistoryPage,
    setHistoryPageSize,
    setHistoryTotal,
    resetState,
  };
});
