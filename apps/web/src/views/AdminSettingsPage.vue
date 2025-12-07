<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
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
      <div class="dashboard-container">
        <!-- Health Status Bar -->
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

        <!-- Quick Actions Grid - Compact Cards -->
        <div class="quick-actions-grid">
          <div class="action-tile" @click="navigateTo('/app/admin/evaluations')">
            <div class="tile-icon"><ion-icon :icon="analyticsOutline" /></div>
            <div class="tile-content">
              <h4>Evaluations</h4>
              <ion-chip color="primary" size="small"><ion-label>{{ evaluationStats.total }}</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/llm-usage')">
            <div class="tile-icon"><ion-icon :icon="barChartOutline" /></div>
            <div class="tile-content">
              <h4>LLM Usage</h4>
              <ion-chip color="success" size="small"><ion-label>${{ llmStats.totalCost.toFixed(2) }}</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/pii-patterns')">
            <div class="tile-icon"><ion-icon :icon="shieldCheckmarkOutline" /></div>
            <div class="tile-content">
              <h4>PII Patterns</h4>
              <ion-chip color="warning" size="small"><ion-label>{{ piiStats.patterns }}</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/pii-testing')">
            <div class="tile-icon"><ion-icon :icon="flaskOutline" /></div>
            <div class="tile-content">
              <h4>PII Testing</h4>
              <ion-chip color="tertiary" size="small"><ion-label>Live</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/pseudonym-dictionary')">
            <div class="tile-icon"><ion-icon :icon="libraryOutline" /></div>
            <div class="tile-content">
              <h4>Dictionaries</h4>
              <ion-chip color="secondary" size="small"><ion-label>{{ dictionaryStats.dictionaries }}</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/models')">
            <div class="tile-icon"><ion-icon :icon="cubeOutline" /></div>
            <div class="tile-content">
              <h4>Providers & Models</h4>
              <ion-chip color="primary" size="small"><ion-label>LLM</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/rag/collections')">
            <div class="tile-icon"><ion-icon :icon="serverOutline" /></div>
            <div class="tile-content">
              <h4>RAG Collections</h4>
              <ion-chip color="tertiary" size="small"><ion-label>KB</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" v-permission="'admin:users'" @click="navigateTo('/app/admin/users')">
            <div class="tile-icon"><ion-icon :icon="peopleOutline" /></div>
            <div class="tile-content">
              <h4>Users</h4>
              <ion-chip color="primary" size="small"><ion-label>RBAC</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" v-permission="'admin:roles'" @click="navigateTo('/app/admin/roles')">
            <div class="tile-icon"><ion-icon :icon="shieldOutline" /></div>
            <div class="tile-content">
              <h4>Roles</h4>
              <ion-chip color="warning" size="small"><ion-label>RBAC</ion-label></ion-chip>
            </div>
          </div>

          <div class="action-tile" @click="navigateTo('/app/admin/organizations')">
            <div class="tile-icon"><ion-icon :icon="businessOutline" /></div>
            <div class="tile-content">
              <h4>Organizations</h4>
              <ion-chip color="secondary" size="small"><ion-label>Manage</ion-label></ion-chip>
            </div>
          </div>
        </div>

        <!-- Services Grid - Compact -->
        <div class="services-grid">
          <h3 class="section-title">
            <ion-icon :icon="hardwareChipOutline" />
            Core Services
          </h3>

          <div class="service-tiles">
            <!-- Database - links to database admin -->
            <div class="service-tile clickable" @click="navigateTo('/app/admin/database')">
              <div class="service-tile-header">
                <ion-icon :icon="serverOutline" class="service-tile-icon" />
                <span class="service-name">Database</span>
                <ion-chip :color="getStatusColor(healthData?.services?.database)" size="small">
                  <ion-label>{{ healthData?.services?.database || '...' }}</ion-label>
                </ion-chip>
              </div>
              <div class="service-tile-metrics" v-if="dbHealthData">
                <div class="mini-metric">
                  <span class="mini-label">Conn</span>
                  <span class="mini-value">{{ dbHealthData.status || 'OK' }}</span>
                </div>
              </div>
            </div>

            <!-- Models & Providers (Ollama) - future: /app/admin/models -->
            <div class="service-tile clickable" @click="navigateTo('/app/admin/models')">
              <div class="service-tile-header">
                <ion-icon :icon="cubeOutline" class="service-tile-icon" />
                <span class="service-name">Models</span>
                <ion-chip :color="getLocalModelsColor()" size="small">
                  <ion-label>{{ getLocalModelsStatus() }}</ion-label>
                </ion-chip>
              </div>
              <div class="service-tile-metrics" v-if="localModelStatusData">
                <div class="mini-metric" v-if="localModelStatusData.models">
                  <span class="mini-label">Ollama</span>
                  <span class="mini-value">{{ localModelStatusData.models.length }}</span>
                </div>
                <div class="mini-metric" v-if="localModelStatusData.version">
                  <span class="mini-label">Ver</span>
                  <span class="mini-value">{{ localModelStatusData.version }}</span>
                </div>
              </div>
            </div>

            <!-- Agents - links to agents admin -->
            <div class="service-tile clickable" @click="navigateTo('/app/admin/agents')">
              <div class="service-tile-header">
                <ion-icon :icon="peopleOutline" class="service-tile-icon" />
                <span class="service-name">Agents</span>
                <ion-chip :color="agentsHealthData.discoveredAgents > 0 ? 'success' : 'danger'" size="small">
                  <ion-label>{{ agentsHealthData.discoveredAgents > 0 ? 'OK' : 'None' }}</ion-label>
                </ion-chip>
              </div>
              <div class="service-tile-metrics">
                <div class="mini-metric">
                  <span class="mini-label">Reg</span>
                  <span class="mini-value">{{ agentsHealthData.discoveredAgents }}</span>
                </div>
                <div class="mini-metric">
                  <span class="mini-label">Run</span>
                  <span class="mini-value">{{ agentsHealthData.runningInstances }}</span>
                </div>
              </div>
            </div>

            <!-- MCP - future: /app/admin/mcp -->
            <div class="service-tile clickable" @click="navigateTo('/app/admin/mcp')">
              <div class="service-tile-header">
                <ion-icon :icon="extensionPuzzleOutline" class="service-tile-icon" />
                <span class="service-name">MCP & Tools</span>
                <ion-chip color="success" size="small">
                  <ion-label>Active</ion-label>
                </ion-chip>
              </div>
            </div>

            <!-- Monitoring - links to observability -->
            <div class="service-tile clickable" @click="navigateTo('/app/admin/observability')">
              <div class="service-tile-header">
                <ion-icon :icon="pulseOutline" class="service-tile-icon" />
                <span class="service-name">Observability</span>
                <ion-chip :color="getMonitoringColor()" size="small">
                  <ion-label>{{ getMonitoringStatus() }}</ion-label>
                </ion-chip>
              </div>
            </div>
          </div>
        </div>

        <!-- Resource Bar -->
        <div class="resource-bar-section" v-if="healthData">
          <h3 class="section-title">
            <ion-icon :icon="speedometerOutline" />
            System Resources
          </h3>
          <div class="resource-bar-container">
            <div class="resource-bar-item">
              <div class="resource-bar-header">
                <span>Memory</span>
                <span>{{ healthData.memory?.utilization }}%</span>
              </div>
              <div class="resource-progress">
                <div class="resource-progress-fill" :style="{ width: healthData.memory?.utilization + '%', backgroundColor: getResourceColor(healthData.memory?.utilization) }"></div>
              </div>
              <div class="resource-bar-footer">
                {{ (healthData.memory?.used / 1024).toFixed(1) }} / {{ (healthData.memory?.total / 1024).toFixed(1) }} GB
              </div>
            </div>
            <div class="resource-info-item" v-if="healthData.system">
              <span class="resource-info-label">Platform</span>
              <span class="resource-info-value">{{ healthData.system.platform }}</span>
            </div>
            <div class="resource-info-item" v-if="healthData.system">
              <span class="resource-info-label">CPU Cores</span>
              <span class="resource-info-value">{{ healthData.system.cpuCores }}</span>
            </div>
          </div>
        </div>

        <!-- Issues Section - Compact -->
        <div class="issues-bar" v-if="healthIssues.length > 0">
          <div class="issue-alert" v-for="issue in healthIssues" :key="issue.service">
            <ion-icon :icon="alertCircleOutline" />
            <strong>{{ issue.service }}:</strong> {{ issue.message }}
          </div>
        </div>
      </div>
    
    <!-- Global Model Config Modal -->
    <ion-modal :is-open="showModelConfigModal" @didDismiss="closeModelConfigModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Maintain Default Models</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModelConfigModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <div class="model-config">
          <p class="hint" v-if="envOverrideActive">
            MODEL_CONFIG_GLOBAL_JSON is set in the environment. DB changes will not take effect until the env override is removed.
          </p>

          <ion-segment v-model="mode">
            <ion-segment-button value="flat">Single Default</ion-segment-button>
            <ion-segment-button value="dual">Default + Local Only</ion-segment-button>
          </ion-segment>

          <div v-if="mode === 'flat'" class="segment-pane">
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="flat.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in providers" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="flat.model" interface="popover" :disabled="!flat.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in flatModelOptions"
                  :key="m.modelName"
                  :value="m.modelName"
                >{{ m.displayName || m.modelName }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="flatTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="flatParamsJson" auto-grow />
            </ion-item>
          </div>

          <div v-else class="segment-pane">
            <h4>Default</h4>
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="dual.default.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in providers" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="dual.default.model" interface="popover" :disabled="!dual.default.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in dualDefaultModelOptions"
                  :key="m.modelName"
                  :value="m.modelName"
                >{{ m.displayName || m.modelName }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="dualDefaultTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="dualDefaultParamsJson" auto-grow />
            </ion-item>
            <h4 style="margin-top: 16px;">Local Only (optional)</h4>
            <ion-item>
              <ion-label position="stacked">Provider</ion-label>
              <ion-select v-model="dual.localOnly.provider" interface="popover" placeholder="Select provider">
                <ion-select-option v-for="p in localProviders" :key="p.name" :value="p.name">{{ p.display_name || p.name }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Model</ion-label>
              <ion-select v-model="dual.localOnly.model" interface="popover" :disabled="!dual.localOnly.provider" placeholder="Select model">
                <ion-select-option
                  v-for="m in dualLocalModelOptions"
                  :key="m.modelName"
                  :value="m.modelName"
                >{{ m.displayName || m.modelName }}</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Temperature</ion-label>
              <ion-input type="number" step="0.1" min="0" max="2" v-model.number="dualLocalTemp" />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Advanced Parameters (JSON)</ion-label>
              <ion-textarea v-model="dualLocalParamsJson" auto-grow />
            </ion-item>
          </div>

          <div class="actions">
            <ion-button :disabled="saving || !isConfigValid" @click="saveModelConfig" expand="block">Save</ion-button>
          </div>
        </div>
      </ion-content>
    </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonChip,
  IonLabel,
  IonItem,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonModal,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
  toastController
} from '@ionic/vue';
import {
  analyticsOutline,
  barChartOutline,
  shieldCheckmarkOutline,
  shieldOutline,
  flaskOutline,
  libraryOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  hardwareChipOutline,
  peopleOutline,
  settingsOutline,
  serverOutline,
  refreshOutline,
  cloudOutline,
  cubeOutline,
  extensionPuzzleOutline,
  pulseOutline,
  speedometerOutline,
  warningOutline,
  businessOutline,
} from 'ionicons/icons';
import { useAuthStore } from '@/stores/rbacStore';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMAnalyticsStore } from '@/stores/llmAnalyticsStore';
// Privacy stores consolidated into usePrivacyStore
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { fetchGlobalModelConfig, updateGlobalModelConfig } from '@/services/systemSettingsService';
import { fetchProvidersWithModels, type ProviderWithModels } from '@/services/modelCatalogService';
import { apiService } from '@/services/apiService';

// Store and router
const auth = useAuthStore();
const router = useRouter();

// Initialize all stores for reactive data
const privacyStore = usePrivacyStore();
const llmAnalyticsStore = useLLMAnalyticsStore();
const analyticsStore = useAnalyticsStore();

// Reactive state (UI only)
const isUpdating = ref(false);

// Global Model Config Modal state
const showModelConfigModal = ref(false);
const envOverrideActive = ref(false);
const mode = ref<'flat' | 'dual'>('flat');
const flat = ref<{ provider: string; model: string; parameters?: Record<string, unknown> }>({ provider: '', model: '', parameters: {} });
const dual = ref<{ default: { provider: string; model: string; parameters?: Record<string, unknown> }; localOnly: { provider: string; model: string; parameters?: Record<string, unknown> } }>({
  default: { provider: '', model: '', parameters: {} },
  localOnly: { provider: '', model: '', parameters: {} },
});
const providers = ref<ProviderWithModels[]>([]);
const flatTemp = ref<number>(0.7);
const dualDefaultTemp = ref<number>(0.7);
const dualLocalTemp = ref<number>(0.7);
const flatParamsJson = ref('');
const dualDefaultParamsJson = ref('');
const dualLocalParamsJson = ref('');
const saving = ref(false);
const isConfigValid = computed(() => {
  if (mode.value === 'flat') {
    return Boolean(flat.value.provider && flat.value.model);
  }
  // dual mode: default required, localOnly optional but must be complete if provided
  const defOK = Boolean(dual.value.default.provider && dual.value.default.model);
  const localProvided = Boolean(dual.value.localOnly.provider || dual.value.localOnly.model);
  const localOK = !localProvided || Boolean(dual.value.localOnly.provider && dual.value.localOnly.model);
  return defOK && localOK;
});

// Filter providers for "Local Only" section
const localProviders = computed(() => {
  return providers.value.filter(p => p.is_local || p.name.toLowerCase() === 'ollama');
});

function openModelConfigModal() {
  showModelConfigModal.value = true;
}
function closeModelConfigModal() {
  showModelConfigModal.value = false;
}

async function loadGlobalModelConfig() {
  try {
    // Load catalog first
    providers.value = await fetchProvidersWithModels({ status: 'active' });
    console.log('🔍 Loaded providers:', providers.value);
    const res = await fetchGlobalModelConfig();
    envOverrideActive.value = !!res?.envOverrideActive;
    const cfg = res?.dbConfig;
    if (!cfg) return;
    if (cfg.default || cfg.localOnly) {
      mode.value = 'dual';
      dual.value.default.provider = cfg.default?.provider || '';
      dual.value.default.model = cfg.default?.model || '';
      dual.value.default.parameters = cfg.default?.parameters || {};
      dualDefaultTemp.value = (dual.value.default.parameters?.temperature as number) ?? 0.7;
      dual.value.localOnly.provider = cfg.localOnly?.provider || '';
      dual.value.localOnly.model = cfg.localOnly?.model || '';
      dual.value.localOnly.parameters = cfg.localOnly?.parameters || {};
      dualLocalTemp.value = (dual.value.localOnly.parameters?.temperature as number) ?? 0.7;
      dualDefaultParamsJson.value = JSON.stringify(dual.value.default.parameters || {}, null, 2);
      dualLocalParamsJson.value = JSON.stringify(dual.value.localOnly.parameters || {}, null, 2);
    } else {
      mode.value = 'flat';
      flat.value.provider = cfg.provider || '';
      flat.value.model = cfg.model || '';
      flat.value.parameters = cfg.parameters || {};
      flatTemp.value = (flat.value.parameters?.temperature as number) ?? 0.7;
      flatParamsJson.value = JSON.stringify(flat.value.parameters || {}, null, 2);
    }
  } catch {}
}

// Computed model lists with fallback to show DB-selected values
const flatModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === flat.value.provider)?.models || [];
  if (flat.value.model && !list.some(m => m.modelName === flat.value.model)) {
    return [...list, { modelName: flat.value.model, displayName: flat.value.model } as Record<string, unknown>];
  }
  return list;
});

const dualDefaultModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === dual.value.default.provider)?.models || [];
  if (dual.value.default.model && !list.some(m => m.modelName === dual.value.default.model)) {
    return [...list, { modelName: dual.value.default.model, displayName: dual.value.default.model } as Record<string, unknown>];
  }
  return list;
});

const dualLocalModelOptions = computed(() => {
  const list = providers.value.find(p => p.name === dual.value.localOnly.provider)?.models || [];
  if (dual.value.localOnly.model && !list.some(m => m.modelName === dual.value.localOnly.model)) {
    return [...list, { modelName: dual.value.localOnly.model, displayName: dual.value.localOnly.model } as Record<string, unknown>];
  }
  return list;
});

async function saveModelConfig() {
  try {
    saving.value = true;
    if (!isConfigValid.value) {
      const toast = await toastController.create({
        message: 'Please complete required fields (provider and model).',
        duration: 2500,
        color: 'warning',
        position: 'bottom'
      });
      await toast.present();
      return;
    }
    let payload: Record<string, unknown>;
    if (mode.value === 'flat') {
      try { flat.value.parameters = flatParamsJson.value ? JSON.parse(flatParamsJson.value) : {}; } catch { flat.value.parameters = {}; }
      flat.value.parameters.temperature = flatTemp.value;
      payload = { provider: flat.value.provider, model: flat.value.model, parameters: flat.value.parameters };
    } else {
      try { dual.value.default.parameters = dualDefaultParamsJson.value ? JSON.parse(dualDefaultParamsJson.value) : {}; } catch { dual.value.default.parameters = {}; }
      try { dual.value.localOnly.parameters = dualLocalParamsJson.value ? JSON.parse(dualLocalParamsJson.value) : {}; } catch { dual.value.localOnly.parameters = {}; }
      dual.value.default.parameters.temperature = dualDefaultTemp.value;
      if (dual.value.localOnly) dual.value.localOnly.parameters.temperature = dualLocalTemp.value;
      payload = { default: dual.value.default, localOnly: (dual.value.localOnly.provider && dual.value.localOnly.model) ? dual.value.localOnly : undefined };
    }
    try {
      await updateGlobalModelConfig(payload);
      const toast = await toastController.create({
        message: 'Global model configuration saved.',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
      closeModelConfigModal();
    } catch {
      const toast = await toastController.create({
        message: 'Failed to save configuration. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  } finally { saving.value = false; }
}

// Reactive stats from stores (no mock data)
const evaluationStats = computed(() => ({
  total: analyticsStore.evaluations?.length || 0,
  pending: analyticsStore.evaluations?.filter(e => e.status === 'pending').length || 0,
  completed: analyticsStore.evaluations?.filter(e => e.status === 'completed').length || 0
}));

const llmStats = computed(() => ({
  totalCost: llmAnalyticsStore.totalCost || 0,
  requestsToday: llmAnalyticsStore.usageRecords.filter(r => {
    const today = new Date().toDateString();
    return new Date(r.started_at).toDateString() === today;
  }).length || 0,
  avgResponseTime: Math.round(llmAnalyticsStore.avgDuration) || 0
}));

const piiStats = computed(() => ({
  patterns: privacyStore.patterns.length || 0,
  active: privacyStore.patterns.filter(p => p.enabled).length || 0,
  detections: 0 // TODO: Get from privacy stats when available
}));

const dictionaryStats = computed(() => ({
  dictionaries: privacyStore.dictionaries.length || 0,
  totalWords: privacyStore.dictionaries.reduce((sum, d) => sum + d.words.length, 0) || 0,
  activeWords: privacyStore.dictionaries.filter(d => d.isActive).reduce((sum, d) => sum + d.words.length, 0) || 0
}));

// ============================================================================
// System Health State (from SystemHealthView)
// ============================================================================
const healthLoading = ref(false);
const healthData = ref<any>(null);
const dbHealthData = ref<any>(null);
const localModelStatusData = ref<any>(null);
const agentsHealthData = ref<any>({ discoveredAgents: 0, runningInstances: 0, agents: [] });
const monitoringStatusData = ref<any>(null);
const lastHealthChecked = ref('');

// Overall health computed
const overallHealthy = computed(() => {
  if (!healthData.value) return false;
  const apiHealthy = healthData.value.services?.api === 'healthy';
  const dbHealthy = healthData.value.services?.database === 'healthy';
  const localModelsOk = !localModelStatusData.value || localModelStatusData.value.connected !== false;
  const agentsOk = agentsHealthData.value.discoveredAgents > 0;
  const memoryOk = !healthData.value || healthData.value.memory?.utilization < 90;
  return apiHealthy && dbHealthy && localModelsOk && agentsOk && memoryOk;
});

// Health issues computed
const healthIssues = computed(() => {
  const issuesList: Array<{ service: string; message: string }> = [];
  if (healthData.value?.services?.api !== 'healthy') {
    issuesList.push({ service: 'API Service', message: 'API service is not responding or unhealthy' });
  }
  if (healthData.value?.services?.database !== 'healthy') {
    issuesList.push({ service: 'Database', message: 'Database connection is unavailable or unhealthy' });
  }
  if (localModelStatusData.value && localModelStatusData.value.connected === false) {
    issuesList.push({ service: 'Local Models', message: 'Ollama service is not running (local models unavailable)' });
  }
  if (agentsHealthData.value.discoveredAgents === 0) {
    issuesList.push({ service: 'Agents', message: 'No agents are currently available' });
  }
  if (healthData.value && healthData.value.memory?.utilization >= 90) {
    const usedGB = (healthData.value.memory.used / 1024).toFixed(1);
    const totalGB = (healthData.value.memory.total / 1024).toFixed(1);
    issuesList.push({ service: 'System Memory', message: `High memory usage: ${healthData.value.memory.utilization}% (${usedGB} GB / ${totalGB} GB)` });
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

const getLocalModelsStatus = () => {
  if (!localModelStatusData.value) return 'Not Configured';
  if (localModelStatusData.value.connected) return 'Running';
  if (localModelStatusData.value.connected === false) return 'Stopped';
  return 'Not Configured';
};

const getLocalModelsColor = () => {
  if (!localModelStatusData.value) return 'medium';
  if (localModelStatusData.value.connected) return 'success';
  if (localModelStatusData.value.connected === false) return 'warning';
  return 'medium';
};

const getMonitoringStatus = () => {
  if (!monitoringStatusData.value) return 'Active';
  if (monitoringStatusData.value.enabled) return 'Active';
  return 'Active';
};

const getMonitoringColor = () => {
  if (!monitoringStatusData.value) return 'success';
  if (monitoringStatusData.value.enabled !== false) return 'success';
  return 'warning';
};

const getResourceColor = (utilization: number | undefined) => {
  if (!utilization) return '#10dc60';
  if (utilization < 60) return '#10dc60';
  if (utilization < 80) return '#ffce00';
  return '#f04141';
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
    healthData.value = response;
  } catch (error) {
    console.error('Failed to fetch system health:', error);
  }
};

const fetchDbHealth = async () => {
  try {
    const response = await apiService.get('/health/db');
    dbHealthData.value = response;
  } catch (error) {
    console.error('Failed to fetch database health:', error);
  }
};

const fetchLocalModelStatus = async () => {
  try {
    const response = await apiService.get('/llm/local-models/status');
    localModelStatusData.value = response;
  } catch (error) {
    console.error('Failed to fetch local model status:', error);
    localModelStatusData.value = null;
  }
};

const fetchAgentsHealth = async () => {
  try {
    const response = await apiService.get('/agents');
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
    monitoringStatusData.value = response;
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

// ============================================================================
// Methods
// ============================================================================
const navigateTo = (path: string) => {
  router.push(path);
};

// Lifecycle - Initialize all stores for reactive data
onMounted(async () => {
  try {
    await Promise.all([
      llmAnalyticsStore.initialize(),
      analyticsStore.initialize?.() || Promise.resolve(),
      refreshSystemHealth()
    ]);
    await loadGlobalModelConfig();
  } catch (error) {
    console.error('Failed to load admin settings data:', error);
  }
});
</script>

<style scoped>
/* ============================================================================
   Dashboard Container
   ============================================================================ */
.dashboard-container {
  padding: 0.75rem;
  max-width: 1600px;
  margin: 0 auto;
}

/* ============================================================================
   Health Status Bar - Top Banner
   ============================================================================ */
.health-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  margin-bottom: 1.25rem;
  color: white;
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
  gap: 1rem;
}

.health-status-content ion-icon {
  font-size: 1.75rem;
}

.health-text {
  font-weight: 600;
  font-size: 1.1rem;
}

.health-time {
  font-size: 0.85rem;
  opacity: 0.9;
  margin-left: 0.5rem;
}

.quick-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-weight: 700;
  font-size: 1.25rem;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ============================================================================
   Quick Actions Grid - Readable Tiles
   ============================================================================ */
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.85rem;
  margin-bottom: 1.5rem;
}

.action-tile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--ion-color-light-shade);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.action-tile:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.tile-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--ion-color-primary);
  flex-shrink: 0;
}

.tile-icon ion-icon {
  font-size: 1.25rem;
  color: white;
}

.tile-content {
  flex: 1;
  min-width: 0;
}

.tile-content h4 {
  margin: 0 0 4px 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
}

.tile-content ion-chip {
  height: 20px;
  font-size: 0.7rem;
}

/* ============================================================================
   Section Titles
   ============================================================================ */
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #555;
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title ion-icon {
  font-size: 1.1rem;
  color: var(--ion-color-primary);
}

/* ============================================================================
   Services Grid - Readable Tiles
   ============================================================================ */
.services-grid {
  margin-bottom: 1.25rem;
}

.service-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.service-tile {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  padding: 0.85rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.15s ease;
}

.service-tile.clickable {
  cursor: pointer;
}

.service-tile.clickable:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.service-tile-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.service-tile-icon {
  font-size: 1.15rem;
  color: var(--ion-color-primary);
}

.service-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
}

.service-tile ion-chip {
  height: 20px;
  font-size: 0.65rem;
}

.service-tile-metrics {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

.mini-metric {
  display: flex;
  gap: 0.3rem;
  font-size: 0.8rem;
}

.mini-label {
  color: #888;
}

.mini-value {
  font-weight: 600;
  color: #333;
}

/* ============================================================================
   Resource Bar Section
   ============================================================================ */
.resource-bar-section {
  margin-bottom: 1.25rem;
}

.resource-bar-container {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.resource-bar-item {
  flex: 1;
  max-width: 350px;
}

.resource-bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.35rem;
}

.resource-progress {
  height: 10px;
  background: var(--ion-color-light);
  border-radius: 5px;
  overflow: hidden;
}

.resource-progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.resource-bar-footer {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.3rem;
}

.resource-info-item {
  display: flex;
  flex-direction: column;
  padding: 0 1.25rem;
  border-left: 1px solid var(--ion-color-light-shade);
}

.resource-info-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.resource-info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

/* ============================================================================
   Issues Bar
   ============================================================================ */
.issues-bar {
  margin-bottom: 1.25rem;
}

.issue-alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--ion-color-danger-tint);
  border-left: 4px solid var(--ion-color-danger);
  border-radius: 0 8px 8px 0;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #c0392b;
}

.issue-alert ion-icon {
  font-size: 1.2rem;
  color: var(--ion-color-danger);
}

.issue-alert strong {
  color: #a93226;
}

/* ============================================================================
   Modal Styles (preserved)
   ============================================================================ */
.model-config .hint {
  color: var(--ion-color-warning);
  margin-bottom: 12px;
}

.model-config .segment-pane {
  margin-top: 12px;
}

.model-config .actions {
  margin-top: 16px;
}

/* ============================================================================
   Responsive Design
   ============================================================================ */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 0.5rem;
  }

  .health-status-bar {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .quick-stats {
    gap: 1rem;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .service-tiles {
    grid-template-columns: repeat(2, 1fr);
  }

  .resource-bar-container {
    flex-direction: column;
    align-items: stretch;
  }

  .resource-bar-item {
    max-width: none;
  }

  .resource-info-item {
    flex-direction: row;
    justify-content: space-between;
    border-left: none;
    border-top: 1px solid var(--ion-color-light-shade);
    padding: 0.5rem 0;
  }
}

@media (max-width: 480px) {
  .quick-actions-grid {
    grid-template-columns: 1fr;
  }

  .service-tiles {
    grid-template-columns: 1fr;
  }
}
</style>
