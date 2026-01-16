<template>
  <div class="overview-tab">
    <!-- Stats Section -->
    <section class="stats-section">
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalSubjects }}</span>
        <span class="stat-label">Total Subjects</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.analyzedSubjects }}</span>
        <span class="stat-label">Analyzed</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ averageScoreFormatted }}</span>
        <span class="stat-label">Avg Risk Score</span>
      </div>
      <div class="stat-card alert-stats">
        <div class="alert-row critical">
          <span class="alert-dot"></span>
          <span>{{ stats.criticalAlerts }} Critical</span>
        </div>
        <div class="alert-row warning">
          <span class="alert-dot"></span>
          <span>{{ stats.warningAlerts }} Warning</span>
        </div>
        <span class="stat-label">Active Alerts</span>
      </div>
    </section>

    <!-- Subjects with Scores -->
    <section class="subjects-section">
      <h3>Risk Analysis Results</h3>

      <div v-if="compositeScores.length === 0" class="empty-state">
        <span class="empty-icon">&#128202;</span>
        <p>No risk analysis results yet. Add subjects and run analysis.</p>
      </div>

      <div v-else class="subjects-grid">
        <div
          v-for="score in compositeScores"
          :key="score.id"
          class="subject-card"
          @click="$emit('select-subject', score.subjectId)"
        >
          <div class="subject-header">
            <h4>{{ score.subjectName || score.subjectIdentifier }}</h4>
            <span :class="['score-badge', getScoreClass(score.score)]">
              {{ formatScore(score.score) }}
            </span>
          </div>
          <div class="subject-details">
            <span class="subject-type">{{ score.subjectType }}</span>
            <span class="subject-age" :class="{ stale: score.ageHours > 168 }">
              {{ formatAge(score.ageHours) }}
            </span>
          </div>
          <div class="subject-dimensions">
            <div
              v-for="(dimScore, slug) in score.dimensionScores"
              :key="slug"
              class="dimension-score"
            >
              <span class="dim-name">{{ slug }}</span>
              <span class="dim-value">{{ formatScore(dimScore.score) }}</span>
            </div>
          </div>
          <div class="subject-actions">
            <button class="btn btn-small" @click.stop="$emit('analyze', score.subjectId)">
              Re-analyze
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RiskScope, RiskSubject, ActiveCompositeScoreView, DashboardStats } from '@/types/risk-agent';

const props = defineProps<{
  scope: RiskScope | null;
  subjects: RiskSubject[];
  compositeScores: ActiveCompositeScoreView[];
  stats: DashboardStats;
}>();

defineEmits<{
  'select-subject': [subjectId: string];
  'analyze': [subjectId: string];
}>();

const averageScoreFormatted = computed(() => {
  return props.stats.averageScore > 0 ? formatScore(props.stats.averageScore) : '-';
});

function formatScore(score: number): string {
  return (score * 100).toFixed(0) + '%';
}

function getScoreClass(score: number): string {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function formatAge(hours: number): string {
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
</script>

<style scoped>
.overview-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Stats */
.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.alert-stats {
  align-items: flex-start;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-primary, #111827);
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.alert-row.critical .alert-dot {
  background-color: #ef4444;
}

.alert-row.warning .alert-dot {
  background-color: #eab308;
}

/* Subjects */
.subjects-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.subject-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.subject-card:hover {
  border-color: var(--primary-color, #a87c4f);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.subject-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.subject-header h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.score-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.score-badge.high {
  background-color: #fef2f2;
  color: #dc2626;
}

.score-badge.medium {
  background-color: #fefce8;
  color: #ca8a04;
}

.score-badge.low {
  background-color: #f0fdf4;
  color: #16a34a;
}

.subject-details {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.subject-type {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  text-transform: capitalize;
}

.subject-age {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.subject-age.stale {
  color: #dc2626;
}

.subject-dimensions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.dimension-score {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  background: var(--dim-bg, #f9fafb);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.dim-name {
  color: var(--text-secondary, #6b7280);
}

.dim-value {
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.subject-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: var(--btn-secondary-bg, #f3f4f6);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover {
  background: var(--btn-secondary-hover, #e5e7eb);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
</style>
