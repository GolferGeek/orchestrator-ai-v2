/**
 * Risk Dashboard Store - State + Synchronous Mutations Only
 *
 * Architecture: Stores contain ONLY state and synchronous mutations
 * For async operations, use riskDashboardService
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  RiskScope,
  RiskSubject,
  RiskDimension,
  RiskAssessment,
  RiskCompositeScore,
  ActiveCompositeScoreView,
  RiskDebate,
  RiskAlert,
  UnacknowledgedAlertView,
  RiskLearning,
  PendingLearningView,
  RiskEvaluation,
  DashboardViewMode,
  DashboardFilters,
  DashboardStats,
  SelectedSubjectState,
  RadarChartDataPoint,
} from '@/types/risk-agent';

interface RiskDashboardState {
  // Current scope
  currentScope: RiskScope | null;
  scopes: RiskScope[];

  // Subjects and scores
  subjects: RiskSubject[];
  compositeScores: ActiveCompositeScoreView[];

  // Selected item detail
  selectedSubject: SelectedSubjectState | null;

  // Dimensions for the current scope
  dimensions: RiskDimension[];

  // Alerts
  alerts: UnacknowledgedAlertView[];

  // Learnings
  pendingLearnings: PendingLearningView[];

  // UI state
  viewMode: DashboardViewMode;
  filters: DashboardFilters;
  stats: DashboardStats;

  // Loading states
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
}

const initialStats: DashboardStats = {
  totalSubjects: 0,
  analyzedSubjects: 0,
  averageScore: 0,
  criticalAlerts: 0,
  warningAlerts: 0,
  pendingLearnings: 0,
  staleAssessments: 0,
};

export const useRiskDashboardStore = defineStore('riskDashboard', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = ref<RiskDashboardState>({
    currentScope: null,
    scopes: [],
    subjects: [],
    compositeScores: [],
    selectedSubject: null,
    dimensions: [],
    alerts: [],
    pendingLearnings: [],
    viewMode: 'radar',
    filters: {},
    stats: { ...initialStats },
    isLoading: false,
    isAnalyzing: false,
    error: null,
  });

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  // Basic state getters
  const currentScope = computed(() => state.value.currentScope);
  const scopes = computed(() => state.value.scopes);
  const subjects = computed(() => state.value.subjects);
  const compositeScores = computed(() => state.value.compositeScores);
  const selectedSubject = computed(() => state.value.selectedSubject);
  const dimensions = computed(() => state.value.dimensions);
  const alerts = computed(() => state.value.alerts);
  const pendingLearnings = computed(() => state.value.pendingLearnings);
  const viewMode = computed(() => state.value.viewMode);
  const filters = computed(() => state.value.filters);
  const stats = computed(() => state.value.stats);
  const isLoading = computed(() => state.value.isLoading);
  const isAnalyzing = computed(() => state.value.isAnalyzing);
  const error = computed(() => state.value.error);

  // Derived state
  const activeSubjects = computed(() =>
    state.value.subjects.filter((s) => s.isActive)
  );

  const activeDimensions = computed(() =>
    state.value.dimensions.filter((d) => d.isActive)
  );

  const criticalAlerts = computed(() =>
    state.value.alerts.filter((a) => a.severity === 'critical')
  );

  const warningAlerts = computed(() =>
    state.value.alerts.filter((a) => a.severity === 'warning')
  );

  const hasUnacknowledgedAlerts = computed(() => state.value.alerts.length > 0);

  const hasPendingLearnings = computed(() => state.value.pendingLearnings.length > 0);

  const averageRiskScore = computed(() => {
    const scores = state.value.compositeScores;
    if (scores.length === 0) return 0;
    return scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  });

  const highRiskSubjects = computed(() =>
    state.value.compositeScores.filter((s) => s.score >= 0.7)
  );

  const staleAssessments = computed(() =>
    state.value.compositeScores.filter((s) => s.ageHours > 168) // 7 days
  );

  // Radar chart data for selected subject
  const radarChartData = computed((): RadarChartDataPoint[] => {
    if (!state.value.selectedSubject?.compositeScore) return [];

    const dimensionScores = state.value.selectedSubject.compositeScore.dimensionScores;
    return Object.entries(dimensionScores).map(([slug, data]) => ({
      dimension: slug,
      score: data.score,
      confidence: data.confidence,
      weight: data.weight,
    }));
  });

  // Filtered subjects based on current filters
  const filteredSubjects = computed(() => {
    let filtered = state.value.subjects;
    const f = state.value.filters;

    if (f.scopeId) {
      filtered = filtered.filter((s) => s.scopeId === f.scopeId);
    }

    if (f.subjectType) {
      filtered = filtered.filter((s) => s.subjectType === f.subjectType);
    }

    return filtered;
  });

  // Filtered composite scores based on current filters
  const filteredCompositeScores = computed(() => {
    let filtered = state.value.compositeScores;
    const f = state.value.filters;

    if (f.minScore !== undefined) {
      filtered = filtered.filter((s) => s.score >= f.minScore!);
    }

    if (f.maxScore !== undefined) {
      filtered = filtered.filter((s) => s.score <= f.maxScore!);
    }

    if (f.hasAlerts) {
      const alertSubjectIds = new Set(state.value.alerts.map((a) => a.subjectId));
      filtered = filtered.filter((s) => alertSubjectIds.has(s.subjectId));
    }

    if (f.isStale) {
      filtered = filtered.filter((s) => s.ageHours > 168);
    }

    return filtered;
  });

  // ============================================================================
  // GETTERS (Functions)
  // ============================================================================

  function getScopeById(id: string): RiskScope | undefined {
    return state.value.scopes.find((s) => s.id === id);
  }

  function getSubjectById(id: string): RiskSubject | undefined {
    return state.value.subjects.find((s) => s.id === id);
  }

  function getDimensionById(id: string): RiskDimension | undefined {
    return state.value.dimensions.find((d) => d.id === id);
  }

  function getDimensionBySlug(slug: string): RiskDimension | undefined {
    return state.value.dimensions.find((d) => d.slug === slug);
  }

  function getCompositeScoreBySubjectId(subjectId: string): ActiveCompositeScoreView | undefined {
    return state.value.compositeScores.find((s) => s.subjectId === subjectId);
  }

  function getAlertsBySubjectId(subjectId: string): UnacknowledgedAlertView[] {
    return state.value.alerts.filter((a) => a.subjectId === subjectId);
  }

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    state.value.isLoading = loading;
  }

  function setAnalyzing(analyzing: boolean) {
    state.value.isAnalyzing = analyzing;
  }

  function setError(error: string | null) {
    state.value.error = error;
  }

  function clearError() {
    state.value.error = null;
  }

  function setCurrentScope(scope: RiskScope | null) {
    state.value.currentScope = scope;
  }

  function setScopes(scopes: RiskScope[]) {
    state.value.scopes = scopes;
  }

  function addScope(scope: RiskScope) {
    const existing = state.value.scopes.findIndex((s) => s.id === scope.id);
    if (existing >= 0) {
      state.value.scopes[existing] = scope;
    } else {
      state.value.scopes.push(scope);
    }
  }

  function updateScope(id: string, updates: Partial<RiskScope>) {
    const index = state.value.scopes.findIndex((s) => s.id === id);
    if (index >= 0) {
      state.value.scopes[index] = {
        ...state.value.scopes[index],
        ...updates,
      };
    }
    // Update currentScope if it's the same
    if (state.value.currentScope?.id === id) {
      state.value.currentScope = {
        ...state.value.currentScope,
        ...updates,
      };
    }
  }

  function removeScope(id: string) {
    state.value.scopes = state.value.scopes.filter((s) => s.id !== id);
    if (state.value.currentScope?.id === id) {
      state.value.currentScope = null;
    }
  }

  function setSubjects(subjects: RiskSubject[]) {
    state.value.subjects = subjects;
  }

  function addSubject(subject: RiskSubject) {
    const existing = state.value.subjects.findIndex((s) => s.id === subject.id);
    if (existing >= 0) {
      state.value.subjects[existing] = subject;
    } else {
      state.value.subjects.push(subject);
    }
  }

  function updateSubject(id: string, updates: Partial<RiskSubject>) {
    const index = state.value.subjects.findIndex((s) => s.id === id);
    if (index >= 0) {
      state.value.subjects[index] = {
        ...state.value.subjects[index],
        ...updates,
      };
    }
  }

  function removeSubject(id: string) {
    state.value.subjects = state.value.subjects.filter((s) => s.id !== id);
  }

  function setDimensions(dimensions: RiskDimension[]) {
    state.value.dimensions = dimensions;
  }

  function addDimension(dimension: RiskDimension) {
    const existing = state.value.dimensions.findIndex((d) => d.id === dimension.id);
    if (existing >= 0) {
      state.value.dimensions[existing] = dimension;
    } else {
      state.value.dimensions.push(dimension);
    }
  }

  function updateDimension(id: string, updates: Partial<RiskDimension>) {
    const index = state.value.dimensions.findIndex((d) => d.id === id);
    if (index >= 0) {
      state.value.dimensions[index] = {
        ...state.value.dimensions[index],
        ...updates,
      };
    }
  }

  function removeDimension(id: string) {
    state.value.dimensions = state.value.dimensions.filter((d) => d.id !== id);
  }

  function setCompositeScores(scores: ActiveCompositeScoreView[]) {
    state.value.compositeScores = scores;
  }

  function addCompositeScore(score: ActiveCompositeScoreView) {
    const existing = state.value.compositeScores.findIndex((s) => s.id === score.id);
    if (existing >= 0) {
      state.value.compositeScores[existing] = score;
    } else {
      state.value.compositeScores.push(score);
    }
  }

  function updateCompositeScore(id: string, updates: Partial<ActiveCompositeScoreView>) {
    const index = state.value.compositeScores.findIndex((s) => s.id === id);
    if (index >= 0) {
      state.value.compositeScores[index] = {
        ...state.value.compositeScores[index],
        ...updates,
      };
    }
  }

  function setAlerts(alerts: UnacknowledgedAlertView[]) {
    state.value.alerts = alerts;
  }

  function addAlert(alert: UnacknowledgedAlertView) {
    const existing = state.value.alerts.findIndex((a) => a.id === alert.id);
    if (existing >= 0) {
      state.value.alerts[existing] = alert;
    } else {
      state.value.alerts.push(alert);
    }
  }

  function removeAlert(id: string) {
    state.value.alerts = state.value.alerts.filter((a) => a.id !== id);
  }

  function setPendingLearnings(learnings: PendingLearningView[]) {
    state.value.pendingLearnings = learnings;
  }

  function addPendingLearning(learning: PendingLearningView) {
    const existing = state.value.pendingLearnings.findIndex((l) => l.id === learning.id);
    if (existing >= 0) {
      state.value.pendingLearnings[existing] = learning;
    } else {
      state.value.pendingLearnings.push(learning);
    }
  }

  function removePendingLearning(id: string) {
    state.value.pendingLearnings = state.value.pendingLearnings.filter((l) => l.id !== id);
  }

  function setSelectedSubject(selected: SelectedSubjectState | null) {
    state.value.selectedSubject = selected;
  }

  function updateSelectedSubjectAssessments(assessments: RiskAssessment[]) {
    if (state.value.selectedSubject) {
      state.value.selectedSubject = {
        ...state.value.selectedSubject,
        assessments,
      };
    }
  }

  function updateSelectedSubjectDebate(debate: RiskDebate | null) {
    if (state.value.selectedSubject) {
      state.value.selectedSubject = {
        ...state.value.selectedSubject,
        debate,
      };
    }
  }

  function updateSelectedSubjectAlerts(alerts: RiskAlert[]) {
    if (state.value.selectedSubject) {
      state.value.selectedSubject = {
        ...state.value.selectedSubject,
        alerts,
      };
    }
  }

  function updateSelectedSubjectEvaluations(evaluations: RiskEvaluation[]) {
    if (state.value.selectedSubject) {
      state.value.selectedSubject = {
        ...state.value.selectedSubject,
        evaluations,
      };
    }
  }

  function setViewMode(mode: DashboardViewMode) {
    state.value.viewMode = mode;
  }

  function setFilters(filters: DashboardFilters) {
    state.value.filters = filters;
  }

  function updateFilters(updates: Partial<DashboardFilters>) {
    state.value.filters = {
      ...state.value.filters,
      ...updates,
    };
  }

  function clearFilters() {
    state.value.filters = {};
  }

  function setStats(stats: DashboardStats) {
    state.value.stats = stats;
  }

  function updateStats(updates: Partial<DashboardStats>) {
    state.value.stats = {
      ...state.value.stats,
      ...updates,
    };
  }

  function resetState() {
    state.value.currentScope = null;
    state.value.scopes = [];
    state.value.subjects = [];
    state.value.compositeScores = [];
    state.value.selectedSubject = null;
    state.value.dimensions = [];
    state.value.alerts = [];
    state.value.pendingLearnings = [];
    state.value.viewMode = 'radar';
    state.value.filters = {};
    state.value.stats = { ...initialStats };
    state.value.isLoading = false;
    state.value.isAnalyzing = false;
    state.value.error = null;
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    currentScope,
    scopes,
    subjects,
    compositeScores,
    selectedSubject,
    dimensions,
    alerts,
    pendingLearnings,
    viewMode,
    filters,
    stats,
    isLoading,
    isAnalyzing,
    error,

    // Derived state
    activeSubjects,
    activeDimensions,
    criticalAlerts,
    warningAlerts,
    hasUnacknowledgedAlerts,
    hasPendingLearnings,
    averageRiskScore,
    highRiskSubjects,
    staleAssessments,
    radarChartData,
    filteredSubjects,
    filteredCompositeScores,

    // Getters (functions)
    getScopeById,
    getSubjectById,
    getDimensionById,
    getDimensionBySlug,
    getCompositeScoreBySubjectId,
    getAlertsBySubjectId,

    // Mutations
    setLoading,
    setAnalyzing,
    setError,
    clearError,
    setCurrentScope,
    setScopes,
    addScope,
    updateScope,
    removeScope,
    setSubjects,
    addSubject,
    updateSubject,
    removeSubject,
    setDimensions,
    addDimension,
    updateDimension,
    removeDimension,
    setCompositeScores,
    addCompositeScore,
    updateCompositeScore,
    setAlerts,
    addAlert,
    removeAlert,
    setPendingLearnings,
    addPendingLearning,
    removePendingLearning,
    setSelectedSubject,
    updateSelectedSubjectAssessments,
    updateSelectedSubjectDebate,
    updateSelectedSubjectAlerts,
    updateSelectedSubjectEvaluations,
    setViewMode,
    setFilters,
    updateFilters,
    clearFilters,
    setStats,
    updateStats,
    resetState,
  };
});
