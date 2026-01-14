<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
          <ion-button fill="clear" class="nav-toggle" @click="toggleNav" v-if="isMobile">
            <ion-icon :icon="menuOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
        <ion-title>Admin Dashboard</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" size="small" @click="refreshSystemHealth" :disabled="healthLoading">
            <ion-icon :icon="refreshOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- Health Status Bar - Always visible at top -->
      <div class="health-status-bar" :class="overallHealthy ? 'healthy' : 'warning'">
        <div class="health-status-content">
          <ion-icon :icon="overallHealthy ? checkmarkCircleOutline : alertCircleOutline" />
          <span class="health-text">{{ overallHealthy ? 'All Systems Operational' : 'Issues Detected' }}</span>
          <span class="health-time">{{ lastHealthChecked }}</span>
        </div>
        <div class="quick-stats" v-if="healthData">
          <div class="stat">
            <span class="stat-value">{{ formatUptime(healthData.uptime) }}</span>
            <span class="stat-label">Uptime</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ healthData.memory?.utilization }}%</span>
            <span class="stat-label">Memory</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ agentsHealthData.discoveredAgents }}</span>
            <span class="stat-label">Agents</span>
          </div>
        </div>
      </div>

      <!-- Issues Alert (if any) -->
      <div class="issues-bar" v-if="healthIssues.length > 0">
        <div class="issue-alert" v-for="issue in healthIssues" :key="issue.service">
          <ion-icon :icon="alertCircleOutline" />
          <strong>{{ issue.service }}:</strong> {{ issue.message }}
        </div>
      </div>

      <!-- Master-Detail Layout -->
      <div class="master-detail-container">
        <!-- Left Navigation Panel -->
        <div class="nav-panel" :class="{ 'nav-open': navOpen }">
          <div class="nav-overlay" v-if="isMobile && navOpen" @click="closeNav"></div>
          <div class="nav-content">
            <!-- LLM Management Group -->
            <div class="nav-group">
              <div class="nav-group-header">
                <ion-icon :icon="sparklesOutline" />
                <span>LLM Management</span>
              </div>
              <div class="nav-items">
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'evaluations' }"
                  @click="selectSection('evaluations')"
                >
                  <ion-icon :icon="analyticsOutline" />
                  <span>Evaluations</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'llm-usage' }"
                  @click="selectSection('llm-usage')"
                >
                  <ion-icon :icon="barChartOutline" />
                  <span>LLM Usage</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'llms' }"
                  @click="selectSection('llms')"
                >
                  <ion-icon :icon="cubeOutline" />
                  <span>LLMs</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'pii' }"
                  @click="selectSection('pii')"
                >
                  <ion-icon :icon="shieldCheckmarkOutline" />
                  <span>PII Management</span>
                </div>
              </div>
            </div>

            <!-- Data & Access Group -->
            <div class="nav-group">
              <div class="nav-group-header">
                <ion-icon :icon="keyOutline" />
                <span>Data & Access</span>
              </div>
              <div class="nav-items">
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'rag' }"
                  @click="selectSection('rag')"
                >
                  <ion-icon :icon="serverOutline" />
                  <span>RAG Collections</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'finance-universes' }"
                  @click="selectSection('finance-universes')"
                  v-permission="'finance:admin'"
                >
                  <ion-icon :icon="trendingUpOutline" />
                  <span>Finance Portfolios</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'users' }"
                  @click="selectSection('users')"
                  v-permission="'admin:users'"
                >
                  <ion-icon :icon="peopleOutline" />
                  <span>Users</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'roles' }"
                  @click="selectSection('roles')"
                  v-permission="'admin:roles'"
                >
                  <ion-icon :icon="shieldOutline" />
                  <span>Roles</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'organizations' }"
                  @click="selectSection('organizations')"
                >
                  <ion-icon :icon="businessOutline" />
                  <span>Organizations</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'teams' }"
                  @click="selectSection('teams')"
                  v-permission="'admin:users'"
                >
                  <ion-icon :icon="peopleCircleOutline" />
                  <span>Teams</span>
                </div>
              </div>
            </div>

            <!-- Infrastructure Group -->
            <div class="nav-group">
              <div class="nav-group-header">
                <ion-icon :icon="hardwareChipOutline" />
                <span>Infrastructure</span>
              </div>
              <div class="nav-items">
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'database' }"
                  @click="selectSection('database')"
                >
                  <ion-icon :icon="serverOutline" />
                  <span>Database</span>
                  <ion-chip :color="getStatusColor(healthData?.services?.database)" size="small">
                    <ion-label>{{ healthData?.services?.database || '...' }}</ion-label>
                  </ion-chip>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'agents' }"
                  @click="selectSection('agents')"
                >
                  <ion-icon :icon="peopleOutline" />
                  <span>Agents</span>
                  <ion-chip :color="agentsHealthData.discoveredAgents > 0 ? 'success' : 'warning'" size="small">
                    <ion-label>{{ agentsHealthData.discoveredAgents }}</ion-label>
                  </ion-chip>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'mcp' }"
                  @click="selectSection('mcp')"
                >
                  <ion-icon :icon="extensionPuzzleOutline" />
                  <span>MCP & Tools</span>
                </div>
                <div
                  class="nav-item"
                  :class="{ active: activeSection === 'observability' }"
                  @click="selectSection('observability')"
                >
                  <ion-icon :icon="pulseOutline" />
                  <span>Observability</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Detail Panel -->
        <div class="detail-panel">
          <div class="detail-content" v-if="activeSection">
            <!-- Back button for sub-details -->
            <div class="detail-back" v-if="subDetail">
              <ion-button fill="clear" size="small" @click="clearSubDetail">
                <ion-icon :icon="arrowBackOutline" slot="start" />
                Back
              </ion-button>
            </div>

            <!-- Dynamic component rendering -->
            <component
              :is="currentDetailComponent"
              v-if="currentDetailComponent"
              :key="activeSection + (subDetail?.id || '')"
              @show-sub-detail="handleSubDetail"
              :sub-detail-id="subDetail?.id"
            />

            <!-- Placeholder when no section selected -->
            <div class="detail-placeholder" v-if="!currentDetailComponent">
              <ion-icon :icon="settingsOutline" />
              <h3>Select a section</h3>
              <p>Choose an item from the left panel to view details</p>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonChip,
  IonLabel,
  IonButtons,
  IonMenuButton,
  IonButton,
} from '@ionic/vue';
import {
  analyticsOutline,
  barChartOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  hardwareChipOutline,
  peopleOutline,
  settingsOutline,
  serverOutline,
  refreshOutline,
  cubeOutline,
  extensionPuzzleOutline,
  pulseOutline,
  businessOutline,
  menuOutline,
  arrowBackOutline,
  sparklesOutline,
  keyOutline,
  peopleCircleOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/rbacStore';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { apiService } from '@/services/apiService';

// Props for initial section (from router)
const props = defineProps<{
  initialSection?: string;
}>();

// Store and router
const _auth = useAuthStore();
const router = useRouter();
const route = useRoute();

// Initialize stores
const _privacyStore = usePrivacyStore();
const llmAnalyticsStore = useLLMAnalyticsStore();
const analyticsStore = useAnalyticsStore();

// Navigation state
const activeSection = ref<string>('');
const subDetail = ref<{ type: string; id: string } | null>(null);
const navOpen = ref(false);
const isMobile = ref(window.innerWidth < 992);

// Async component definitions
const detailComponents: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  evaluations: defineAsyncComponent(() => import('@/views/AdminEvaluationsPage.vue')),
  'llm-usage': defineAsyncComponent(() => import('@/views/admin/LlmUsageView.vue')),
  llms: defineAsyncComponent(() => import('@/views/admin/ProvidersModelsPage.vue')),
  pii: defineAsyncComponent(() => import('@/views/PIIManagementPage.vue')),
  rag: defineAsyncComponent(() => import('@/views/admin/RagCollectionsPage.vue')),
  'finance-universes': defineAsyncComponent(() => import('@/views/admin/FinanceUniversesPage.vue')),
  users: defineAsyncComponent(() => import('@/views/admin/UserManagementPage.vue')),
  roles: defineAsyncComponent(() => import('@/views/admin/RoleManagementPage.vue')),
  organizations: defineAsyncComponent(() => import('@/views/admin/OrganizationsAdminPage.vue')),
  teams: defineAsyncComponent(() => import('@/views/admin/TeamsAdminPage.vue')),
  database: defineAsyncComponent(() => import('@/views/admin/DatabaseAdminPage.vue')),
  agents: defineAsyncComponent(() => import('@/views/admin/AgentsAdminPage.vue')),
  mcp: defineAsyncComponent(() => import('@/views/admin/MCPAdminPage.vue')),
  observability: defineAsyncComponent(() => import('@/views/admin/AdminObservabilityView.vue')),
  // Sub-detail components
  'rag-collection': defineAsyncComponent(() => import('@/views/admin/RagCollectionDetailPage.vue')),
  'llm-usage-run': defineAsyncComponent(() => import('@/views/admin/LLMUsageDetailsPage.vue')),
};

// Current component based on selection
const currentDetailComponent = computed(() => {
  if (subDetail.value) {
    return detailComponents[subDetail.value.type] || null;
  }
  return detailComponents[activeSection.value] || null;
});

// Section selection
const selectSection = (section: string) => {
  activeSection.value = section;
  subDetail.value = null;
  if (isMobile.value) {
    navOpen.value = false;
  }
  // Update URL for deep linking
  router.replace({ query: { section } });
};

// Sub-detail handling
const handleSubDetail = (detail: { type: string; id: string }) => {
  subDetail.value = detail;
};

const clearSubDetail = () => {
  subDetail.value = null;
};

// Mobile navigation
const toggleNav = () => {
  navOpen.value = !navOpen.value;
};

const closeNav = () => {
  navOpen.value = false;
};

// Handle window resize
const handleResize = () => {
  isMobile.value = window.innerWidth < 992;
  if (!isMobile.value) {
    navOpen.value = false;
  }
};

// ============================================================================
// System Health State
// ============================================================================
const healthLoading = ref(false);
const healthData = ref<Record<string, unknown> | null>(null);
const dbHealthData = ref<Record<string, unknown> | null>(null);
const localModelStatusData = ref<Record<string, unknown> | null>(null);
const agentsHealthData = ref<{ discoveredAgents: number; runningInstances: number; agents: unknown[] }>({ discoveredAgents: 0, runningInstances: 0, agents: [] });
const monitoringStatusData = ref<Record<string, unknown> | null>(null);
const lastHealthChecked = ref('');

// Overall health computed
const overallHealthy = computed(() => {
  if (!healthData.value) return false;
  const services = healthData.value.services as Record<string, string> | undefined;
  const memory = healthData.value.memory as { utilization?: number } | undefined;
  const apiHealthy = services?.api === 'healthy';
  const dbHealthy = services?.database === 'healthy';
  const localModelsOk = !localModelStatusData.value || (localModelStatusData.value as { connected?: boolean }).connected !== false;
  const agentsOk = agentsHealthData.value.discoveredAgents > 0;
  const memoryOk = !memory || (memory.utilization ?? 0) < 90;
  return apiHealthy && dbHealthy && localModelsOk && agentsOk && memoryOk;
});

// Health issues computed
const healthIssues = computed(() => {
  const issuesList: Array<{ service: string; message: string }> = [];
  const services = healthData.value?.services as Record<string, string> | undefined;
  const memory = healthData.value?.memory as { utilization?: number; used?: number; total?: number } | undefined;

  if (services?.api !== 'healthy') {
    issuesList.push({ service: 'API Service', message: 'API service is not responding or unhealthy' });
  }
  if (services?.database !== 'healthy') {
    issuesList.push({ service: 'Database', message: 'Database connection is unavailable or unhealthy' });
  }
  if (localModelStatusData.value && (localModelStatusData.value as { connected?: boolean }).connected === false) {
    issuesList.push({ service: 'Local Models', message: 'Ollama service is not running (local models unavailable)' });
  }
  if (agentsHealthData.value.discoveredAgents === 0) {
    issuesList.push({ service: 'Agents', message: 'No agents are currently available' });
  }
  if (memory && (memory.utilization ?? 0) >= 90) {
    const usedGB = ((memory.used ?? 0) / 1024).toFixed(1);
    const totalGB = ((memory.total ?? 0) / 1024).toFixed(1);
    issuesList.push({ service: 'System Memory', message: `High memory usage: ${memory.utilization}% (${usedGB} GB / ${totalGB} GB)` });
  }
  return issuesList;
});

// Health helper methods
const getStatusColor = (status: string | undefined) => {
  if (!status) return 'medium';
  const s = status.toLowerCase();
  if (s === 'healthy' || s === 'ok' || s === 'operational') return 'success';
  if (s === 'unhealthy' || s === 'error') return 'danger';
  return 'warning';
};

const formatUptime = (ms: number | undefined) => {
  if (!ms) return 'N/A';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
};

// Health fetch methods
const fetchHealthData = async () => {
  try {
    const response = await apiService.get('/system/health');
    healthData.value = response as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to fetch system health:', error);
  }
};

const fetchDbHealth = async () => {
  try {
    const response = await apiService.get('/health/db');
    dbHealthData.value = response as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to fetch database health:', error);
  }
};

const fetchLocalModelStatus = async () => {
  try {
    const response = await apiService.get('/llm/local-models/status');
    localModelStatusData.value = response as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to fetch local model status:', error);
    localModelStatusData.value = null;
  }
};

const fetchAgentsHealth = async () => {
  try {
    const response = await apiService.get('/agents') as { discoveredAgents?: number; runningInstances?: number; agents?: unknown[] };
    if (response && typeof response === 'object') {
      agentsHealthData.value = {
        discoveredAgents: response.discoveredAgents || 0,
        runningInstances: response.runningInstances || 0,
        agents: response.agents || []
      };
    } else {
      agentsHealthData.value = { discoveredAgents: 0, runningInstances: 0, agents: [] };
    }
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    agentsHealthData.value = { discoveredAgents: 0, runningInstances: 0, agents: [] };
  }
};

const fetchMonitoringStatus = async () => {
  try {
    const response = await apiService.get('/llm/production/monitoring/status');
    monitoringStatusData.value = response as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to fetch monitoring status:', error);
    monitoringStatusData.value = { enabled: true, activeMonitors: 0 };
  }
};

const refreshSystemHealth = async () => {
  healthLoading.value = true;
  try {
    await Promise.all([
      fetchHealthData(),
      fetchDbHealth(),
      fetchLocalModelStatus(),
      fetchAgentsHealth(),
      fetchMonitoringStatus(),
    ]);
    lastHealthChecked.value = new Date().toLocaleString();
  } finally {
    healthLoading.value = false;
  }
};

// Initialize from route or props
const initializeSection = () => {
  const section = (route.query.section as string) || props.initialSection || '';
  if (section && detailComponents[section]) {
    activeSection.value = section;
  }
};

// Watch for route changes
watch(() => route.query.section, (newSection) => {
  if (newSection && typeof newSection === 'string' && detailComponents[newSection]) {
    activeSection.value = newSection;
    subDetail.value = null;
  }
});

// Lifecycle
onMounted(async () => {
  window.addEventListener('resize', handleResize);
  initializeSection();

  try {
    await Promise.all([
      llmAnalyticsStore.initialize(),
      analyticsStore.initialize?.() || Promise.resolve(),
      refreshSystemHealth()
    ]);
  } catch (error) {
    console.error('Failed to load admin settings data:', error);
  }
});
</script>

<style scoped>
/* ============================================================================
   Health Status Bar - Top Banner
   ============================================================================ */
.health-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  color: white;
  margin: 0.5rem;
  border-radius: 8px;
}

.health-status-bar.healthy {
  background: linear-gradient(135deg, #27ae60, #1e8449);
}

.health-status-bar.warning {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.health-status-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.health-status-content ion-icon {
  font-size: 1.5rem;
}

.health-text {
  font-weight: 600;
  font-size: 1rem;
}

.health-time {
  font-size: 0.75rem;
  opacity: 0.9;
}

.quick-stats {
  display: flex;
  gap: 1.5rem;
}

.stat {
  text-align: center;
}

/* Remove background from stats in health status bar (night mode fix) */
.health-status-bar .stat {
  background: transparent !important;
  color: white;
}

.health-status-bar .stat-value,
.health-status-bar .stat-label {
  background: transparent !important;
  color: white;
}

.stat-value {
  display: block;
  font-weight: 700;
  font-size: 1.1rem;
}

.stat-label {
  font-size: 0.65rem;
  opacity: 0.9;
  text-transform: uppercase;
}

/* ============================================================================
   Issues Bar
   ============================================================================ */
.issues-bar {
  margin: 0 0.5rem 0.5rem;
}

.issue-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--ion-color-danger-tint);
  border-left: 3px solid var(--ion-color-danger);
  border-radius: 0 6px 6px 0;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  color: var(--ion-color-danger-shade);
}

.issue-alert ion-icon {
  font-size: 1rem;
  color: var(--ion-color-danger);
}

/* ============================================================================
   Master-Detail Layout
   ============================================================================ */
.master-detail-container {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: calc(100% - 80px);
  margin: 0 0.5rem 0.5rem;
  gap: 0.5rem;
}

/* ============================================================================
   Navigation Panel
   ============================================================================ */
.nav-panel {
  background: var(--ion-background-color);
  border-radius: 8px;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
  overflow: hidden;
}

.nav-content {
  height: 100%;
  overflow-y: auto;
  padding: 0.5rem;
}

.nav-group {
  margin-bottom: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 0.5rem;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
}

.nav-group-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ion-color-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--ion-color-light-shade);
  margin-bottom: 0.5rem;
}

.nav-group-header ion-icon {
  font-size: 1rem;
  color: var(--ion-color-primary);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.85rem;
  color: var(--ion-text-color);
  background: var(--ion-background-color);
  min-height: 36px;
  box-sizing: border-box;
}

.nav-item:hover {
  background: var(--ion-color-light-tint);
}

.nav-item.active {
  background: var(--ion-color-primary);
  color: white;
}

.nav-item.active ion-icon {
  color: white;
}

.nav-item ion-icon {
  font-size: 1rem;
  color: var(--ion-color-medium);
}

.nav-item span {
  flex: 1;
}

.nav-item ion-chip {
  height: 18px;
  font-size: 0.6rem;
  --padding-start: 6px;
  --padding-end: 6px;
  margin: 0;
  flex-shrink: 0;
}

/* ============================================================================
   Detail Panel
   ============================================================================ */
.detail-panel {
  background: var(--ion-background-color);
  border-radius: 8px;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
  overflow: hidden;
}

.detail-content {
  height: 100%;
  overflow-y: auto;
}

.detail-back {
  padding: 0.5rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.detail-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium);
  text-align: center;
  padding: 2rem;
}

.detail-placeholder ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--ion-color-medium);
}

.detail-placeholder h3 {
  margin: 0 0 0.5rem;
  color: var(--ion-text-color);
}

.detail-placeholder p {
  margin: 0;
  font-size: 0.9rem;
}

/* ============================================================================
   Mobile Navigation
   ============================================================================ */
.nav-toggle {
  display: none;
}

.nav-overlay {
  display: none;
}

@media (max-width: 992px) {
  .nav-toggle {
    display: block;
  }

  .master-detail-container {
    grid-template-columns: 1fr;
  }

  .nav-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    border-radius: 0;
    border: none;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  }

  .nav-panel.nav-open {
    transform: translateX(0);
  }

  .nav-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
  }

  .nav-content {
    padding-top: 60px;
  }

  .health-status-bar {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .quick-stats {
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .health-status-bar {
    padding: 0.5rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .health-text {
    font-size: 0.9rem;
  }
}

/* Dark mode overrides for health status bar stats */
html.ion-palette-dark .health-status-bar .stat,
html[data-theme="dark"] .health-status-bar .stat {
  background: transparent !important;
  color: white !important;
}

html.ion-palette-dark .health-status-bar .stat-value,
html[data-theme="dark"] .health-status-bar .stat-value,
html.ion-palette-dark .health-status-bar .stat-label,
html[data-theme="dark"] .health-status-bar .stat-label {
  background: transparent !important;
  color: white !important;
}

/* Dark mode overrides for navigation items */
html.ion-palette-dark .nav-item,
html[data-theme="dark"] .nav-item {
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.05)) !important;
  border-color: var(--ion-border-color, rgba(255, 255, 255, 0.1)) !important;
  color: var(--ion-text-color, #e0e0e0) !important;
}

html.ion-palette-dark .nav-item:hover,
html[data-theme="dark"] .nav-item:hover {
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.1)) !important;
}

html.ion-palette-dark .nav-group,
html[data-theme="dark"] .nav-group {
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.03)) !important;
  border-color: var(--ion-border-color, rgba(255, 255, 255, 0.1)) !important;
}

html.ion-palette-dark .nav-group-header,
html[data-theme="dark"] .nav-group-header {
  border-bottom-color: var(--ion-border-color, rgba(255, 255, 255, 0.1)) !important;
}
</style>
