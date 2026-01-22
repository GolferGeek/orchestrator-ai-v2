<template>
  <div class="alerts-component">
    <div v-if="alerts.length === 0" class="empty-state">
      <p>No unacknowledged alerts</p>
    </div>

    <div v-else class="alerts-list">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="alert-card"
        :class="alert.severity"
      >
        <div class="alert-header">
          <span class="severity-badge">{{ alert.severity }}</span>
          <span class="alert-subject">{{ alert.subjectName || alert.subjectIdentifier }}</span>
          <span class="alert-time">{{ formatDate(alert.createdAt) }}</span>
        </div>
        <div class="alert-message">{{ alert.message }}</div>
        <div v-if="alert.details" class="alert-details">
          <span v-if="alert.details.triggerScore">
            Trigger Score: {{ formatPercent(alert.details.triggerScore) }}
          </span>
          <span v-if="alert.details.threshold">
            Threshold: {{ formatPercent(alert.details.threshold) }}
          </span>
        </div>
        <div class="alert-actions">
          <button class="ack-btn" @click="$emit('acknowledge', alert.id)">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UnacknowledgedAlertView } from '@/types/risk-agent';

interface Props {
  alerts: UnacknowledgedAlertView[];
}

defineProps<Props>();

defineEmits<{
  (e: 'acknowledge', alertId: string): void;
}>();

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}
</script>

<style scoped>
.alerts-component {
  max-width: 800px;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium, #666);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.alert-card {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  border-left: 4px solid var(--ion-border-color, #e0e0e0);
}

.alert-card.critical {
  border-left-color: var(--ion-color-danger, #eb445a);
  background: var(--ion-color-danger-tint, #ffeeee);
}

.alert-card.warning {
  border-left-color: var(--ion-color-warning, #ffc409);
  background: var(--ion-color-warning-tint, #fff8e6);
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.severity-badge {
  font-size: 0.625rem;
  text-transform: uppercase;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.alert-subject {
  font-weight: 600;
}

.alert-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
}

.alert-message {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.alert-details {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  margin-bottom: 0.75rem;
}

.alert-actions {
  display: flex;
  justify-content: flex-end;
}

.ack-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ion-border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--ion-card-background, #fff);
  cursor: pointer;
  font-size: 0.8125rem;
}

.ack-btn:hover {
  background: var(--ion-color-light, #f4f5f8);
}
</style>
