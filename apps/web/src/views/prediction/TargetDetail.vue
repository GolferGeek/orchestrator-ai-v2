<template>
  <div class="target-detail">
    <!-- Header -->
    <header class="detail-header">
      <button class="back-button" @click="goBack">
        <span class="icon">&larr;</span>
        Back to Dashboard
      </button>
      <div v-if="target" class="header-info">
        <h1>
          {{ target.symbol }}
          <span class="target-name">{{ target.name }}</span>
        </h1>
        <div class="header-badges">
          <span class="type-badge">{{ target.targetType }}</span>
          <span class="status-badge" :class="target.active ? 'active' : 'inactive'">
            {{ target.active ? 'Active' : 'Inactive' }}
          </span>
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading target details...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
      <button class="btn btn-secondary" @click="loadTargetData">Try Again</button>
    </div>

    <!-- Target Not Found -->
    <div v-else-if="!target" class="empty-state">
      <span class="empty-icon">&#128269;</span>
      <h3>Target Not Found</h3>
      <p>The requested target could not be found.</p>
      <button class="btn btn-secondary" @click="goBack">Go Back</button>
    </div>

    <!-- Main Content -->
    <div v-else class="detail-content">
      <!-- Target Info -->
      <section class="info-section">
        <h2>Target Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="item-label">Symbol</span>
            <span class="item-value">{{ target.symbol }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Name</span>
            <span class="item-value">{{ target.name }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Type</span>
            <span class="item-value">{{ target.targetType }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Universe</span>
            <span class="item-value">{{ universe?.name || target.universeId }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Created</span>
            <span class="item-value">{{ formatDate(target.createdAt) }}</span>
          </div>
          <div class="info-item">
            <span class="item-label">Updated</span>
            <span class="item-value">{{ formatDate(target.updatedAt) }}</span>
          </div>
        </div>

        <!-- Context -->
        <div v-if="target.context" class="context-section">
          <h3>Analysis Context</h3>
          <pre class="context-content">{{ target.context }}</pre>
        </div>

        <!-- LLM Config Override -->
        <div v-if="hasLlmOverride" class="llm-override-section">
          <h3>LLM Configuration Override</h3>
          <pre class="config-content">{{ JSON.stringify(target.llmConfigOverride, null, 2) }}</pre>
        </div>
      </section>

      <!-- Pipeline Actions Section -->
      <section class="actions-section">
        <h2>Pipeline Actions</h2>
        <p class="actions-description">Manually trigger pipeline processing steps for this target.</p>
        <div class="action-buttons">
          <button
            class="btn btn-action"
            :disabled="actionInProgress !== null"
            @click="handleCrawlSources"
          >
            <span v-if="actionInProgress === 'crawl'" class="spinner-small"></span>
            <span v-else class="action-icon">🔄</span>
            {{ actionInProgress === 'crawl' ? 'Crawling...' : 'Crawl Sources' }}
          </button>
          <button
            class="btn btn-action"
            :disabled="actionInProgress !== null"
            @click="handleProcessSignals"
          >
            <span v-if="actionInProgress === 'process'" class="spinner-small"></span>
            <span v-else class="action-icon">⚡</span>
            {{ actionInProgress === 'process' ? 'Processing...' : 'Process Signals' }}
          </button>
          <button
            class="btn btn-action"
            :disabled="actionInProgress !== null"
            @click="handleGeneratePredictions"
          >
            <span v-if="actionInProgress === 'generate'" class="spinner-small"></span>
            <span v-else class="action-icon">🎯</span>
            {{ actionInProgress === 'generate' ? 'Generating...' : 'Generate Predictions' }}
          </button>
        </div>
        <!-- Action Result -->
        <div v-if="actionResult" class="action-result" :class="actionResult.type">
          <span class="result-icon">{{ actionResult.type === 'success' ? '✓' : '✗' }}</span>
          <span class="result-message">{{ actionResult.message }}</span>
          <button class="close-result" @click="actionResult = null">×</button>
        </div>
      </section>

      <!-- Predictions for this Target -->
      <section class="predictions-section">
        <h2>
          Predictions
          <span class="count">({{ targetPredictions.length }})</span>
        </h2>
        <div v-if="targetPredictions.length === 0" class="empty-message">
          No predictions have been generated for this target yet.
        </div>
        <div v-else class="predictions-grid">
          <PredictionCard
            v-for="prediction in targetPredictions"
            :key="prediction.id"
            :prediction="prediction"
            @select="onPredictionSelect"
          />
        </div>
      </section>

      <!-- Signals Section (placeholder) -->
      <SignalList :signals="signals" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePredictionStore } from '@/stores/predictionStore';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import PredictionCard from '@/components/prediction/PredictionCard.vue';
import SignalList from '@/components/prediction/SignalList.vue';

const route = useRoute();
const router = useRouter();
const store = usePredictionStore();

const isLoading = ref(false);
const error = ref<string | null>(null);

// Pipeline action state
const actionInProgress = ref<'crawl' | 'process' | 'generate' | null>(null);
const actionResult = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Placeholder signals - would be loaded from API
const signals = ref<Array<{
  id: string;
  content: string;
  disposition: 'bullish' | 'bearish' | 'neutral';
  status: 'new' | 'processing' | 'promoted' | 'rejected' | 'stale';
  urgency: 'urgent' | 'notable' | 'routine';
  source: string;
  createdAt: string;
}>>([]);

const targetId = computed(() => route.params.id as string);
const target = computed(() => store.selectedTarget);
const universe = computed(() =>
  target.value ? store.getUniverseById(target.value.universeId) : null
);
const targetPredictions = computed(() =>
  targetId.value ? store.getPredictionsForTarget(targetId.value) : []
);
const hasLlmOverride = computed(
  () => target.value?.llmConfigOverride && Object.keys(target.value.llmConfigOverride).length > 0
);

async function loadTargetData() {
  if (!targetId.value) return;

  isLoading.value = true;
  error.value = null;

  try {
    // Check if we already have the target in store
    let t = store.getTargetById(targetId.value);

    if (!t) {
      // Load from API
      const response = await predictionDashboardService.getTarget({
        id: targetId.value,
      });
      if (response.content) {
        store.addTarget(response.content);
        t = response.content;
      }
    }

    if (t) {
      store.selectTarget(t.id);

      // Load predictions for this target
      const predictionsRes = await predictionDashboardService.listPredictions(
        { targetId: t.id },
        { pageSize: 20 }
      );
      if (predictionsRes.content) {
        // Add to store
        for (const pred of predictionsRes.content) {
          store.addPrediction(pred);
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load target';
  } finally {
    isLoading.value = false;
  }
}

function goBack() {
  router.push({ name: 'PredictionDashboard' });
}

function onPredictionSelect(id: string) {
  router.push({ name: 'PredictionDetail', params: { id } });
}

// Pipeline action handlers
async function handleCrawlSources() {
  if (!targetId.value || actionInProgress.value) return;

  actionInProgress.value = 'crawl';
  actionResult.value = null;

  try {
    const response = await predictionDashboardService.crawlSources({
      targetId: targetId.value,
    });

    if (response.success && response.content) {
      actionResult.value = {
        type: 'success',
        message: response.content.message,
      };
    } else {
      actionResult.value = {
        type: 'error',
        message: response.error?.message || 'Failed to crawl sources',
      };
    }
  } catch (err) {
    actionResult.value = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to crawl sources',
    };
  } finally {
    actionInProgress.value = null;
  }
}

async function handleProcessSignals() {
  if (!targetId.value || actionInProgress.value) return;

  actionInProgress.value = 'process';
  actionResult.value = null;

  try {
    const response = await predictionDashboardService.processSignals({
      targetId: targetId.value,
      batchSize: 20,
    });

    if (response.success && response.content) {
      actionResult.value = {
        type: 'success',
        message: response.content.message,
      };
      // Reload data to show new predictors
      await loadTargetData();
    } else {
      actionResult.value = {
        type: 'error',
        message: response.error?.message || 'Failed to process signals',
      };
    }
  } catch (err) {
    actionResult.value = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to process signals',
    };
  } finally {
    actionInProgress.value = null;
  }
}

async function handleGeneratePredictions() {
  if (!targetId.value || actionInProgress.value) return;

  actionInProgress.value = 'generate';
  actionResult.value = null;

  try {
    const response = await predictionDashboardService.generatePredictions({
      targetId: targetId.value,
    });

    if (response.success && response.content) {
      actionResult.value = {
        type: 'success',
        message: response.content.message,
      };
      // Reload data to show new predictions
      await loadTargetData();
    } else {
      actionResult.value = {
        type: 'error',
        message: response.error?.message || 'Failed to generate predictions',
      };
    }
  } catch (err) {
    actionResult.value = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Failed to generate predictions',
    };
  } finally {
    actionInProgress.value = null;
  }
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

watch(targetId, () => {
  loadTargetData();
});

onMounted(() => {
  loadTargetData();
});
</script>

<style scoped>
.target-detail {
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

.type-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-badge.active {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-badge.inactive {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
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

.info-section,
.predictions-section {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.5rem;
}

.info-section h2,
.predictions-section h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.count {
  font-weight: 400;
  color: var(--text-secondary, #6b7280);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.info-item {
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
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.context-section,
.llm-override-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.context-section h3,
.llm-override-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
}

.context-content,
.config-content {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 0.8125rem;
  background: var(--code-bg, #f3f4f6);
  border-radius: 6px;
  padding: 0.75rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary, #111827);
}

.empty-message {
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
  font-style: italic;
}

.predictions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

/* Pipeline Actions Section */
.actions-section {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.actions-section h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.5rem 0;
}

.actions-description {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 1rem 0;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #111827);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action:hover:not(:disabled) {
  background: var(--btn-secondary-hover, #f3f4f6);
  border-color: var(--primary-color, #3b82f6);
}

.btn-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  font-size: 1rem;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.action-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.action-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.result-icon {
  font-weight: 700;
}

.result-message {
  flex: 1;
}

.close-result {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0.6;
  color: inherit;
  padding: 0;
  line-height: 1;
}

.close-result:hover {
  opacity: 1;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .target-detail {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --code-bg: #111827;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
  }
}
</style>
