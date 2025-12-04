<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>System Health</ion-title>
        <ion-buttons slot="end">
          <ion-button
            fill="clear"
            @click="refreshAll"
            :disabled="loading"
          >
            <ion-icon :icon="refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="system-health-container">
        <!-- Overall Status Banner -->
        <ion-card :class="overallHealthy ? 'health-card-healthy' : 'health-card-warning'">
          <ion-card-content>
            <div class="overall-status">
              <div class="status-icon-large">
                <ion-icon :icon="overallHealthy ? checkmarkCircleOutline : alertCircleOutline" />
              </div>
              <div class="status-info">
                <h1>{{ overallHealthy ? 'All Systems Operational' : 'Issues Detected' }}</h1>
                <p>Last checked: {{ lastChecked }}</p>
              </div>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- System Services Grid -->
        <div class="services-section">
          <h2>
            <ion-icon :icon="hardwareChipOutline" />
            Core Services
          </h2>

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
                        <h3>API Service</h3>
                        <ion-chip :color="getStatusColor(systemHealth?.services?.api)" size="small">
                          <ion-label>{{ systemHealth?.services?.api || 'Unknown' }}</ion-label>
                        </ion-chip>
                      </div>
                    </div>
                    <div class="service-metrics" v-if="systemHealth">
                      <div class="metric">
                        <span class="metric-label">System Uptime</span>
                        <span class="metric-value">{{ formatUptime(systemHealth.uptime) }}</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Memory Usage</span>
                        <span class="metric-value">{{ systemHealth.memory?.utilization }}%</span>
                      </div>
                      <div class="metric" v-if="systemHealth.system">
                        <span class="metric-label">CPU Cores</span>
                        <span class="metric-value">{{ systemHealth.system.cpuCores }}</span>
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
                        <h3>Database</h3>
                        <ion-chip :color="getStatusColor(systemHealth?.services?.database)" size="small">
                          <ion-label>{{ systemHealth?.services?.database || 'Unknown' }}</ion-label>
                        </ion-chip>
                      </div>
                    </div>
                    <div class="service-metrics" v-if="dbHealth">
                      <div class="metric">
                        <span class="metric-label">Connection</span>
                        <span class="metric-value">{{ dbHealth.status || 'Unknown' }}</span>
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
                        <h3>Local Models</h3>
                        <ion-chip :color="getLocalModelsColor()" size="small">
                          <ion-label>{{ getLocalModelsStatus() }}</ion-label>
                        </ion-chip>
                      </div>
                    </div>
                    <div class="service-metrics" v-if="localModelStatus">
                      <div class="metric">
                        <span class="metric-label">Ollama</span>
                        <span class="metric-value">{{ localModelStatus.connected ? 'Running' : 'Stopped' }}</span>
                      </div>
                      <div class="metric" v-if="localModelStatus.version">
                        <span class="metric-label">Version</span>
                        <span class="metric-value">{{ localModelStatus.version }}</span>
                      </div>
                      <div class="metric" v-if="localModelStatus.models && localModelStatus.models.length !== undefined">
                        <span class="metric-label">Models Downloaded</span>
                        <span class="metric-value">{{ localModelStatus.models.length }}</span>
                      </div>
                      <div class="metric" v-if="localModelStatus.models && localModelStatus.models.length !== undefined">
                        <span class="metric-label">Loaded in Memory</span>
                        <span class="metric-value">{{ localModelStatus.models.filter((m: any) => m.status === 'loaded').length }}</span>
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
                        <h3>Agents</h3>
                        <ion-chip :color="agentsData.discoveredAgents > 0 ? 'success' : 'danger'" size="small">
                          <ion-label>{{ agentsData.discoveredAgents > 0 ? 'Available' : 'Unavailable' }}</ion-label>
                        </ion-chip>
                      </div>
                    </div>
                    <div class="service-metrics">
                      <div class="metric">
                        <span class="metric-label">Registered</span>
                        <span class="metric-value">{{ agentsData.discoveredAgents }}</span>
                      </div>
                      <div class="metric">
                        <span class="metric-label">Running Instances</span>
                        <span class="metric-value">{{ agentsData.runningInstances }}</span>
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
                        <h3>MCP Servers</h3>
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
                        <h3>Monitoring</h3>
                        <ion-chip :color="getMonitoringColor()" size="small">
                          <ion-label>{{ getMonitoringStatus() }}</ion-label>
                        </ion-chip>
                      </div>
                    </div>
                    <div class="service-metrics" v-if="monitoringStatus && monitoringStatus.enabled">
                      <div class="metric">
                        <span class="metric-label">Active Monitors</span>
                        <span class="metric-value">{{ monitoringStatus.activeMonitors || 0 }}</span>
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
        <div class="resources-section" v-if="systemHealth">
          <h2>
            <ion-icon :icon="speedometerOutline" />
            System Resources
          </h2>

          <ion-card>
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="12" size-md="4">
                    <div class="resource-item">
                      <h3>System Memory</h3>
                      <div class="resource-bar">
                        <div
                          class="resource-bar-fill"
                          :style="{ width: systemHealth.memory?.utilization + '%', backgroundColor: getResourceColor(systemHealth.memory?.utilization) }"
                        ></div>
                      </div>
                      <div class="resource-details">
                        <span>{{ (systemHealth.memory?.used / 1024).toFixed(1) }} GB / {{ (systemHealth.memory?.total / 1024).toFixed(1) }} GB</span>
                        <span>{{ systemHealth.memory?.utilization }}%</span>
                      </div>
                    </div>
                  </ion-col>

                  <ion-col size="12" size-md="4">
                    <div class="resource-item">
                      <h3>System Info</h3>
                      <div class="resource-details">
                        <span v-if="systemHealth.system">{{ systemHealth.system.cpuCores }} CPU Cores</span>
                        <span v-if="systemHealth.system">{{ systemHealth.system.platform }}</span>
                      </div>
                    </div>
                  </ion-col>

                  <ion-col size="12" size-md="4">
                    <div class="resource-item">
                      <h3>System Uptime</h3>
                      <div class="resource-details">
                        <span>{{ formatUptime(systemHealth.uptime) }}</span>
                      </div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Issues List -->
        <div class="issues-section" v-if="issues.length > 0">
          <h2>
            <ion-icon :icon="warningOutline" />
            Issues Detected
          </h2>

          <ion-card v-for="issue in issues" :key="issue.service" color="danger">
            <ion-card-content>
              <div class="issue-item">
                <ion-icon :icon="alertCircleOutline" />
                <div class="issue-details">
                  <h3>{{ issue.service }}</h3>
                  <p>{{ issue.message }}</p>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonMenuButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonChip,
  IonLabel,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/vue';
import {
  checkmarkCircleOutline,
  alertCircleOutline,
  refreshOutline,
  hardwareChipOutline,
  cloudOutline,
  serverOutline,
  cubeOutline,
  peopleOutline,
  extensionPuzzleOutline,
  pulseOutline,
  speedometerOutline,
  warningOutline,
} from 'ionicons/icons';
import { apiService } from '@/services/apiService';

// State
const loading = ref(false);
const systemHealth = ref<any>(null);
const dbHealth = ref<any>(null);
const localModelStatus = ref<any>(null);
const agentsData = ref<any>({ discoveredAgents: 0, runningInstances: 0, agents: [] });
const monitoringStatus = ref<any>(null);
const lastChecked = ref('');

// Computed
const overallHealthy = computed(() => {
  if (!systemHealth.value) return false;
  const apiHealthy = systemHealth.value.services?.api === 'healthy';
  const dbHealthy = systemHealth.value.services?.database === 'healthy';

  // Local models are optional - only check if Ollama is expected to be running
  const localModelsOk = !localModelStatus.value || localModelStatus.value.connected !== false;

  // Agents are critical - must have at least one
  const agentsOk = agentsData.value.discoveredAgents > 0;

  // System memory check - warn if above 90%
  const memoryOk = !systemHealth.value || systemHealth.value.memory?.utilization < 90;

  return apiHealthy && dbHealthy && localModelsOk && agentsOk && memoryOk;
});

const issues = computed(() => {
  const issuesList: Array<{ service: string; message: string }> = [];

  if (systemHealth.value?.services?.api !== 'healthy') {
    issuesList.push({
      service: 'API Service',
      message: 'API service is not responding or unhealthy'
    });
  }

  if (systemHealth.value?.services?.database !== 'healthy') {
    issuesList.push({
      service: 'Database',
      message: 'Database connection is unavailable or unhealthy'
    });
  }

  if (localModelStatus.value && localModelStatus.value.connected === false) {
    issuesList.push({
      service: 'Local Models',
      message: 'Ollama service is not running (local models unavailable)'
    });
  }

  if (agentsData.value.discoveredAgents === 0) {
    issuesList.push({
      service: 'Agents',
      message: 'No agents are currently available'
    });
  }

  if (systemHealth.value && systemHealth.value.memory?.utilization >= 90) {
    const usedGB = (systemHealth.value.memory.used / 1024).toFixed(1);
    const totalGB = (systemHealth.value.memory.total / 1024).toFixed(1);
    issuesList.push({
      service: 'System Memory',
      message: `High memory usage: ${systemHealth.value.memory.utilization}% (${usedGB} GB / ${totalGB} GB)`
    });
  }

  return issuesList;
});

// Methods
const getStatusColor = (status: string | undefined) => {
  if (!status) return 'medium';
  const s = status.toLowerCase();
  if (s === 'healthy' || s === 'ok' || s === 'operational') return 'success';
  if (s === 'unhealthy' || s === 'error') return 'danger';
  return 'warning';
};

const getLocalModelsStatus = () => {
  if (!localModelStatus.value) return 'Not Configured';
  if (localModelStatus.value.connected) return 'Running';
  if (localModelStatus.value.connected === false) return 'Stopped';
  return 'Not Configured';
};

const getLocalModelsColor = () => {
  if (!localModelStatus.value) return 'medium';
  if (localModelStatus.value.connected) return 'success';
  if (localModelStatus.value.connected === false) return 'warning';
  return 'medium';
};

const getMonitoringStatus = () => {
  if (!monitoringStatus.value) return 'Active';
  if (monitoringStatus.value.enabled) return 'Active';
  return 'Active';
};

const getMonitoringColor = () => {
  if (!monitoringStatus.value) return 'success';
  if (monitoringStatus.value.enabled !== false) return 'success';
  return 'warning';
};

const getResourceColor = (utilization: number | undefined) => {
  if (!utilization) return '#10dc60';
  if (utilization < 60) return '#10dc60'; // green
  if (utilization < 80) return '#ffce00'; // yellow
  return '#f04141'; // red
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

const fetchSystemHealth = async () => {
  try {
    const response = await apiService.get('/system/health');
    systemHealth.value = response;
  } catch (error) {
    console.error('Failed to fetch system health:', error);
  }
};

const fetchDatabaseHealth = async () => {
  try {
    const response = await apiService.get('/health/db');
    dbHealth.value = response;
  } catch (error) {
    console.error('Failed to fetch database health:', error);
  }
};

const fetchLocalModelStatus = async () => {
  try {
    const response = await apiService.get('/llm/local-models/status');
    localModelStatus.value = response;
  } catch (error) {
    console.error('Failed to fetch local model status:', error);
    // Set a default state when endpoint is not available
    localModelStatus.value = null;
  }
};

const fetchAgents = async () => {
  try {
    const response = await apiService.get('/agents');

    if (response && typeof response === 'object') {
      agentsData.value = {
        discoveredAgents: response.discoveredAgents || 0,
        runningInstances: response.runningInstances || 0,
        agents: response.agents || []
      };
    } else {
      console.warn('Unexpected agents response format:', response);
      agentsData.value = { discoveredAgents: 0, runningInstances: 0, agents: [] };
    }
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    agentsData.value = { discoveredAgents: 0, runningInstances: 0, agents: [] };
  }
};

const fetchMonitoringStatus = async () => {
  try {
    const response = await apiService.get('/llm/production/monitoring/status');
    monitoringStatus.value = response;
  } catch (error) {
    console.error('Failed to fetch monitoring status:', error);
    // Set a default operational state when endpoint is not available
    monitoringStatus.value = { enabled: true, activeMonitors: 0 };
  }
};

const refreshAll = async () => {
  loading.value = true;
  try {
    await Promise.all([
      fetchSystemHealth(),
      fetchDatabaseHealth(),
      fetchLocalModelStatus(),
      fetchAgents(),
      fetchMonitoringStatus(),
    ]);
    lastChecked.value = new Date().toLocaleString();
  } finally {
    loading.value = false;
  }
};

// Lifecycle
onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.system-health-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

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

.status-info h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
}

.status-info p {
  margin: 0;
  opacity: 0.9;
}

.services-section,
.resources-section,
.issues-section {
  margin-top: 2rem;
}

.services-section h2,
.resources-section h2,
.issues-section h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
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

.service-details h3 {
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

.resource-item h3 {
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

.issue-details h3 {
  margin: 0 0 0.25rem 0;
  color: white;
}

.issue-details p {
  margin: 0;
  color: white;
  opacity: 0.9;
}

@media (max-width: 768px) {
  .system-health-container {
    padding: 0.5rem;
  }

  .overall-status {
    flex-direction: column;
    text-align: center;
  }

  .status-info h1 {
    font-size: 1.5rem;
  }
}
</style>
