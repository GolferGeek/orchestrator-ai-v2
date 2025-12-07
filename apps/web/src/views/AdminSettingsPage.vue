<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>Admin Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    
    <ion-content :fullscreen="true">
      <div class="admin-settings-container">
        <!-- Header Section -->
        <div class="settings-header">
          <h1>System Administration</h1>
          <p>Manage privacy settings, system configuration, and access controls</p>
        </div>

        <!-- Quick Actions Grid -->
        <div class="quick-actions-section">
          <h2>Quick Actions</h2>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/evaluations')" class="action-card evaluations">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="analyticsOutline" />
                    </div>
                    <h3>Admin Evaluations</h3>
                    <p>View and manage all user evaluations</p>
                    <ion-chip color="primary" size="small">
                      <ion-label>{{ evaluationStats.total }} total</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/llm-usage')" class="action-card llm-usage">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="barChartOutline" />
                    </div>
                    <h3>LLM Usage Analytics</h3>
                    <p>Monitor AI model usage and costs</p>
                    <ion-chip color="success" size="small">
                      <ion-label>${{ llmStats.totalCost.toFixed(2) }} today</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pii-patterns')" class="action-card pii-patterns">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="shieldCheckmarkOutline" />
                    </div>
                    <h3>PII Patterns</h3>
                    <p>Manage PII detection patterns</p>
                    <ion-chip color="warning" size="small">
                      <ion-label>{{ piiStats.patterns }} patterns</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pii-testing')" class="action-card pii-testing">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="flaskOutline" />
                    </div>
                    <h3>PII Testing</h3>
                    <p>Test PII detection in real-time</p>
                    <ion-chip color="tertiary" size="small">
                      <ion-label>Live Testing</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/pseudonym-dictionary')" class="action-card dictionary">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="libraryOutline" />
                    </div>
                    <h3>Pseudonym Dictionary</h3>
                    <p>Manage replacement dictionaries</p>
                    <ion-chip color="secondary" size="small">
                      <ion-label>{{ dictionaryStats.dictionaries }} dictionaries</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>

              <!-- Maintain Default Models Card -->
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card class="action-card default-models" button @click="openModelConfigModal">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="settingsOutline" />
                    </div>
                    <h3>Maintain Default Models</h3>
                    <p>View or update global default model configuration</p>
                    <ion-chip :color="envOverrideActive ? 'warning' : 'primary'" size="small">
                      <ion-label>{{ envOverrideActive ? 'Env Override Active' : 'DB Backed' }}</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              
              <ion-col size="12" size-md="6" size-lg="4">
                <ion-card button @click="navigateTo('/app/admin/rag/collections')" class="action-card rag-collections">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="serverOutline" />
                    </div>
                    <h3>RAG Collections</h3>
                    <p>Manage knowledge base collections</p>
                    <ion-chip color="tertiary" size="small">
                      <ion-label>Knowledge Base</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>

              <!-- User Management Card -->
              <ion-col size="12" size-md="6" size-lg="4" v-permission="'admin:users'">
                <ion-card button @click="navigateTo('/app/admin/users')" class="action-card user-management">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="peopleOutline" />
                    </div>
                    <h3>User Management</h3>
                    <p>Manage users and role assignments</p>
                    <ion-chip color="primary" size="small">
                      <ion-label>RBAC</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>

              <!-- Role Management Card -->
              <ion-col size="12" size-md="6" size-lg="4" v-permission="'admin:roles'">
                <ion-card button @click="navigateTo('/app/admin/roles')" class="action-card role-management">
                  <ion-card-content>
                    <div class="card-icon">
                      <ion-icon :icon="shieldOutline" />
                    </div>
                    <h3>Roles & Permissions</h3>
                    <p>View and configure system roles</p>
                    <ion-chip color="warning" size="small">
                      <ion-label>RBAC</ion-label>
                    </ion-chip>
                  </ion-card-content>
                </ion-card>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- System Health Section -->
        <div class="system-health-section">
          <div class="section-header">
            <h2>
              <ion-icon :icon="hardwareChipOutline" />
              System Health
            </h2>
            <ion-button fill="clear" size="small" @click="refreshSystemHealth" :disabled="healthLoading">
              <ion-icon :icon="refreshOutline" />
            </ion-button>
          </div>

          <!-- Overall Status Banner -->
          <ion-card :class="overallHealthy ? 'health-card-healthy' : 'health-card-warning'">
            <ion-card-content>
              <div class="overall-status">
                <div class="status-icon-large">
                  <ion-icon :icon="overallHealthy ? checkmarkCircleOutline : alertCircleOutline" />
                </div>
                <div class="health-status-info">
                  <h1>{{ overallHealthy ? 'All Systems Operational' : 'Issues Detected' }}</h1>
                  <p>Last checked: {{ lastHealthChecked }}</p>
                </div>
              </div>
            </ion-card-content>
          </ion-card>

          <!-- Core Services Grid -->
          <div class="services-section">
            <h3>
              <ion-icon :icon="hardwareChipOutline" />
              Core Services
            </h3>

            <ion-grid>
              <ion-row>
                <!-- API Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="cloudOutline" />
                        </div>
                        <div class="service-details">
                          <h4>API Service</h4>
                          <ion-chip :color="getStatusColor(healthData?.services?.api)" size="small">
                            <ion-label>{{ healthData?.services?.api || 'Unknown' }}</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics" v-if="healthData">
                        <div class="metric">
                          <span class="metric-label">System Uptime</span>
                          <span class="metric-value">{{ formatUptime(healthData.uptime) }}</span>
                        </div>
                        <div class="metric">
                          <span class="metric-label">Memory Usage</span>
                          <span class="metric-value">{{ healthData.memory?.utilization }}%</span>
                        </div>
                        <div class="metric" v-if="healthData.system">
                          <span class="metric-label">CPU Cores</span>
                          <span class="metric-value">{{ healthData.system.cpuCores }}</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <!-- Database Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="serverOutline" />
                        </div>
                        <div class="service-details">
                          <h4>Database</h4>
                          <ion-chip :color="getStatusColor(healthData?.services?.database)" size="small">
                            <ion-label>{{ healthData?.services?.database || 'Unknown' }}</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics" v-if="dbHealthData">
                        <div class="metric">
                          <span class="metric-label">Connection</span>
                          <span class="metric-value">{{ dbHealthData.status || 'Unknown' }}</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <!-- Local Models Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="cubeOutline" />
                        </div>
                        <div class="service-details">
                          <h4>Local Models</h4>
                          <ion-chip :color="getLocalModelsColor()" size="small">
                            <ion-label>{{ getLocalModelsStatus() }}</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics" v-if="localModelStatusData">
                        <div class="metric">
                          <span class="metric-label">Ollama</span>
                          <span class="metric-value">{{ localModelStatusData.connected ? 'Running' : 'Stopped' }}</span>
                        </div>
                        <div class="metric" v-if="localModelStatusData.version">
                          <span class="metric-label">Version</span>
                          <span class="metric-value">{{ localModelStatusData.version }}</span>
                        </div>
                        <div class="metric" v-if="localModelStatusData.models && localModelStatusData.models.length !== undefined">
                          <span class="metric-label">Models Downloaded</span>
                          <span class="metric-value">{{ localModelStatusData.models.length }}</span>
                        </div>
                      </div>
                      <div class="service-metrics" v-else>
                        <div class="metric">
                          <span class="metric-label">Ollama</span>
                          <span class="metric-value">Not Configured</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <!-- Agents Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="peopleOutline" />
                        </div>
                        <div class="service-details">
                          <h4>Agents</h4>
                          <ion-chip :color="agentsHealthData.discoveredAgents > 0 ? 'success' : 'danger'" size="small">
                            <ion-label>{{ agentsHealthData.discoveredAgents > 0 ? 'Available' : 'Unavailable' }}</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics">
                        <div class="metric">
                          <span class="metric-label">Registered</span>
                          <span class="metric-value">{{ agentsHealthData.discoveredAgents }}</span>
                        </div>
                        <div class="metric">
                          <span class="metric-label">Running Instances</span>
                          <span class="metric-value">{{ agentsHealthData.runningInstances }}</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <!-- MCP Servers Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="extensionPuzzleOutline" />
                        </div>
                        <div class="service-details">
                          <h4>MCP Servers</h4>
                          <ion-chip color="primary" size="small">
                            <ion-label>Active</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics">
                        <div class="metric">
                          <span class="metric-label">Status</span>
                          <span class="metric-value">Operational</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>

                <!-- Monitoring Status -->
                <ion-col size="12" size-md="6" size-lg="4">
                  <ion-card class="service-card">
                    <ion-card-content>
                      <div class="service-header">
                        <div class="service-icon">
                          <ion-icon :icon="pulseOutline" />
                        </div>
                        <div class="service-details">
                          <h4>Monitoring</h4>
                          <ion-chip :color="getMonitoringColor()" size="small">
                            <ion-label>{{ getMonitoringStatus() }}</ion-label>
                          </ion-chip>
                        </div>
                      </div>
                      <div class="service-metrics" v-if="monitoringStatusData && monitoringStatusData.enabled">
                        <div class="metric">
                          <span class="metric-label">Active Monitors</span>
                          <span class="metric-value">{{ monitoringStatusData.activeMonitors || 0 }}</span>
                        </div>
                      </div>
                      <div class="service-metrics" v-else>
                        <div class="metric">
                          <span class="metric-label">Status</span>
                          <span class="metric-value">Operational</span>
                        </div>
                      </div>
                    </ion-card-content>
                  </ion-card>
                </ion-col>
              </ion-row>
            </ion-grid>
          </div>

          <!-- System Resources -->
          <div class="resources-section" v-if="healthData">
            <h3>
              <ion-icon :icon="speedometerOutline" />
              System Resources
            </h3>

            <ion-card>
              <ion-card-content>
                <ion-grid>
                  <ion-row>
                    <ion-col size="12" size-md="4">
                      <div class="resource-item">
                        <h4>System Memory</h4>
                        <div class="resource-bar">
                          <div
                            class="resource-bar-fill"
                            :style="{ width: healthData.memory?.utilization + '%', backgroundColor: getResourceColor(healthData.memory?.utilization) }"
                          ></div>
                        </div>
                        <div class="resource-details">
                          <span>{{ (healthData.memory?.used / 1024).toFixed(1) }} GB / {{ (healthData.memory?.total / 1024).toFixed(1) }} GB</span>
                          <span>{{ healthData.memory?.utilization }}%</span>
                        </div>
                      </div>
                    </ion-col>

                    <ion-col size="12" size-md="4">
                      <div class="resource-item">
                        <h4>System Info</h4>
                        <div class="resource-details">
                          <span v-if="healthData.system">{{ healthData.system.cpuCores }} CPU Cores</span>
                          <span v-if="healthData.system">{{ healthData.system.platform }}</span>
                        </div>
                      </div>
                    </ion-col>

                    <ion-col size="12" size-md="4">
                      <div class="resource-item">
                        <h4>System Uptime</h4>
                        <div class="resource-details">
                          <span>{{ formatUptime(healthData.uptime) }}</span>
                        </div>
                      </div>
                    </ion-col>
                  </ion-row>
                </ion-grid>
              </ion-card-content>
            </ion-card>
          </div>

          <!-- Issues List -->
          <div class="issues-section" v-if="healthIssues.length > 0">
            <h3>
              <ion-icon :icon="warningOutline" />
              Issues Detected
            </h3>

            <ion-card v-for="issue in healthIssues" :key="issue.service" color="danger">
              <ion-card-content>
                <div class="issue-item">
                  <ion-icon :icon="alertCircleOutline" />
                  <div class="issue-details">
                    <h4>{{ issue.service }}</h4>
                    <p>{{ issue.message }}</p>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
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
.admin-settings-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.settings-header {
  text-align: center;
  margin-bottom: 2rem;
}

.settings-header h1 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.settings-header p {
  color: var(--ion-color-medium);
  font-size: 1.1rem;
}

.quick-actions-section,
.system-health-section {
  margin-bottom: 3rem;
}

.quick-actions-section h2,
.system-health-section h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0;
}

.action-card {
  height: 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-card.health-warning {
  border-left: 4px solid var(--ion-color-danger);
}

.action-card.default-models {
  border-left: 4px solid var(--ion-color-primary);
}

.card-icon {
  text-align: center;
  margin-bottom: 1rem;
}

.card-icon ion-icon {
  font-size: 2.5rem;
  color: var(--ion-color-primary);
}

.action-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.action-card p {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

/* Removed: Using Ionic grid instead */

.setting-group {
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--ion-color-light-tint);
}

.setting-group h3 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
  font-size: 1.1rem;
}

/* Removed: Using Ionic grid instead */

.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  background: var(--ion-color-light-tint);
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--ion-color-medium-tint);
}

.status-icon ion-icon {
  font-size: 1.5rem;
  color: var(--ion-color-medium);
}

.status-icon.status-healthy {
  background: var(--ion-color-success-tint);
}

.status-icon.status-healthy ion-icon {
  color: var(--ion-color-success);
}

.status-icon.status-info {
  background: var(--ion-color-primary-tint);
}

.status-icon.status-info ion-icon {
  color: var(--ion-color-primary);
}

.status-icon.status-success {
  background: var(--ion-color-success-tint);
}

.status-icon.status-success ion-icon {
  color: var(--ion-color-success);
}

.status-info h3 {
  margin: 0 0 0.25rem 0;
  color: var(--ion-color-primary);
  font-size: 1rem;
}

.status-info p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

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
   System Health Section Styles
   ============================================================================ */

.health-card-healthy {
  background: linear-gradient(135deg, var(--ion-color-success-tint), var(--ion-color-success));
  color: white;
}

.health-card-warning {
  background: linear-gradient(135deg, var(--ion-color-danger-tint), var(--ion-color-danger));
  color: white;
}

.overall-status {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.status-icon-large {
  font-size: 4rem;
}

.status-icon-large ion-icon {
  font-size: 4rem;
}

.health-status-info h1 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
}

.health-status-info p {
  margin: 0;
  opacity: 0.9;
}

.services-section,
.resources-section,
.issues-section {
  margin-top: 2rem;
}

.services-section h3,
.resources-section h3,
.issues-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.service-card {
  height: 100%;
}

.service-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.service-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--ion-color-primary-tint);
}

.service-icon ion-icon {
  font-size: 1.5rem;
  color: var(--ion-color-primary);
}

.service-details {
  flex: 1;
}

.service-details h4 {
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.service-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.metric-label {
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.metric-value {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.resource-item {
  padding: 1rem;
}

.resource-item h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
}

.resource-bar {
  width: 100%;
  height: 24px;
  background: var(--ion-color-light);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.resource-bar-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.resource-details {
  display: flex;
  justify-content: space-between;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.issue-item ion-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.issue-details h4 {
  margin: 0 0 0.25rem 0;
  color: white;
}

.issue-details p {
  margin: 0;
  color: white;
  opacity: 0.9;
}

/* Responsive design */
@media (max-width: 768px) {
  .admin-settings-container {
    padding: 0.5rem;
  }

  /* Responsive handled by Ionic grid */

  .setting-group {
    padding: 1rem;
  }

  .overall-status {
    flex-direction: column;
    text-align: center;
  }

  .health-status-info h1 {
    font-size: 1.5rem;
  }
}
</style>
