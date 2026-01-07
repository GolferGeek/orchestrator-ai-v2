<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Agents Administration</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="refreshData" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <!-- Stats Banner -->
      <div class="stats-banner">
        <div class="stat">
          <span class="stat-value">{{ agents.length }}</span>
          <span class="stat-label">Total Agents</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ contextAgents.length }}</span>
          <span class="stat-label">Context</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ apiAgents.length }}</span>
          <span class="stat-label">API</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ externalAgents.length }}</span>
          <span class="stat-label">External</span>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <ion-segment v-model="typeFilter" @ionChange="applyFilters">
          <ion-segment-button value="all">
            <ion-label>All</ion-label>
          </ion-segment-button>
          <ion-segment-button value="context">
            <ion-label>Context</ion-label>
          </ion-segment-button>
          <ion-segment-button value="api">
            <ion-label>API</ion-label>
          </ion-segment-button>
          <ion-segment-button value="external">
            <ion-label>External</ion-label>
          </ion-segment-button>
        </ion-segment>

        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search agents..."
          @ionInput="applyFilters"
          debounce="300"
        />
      </div>

      <!-- Agents List -->
      <div class="agents-list">
        <div
          class="agent-card"
          v-for="agent in filteredAgents"
          :key="agent.slug"
          @click="openAgentDetail(agent)"
        >
          <div class="agent-header">
            <div class="agent-icon" :class="agent.agent_type">
              <ion-icon :icon="getAgentIcon(agent.agent_type)" />
            </div>
            <div class="agent-info">
              <h4>{{ agent.name }}</h4>
              <span class="agent-slug">{{ agent.slug }}</span>
            </div>
            <ion-chip size="small" :color="getTypeColor(agent.agent_type)">
              <ion-label>{{ agent.agent_type }}</ion-label>
            </ion-chip>
          </div>

          <p class="agent-description">{{ truncateText(agent.description, 120) }}</p>

          <div class="agent-meta">
            <div class="meta-item">
              <ion-icon :icon="folderOutline" />
              <span>{{ agent.department }}</span>
            </div>
            <div class="meta-item" v-if="agent.capabilities?.length">
              <ion-icon :icon="extensionPuzzleOutline" />
              <span>{{ agent.capabilities.length }} capabilities</span>
            </div>
            <div class="meta-item" v-if="agent.version">
              <ion-icon :icon="pricetagOutline" />
              <span>v{{ agent.version }}</span>
            </div>
          </div>

          <div class="agent-tags" v-if="agent.tags?.length">
            <ion-chip size="small" v-for="tag in agent.tags.slice(0, 3)" :key="tag">
              <ion-label>{{ tag }}</ion-label>
            </ion-chip>
            <span v-if="agent.tags.length > 3" class="more-tags">+{{ agent.tags.length - 3 }} more</span>
          </div>
        </div>
      </div>

      <div class="empty-state" v-if="!loading && filteredAgents.length === 0">
        <ion-icon :icon="alertCircleOutline" />
        <h3>No Agents Found</h3>
        <p v-if="searchQuery || typeFilter !== 'all'">Try adjusting your filters</p>
        <p v-else>No agents have been configured yet</p>
      </div>

      <!-- Agent Detail Modal -->
      <ion-modal :is-open="showDetailModal" @didDismiss="closeAgentDetail">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ selectedAgent?.name }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeAgentDetail">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedAgent">
          <div class="agent-detail">
            <div class="detail-section">
              <h4>Basic Information</h4>
              <div class="detail-row">
                <span class="detail-label">Slug</span>
                <span class="detail-value mono">{{ selectedAgent.slug }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <ion-chip size="small" :color="getTypeColor(selectedAgent.agent_type)">
                  <ion-label>{{ selectedAgent.agent_type }}</ion-label>
                </ion-chip>
              </div>
              <div class="detail-row">
                <span class="detail-label">Department</span>
                <span class="detail-value">{{ selectedAgent.department }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Version</span>
                <span class="detail-value">{{ selectedAgent.version }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h4>Description</h4>
              <p>{{ selectedAgent.description }}</p>
            </div>

            <div class="detail-section" v-if="selectedAgent.capabilities?.length">
              <h4>Capabilities</h4>
              <div class="capabilities-list">
                <ion-chip v-for="cap in selectedAgent.capabilities" :key="cap" color="primary">
                  <ion-label>{{ cap }}</ion-label>
                </ion-chip>
              </div>
            </div>

            <div class="detail-section" v-if="selectedAgent.tags?.length">
              <h4>Tags</h4>
              <div class="tags-list">
                <ion-chip v-for="tag in selectedAgent.tags" :key="tag" color="medium">
                  <ion-label>{{ tag }}</ion-label>
                </ion-chip>
              </div>
            </div>

            <div class="detail-section" v-if="selectedAgent.llm_config">
              <h4>LLM Configuration</h4>
              <div class="detail-row">
                <span class="detail-label">Provider</span>
                <span class="detail-value">{{ selectedAgent.llm_config.provider }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Model</span>
                <span class="detail-value mono">{{ selectedAgent.llm_config.model }}</span>
              </div>
              <div class="detail-row" v-if="selectedAgent.llm_config.parameters?.temperature">
                <span class="detail-label">Temperature</span>
                <span class="detail-value">{{ selectedAgent.llm_config.parameters.temperature }}</span>
              </div>
            </div>

            <div class="detail-section" v-if="selectedAgent.endpoint">
              <h4>Endpoint Configuration</h4>
              <div class="detail-row">
                <span class="detail-label">URL</span>
                <span class="detail-value mono">{{ selectedAgent.endpoint.url }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Method</span>
                <span class="detail-value">{{ selectedAgent.endpoint.method || 'POST' }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h4>Timestamps</h4>
              <div class="detail-row">
                <span class="detail-label">Created</span>
                <span class="detail-value">{{ formatDateTime(selectedAgent.created_at) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Updated</span>
                <span class="detail-value">{{ formatDateTime(selectedAgent.updated_at) }}</span>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <ion-loading :is-open="loading" message="Loading agents..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSearchbar,
  IonModal,
  IonLoading,
} from '@ionic/vue';
import {
  refreshOutline,
  chatbubbleOutline,
  cloudOutline,
  linkOutline,
  folderOutline,
  extensionPuzzleOutline,
  pricetagOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import { apiService } from '@/services/apiService';

interface Agent {
  slug: string;
  name: string;
  description: string;
  version: string;
  agent_type: 'context' | 'api' | 'external';
  department: string;
  tags: string[];
  capabilities: string[];
  context: string;
  endpoint?: Record<string, unknown>;
  llm_config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  organization_slug: string[];
  io_schema: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// State
const loading = ref(false);
const agents = ref<Agent[]>([]);
const typeFilter = ref('all');
const searchQuery = ref('');
const showDetailModal = ref(false);
const selectedAgent = ref<Agent | null>(null);

// Computed
const contextAgents = computed(() => agents.value.filter(a => a.agent_type === 'context'));
const apiAgents = computed(() => agents.value.filter(a => a.agent_type === 'api'));
const externalAgents = computed(() => agents.value.filter(a => a.agent_type === 'external'));

const filteredAgents = computed(() => {
  let result = agents.value;

  // Filter by type
  if (typeFilter.value !== 'all') {
    result = result.filter(a => a.agent_type === typeFilter.value);
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(a =>
      a.name.toLowerCase().includes(query) ||
      a.slug.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query) ||
      a.department.toLowerCase().includes(query) ||
      a.tags?.some(t => t.toLowerCase().includes(query))
    );
  }

  return result;
});

// Data fetching
const fetchAgents = async () => {
  loading.value = true;
  try {
    const response = await apiService.get('/agents');
    // Response could be { agents: [...] } or just array
    const data = response as { agents?: Agent[] } | Agent[];
    agents.value = Array.isArray(data) ? data : (data?.agents || []);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    agents.value = [];
  } finally {
    loading.value = false;
  }
};

const refreshData = () => {
  fetchAgents();
};

const applyFilters = () => {
  // Filters are applied via computed property
};

// Actions
const openAgentDetail = (agent: Agent) => {
  selectedAgent.value = agent;
  showDetailModal.value = true;
};

const closeAgentDetail = () => {
  showDetailModal.value = false;
  selectedAgent.value = null;
};

// Helpers
const getAgentIcon = (type: string) => {
  switch (type) {
    case 'context': return chatbubbleOutline;
    case 'api': return cloudOutline;
    case 'external': return linkOutline;
    default: return chatbubbleOutline;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'context': return 'primary';
    case 'api': return 'success';
    case 'external': return 'tertiary';
    default: return 'medium';
  }
};

const truncateText = (text: string, maxLength: number) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleString();
};

onMounted(() => {
  fetchAgents();
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

/* Stats Banner */
.stats-banner {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #a16c4a 0%, #6d4428 100%);
  border-radius: 10px;
  margin-bottom: 1.5rem;
  color: white;
}

.stats-banner .stat {
  text-align: center;
}

.stats-banner .stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
}

.stats-banner .stat-label {
  font-size: 0.8rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.filter-bar ion-segment {
  flex: 0 0 auto;
  max-width: 400px;
}

.filter-bar ion-searchbar {
  flex: 1;
  --background: white;
  --border-radius: 8px;
}

/* Agents List */
.agents-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.agent-card {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.agent-card:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.agent-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.agent-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-icon.context {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.agent-icon.api {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.agent-icon.external {
  background: var(--ion-color-tertiary-tint);
  color: var(--ion-color-tertiary);
}

.agent-icon ion-icon {
  font-size: 1.25rem;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-info h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.agent-slug {
  font-size: 0.8rem;
  color: #888;
  font-family: monospace;
}

.agent-description {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: #555;
  line-height: 1.4;
}

.agent-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #888;
}

.meta-item ion-icon {
  font-size: 0.9rem;
}

.agent-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.agent-tags ion-chip {
  height: 22px;
  font-size: 0.7rem;
}

.more-tags {
  font-size: 0.75rem;
  color: #888;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #888;
}

.empty-state ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--ion-color-medium);
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  color: #555;
}

/* Modal Detail Styles */
.agent-detail {
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

.capabilities-list, .tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
  }

  .filter-bar ion-segment {
    max-width: none;
    width: 100%;
  }

  .agents-list {
    grid-template-columns: 1fr;
  }

  .stats-banner {
    flex-wrap: wrap;
    justify-content: space-around;
  }
}
</style>
