<template>
  <div class="synthesis-panel">
    <div class="synthesis-header">
      <ion-icon :icon="documentTextOutline" />
      <h3>Executive Summary</h3>
    </div>

    <!-- Risk Level Badge -->
    <div class="risk-level">
      <span class="risk-label">Overall Risk Level:</span>
      <ion-badge :color="getRiskColor(riskLevel)" size="large">
        {{ riskLevel.toUpperCase() }}
      </ion-badge>
    </div>

    <!-- Summary Text -->
    <div v-if="summary" class="summary-text">
      {{ summary }}
    </div>

    <!-- Key Metrics -->
    <div class="key-metrics">
      <div class="metric">
        <div class="metric-value">{{ totalFindings }}</div>
        <div class="metric-label">Findings</div>
      </div>
      <div class="metric">
        <div class="metric-value" :class="{ 'has-issues': totalRisks > 0 }">{{ totalRisks }}</div>
        <div class="metric-label">Risks</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ totalRecommendations }}</div>
        <div class="metric-label">Recommendations</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{ specialistsInvolved }}</div>
        <div class="metric-label">Specialists</div>
      </div>
    </div>

    <!-- Risk Breakdown by Severity -->
    <div v-if="riskBreakdown.length > 0" class="risk-breakdown">
      <div class="breakdown-title">Risk Breakdown</div>
      <div class="breakdown-bars">
        <div
          v-for="item in riskBreakdown"
          :key="item.severity"
          class="breakdown-item"
        >
          <div class="breakdown-label">{{ item.severity }}</div>
          <div class="breakdown-bar">
            <div
              class="breakdown-fill"
              :class="`severity-${item.severity.toLowerCase()}`"
              :style="{ width: `${(item.count / totalRisks) * 100}%` }"
            />
          </div>
          <div class="breakdown-count">{{ item.count }}</div>
        </div>
      </div>
    </div>

    <!-- Key Issues -->
    <div v-if="keyIssues.length > 0" class="key-issues">
      <div class="issues-title">Key Issues</div>
      <ul class="issues-list">
        <li v-for="issue in keyIssues" :key="issue.id">
          <ion-icon :icon="warningOutline" :color="getRiskColor(issue.severity)" />
          <span>{{ issue.title }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { IonIcon, IonBadge } from '@ionic/vue';
import { documentTextOutline, warningOutline } from 'ionicons/icons';
import type { AnalysisResults, SpecialistOutputs } from '../legalDepartmentTypes';

// Props
const props = defineProps<{
  results?: AnalysisResults;
  specialistOutputs?: SpecialistOutputs;
}>();

// Computed
const summary = computed(() => {
  return props.results?.summary || generateSummary();
});

const totalFindings = computed(() => {
  return props.results?.findings?.length || 0;
});

const totalRisks = computed(() => {
  return props.results?.risks?.length || 0;
});

const totalRecommendations = computed(() => {
  return props.results?.recommendations?.length || 0;
});

const specialistsInvolved = computed(() => {
  if (!props.specialistOutputs) return 0;
  return Object.keys(props.specialistOutputs).filter(
    k => props.specialistOutputs?.[k as keyof SpecialistOutputs]
  ).length;
});

const riskLevel = computed(() => {
  const risks = props.results?.risks || [];
  if (risks.some(r => r.severity === 'critical')) return 'critical';
  if (risks.some(r => r.severity === 'high')) return 'high';
  if (risks.some(r => r.severity === 'medium')) return 'medium';
  if (risks.length > 0) return 'low';
  return 'low';
});

const riskBreakdown = computed(() => {
  const risks = props.results?.risks || [];
  const counts: Record<string, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const risk of risks) {
    const key = risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1);
    if (key in counts) {
      counts[key]++;
    }
  }

  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([severity, count]) => ({ severity, count }));
});

const keyIssues = computed(() => {
  const risks = props.results?.risks || [];
  // Return top 3 highest severity risks
  return [...risks]
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 3);
});

// Methods
function generateSummary(): string {
  const specialists = Object.keys(props.specialistOutputs || {});
  const findings = totalFindings.value;
  const risks = totalRisks.value;

  if (specialists.length === 0) {
    return 'Analysis pending...';
  }

  return `Document analyzed by ${specialists.length} specialist${specialists.length > 1 ? 's' : ''}. ` +
         `${findings} findings identified with ${risks} potential risk${risks !== 1 ? 's' : ''}.`;
}

function getRiskColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'tertiary';
    case 'low':
      return 'success';
    default:
      return 'medium';
  }
}
</script>

<style scoped>
.synthesis-panel {
  background: linear-gradient(135deg, var(--ion-color-primary-tint), var(--ion-color-tertiary-tint));
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.synthesis-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.synthesis-header ion-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.synthesis-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.risk-level {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.risk-label {
  font-weight: 500;
}

.risk-level ion-badge {
  font-size: 14px;
  padding: 6px 12px;
}

.summary-text {
  line-height: 1.6;
  margin-bottom: 20px;
  color: var(--ion-color-dark);
}

.key-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.metric {
  text-align: center;
  padding: 12px;
  background: var(--ion-background-color);
  border-radius: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--ion-color-primary);
}

.metric-value.has-issues {
  color: var(--ion-color-warning);
}

.metric-label {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.risk-breakdown {
  background: var(--ion-background-color);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.breakdown-title,
.issues-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
}

.breakdown-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breakdown-label {
  width: 60px;
  font-size: 12px;
  font-weight: 500;
}

.breakdown-bar {
  flex: 1;
  height: 8px;
  background: var(--ion-color-light);
  border-radius: 4px;
  overflow: hidden;
}

.breakdown-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.breakdown-fill.severity-critical {
  background: var(--ion-color-danger);
}

.breakdown-fill.severity-high {
  background: var(--ion-color-warning);
}

.breakdown-fill.severity-medium {
  background: var(--ion-color-tertiary);
}

.breakdown-fill.severity-low {
  background: var(--ion-color-success);
}

.breakdown-count {
  width: 24px;
  font-size: 12px;
  font-weight: 500;
  text-align: right;
}

.key-issues {
  background: var(--ion-background-color);
  border-radius: 8px;
  padding: 16px;
}

.issues-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.issues-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.issues-list li:last-child {
  border-bottom: none;
}

.issues-list ion-icon {
  font-size: 18px;
}

.issues-list span {
  font-size: 14px;
}

@media (max-width: 600px) {
  .key-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
