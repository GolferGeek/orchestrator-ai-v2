<template>
  <div class="prediction-dashboard">
    <header class="dashboard-header">
      <h1>Prediction Dashboard</h1>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="refreshData">
          <span class="icon">&#8635;</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- Filters Section -->
    <section class="filters-section">
      <div class="filter-group">
        <label for="universe-filter">Universe</label>
        <select
          id="universe-filter"
          v-model="selectedUniverse"
          @change="onUniverseChange"
        >
          <option :value="null">All Universes</option>
          <option
            v-for="universe in store.universes"
            :key="universe.id"
            :value="universe.id"
          >
            {{ universe.name }} ({{ universe.domain }})
          </option>
        </select>
      </div>

      <div class="filter-group">
        <label for="status-filter">Status</label>
        <select id="status-filter" v-model="statusFilter" @change="onFilterChange">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="resolved">Resolved</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="domain-filter">Domain</label>
        <select id="domain-filter" v-model="domainFilter" @change="onFilterChange">
          <option :value="null">All Domains</option>
          <option value="stocks">Stocks</option>
          <option value="crypto">Crypto</option>
          <option value="elections">Elections</option>
          <option value="polymarket">Polymarket</option>
        </select>
      </div>
    </section>

    <!-- Stats Summary -->
    <section class="stats-section">
      <div class="stat-card">
        <span class="stat-value">{{ store.activePredictions.length }}</span>
        <span class="stat-label">Active Predictions</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ store.resolvedPredictions.length }}</span>
        <span class="stat-label">Resolved</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ store.universes.length }}</span>
        <span class="stat-label">Universes</span>
      </div>
      <div class="stat-card agreement-stats">
        <div class="agreement-row">
          <span class="agreement-dot full"></span>
          <span>{{ store.llmAgreementStats.fullAgreement }} Full</span>
        </div>
        <div class="agreement-row">
          <span class="agreement-dot partial"></span>
          <span>{{ store.llmAgreementStats.partialAgreement }} Partial</span>
        </div>
        <div class="agreement-row">
          <span class="agreement-dot none"></span>
          <span>{{ store.llmAgreementStats.noAgreement }} None</span>
        </div>
        <span class="stat-label">LLM Agreement</span>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="store.isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading predictions...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="store.error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ store.error }}</span>
      <button class="btn btn-secondary" @click="refreshData">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="store.filteredPredictions.length === 0" class="empty-state">
      <span class="empty-icon">&#128202;</span>
      <h3>No Predictions Found</h3>
      <p>
        {{ hasFilters ? 'Try adjusting your filters' : 'No predictions have been generated yet' }}
      </p>
    </div>

    <!-- Predictions Grid -->
    <section v-else class="predictions-grid">
      <PredictionCard
        v-for="prediction in store.filteredPredictions"
        :key="prediction.id"
        :prediction="prediction"
        :is-selected="prediction.id === store.selectedPredictionId"
        @select="onPredictionSelect"
      />
    </section>

    <!-- Pagination -->
    <section v-if="store.totalPages > 1" class="pagination-section">
      <button
        class="btn btn-secondary"
        :disabled="store.page <= 1"
        @click="goToPage(store.page - 1)"
      >
        Previous
      </button>
      <span class="page-info">
        Page {{ store.page }} of {{ store.totalPages }}
      </span>
      <button
        class="btn btn-secondary"
        :disabled="!store.hasMore"
        @click="goToPage(store.page + 1)"
      >
        Next
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePredictionStore } from '@/stores/predictionStore';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import PredictionCard from '@/components/prediction/PredictionCard.vue';

const router = useRouter();
const store = usePredictionStore();

const selectedUniverse = ref<string | null>(null);
const statusFilter = ref<'all' | 'active' | 'resolved' | 'expired' | 'cancelled'>('all');
const domainFilter = ref<string | null>(null);

const hasFilters = computed(() => {
  return selectedUniverse.value !== null || statusFilter.value !== 'all' || domainFilter.value !== null;
});

async function loadData() {
  store.setLoading(true);
  store.clearError();

  try {
    const data = await predictionDashboardService.loadDashboardData(
      selectedUniverse.value || undefined
    );

    store.setUniverses(data.universes);
    store.setPredictions(data.predictions);
    store.setStrategies(data.strategies);

    if (data.predictions.length > 0) {
      store.setTotalCount(data.predictions.length);
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to load predictions');
  } finally {
    store.setLoading(false);
  }
}

function refreshData() {
  loadData();
}

function onUniverseChange() {
  store.selectUniverse(selectedUniverse.value);
  loadData();
}

function onFilterChange() {
  store.setFilters({
    status: statusFilter.value,
    domain: domainFilter.value,
  });
}

function onPredictionSelect(id: string) {
  store.selectPrediction(id);
  router.push({ name: 'prediction-detail', params: { id } });
}

function goToPage(page: number) {
  store.setPage(page);
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.prediction-dashboard {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
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

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  font-size: 1rem;
}

/* Filters */
.filters-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.filter-group select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  background-color: var(--input-bg, #ffffff);
  color: var(--text-primary, #111827);
  min-width: 160px;
}

/* Stats */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.agreement-stats {
  align-items: flex-start;
}

.agreement-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-primary, #111827);
}

.agreement-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.agreement-dot.full {
  background-color: #22c55e;
}

.agreement-dot.partial {
  background-color: #eab308;
}

.agreement-dot.none {
  background-color: #ef4444;
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

/* Predictions Grid */
.predictions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

/* Pagination */
.pagination-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.page-info {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prediction-dashboard {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --input-bg: #374151;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
  }
}
</style>
