<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Evaluations</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="toggleAutoRefresh" :color="autoRefreshEnabled ? 'primary' : 'medium'">
          <ion-icon :icon="refreshOutline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button fill="clear" size="small" @click="manualRefresh" :disabled="isLoading">
          <ion-icon :icon="refreshOutline" slot="icon-only" :class="{ 'rotating': isLoading }"></ion-icon>
        </ion-button>
        <ion-button fill="clear" size="small" @click="showExportModal = true">
          <ion-icon :icon="downloadOutline" slot="icon-only"></ion-icon>
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <!-- Last Refresh Indicator -->
      <ion-item lines="none" class="refresh-indicator">
        <ion-icon :icon="refreshOutline" slot="start" size="small" color="medium"></ion-icon>
        <ion-label>
          <small>Last updated: {{ formatLastRefreshTime() }}</small>
        </ion-label>
        <ion-note slot="end" color="medium">
          <small>{{ autoRefreshEnabled ? 'Auto-refresh every 30s' : 'Auto-refresh disabled' }}</small>
        </ion-note>
      </ion-item>
      <!-- Tab Navigation -->
      <ion-segment v-model="activeTab" @ionChange="onTabChange">
        <ion-segment-button value="overview">
          <ion-label>Overview</ion-label>
        </ion-segment-button>
        <ion-segment-button value="evaluations">
          <ion-label>All Evaluations</ion-label>
        </ion-segment-button>
        <ion-segment-button value="analytics">
          <ion-label>Analytics</ion-label>
        </ion-segment-button>
        <ion-segment-button value="workflows">
          <ion-label>Workflows</ion-label>
        </ion-segment-button>
      </ion-segment>
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'">
        <AdminEvaluationOverview
          :analytics="analytics as any"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>
      <!-- All Evaluations Tab -->
      <div v-if="activeTab === 'evaluations'">
        <AdminEvaluationsList
          :evaluations="evaluations as any"
          :pagination="pagination"
          :is-loading="isLoading"
          :filters="filters as any"
          @filter-change="onFilterChange"
          @page-change="onPageChange"
          @refresh="refreshData"
        />
      </div>
      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'">
        <AdminAnalyticsView
          :analytics="analytics as any"
          :workflow-analytics="workflowAnalytics as any"
          :constraint-analytics="constraintAnalytics as any"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>
      <!-- Workflows Tab -->
      <div v-if="activeTab === 'workflows'">
        <AdminWorkflowsView
          :workflow-analytics="workflowAnalytics as any"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>
      <!-- Error State -->
      <ion-card v-if="error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <h3>Error Loading Admin Data</h3>
            <p>{{ error }}</p>
          </ion-text>
          <ion-button fill="clear" color="light" @click="refreshData">
            Try Again
          </ion-button>
        </ion-card-content>
      </ion-card>

    <!-- Export Modal -->
    <AdminExportModal
      :is-open="showExportModal"
      @dismiss="showExportModal = false"
      @export="onExport"
    />
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonText,
  IonItem,
  IonNote
} from '@ionic/vue';
import {
  refreshOutline,
  downloadOutline
} from 'ionicons/icons';
// Import admin components (we'll create these)
import AdminEvaluationOverview from '@/components/Admin/AdminEvaluationOverview.vue';
import AdminEvaluationsList from '@/components/Admin/AdminEvaluationsList.vue';
import AdminAnalyticsView from '@/components/Admin/AdminAnalyticsView.vue';
import AdminWorkflowsView from '@/components/Admin/AdminWorkflowsView.vue';
import AdminExportModal from '@/components/Admin/AdminExportModal.vue';
// Import admin service
import { useAdminEvaluationStore, type AdminEvaluationFilters, type EnhancedEvaluationMetadata } from '@/stores/adminEvaluationStore';
// Import types
import type { AllEvaluationsFilters } from '@/types/evaluation';
import type { WorkflowAnalytics, ConstraintAnalytics, ExportConfig } from '@/types/analytics';
const adminStore = useAdminEvaluationStore();
const route = useRoute();
const _router = useRouter();
// Reactive state
const activeTab = ref('overview');
const refreshInterval = ref<NodeJS.Timeout | null>(null);
const lastRefreshTime = ref<Date>(new Date());
const autoRefreshEnabled = ref(true);
const showExportModal = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);
// PaginationInfo type
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// AdminEvaluationAnalytics type (from store)
interface AdminEvaluationAnalytics {
  totalEvaluations: number;
  averageRating: number;
  averageSpeedRating: number;
  averageAccuracyRating: number;
  averageWorkflowCompletionRate: number;
  averageResponseTime: number;
  averageCost: number;
  ratingDistribution: Record<string, number>;
  topPerformingAgents: Array<{
    agentName: string;
    averageRating: number;
    evaluationCount: number;
  }>;
  topConstraints: Array<{
    constraintName: string;
    effectivenessScore: number;
    usageCount: number;
  }>;
  workflowFailurePoints: Array<{
    stepName: string;
    failureRate: number;
    averageDuration: number;
  }>;
}

// Data from store
const evaluations = ref<EnhancedEvaluationMetadata[]>([]);
const pagination = ref<PaginationInfo>({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
});
const analytics = ref<AdminEvaluationAnalytics | null>(null);
const workflowAnalytics = ref<WorkflowAnalytics | null>(null);
const constraintAnalytics = ref<ConstraintAnalytics | null>(null);
// Filters
const filters = reactive<AdminEvaluationFilters>({
  page: 1,
  limit: 20,
  minRating: undefined,
  maxRating: undefined,
  agentName: '',
  userEmail: '',
  startDate: '',
  endDate: '',
  hasNotes: undefined,
  hasWorkflowSteps: undefined,
  hasConstraints: undefined
});
onMounted(async () => {
  await refreshData();
  startAutoRefresh();
  setupFocusRefresh();
});
onUnmounted(() => {
  stopAutoRefresh();
  cleanupFocusRefresh();
});
// Watch for route changes to refresh data when navigating to this page
watch(() => route.path, async (newPath) => {
  if (newPath === '/admin/evaluations') {
    await refreshData();
  }
}, { immediate: true });
// Auto-refresh functionality
function startAutoRefresh() {
  // Refresh every 30 seconds
  refreshInterval.value = setInterval(async () => {
    if (!isLoading.value && autoRefreshEnabled.value) {
      await refreshData();
      lastRefreshTime.value = new Date();
    }
  }, 30000); // 30 seconds
}
function stopAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
}
// Focus-based refresh functionality
function setupFocusRefresh() {
  // Refresh when window/tab becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden && !isLoading.value && autoRefreshEnabled.value) {
      // Only refresh if it's been more than 10 seconds since last refresh
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.value.getTime();
      if (timeSinceLastRefresh > 10000) {
        refreshData();
      }
    }
  };
  // Refresh when window/tab gains focus
  const handleFocus = () => {
    if (!isLoading.value && autoRefreshEnabled.value) {
      // Only refresh if it's been more than 30 seconds since last refresh
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.value.getTime();
      if (timeSinceLastRefresh > 30000) {
        refreshData();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  // Store cleanup functions
  const cleanupFunctions = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
  // Store cleanup function for onUnmounted
  (window as unknown as Record<string, unknown>).__adminEvaluationsCleanup = cleanupFunctions;
}
function cleanupFocusRefresh() {
  if ((window as unknown as Record<string, unknown>).__adminEvaluationsCleanup) {
    ((window as unknown as Record<string, unknown>).__adminEvaluationsCleanup as () => void)();
    delete (window as unknown as Record<string, unknown>).__adminEvaluationsCleanup;
  }
}
async function refreshData() {
  isLoading.value = true;
  error.value = null;
  try {
    // Load data based on active tab
    switch (activeTab.value) {
      case 'overview':
        await loadOverviewData();
        break;
      case 'evaluations':
        await loadEvaluationsData();
        break;
      case 'analytics':
        await loadAnalyticsData();
        break;
      case 'workflows':
        await loadWorkflowData();
        break;
    }
    lastRefreshTime.value = new Date();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load admin data';

  } finally {
    isLoading.value = false;
  }
}
async function manualRefresh() {
  // Stop auto-refresh temporarily to avoid conflicts
  stopAutoRefresh();
  await refreshData();
  // Restart auto-refresh
  startAutoRefresh();
}
function formatLastRefreshTime(): string {
  if (!lastRefreshTime.value) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - lastRefreshTime.value.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
}
function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value;
  if (autoRefreshEnabled.value) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}
async function loadOverviewData() {
  analytics.value = await adminStore.fetchAnalytics();
}
async function loadEvaluationsData() {
  const result = await adminStore.fetchAllEvaluations(filters);
  evaluations.value = result.evaluations;
  pagination.value = result.pagination;
}
async function loadAnalyticsData() {
  const [analyticsData, workflowData, constraintData] = await Promise.all([
    adminStore.fetchAnalytics(),
    adminStore.fetchWorkflowAnalytics(),
    adminStore.fetchConstraintAnalytics()
  ]);
  analytics.value = analyticsData;
  workflowAnalytics.value = workflowData;
  constraintAnalytics.value = constraintData;
}
async function loadWorkflowData() {
  workflowAnalytics.value = await adminStore.fetchWorkflowAnalytics();
}
async function onTabChange(event: CustomEvent) {
  activeTab.value = event.detail.value;
  await refreshData();
}
function onFilterChange(newFilters: AllEvaluationsFilters) {
  Object.assign(filters, newFilters);
  loadEvaluationsData();
}
function onPageChange(page: number) {
  filters.page = page;
  loadEvaluationsData();
}
async function onExport(exportOptions: ExportConfig) {
  try {
    isLoading.value = true;
    // Convert ExportConfig to the format expected by exportEvaluations
    const exportParams = {
      format: exportOptions.format === 'excel' || exportOptions.format === 'pdf' || exportOptions.format === 'png' || exportOptions.format === 'svg' ? 'json' : exportOptions.format,
      includeUserData: exportOptions.includeRawData,
      includeContent: exportOptions.includeCharts,
      startDate: exportOptions.dateRange?.startDate,
      endDate: exportOptions.dateRange?.endDate
    };
    await adminStore.exportEvaluations(exportParams);
    showExportModal.value = false;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Export failed';
  } finally {
    isLoading.value = false;
  }
}
</script>
<style scoped>
/* Detail View Container */
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
ion-segment {
  margin-bottom: 20px;
}
.error-card {
  margin: 20px 0;
}
.refresh-indicator {
  --background: transparent;
  margin-bottom: 8px;
}
.rotating {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>