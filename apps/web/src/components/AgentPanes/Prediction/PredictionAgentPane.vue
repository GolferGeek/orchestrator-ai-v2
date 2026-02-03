<template>
  <div class="prediction-agent-pane">
    <!-- Header with Runner Controls -->
    <div class="pane-header">
      <div class="agent-info">
        <h2>Prediction Agent Dashboard</h2>
        <div v-if="currentUniverse" class="universe-info">
          <span class="universe-label">Universe:</span>
          <span class="universe-name">{{ currentUniverse.name }}</span>
        </div>
      </div>

      <div class="runner-controls">
        <button
          class="control-btn pipeline-btn"
          :disabled="isExecuting || !currentUniverse"
          @click="handleRunPipeline"
        >
          {{ isExecuting ? 'Running...' : 'Run Pipeline' }}
        </button>

        <button
          class="control-btn crawl-btn"
          :disabled="isExecuting || !currentUniverse"
          @click="handleCrawlSources"
        >
          Crawl Sources
        </button>

        <button
          class="control-btn process-btn"
          :disabled="isExecuting || !currentUniverse"
          @click="handleProcessArticles"
        >
          Process Articles
        </button>

        <button
          class="control-btn generate-btn"
          :disabled="isExecuting || !currentUniverse"
          @click="handleGeneratePredictions"
        >
          Generate Predictions
        </button>

        <button
          class="control-btn refresh-btn"
          :disabled="isLoading"
          @click="handleRefresh"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      <span class="error-icon">&#9888;</span>
      <span>{{ error }}</span>
      <button class="close-error-btn" @click="clearError">
        &times;
      </button>
    </div>

    <!-- Pipeline Status Summary -->
    <div v-if="pipelineResult" class="pipeline-summary">
      <div class="summary-card">
        <div class="summary-label">Signals Created</div>
        <div class="summary-value">{{ pipelineResult.crawlResult?.signalsCreated || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Predictors Created</div>
        <div class="summary-value">{{ pipelineResult.processResult?.predictorsCreated || 0 }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Predictions Generated</div>
        <div class="summary-value">{{ pipelineResult.generateResult?.predictionsGenerated || 0 }}</div>
      </div>
      <div v-if="totalErrors > 0" class="summary-card error">
        <div class="summary-label">Errors</div>
        <div class="summary-value">{{ totalErrors }}</div>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="stats-summary">
      <div class="summary-card">
        <div class="summary-label">Universes</div>
        <div class="summary-value">{{ store.universes.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Targets</div>
        <div class="summary-value">{{ store.targets.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Active Predictions</div>
        <div class="summary-value">{{ store.activePredictions.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Resolved Predictions</div>
        <div class="summary-value">{{ store.resolvedPredictions.length }}</div>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <CurrentStateComponent v-if="activeTab === 'current-state'" />
      <InstrumentsComponent v-if="activeTab === 'instruments'" />
      <PortfoliosComponent v-if="activeTab === 'portfolios'" />
      <HistoryComponent v-if="activeTab === 'history'" />
      <ToolsComponent v-if="activeTab === 'tools'" />
      <ConfigComponent v-if="activeTab === 'config'" />
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { usePredictionStore } from '@/stores/predictionStore';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import CurrentStateComponent from './CurrentStateComponent.vue';
import InstrumentsComponent from './InstrumentsComponent.vue';
import PortfoliosComponent from './PortfoliosComponent.vue';
import HistoryComponent from './HistoryComponent.vue';
import ToolsComponent from './ToolsComponent.vue';
import ConfigComponent from './ConfigComponent.vue';

interface Props {
  conversation?: { id: string; agentName?: string; organizationSlug?: string } | null;
  agent?: { id?: string; slug?: string; name?: string; organizationSlug?: string | string[] } | null;
}

const props = defineProps<Props>();

const store = usePredictionStore();

// Derive agentId from agent prop or fall back to conversation.agentName
const agentSlug = computed(() => {
  return props.agent?.slug || props.conversation?.agentName || '';
});

// Helper to extract org from agent (handles array or string)
function getAgentOrg(): string | null {
  const agentOrg = props.agent?.organizationSlug;
  if (Array.isArray(agentOrg)) {
    return agentOrg[0] || null;
  }
  return agentOrg || null;
}

const activeTab = ref<'current-state' | 'instruments' | 'portfolios' | 'history' | 'tools' | 'config'>(
  'current-state'
);

const tabs = [
  { id: 'current-state' as const, label: 'Current State' },
  { id: 'instruments' as const, label: 'Instruments' },
  { id: 'portfolios' as const, label: 'Portfolios' },
  { id: 'history' as const, label: 'History' },
  { id: 'tools' as const, label: 'Tools' },
  { id: 'config' as const, label: 'Config' },
];

const isLoading = computed(() => store.isLoading);
const isExecuting = ref(false);
const error = computed(() => store.error);

// Pipeline result state
const pipelineResult = ref<{
  crawlResult?: { signalsCreated: number; errors: number };
  processResult?: { predictorsCreated: number; errors: number };
  generateResult?: { predictionsGenerated: number; errors: number };
} | null>(null);

const totalErrors = computed(() => {
  if (!pipelineResult.value) return 0;
  return (pipelineResult.value.crawlResult?.errors || 0) +
         (pipelineResult.value.processResult?.errors || 0) +
         (pipelineResult.value.generateResult?.errors || 0);
});

// Current universe (first one for now)
const currentUniverse = computed(() => {
  return store.universes.length > 0 ? store.universes[0] : null;
});

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // Priority: agent's org > conversation's org
  const agentOrg = getAgentOrg();
  const conversationOrg = props.conversation?.organizationSlug;
  const effectiveOrg = agentOrg || conversationOrg;

  if (effectiveOrg) {
    console.log('[PredictionAgentPane] Setting org:', effectiveOrg);
    predictionDashboardService.setOrgSlug(effectiveOrg);
  }
  if (agentSlug.value) {
    predictionDashboardService.setAgentSlug(agentSlug.value);
  }

  // Generate a dashboard conversation ID for this session
  // This prevents creating multiple conversations for parallel API calls
  const dashboardConvId = crypto.randomUUID();
  predictionDashboardService.setDashboardConversationId(dashboardConvId);
  console.log('[PredictionAgentPane] Set dashboard conversation ID:', dashboardConvId);

  // Load initial data
  await loadData();

  // Set up auto-refresh every 60 seconds
  refreshInterval = setInterval(async () => {
    await loadData();
  }, 60000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  store.resetState();
});

// Watch for agent/org changes and reload data
watch(
  [() => props.agent?.slug, () => props.agent?.organizationSlug, () => props.conversation?.organizationSlug],
  ([newAgentSlug, agentOrg, conversationOrg]) => {
    // Priority: agent's org > conversation's org
    const effectiveAgentOrg = Array.isArray(agentOrg) ? agentOrg[0] : agentOrg;
    const effectiveOrg = effectiveAgentOrg || conversationOrg;

    if (effectiveOrg) {
      console.log('[PredictionAgentPane] Setting org:', effectiveOrg);
      predictionDashboardService.setOrgSlug(effectiveOrg);
    }
    if (newAgentSlug) {
      predictionDashboardService.setAgentSlug(newAgentSlug);
      // Reset conversation ID when switching agents so each gets its own session
      const newConvId = crypto.randomUUID();
      predictionDashboardService.setDashboardConversationId(newConvId);
      console.log('[PredictionAgentPane] Reset dashboard conversation ID for new agent:', newConvId);
    }
    if (newAgentSlug || effectiveOrg) {
      loadData();
    }
  }
);

async function loadData() {
  store.setLoading(true);
  store.clearError();

  try {
    // Load all dashboard data in parallel using A2A service
    const [universesResponse, targetsResponse, predictionsResponse, strategiesResponse] = await Promise.all([
      predictionDashboardService.listUniverses(),
      predictionDashboardService.listTargets({}),
      predictionDashboardService.listPredictions({}),
      predictionDashboardService.listStrategies({}),
    ]);

    // Update store with fetched data
    if (universesResponse.content) {
      store.setUniverses(universesResponse.content);
    }

    if (targetsResponse.content) {
      store.setTargets(targetsResponse.content);
    }

    if (predictionsResponse.content) {
      store.setPredictions(predictionsResponse.content);
    }

    if (strategiesResponse.content) {
      store.setStrategies(strategiesResponse.content);
    }

    console.log('[PredictionAgentPane] Dashboard data loaded');
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    store.setError(err instanceof Error ? err.message : 'Failed to load data');
  } finally {
    store.setLoading(false);
  }
}

async function handleRunPipeline() {
  if (!currentUniverse.value) return;

  isExecuting.value = true;
  pipelineResult.value = null;
  store.clearError();

  try {
    const result = await predictionDashboardService.runFullPipeline({
      universeId: currentUniverse.value.id,
    });

    pipelineResult.value = {
      crawlResult: result.crawlResult,
      processResult: result.processResult,
      generateResult: result.generateResult,
    };

    console.log('[PredictionAgentPane] Pipeline complete:', result.summary);

    // Refresh data after pipeline
    await loadData();
  } catch (err) {
    console.error('Failed to run pipeline:', err);
    store.setError(err instanceof Error ? err.message : 'Failed to run pipeline');
  } finally {
    isExecuting.value = false;
  }
}

async function handleCrawlSources() {
  if (!currentUniverse.value) return;

  isExecuting.value = true;
  store.clearError();

  try {
    const result = await predictionDashboardService.crawlSources({
      universeId: currentUniverse.value.id,
    });

    if (result.content) {
      pipelineResult.value = {
        ...pipelineResult.value,
        crawlResult: {
          signalsCreated: result.content.totalSignalsCreated,
          errors: result.content.errorCount,
        },
      };
    }

    console.log('[PredictionAgentPane] Sources crawled');
    await loadData();
  } catch (err) {
    console.error('Failed to crawl sources:', err);
    store.setError(err instanceof Error ? err.message : 'Failed to crawl sources');
  } finally {
    isExecuting.value = false;
  }
}

async function handleProcessArticles() {
  if (!currentUniverse.value) return;

  isExecuting.value = true;
  store.clearError();

  try {
    const result = await predictionDashboardService.processArticles({
      universeId: currentUniverse.value.id,
    });

    if (result.content) {
      pipelineResult.value = {
        ...pipelineResult.value,
        processResult: {
          predictorsCreated: result.content.predictorsCreated || 0,
          errors: result.content.errors || 0,
        },
      };
    }

    console.log('[PredictionAgentPane] Articles processed');
    await loadData();
  } catch (err) {
    console.error('Failed to process articles:', err);
    store.setError(err instanceof Error ? err.message : 'Failed to process articles');
  } finally {
    isExecuting.value = false;
  }
}

async function handleGeneratePredictions() {
  if (!currentUniverse.value) return;

  isExecuting.value = true;
  store.clearError();

  try {
    const result = await predictionDashboardService.generatePredictions({
      universeId: currentUniverse.value.id,
    });

    if (result.content) {
      pipelineResult.value = {
        ...pipelineResult.value,
        generateResult: {
          predictionsGenerated: result.content.generated,
          errors: result.content.errors,
        },
      };
    }

    console.log('[PredictionAgentPane] Predictions generated');
    await loadData();
  } catch (err) {
    console.error('Failed to generate predictions:', err);
    store.setError(err instanceof Error ? err.message : 'Failed to generate predictions');
  } finally {
    isExecuting.value = false;
  }
}

async function handleRefresh() {
  await loadData();
}

function clearError() {
  store.clearError();
}
</script>

<style scoped>
.prediction-agent-pane {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.agent-info h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
}

.universe-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.universe-label {
  color: #6b7280;
}

.universe-name {
  font-weight: 600;
  color: #374151;
}

.runner-controls {
  display: flex;
  gap: 0.75rem;
}

.control-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pipeline-btn {
  background-color: #10b981;
  color: white;
}

.pipeline-btn:hover:not(:disabled) {
  background-color: #059669;
}

.crawl-btn {
  background-color: #8b5cf6;
  color: white;
}

.crawl-btn:hover:not(:disabled) {
  background-color: #7c3aed;
}

.process-btn {
  background-color: #f59e0b;
  color: white;
}

.process-btn:hover:not(:disabled) {
  background-color: #d97706;
}

.generate-btn {
  background-color: #3b82f6;
  color: white;
}

.generate-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.refresh-btn {
  background-color: #6b7280;
  color: white;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #4b5563;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #991b1b;
}

.error-icon {
  font-size: 1.25rem;
}

.close-error-btn {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #991b1b;
  cursor: pointer;
  line-height: 1;
}

.close-error-btn:hover {
  color: #7f1d1d;
}

.pipeline-summary,
.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.summary-card {
  padding: 1rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  text-align: center;
}

.summary-card.error {
  background-color: #fef2f2;
  border-color: #fecaca;
}

.summary-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.summary-card.error .summary-value {
  color: #ef4444;
}

.tabs-nav {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #374151;
  background-color: #f9fafb;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background-color: #eff6ff;
}

.tab-content {
  min-height: 400px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  z-index: 100;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .pane-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .runner-controls {
    flex-wrap: wrap;
  }

  .stats-summary,
  .pipeline-summary {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .tabs-nav {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .tab-btn {
    white-space: nowrap;
  }
}
</style>
