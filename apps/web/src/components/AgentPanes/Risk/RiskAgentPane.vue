<template>
  <div class="risk-agent-pane">
    <!-- Header with Controls -->
    <div class="pane-header">
      <div class="agent-info">
        <h2>Investment Risk Dashboard</h2>
        <div v-if="currentScope" class="scope-info">
          <span class="scope-label">Scope:</span>
          <span class="scope-name">{{ currentScope.name }}</span>
        </div>
      </div>

      <div class="header-controls">
        <button
          class="control-btn analyze-btn"
          :disabled="isAnalyzing || !currentScope"
          @click="handleAnalyzeAll"
        >
          {{ isAnalyzing ? 'Analyzing...' : 'Analyze All' }}
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

    <!-- Stats Summary -->
    <div class="stats-summary">
      <div class="summary-card">
        <div class="summary-value">{{ stats.totalSubjects }}</div>
        <div class="summary-label">Total Subjects</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ stats.analyzedSubjects }}</div>
        <div class="summary-label">Analyzed</div>
      </div>
      <div class="summary-card">
        <div class="summary-value" :class="{ warning: stats.averageScore > 0.6 }">
          {{ formatScore(stats.averageScore) }}
        </div>
        <div class="summary-label">Avg Risk Score</div>
      </div>
      <div class="summary-card critical" v-if="stats.criticalAlerts > 0">
        <div class="summary-value">{{ stats.criticalAlerts }}</div>
        <div class="summary-label">Critical Alerts</div>
      </div>
      <div class="summary-card warning" v-if="stats.warningAlerts > 0">
        <div class="summary-value">{{ stats.warningAlerts }}</div>
        <div class="summary-label">Warnings</div>
      </div>
      <div class="summary-card" v-if="stats.pendingLearnings > 0">
        <div class="summary-value">{{ stats.pendingLearnings }}</div>
        <div class="summary-label">Pending Learnings</div>
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
        <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Overview Tab - Radar Chart and Subject List -->
      <div v-if="activeTab === 'overview'" class="overview-tab">
        <div class="overview-layout">
          <!-- Sidebar with subject list -->
          <RiskSidebar
            :subjects="subjects"
            :composite-scores="compositeScores"
            :selected-subject-id="selectedSubject?.subject?.id"
            @select="handleSelectSubject"
            @add-subject="showCreateSubjectModal = true"
          />

          <!-- Main content - Radar or Detail -->
          <div class="main-content">
            <template v-if="selectedSubject && selectedSubject.subject">
              <RiskDetailView
                :subject="selectedSubject.subject"
                :composite-score="selectedSubject.compositeScore"
                :assessments="selectedSubject.assessments"
                :debate="selectedSubject.debate"
                :alerts="selectedSubject.alerts"
                @analyze="handleAnalyzeSubject"
                @trigger-debate="handleTriggerDebate"
              />
            </template>
            <template v-else>
              <div class="empty-selection">
                <p>Select a subject from the sidebar to view risk analysis details.</p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Alerts Tab -->
      <div v-if="activeTab === 'alerts'" class="alerts-tab">
        <AlertsComponent
          :alerts="alerts"
          @acknowledge="handleAcknowledgeAlert"
        />
      </div>

      <!-- Dimensions Tab -->
      <div v-if="activeTab === 'dimensions'" class="dimensions-tab">
        <DimensionsComponent
          :dimensions="dimensions"
          :scope-id="currentScope?.id"
          @dimension-updated="handleDimensionUpdated"
        />
      </div>

      <!-- Learnings Tab -->
      <div v-if="activeTab === 'learnings'" class="learnings-tab">
        <LearningsComponent
          :learnings="pendingLearnings"
          @approve="handleApproveLearning"
          @reject="handleRejectLearning"
        />
      </div>

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="settings-tab">
        <SettingsComponent
          :scope="currentScope"
          :scopes="scopes"
          @select-scope="handleSelectScope"
          @update-scope="handleUpdateScope"
        />
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

    <!-- Create Subject Modal -->
    <CreateSubjectModal
      ref="createSubjectModalRef"
      :is-open="showCreateSubjectModal"
      :scope-id="currentScope?.id || null"
      @close="showCreateSubjectModal = false"
      @create="handleCreateSubject"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRiskDashboardStore } from '@/stores/riskDashboardStore';
import { riskDashboardService } from '@/services/riskDashboardService';
import RiskSidebar from './RiskSidebar.vue';
import RiskDetailView from './RiskDetailView.vue';
import AlertsComponent from './AlertsComponent.vue';
import DimensionsComponent from './DimensionsComponent.vue';
import LearningsComponent from './LearningsComponent.vue';
import SettingsComponent from './SettingsComponent.vue';
import CreateSubjectModal from '@/views/risk/components/CreateSubjectModal.vue';
import type { CreateSubjectRequest, RiskDimension } from '@/types/risk-agent';

interface Props {
  conversation?: { id: string; agentName?: string; organizationSlug?: string } | null;
  agent?: { id?: string; slug?: string; name?: string } | null;
}

const props = defineProps<Props>();

const store = useRiskDashboardStore();

// UI State
const activeTab = ref('overview');
const showCreateSubjectModal = ref(false);
const createSubjectModalRef = ref<InstanceType<typeof CreateSubjectModal> | null>(null);

// Computed from store
const currentScope = computed(() => store.currentScope);
const scopes = computed(() => store.scopes);
const subjects = computed(() => store.subjects);
const compositeScores = computed(() => store.compositeScores);
const selectedSubject = computed(() => store.selectedSubject);
const dimensions = computed(() => store.dimensions);
const alerts = computed(() => store.alerts);
const pendingLearnings = computed(() => store.pendingLearnings);
const stats = computed(() => store.stats);
const isLoading = computed(() => store.isLoading);
const isAnalyzing = computed(() => store.isAnalyzing);
const error = computed(() => store.error);

// Tabs with dynamic badges
const tabs = computed(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'alerts', label: 'Alerts', badge: alerts.value.length > 0 ? alerts.value.length : undefined },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'learnings', label: 'Learnings', badge: pendingLearnings.value.length > 0 ? pendingLearnings.value.length : undefined },
  { id: 'settings', label: 'Settings' },
]);

// Formatting helpers
function normalizeScore(score: number): number {
  if (isNaN(score) || score === null || score === undefined) return 0;
  return score > 1 ? score / 100 : score;
}

function formatScore(score: number): string {
  if (isNaN(score) || score === null || score === undefined) return '0%';
  const normalized = normalizeScore(score);
  return (normalized * 100).toFixed(0) + '%';
}

// Event handlers
async function handleRefresh() {
  store.setLoading(true);
  store.clearError();
  try {
    // Load scopes first
    const scopesResponse = await riskDashboardService.listScopes({ isActive: true });
    if (scopesResponse.content) {
      store.setScopes(scopesResponse.content);

      // If no current scope, select the first one
      if (!currentScope.value && scopesResponse.content.length > 0) {
        await handleSelectScope(scopesResponse.content[0].id);
      } else if (currentScope.value) {
        // Reload current scope data
        await loadScopeData(currentScope.value.id);
      }
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to refresh data');
  } finally {
    store.setLoading(false);
  }
}

async function loadScopeData(scopeId: string) {
  // Load all scope data in parallel for better performance
  const [subjectsResponse, scoresResponse, dimensionsResponse, alertsResponse, learningsResponse, statsResponse] = await Promise.all([
    riskDashboardService.listSubjects({ scopeId, isActive: true }),
    riskDashboardService.listCompositeScores({ scopeId }),
    riskDashboardService.listDimensions(scopeId),
    riskDashboardService.listAlerts({ scopeId, unacknowledgedOnly: true }),
    riskDashboardService.listLearnings({ scopeId, status: 'pending' }),
    riskDashboardService.getDashboardStats(scopeId),
  ]);

  if (subjectsResponse.content) {
    store.setSubjects(subjectsResponse.content);
  }

  if (scoresResponse.content) {
    store.setCompositeScores(scoresResponse.content);
  }

  if (dimensionsResponse.content) {
    store.setDimensions(dimensionsResponse.content);
  }

  if (alertsResponse.content) {
    store.setAlerts(alertsResponse.content);
  }

  if (learningsResponse.content) {
    store.setPendingLearnings(learningsResponse.content);
  }

  // Set stats from API response
  if (statsResponse.content) {
    store.setStats(statsResponse.content);
  }
}

async function handleSelectScope(scopeId: string) {
  const scope = scopes.value.find(s => s.id === scopeId);
  if (scope) {
    store.setCurrentScope(scope);
    store.setSelectedSubject(null);
    await loadScopeData(scopeId);
  }
}

async function handleSelectSubject(subjectId: string) {
  store.setLoading(true);
  try {
    const response = await riskDashboardService.getSubjectDetail(subjectId);
    if (response.content) {
      store.setSelectedSubject(response.content);
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to load subject details');
  } finally {
    store.setLoading(false);
  }
}

async function handleAnalyzeSubject(subjectId: string) {
  store.setAnalyzing(true);
  try {
    const response = await riskDashboardService.analyzeSubject(subjectId, { forceRefresh: true });
    if (response.content) {
      // Refresh subject detail
      await handleSelectSubject(subjectId);
      // Refresh composite scores
      if (currentScope.value) {
        const scoresResponse = await riskDashboardService.listCompositeScores({ scopeId: currentScope.value.id });
        if (scoresResponse.content) {
          store.setCompositeScores(scoresResponse.content);
        }
      }
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Analysis failed');
  } finally {
    store.setAnalyzing(false);
  }
}

async function handleAnalyzeAll() {
  if (!currentScope.value) return;

  store.setAnalyzing(true);
  try {
    await riskDashboardService.analyzeScope(currentScope.value.id, { forceRefresh: true });
    // Refresh all data
    await loadScopeData(currentScope.value.id);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Batch analysis failed');
  } finally {
    store.setAnalyzing(false);
  }
}

async function handleTriggerDebate(compositeScoreId: string) {
  store.setAnalyzing(true);
  try {
    await riskDashboardService.triggerDebate(compositeScoreId);
    // Refresh selected subject
    if (selectedSubject.value?.subject) {
      await handleSelectSubject(selectedSubject.value.subject.id);
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to trigger debate');
  } finally {
    store.setAnalyzing(false);
  }
}

async function handleAcknowledgeAlert(alertId: string) {
  try {
    await riskDashboardService.acknowledgeAlert(alertId);
    store.removeAlert(alertId);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
  }
}

async function handleApproveLearning(learningId: string) {
  try {
    await riskDashboardService.approveLearning(learningId);
    store.removePendingLearning(learningId);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to approve learning');
  }
}

async function handleRejectLearning(learningId: string) {
  try {
    await riskDashboardService.rejectLearning(learningId);
    store.removePendingLearning(learningId);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to reject learning');
  }
}

async function handleUpdateScope(updates: Record<string, unknown>) {
  if (!currentScope.value) return;

  try {
    const response = await riskDashboardService.updateScope(currentScope.value.id, updates);
    if (response.content) {
      store.updateScope(currentScope.value.id, response.content);
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to update scope');
  }
}

async function handleCreateSubject(params: CreateSubjectRequest) {
  createSubjectModalRef.value?.setSubmitting(true);

  try {
    const response = await riskDashboardService.createSubject(params);

    if (response.success && response.content) {
      store.addSubject(response.content);
      showCreateSubjectModal.value = false;
      // Reload scope data to get updated stats
      if (currentScope.value) {
        await loadScopeData(currentScope.value.id);
      }
    } else {
      createSubjectModalRef.value?.setError('Failed to create subject');
    }
  } catch (err) {
    createSubjectModalRef.value?.setError(err instanceof Error ? err.message : 'Failed to create subject');
  }
}

function handleDimensionUpdated(dimension: RiskDimension) {
  // Update the dimension in the store
  store.updateDimension(dimension.id, dimension);
}

function clearError() {
  store.clearError();
}

// Initialize on mount
onMounted(() => {
  handleRefresh();
});

// Watch for agent changes
watch(() => props.agent?.slug, () => {
  if (props.agent?.slug) {
    riskDashboardService.setAgentSlug(props.agent.slug);
    handleRefresh();
  }
});
</script>

<style scoped>
.risk-agent-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color, #f5f5f5);
  color: var(--ion-text-color, #333);
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--ion-card-background, #fff);
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
}

.agent-info h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
}

.scope-info {
  font-size: 0.875rem;
  color: var(--ion-color-medium, #666);
}

.scope-label {
  margin-right: 0.25rem;
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.analyze-btn {
  background: var(--ion-color-primary, #3880ff);
  color: white;
}

.analyze-btn:hover:not(:disabled) {
  background: var(--ion-color-primary-shade, #3171e0);
}

.refresh-btn {
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-text-color, #333);
}

.refresh-btn:hover:not(:disabled) {
  background: var(--ion-color-light-shade, #d7d8da);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--ion-color-danger-tint, #ff9999);
  color: var(--ion-color-danger-contrast, #fff);
}

.error-icon {
  font-size: 1.25rem;
}

.close-error-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  cursor: pointer;
}

.stats-summary {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  overflow-x: auto;
}

.summary-card {
  flex: 0 0 auto;
  min-width: 100px;
  padding: 0.75rem 1rem;
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-card.critical {
  background: var(--ion-color-danger-tint, #ffcccc);
}

.summary-card.warning {
  background: var(--ion-color-warning-tint, #fff3cd);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 600;
}

.summary-value.warning {
  color: var(--ion-color-warning, #ffc409);
}

.summary-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  margin-top: 0.25rem;
}

.tabs-nav {
  display: flex;
  gap: 0;
  padding: 0 1rem;
  background: var(--ion-card-background, #fff);
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
}

.tab-btn {
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ion-color-medium, #666);
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}

.tab-btn:hover {
  color: var(--ion-text-color, #333);
}

.tab-btn.active {
  color: var(--ion-color-primary, #3880ff);
  border-bottom-color: var(--ion-color-primary, #3880ff);
}

.tab-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: var(--ion-color-danger, #eb445a);
  color: white;
  border-radius: 10px;
  font-size: 0.75rem;
}

.tab-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.overview-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
}

.main-content {
  flex: 1;
  min-width: 0;
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium, #666);
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
  border: 3px solid var(--ion-border-color, #e0e0e0);
  border-top-color: var(--ion-color-primary, #3880ff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .risk-agent-pane {
    --ion-background-color: #1a1a1a;
    --ion-card-background: #2a2a2a;
    --ion-text-color: #f0f0f0;
    --ion-border-color: #404040;
  }
}
</style>
