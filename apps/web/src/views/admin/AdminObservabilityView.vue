<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>System Observability</h2>
      <div class="header-actions">
        <!-- Connection Status -->
        <ion-chip
          :color="isConnected ? 'success' : (isConnecting ? 'warning' : 'danger')"
          size="small"
        >
          <ion-icon
            :icon="isConnected ? checkmarkCircle : (isConnecting ? hourglassOutline : closeCircle)"
          />
          {{ isConnected ? 'Connected' : (isConnecting ? 'Connecting...' : 'Disconnected') }}
        </ion-chip>

        <!-- Control Buttons -->
        <ion-button
          fill="clear"
          size="small"
          @click="streamStore.clearEvents()"
          :disabled="!isConnected"
        >
          <ion-icon :icon="trashOutline" slot="icon-only" />
        </ion-button>

        <ion-button
          fill="clear"
          size="small"
          @click="isConnected ? streamStore.disconnect() : streamStore.connect()"
        >
          <ion-icon :icon="isConnected ? stopCircle : playCircle" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <!-- Error Display -->
      <ion-card v-if="error || historyError" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <strong>{{ error ? 'Connection Error' : 'History Error' }}:</strong> {{ error || historyError }}
          </ion-text>
        </ion-card-content>
      </ion-card>

      <!-- History Range Selector -->
      <div class="history-selector">
        <ion-select
          v-model="selectedHistoryRange"
          interface="popover"
          label="History"
          label-placement="stacked"
          class="history-select"
          @ion-change="onHistoryRangeChange"
        >
          <ion-select-option
            v-for="(config, key) in HISTORY_TIME_RANGES"
            :key="key"
            :value="key"
          >
            {{ config.label }}
          </ion-select-option>
        </ion-select>

        <!-- Custom Date Range Inputs (shown when 'custom' is selected) -->
        <template v-if="selectedHistoryRange === 'custom'">
          <ion-input
            :value="customStartTime"
            @ion-input="onCustomStartChange"
            type="datetime-local"
            label="From"
            label-placement="stacked"
            class="date-input"
          />
          <ion-input
            :value="customEndTime"
            @ion-input="onCustomEndChange"
            type="datetime-local"
            label="To"
            label-placement="stacked"
            class="date-input"
          />
          <ion-button
            size="small"
            @click="onFetchCustomRange"
            :disabled="isLoadingHistory"
          >
            Load
          </ion-button>
        </template>

        <ion-spinner v-if="isLoadingHistory" name="crescent" class="history-spinner" />
        <ion-chip size="small" color="medium" class="event-count-chip">
          {{ allEvents.length }} events
        </ion-chip>
      </div>

      <!-- Tab Navigation -->
      <ion-segment v-model="selectedTab" @ion-change="onTabChange">
        <ion-segment-button value="swimlanes">
          <ion-icon :icon="layersOutline" />
          <ion-label>Swim Lanes</ion-label>
        </ion-segment-button>

        <ion-segment-button value="timeline">
          <ion-icon :icon="listOutline" />
          <ion-label>Timeline</ion-label>
        </ion-segment-button>

        <ion-segment-button value="analytics">
          <ion-icon :icon="pulseOutline" />
          <ion-label>Analytics</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Timeline Tab -->
        <div v-show="selectedTab === 'timeline'" class="tab-panel">
          <AdminEventTimeline 
            :events="recentEvents"
            @conversation-click="handleConversationClick"
          />
        </div>

        <!-- Swim Lanes Tab -->
        <div v-show="selectedTab === 'swimlanes'" class="tab-panel">
          <div class="swim-lanes-container">
            <AdminAgentSwimLane
              v-for="(activity, agentSlug) in agentActivities"
              :key="agentSlug"
              :activity="activity"
              @conversation-click="handleConversationClick"
            />
            
            <ion-card v-if="Object.keys(agentActivities).length === 0">
              <ion-card-content>
                <ion-text color="medium">
                  <p>No active agents. Events will appear here when agents start executing.</p>
                </ion-text>
              </ion-card-content>
            </ion-card>
          </div>
        </div>

        <!-- Analytics Tab -->
        <div v-show="selectedTab === 'analytics'" class="tab-panel">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="statsChartOutline" />
                Event Statistics
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ totalEvents }}</div>
                      <div class="stat-label">Total Events</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ activeAgents }}</div>
                      <div class="stat-label">Active Agents</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ uniqueConversations }}</div>
                      <div class="stat-label">Conversations</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ lastHeartbeatText }}</div>
                      <div class="stat-label">Last Update</div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>

          <!-- Event Type Breakdown -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="pieChartOutline" />
                Event Types
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                <ion-item 
                  v-for="(count, type) in eventTypeBreakdown" 
                  :key="type"
                >
                  <ion-label>
                    <h3>{{ type }}</h3>
                    <p>{{ count }} events</p>
                  </ion-label>
                  <ion-chip slot="end" color="primary">
                    {{ count }}
                  </ion-chip>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </div>
      </div>

    <!-- Conversation Detail Modal -->
    <ConversationDetailView
      v-if="selectedConversationId"
      :conversation-id="selectedConversationId"
      :is-open="showConversationDetail"
      @close="handleCloseConversationDetail"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonButton,
  IonIcon,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonInput,
} from '@ionic/vue';
import {
  checkmarkCircle,
  closeCircle,
  hourglassOutline,
  trashOutline,
  playCircle,
  stopCircle,
  listOutline,
  layersOutline,
  pulseOutline,
  statsChartOutline,
  pieChartOutline,
} from 'ionicons/icons';
import {
  useAdminObservabilityStream,
  HISTORY_TIME_RANGES,
  type HistoryTimeRange,
} from '@/composables/useAdminObservabilityStream';
import AdminEventTimeline from '@/components/Admin/observability/AdminEventTimeline.vue';
import AdminAgentSwimLane from '@/components/Admin/observability/AdminAgentSwimLane.vue';
import ConversationDetailView from '@/components/Admin/observability/ConversationDetailView.vue';

// Stream connection
const streamStore = useAdminObservabilityStream();
const {
  isConnected,
  isConnecting,
  error,
  lastHeartbeat,
  recentEvents,
  agentActivities,
  eventsByConversation,
  allEvents,
  selectedHistoryRange,
  isLoadingHistory,
  historyError,
  customStartTime,
  customEndTime,
} = streamStore;

// UI state
const selectedTab = ref('swimlanes');
const showConversationDetail = ref(false);
const selectedConversationId = ref<string | null>(null);

// Computed statistics
const totalEvents = computed(() => allEvents.value.length);

const activeAgents = computed(() => {
  return Object.values(agentActivities.value).filter(
    (a) => a.status === 'active'
  ).length;
});

const uniqueConversations = computed(() => {
  return Object.keys(eventsByConversation.value).length;
});

const lastHeartbeatText = computed(() => {
  if (!lastHeartbeat.value) return 'Never';
  const now = Date.now();
  const then = lastHeartbeat.value.getTime();
  const diffSec = Math.floor((now - then) / 1000);
  
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
});

const eventTypeBreakdown = computed(() => {
  const breakdown: Record<string, number> = {};
  for (const event of allEvents.value) {
    const type = event.hook_event_type || 'unknown';
    breakdown[type] = (breakdown[type] || 0) + 1;
  }
  return breakdown;
});

// Handlers
function onTabChange() {
  // Tab changed
}

function onHistoryRangeChange(event: CustomEvent) {
  const range = event.detail.value as HistoryTimeRange;
  // Only fetch automatically for non-custom ranges
  if (range !== 'custom') {
    streamStore.setHistoryRange(range);
  }
}

function onCustomStartChange(event: CustomEvent) {
  streamStore.setCustomStartTime(event.detail.value || '');
}

function onCustomEndChange(event: CustomEvent) {
  streamStore.setCustomEndTime(event.detail.value || '');
}

function onFetchCustomRange() {
  streamStore.fetchHistory('custom');
}

function handleConversationClick(conversationId: string) {
  selectedConversationId.value = conversationId;
  showConversationDetail.value = true;
}

function handleCloseConversationDetail() {
  showConversationDetail.value = false;
  selectedConversationId.value = null;
}

// Lifecycle
onMounted(async () => {
  console.log('[AdminObservabilityView] 🚀 Component mounted');
  console.log('[AdminObservabilityView] Attempting to connect to observability stream...');
  await streamStore.connect();
  console.log('[AdminObservabilityView] Connection attempt complete. isConnected:', isConnected.value, 'error:', error.value);

  // Fetch initial history (last hour by default)
  if (isConnected.value) {
    await streamStore.fetchHistory();
  }
});

onUnmounted(() => {
  console.log('[AdminObservabilityView] 👋 Component unmounting, disconnecting...');
  streamStore.disconnect();
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
  align-items: center;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
}

.tab-content {
  padding: 16px;
}

.tab-panel {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.swim-lanes-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-stat {
  text-align: center;
  padding: 12px;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

/* History selector styles */
.history-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--ion-color-step-50);
  border-bottom: 1px solid var(--ion-color-step-150);
  flex-wrap: wrap;
}

.history-select {
  min-width: 150px;
  max-width: 180px;
}

.date-input {
  min-width: 180px;
  max-width: 200px;
}

.history-spinner {
  width: 20px;
  height: 20px;
}

.event-count-chip {
  margin-left: auto;
}
</style>

