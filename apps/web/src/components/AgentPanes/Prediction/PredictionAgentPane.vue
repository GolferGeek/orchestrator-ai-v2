<template>
  <div class="prediction-agent-pane">
    <!-- Header with Lifecycle Controls -->
    <div class="pane-header">
      <div class="agent-info">
        <h2>Prediction Agent Dashboard</h2>
        <div v-if="agentStatus" class="agent-status">
          <span class="status-indicator" :class="`status-${agentStatus.state}`"></span>
          <span class="status-label">{{ formatStatus(agentStatus.state) }}</span>
        </div>
      </div>

      <div class="lifecycle-controls">
        <button
          v-if="isStopped || hasError"
          class="control-btn start-btn"
          :disabled="isExecuting"
          @click="handleStart"
        >
          Start
        </button>

        <button
          v-if="isRunning"
          class="control-btn pause-btn"
          :disabled="isExecuting"
          @click="handlePause"
        >
          Pause
        </button>

        <button
          v-if="isPaused"
          class="control-btn resume-btn"
          :disabled="isExecuting"
          @click="handleResume"
        >
          Resume
        </button>

        <button
          v-if="isRunning || isPaused"
          class="control-btn stop-btn"
          :disabled="isExecuting"
          @click="handleStop"
        >
          Stop
        </button>

        <button
          v-if="isRunning"
          class="control-btn poll-btn"
          :disabled="isExecuting"
          @click="handlePollNow"
        >
          Poll Now
        </button>

        <button
          class="control-btn refresh-btn"
          :disabled="isLoading"
          @click="handleRefresh"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      <span class="error-icon">⚠</span>
      <span>{{ error }}</span>
      <button class="close-error-btn" @click="clearError">
        ×
      </button>
    </div>

    <!-- Agent Status Summary -->
    <div v-if="agentStatus" class="status-summary">
      <div class="summary-card">
        <div class="summary-label">Poll Count</div>
        <div class="summary-value">{{ agentStatus.stats.pollCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Recommendations</div>
        <div class="summary-value">{{ agentStatus.stats.recommendationCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Errors</div>
        <div class="summary-value error">{{ agentStatus.stats.errorCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Avg Poll Duration</div>
        <div class="summary-value">{{ formatDuration(agentStatus.stats.avgPollDurationMs) }}</div>
      </div>
      <div v-if="agentStatus.lastPollAt" class="summary-card">
        <div class="summary-label">Last Poll</div>
        <div class="summary-value">{{ formatTime(agentStatus.lastPollAt) }}</div>
      </div>
      <div v-if="agentStatus.nextPollAt" class="summary-card">
        <div class="summary-label">Next Poll</div>
        <div class="summary-value">{{ formatTime(agentStatus.nextPollAt) }}</div>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <CurrentStateComponent v-if="activeTab === 'current-state'" />
      <InstrumentsComponent v-if="activeTab === 'instruments'" />
      <HistoryComponent v-if="activeTab === 'history'" />
      <ToolsComponent v-if="activeTab === 'tools'" />
      <ConfigComponent v-if="activeTab === 'config'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import CurrentStateComponent from './CurrentStateComponent.vue';
import InstrumentsComponent from './InstrumentsComponent.vue';
import HistoryComponent from './HistoryComponent.vue';
import ToolsComponent from './ToolsComponent.vue';
import ConfigComponent from './ConfigComponent.vue';

interface Props {
  agentId: string;
}

const props = defineProps<Props>();

const store = usePredictionAgentStore();

const activeTab = ref<'current-state' | 'instruments' | 'history' | 'tools' | 'config'>(
  'current-state'
);

const tabs = [
  { id: 'current-state' as const, label: 'Current State' },
  { id: 'instruments' as const, label: 'Instruments' },
  { id: 'history' as const, label: 'History' },
  { id: 'tools' as const, label: 'Tools' },
  { id: 'config' as const, label: 'Config' },
];

const agentStatus = computed(() => store.agentStatus);
const isLoading = computed(() => store.isLoading);
const isExecuting = computed(() => store.isExecuting);
const error = computed(() => store.error);

const isRunning = computed(() => store.isRunning);
const isPaused = computed(() => store.isPaused);
const isStopped = computed(() => store.isStopped);
const hasError = computed(() => store.hasError);

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // Initialize store with agent ID
  store.setAgentId(props.agentId);

  // Load initial data (service layer will handle API calls)
  await loadData();

  // Set up auto-refresh every 30 seconds
  refreshInterval = setInterval(async () => {
    if (isRunning.value) {
      await loadData();
    }
  }, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  store.resetState();
});

async function loadData() {
  // Service layer will implement these API calls
  // For now, just placeholder
  console.log('Loading data for agent:', props.agentId);
}

async function handleStart() {
  store.setExecuting(true);
  try {
    // Service layer will handle API call
    console.log('Starting agent:', props.agentId);
  } catch (err) {
    console.error('Failed to start agent:', err);
  } finally {
    store.setExecuting(false);
  }
}

async function handleStop() {
  store.setExecuting(true);
  try {
    // Service layer will handle API call
    console.log('Stopping agent:', props.agentId);
  } catch (err) {
    console.error('Failed to stop agent:', err);
  } finally {
    store.setExecuting(false);
  }
}

async function handlePause() {
  store.setExecuting(true);
  try {
    // Service layer will handle API call
    console.log('Pausing agent:', props.agentId);
  } catch (err) {
    console.error('Failed to pause agent:', err);
  } finally {
    store.setExecuting(false);
  }
}

async function handleResume() {
  store.setExecuting(true);
  try {
    // Service layer will handle API call
    console.log('Resuming agent:', props.agentId);
  } catch (err) {
    console.error('Failed to resume agent:', err);
  } finally {
    store.setExecuting(false);
  }
}

async function handlePollNow() {
  store.setExecuting(true);
  try {
    // Service layer will handle API call
    console.log('Triggering immediate poll for agent:', props.agentId);
  } catch (err) {
    console.error('Failed to trigger poll:', err);
  } finally {
    store.setExecuting(false);
  }
}

async function handleRefresh() {
  await loadData();
}

function clearError() {
  store.clearError();
}

function formatStatus(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1).replace('_', ' ');
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
</script>

<style scoped>
.prediction-agent-pane {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.agent-info h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
}

.agent-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}

.status-stopped {
  background-color: #9ca3af;
}

.status-starting,
.status-stopping {
  background-color: #f59e0b;
  animation: pulse 2s infinite;
}

.status-running {
  background-color: #10b981;
}

.status-paused {
  background-color: #3b82f6;
}

.status-error {
  background-color: #ef4444;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.lifecycle-controls {
  display: flex;
  gap: 0.75rem;
}

.control-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-btn {
  background-color: #10b981;
  color: white;
}

.start-btn:hover:not(:disabled) {
  background-color: #059669;
}

.stop-btn {
  background-color: #ef4444;
  color: white;
}

.stop-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.pause-btn {
  background-color: #f59e0b;
  color: white;
}

.pause-btn:hover:not(:disabled) {
  background-color: #d97706;
}

.resume-btn {
  background-color: #3b82f6;
  color: white;
}

.resume-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.poll-btn {
  background-color: #8b5cf6;
  color: white;
}

.poll-btn:hover:not(:disabled) {
  background-color: #7c3aed;
}

.refresh-btn {
  background-color: #6b7280;
  color: white;
}

.refresh-btn:hover:not(:disabled) {
  background-color: #4b5563;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #991b1b;
}

.error-icon {
  font-size: 1.25rem;
}

.close-error-btn {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #991b1b;
  cursor: pointer;
  line-height: 1;
}

.close-error-btn:hover {
  color: #7f1d1d;
}

.status-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.summary-card {
  padding: 1rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  text-align: center;
}

.summary-label {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.summary-value.error {
  color: #ef4444;
}

.tabs-nav {
  display: flex;
  gap: 0.25rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 1rem;
  font-weight: 600;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #374151;
  background-color: #f9fafb;
}

.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background-color: #eff6ff;
}

.tab-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .pane-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .lifecycle-controls {
    flex-wrap: wrap;
  }

  .status-summary {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .tabs-nav {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .tab-btn {
    white-space: nowrap;
  }
}
</style>
