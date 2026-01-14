<template>
  <div
    class="prediction-card"
    :class="[statusClass, { selected: isSelected }]"
    @click="$emit('select', prediction.id)"
  >
    <div class="card-header">
      <div class="target-info">
        <div class="target-header">
          <span v-if="prediction.isTest" class="test-badge">TEST</span>
          <span class="target-symbol">{{ prediction.targetSymbol || 'N/A' }}</span>
        </div>
        <span class="target-name">{{ prediction.targetName }}</span>
      </div>
      <div class="status-badge" :class="statusClass">
        {{ prediction.status }}
      </div>
    </div>

    <div class="card-body">
      <div class="direction-section">
        <div class="direction-indicator" :class="prediction.direction || 'neutral'">
          <span class="direction-icon">{{ directionIcon }}</span>
          <span class="direction-label">{{ (prediction.direction || 'neutral').toUpperCase() }}</span>
        </div>
        <div class="confidence-bar">
          <div
            class="confidence-fill"
            :style="{ width: `${Number(prediction.confidence || 0) * 100}%` }"
          ></div>
          <span class="confidence-label">{{ Math.round(Number(prediction.confidence || 0) * 100) }}%</span>
        </div>
      </div>

      <div class="metrics-row">
        <div v-if="prediction.magnitude != null" class="metric">
          <span class="metric-label">Magnitude</span>
          <span class="metric-value">{{ prediction.magnitude.toString().toUpperCase() }}</span>
        </div>
        <div v-if="prediction.timeframe" class="metric">
          <span class="metric-label">Timeframe</span>
          <span class="metric-value">{{ prediction.timeframe }}</span>
        </div>
        <div v-if="prediction.predictorCount" class="metric">
          <span class="metric-label">Predictors</span>
          <span class="metric-value">{{ prediction.predictorCount }}</span>
        </div>
      </div>

      <div class="llm-section">
        <LLMComparisonBadge
          :llm-ensemble-results="prediction.llmEnsembleResults"
          compact
        />
      </div>
    </div>

    <div class="card-footer">
      <div class="timestamp">
        <span class="label">Generated:</span>
        <span class="value">{{ formatDate(prediction.generatedAt) }}</span>
      </div>
      <div v-if="prediction.expiresAt" class="timestamp">
        <span class="label">Expires:</span>
        <span class="value">{{ formatDate(prediction.expiresAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Prediction } from '@/services/predictionDashboardService';
import LLMComparisonBadge from './LLMComparisonBadge.vue';

interface Props {
  prediction: Prediction;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
});

defineEmits<{
  select: [id: string];
}>();

const statusClass = computed(() => `status-${props.prediction.status || 'active'}`);

const directionIcon = computed(() => {
  switch (props.prediction.direction) {
    case 'up':
      return '\u2191'; // ↑
    case 'down':
      return '\u2193'; // ↓
    default:
      return '\u2194'; // ↔
  }
});

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
.prediction-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prediction-card:hover {
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.prediction-card.selected {
  border-color: var(--primary-color, #3b82f6);
  background: var(--selected-bg, #eff6ff);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.target-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.target-symbol {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.target-name {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.status-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-active {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.status-resolved {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.status-expired {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-cancelled {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.direction-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.direction-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-weight: 600;
}

.direction-indicator.up {
  background-color: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.direction-indicator.down {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.direction-indicator.flat {
  background-color: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.direction-icon {
  font-size: 1.25rem;
}

.direction-label {
  font-size: 0.875rem;
}

.confidence-bar {
  flex: 1;
  position: relative;
  height: 24px;
  background-color: var(--confidence-bg, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.confidence-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.confidence-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.metrics-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.metric-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  color: var(--text-secondary, #6b7280);
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.llm-section {
  display: flex;
  justify-content: flex-start;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.timestamp {
  display: flex;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.timestamp .label {
  color: var(--text-secondary, #6b7280);
}

.timestamp .value {
  color: var(--text-primary, #111827);
}

.target-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.test-badge {
  font-size: 0.5rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  background-color: rgba(139, 92, 246, 0.15);
  color: #7c3aed;
  margin-right: 0.25rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prediction-card {
    --card-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --selected-bg: #1e3a5f;
    --confidence-bg: #374151;
  }
}
</style>
