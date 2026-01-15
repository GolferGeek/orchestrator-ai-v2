/**
 * Finance Store - State + Synchronous Mutations Only
 *
 * Use financeService for API calls.
 * This store holds state for universes, recommendations, and outcomes.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  Universe,
  UniverseVersion,
  Recommendation,
  RecommendationWithOutcome,
  EvaluationResult,
} from '@/services/financeService';

export interface FinanceStats {
  totalRecommendations: number;
  evaluatedCount: number;
  winRate: number;
  averageReturn: number;
  byTimingWindow: Record<string, { count: number; winRate: number }>;
  byAction: Record<string, { count: number; winRate: number }>;
}

export const useFinanceStore = defineStore('finance', () => {
  // ==================== State ====================

  // Universes
  const universes = ref<Universe[]>([]);
  const currentUniverse = ref<Universe | null>(null);
  const universesLoading = ref(false);
  const universesError = ref<string | null>(null);

  // Universe Versions
  const versions = ref<UniverseVersion[]>([]);
  const activeVersion = ref<UniverseVersion | null>(null);
  const versionsLoading = ref(false);

  // Recommendations
  const recommendations = ref<Recommendation[]>([]);
  const recommendationsWithOutcomes = ref<RecommendationWithOutcome[]>([]);
  const recommendationsLoading = ref(false);
  const recommendationsError = ref<string | null>(null);

  // Current Run
  const currentRunId = ref<string | null>(null);
  const runInProgress = ref(false);
  const runProgress = ref<{ step: string; progress: number } | null>(null);

  // Evaluation
  const lastEvaluationResult = ref<EvaluationResult | null>(null);
  const evaluationLoading = ref(false);

  // Statistics
  const stats = ref<FinanceStats | null>(null);
  const statsLoading = ref(false);

  // Learning Context
  const learningContext = ref<string | null>(null);

  // ==================== Computed ====================

  const hasUniverses = computed(() => universes.value.length > 0);

  const activeVersionInstruments = computed(() =>
    activeVersion.value?.config.instruments ?? [],
  );

  const activeVersionInstrumentCount = computed(() =>
    activeVersionInstruments.value.length,
  );

  const pendingRecommendations = computed(() =>
    recommendationsWithOutcomes.value.filter((r) => !r.outcome),
  );

  const evaluatedRecommendations = computed(() =>
    recommendationsWithOutcomes.value.filter((r) => r.outcome),
  );

  const winningRecommendations = computed(() =>
    evaluatedRecommendations.value.filter((r) => r.outcome?.winLoss === 'win'),
  );

  const losingRecommendations = computed(() =>
    evaluatedRecommendations.value.filter((r) => r.outcome?.winLoss === 'loss'),
  );

  const overallWinRate = computed(() => {
    const evaluated = evaluatedRecommendations.value.length;
    if (evaluated === 0) return 0;
    return (winningRecommendations.value.length / evaluated) * 100;
  });

  const recommendationsByTimingWindow = computed(() => {
    const grouped: Record<string, RecommendationWithOutcome[]> = {};
    for (const rec of recommendationsWithOutcomes.value) {
      if (!grouped[rec.timingWindow]) {
        grouped[rec.timingWindow] = [];
      }
      grouped[rec.timingWindow].push(rec);
    }
    return grouped;
  });

  const recommendationsByAction = computed(() => {
    const grouped: Record<string, RecommendationWithOutcome[]> = {};
    for (const rec of recommendationsWithOutcomes.value) {
      if (!grouped[rec.action]) {
        grouped[rec.action] = [];
      }
      grouped[rec.action].push(rec);
    }
    return grouped;
  });

  // ==================== Mutations ====================

  // Universes
  const setUniverses = (data: Universe[]) => {
    universes.value = data;
  };

  const setCurrentUniverse = (universe: Universe | null) => {
    currentUniverse.value = universe;
  };

  const addUniverse = (universe: Universe) => {
    universes.value.push(universe);
  };

  const updateUniverseInList = (updated: Universe) => {
    const index = universes.value.findIndex((u) => u.id === updated.id);
    if (index >= 0) {
      universes.value[index] = updated;
    }
  };

  const removeUniverse = (universeId: string) => {
    universes.value = universes.value.filter((u) => u.id !== universeId);
    if (currentUniverse.value?.id === universeId) {
      currentUniverse.value = null;
    }
  };

  const setUniversesLoading = (loading: boolean) => {
    universesLoading.value = loading;
  };

  const setUniversesError = (error: string | null) => {
    universesError.value = error;
  };

  // Versions
  const setVersions = (data: UniverseVersion[]) => {
    versions.value = data;
    // Set active version
    activeVersion.value = data.find((v) => v.isActive) || null;
  };

  const addVersion = (version: UniverseVersion) => {
    versions.value.push(version);
    if (version.isActive) {
      // Deactivate other versions in store
      versions.value.forEach((v) => {
        if (v.id !== version.id) {
          v.isActive = false;
        }
      });
      activeVersion.value = version;
    }
  };

  const setActiveVersion = (versionId: string) => {
    versions.value.forEach((v) => {
      v.isActive = v.id === versionId;
    });
    activeVersion.value = versions.value.find((v) => v.id === versionId) || null;
  };

  const setVersionsLoading = (loading: boolean) => {
    versionsLoading.value = loading;
  };

  // Recommendations
  const setRecommendations = (data: Recommendation[]) => {
    recommendations.value = data;
  };

  const setRecommendationsWithOutcomes = (data: RecommendationWithOutcome[]) => {
    recommendationsWithOutcomes.value = data;
  };

  const setRecommendationsLoading = (loading: boolean) => {
    recommendationsLoading.value = loading;
  };

  const setRecommendationsError = (error: string | null) => {
    recommendationsError.value = error;
  };

  // Run
  const setCurrentRunId = (runId: string | null) => {
    currentRunId.value = runId;
  };

  const setRunInProgress = (inProgress: boolean) => {
    runInProgress.value = inProgress;
  };

  const setRunProgress = (progress: { step: string; progress: number } | null) => {
    runProgress.value = progress;
  };

  // Evaluation
  const setLastEvaluationResult = (result: EvaluationResult | null) => {
    lastEvaluationResult.value = result;
  };

  const setEvaluationLoading = (loading: boolean) => {
    evaluationLoading.value = loading;
  };

  // Statistics
  const setStats = (data: FinanceStats | null) => {
    stats.value = data;
  };

  const setStatsLoading = (loading: boolean) => {
    statsLoading.value = loading;
  };

  // Learning Context
  const setLearningContext = (context: string | null) => {
    learningContext.value = context;
  };

  // ==================== Actions ====================

  const reset = () => {
    universes.value = [];
    currentUniverse.value = null;
    universesLoading.value = false;
    universesError.value = null;
    versions.value = [];
    activeVersion.value = null;
    versionsLoading.value = false;
    recommendations.value = [];
    recommendationsWithOutcomes.value = [];
    recommendationsLoading.value = false;
    recommendationsError.value = null;
    currentRunId.value = null;
    runInProgress.value = false;
    runProgress.value = null;
    lastEvaluationResult.value = null;
    evaluationLoading.value = false;
    stats.value = null;
    statsLoading.value = false;
    learningContext.value = null;
  };

  return {
    // State
    universes,
    currentUniverse,
    universesLoading,
    universesError,
    versions,
    activeVersion,
    versionsLoading,
    recommendations,
    recommendationsWithOutcomes,
    recommendationsLoading,
    recommendationsError,
    currentRunId,
    runInProgress,
    runProgress,
    lastEvaluationResult,
    evaluationLoading,
    stats,
    statsLoading,
    learningContext,

    // Computed
    hasUniverses,
    activeVersionInstruments,
    activeVersionInstrumentCount,
    pendingRecommendations,
    evaluatedRecommendations,
    winningRecommendations,
    losingRecommendations,
    overallWinRate,
    recommendationsByTimingWindow,
    recommendationsByAction,

    // Mutations
    setUniverses,
    setCurrentUniverse,
    addUniverse,
    updateUniverseInList,
    removeUniverse,
    setUniversesLoading,
    setUniversesError,
    setVersions,
    addVersion,
    setActiveVersion,
    setVersionsLoading,
    setRecommendations,
    setRecommendationsWithOutcomes,
    setRecommendationsLoading,
    setRecommendationsError,
    setCurrentRunId,
    setRunInProgress,
    setRunProgress,
    setLastEvaluationResult,
    setEvaluationLoading,
    setStats,
    setStatsLoading,
    setLearningContext,
    reset,
  };
});
