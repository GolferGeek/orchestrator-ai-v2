<template>
  <div class="finance-tab">
    <!-- Header with Tab Navigation -->
    <div class="finance-header">
      <div class="header-top">
        <div class="header-info">
          <h2>Finance Research</h2>
          <span v-if="conversation" class="conversation-title">{{ conversation.title }}</span>
        </div>
        <div class="header-actions" v-if="hasRunData">
          <ion-button fill="clear" size="small" @click="handleNewRun">
            <ion-icon :icon="refreshOutline" slot="start" />
            New Run
          </ion-button>
        </div>
      </div>

      <!-- Tab Navigation - Only show when there's data -->
      <div v-if="hasRunData || hasUniverseData" class="tab-navigation">
        <ion-segment :value="currentView" @ionChange="handleTabChange">
          <ion-segment-button value="config">
            <ion-icon :icon="settingsOutline" />
            <ion-label>Config</ion-label>
          </ion-segment-button>
          <ion-segment-button value="progress" :disabled="!isRunning">
            <ion-icon :icon="pulseOutline" />
            <ion-label>Progress</ion-label>
            <ion-badge v-if="isRunning" color="primary" class="status-badge">Live</ion-badge>
          </ion-segment-button>
          <ion-segment-button value="recommendations" :disabled="!hasRecommendations">
            <ion-icon :icon="analyticsOutline" />
            <ion-label>Recommendations</ion-label>
            <ion-badge v-if="pendingCount > 0" color="warning" class="status-badge">{{ pendingCount }}</ion-badge>
          </ion-segment-button>
        </ion-segment>
      </div>
    </div>

    <!-- Content Area -->
    <div class="finance-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent" />
        <p>Loading configuration...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger" />
        <p>{{ error }}</p>
        <ion-button @click="loadData">Retry</ion-button>
      </div>

      <!-- Config View -->
      <div v-else-if="currentView === 'config'" class="config-view">
        <div class="config-section">
          <h3>Universe Selection</h3>
          <div v-if="universes.length === 0" class="empty-state">
            <ion-icon :icon="planetOutline" />
            <p>No universes configured yet.</p>
            <p class="hint">Create a universe in Admin Settings to get started.</p>
          </div>
          <div v-else class="universe-selector">
            <ion-select
              v-model="selectedUniverseId"
              placeholder="Select a universe"
              interface="popover"
              @ionChange="handleUniverseChange"
            >
              <ion-select-option
                v-for="universe in universes"
                :key="universe.id"
                :value="universe.id"
              >
                {{ universe.name }}
              </ion-select-option>
            </ion-select>
          </div>
        </div>

        <!-- Version Selection -->
        <div v-if="selectedUniverseId && versions.length > 0" class="config-section">
          <h3>Active Version</h3>
          <div class="version-info">
            <div v-if="activeVersion" class="active-version-card">
              <div class="version-header">
                <span class="version-number">v{{ activeVersion.version }}</span>
                <ion-badge color="success">Active</ion-badge>
              </div>
              <div class="instruments-summary">
                <ion-icon :icon="statsChartOutline" />
                <span>{{ activeVersion.config.instruments.length }} instruments</span>
              </div>
              <div class="instruments-list">
                <ion-chip
                  v-for="inst in activeVersion.config.instruments.slice(0, 5)"
                  :key="inst.symbol"
                  size="small"
                >
                  {{ inst.symbol }}
                </ion-chip>
                <ion-chip v-if="activeVersion.config.instruments.length > 5" size="small" color="medium">
                  +{{ activeVersion.config.instruments.length - 5 }} more
                </ion-chip>
              </div>
            </div>
          </div>
        </div>

        <!-- Run Configuration -->
        <div v-if="activeVersion" class="config-section">
          <h3>Run Configuration</h3>
          <div class="run-options">
            <div class="option-group">
              <label>Timing Windows</label>
              <div class="timing-windows">
                <ion-chip
                  v-for="window in timingWindowOptions"
                  :key="window.value"
                  :color="selectedTimingWindows.includes(window.value) ? 'primary' : 'medium'"
                  @click="toggleTimingWindow(window.value)"
                >
                  {{ window.label }}
                </ion-chip>
              </div>
            </div>
            <div class="option-group">
              <label>Lookback Period</label>
              <ion-range
                :min="7"
                :max="90"
                v-model="lookbackDays"
                :pin="true"
                :ticks="true"
                :snaps="true"
                :step="7"
              >
                <ion-label slot="start">7 days</ion-label>
                <ion-label slot="end">90 days</ion-label>
              </ion-range>
            </div>
            <div class="option-group">
              <ion-checkbox v-model="includeAgendaAnalysis">
                Include agenda/manipulation analysis
              </ion-checkbox>
            </div>
          </div>
          <div class="run-actions">
            <ion-button expand="block" @click="handleStartRun" :disabled="isRunning">
              <ion-icon :icon="playOutline" slot="start" />
              Start Research Run
            </ion-button>
          </div>
        </div>
      </div>

      <!-- Progress View -->
      <div v-else-if="currentView === 'progress'" class="progress-view">
        <div class="progress-header">
          <h3>Research in Progress</h3>
          <ion-spinner v-if="isRunning" name="dots" />
        </div>
        <div class="progress-steps">
          <div
            v-for="step in progressSteps"
            :key="step.id"
            class="progress-step"
            :class="{ completed: step.completed, active: step.active }"
          >
            <ion-icon :icon="step.completed ? checkmarkCircle : step.active ? syncOutline : ellipseOutline" />
            <span>{{ step.label }}</span>
            <span v-if="step.progress !== undefined" class="progress-pct">{{ step.progress }}%</span>
          </div>
        </div>
        <div v-if="runProgress" class="current-step">
          <p>{{ runProgress.step }}</p>
          <ion-progress-bar :value="runProgress.progress / 100" />
        </div>
      </div>

      <!-- Recommendations View -->
      <div v-else-if="currentView === 'recommendations'" class="recommendations-view">
        <div class="recommendations-header">
          <h3>Recommendations</h3>
          <div class="stats-summary">
            <div class="stat">
              <span class="stat-value">{{ recommendations.length }}</span>
              <span class="stat-label">Total</span>
            </div>
            <div class="stat win">
              <span class="stat-value">{{ winCount }}</span>
              <span class="stat-label">Wins</span>
            </div>
            <div class="stat loss">
              <span class="stat-value">{{ lossCount }}</span>
              <span class="stat-label">Losses</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ winRate.toFixed(1) }}%</span>
              <span class="stat-label">Win Rate</span>
            </div>
          </div>
        </div>

        <!-- Recommendations List -->
        <div class="recommendations-list">
          <div
            v-for="rec in recommendations"
            :key="rec.id"
            class="recommendation-card"
            :class="[rec.action, rec.outcome?.winLoss]"
          >
            <div class="rec-header">
              <span class="instrument">{{ rec.instrument }}</span>
              <ion-badge :color="getActionColor(rec.action)">{{ rec.action.toUpperCase() }}</ion-badge>
              <ion-badge v-if="rec.outcome" :color="getOutcomeColor(rec.outcome.winLoss)">
                {{ rec.outcome.winLoss.toUpperCase() }}
              </ion-badge>
            </div>
            <div class="rec-details">
              <div class="detail">
                <ion-icon :icon="timeOutline" />
                <span>{{ formatTimingWindow(rec.timingWindow) }}</span>
              </div>
              <div v-if="rec.intendedPrice" class="detail">
                <ion-icon :icon="cashOutline" />
                <span>${{ rec.intendedPrice.toFixed(2) }}</span>
              </div>
              <div v-if="rec.outcome" class="detail">
                <ion-icon :icon="trendingUpOutline" />
                <span>{{ formatReturn(rec.outcome.realizedReturnMetrics.returnPct) }}</span>
              </div>
            </div>
            <div class="rec-rationale">
              <p>{{ rec.rationale }}</p>
            </div>
            <div v-if="rec.postmortem" class="rec-postmortem">
              <h5>Postmortem</h5>
              <p><strong>What happened:</strong> {{ rec.postmortem.whatHappened }}</p>
              <p><strong>Why:</strong> {{ rec.postmortem.whyItHappened }}</p>
              <div v-if="rec.postmortem.lessons.length" class="lessons">
                <strong>Lessons:</strong>
                <ul>
                  <li v-for="(lesson, idx) in rec.postmortem.lessons" :key="idx">{{ lesson }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Evaluation Actions -->
        <div class="evaluation-actions">
          <ion-button fill="outline" @click="handleEvaluate" :disabled="pendingCount === 0 || evaluationLoading">
            <ion-icon :icon="checkmarkDoneOutline" slot="start" />
            Evaluate Pending ({{ pendingCount }})
          </ion-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonButton,
  IonSpinner,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonBadge,
  IonSelect,
  IonSelectOption,
  IonChip,
  IonRange,
  IonCheckbox,
  IonProgressBar,
} from '@ionic/vue';
import {
  refreshOutline,
  alertCircleOutline,
  settingsOutline,
  pulseOutline,
  analyticsOutline,
  planetOutline,
  statsChartOutline,
  playOutline,
  checkmarkCircle,
  syncOutline,
  ellipseOutline,
  timeOutline,
  cashOutline,
  trendingUpOutline,
  checkmarkDoneOutline,
} from 'ionicons/icons';
import { useFinanceStore } from '@/stores/financeStore';
import { financeService } from '@/services/financeService';
import type { AgentConversation } from '@/types/conversation';

interface Props {
  conversation: AgentConversation | null;
}

const props = defineProps<Props>();

const store = useFinanceStore();

// Local state
const currentView = ref<'config' | 'progress' | 'recommendations'>('config');
const selectedUniverseId = ref<string | null>(null);
const selectedTimingWindows = ref<string[]>(['pre_close', 'post_close', 'pre_open']);
const lookbackDays = ref(30);
const includeAgendaAnalysis = ref(true);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Timing window options
const timingWindowOptions = [
  { value: 'pre_close', label: 'Pre-Close' },
  { value: 'post_close', label: 'Post-Close' },
  { value: 'pre_open', label: 'Pre-Open' },
  { value: 'intraday', label: 'Intraday' },
];

// Progress steps
const progressSteps = computed(() => [
  { id: 'init', label: 'Initializing', completed: progressPct.value > 5, active: progressPct.value <= 5 },
  { id: 'market', label: 'Ingesting Market Data', completed: progressPct.value > 25, active: progressPct.value > 5 && progressPct.value <= 25 },
  { id: 'news', label: 'Ingesting News', completed: progressPct.value > 45, active: progressPct.value > 25 && progressPct.value <= 45 },
  { id: 'agenda', label: 'Extracting Agenda Signals', completed: progressPct.value > 65, active: progressPct.value > 45 && progressPct.value <= 65 },
  { id: 'features', label: 'Building Features', completed: progressPct.value > 85, active: progressPct.value > 65 && progressPct.value <= 85 },
  { id: 'recs', label: 'Generating Recommendations', completed: progressPct.value > 95, active: progressPct.value > 85 && progressPct.value <= 95 },
  { id: 'save', label: 'Saving Results', completed: progressPct.value >= 100, active: progressPct.value > 95 && progressPct.value < 100 },
]);

// Computed from store
const universes = computed(() => store.universes);
const versions = computed(() => store.versions);
const activeVersion = computed(() => store.activeVersion);
const recommendations = computed(() => store.recommendationsWithOutcomes);
const isRunning = computed(() => store.runInProgress);
const runProgress = computed(() => store.runProgress);
const evaluationLoading = computed(() => store.evaluationLoading);

const progressPct = computed(() => runProgress.value?.progress ?? 0);

const hasUniverseData = computed(() => universes.value.length > 0);
const hasRunData = computed(() => store.currentRunId !== null || isRunning.value);
const hasRecommendations = computed(() => recommendations.value.length > 0);

const pendingCount = computed(() => store.pendingRecommendations.length);
const winCount = computed(() => store.winningRecommendations.length);
const lossCount = computed(() => store.losingRecommendations.length);
const winRate = computed(() => store.overallWinRate);

// Methods
function handleTabChange(event: CustomEvent) {
  currentView.value = event.detail.value as 'config' | 'progress' | 'recommendations';
}

function toggleTimingWindow(window: string) {
  const idx = selectedTimingWindows.value.indexOf(window);
  if (idx >= 0) {
    selectedTimingWindows.value.splice(idx, 1);
  } else {
    selectedTimingWindows.value.push(window);
  }
}

async function handleUniverseChange() {
  if (!selectedUniverseId.value) return;

  try {
    store.setVersionsLoading(true);
    const versions = await financeService.getUniverseVersions(selectedUniverseId.value);
    store.setVersions(versions);
  } catch (err) {
    console.error('Failed to load versions:', err);
  } finally {
    store.setVersionsLoading(false);
  }
}

async function handleStartRun() {
  if (!activeVersion.value) return;

  try {
    store.setRunInProgress(true);
    store.setRunProgress({ step: 'Starting...', progress: 0 });
    currentView.value = 'progress';

    const result = await financeService.triggerRun({
      universeVersionId: activeVersion.value.id,
      timingWindows: selectedTimingWindows.value as ('pre_close' | 'post_close' | 'pre_open' | 'intraday')[],
      lookbackDays: lookbackDays.value,
      includeAgendaAnalysis: includeAgendaAnalysis.value,
    });

    store.setCurrentRunId(result.runId);
    store.setRecommendations(result.recommendations);
    store.setRunProgress({ step: 'Completed', progress: 100 });

    // Switch to recommendations view
    setTimeout(() => {
      currentView.value = 'recommendations';
      store.setRunInProgress(false);
    }, 1000);
  } catch (err) {
    console.error('Run failed:', err);
    error.value = err instanceof Error ? err.message : 'Run failed';
    store.setRunInProgress(false);
  }
}

async function handleEvaluate() {
  try {
    store.setEvaluationLoading(true);
    const result = await financeService.triggerEvaluation();
    store.setLastEvaluationResult(result);

    // Refresh recommendations
    if (activeVersion.value) {
      const recs = await financeService.getRecommendationsWithOutcomes(activeVersion.value.id);
      store.setRecommendationsWithOutcomes(recs);
    }
  } catch (err) {
    console.error('Evaluation failed:', err);
  } finally {
    store.setEvaluationLoading(false);
  }
}

function handleNewRun() {
  store.setCurrentRunId(null);
  store.setRecommendations([]);
  store.setRunProgress(null);
  currentView.value = 'config';
}

async function loadData() {
  isLoading.value = true;
  error.value = null;

  try {
    const universes = await financeService.getUniverses();
    store.setUniverses(universes);

    if (universes.length > 0 && !selectedUniverseId.value) {
      selectedUniverseId.value = universes[0].id;
      await handleUniverseChange();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  } finally {
    isLoading.value = false;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'buy': return 'success';
    case 'sell': return 'danger';
    default: return 'medium';
  }
}

function getOutcomeColor(outcome: string): string {
  switch (outcome) {
    case 'win': return 'success';
    case 'loss': return 'danger';
    default: return 'medium';
  }
}

function formatTimingWindow(window: string): string {
  return window.replace('_', '-').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatReturn(returnPct: number | undefined): string {
  if (returnPct === undefined) return 'N/A';
  const sign = returnPct >= 0 ? '+' : '';
  return `${sign}${returnPct.toFixed(2)}%`;
}

// Lifecycle
onMounted(async () => {
  await loadData();
});

// Watch conversation changes
watch(() => props.conversation?.id, async () => {
  await loadData();
});
</script>

<style scoped>
.finance-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-background-color);
}

.finance-header {
  padding: 16px;
  background: var(--ion-card-background);
  border-bottom: 1px solid var(--ion-border-color);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.header-info h2 {
  margin: 0 0 4px 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.conversation-title {
  color: var(--ion-color-medium);
  font-size: 0.875rem;
}

.tab-navigation {
  margin-top: 12px;
}

.status-badge {
  margin-left: 4px;
  font-size: 0.625rem;
}

.finance-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
}

.error-container ion-icon {
  font-size: 48px;
}

/* Config View */
.config-section {
  background: var(--ion-card-background);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.config-section h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-state .hint {
  font-size: 0.875rem;
}

.active-version-card {
  background: var(--ion-background-color);
  border-radius: 8px;
  padding: 16px;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.version-number {
  font-weight: 600;
  font-size: 1.125rem;
}

.instruments-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.instruments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.run-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.timing-windows {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.run-actions {
  margin-top: 16px;
}

/* Progress View */
.progress-view {
  padding: 16px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--ion-card-background);
  border-radius: 8px;
  opacity: 0.5;
}

.progress-step.active {
  opacity: 1;
  background: var(--ion-color-primary-tint);
}

.progress-step.completed {
  opacity: 1;
}

.progress-step.completed ion-icon {
  color: var(--ion-color-success);
}

.progress-pct {
  margin-left: auto;
  font-weight: 600;
}

.current-step {
  margin-top: 24px;
  padding: 16px;
  background: var(--ion-card-background);
  border-radius: 8px;
}

/* Recommendations View */
.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.stats-summary {
  display: flex;
  gap: 16px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.stat.win .stat-value {
  color: var(--ion-color-success);
}

.stat.loss .stat-value {
  color: var(--ion-color-danger);
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommendation-card {
  background: var(--ion-card-background);
  border-radius: 8px;
  padding: 16px;
  border-left: 4px solid var(--ion-color-medium);
}

.recommendation-card.buy {
  border-left-color: var(--ion-color-success);
}

.recommendation-card.sell {
  border-left-color: var(--ion-color-danger);
}

.recommendation-card.win {
  background: var(--ion-color-success-tint);
}

.recommendation-card.loss {
  background: var(--ion-color-danger-tint);
}

.rec-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.instrument {
  font-weight: 600;
  font-size: 1.125rem;
}

.rec-details {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  color: var(--ion-color-medium);
}

.detail {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rec-rationale {
  font-size: 0.875rem;
  color: var(--ion-text-color);
}

.rec-postmortem {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ion-border-color);
  font-size: 0.875rem;
}

.rec-postmortem h5 {
  margin: 0 0 8px 0;
}

.lessons ul {
  margin: 4px 0 0 0;
  padding-left: 20px;
}

.evaluation-actions {
  margin-top: 24px;
  text-align: center;
}
</style>
