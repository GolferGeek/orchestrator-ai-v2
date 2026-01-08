<template>
  <div class="claim-card">
    <div class="claim-header">
      <div class="claim-type">
        <span class="claim-type-badge">{{ claim.type }}</span>
        <span class="claim-instrument">{{ claim.instrument }}</span>
      </div>
      <ConfidenceBar :confidence="claim.confidence * 100" />
    </div>
    <div class="claim-value">
      <span class="value-label">Value:</span>
      <span class="value-text">{{ formattedValue }}</span>
    </div>
    <div class="claim-meta">
      <div class="meta-item">
        <span class="meta-label">Source:</span>
        <span class="meta-value">{{ source || 'Unknown' }}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Time:</span>
        <span class="meta-value">{{ formattedTimestamp }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Claim } from '@/types/prediction-agent';
import ConfidenceBar from './ConfidenceBar.vue';

interface Props {
  claim: Claim;
  source?: string;
}

const props = defineProps<Props>();

const formattedValue = computed(() => {
  const { value, unit } = props.claim;
  if (typeof value === 'number') {
    if (unit === 'USD' || unit === 'usd') {
      return `$${value.toFixed(2)}`;
    }
    if (unit === 'percent' || unit === '%') {
      return `${value.toFixed(2)}%`;
    }
    return `${value.toFixed(2)} ${unit || ''}`.trim();
  }
  return `${value}`;
});

const formattedTimestamp = computed(() => {
  const date = new Date(props.claim.timestamp);
  return date.toLocaleString();
});
</script>

<style scoped>
.claim-card {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.claim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.claim-type {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.claim-type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background-color: #3b82f6;
  color: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  width: fit-content;
}

.claim-instrument {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.claim-value {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.value-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.value-text {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.claim-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
}

.meta-item {
  display: flex;
  gap: 0.25rem;
}

.meta-label {
  color: #6b7280;
}

.meta-value {
  color: #374151;
  font-weight: 500;
}
</style>
