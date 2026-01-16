<template>
  <div class="alerts-tab">
    <div v-if="alerts.length === 0" class="empty-state">
      <span class="empty-icon">&#128077;</span>
      <h3>No Unacknowledged Alerts</h3>
      <p>All alerts have been reviewed and acknowledged.</p>
    </div>

    <div v-else class="alerts-list">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        :class="['alert-card', alert.severity]"
      >
        <div class="alert-header">
          <span :class="['severity-badge', alert.severity]">
            {{ alert.severity.toUpperCase() }}
          </span>
          <span class="alert-time">{{ formatTime(alert.createdAt) }}</span>
        </div>

        <div class="alert-subject">
          <strong>{{ alert.subjectName || alert.subjectIdentifier }}</strong>
        </div>

        <p class="alert-message">{{ alert.message }}</p>

        <div v-if="alert.details" class="alert-details">
          <span v-if="alert.details.triggerScore !== undefined">
            Score: {{ formatScore(alert.details.triggerScore) }}
          </span>
          <span v-if="alert.details.threshold !== undefined">
            Threshold: {{ formatScore(alert.details.threshold) }}
          </span>
          <span v-if="alert.details.changePercent !== undefined">
            Change: {{ formatPercent(alert.details.changePercent) }}
          </span>
        </div>

        <div class="alert-actions">
          <button class="btn btn-primary" @click="$emit('acknowledge', alert.id)">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UnacknowledgedAlertView } from '@/types/risk-agent';

defineProps<{
  alerts: UnacknowledgedAlertView[];
}>();

defineEmits<{
  acknowledge: [alertId: string];
}>();

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

function formatScore(score: number): string {
  return (score * 100).toFixed(0) + '%';
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toFixed(1) + '%';
}
</script>

<style scoped>
.alerts-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0.5rem 0 0 0;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid;
}

.alert-card.critical {
  border-left-color: #ef4444;
}

.alert-card.warning {
  border-left-color: #eab308;
}

.alert-card.info {
  border-left-color: #3b82f6;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.severity-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.severity-badge.critical {
  background: #fef2f2;
  color: #dc2626;
}

.severity-badge.warning {
  background: #fefce8;
  color: #ca8a04;
}

.severity-badge.info {
  background: #eff6ff;
  color: #2563eb;
}

.alert-time {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.alert-subject {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.alert-message {
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.alert-details {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.75rem;
}

.alert-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color, #a87c4f);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover, #8b6740);
}
</style>
