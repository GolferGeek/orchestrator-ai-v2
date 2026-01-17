<template>
  <div class="analytics-tab">
    <!-- Sub-navigation for analytics features -->
    <nav class="analytics-nav">
      <button
        v-for="section in sections"
        :key="section.id"
        :class="['nav-btn', { active: activeSection === section.id }]"
        @click="activeSection = section.id"
      >
        <span class="nav-icon">{{ section.icon }}</span>
        <span class="nav-label">{{ section.label }}</span>
      </button>
    </nav>

    <!-- Content Area -->
    <div class="analytics-content">
      <!-- Score History Section -->
      <div v-if="activeSection === 'history'" class="section">
        <ScoreHistoryChart
          v-if="scopeId"
          :scope-id="scopeId"
          :subjects="subjects"
          @error="onError"
        />
      </div>

      <!-- Heatmap Section -->
      <div v-if="activeSection === 'heatmap'" class="section">
        <RiskHeatmap
          v-if="scopeId"
          :scope-id="scopeId"
          @select-subject="onSelectSubject"
          @error="onError"
        />
      </div>

      <!-- Comparison Section -->
      <div v-if="activeSection === 'comparison'" class="section">
        <SubjectComparison
          v-if="scopeId"
          :scope-id="scopeId"
          :subjects="subjects"
          :dimensions="dimensions"
          @error="onError"
        />
      </div>

      <!-- Portfolio Section -->
      <div v-if="activeSection === 'portfolio'" class="section">
        <PortfolioOverview
          v-if="scopeId"
          :scope-id="scopeId"
          @error="onError"
        />
      </div>

      <!-- Correlation Section -->
      <div v-if="activeSection === 'correlation'" class="section">
        <CorrelationMatrix
          v-if="scopeId"
          :scope-id="scopeId"
          :dimensions="dimensions"
          @error="onError"
        />
      </div>

      <!-- Executive Summary Section -->
      <div v-if="activeSection === 'summary'" class="section">
        <ExecutiveSummary
          v-if="scopeId"
          :scope-id="scopeId"
          @summary-generated="onSummaryGenerated"
          @error="onError"
        />
      </div>

      <!-- Scenario Analysis Section -->
      <div v-if="activeSection === 'scenario'" class="section">
        <ScenarioBuilder
          v-if="scopeId"
          :scope-id="scopeId"
          :dimensions="dimensions"
          @scenario-run="onScenarioRun"
          @scenario-saved="onScenarioSaved"
          @error="onError"
        />
      </div>

      <!-- Report Generator Section -->
      <div v-if="activeSection === 'reports'" class="section">
        <ReportGenerator
          v-if="scopeId"
          :scope-id="scopeId"
          :scope-name="scopeName"
          @report-generated="onReportGenerated"
          @error="onError"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { RiskSubject, RiskDimension, ExecutiveSummary as ExecutiveSummaryType, ScenarioResult, Scenario, Report } from '@/types/risk-agent';

// Import Phase 1 & 2 components
import ScoreHistoryChart from '../components/ScoreHistoryChart.vue';
import RiskHeatmap from '../components/RiskHeatmap.vue';
import SubjectComparison from '../components/SubjectComparison.vue';
import PortfolioOverview from '../components/PortfolioOverview.vue';
import CorrelationMatrix from '../components/CorrelationMatrix.vue';

// Import Phase 3 components
import ExecutiveSummary from '../components/ExecutiveSummary.vue';
import ScenarioBuilder from '../components/ScenarioBuilder.vue';
import ReportGenerator from '../components/ReportGenerator.vue';

const props = defineProps<{
  scopeId: string | null;
  scopeName?: string;
  subjects: RiskSubject[];
  dimensions: RiskDimension[];
}>();

const emit = defineEmits<{
  'select-subject': [subjectId: string];
  'error': [error: string];
  'summary-generated': [summary: ExecutiveSummaryType];
  'scenario-run': [result: ScenarioResult];
  'scenario-saved': [scenario: Scenario];
  'report-generated': [report: Report];
}>();

// Analytics sections configuration
const sections = [
  { id: 'history', label: 'Score History', icon: '📈' },
  { id: 'heatmap', label: 'Risk Heatmap', icon: '🗺️' },
  { id: 'comparison', label: 'Comparison', icon: '⚖️' },
  { id: 'portfolio', label: 'Portfolio', icon: '📊' },
  { id: 'correlation', label: 'Correlation', icon: '🔗' },
  { id: 'summary', label: 'AI Summary', icon: '🤖' },
  { id: 'scenario', label: 'Scenarios', icon: '🎯' },
  { id: 'reports', label: 'Reports', icon: '📄' },
];

// State
const activeSection = ref('history');

// Event handlers
function onSelectSubject(subjectId: string) {
  emit('select-subject', subjectId);
}

function onError(error: string) {
  emit('error', error);
}

function onSummaryGenerated(summary: ExecutiveSummaryType) {
  emit('summary-generated', summary);
}

function onScenarioRun(result: ScenarioResult) {
  emit('scenario-run', result);
}

function onScenarioSaved(scenario: Scenario) {
  emit('scenario-saved', scenario);
}

function onReportGenerated(report: Report) {
  emit('report-generated', report);
}
</script>

<style scoped>
.analytics-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Navigation */
.analytics-nav {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--nav-bg, #f9fafb);
  border-radius: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  color: var(--text-secondary, #6b7280);
}

.nav-btn:hover {
  background: var(--hover-bg, #f3f4f6);
  color: var(--text-primary, #111827);
}

.nav-btn.active {
  background: var(--primary-color, #a87c4f);
  color: white;
}

.nav-icon {
  font-size: 1rem;
}

.nav-label {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Content */
.analytics-content {
  min-height: 400px;
}

.section {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .analytics-tab {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --nav-bg: #374151;
    --hover-bg: #4b5563;
  }
}
</style>
