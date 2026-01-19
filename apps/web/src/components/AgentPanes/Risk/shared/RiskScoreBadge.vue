<template>
  <div class="risk-score-badge" :class="riskLevel">
    <span class="score-value">{{ formattedScore }}</span>
    <span class="score-label">{{ riskLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  score: number;
  showLabel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showLabel: true,
});

const formattedScore = computed(() => {
  return (props.score * 100).toFixed(0) + '%';
});

const riskLevel = computed(() => {
  if (props.score >= 0.8) return 'critical';
  if (props.score >= 0.6) return 'high';
  if (props.score >= 0.4) return 'medium';
  if (props.score >= 0.2) return 'low';
  return 'minimal';
});

const riskLabel = computed(() => {
  if (props.score >= 0.8) return 'Critical';
  if (props.score >= 0.6) return 'High';
  if (props.score >= 0.4) return 'Medium';
  if (props.score >= 0.2) return 'Low';
  return 'Minimal';
});
</script>

<style scoped>
.risk-score-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.score-value {
  font-weight: 600;
}

.score-label {
  font-size: 0.625rem;
  text-transform: uppercase;
}

.critical {
  background: var(--ion-color-danger, #eb445a);
  color: white;
}

.high {
  background: var(--ion-color-warning, #ffc409);
  color: #333;
}

.medium {
  background: #ffd966;
  color: #333;
}

.low {
  background: var(--ion-color-success-tint, #c8f7c5);
  color: #333;
}

.minimal {
  background: var(--ion-color-success, #2dd36f);
  color: white;
}
</style>
