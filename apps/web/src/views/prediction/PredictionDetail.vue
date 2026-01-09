<template>
  <div class="prediction-detail">
    <!-- Header -->
    <header class="detail-header">
      <button class="back-button" @click="goBack">
        <span class="icon">&larr;</span>
        Back to Dashboard
      </button>
      <div v-if="prediction" class="header-info">
        <h1>
          {{ prediction.targetSymbol }}
          <span class="target-name">{{ prediction.targetName }}</span>
        </h1>
        <div class="header-badges">
          <span class="status-badge" :class="`status-${prediction.status}`">
            {{ prediction.status }}
          </span>
          <LLMComparisonBadge
            v-if="prediction.llmEnsembleResults"
            :llm-ensemble-results="prediction.llmEnsembleResults"
          />
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading prediction details...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
      <button class="btn btn-secondary" @click="loadPredictionData">Try Again</button>
    </div>

    <!-- Prediction Not Found -->
    <div v-else-if="!prediction" class="empty-state">
      <span class="empty-icon">&#128269;</span>
      <h3>Prediction Not Found</h3>
      <p>The requested prediction could not be found.</p>
      <button class="btn btn-secondary" @click="goBack">Go Back</button>
    </div>

    <!-- Main Content -->
    <div v-else class="detail-content">
      <!-- Summary Section -->
      <section class="summary-section">
        <div class="direction-card" :class="prediction.direction">
          <span class="direction-icon">{{ directionIcon }}</span>
          <div class="direction-info">
            <span class="direction-label">{{ prediction.direction.toUpperCase() }}</span>
            <span class="confidence">{{ Math.round(prediction.confidence * 100) }}% confidence</span>
          </div>
        </div>
        <div class="summary-grid">
          <div v-if="prediction.magnitude" class="summary-item">
            <span class="item-label">Magnitude</span>
            <span class="item-value">{{ prediction.magnitude.toFixed(2) }}%</span>
          </div>
          <div v-if="prediction.timeframe" class="summary-item">
            <span class="item-label">Timeframe</span>
            <span class="item-value">{{ prediction.timeframe }}</span>
          </div>
          <div v-if="prediction.entryValue" class="summary-item">
            <span class="item-label">Entry Value</span>
            <span class="item-value">${{ prediction.entryValue.toFixed(2) }}</span>
          </div>
          <div v-if="prediction.exitValue" class="summary-item">
            <span class="item-label">Exit Value</span>
            <span class="item-value">${{ prediction.exitValue.toFixed(2) }}</span>
          </div>
          <div class="summary-item">
            <span class="item-label">Generated</span>
            <span class="item-value">{{ formatDate(prediction.generatedAt) }}</span>
          </div>
          <div v-if="prediction.expiresAt" class="summary-item">
            <span class="item-label">Expires</span>
            <span class="item-value">{{ formatDate(prediction.expiresAt) }}</span>
          </div>
        </div>
      </section>

      <!-- Snapshot Loading -->
      <div v-if="store.isLoadingSnapshot" class="loading-snapshot">
        <div class="spinner small"></div>
        <span>Loading explainability data...</span>
      </div>

      <!-- Explainability Sections (from Snapshot) -->
      <template v-if="snapshot">
        <!-- LLM Ensemble Results -->
        <LLMEnsembleView :llm-ensemble-results="snapshot.llmEnsembleResults" />

        <!-- Threshold Evaluation -->
        <ThresholdEvaluation :evaluation="snapshot.thresholdEvaluation" />

        <!-- Analyst Breakdown -->
        <AnalystBreakdown :assessments="snapshot.analystAssessments" />

        <!-- Predictors -->
        <PredictorList :predictors="snapshot.predictors" />

        <!-- Applied Learnings -->
        <LearningsApplied :learnings="snapshot.appliedLearnings" />

        <!-- Rejected Signals -->
        <section v-if="snapshot.rejectedSignals.length > 0" class="rejected-signals">
          <h3 class="section-title">
            Rejected Signals
            <span class="count">({{ snapshot.rejectedSignals.length }})</span>
          </h3>
          <div class="signals-list">
            <div
              v-for="signal in snapshot.rejectedSignals"
              :key="signal.id"
              class="signal-item"
            >
              <div class="signal-header">
                <span class="signal-reason">{{ signal.reason }}</span>
              </div>
              <p class="signal-content">{{ signal.content }}</p>
            </div>
          </div>
        </section>

        <!-- Timeline -->
        <PredictionTimeline :timeline="snapshot.timeline" />
      </template>

      <!-- No Snapshot Available -->
      <div v-else-if="!store.isLoadingSnapshot" class="no-snapshot">
        <p>Detailed explainability data is not available for this prediction.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePredictionStore } from '@/stores/predictionStore';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import LLMComparisonBadge from '@/components/prediction/LLMComparisonBadge.vue';
import LLMEnsembleView from '@/components/prediction/LLMEnsembleView.vue';
import ThresholdEvaluation from '@/components/prediction/ThresholdEvaluation.vue';
import AnalystBreakdown from '@/components/prediction/AnalystBreakdown.vue';
import PredictorList from '@/components/prediction/PredictorList.vue';
import LearningsApplied from '@/components/prediction/LearningsApplied.vue';
import PredictionTimeline from '@/components/prediction/PredictionTimeline.vue';

const route = useRoute();
const router = useRouter();
const store = usePredictionStore();

const isLoading = ref(false);
const error = ref<string | null>(null);

const predictionId = computed(() => route.params.id as string);
const prediction = computed(() => store.selectedPrediction);
const snapshot = computed(() => store.currentSnapshot);

const directionIcon = computed(() => {
  switch (prediction.value?.direction) {
    case 'up':
      return '\u2191';
    case 'down':
      return '\u2193';
    default:
      return '\u2194';
  }
});

async function loadPredictionData() {
  if (!predictionId.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    // Check if we already have the prediction in store
    let pred = store.getPredictionById(predictionId.value);

    if (!pred) {
      // Load from API
      const response = await predictionDashboardService.getPrediction({
        id: predictionId.value,
      });
      if (response.content) {
        store.addPrediction(response.content);
        pred = response.content;
      }
    }

    if (pred) {
      store.selectPrediction(pred.id);
      // Load snapshot for explainability
      await loadSnapshot();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load prediction';
  } finally {
    isLoading.value = false;
  }
}

async function loadSnapshot() {
  if (!predictionId.value) return;

  store.setLoadingSnapshot(true);

  try {
    const response = await predictionDashboardService.getPredictionSnapshot({
      id: predictionId.value,
    });
    if (response.content) {
      store.setSnapshot(response.content);
    }
  } catch (err) {
    // Snapshot may not exist for all predictions
    console.warn('Failed to load snapshot:', err);
    store.setSnapshot(null);
  } finally {
    store.setLoadingSnapshot(false);
  }
}

function goBack() {
  router.push({ name: 'prediction-dashboard' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Watch for route changes
watch(predictionId, () => {
  loadPredictionData();
});

onMounted(() => {
  loadPredictionData();
});
</script>

<style scoped>
.prediction-detail {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: 1.5rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  background: none;
  border: none;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.2s;
}

.back-button:hover {
  color: var(--primary-color, #3b82f6);
}

.header-info {
  margin-top: 0.75rem;
}

.header-info h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.target-name {
  font-weight: 400;
  color: var(--text-secondary, #6b7280);
  margin-left: 0.5rem;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-active {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-resolved {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.status-expired {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-cancelled {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 3rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0;
  text-align: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background-color: var(--btn-secondary-hover, #e5e7eb);
}

/* Content */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.summary-section {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.direction-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  min-width: 180px;
}

.direction-card.up {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.1));
  border: 2px solid #22c55e;
}

.direction-card.down {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1));
  border: 2px solid #ef4444;
}

.direction-card.flat {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(75, 85, 99, 0.1));
  border: 2px solid #6b7280;
}

.direction-icon {
  font-size: 2rem;
}

.direction-card.up .direction-icon {
  color: #16a34a;
}

.direction-card.down .direction-icon {
  color: #dc2626;
}

.direction-card.flat .direction-icon {
  color: #6b7280;
}

.direction-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.direction-label {
  font-size: 1.125rem;
  font-weight: 700;
}

.direction-card.up .direction-label {
  color: #16a34a;
}

.direction-card.down .direction-label {
  color: #dc2626;
}

.direction-card.flat .direction-label {
  color: #6b7280;
}

.confidence {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.summary-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.item-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.loading-snapshot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

.no-snapshot {
  padding: 1rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  color: var(--text-secondary, #6b7280);
  font-style: italic;
}

.no-snapshot p {
  margin: 0;
}

/* Rejected Signals */
.rejected-signals {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-primary, #111827);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count {
  font-weight: 400;
  color: var(--text-secondary, #6b7280);
}

.signals-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.signal-item {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  padding: 0.75rem;
  border-left: 4px solid #ef4444;
}

.signal-header {
  margin-bottom: 0.5rem;
}

.signal-reason {
  font-size: 0.75rem;
  font-weight: 600;
  color: #dc2626;
  text-transform: uppercase;
}

.signal-content {
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  margin: 0;
  line-height: 1.5;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prediction-detail {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
  }
}
</style>
