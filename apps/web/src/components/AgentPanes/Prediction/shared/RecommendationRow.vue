<template>
  <div class="recommendation-row">
    <div class="recommendation-header">
      <div class="recommendation-instrument">
        <span class="instrument-symbol">{{ recommendation.instrument }}</span>
        <span class="action-badge" :class="actionClass">
          {{ recommendation.action.toUpperCase() }}
        </span>
      </div>
      <ConfidenceBar :confidence="recommendation.confidence * 100" />
    </div>

    <div class="recommendation-rationale">
      <p>{{ recommendation.rationale }}</p>
    </div>

    <div class="recommendation-details">
      <div v-if="recommendation.targetPrice" class="detail-item">
        <span class="detail-label">Target Price:</span>
        <span class="detail-value">${{ recommendation.targetPrice.toFixed(2) }}</span>
      </div>
      <div v-if="recommendation.entryStyle" class="detail-item">
        <span class="detail-label">Entry:</span>
        <span class="detail-value">{{ recommendation.entryStyle }}</span>
      </div>
      <div v-if="recommendation.timingWindow" class="detail-item">
        <span class="detail-label">Valid:</span>
        <span class="detail-value">{{ formattedTimingWindow }}</span>
      </div>
      <div v-if="recommendation.sizing" class="detail-item">
        <span class="detail-label">Size:</span>
        <span class="detail-value">{{ formattedSizing }}</span>
      </div>
    </div>

    <div v-if="recommendation.evidence.length > 0 && showEvidence" class="recommendation-evidence">
      <h4>Evidence:</h4>
      <div class="evidence-list">
        <div v-for="(ev, idx) in recommendation.evidence" :key="idx" class="evidence-item">
          <div class="evidence-header">
            <span class="specialist-name">{{ ev.specialist }}</span>
            <ConfidenceBar :confidence="ev.confidence * 100" />
          </div>
          <p class="evidence-summary">{{ ev.summary }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Recommendation } from '@/types/prediction-agent';
import ConfidenceBar from './ConfidenceBar.vue';

interface Props {
  recommendation: Recommendation;
  showEvidence?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showEvidence: true,
});

const actionClass = computed(() => {
  const action = props.recommendation.action.toLowerCase();
  if (action === 'buy' || action === 'accumulate' || action === 'bet_yes') {
    return 'action-buy';
  }
  if (action === 'sell' || action === 'reduce' || action === 'bet_no') {
    return 'action-sell';
  }
  return 'action-hold';
});

const formattedTimingWindow = computed(() => {
  if (!props.recommendation.timingWindow) return '';
  const from = new Date(props.recommendation.timingWindow.validFrom).toLocaleDateString();
  const until = new Date(props.recommendation.timingWindow.validUntil).toLocaleDateString();
  return `${from} - ${until}`;
});

const formattedSizing = computed(() => {
  if (!props.recommendation.sizing) return '';
  const { size, unit } = props.recommendation.sizing;
  if (unit === 'percent') return `${size.toFixed(1)}%`;
  if (unit === 'usd') return `$${size.toFixed(2)}`;
  return `${size} ${unit}`;
});
</script>

<style scoped>
.recommendation-row {
  background-color: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recommendation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.recommendation-instrument {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.instrument-symbol {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.action-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
}

.action-buy {
  background-color: #d1fae5;
  color: #065f46;
}

.action-sell {
  background-color: #fee2e2;
  color: #991b1b;
}

.action-hold {
  background-color: #fef3c7;
  color: #92400e;
}

.recommendation-rationale {
  color: #374151;
  line-height: 1.6;
}

.recommendation-rationale p {
  margin: 0;
}

.recommendation-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.detail-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.detail-label {
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  color: #111827;
  font-weight: 600;
}

.recommendation-evidence {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}

.recommendation-evidence h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.evidence-item {
  padding: 0.75rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.evidence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.specialist-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.evidence-summary {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}
</style>
