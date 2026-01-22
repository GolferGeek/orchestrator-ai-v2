<template>
  <div class="risk-dimension-card" :class="riskLevel">
    <div class="card-header">
      <span class="dimension-name">{{ assessment.dimensionName || assessment.dimensionSlug }}</span>
      <RiskScoreBadge :score="assessment.score" />
    </div>

    <div class="card-body">
      <div class="confidence-row">
        <span class="label">Confidence:</span>
        <span class="value">{{ formatPercent(assessment.confidence) }}</span>
      </div>

      <div v-if="assessment.dimensionWeight" class="weight-row">
        <span class="label">Weight:</span>
        <span class="value">{{ formatPercent(assessment.dimensionWeight) }}</span>
      </div>

      <!-- Signals -->
      <div v-if="assessment.signals && assessment.signals.length > 0" class="signals-section">
        <span class="signals-label">Key Signals:</span>
        <ul class="signals-list">
          <li
            v-for="(signal, index) in assessment.signals.slice(0, 3)"
            :key="index"
            :class="signal.impact"
          >
            {{ signal.description }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Expandable reasoning -->
    <div v-if="assessment.analystResponse?.reasoning" class="card-footer">
      <button class="expand-btn" @click="showReasoning = !showReasoning">
        {{ showReasoning ? 'Hide Reasoning' : 'Show Reasoning' }}
      </button>
      <div v-if="showReasoning" class="reasoning">
        {{ assessment.analystResponse.reasoning }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { RiskAssessment } from '@/types/risk-agent';
import RiskScoreBadge from './shared/RiskScoreBadge.vue';

interface Props {
  assessment: RiskAssessment;
}

const props = defineProps<Props>();

const showReasoning = ref(false);

const riskLevel = computed(() => {
  const score = props.assessment.score;
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
});

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}
</script>

<style scoped>
.risk-dimension-card {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  border-left: 4px solid var(--ion-border-color, #e0e0e0);
  overflow: hidden;
}

.risk-dimension-card.critical {
  border-left-color: var(--ion-color-danger, #eb445a);
}

.risk-dimension-card.high {
  border-left-color: var(--ion-color-warning, #ffc409);
}

.risk-dimension-card.medium {
  border-left-color: #ffd966;
}

.risk-dimension-card.low {
  border-left-color: var(--ion-color-success, #2dd36f);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--ion-color-light, #f4f5f8);
}

.dimension-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.card-body {
  padding: 0.75rem;
}

.confidence-row,
.weight-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.label {
  color: var(--ion-color-medium, #666);
}

.value {
  font-weight: 500;
}

.signals-section {
  margin-top: 0.75rem;
}

.signals-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  display: block;
  margin-bottom: 0.25rem;
}

.signals-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.75rem;
}

.signals-list li {
  margin-bottom: 0.25rem;
}

.signals-list li.negative {
  color: var(--ion-color-danger, #eb445a);
}

.signals-list li.positive {
  color: var(--ion-color-success, #2dd36f);
}

.card-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--ion-border-color, #e0e0e0);
}

.expand-btn {
  background: none;
  border: none;
  color: var(--ion-color-primary, #3880ff);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}

.expand-btn:hover {
  text-decoration: underline;
}

.reasoning {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  line-height: 1.4;
}
</style>
