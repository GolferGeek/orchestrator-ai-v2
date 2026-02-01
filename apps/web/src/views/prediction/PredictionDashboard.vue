<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false"></ion-menu-button>
        </ion-buttons>
        <ion-title>Prediction Dashboard</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content ref="contentRef" :fullscreen="true">
      <div class="prediction-dashboard">
        <header class="dashboard-header">
      <div class="header-actions">
        <button class="btn btn-secondary" @click="goToTradingDashboard">
          <span class="icon">&#128200;</span>
          Trading Dashboard
        </button>
        <button class="btn btn-secondary" @click="goToPortfolios">
          <span class="icon">&#128193;</span>
          Manage Portfolios
        </button>
        <button class="btn btn-secondary" @click="showActivityFeed = !showActivityFeed">
          <span class="icon">&#128202;</span>
          {{ showActivityFeed ? 'Hide Activity' : 'Watch Activity' }}
        </button>
        <div class="spacer"></div>
        <button class="btn btn-secondary" @click="refreshData">
          <span class="icon">&#8635;</span>
          Refresh
        </button>
      </div>
    </header>

    <!-- Activity Feed Panel -->
    <section v-if="showActivityFeed" class="activity-feed-section">
      <PredictionActivityFeed @close="showActivityFeed = false" />
    </section>

    <!-- Filters Section -->
    <section class="filters-section">
      <div class="filter-group">
        <label for="universe-filter">Portfolio</label>
        <select
          id="universe-filter"
          v-model="selectedUniverse"
          @change="onUniverseChange"
        >
          <option :value="null">All Portfolios</option>
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

      <div class="filter-group">
        <label for="outcome-filter">Outcome</label>
        <select id="outcome-filter" v-model="outcomeFilter" @change="onFilterChange">
          <option :value="null">All Outcomes</option>
          <option value="correct">Correct</option>
          <option value="incorrect">Incorrect</option>
          <option value="pending">Pending</option>
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
        <span class="stat-label">Portfolios</span>
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

    <!-- Training Hub Section -->
    <section class="training-hub">
      <h3>Training & Learning</h3>
      <div class="hub-grid">
        <button class="hub-card" @click="navigateToTraining('LearningsManagement')">
          <span class="hub-icon">&#128161;</span>
          <span class="hub-label">Learnings</span>
          <span class="hub-description">Manage prediction rules & patterns</span>
        </button>
        <button class="hub-card" @click="navigateToTraining('AnalystManagement')">
          <span class="hub-icon">&#128101;</span>
          <span class="hub-label">Analysts</span>
          <span class="hub-description">Configure AI analyst personas</span>
        </button>
        <button class="hub-card" @click="navigateToTraining('MissedOpportunities')">
          <span class="hub-icon">&#128269;</span>
          <span class="hub-label">Missed Opportunities</span>
          <span class="hub-description">Analyze unpredicted moves</span>
        </button>
        <button class="hub-card" @click="navigateToTraining('LearningQueue')">
          <span class="hub-icon">&#128229;</span>
          <span class="hub-label">Learning Queue</span>
          <span class="hub-description">Review AI-suggested learnings</span>
        </button>
        <button class="hub-card" @click="navigateToTraining('TestLab')">
          <span class="hub-icon">&#128248;</span>
          <span class="hub-label">Test Lab</span>
          <span class="hub-description">Build & run test scenarios</span>
        </button>
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
        @take-position="onTakePosition"
      />
    </section>

    <!-- Take Position Modal -->
    <TakePositionModal
      :is-open="isTakePositionModalOpen"
      :prediction="selectedPredictionForPosition"
      @close="closeTakePositionModal"
      @position-created="handlePositionCreated"
    />

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
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonPage, IonContent, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle } from '@ionic/vue';
import { usePredictionStore } from '@/stores/predictionStore';
import { useAuthStore } from '@/stores/rbacStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import PredictionCard from '@/components/prediction/PredictionCard.vue';
import PredictionActivityFeed from '@/components/prediction/PredictionActivityFeed.vue';
import TakePositionModal from '@/components/prediction/TakePositionModal.vue';
import type { Prediction } from '@/services/predictionDashboardService';

const router = useRouter();
const route = useRoute();
const store = usePredictionStore();
const authStore = useAuthStore();
const agentsStore = useAgentsStore();

// Get agentSlug from query parameter (passed when clicking prediction agent in sidebar)
const agentSlug = computed(() => route.query.agentSlug as string | undefined);

// Look up the agent by slug to get its organizationSlug
const currentAgent = computed(() => {
  const slug = agentSlug.value;
  if (!slug) return null;
  return agentsStore.availableAgents.find(a => a.slug === slug || a.name === slug) || null;
});

// Get organization from agent (priority) or fall back to auth store
const effectiveOrg = computed(() => {
  // Priority 1: Agent's organizationSlug
  const agentOrg = currentAgent.value?.organizationSlug;
  if (agentOrg && agentOrg !== '*') {
    return Array.isArray(agentOrg) ? agentOrg[0] : agentOrg;
  }
  // Priority 2: Auth store's current organization (but not if it's '*')
  const authOrg = authStore.currentOrganization;
  if (authOrg && authOrg !== '*') {
    return authOrg;
  }
  return null;
});

const selectedUniverse = ref<string | null>(null);
const statusFilter = ref<'all' | 'active' | 'resolved' | 'expired' | 'cancelled'>('all');
const domainFilter = ref<string | null>(null);
const outcomeFilter = ref<'correct' | 'incorrect' | 'pending' | null>(null);
const showActivityFeed = ref(false);

// Take Position Modal state
const isTakePositionModalOpen = ref(false);
const selectedPredictionForPosition = ref<{
  id: string;
  symbol: string;
  direction: 'bullish' | 'bearish';
  confidence: number;
  magnitudePercent?: number;
  rationale?: string;
} | null>(null);

const hasFilters = computed(() => {
  return selectedUniverse.value !== null || statusFilter.value !== 'all' || domainFilter.value !== null || outcomeFilter.value !== null;
});

async function loadData() {
  // Get organization from agent (not from global auth store which may be '*')
  const org = effectiveOrg.value;
  if (!org) {
    console.log('[PredictionDashboard] Waiting for organization context from agent...');
    store.setError('No organization context available. Please select a prediction agent from the agents panel.');
    return;
  }

  // Set the organization and agent slug for API calls
  const agent = agentSlug.value || 'us-tech-stocks';
  predictionDashboardService.setOrgSlug(org);
  predictionDashboardService.setAgentSlug(agent);

  // Debug: Log the organization and agent being used
  console.log('[PredictionDashboard] Loading data for org:', org, 'agent:', agent, '(from agent:', currentAgent.value?.name, ')');

  store.setLoading(true);
  store.clearError();

  try {
    const data = await predictionDashboardService.loadDashboardData(
      selectedUniverse.value || undefined,
      agentSlug.value
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
    outcome: outcomeFilter.value,
  });
}

function onPredictionSelect(id: string) {
  store.selectPrediction(id);
  router.push({ name: 'PredictionDetail', params: { id } });
}

// Map categorical magnitude to percentage
function magnitudeToPercent(magnitude?: number | string): number | undefined {
  if (!magnitude) return undefined;
  const mag = String(magnitude).toLowerCase();
  switch (mag) {
    case 'small': return 2;
    case 'medium': return 5;
    case 'large': return 10;
    default: return typeof magnitude === 'number' ? magnitude : undefined;
  }
}

function onTakePosition(prediction: Prediction) {
  // Only allow positions for directional predictions
  if (prediction.direction !== 'up' && prediction.direction !== 'down') return;

  selectedPredictionForPosition.value = {
    id: prediction.id,
    symbol: prediction.targetSymbol || '',
    direction: prediction.direction === 'up' ? 'bullish' : 'bearish',
    confidence: prediction.confidence || 0,
    magnitudePercent: magnitudeToPercent(prediction.magnitude),
    rationale: prediction.rationale || `${prediction.direction.toUpperCase()} prediction with ${Math.round((prediction.confidence || 0) * 100)}% confidence`,
  };
  isTakePositionModalOpen.value = true;
}

function closeTakePositionModal() {
  isTakePositionModalOpen.value = false;
  selectedPredictionForPosition.value = null;
}

function handlePositionCreated(result: { positionId: string; symbol: string }) {
  console.log('Position created from dashboard:', result);
  // Modal closes automatically after success
  // Optionally refresh data or show notification
}

function goToPage(page: number) {
  store.setPage(page);
  loadData();
}

function goToPortfolios() {
  router.push({ name: 'PortfolioManagement' });
}

function goToTradingDashboard() {
  router.push({ name: 'TradingDashboard' });
}

function navigateToTraining(screenName: string) {
  router.push({ name: screenName });
}

// Watch for organization context to become available (from agent or auth store)
watch(
  [effectiveOrg, agentSlug],
  ([newOrg, newAgentSlug]) => {
    if (newOrg) {
      console.log('[PredictionDashboard] Org/agent changed:', newOrg, newAgentSlug);
      loadData();
    }
  },
  { immediate: true }
);

// Content ref for scroll control
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

onMounted(async () => {
  // Scroll to top when page loads
  if (contentRef.value) {
    await contentRef.value.$el.scrollToTop(0);
  }

  // Note: Data loading is handled by the watch on effectiveOrg
  // which fires immediately. No need to call loadData() here.
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
  /* Leave space on the right for the fixed toolbar (org switcher, theme toggle, profile) */
  padding-right: 200px;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

/* Activity Feed Section */
.activity-feed-section {
  margin-bottom: 1.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.header-actions .spacer {
  flex: 1;
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

/* Training Hub */
.training-hub {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
}

.training-hub h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  margin: 0 0 1rem 0;
  letter-spacing: 0.05em;
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.hub-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--hub-card-bg, #f9fafb);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.hub-card:hover {
  background: var(--hub-card-hover, #f3f4f6);
  border-color: var(--primary-color, #3b82f6);
  transform: translateY(-1px);
}

.hub-icon {
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
}

.hub-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.hub-description {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  line-height: 1.3;
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
    --hub-card-bg: #374151;
    --hub-card-hover: #4b5563;
  }
}
</style>
