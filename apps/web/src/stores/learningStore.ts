/**
 * Learning Store - State + Synchronous Mutations Only
 *
 * Manages state for Prediction Learnings (Phase 11).
 * For async operations, use predictionDashboardService.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ============================================================================
// TYPES
// ============================================================================

export type LearningScopeLevel = 'runner' | 'domain' | 'universe' | 'target';
export type LearningType = 'rule' | 'pattern' | 'weight_adjustment' | 'threshold' | 'avoid';
export type LearningSourceType = 'human' | 'ai_suggested' | 'ai_approved';
export type LearningStatus = 'active' | 'superseded' | 'inactive';

export interface PredictionLearning {
  id: string;
  title: string;
  scopeLevel: LearningScopeLevel;
  domain: string | null;
  universeId: string | null;
  targetId: string | null;
  analystId: string | null;
  learningType: LearningType;
  content: string;
  sourceType: LearningSourceType;
  status: LearningStatus;
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningQueueItem {
  id: string;
  suggestedTitle: string;
  suggestedContent: string;
  suggestedLearningType: LearningType;
  suggestedScopeLevel: LearningScopeLevel;
  suggestedDomain: string | null;
  suggestedUniverseId: string | null;
  suggestedTargetId: string | null;
  suggestedAnalystId: string | null;
  sourceEvaluationId: string | null;
  sourceMissedOpportunityId: string | null;
  confidence: number;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  finalLearningId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

interface LearningFilters {
  scopeLevel: LearningScopeLevel | null;
  learningType: LearningType | null;
  sourceType: LearningSourceType | null;
  status: LearningStatus | null;
  universeId: string | null;
  targetId: string | null;
  analystId: string | null;
}

interface LearningQueueFilters {
  status: 'pending' | 'approved' | 'rejected' | 'modified' | null;
  universeId: string | null;
  targetId: string | null;
}

interface LearningState {
  learnings: PredictionLearning[];
  learningQueue: LearningQueueItem[];
  selectedLearningId: string | null;
  selectedQueueItemId: string | null;
  filters: LearningFilters;
  queueFilters: LearningQueueFilters;
  isLoading: boolean;
  isLoadingQueue: boolean;
  error: string | null;
}

export const useLearningStore = defineStore('learning', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = ref<LearningState>({
    learnings: [],
    learningQueue: [],
    selectedLearningId: null,
    selectedQueueItemId: null,
    filters: {
      scopeLevel: null,
      learningType: null,
      sourceType: null,
      status: null,
      universeId: null,
      targetId: null,
      analystId: null,
    },
    queueFilters: {
      status: null,
      universeId: null,
      targetId: null,
    },
    isLoading: false,
    isLoadingQueue: false,
    error: null,
  });

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const learnings = computed(() => state.value.learnings);
  const learningQueue = computed(() => state.value.learningQueue);
  const selectedLearningId = computed(() => state.value.selectedLearningId);
  const selectedQueueItemId = computed(() => state.value.selectedQueueItemId);
  const filters = computed(() => state.value.filters);
  const queueFilters = computed(() => state.value.queueFilters);
  const isLoading = computed(() => state.value.isLoading);
  const isLoadingQueue = computed(() => state.value.isLoadingQueue);
  const error = computed(() => state.value.error);

  const selectedLearning = computed(() => {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.find((l) => l.id === state.value.selectedLearningId);
  });

  const selectedQueueItem = computed(() => {
    const queue = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];
    return queue.find((q) => q.id === state.value.selectedQueueItemId);
  });

  const filteredLearnings = computed(() => {
    let result = Array.isArray(state.value.learnings) ? state.value.learnings : [];

    if (state.value.filters.scopeLevel) {
      result = result.filter((l) => l.scopeLevel === state.value.filters.scopeLevel);
    }

    if (state.value.filters.learningType) {
      result = result.filter((l) => l.learningType === state.value.filters.learningType);
    }

    if (state.value.filters.sourceType) {
      result = result.filter((l) => l.sourceType === state.value.filters.sourceType);
    }

    if (state.value.filters.status) {
      result = result.filter((l) => l.status === state.value.filters.status);
    }

    if (state.value.filters.universeId) {
      result = result.filter((l) => l.universeId === state.value.filters.universeId);
    }

    if (state.value.filters.targetId) {
      result = result.filter((l) => l.targetId === state.value.filters.targetId);
    }

    if (state.value.filters.analystId) {
      result = result.filter((l) => l.analystId === state.value.filters.analystId);
    }

    return result;
  });

  const filteredLearningQueue = computed(() => {
    let result = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];

    if (state.value.queueFilters.status) {
      result = result.filter((q) => q.status === state.value.queueFilters.status);
    }

    if (state.value.queueFilters.universeId) {
      result = result.filter((q) => q.suggestedUniverseId === state.value.queueFilters.universeId);
    }

    if (state.value.queueFilters.targetId) {
      result = result.filter((q) => q.suggestedTargetId === state.value.queueFilters.targetId);
    }

    return result;
  });

  const activeLearnings = computed(() => {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.filter((l) => l.status === 'active');
  });

  const pendingQueueItems = computed(() => {
    const queue = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];
    return queue.filter((q) => q.status === 'pending');
  });

  const learningsByType = computed(() => {
    const grouped: Record<LearningType, PredictionLearning[]> = {
      rule: [],
      pattern: [],
      weight_adjustment: [],
      threshold: [],
      avoid: [],
    };
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    for (const learning of learnings) {
      grouped[learning.learningType].push(learning);
    }
    return grouped;
  });

  const learningsByScopeLevel = computed(() => {
    const grouped: Record<LearningScopeLevel, PredictionLearning[]> = {
      runner: [],
      domain: [],
      universe: [],
      target: [],
    };
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    for (const learning of learnings) {
      grouped[learning.scopeLevel].push(learning);
    }
    return grouped;
  });

  // ============================================================================
  // GETTERS (Functions)
  // ============================================================================

  function getLearningById(id: string): PredictionLearning | undefined {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.find((l) => l.id === id);
  }

  function getQueueItemById(id: string): LearningQueueItem | undefined {
    const queue = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];
    return queue.find((q) => q.id === id);
  }

  function getLearningsForUniverse(universeId: string): PredictionLearning[] {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.filter((l) => l.universeId === universeId);
  }

  function getLearningsForTarget(targetId: string): PredictionLearning[] {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.filter((l) => l.targetId === targetId);
  }

  function getLearningsForAnalyst(analystId: string): PredictionLearning[] {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    return learnings.filter((l) => l.analystId === analystId);
  }

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    state.value.isLoading = loading;
  }

  function setLoadingQueue(loading: boolean) {
    state.value.isLoadingQueue = loading;
  }

  function setError(error: string | null) {
    state.value.error = error;
  }

  function clearError() {
    state.value.error = null;
  }

  // Learning mutations
  function setLearnings(learnings: PredictionLearning[]) {
    state.value.learnings = Array.isArray(learnings) ? learnings : [];
  }

  function addLearning(learning: PredictionLearning) {
    if (!Array.isArray(state.value.learnings)) {
      state.value.learnings = [];
    }
    const idx = state.value.learnings.findIndex((l) => l.id === learning.id);
    if (idx >= 0) {
      state.value.learnings[idx] = learning;
    } else {
      state.value.learnings.push(learning);
    }
  }

  function updateLearning(id: string, updates: Partial<PredictionLearning>) {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    const idx = learnings.findIndex((l) => l.id === id);
    if (idx >= 0) {
      state.value.learnings[idx] = { ...state.value.learnings[idx], ...updates };
    }
  }

  function removeLearning(id: string) {
    const learnings = Array.isArray(state.value.learnings) ? state.value.learnings : [];
    state.value.learnings = learnings.filter((l) => l.id !== id);
    if (state.value.selectedLearningId === id) {
      state.value.selectedLearningId = null;
    }
  }

  // Queue mutations
  function setLearningQueue(queue: LearningQueueItem[]) {
    state.value.learningQueue = Array.isArray(queue) ? queue : [];
  }

  function addQueueItem(item: LearningQueueItem) {
    if (!Array.isArray(state.value.learningQueue)) {
      state.value.learningQueue = [];
    }
    const idx = state.value.learningQueue.findIndex((q) => q.id === item.id);
    if (idx >= 0) {
      state.value.learningQueue[idx] = item;
    } else {
      state.value.learningQueue.push(item);
    }
  }

  function updateQueueItem(id: string, updates: Partial<LearningQueueItem>) {
    const queue = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];
    const idx = queue.findIndex((q) => q.id === id);
    if (idx >= 0) {
      state.value.learningQueue[idx] = { ...state.value.learningQueue[idx], ...updates };
    }
  }

  function removeQueueItem(id: string) {
    const queue = Array.isArray(state.value.learningQueue) ? state.value.learningQueue : [];
    state.value.learningQueue = queue.filter((q) => q.id !== id);
    if (state.value.selectedQueueItemId === id) {
      state.value.selectedQueueItemId = null;
    }
  }

  // Selection mutations
  function selectLearning(id: string | null) {
    state.value.selectedLearningId = id;
  }

  function selectQueueItem(id: string | null) {
    state.value.selectedQueueItemId = id;
  }

  // Filter mutations
  function setFilters(filters: Partial<LearningFilters>) {
    state.value.filters = { ...state.value.filters, ...filters };
  }

  function clearFilters() {
    state.value.filters = {
      scopeLevel: null,
      learningType: null,
      sourceType: null,
      status: null,
      universeId: null,
      targetId: null,
      analystId: null,
    };
  }

  function setQueueFilters(filters: Partial<LearningQueueFilters>) {
    state.value.queueFilters = { ...state.value.queueFilters, ...filters };
  }

  function clearQueueFilters() {
    state.value.queueFilters = {
      status: null,
      universeId: null,
      targetId: null,
    };
  }

  function resetState() {
    state.value = {
      learnings: [],
      learningQueue: [],
      selectedLearningId: null,
      selectedQueueItemId: null,
      filters: {
        scopeLevel: null,
        learningType: null,
        sourceType: null,
        status: null,
        universeId: null,
        targetId: null,
        analystId: null,
      },
      queueFilters: {
        status: null,
        universeId: null,
        targetId: null,
      },
      isLoading: false,
      isLoadingQueue: false,
      error: null,
    };
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    learnings,
    learningQueue,
    selectedLearningId,
    selectedQueueItemId,
    filters,
    queueFilters,
    isLoading,
    isLoadingQueue,
    error,

    // Derived state
    selectedLearning,
    selectedQueueItem,
    filteredLearnings,
    filteredLearningQueue,
    activeLearnings,
    pendingQueueItems,
    learningsByType,
    learningsByScopeLevel,

    // Getters (functions)
    getLearningById,
    getQueueItemById,
    getLearningsForUniverse,
    getLearningsForTarget,
    getLearningsForAnalyst,

    // Mutations
    setLoading,
    setLoadingQueue,
    setError,
    clearError,
    setLearnings,
    addLearning,
    updateLearning,
    removeLearning,
    setLearningQueue,
    addQueueItem,
    updateQueueItem,
    removeQueueItem,
    selectLearning,
    selectQueueItem,
    setFilters,
    clearFilters,
    setQueueFilters,
    clearQueueFilters,
    resetState,
  };
});
