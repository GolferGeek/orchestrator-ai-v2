/**
 * Analyst Store - State + Synchronous Mutations Only
 *
 * Manages state for Prediction Analysts (Phase 11).
 * For async operations, use predictionDashboardService.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// ============================================================================
// TYPES
// ============================================================================

export type AnalystScopeLevel = 'runner' | 'domain' | 'universe' | 'target';

export interface TierInstructions {
  gold?: string;
  silver?: string;
  bronze?: string;
}

export interface PredictionAnalyst {
  id: string;
  slug: string;
  name: string;
  perspective: string;
  scopeLevel: AnalystScopeLevel;
  domain: string | null;
  universeId: string | null;
  targetId: string | null;
  defaultWeight: number;
  tierInstructions: TierInstructions;
  learnedPatterns: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalystTemplate {
  slug: string;
  name: string;
  perspective: string;
  domain: 'stocks' | 'crypto' | 'elections' | 'polymarket';
  defaultWeight: number;
  tierInstructions: TierInstructions;
}

interface AnalystFilters {
  scopeLevel: AnalystScopeLevel | null;
  domain: string | null;
  universeId: string | null;
  active: boolean | null;
}

interface AnalystState {
  analysts: PredictionAnalyst[];
  analystTemplates: AnalystTemplate[];
  selectedAnalystId: string | null;
  filters: AnalystFilters;
  isLoading: boolean;
  error: string | null;
}

export const useAnalystStore = defineStore('analyst', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const state = ref<AnalystState>({
    analysts: [],
    analystTemplates: [],
    selectedAnalystId: null,
    filters: {
      scopeLevel: null,
      domain: null,
      universeId: null,
      active: null,
    },
    isLoading: false,
    error: null,
  });

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  const analysts = computed(() => state.value.analysts);
  const analystTemplates = computed(() => state.value.analystTemplates);
  const selectedAnalystId = computed(() => state.value.selectedAnalystId);
  const filters = computed(() => state.value.filters);
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);

  const selectedAnalyst = computed(() =>
    state.value.analysts.find((a) => a.id === state.value.selectedAnalystId)
  );

  const filteredAnalysts = computed(() => {
    let result = state.value.analysts;

    if (state.value.filters.scopeLevel) {
      result = result.filter((a) => a.scopeLevel === state.value.filters.scopeLevel);
    }

    if (state.value.filters.domain) {
      result = result.filter((a) => a.domain === state.value.filters.domain);
    }

    if (state.value.filters.universeId) {
      result = result.filter((a) => a.universeId === state.value.filters.universeId);
    }

    if (state.value.filters.active !== null) {
      result = result.filter((a) => a.active === state.value.filters.active);
    }

    return result;
  });

  const activeAnalysts = computed(() =>
    state.value.analysts.filter((a) => a.active)
  );

  const analystsByScopeLevel = computed(() => {
    const grouped: Record<AnalystScopeLevel, PredictionAnalyst[]> = {
      runner: [],
      domain: [],
      universe: [],
      target: [],
    };
    for (const analyst of state.value.analysts) {
      grouped[analyst.scopeLevel].push(analyst);
    }
    return grouped;
  });

  const analystsByDomain = computed(() => {
    const grouped: Record<string, PredictionAnalyst[]> = {};
    for (const analyst of state.value.analysts) {
      if (analyst.domain) {
        if (!grouped[analyst.domain]) {
          grouped[analyst.domain] = [];
        }
        grouped[analyst.domain].push(analyst);
      }
    }
    return grouped;
  });

  const templatesByDomain = computed(() => {
    const grouped: Record<string, AnalystTemplate[]> = {};
    for (const template of state.value.analystTemplates) {
      if (!grouped[template.domain]) {
        grouped[template.domain] = [];
      }
      grouped[template.domain].push(template);
    }
    return grouped;
  });

  // ============================================================================
  // GETTERS (Functions)
  // ============================================================================

  function getAnalystById(id: string): PredictionAnalyst | undefined {
    return state.value.analysts.find((a) => a.id === id);
  }

  function getAnalystBySlug(slug: string): PredictionAnalyst | undefined {
    return state.value.analysts.find((a) => a.slug === slug);
  }

  function getAnalystsForUniverse(universeId: string): PredictionAnalyst[] {
    return state.value.analysts.filter((a) => a.universeId === universeId);
  }

  function getAnalystsForDomain(domain: string): PredictionAnalyst[] {
    return state.value.analysts.filter((a) => a.domain === domain);
  }

  function getTemplateBySlug(slug: string): AnalystTemplate | undefined {
    return state.value.analystTemplates.find((t) => t.slug === slug);
  }

  function getTemplatesForDomain(domain: string): AnalystTemplate[] {
    return state.value.analystTemplates.filter((t) => t.domain === domain);
  }

  // ============================================================================
  // MUTATIONS (Synchronous Only)
  // ============================================================================

  function setLoading(loading: boolean) {
    state.value.isLoading = loading;
  }

  function setError(error: string | null) {
    state.value.error = error;
  }

  function clearError() {
    state.value.error = null;
  }

  function setAnalysts(analysts: PredictionAnalyst[]) {
    state.value.analysts = analysts;
  }

  function addAnalyst(analyst: PredictionAnalyst) {
    const idx = state.value.analysts.findIndex((a) => a.id === analyst.id);
    if (idx >= 0) {
      state.value.analysts[idx] = analyst;
    } else {
      state.value.analysts.push(analyst);
    }
  }

  function updateAnalyst(id: string, updates: Partial<PredictionAnalyst>) {
    const idx = state.value.analysts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      state.value.analysts[idx] = { ...state.value.analysts[idx], ...updates };
    }
  }

  function removeAnalyst(id: string) {
    state.value.analysts = state.value.analysts.filter((a) => a.id !== id);
    if (state.value.selectedAnalystId === id) {
      state.value.selectedAnalystId = null;
    }
  }

  function setAnalystTemplates(templates: AnalystTemplate[]) {
    state.value.analystTemplates = templates;
  }

  function addAnalystTemplate(template: AnalystTemplate) {
    const idx = state.value.analystTemplates.findIndex((t) => t.slug === template.slug);
    if (idx >= 0) {
      state.value.analystTemplates[idx] = template;
    } else {
      state.value.analystTemplates.push(template);
    }
  }

  function selectAnalyst(id: string | null) {
    state.value.selectedAnalystId = id;
  }

  function setFilters(filters: Partial<AnalystFilters>) {
    state.value.filters = { ...state.value.filters, ...filters };
  }

  function clearFilters() {
    state.value.filters = {
      scopeLevel: null,
      domain: null,
      universeId: null,
      active: null,
    };
  }

  function resetState() {
    state.value = {
      analysts: [],
      analystTemplates: [],
      selectedAnalystId: null,
      filters: {
        scopeLevel: null,
        domain: null,
        universeId: null,
        active: null,
      },
      isLoading: false,
      error: null,
    };
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // State (computed)
    analysts,
    analystTemplates,
    selectedAnalystId,
    filters,
    isLoading,
    error,

    // Derived state
    selectedAnalyst,
    filteredAnalysts,
    activeAnalysts,
    analystsByScopeLevel,
    analystsByDomain,
    templatesByDomain,

    // Getters (functions)
    getAnalystById,
    getAnalystBySlug,
    getAnalystsForUniverse,
    getAnalystsForDomain,
    getTemplateBySlug,
    getTemplatesForDomain,

    // Mutations
    setLoading,
    setError,
    clearError,
    setAnalysts,
    addAnalyst,
    updateAnalyst,
    removeAnalyst,
    setAnalystTemplates,
    addAnalystTemplate,
    selectAnalyst,
    setFilters,
    clearFilters,
    resetState,
  };
});
