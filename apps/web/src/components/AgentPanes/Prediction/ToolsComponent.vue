<template>
  <div class="tools-component">
    <div class="tools-header">
      <h3>Data Sources & Tools</h3>
      <div class="tools-stats">
        <span class="stat active">Active: {{ activeToolsCount }}</span>
        <span class="stat error">Errors: {{ errorToolsCount }}</span>
        <span class="stat">Total Claims: {{ totalClaimsCount }}</span>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading tools status...</span>
    </div>

    <div v-else-if="toolsStatus.length === 0" class="empty-state">
      No data sources configured yet.
    </div>

    <div v-else class="tools-list">
      <div
        v-for="tool in toolsStatus"
        :key="tool.name"
        class="tool-card"
        :class="`tool-${tool.status}`"
      >
        <div class="tool-header">
          <div class="tool-name-section">
            <div class="tool-name">{{ tool.displayName }}</div>
            <div class="tool-identifier">{{ tool.name }}</div>
          </div>
          <div class="tool-status-badge" :class="`status-${tool.status}`">
            {{ getStatusLabel(tool.status) }}
          </div>
        </div>

        <div class="tool-metrics">
          <div class="metric">
            <span class="metric-label">Claims Collected:</span>
            <span class="metric-value">{{ tool.claimsCount }}</span>
          </div>

          <div v-if="tool.lastSuccessfulPollAt" class="metric">
            <span class="metric-label">Last Success:</span>
            <span class="metric-value">{{ formatTime(tool.lastSuccessfulPollAt) }}</span>
          </div>
          <div v-else class="metric">
            <span class="metric-label">Last Success:</span>
            <span class="metric-value empty">Never</span>
          </div>
        </div>

        <div v-if="tool.status === 'error' && tool.lastError" class="tool-error">
          <div class="error-header">
            <span class="error-icon">⚠</span>
            <span class="error-title">Error</span>
            <span v-if="tool.lastErrorAt" class="error-time">
              {{ formatTime(tool.lastErrorAt) }}
            </span>
          </div>
          <div class="error-message">{{ tool.lastError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';

const store = usePredictionAgentStore();

const toolsStatus = computed(() => store.toolsStatus);
const isLoading = computed(() => store.isLoading);

const activeToolsCount = computed(() =>
  toolsStatus.value.filter((t) => t.status === 'active').length
);

const errorToolsCount = computed(() =>
  toolsStatus.value.filter((t) => t.status === 'error').length
);

const totalClaimsCount = computed(() =>
  toolsStatus.value.reduce((sum, t) => sum + t.claimsCount, 0)
);

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'error':
      return 'Error';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Unknown';
  }
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
</script>

<style scoped>
.tools-component {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.tools-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.tools-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.stat {
  color: #6b7280;
}

.stat.active {
  color: #10b981;
}

.stat.error {
  color: #ef4444;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #6b7280;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.tools-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.tool-card {
  background-color: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: box-shadow 0.2s;
}

.tool-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.tool-card.tool-active {
  border-color: #10b981;
  background-color: #f0fdf4;
}

.tool-card.tool-error {
  border-color: #ef4444;
  background-color: #fef2f2;
}

.tool-card.tool-disabled {
  border-color: #9ca3af;
  background-color: #f3f4f6;
  opacity: 0.7;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 1rem;
}

.tool-name-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tool-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.tool-identifier {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: monospace;
}

.tool-status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-active {
  background-color: #d1fae5;
  color: #065f46;
}

.status-error {
  background-color: #fee2e2;
  color: #991b1b;
}

.status-disabled {
  background-color: #e5e7eb;
  color: #374151;
}

.tool-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.5);
  border-radius: 0.375rem;
}

.metric {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.metric-label {
  color: #6b7280;
  font-weight: 500;
}

.metric-value {
  color: #111827;
  font-weight: 600;
}

.metric-value.empty {
  color: #9ca3af;
  font-style: italic;
}

.tool-error {
  padding: 0.75rem;
  background-color: rgba(254, 226, 226, 0.5);
  border-left: 3px solid #ef4444;
  border-radius: 0.375rem;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #991b1b;
}

.error-icon {
  font-size: 1rem;
}

.error-title {
  flex: 1;
}

.error-time {
  font-size: 0.75rem;
  font-weight: 400;
  color: #7f1d1d;
}

.error-message {
  font-size: 0.875rem;
  color: #7f1d1d;
  font-family: monospace;
  line-height: 1.5;
}
</style>
