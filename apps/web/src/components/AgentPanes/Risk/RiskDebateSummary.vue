<template>
  <div class="risk-debate-summary">
    <!-- Score Adjustment -->
    <div class="adjustment-banner" :class="adjustmentType">
      <span class="adjustment-label">Score Adjustment:</span>
      <span class="adjustment-value">{{ formatAdjustment(scoreAdjustment) }}</span>
    </div>

    <!-- Three Column Layout -->
    <div class="debate-columns">
      <!-- Blue Team -->
      <div class="debate-column blue">
        <div class="column-header">
          <span class="team-icon">&#128153;</span>
          <span class="team-name">Blue Team (Defense)</span>
        </div>
        <div v-if="blueStrengthScore !== null" class="strength-score">
          Confidence: {{ formatPercent(blueStrengthScore) }}
        </div>
        <div v-if="blueSummary" class="summary">{{ blueSummary }}</div>
        <ul v-if="blueKeyPoints.length > 0" class="arguments-list">
          <li v-for="(point, i) in blueKeyPoints" :key="i">{{ point }}</li>
        </ul>
      </div>

      <!-- Red Team -->
      <div class="debate-column red">
        <div class="column-header">
          <span class="team-icon">&#10060;</span>
          <span class="team-name">Red Team (Challenge)</span>
        </div>
        <div v-if="redConfidence !== null" class="strength-score">
          Confidence: {{ formatPercent(redConfidence) }}
        </div>
        <div v-if="redChallengesList.length > 0" class="red-section">
          <strong>Challenges:</strong>
          <ul class="arguments-list">
            <li v-for="(challenge, i) in redChallengesList" :key="i">
              <strong v-if="challenge.area">{{ challenge.area }}:</strong> {{ challenge.text }}
              <span v-if="challenge.severity" :class="['severity-badge', challenge.severity]">
                {{ challenge.severity }}
              </span>
            </li>
          </ul>
        </div>
        <div v-if="redBlindSpots.length > 0" class="red-section">
          <strong>Blind Spots:</strong>
          <ul class="arguments-list">
            <li v-for="(spot, i) in redBlindSpots" :key="'bs-' + i">{{ spot }}</li>
          </ul>
        </div>
        <div v-if="redOverstated.length > 0" class="red-section">
          <strong>Overstated Risks:</strong>
          <ul class="arguments-list">
            <li v-for="(risk, i) in redOverstated" :key="'os-' + i">{{ risk }}</li>
          </ul>
        </div>
        <div v-if="redUnderstated.length > 0" class="red-section">
          <strong>Understated Risks:</strong>
          <ul class="arguments-list">
            <li v-for="(risk, i) in redUnderstated" :key="'us-' + i">{{ risk }}</li>
          </ul>
        </div>
        <p v-if="redChallengesList.length === 0 && redBlindSpots.length === 0" class="no-data">
          No challenges recorded
        </p>
      </div>

      <!-- Arbiter / Synthesis (if available) -->
      <div v-if="hasArbiter" class="debate-column arbiter">
        <div class="column-header">
          <span class="team-icon">&#9878;</span>
          <span class="team-name">Arbiter (Synthesis)</span>
        </div>
        <div v-if="arbiterSummary" class="summary">{{ arbiterSummary }}</div>
        <div v-if="arbiterTakeaways.length > 0" class="takeaways">
          <strong>Key Takeaways:</strong>
          <ul>
            <li v-for="(takeaway, i) in arbiterTakeaways" :key="i">{{ takeaway }}</li>
          </ul>
        </div>
        <div v-if="arbiterRecommendation" class="recommendation">
          <strong>Recommendation:</strong> {{ arbiterRecommendation }}
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

// Safe access to debate fields with fallbacks for different data formats
const debateRecord = computed(() => props.debate as unknown as Record<string, unknown>);

// Score adjustment - handles both camelCase and snake_case
const scoreAdjustment = computed(() => {
  const d = debateRecord.value;
  const adj = d.scoreAdjustment ?? d.score_adjustment ?? 0;
  // If stored as integer (like 3 for 3%), convert to decimal
  const numAdj = typeof adj === 'number' ? adj : 0;
  return numAdj > 1 ? numAdj / 100 : numAdj;
});

const adjustmentType = computed(() => {
  if (scoreAdjustment.value > 0.02) return 'increase';
  if (scoreAdjustment.value < -0.02) return 'decrease';
  return 'neutral';
});

// Blue Team (Defense) - handles both old and new data formats
const blueAssessment = computed(() => {
  const d = debateRecord.value;
  return (d.blueAssessment || d.blue_assessment || {}) as Record<string, unknown>;
});

const blueStrengthScore = computed(() => {
  const blue = blueAssessment.value;
  const score = blue.strengthScore ?? blue.confidence ?? null;
  if (typeof score !== 'number') return null;
  return score > 1 ? score / 100 : score;
});

const blueSummary = computed(() => blueAssessment.value.summary as string || '');

const blueKeyPoints = computed(() => {
  const blue = blueAssessment.value;
  const points = blue.keyPoints || blue.arguments || [];
  return Array.isArray(points) ? points : [];
});

// Red Team (Challenge) - handles both old and new data formats
const redChallenges = computed(() => {
  const d = debateRecord.value;
  return (d.redChallenges || d.red_challenges || {}) as Record<string, unknown>;
});

const redConfidence = computed(() => {
  const red = redChallenges.value;
  const score = red.confidence ?? red.riskScore ?? null;
  if (typeof score !== 'number') return null;
  return score > 1 ? score / 100 : score;
});

const redChallengesList = computed(() => {
  const red = redChallenges.value;
  console.log('[RiskDebateSummary] Red challenges data:', JSON.stringify(red, null, 2));
  const challenges = red.challenges || [];
  if (!Array.isArray(challenges)) return [];
  // Normalize challenge format - could be strings or objects
  // Backend uses: { dimension, challenge, evidence, suggested_adjustment }
  return challenges.map((c: unknown) => {
    if (typeof c === 'string') return { text: c, area: '', severity: '' };
    const cObj = c as Record<string, unknown>;
    const adjustment = typeof cObj.suggested_adjustment === 'number' ? cObj.suggested_adjustment : 0;
    // Map severity from adjustment: high if > 10, medium if > 5, low otherwise
    const severity = Math.abs(adjustment) > 10 ? 'high' : Math.abs(adjustment) > 5 ? 'medium' : 'low';
    return {
      text: (cObj.challenge || cObj.text || '') as string,
      area: (cObj.dimension || cObj.area || '') as string,  // Backend uses 'dimension'
      severity: severity,
    };
  });
});

// Additional red team findings
const redBlindSpots = computed(() => {
  const red = redChallenges.value;
  const spots = red.blind_spots || red.blindSpots || [];
  if (!Array.isArray(spots)) return [];

  // Filter and clean up blind spots - some might be raw JSON from failed parsing
  return spots
    .filter((s): s is string => typeof s === 'string')
    .map(spot => {
      // If it looks like JSON, try to extract meaningful text
      if (spot.trim().startsWith('{') || spot.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(spot);
          // If it's the full challenges object, extract challenge texts
          if (parsed.challenges && Array.isArray(parsed.challenges)) {
            return parsed.challenges
              .map((c: Record<string, unknown>) => c.challenge || c.text || '')
              .filter(Boolean)
              .join('; ');
          }
          return '';
        } catch {
          // Not valid JSON, just truncate the raw text
          return spot.length > 100 ? spot.slice(0, 100) + '...' : spot;
        }
      }
      return spot;
    })
    .filter(Boolean);
});

const redOverstated = computed(() => {
  const red = redChallenges.value;
  const risks = red.overstated_risks || red.overstatedRisks || [];
  return Array.isArray(risks) ? risks.filter((r): r is string => typeof r === 'string') : [];
});

const redUnderstated = computed(() => {
  const red = redChallenges.value;
  const risks = red.understated_risks || red.understatedRisks || [];
  return Array.isArray(risks) ? risks.filter((r): r is string => typeof r === 'string') : [];
});

// Arbiter (Synthesis) - may not exist in all debates
const arbiterSynthesis = computed(() => {
  const d = debateRecord.value;
  return (d.arbiterSynthesis || d.arbiter_synthesis || null) as Record<string, unknown> | null;
});

const hasArbiter = computed(() => !!arbiterSynthesis.value);
const arbiterSummary = computed(() => arbiterSynthesis.value?.summary as string || '');
const arbiterTakeaways = computed(() => {
  const arb = arbiterSynthesis.value;
  const takeaways = arb?.keyTakeaways || arb?.key_takeaways || [];
  return Array.isArray(takeaways) ? takeaways : [];
});
const arbiterRecommendation = computed(() => arbiterSynthesis.value?.recommendation as string || '');

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  const normalized = value > 1 ? value / 100 : value;
  return (normalized * 100).toFixed(0) + '%';
}

function formatAdjustment(value: number): string {
  const sign = value >= 0 ? '+' : '';
  // If already a decimal (0.03), multiply by 100. If integer (3), use as is.
  const displayValue = Math.abs(value) < 1 ? value * 100 : value;
  return sign + displayValue.toFixed(1) + '%';
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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

.red-section {
  margin-bottom: 0.75rem;
}

.red-section > strong {
  display: block;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  margin-bottom: 0.25rem;
}

.no-data {
  font-size: 0.8125rem;
  font-style: italic;
  color: var(--ion-color-medium, #666);
  margin: 0;
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
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.severity-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 600;
  margin-left: 0.5rem;
}

.severity-badge.high {
  background: var(--ion-color-danger-tint, #ffcccc);
  color: var(--ion-color-danger, #eb445a);
}

.severity-badge.medium {
  background: var(--ion-color-warning-tint, #fff3cd);
  color: var(--ion-color-warning-shade, #856404);
}

.severity-badge.low {
  background: var(--ion-color-success-tint, #c8f7c5);
  color: var(--ion-color-success-shade, #1e9e50);
}

.status-badge {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 600;
}

.status-badge.completed {
  background: var(--ion-color-success-tint, #c8f7c5);
  color: var(--ion-color-success-shade, #1e9e50);
}

.status-badge.pending,
.status-badge.in_progress {
  background: var(--ion-color-warning-tint, #fff3cd);
  color: var(--ion-color-warning-shade, #856404);
}

@media (max-width: 768px) {
  .debate-columns {
    grid-template-columns: 1fr;
  }
}
</style>
