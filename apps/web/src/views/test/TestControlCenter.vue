<script setup lang="ts">
/**
 * TestControlCenter View (SCR-001)
 *
 * Main hub for Test Data Management UI (Phase 3).
 * Shows status counts, quick actions, and links to all test management screens.
 */

import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import TestModeIndicator from '@/components/test/TestModeIndicator.vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import { useTestScenarioStore } from '@/stores/testScenarioStore';
import { useTestArticleStore } from '@/stores/testArticleStore';
import { useTestPriceDataStore } from '@/stores/testPriceDataStore';
import { useTestTargetMirrorStore } from '@/stores/testTargetMirrorStore';

const router = useRouter();
const scenarioStore = useTestScenarioStore();
const articleStore = useTestArticleStore();
const priceStore = useTestPriceDataStore();
const mirrorStore = useTestTargetMirrorStore();

// Loading states
const isLoading = ref(true);
const error = ref<string | null>(null);

// Stats
const stats = ref({
  scenarios: { total: 0, active: 0, running: 0, completed: 0 },
  articles: { total: 0, processed: 0, unprocessed: 0 },
  priceData: { total: 0, symbols: 0 },
  mirrors: { total: 0 },
});

// Recent activity (placeholder)
const recentRuns = ref<Array<{
  id: string;
  scenarioName: string;
  status: string;
  completedAt: string;
}>>([]);

// Load data
async function loadData() {
  isLoading.value = true;
  error.value = null;

  try {
    // Load scenarios
    const scenariosRes = await predictionDashboardService.getTestScenarioSummaries();
    if (scenariosRes.content) {
      scenarioStore.setScenarios(scenariosRes.content);
      stats.value.scenarios = {
        total: scenariosRes.content.length,
        active: scenariosRes.content.filter((s) => s.status === 'active').length,
        running: scenariosRes.content.filter((s) => s.status === 'running').length,
        completed: scenariosRes.content.filter((s) => s.status === 'completed').length,
      };

      // Get recent completed runs
      recentRuns.value = scenariosRes.content
        .filter((s) => s.status === 'completed' && s.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
        .slice(0, 5)
        .map((s) => ({
          id: s.id,
          scenarioName: s.name,
          status: s.status,
          completedAt: s.completed_at!,
        }));
    }

    // Load articles
    const articlesRes = await predictionDashboardService.listTestArticles();
    if (articlesRes.content) {
      articleStore.setArticles(articlesRes.content);
      stats.value.articles = {
        total: articlesRes.content.length,
        processed: articlesRes.content.filter((a) => a.is_processed).length,
        unprocessed: articlesRes.content.filter((a) => !a.is_processed).length,
      };
    }

    // Load price data
    const pricesRes = await predictionDashboardService.listTestPriceData();
    if (pricesRes.content) {
      priceStore.setPriceData(pricesRes.content);
      const symbols = new Set(pricesRes.content.map((p) => p.symbol));
      stats.value.priceData = {
        total: pricesRes.content.length,
        symbols: symbols.size,
      };
    }

    // Load mirrors
    const mirrorsRes = await predictionDashboardService.listTestTargetMirrors({ includeTargetDetails: true });
    if (mirrorsRes.content) {
      mirrorStore.setMirrors(mirrorsRes.content as any);
      stats.value.mirrors = {
        total: mirrorsRes.content.length,
      };
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  } finally {
    isLoading.value = false;
  }
}

// Navigation
function navigateTo(route: string) {
  router.push(route);
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  loadData();
});

// Quick actions
const quickActions = [
  {
    label: 'Create Scenario',
    icon: 'plus',
    route: '/app/test/scenarios/new',
    color: 'primary',
  },
  {
    label: 'Add Test Article',
    icon: 'file-text',
    route: '/app/test/articles',
    color: 'secondary',
  },
  {
    label: 'Manage Mirrors',
    icon: 'git-branch',
    route: '/app/test/targets',
    color: 'secondary',
  },
  {
    label: 'View Test Lab',
    icon: 'beaker',
    route: '/app/prediction/test-lab',
    color: 'secondary',
  },
];
</script>

<template>
  <div class="test-control-center">
    <TestModeIndicator message="Test Data Management" />

    <div class="test-control-center__content">
      <!-- Header -->
      <header class="test-control-center__header">
        <h1 class="test-control-center__title">Test Control Center</h1>
        <p class="test-control-center__subtitle">
          Manage test scenarios, synthetic articles, price data, and target mirrors
        </p>
      </header>

      <!-- Error State -->
      <div v-if="error" class="test-control-center__error">
        <p>{{ error }}</p>
        <button @click="loadData">Retry</button>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoading" class="test-control-center__loading">
        <div class="test-control-center__spinner" />
        <p>Loading test data...</p>
      </div>

      <!-- Main Content -->
      <template v-else>
        <!-- Stats Grid -->
        <section class="test-control-center__stats">
          <!-- Scenarios -->
          <div
            class="stat-card stat-card--scenarios"
            @click="navigateTo('/app/prediction/test-lab')"
          >
            <div class="stat-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
            </div>
            <div class="stat-card__content">
              <div class="stat-card__value">{{ stats.scenarios.total }}</div>
              <div class="stat-card__label">Test Scenarios</div>
              <div class="stat-card__breakdown">
                <span>{{ stats.scenarios.active }} active</span>
                <span>{{ stats.scenarios.running }} running</span>
              </div>
            </div>
          </div>

          <!-- Articles -->
          <div
            class="stat-card stat-card--articles"
            @click="navigateTo('/app/test/articles')"
          >
            <div class="stat-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div class="stat-card__content">
              <div class="stat-card__value">{{ stats.articles.total }}</div>
              <div class="stat-card__label">Test Articles</div>
              <div class="stat-card__breakdown">
                <span>{{ stats.articles.unprocessed }} unprocessed</span>
              </div>
            </div>
          </div>

          <!-- Price Data -->
          <div
            class="stat-card stat-card--prices"
            @click="navigateTo('/app/test/prices')"
          >
            <div class="stat-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            <div class="stat-card__content">
              <div class="stat-card__value">{{ stats.priceData.total }}</div>
              <div class="stat-card__label">Price Data Points</div>
              <div class="stat-card__breakdown">
                <span>{{ stats.priceData.symbols }} symbols</span>
              </div>
            </div>
          </div>

          <!-- Mirrors -->
          <div
            class="stat-card stat-card--mirrors"
            @click="navigateTo('/app/test/targets')"
          >
            <div class="stat-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                <path d="M11 18H8a2 2 0 0 1-2-2V9" />
              </svg>
            </div>
            <div class="stat-card__content">
              <div class="stat-card__value">{{ stats.mirrors.total }}</div>
              <div class="stat-card__label">Target Mirrors</div>
              <div class="stat-card__breakdown">
                <span>Production → Test mappings</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Quick Actions -->
        <section class="test-control-center__actions">
          <h2 class="section-title">Quick Actions</h2>
          <div class="action-grid">
            <button
              v-for="action in quickActions"
              :key="action.route"
              :class="['action-btn', `action-btn--${action.color}`]"
              @click="navigateTo(action.route)"
            >
              <span class="action-btn__label">{{ action.label }}</span>
            </button>
          </div>
        </section>

        <!-- Recent Runs -->
        <section v-if="recentRuns.length" class="test-control-center__recent">
          <h2 class="section-title">Recent Test Runs</h2>
          <div class="recent-list">
            <div
              v-for="run in recentRuns"
              :key="run.id"
              class="recent-item"
              @click="navigateTo(`/app/prediction/test-lab`)"
            >
              <div class="recent-item__name">{{ run.scenarioName }}</div>
              <div class="recent-item__status">{{ run.status }}</div>
              <div class="recent-item__date">{{ formatDate(run.completedAt) }}</div>
            </div>
          </div>
        </section>

        <!-- Navigation Links -->
        <section class="test-control-center__nav">
          <h2 class="section-title">Test Data Management</h2>
          <div class="nav-grid">
            <RouterLink to="/app/test/targets" class="nav-card">
              <h3>Targets & Mirrors</h3>
              <p>Map production targets to T_ prefixed test symbols</p>
            </RouterLink>
            <RouterLink to="/app/test/articles" class="nav-card">
              <h3>Synthetic Articles</h3>
              <p>Create and manage test articles for signal detection</p>
            </RouterLink>
            <RouterLink to="/app/test/prices" class="nav-card">
              <h3>Price Timeline</h3>
              <p>Manage OHLCV price data for test scenarios</p>
            </RouterLink>
            <RouterLink to="/app/test/scenarios/new" class="nav-card">
              <h3>Scenario Builder</h3>
              <p>Create new test scenarios with guided workflow</p>
            </RouterLink>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.test-control-center {
  min-height: 100vh;
  background: #f9fafb;
}

.test-control-center__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.test-control-center__header {
  margin-bottom: 2rem;
}

.test-control-center__title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.test-control-center__subtitle {
  font-size: 1rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}

.test-control-center__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  text-align: center;
  color: #dc2626;
}

.test-control-center__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #6b7280;
}

.test-control-center__spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Stats Grid */
.test-control-center__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.stat-card__icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.stat-card--scenarios .stat-card__icon {
  background: #dbeafe;
  color: #2563eb;
}

.stat-card--articles .stat-card__icon {
  background: #d1fae5;
  color: #059669;
}

.stat-card--prices .stat-card__icon {
  background: #fef3c7;
  color: #d97706;
}

.stat-card--mirrors .stat-card__icon {
  background: #ede9fe;
  color: #7c3aed;
}

.stat-card__value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.stat-card__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.stat-card__breakdown {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

/* Section Title */
.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem;
}

/* Quick Actions */
.test-control-center__actions {
  margin-bottom: 2rem;
}

.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.action-btn {
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn--primary {
  background: #2563eb;
  color: white;
}

.action-btn--primary:hover {
  background: #1d4ed8;
}

.action-btn--secondary {
  background: white;
  color: #374151;
  border: 1px solid #e5e7eb;
}

.action-btn--secondary:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* Recent Runs */
.test-control-center__recent {
  margin-bottom: 2rem;
}

.recent-list {
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.recent-item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s ease;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background: #f9fafb;
}

.recent-item__name {
  font-weight: 500;
  color: #111827;
}

.recent-item__status {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: #d1fae5;
  color: #059669;
  border-radius: 9999px;
}

.recent-item__date {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Navigation Grid */
.test-control-center__nav {
  margin-bottom: 2rem;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.nav-card {
  display: block;
  padding: 1.25rem;
  background: white;
  border-radius: 0.5rem;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.nav-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.nav-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem;
}

.nav-card p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .test-control-center {
    background: #111827;
  }

  .test-control-center__title {
    color: #f9fafb;
  }

  .test-control-center__subtitle {
    color: #9ca3af;
  }

  .stat-card,
  .nav-card,
  .recent-list {
    background: #1f2937;
  }

  .stat-card__value,
  .nav-card h3 {
    color: #f9fafb;
  }

  .stat-card__label,
  .section-title {
    color: #e5e7eb;
  }

  .recent-item__name {
    color: #f9fafb;
  }

  .recent-item {
    border-bottom-color: #374151;
  }

  .recent-item:hover {
    background: #374151;
  }

  .action-btn--secondary {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #4b5563;
  }

  .action-btn--secondary:hover {
    background: #374151;
  }
}
</style>
