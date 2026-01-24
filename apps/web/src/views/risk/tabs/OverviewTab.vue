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
      <div class="section-header">
        <h3>Risk Analysis Results</h3>
        <button class="btn btn-primary" @click="$emit('add-subject')">
          + New Subject
        </button>
      </div>

      <div v-if="compositeScores.length === 0" class="empty-state">
        <span class="empty-icon">📊</span>
        <p>No risk analysis results yet. Add subjects and run analysis.</p>
        <button class="btn btn-primary" @click="$emit('add-subject')">
          + Add Your First Subject
        </button>
      </div>

      <div v-else class="subjects-grid">
        <div
          v-for="score in compositeScores"
          :key="score.id"
          class="subject-card"
          @click="handleSubjectClick(score)"
        >
          <div class="subject-header">
            <h4>{{ getSubjectDisplayName(score) }}</h4>
            <span :class="['score-badge', getScoreClass(getOverallScore(score))]">
              {{ formatScoreFromApi(score) }}
            </span>
          </div>
          <div class="subject-details">
            <span class="subject-type">{{ getSubjectType(score) }}</span>
            <span class="subject-age" :class="{ stale: getAgeHours(score) > 168 }">
              {{ formatAge(getAgeHours(score)) }}
            </span>
          </div>
          <div class="subject-dimensions">
            <div
              v-for="(dimScore, slug) in getDimensionScores(score)"
              :key="slug"
              class="dimension-score"
            >
              <span class="dim-name">{{ slug }}</span>
              <span class="dim-value">{{ formatDimensionScore(dimScore) }}</span>
            </div>
          </div>
          <div class="subject-actions">
            <button class="btn btn-small" @click.stop="$emit('analyze', getSubjectId(score))">
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

const emit = defineEmits<{
  'select-subject': [subjectId: string, compositeScore: ActiveCompositeScoreView];
  'analyze': [subjectId: string];
  'add-subject': [];
}>();

const averageScoreFormatted = computed(() => {
  return props.stats.averageScore > 0 ? formatScore(props.stats.averageScore) : '-';
});

// Type for API response which may have snake_case fields
type ApiScore = ActiveCompositeScoreView & {
  overall_score?: number;
  subject_id?: string;
  subject_identifier?: string;
  subject_name?: string;
  subject_type?: string;
  dimension_scores?: Record<string, number>;
  created_at?: string;
};

// Helper to get subject ID (handles both camelCase and snake_case)
function getSubjectId(score: ApiScore): string {
  // Try camelCase first (transformed), then snake_case (raw API), then check the record
  const s = score as unknown as Record<string, unknown>;
  
  // Try all possible field names
  const subjectId = 
    (s.subjectId as string) ||           // camelCase (transformed)
    (s.subject_id as string) ||          // snake_case (raw API)
    (score.subjectId as string) ||       // Direct property access
    (score.subject_id as string) ||      // Direct property access snake_case
    '';
  
  // Debug logging - always log to see what we're working with
  console.log('getSubjectId - score.id:', s.id);
  console.log('getSubjectId - s.subjectId:', s.subjectId);
  console.log('getSubjectId - s.subject_id:', s.subject_id);
  console.log('getSubjectId - extracted subjectId:', subjectId);
  
  if (!subjectId) {
    console.error('getSubjectId: No subjectId found!');
    console.error('All score keys:', Object.keys(s));
    console.error('Full score object:', JSON.stringify(score, null, 2));
  }
  
  return subjectId;
}

// Click handler with explicit logging
function handleSubjectClick(score: ApiScore) {
  console.log('=== CLICK HANDLER FIRED ===');
  console.log('Full score object:', JSON.stringify(score, null, 2));
  console.log('Score keys:', Object.keys(score));
  console.log('score.subjectId:', (score as unknown as Record<string, unknown>).subjectId);
  console.log('score.subject_id:', (score as unknown as Record<string, unknown>).subject_id);
  
  const subjectId = getSubjectId(score);
  console.log('Extracted subjectId:', subjectId);
  
  if (!subjectId || subjectId.trim() === '') {
    console.error('ERROR: getSubjectId returned empty string!');
    console.error('Score object:', score);
    alert('ERROR: Could not extract subjectId from score. Check console for details.');
    return;
  }
  
  console.log('Emitting select-subject event with subjectId:', subjectId);
  emit('select-subject', subjectId, score);
}

// Helper to get display name
function getSubjectDisplayName(score: ApiScore): string {
  return score.subjectName || score.subject_name ||
         score.subjectIdentifier || score.subject_identifier || 'Unknown';
}

// Helper to get subject type
function getSubjectType(score: ApiScore): string {
  return score.subjectType || score.subject_type || '';
}

// Helper to get overall score (API returns 0-100, frontend expects 0-1)
function getOverallScore(score: ApiScore): number {
  // Check for overall_score (0-100 from API) first
  if (typeof score.overall_score === 'number') {
    return score.overall_score / 100;
  }
  // Fallback to score (already 0-1)
  if (typeof score.score === 'number') {
    return score.score;
  }
  return 0;
}

// Format score from API response (handles both 0-100 and 0-1 scales)
function formatScoreFromApi(score: ApiScore): string {
  // Check for overall_score (0-100 from API) first
  if (typeof score.overall_score === 'number') {
    return score.overall_score.toFixed(0) + '%';
  }
  // Fallback to score (0-1 scale, multiply by 100)
  if (typeof score.score === 'number') {
    return (score.score * 100).toFixed(0) + '%';
  }
  return '-';
}

// Get dimension scores (handles both formats)
function getDimensionScores(score: ApiScore): Record<string, number> {
  return score.dimensionScores || score.dimension_scores || {};
}

// Format dimension score (could be 0-100 or 0-1)
function formatDimensionScore(dimScore: number | { score: number }): string {
  const value = typeof dimScore === 'object' ? dimScore.score : dimScore;
  // If score is > 1, assume it's 0-100 scale
  if (value > 1) {
    return value.toFixed(0) + '%';
  }
  return (value * 100).toFixed(0) + '%';
}

// Calculate age hours from created_at timestamp
function getAgeHours(score: ApiScore): number {
  // If ageHours is provided, use it
  if (typeof score.ageHours === 'number') {
    return score.ageHours;
  }
  // Calculate from created_at
  const createdAt = score.createdAt || score.created_at;
  if (createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }
  return 0;
}

function formatScore(score: number): string {
  return (score * 100).toFixed(0) + '%';
}

function getScoreClass(score: number): string {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function formatAge(hours: number): string {
  if (!hours || isNaN(hours)) return 'Unknown';
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--primary-color, #a87c4f);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-color-dark, #8f693f);
}

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
