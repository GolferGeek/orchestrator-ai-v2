<template>
  <div class="risk-detail-view">
    <!-- Subject Header -->
    <div class="detail-header">
      <div class="subject-info">
        <h3>{{ subject.identifier }}</h3>
        <p>{{ subject.name }}</p>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="$emit('analyze', subject.id)">
          Re-analyze
        </button>
        <button
          v-if="compositeScore && compositeScore.score >= 0.7"
          class="action-btn debate-btn"
          @click="$emit('trigger-debate', compositeScore.id)"
        >
          Trigger Debate
        </button>
      </div>
    </div>

    <!-- Composite Score Card -->
    <div v-if="compositeScore" class="score-card">
      <div class="score-main">
        <RiskScoreBadge :score="compositeScore.score" />
        <span class="confidence">
          Confidence: {{ formatPercent(compositeScore.confidence) }}
        </span>
      </div>
      <div class="score-meta">
        <span>Last analyzed: {{ formatDate(compositeScore.createdAt) }}</span>
        <span v-if="compositeScore.debateAdjustment">
          Debate adjustment: {{ formatAdjustment(compositeScore.debateAdjustment) }}
        </span>
      </div>
    </div>

    <!-- Radar Chart -->
    <div class="radar-section" v-if="assessments.length > 0">
      <h4>Risk Radar</h4>
      <RiskRadarChart :assessments="assessments" />
    </div>

    <!-- Dimension Assessments -->
    <div class="assessments-section">
      <h4>Dimension Assessments</h4>
      <div class="assessments-grid">
        <RiskDimensionCard
          v-for="assessment in assessments"
          :key="assessment.id"
          :assessment="assessment"
        />
      </div>
    </div>

    <!-- Debate Summary -->
    <div v-if="debate" class="debate-section">
      <h4>Red Team / Blue Team Debate</h4>
      <RiskDebateSummary :debate="debate" />
    </div>

    <!-- Alerts -->
    <div v-if="alerts.length > 0" class="alerts-section">
      <h4>Active Alerts</h4>
      <div class="alerts-list">
        <div
          v-for="alert in alerts"
          :key="alert.id"
          class="alert-item"
          :class="alert.severity"
        >
          <span class="alert-severity">{{ alert.severity }}</span>
          <span class="alert-message">{{ alert.message }}</span>
          <span class="alert-time">{{ formatDate(alert.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RiskSubject, RiskCompositeScore, RiskAssessment, RiskDebate, RiskAlert } from '@/types/risk-agent';
import RiskScoreBadge from './shared/RiskScoreBadge.vue';
import RiskRadarChart from './RiskRadarChart.vue';
import RiskDimensionCard from './RiskDimensionCard.vue';
import RiskDebateSummary from './RiskDebateSummary.vue';

interface Props {
  subject: RiskSubject;
  compositeScore: RiskCompositeScore | null;
  assessments: RiskAssessment[];
  debate: RiskDebate | null;
  alerts: RiskAlert[];
}

defineProps<Props>();

defineEmits<{
  (e: 'analyze', subjectId: string): void;
  (e: 'trigger-debate', compositeScoreId: string): void;
}>();

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAdjustment(adjustment: number): string {
  const sign = adjustment >= 0 ? '+' : '';
  return sign + (adjustment * 100).toFixed(1) + '%';
}
</script>

<style scoped>
.risk-detail-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.subject-info h3 {
  margin: 0;
  font-size: 1.25rem;
}

.subject-info p {
  margin: 0.25rem 0 0;
  color: var(--ion-color-medium, #666);
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ion-border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--ion-card-background, #fff);
  cursor: pointer;
  font-size: 0.875rem;
}

.action-btn:hover {
  background: var(--ion-color-light, #f4f5f8);
}

.debate-btn {
  background: var(--ion-color-warning-tint, #fff3cd);
  border-color: var(--ion-color-warning, #ffc409);
}

.score-card {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.score-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.confidence {
  color: var(--ion-color-medium, #666);
  font-size: 0.875rem;
}

.score-meta {
  margin-top: 0.5rem;
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
}

.radar-section,
.assessments-section,
.debate-section,
.alerts-section {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.radar-section h4,
.assessments-section h4,
.debate-section h4,
.alerts-section h4 {
  margin: 0 0 1rem;
  font-size: 1rem;
}

.assessments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 4px;
  background: var(--ion-color-light, #f4f5f8);
}

.alert-item.critical {
  background: var(--ion-color-danger-tint, #ffcccc);
}

.alert-item.warning {
  background: var(--ion-color-warning-tint, #fff3cd);
}

.alert-severity {
  font-size: 0.625rem;
  text-transform: uppercase;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.alert-message {
  flex: 1;
  font-size: 0.875rem;
}

.alert-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
}
</style>
