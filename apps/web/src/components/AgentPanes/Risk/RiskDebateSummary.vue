<template>
  <div class="risk-debate-summary">
    <!-- Score Adjustment -->
    <div class="adjustment-banner" :class="adjustmentType">
      <span class="adjustment-label">Score Adjustment:</span>
      <span class="adjustment-value">{{ formatAdjustment(debate.scoreAdjustment) }}</span>
    </div>

    <!-- Three Column Layout -->
    <div class="debate-columns">
      <!-- Blue Team -->
      <div class="debate-column blue">
        <div class="column-header">
          <span class="team-icon">&#128153;</span>
          <span class="team-name">Blue Team (Defense)</span>
        </div>
        <div class="strength-score">
          Strength: {{ formatPercent(debate.blueAssessment.strengthScore) }}
        </div>
        <ul class="arguments-list">
          <li v-for="(arg, i) in debate.blueAssessment.arguments" :key="i">{{ arg }}</li>
        </ul>
        <div v-if="debate.blueAssessment.mitigatingFactors.length > 0" class="factors">
          <strong>Mitigating Factors:</strong>
          <ul>
            <li v-for="(factor, i) in debate.blueAssessment.mitigatingFactors" :key="i">{{ factor }}</li>
          </ul>
        </div>
      </div>

      <!-- Red Team -->
      <div class="debate-column red">
        <div class="column-header">
          <span class="team-icon">&#10060;</span>
          <span class="team-name">Red Team (Challenge)</span>
        </div>
        <div class="strength-score">
          Risk Score: {{ formatPercent(debate.redChallenges.riskScore) }}
        </div>
        <ul class="arguments-list">
          <li v-for="(challenge, i) in debate.redChallenges.challenges" :key="i">{{ challenge }}</li>
        </ul>
        <div v-if="debate.redChallenges.hiddenRisks.length > 0" class="factors">
          <strong>Hidden Risks:</strong>
          <ul>
            <li v-for="(risk, i) in debate.redChallenges.hiddenRisks" :key="i">{{ risk }}</li>
          </ul>
        </div>
      </div>

      <!-- Arbiter -->
      <div class="debate-column arbiter">
        <div class="column-header">
          <span class="team-icon">&#9878;</span>
          <span class="team-name">Arbiter (Synthesis)</span>
        </div>
        <div class="summary">
          {{ debate.arbiterSynthesis.summary }}
        </div>
        <div v-if="debate.arbiterSynthesis.keyTakeaways.length > 0" class="takeaways">
          <strong>Key Takeaways:</strong>
          <ul>
            <li v-for="(takeaway, i) in debate.arbiterSynthesis.keyTakeaways" :key="i">{{ takeaway }}</li>
          </ul>
        </div>
        <div class="recommendation">
          <strong>Recommendation:</strong> {{ debate.arbiterSynthesis.recommendation }}
        </div>
      </div>
    </div>

    <div class="debate-meta">
      <span>Debate conducted: {{ formatDate(debate.createdAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RiskDebate } from '@/types/risk-agent';

interface Props {
  debate: RiskDebate;
}

const props = defineProps<Props>();

const adjustmentType = computed(() => {
  if (props.debate.scoreAdjustment > 0.05) return 'increase';
  if (props.debate.scoreAdjustment < -0.05) return 'decrease';
  return 'neutral';
});

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}

function formatAdjustment(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + (value * 100).toFixed(1) + '%';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
.risk-debate-summary {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.adjustment-banner {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 4px;
  font-weight: 600;
}

.adjustment-banner.increase {
  background: var(--ion-color-danger-tint, #ffcccc);
  color: var(--ion-color-danger, #eb445a);
}

.adjustment-banner.decrease {
  background: var(--ion-color-success-tint, #c8f7c5);
  color: var(--ion-color-success-shade, #1e9e50);
}

.adjustment-banner.neutral {
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-color-medium, #666);
}

.debate-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.debate-column {
  padding: 1rem;
  border-radius: 8px;
  background: var(--ion-color-light, #f4f5f8);
}

.debate-column.blue {
  border-top: 3px solid #3b82f6;
}

.debate-column.red {
  border-top: 3px solid #ef4444;
}

.debate-column.arbiter {
  border-top: 3px solid #8b5cf6;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.team-icon {
  font-size: 1.25rem;
}

.team-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.strength-score {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  margin-bottom: 0.75rem;
}

.arguments-list {
  margin: 0 0 0.75rem;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
}

.arguments-list li {
  margin-bottom: 0.375rem;
}

.factors,
.takeaways {
  font-size: 0.75rem;
  margin-bottom: 0.75rem;
}

.factors ul,
.takeaways ul {
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}

.summary {
  font-size: 0.8125rem;
  line-height: 1.4;
  margin-bottom: 0.75rem;
}

.recommendation {
  font-size: 0.8125rem;
  padding: 0.5rem;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 4px;
}

.debate-meta {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  text-align: center;
}

@media (max-width: 768px) {
  .debate-columns {
    grid-template-columns: 1fr;
  }
}
</style>
