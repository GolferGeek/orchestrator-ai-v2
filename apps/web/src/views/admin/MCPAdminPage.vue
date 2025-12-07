<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>MCP Servers & Tools</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="refreshData" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="mcp-admin-container">
        <!-- Status Banner -->
        <div class="status-banner" :class="mcpHealth.status">
          <ion-icon :icon="mcpHealth.status === 'healthy' ? checkmarkCircleOutline : alertCircleOutline" />
          <div class="status-info">
            <h3>{{ mcpHealth.status === 'healthy' ? 'MCP Server Online' : 'MCP Server Issues' }}</h3>
            <p>{{ mcpHealth.namespaceCount }} namespaces, {{ mcpHealth.toolCount }} tools available</p>
          </div>
          <div class="status-meta">
            <span>Protocol: <strong>{{ serverInfo.protocolVersion || '2025-03-26' }}</strong></span>
          </div>
        </div>

        <!-- Server Info Card -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon :icon="serverOutline" />
            Server Information
          </h3>
          <div class="info-card">
            <div class="info-row">
              <span class="info-label">Server Name</span>
              <span class="info-value">{{ serverInfo.serverInfo?.name || 'Orchestrator AI MCP Server' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Version</span>
              <span class="info-value">{{ serverInfo.serverInfo?.version || '1.0.0' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Protocol Version</span>
              <span class="info-value mono">{{ serverInfo.protocolVersion || '2025-03-26' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Description</span>
              <span class="info-value">{{ serverInfo.serverInfo?.description || 'Unified MCP server' }}</span>
            </div>
          </div>
        </div>

        <!-- Namespaces Section -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon :icon="extensionPuzzleOutline" />
            Tool Namespaces
          </h3>

          <div class="namespaces-grid">
            <div
              class="namespace-card"
              v-for="namespace in namespaces"
              :key="namespace.name"
              :class="{ healthy: namespace.healthy, unhealthy: !namespace.healthy }"
              @click="selectNamespace(namespace)"
            >
              <div class="namespace-header">
                <ion-icon :icon="getNamespaceIcon(namespace.name)" class="namespace-icon" />
                <div class="namespace-info">
                  <h4>{{ namespace.displayName }}</h4>
                  <span class="namespace-name">{{ namespace.name }}/</span>
                </div>
                <ion-chip size="small" :color="namespace.healthy ? 'success' : 'danger'">
                  <ion-label>{{ namespace.healthy ? 'Active' : 'Error' }}</ion-label>
                </ion-chip>
              </div>
              <div class="namespace-stats">
                <span>{{ namespace.toolCount }} tools</span>
                <span>{{ namespace.type }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tools Section -->
        <div class="section">
          <h3 class="section-title">
            <ion-icon :icon="constructOutline" />
            Available Tools
            <span class="tool-count">{{ tools.length }} total</span>
          </h3>

          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search tools..."
            @ionInput="filterTools"
            debounce="300"
            class="tools-search"
          />

          <div class="tools-list">
            <div
              class="tool-item"
              v-for="tool in filteredTools"
              :key="tool.name"
              @click="openToolDetail(tool)"
            >
              <div class="tool-header">
                <span class="tool-name">{{ tool.name }}</span>
                <ion-chip size="small" :color="getNamespaceColor(tool.namespace)">
                  <ion-label>{{ tool.namespace }}</ion-label>
                </ion-chip>
              </div>
              <p class="tool-description">{{ truncateText(tool.description, 100) }}</p>
              <div class="tool-params" v-if="tool.inputSchema?.properties">
                <span class="params-count">{{ Object.keys(tool.inputSchema.properties).length }} parameters</span>
              </div>
            </div>
          </div>

          <div class="empty-state" v-if="!loading && filteredTools.length === 0">
            <p>No tools found matching your search</p>
          </div>
        </div>

        <!-- Tool Detail Modal -->
        <ion-modal :is-open="showToolModal" @didDismiss="closeToolDetail">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ selectedTool?.name }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="closeToolDetail">Close</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding" v-if="selectedTool">
            <div class="tool-detail">
              <div class="detail-section">
                <h4>Tool Information</h4>
                <div class="detail-row">
                  <span class="detail-label">Full Name</span>
                  <span class="detail-value mono">{{ selectedTool.name }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Namespace</span>
                  <ion-chip size="small" :color="getNamespaceColor(selectedTool.namespace)">
                    <ion-label>{{ selectedTool.namespace }}</ion-label>
                  </ion-chip>
                </div>
              </div>

              <div class="detail-section">
                <h4>Description</h4>
                <p>{{ selectedTool.description }}</p>
              </div>

              <div class="detail-section" v-if="selectedTool.inputSchema?.properties">
                <h4>Parameters</h4>
                <div class="params-list">
                  <div
                    class="param-item"
                    v-for="(param, name) in selectedTool.inputSchema.properties"
                    :key="name"
                  >
                    <div class="param-header">
                      <span class="param-name">{{ name }}</span>
                      <ion-chip size="small" color="medium">
                        <ion-label>{{ param.type || 'any' }}</ion-label>
                      </ion-chip>
                      <ion-chip
                        size="small"
                        color="danger"
                        v-if="selectedTool.inputSchema.required?.includes(name)"
                      >
                        <ion-label>required</ion-label>
                      </ion-chip>
                    </div>
                    <p class="param-description" v-if="param.description">{{ param.description }}</p>
                  </div>
                </div>
              </div>

              <div class="detail-section">
                <h4>Test Tool</h4>
                <p class="hint">Tool testing coming soon. Use the API endpoint directly for now.</p>
                <code class="endpoint-hint">POST /mcp { "method": "tools/call", "params": { "name": "{{ selectedTool.name }}" } }</code>
              </div>
            </div>
          </ion-content>
        </ion-modal>

        <ion-loading :is-open="loading" message="Loading MCP data..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonSearchbar,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonLoading,
} from '@ionic/vue';
import {
  refreshOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  serverOutline,
  extensionPuzzleOutline,
  constructOutline,
  serverOutline as databaseIcon,
  chatbubbleOutline,
  documentTextOutline,
} from 'ionicons/icons';
import { apiService } from '@/services/apiService';

interface MCPToolProperty {
  type?: string;
  description?: string;
}

interface MCPTool {
  name: string;
  description: string;
  namespace: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, MCPToolProperty>;
    required?: string[];
  };
}

interface Namespace {
  name: string;
  displayName: string;
  type: string;
  healthy: boolean;
  toolCount: number;
}

interface MCPServerInfo {
  protocolVersion?: string;
  serverInfo?: {
    name?: string;
    version?: string;
    description?: string;
  };
}

// State
const loading = ref(false);
const serverInfo = ref<MCPServerInfo>({});
const mcpHealth = ref<{ status: string; namespaceCount: number; toolCount: number }>({
  status: 'healthy',
  namespaceCount: 0,
  toolCount: 0,
});
const namespaces = ref<Namespace[]>([]);
const tools = ref<MCPTool[]>([]);
const searchQuery = ref('');
const showToolModal = ref(false);
const selectedTool = ref<MCPTool | null>(null);

// Computed
const filteredTools = computed(() => {
  if (!searchQuery.value) return tools.value;
  const query = searchQuery.value.toLowerCase();
  return tools.value.filter(t =>
    t.name.toLowerCase().includes(query) ||
    t.description.toLowerCase().includes(query) ||
    t.namespace.toLowerCase().includes(query)
  );
});

// Data fetching
const fetchServerInfo = async () => {
  try {
    // Call MCP initialize to get server info
    const response = await apiService.post('/mcp', {
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'admin-ui', version: '1.0.0' },
        capabilities: {},
      },
    });
    serverInfo.value = response.result || {};
  } catch (error) {
    console.error('Failed to fetch MCP server info:', error);
  }
};

const fetchMCPHealth = async () => {
  try {
    const response = await apiService.post('/mcp/health', {});
    mcpHealth.value = {
      status: response.status || 'healthy',
      namespaceCount: Object.keys(response.namespaces || {}).length,
      toolCount: tools.value.length,
    };

    // Build namespaces from health data
    const healthNamespaces = response.namespaces || {};
    namespaces.value = Object.entries(healthNamespaces).map(([name, healthy]) => ({
      name,
      displayName: getNamespaceDisplayName(name),
      type: getNamespaceType(name),
      healthy: healthy as boolean,
      toolCount: tools.value.filter(t => t.namespace === name).length,
    }));
  } catch (error) {
    console.error('Failed to fetch MCP health:', error);
  }
};

const fetchTools = async () => {
  try {
    const response = await apiService.post('/mcp', {
      jsonrpc: '2.0',
      id: 'list-1',
      method: 'tools/list',
      params: {},
    });

    const rawTools = response.result?.tools || [];
    tools.value = rawTools.map((t: Omit<MCPTool, 'namespace'>) => ({
      ...t,
      namespace: t.name.split('/')[0] || 'unknown',
    }));

    mcpHealth.value.toolCount = tools.value.length;
  } catch (error) {
    console.error('Failed to fetch MCP tools:', error);
  }
};

const refreshData = async () => {
  loading.value = true;
  try {
    await Promise.all([
      fetchServerInfo(),
      fetchTools(),
    ]);
    await fetchMCPHealth();
  } finally {
    loading.value = false;
  }
};

// Actions
const selectNamespace = (namespace: Namespace) => {
  searchQuery.value = namespace.name;
};

const openToolDetail = (tool: MCPTool) => {
  selectedTool.value = tool;
  showToolModal.value = true;
};

const closeToolDetail = () => {
  showToolModal.value = false;
  selectedTool.value = null;
};

const filterTools = () => {
  // Filtering is handled by computed property
};

// Helpers
const getNamespaceDisplayName = (name: string) => {
  const names: Record<string, string> = {
    supabase: 'Supabase',
    slack: 'Slack',
    notion: 'Notion',
  };
  return names[name] || name.charAt(0).toUpperCase() + name.slice(1);
};

const getNamespaceType = (name: string) => {
  const types: Record<string, string> = {
    supabase: 'data',
    slack: 'productivity',
    notion: 'productivity',
  };
  return types[name] || 'utility';
};

const getNamespaceIcon = (name: string) => {
  const icons: Record<string, string> = {
    supabase: databaseIcon,
    slack: chatbubbleOutline,
    notion: documentTextOutline,
  };
  return icons[name] || extensionPuzzleOutline;
};

const getNamespaceColor = (namespace: string) => {
  const colors: Record<string, string> = {
    supabase: 'success',
    slack: 'warning',
    notion: 'tertiary',
  };
  return colors[namespace] || 'medium';
};

const truncateText = (text: string, maxLength: number) => {
  if (!text) return '';
  // Remove [namespace] prefix from description
  const cleanText = text.replace(/^\[[\w-]+\]\s*/, '');
  if (cleanText.length <= maxLength) return cleanText;
  return cleanText.substring(0, maxLength) + '...';
};

onMounted(() => {
  refreshData();
});
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
  padding: 1rem;
}

.mcp-admin-container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Status Banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  color: white;
}

.status-banner.healthy {
  background: linear-gradient(135deg, #27ae60, #1e8449);
}

.status-banner.unhealthy {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.status-banner ion-icon {
  font-size: 2rem;
}

.status-info {
  flex: 1;
}

.status-info h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.status-info p {
  margin: 0.25rem 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

.status-meta {
  font-size: 0.85rem;
  opacity: 0.9;
}

/* Sections */
.section {
  margin-bottom: 2rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #555;
  margin: 0 0 1rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title ion-icon {
  font-size: 1.1rem;
  color: var(--ion-color-primary);
}

.tool-count {
  margin-left: auto;
  font-weight: 400;
  color: #888;
  font-size: 0.85rem;
  text-transform: none;
}

/* Info Card */
.info-card {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  overflow: hidden;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-weight: 500;
  color: #666;
}

.info-value {
  color: #333;
}

.info-value.mono {
  font-family: monospace;
  font-size: 0.9rem;
}

/* Namespaces Grid */
.namespaces-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.namespace-card {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.namespace-card:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.namespace-card.healthy {
  border-left: 4px solid var(--ion-color-success);
}

.namespace-card.unhealthy {
  border-left: 4px solid var(--ion-color-danger);
}

.namespace-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.namespace-icon {
  font-size: 1.5rem;
  color: var(--ion-color-primary);
}

.namespace-info {
  flex: 1;
}

.namespace-info h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.namespace-name {
  font-size: 0.8rem;
  color: #888;
  font-family: monospace;
}

.namespace-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: #666;
}

/* Tools Search */
.tools-search {
  margin-bottom: 1rem;
  --background: white;
  --border-radius: 8px;
}

/* Tools List */
.tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tool-item {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-item:hover {
  border-color: var(--ion-color-primary);
  background: #fafafa;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.tool-name {
  font-weight: 600;
  color: #333;
  font-family: monospace;
  font-size: 0.9rem;
}

.tool-description {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}

.tool-params {
  font-size: 0.8rem;
  color: #888;
}

/* Tool Detail Modal */
.tool-detail {
  padding: 0.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-section p {
  margin: 0;
  color: #333;
  line-height: 1.5;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #666;
}

.detail-value {
  color: #333;
}

.detail-value.mono {
  font-family: monospace;
  font-size: 0.9rem;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.param-item {
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.param-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.param-name {
  font-weight: 600;
  font-family: monospace;
  color: #333;
}

.param-description {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

.hint {
  color: #888;
  font-style: italic;
}

.endpoint-hint {
  display: block;
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f1f1f1;
  border-radius: 4px;
  font-size: 0.85rem;
  word-break: break-all;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #888;
}

@media (max-width: 768px) {
  .namespaces-grid {
    grid-template-columns: 1fr;
  }

  .status-banner {
    flex-direction: column;
    text-align: center;
  }
}
</style>
