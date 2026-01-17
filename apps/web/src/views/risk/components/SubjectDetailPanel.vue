<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="isOpen" class="panel-backdrop" @click="$emit('close')"></div>
    </Transition>

    <!-- Panel -->
    <Transition name="slide">
      <div v-if="isOpen" class="subject-detail-panel">
        <!-- Header -->
        <header class="panel-header">
          <div class="header-content">
            <h2>{{ subject?.subject?.name || 'Subject Details' }}</h2>
            <div class="header-meta">
              <span class="subject-identifier">{{ subject?.subject?.identifier }}</span>
              <span v-if="subject?.subject?.subjectType" class="subject-type-badge">
                {{ subject.subject.subjectType }}
              </span>
            </div>
          </div>
          <button class="close-btn" @click="$emit('close')" aria-label="Close panel">
            <span>&times;</span>
          </button>
        </header>

        <!-- Content -->
        <div class="panel-content">
          <!-- Loading State -->
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <span>Loading subject details...</span>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="error-state">
            <span class="error-icon">!</span>
            <span>{{ error }}</span>
          </div>

          <!-- Subject Details -->
          <template v-else-if="subject?.subject">
            <!-- Score Overview -->
            <section class="section score-section">
              <h3>Risk Score</h3>
              <div class="score-overview">
                <div class="main-score">
                  <span :class="['score-value', getScoreClass(overallScore)]">
                    {{ formatScore(overallScore) }}
                  </span>
                  <span class="score-label">Overall Risk</span>
                </div>
                <div class="confidence-indicator">
                  <span class="confidence-value">{{ formatScore(overallConfidence) }}</span>
                  <span class="confidence-label">Confidence</span>
                </div>
              </div>
              <p v-if="subject.compositeScore?.debateAdjustment" class="debate-adjustment">
                Debate adjustment: {{ subject.compositeScore.debateAdjustment > 0 ? '+' : '' }}{{ (subject.compositeScore.debateAdjustment * 100).toFixed(1) }}%
              </p>
            </section>

            <!-- Radar Chart -->
            <section v-if="displayAssessments.length > 0" class="section radar-section">
              <h3>Risk Dimensions</h3>
              <RiskRadarChart :assessments="displayAssessments" :size="260" />
            </section>

            <!-- Assessments Grid -->
            <section v-if="displayAssessments.length > 0" class="section assessments-section">
              <h3>Dimension Assessments</h3>
              <div class="assessments-grid">
                <div
                  v-for="assessment in displayAssessments"
                  :key="assessment.id"
                  class="assessment-card"
                  :class="{ expanded: expandedAssessments.has(assessment.id) }"
                  @click="toggleAssessment(assessment.id)"
                >
                  <div class="assessment-header">
                    <span class="assessment-name">{{ assessment.dimensionName || assessment.dimensionSlug }}</span>
                    <span :class="['assessment-score', getScoreClass(assessment.score)]">
                      {{ formatScore(assessment.score) }}
                    </span>
                  </div>
                  <div class="assessment-meta">
                    <span class="assessment-confidence">Confidence: {{ formatScore(assessment.confidence) }}</span>
                    <span class="expand-icon">{{ expandedAssessments.has(assessment.id) ? '−' : '+' }}</span>
                  </div>
                  <Transition name="expand">
                    <div v-if="expandedAssessments.has(assessment.id)" class="assessment-details">
                      <div v-if="assessment.analystResponse?.reasoning" class="reasoning">
                        <strong>Reasoning:</strong>
                        <p>{{ assessment.analystResponse.reasoning }}</p>
                      </div>
                      <div v-if="assessment.signals?.length > 0" class="signals">
                        <strong>Signals:</strong>
                        <ul>
                          <li v-for="(signal, idx) in assessment.signals" :key="idx" :class="`signal-${signal.impact}`">
                            {{ signal.description }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </section>

            <!-- Debate Section -->
            <section v-if="subject.debate" class="section debate-section">
              <h3>Red Team / Blue Team Analysis</h3>

              <div class="debate-card blue-team">
                <h4>Blue Team (Defense)</h4>
                <p class="strength-score">Strength: {{ formatScore(subject.debate.blueAssessment?.strengthScore || 0) }}</p>
                <ul v-if="subject.debate.blueAssessment?.arguments?.length">
                  <li v-for="(arg, idx) in subject.debate.blueAssessment.arguments" :key="idx">{{ arg }}</li>
                </ul>
                <div v-if="subject.debate.blueAssessment?.mitigatingFactors?.length" class="mitigating-factors">
                  <strong>Mitigating Factors:</strong>
                  <ul>
                    <li v-for="(factor, idx) in subject.debate.blueAssessment.mitigatingFactors" :key="idx">{{ factor }}</li>
                  </ul>
                </div>
              </div>

              <div class="debate-card red-team">
                <h4>Red Team (Challenge)</h4>
                <p class="risk-score">Risk: {{ formatScore(subject.debate.redChallenges?.riskScore || 0) }}</p>
                <ul v-if="subject.debate.redChallenges?.challenges?.length">
                  <li v-for="(challenge, idx) in subject.debate.redChallenges.challenges" :key="idx">{{ challenge }}</li>
                </ul>
                <div v-if="subject.debate.redChallenges?.hiddenRisks?.length" class="hidden-risks">
                  <strong>Hidden Risks:</strong>
                  <ul>
                    <li v-for="(risk, idx) in subject.debate.redChallenges.hiddenRisks" :key="idx">{{ risk }}</li>
                  </ul>
                </div>
              </div>

              <div v-if="subject.debate.arbiterSynthesis" class="debate-card arbiter">
                <h4>Arbiter Synthesis</h4>
                <p class="arbiter-summary">{{ subject.debate.arbiterSynthesis.summary }}</p>
                <p v-if="subject.debate.arbiterSynthesis.recommendation" class="arbiter-recommendation">
                  <strong>Recommendation:</strong> {{ subject.debate.arbiterSynthesis.recommendation }}
                </p>
                <div v-if="subject.debate.arbiterSynthesis.keyTakeaways?.length" class="key-takeaways">
                  <strong>Key Takeaways:</strong>
                  <ul>
                    <li v-for="(takeaway, idx) in subject.debate.arbiterSynthesis.keyTakeaways" :key="idx">{{ takeaway }}</li>
                  </ul>
                </div>
              </div>
            </section>

            <!-- Alerts Section -->
            <section v-if="subject.alerts?.length > 0" class="section alerts-section">
              <h3>Active Alerts</h3>
              <div class="alerts-list">
                <div
                  v-for="alert in subject.alerts"
                  :key="alert.id"
                  :class="['alert-item', `severity-${alert.severity}`]"
                >
                  <span class="alert-severity">{{ alert.severity }}</span>
                  <span class="alert-message">{{ alert.message }}</span>
                  <span class="alert-time">{{ formatTime(alert.createdAt) }}</span>
                </div>
              </div>
            </section>

            <!-- Actions -->
            <section class="section actions-section">
              <button
                class="btn btn-primary"
                :disabled="isAnalyzing"
                @click="$emit('analyze', subject.subject?.id)"
              >
                <span v-if="isAnalyzing" class="spinner-small"></span>
                <span>{{ isAnalyzing ? 'Analyzing...' : 'Re-analyze' }}</span>
              </button>
            </section>
          </template>

          <!-- Empty State -->
          <div v-else class="empty-state">
            <span class="empty-icon">📊</span>
            <p>No subject data available</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import RiskRadarChart from '@/components/AgentPanes/Risk/RiskRadarChart.vue';
import type { SelectedSubjectState } from '@/types/risk-agent';

interface Props {
  isOpen: boolean;
  subject: SelectedSubjectState | null;
  isLoading?: boolean;
  isAnalyzing?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isAnalyzing: false,
  error: null,
});

defineEmits<{
  close: [];
  analyze: [subjectId: string];
}>();

// Track expanded assessment cards
const expandedAssessments = ref<Set<string>>(new Set());

const overallScore = computed(() => {
  const cs = props.subject?.compositeScore;
  if (!cs) return 0;
  // Handle both snake_case and camelCase, and both 0-1 and 0-100 scales
  // API returns overall_score in 0-100 scale
  const csRecord = cs as unknown as Record<string, unknown>;
  const raw =
    (typeof csRecord['overall_score'] === 'number'
      ? csRecord['overall_score']
      : undefined) ??
    (typeof csRecord['score'] === 'number' ? csRecord['score'] : undefined) ??
    0;
  return raw > 1 ? raw / 100 : raw;
});

const overallConfidence = computed(() => {
  const cs = props.subject?.compositeScore;
  if (!cs) return 0;
  const csRecord = cs as unknown as Record<string, unknown>;
  const raw = typeof csRecord['confidence'] === 'number' ? csRecord['confidence'] : 0;
  return raw > 1 ? raw / 100 : raw;
});

// Get dimension scores from composite score as fallback when assessments aren't loaded
const dimensionScoresFromComposite = computed(() => {
  const cs = props.subject?.compositeScore;
  if (!cs) return [];
  // Handle both snake_case and camelCase - API returns dimension_scores
  const csRecord = cs as unknown as Record<string, unknown>;
  const scores =
    (typeof csRecord['dimension_scores'] === 'object' && csRecord['dimension_scores'])
      ? (csRecord['dimension_scores'] as Record<string, unknown>)
      : (typeof csRecord['dimensionScores'] === 'object' && csRecord['dimensionScores'])
        ? (csRecord['dimensionScores'] as Record<string, unknown>)
        : {};
  return Object.entries(scores).map(([slug, data]: [string, unknown]) => {
    // Dimension scores can be raw numbers (0-100) or objects with score property
    const dataRecord =
      typeof data === 'object' && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;
    const rawScore =
      dataRecord && typeof dataRecord['score'] === 'number'
        ? dataRecord['score']
        : typeof data === 'number'
          ? data
          : 0;
    const rawConfidence =
      dataRecord && typeof dataRecord['confidence'] === 'number'
        ? dataRecord['confidence']
        : 0.8;
    const weight =
      dataRecord && typeof dataRecord['weight'] === 'number' ? dataRecord['weight'] : 1;
    return {
      id: slug,
      dimensionSlug: slug,
      dimensionName: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      // Normalize to 0-1 scale for display functions
      score: rawScore > 1 ? rawScore / 100 : rawScore,
      confidence: rawConfidence > 1 ? rawConfidence / 100 : rawConfidence,
      weight,
    };
  });
});

// Use assessments if available, otherwise use dimension scores from composite
const displayAssessments = computed(() => {
  if (props.subject?.assessments && props.subject.assessments.length > 0) {
    return props.subject.assessments;
  }
  return dimensionScoresFromComposite.value;
});

function toggleAssessment(id: string) {
  if (expandedAssessments.value.has(id)) {
    expandedAssessments.value.delete(id);
  } else {
    expandedAssessments.value.add(id);
  }
}

// Normalize score to 0-1 range if needed
function normalizeScore(score: number): number {
  return score > 1 ? score / 100 : score;
}

function formatScore(score: number): string {
  const normalized = normalizeScore(score);
  return (normalized * 100).toFixed(0) + '%';
}

function getScoreClass(score: number): string {
  const normalized = normalizeScore(score);
  if (normalized >= 0.7) return 'high';
  if (normalized >= 0.4) return 'medium';
  return 'low';
}

function formatTime(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
</script>

<style scoped>
/* Backdrop */
.panel-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

/* Panel */
.subject-detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  max-width: 100vw;
  background: var(--panel-bg, #ffffff);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem;
  background: var(--header-bg, #f9fafb);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.header-content h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.subject-identifier {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.subject-type-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--primary-color, #a87c4f);
  color: white;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  padding: 0.25rem;
  margin: -0.25rem -0.25rem 0 0;
}

.close-btn:hover {
  color: var(--text-primary, #111827);
}

/* Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Sections */
.section {
  margin-bottom: 1.5rem;
}

.section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

/* Score Section */
.score-overview {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.main-score,
.confidence-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.score-value {
  font-size: 2rem;
  font-weight: 700;
}

.score-value.high { color: #dc2626; }
.score-value.medium { color: #ca8a04; }
.score-value.low { color: #16a34a; }

.score-label,
.confidence-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.confidence-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.debate-adjustment {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.5rem;
}

/* Radar Section */
.radar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Assessments Section */
.assessments-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.assessment-card {
  background: var(--card-bg, #f9fafb);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.assessment-card:hover {
  border-color: var(--primary-color, #a87c4f);
}

.assessment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.assessment-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
}

.assessment-score {
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.assessment-score.high { background: #fef2f2; color: #dc2626; }
.assessment-score.medium { background: #fefce8; color: #ca8a04; }
.assessment-score.low { background: #f0fdf4; color: #16a34a; }

.assessment-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
}

.assessment-confidence {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.expand-icon {
  font-size: 1rem;
  color: var(--text-secondary, #6b7280);
}

.assessment-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  font-size: 0.8125rem;
}

.assessment-details .reasoning p {
  margin: 0.25rem 0 0 0;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}

.assessment-details .signals {
  margin-top: 0.5rem;
}

.assessment-details .signals ul {
  margin: 0.25rem 0 0 0;
  padding-left: 1.25rem;
}

.assessment-details .signals li {
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.25rem;
}

.signal-positive { color: #16a34a !important; }
.signal-negative { color: #dc2626 !important; }
.signal-neutral { color: #6b7280 !important; }

/* Debate Section */
.debate-card {
  background: var(--card-bg, #f9fafb);
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.debate-card h4 {
  font-size: 0.8125rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.debate-card.blue-team {
  border-left: 3px solid #3b82f6;
}

.debate-card.red-team {
  border-left: 3px solid #ef4444;
}

.debate-card.arbiter {
  border-left: 3px solid var(--primary-color, #a87c4f);
}

.debate-card ul {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
}

.debate-card li {
  margin-bottom: 0.25rem;
}

.strength-score,
.risk-score {
  font-size: 0.75rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
}

.arbiter-summary {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
}

.arbiter-recommendation {
  font-size: 0.8125rem;
  margin: 0.5rem 0;
}

.mitigating-factors,
.hidden-risks,
.key-takeaways {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

/* Alerts Section */
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.alert-item.severity-critical {
  background: #fef2f2;
  border-left: 3px solid #ef4444;
}

.alert-item.severity-warning {
  background: #fefce8;
  border-left: 3px solid #eab308;
}

.alert-item.severity-info {
  background: #eff6ff;
  border-left: 3px solid #3b82f6;
}

.alert-severity {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.alert-message {
  flex: 1;
  color: var(--text-primary, #111827);
}

.alert-time {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

/* Actions Section */
.actions-section {
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
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

.btn-primary:hover:not(:disabled) {
  background: var(--primary-color-dark, #8f693f);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #a87c4f);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 2.5rem;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}

/* Responsive */
@media (max-width: 480px) {
  .subject-detail-panel {
    width: 100vw;
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .subject-detail-panel {
    --panel-bg: #1f2937;
    --header-bg: #111827;
    --card-bg: #374151;
    --border-color: #4b5563;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
  }

  .assessment-score.high { background: rgba(220, 38, 38, 0.2); }
  .assessment-score.medium { background: rgba(202, 138, 4, 0.2); }
  .assessment-score.low { background: rgba(22, 163, 74, 0.2); }

  .alert-item.severity-critical { background: rgba(239, 68, 68, 0.15); }
  .alert-item.severity-warning { background: rgba(234, 179, 8, 0.15); }
  .alert-item.severity-info { background: rgba(59, 130, 246, 0.15); }
}
</style>
