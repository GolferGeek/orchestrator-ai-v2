<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="trading-dashboard">
        <!-- Header -->
        <header class="dashboard-header">
          <div class="header-left">
            <button class="back-button" @click="goBackToDashboard">
              <span class="back-icon">&larr;</span>
              Back to Dashboard
            </button>
            <h1>Trading Dashboard</h1>
            <p class="subtitle">Your portfolio and analyst performance</p>
          </div>
        </header>

        <!-- My Portfolio Section -->
        <section class="portfolio-section">
          <h2>My Portfolio</h2>

          <div v-if="portfolioLoading" class="loading-state">
            <div class="spinner"></div>
            <span>Loading portfolio...</span>
          </div>

          <div v-else-if="portfolioError" class="error-state">
            <span class="error-icon">!</span>
            <span>{{ portfolioError }}</span>
            <button class="btn btn-secondary" @click="loadPortfolio">Retry</button>
          </div>

          <div v-else-if="portfolio" class="portfolio-content">
            <!-- Balance Cards -->
            <div class="balance-grid">
              <div class="balance-card">
                <span class="label">Current Balance</span>
                <span class="value">${{ formatNumber(portfolio.portfolio.currentBalance) }}</span>
              </div>
              <div class="balance-card" :class="pnlClass(portfolio.summary.totalRealizedPnl)">
                <span class="label">Realized P&L</span>
                <span class="value">{{ formatPnl(portfolio.summary.totalRealizedPnl) }}</span>
              </div>
              <div class="balance-card" :class="pnlClass(portfolio.summary.totalUnrealizedPnl)">
                <span class="label">Unrealized P&L</span>
                <span class="value">{{ formatPnl(portfolio.summary.totalUnrealizedPnl) }}</span>
              </div>
              <div class="balance-card">
                <span class="label">Win Rate</span>
                <span class="value">{{ (portfolio.summary.winRate * 100).toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Open Positions -->
            <div class="positions-section">
              <h3>Open Positions ({{ portfolio.openPositions.length }})</h3>
              <div v-if="portfolio.openPositions.length === 0" class="empty-positions">
                <p>No open positions. Use predictions to take positions!</p>
                <button class="btn btn-primary" @click="goToPredictions">
                  View Predictions
                </button>
              </div>
              <table v-else class="positions-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Direction</th>
                    <th>Qty</th>
                    <th>Entry</th>
                    <th>Current</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pos in portfolio.openPositions" :key="pos.id">
                    <td class="symbol">{{ pos.symbol }}</td>
                    <td>
                      <span class="direction-badge" :class="pos.direction">
                        {{ pos.direction.toUpperCase() }}
                      </span>
                    </td>
                    <td>{{ pos.quantity }}</td>
                    <td>${{ pos.entryPrice.toFixed(2) }}</td>
                    <td>${{ pos.currentPrice.toFixed(2) }}</td>
                    <td :class="pnlClass(pos.unrealizedPnl)">
                      {{ formatPnl(pos.unrealizedPnl) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Analyst Leaderboard Section -->
        <section class="leaderboard-section">
          <h2>Analyst Leaderboard</h2>
          <p class="section-desc">Compare analyst performance: User Fork vs Agent Fork</p>

          <div v-if="leaderboardLoading" class="loading-state">
            <div class="spinner"></div>
            <span>Loading analysts...</span>
          </div>

          <div v-else-if="leaderboardError" class="error-state">
            <span class="error-icon">!</span>
            <span>{{ leaderboardError }}</span>
            <button class="btn btn-secondary" @click="loadLeaderboard">Retry</button>
          </div>

          <div v-else-if="leaderboard">
            <!-- Summary Stats -->
            <div class="leaderboard-summary">
              <div class="summary-stat">
                <span class="stat-value">{{ leaderboard.summary.totalAnalysts }}</span>
                <span class="stat-label">Total Analysts</span>
              </div>
              <div class="summary-stat agent">
                <span class="stat-value">{{ leaderboard.summary.agentOutperforming }}</span>
                <span class="stat-label">Agent Winning</span>
              </div>
              <div class="summary-stat user">
                <span class="stat-value">{{ leaderboard.summary.userOutperforming }}</span>
                <span class="stat-label">User Winning</span>
              </div>
            </div>

            <!-- Analyst Table -->
            <table class="leaderboard-table">
              <thead>
                <tr>
                  <th>Analyst</th>
                  <th>User Fork P&L</th>
                  <th>Agent Fork P&L</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="analyst in leaderboard.comparisons"
                  :key="analyst.analyst_id"
                  @click="viewAnalyst(analyst.analyst_id)"
                  class="analyst-row"
                >
                  <td>
                    <div class="analyst-info">
                      <span class="analyst-name">{{ analyst.name }}</span>
                      <span class="analyst-perspective">{{ analyst.perspective }}</span>
                    </div>
                  </td>
                  <td :class="pnlClass(analyst.user_pnl)">
                    {{ formatPnl(analyst.user_pnl) }}
                    <span class="win-loss">({{ analyst.user_win_count }}W/{{ analyst.user_loss_count }}L)</span>
                  </td>
                  <td :class="pnlClass(analyst.agent_pnl)">
                    {{ formatPnl(analyst.agent_pnl) }}
                    <span class="win-loss">({{ analyst.agent_win_count }}W/{{ analyst.agent_loss_count }}L)</span>
                  </td>
                  <td :class="pnlClass(analyst.pnl_difference)">
                    {{ formatPnl(analyst.pnl_difference) }}
                  </td>
                  <td>
                    <span class="status-badge" :class="analyst.comparison_status">
                      {{ formatStatus(analyst.comparison_status) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { IonPage, IonContent } from '@ionic/vue';
import {
  predictionDashboardService,
  type UserPortfolioSummary,
  type AnalystForksSummary,
} from '@/services/predictionDashboardService';
import { useAgentsStore } from '@/stores/agentsStore';
import { useAuthStore } from '@/stores/rbacStore';

const router = useRouter();
const route = useRoute();
const agentsStore = useAgentsStore();
const authStore = useAuthStore();

// Get agentSlug from query parameter or default to 'us-tech-stocks'
const agentSlug = computed(() => (route.query.agentSlug as string) || 'us-tech-stocks');

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
  // Fallback: Default org for the default agent
  return 'finance';
});

// Portfolio state
const portfolio = ref<UserPortfolioSummary | null>(null);
const portfolioLoading = ref(false);
const portfolioError = ref<string | null>(null);

// Leaderboard state
const leaderboard = ref<AnalystForksSummary | null>(null);
const leaderboardLoading = ref(false);
const leaderboardError = ref<string | null>(null);

// Set service context and load data on mount
onMounted(() => {
  // Set the organization and agent slug for API calls
  predictionDashboardService.setOrgSlug(effectiveOrg.value);
  predictionDashboardService.setAgentSlug(agentSlug.value);

  loadPortfolio();
  loadLeaderboard();
});

async function loadPortfolio() {
  portfolioLoading.value = true;
  portfolioError.value = null;

  try {
    const response = await predictionDashboardService.getUserPortfolio();
    if (response.content) {
      portfolio.value = response.content;
    } else {
      portfolioError.value = 'Failed to load portfolio';
    }
  } catch (err) {
    portfolioError.value = err instanceof Error ? err.message : 'Failed to load portfolio';
  } finally {
    portfolioLoading.value = false;
  }
}

async function loadLeaderboard() {
  leaderboardLoading.value = true;
  leaderboardError.value = null;

  try {
    const response = await predictionDashboardService.getAnalystForksSummary();
    if (response.content) {
      leaderboard.value = response.content;
    } else {
      leaderboardError.value = 'Failed to load leaderboard';
    }
  } catch (err) {
    leaderboardError.value = err instanceof Error ? err.message : 'Failed to load leaderboard';
  } finally {
    leaderboardLoading.value = false;
  }
}

function goToPredictions() {
  router.push({
    name: 'PredictionDashboard',
    query: agentSlug.value ? { agentSlug: agentSlug.value } : undefined,
  });
}

function goBackToDashboard() {
  router.push({
    name: 'PredictionDashboard',
    query: agentSlug.value ? { agentSlug: agentSlug.value } : undefined,
  });
}

function viewAnalyst(analystId: string) {
  router.push({ name: 'AnalystDetail', params: { id: analystId } });
}

// Formatting helpers
function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPnl(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${formatNumber(value)}`;
}

function pnlClass(value: number): string {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function formatStatus(status: string): string {
  switch (status) {
    case 'agent_winning': return 'Agent Winning';
    case 'user_winning': return 'User Winning';
    case 'tied': return 'Tied';
    case 'warning': return 'Warning';
    default: return status;
  }
}
</script>

<style scoped>
.trading-dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: color 0.2s;
}

.back-button:hover {
  color: var(--primary-color, #3b82f6);
}

.back-icon {
  font-size: 1rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin: 0;
}

.subtitle {
  color: var(--ion-color-medium);
  margin-top: 0.5rem;
}

/* Portfolio Section */
.portfolio-section,
.leaderboard-section {
  background: var(--ion-card-background);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.portfolio-section h2,
.leaderboard-section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
}

.section-desc {
  color: var(--ion-color-medium);
  margin: -0.5rem 0 1rem 0;
  font-size: 0.9rem;
}

/* Balance Grid */
.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.balance-card {
  background: var(--ion-background-color);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.balance-card .label {
  display: block;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.25rem;
}

.balance-card .value {
  font-size: 1.5rem;
  font-weight: 600;
}

.balance-card.positive .value { color: #22c55e; }
.balance-card.negative .value { color: #ef4444; }

/* Positions Table */
.positions-section h3 {
  font-size: 1rem;
  margin: 0 0 1rem 0;
}

.empty-positions {
  text-align: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.positions-table,
.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.positions-table th,
.positions-table td,
.leaderboard-table th,
.leaderboard-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--ion-border-color);
}

.positions-table th,
.leaderboard-table th {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.symbol {
  font-weight: 600;
}

.direction-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.direction-badge.long { background: #22c55e20; color: #22c55e; }
.direction-badge.short { background: #ef444420; color: #ef4444; }

/* P&L Colors */
.positive { color: #22c55e; }
.negative { color: #ef4444; }
.neutral { color: var(--ion-color-medium); }

/* Leaderboard Summary */
.leaderboard-summary {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.summary-stat {
  text-align: center;
}

.summary-stat .stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
}

.summary-stat .stat-label {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.summary-stat.agent .stat-value { color: #3b82f6; }
.summary-stat.user .stat-value { color: #8b5cf6; }

/* Analyst Row */
.analyst-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.analyst-row:hover {
  background: var(--ion-color-light);
}

.analyst-info {
  display: flex;
  flex-direction: column;
}

.analyst-name {
  font-weight: 600;
}

.analyst-perspective {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.win-loss {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-left: 0.5rem;
}

/* Status Badge */
.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.agent_winning { background: #3b82f620; color: #3b82f6; }
.status-badge.user_winning { background: #8b5cf620; color: #8b5cf6; }
.status-badge.tied { background: var(--ion-color-light); color: var(--ion-color-medium); }
.status-badge.warning { background: #f59e0b20; color: #f59e0b; }

/* Loading/Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--ion-color-light);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #ef444420;
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--ion-color-primary);
  color: white;
}

.btn-secondary {
  background: var(--ion-color-light);
  color: var(--ion-text-color);
}
</style>
