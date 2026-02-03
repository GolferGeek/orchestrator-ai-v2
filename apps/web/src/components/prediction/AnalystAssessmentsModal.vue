<template>
  <ion-modal :is-open="isOpen" @willDismiss="onDismiss" class="analyst-assessments-modal">
    <ion-header>
      <ion-toolbar>
        <ion-title>Analyst Assessments</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading analyst assessments...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <ion-icon :icon="alertCircleOutline" class="error-icon"></ion-icon>
        <p>{{ error }}</p>
        <ion-button @click="loadAssessments">Try Again</ion-button>
      </div>

      <!-- No Analysts State -->
      <div v-else-if="!analysts || analysts.length === 0" class="empty-state">
        <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
        <p>No analyst assessments available for this prediction.</p>
      </div>

      <!-- Analyst Assessments List -->
      <div v-else class="assessments-content">
        <ion-accordion-group :multiple="true">
          <ion-accordion
            v-for="(analyst, index) in analysts"
            :key="analyst.analystSlug"
          >
            <ion-item slot="header">
              <ion-label>
                <div class="analyst-header">
                  <h3>{{ analyst.analystName || analyst.analystSlug }}</h3>
                  <ion-chip v-if="analyst.tier" :color="getTierColor(analyst.tier)" outline size="small">
                    <ion-label>{{ analyst.tier }}</ion-label>
                  </ion-chip>
                </div>
              </ion-label>
            </ion-item>

            <div slot="content" class="analyst-content">
              <!-- Three-Way Fork Assessments: Arbitrator → User → AI -->
              <div class="fork-container">
            <!-- Arbitrator Fork (shown first as final decision) -->
            <div v-if="analyst.arbitratorFork" class="fork-card arbitrator-fork">
              <div class="fork-header">
                <ion-icon :icon="scaleOutline" class="fork-icon"></ion-icon>
                <span class="fork-title">Arbitrator (Final)</span>
              </div>
              <div class="fork-body">
                <div class="fork-direction" :class="getDirectionClass(analyst.arbitratorFork.direction)">
                  <span class="direction-icon">{{ getDirectionIcon(analyst.arbitratorFork.direction) }}</span>
                  <span class="direction-text">{{ formatDirection(analyst.arbitratorFork.direction) }}</span>
                  <span class="confidence-badge">{{ Math.round(analyst.arbitratorFork.confidence * 100) }}%</span>
                </div>
                <p v-if="analyst.arbitratorFork.reasoning" class="fork-reasoning">
                  {{ analyst.arbitratorFork.reasoning }}
                </p>
              </div>
            </div>

            <!-- User Fork -->
            <div v-if="analyst.userFork" class="fork-card user-fork">
              <div class="fork-header">
                <ion-icon :icon="personOutline" class="fork-icon"></ion-icon>
                <span class="fork-title">User Fork</span>
              </div>
              <div class="fork-body">
                <div class="fork-direction" :class="getDirectionClass(analyst.userFork.direction)">
                  <span class="direction-icon">{{ getDirectionIcon(analyst.userFork.direction) }}</span>
                  <span class="direction-text">{{ formatDirection(analyst.userFork.direction) }}</span>
                  <span class="confidence-badge">{{ Math.round(analyst.userFork.confidence * 100) }}%</span>
                </div>
                <p v-if="analyst.userFork.reasoning" class="fork-reasoning">
                  {{ analyst.userFork.reasoning }}
                </p>
              </div>
            </div>

            <!-- AI Fork -->
            <div v-if="analyst.aiFork" class="fork-card ai-fork">
              <div class="fork-header">
                <ion-icon :icon="hardwareChipOutline" class="fork-icon"></ion-icon>
                <span class="fork-title">AI Fork</span>
              </div>
              <div class="fork-body">
                <div class="fork-direction" :class="getDirectionClass(analyst.aiFork.direction)">
                  <span class="direction-icon">{{ getDirectionIcon(analyst.aiFork.direction) }}</span>
                  <span class="direction-text">{{ formatDirection(analyst.aiFork.direction) }}</span>
                  <span class="confidence-badge">{{ Math.round(analyst.aiFork.confidence * 100) }}%</span>
                </div>
                <p v-if="analyst.aiFork.reasoning" class="fork-reasoning">
                  {{ analyst.aiFork.reasoning }}
                </p>
              </div>
            </div>

            <!-- Legacy Single Assessment (if no three-way fork) -->
            <div v-if="!analyst.userFork && !analyst.aiFork && !analyst.arbitratorFork" class="fork-card legacy-assessment">
              <div class="fork-header">
                <ion-icon :icon="chatbubbleOutline" class="fork-icon"></ion-icon>
                <span class="fork-title">Assessment</span>
              </div>
              <div class="fork-body">
                <div class="fork-direction" :class="getDirectionClass(analyst.direction)">
                  <span class="direction-icon">{{ getDirectionIcon(analyst.direction) }}</span>
                  <span class="direction-text">{{ formatDirection(analyst.direction) }}</span>
                  <span class="confidence-badge">{{ Math.round(analyst.confidence * 100) }}%</span>
                </div>
                <p v-if="analyst.reasoning" class="fork-reasoning">
                  {{ analyst.reasoning }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ion-accordion>
    </ion-accordion-group>
  </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonChip,
  IonLabel,
  IonSpinner,
  IonAccordionGroup,
  IonAccordion,
  IonItem,
} from '@ionic/vue';
import {
  closeOutline,
  alertCircleOutline,
  peopleOutline,
  personOutline,
  hardwareChipOutline,
  scaleOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import { ref, watch } from 'vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';

interface ForkAssessment {
  direction: string;
  confidence: number;
  reasoning?: string;
}

interface AnalystAssessment {
  analystSlug: string;
  analystName?: string;
  tier?: string;
  direction: string;
  confidence: number;
  reasoning?: string;
  userFork?: ForkAssessment;
  aiFork?: ForkAssessment;
  arbitratorFork?: ForkAssessment;
}

interface Props {
  isOpen: boolean;
  predictionId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  dismiss: [];
}>();

const isLoading = ref(false);
const error = ref<string | null>(null);
const analysts = ref<AnalystAssessment[]>([]);

// Load assessments when modal opens and predictionId is provided
watch(
  () => [props.isOpen, props.predictionId],
  ([open, id]) => {
    if (open && id) {
      loadAssessments();
    } else {
      // Reset when modal closes
      analysts.value = [];
      error.value = null;
    }
  },
  { immediate: true }
);

async function loadAssessments() {
  if (!props.predictionId) return;

  isLoading.value = true;
  error.value = null;
  analysts.value = [];

  try {
    const response = await predictionDashboardService.getPredictionDeepDive({
      id: props.predictionId,
    });

    console.log('[AnalystAssessmentsModal] Deep dive response:', response);

    // Extract analyst assessments from the response
    const data = response?.content || response;

    if (data?.lineage?.analystAssessments) {
      // Group assessments by analyst slug (in case they come as separate entries per fork)
      const rawAssessments = data.lineage.analystAssessments as AnalystAssessment[];
      analysts.value = groupAnalystAssessments(rawAssessments);
      console.log('[AnalystAssessmentsModal] Grouped analysts:', analysts.value);
    } else {
      console.warn('[AnalystAssessmentsModal] No analyst assessments found in response');
    }
  } catch (err: any) {
    console.error('[AnalystAssessmentsModal] Error loading assessments:', err);
    error.value = err?.message || 'Failed to load analyst assessments';
  } finally {
    isLoading.value = false;
  }
}

/**
 * Group analyst assessments by analyst slug
 * Handles case where each fork comes as a separate entry
 */
function groupAnalystAssessments(assessments: AnalystAssessment[]): AnalystAssessment[] {
  const groupedMap = new Map<string, AnalystAssessment>();

  for (const assessment of assessments) {
    const slug = assessment.analystSlug;
    const existing = groupedMap.get(slug);

    if (!existing) {
      // First entry for this analyst - use it as base
      groupedMap.set(slug, { ...assessment });
    } else {
      // Merge forks into existing entry
      if (assessment.userFork && !existing.userFork) {
        existing.userFork = assessment.userFork;
      }
      if (assessment.aiFork && !existing.aiFork) {
        existing.aiFork = assessment.aiFork;
      }
      if (assessment.arbitratorFork && !existing.arbitratorFork) {
        existing.arbitratorFork = assessment.arbitratorFork;
      }
      // Also merge base direction/confidence if not set
      if (!existing.direction && assessment.direction) {
        existing.direction = assessment.direction;
        existing.confidence = assessment.confidence;
        existing.reasoning = assessment.reasoning;
      }
    }
  }

  return Array.from(groupedMap.values());
}

function onDismiss() {
  emit('dismiss');
}

function getDirectionClass(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return 'direction-up';
  if (dir === 'bearish' || dir === 'down') return 'direction-down';
  return 'direction-neutral';
}

function getDirectionIcon(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return '↑';
  if (dir === 'bearish' || dir === 'down') return '↓';
  return '↔';
}

function formatDirection(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return 'BULLISH';
  if (dir === 'bearish' || dir === 'down') return 'BEARISH';
  return 'NEUTRAL';
}

function getTierColor(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'gold':
      return 'warning';
    case 'silver':
      return 'medium';
    case 'bronze':
      return 'tertiary';
    default:
      return 'primary';
  }
}
</script>

<style scoped>
.analyst-assessments-modal {
  --height: 90%;
  --border-radius: 16px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
}

.error-icon,
.empty-icon {
  font-size: 3rem;
  color: var(--ion-color-medium);
}

.error-icon {
  color: var(--ion-color-danger);
}

.assessments-content {
  display: flex;
  flex-direction: column;
}

.analyst-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
}

.analyst-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.analyst-content {
  padding: 1rem;
  background: var(--ion-color-light);
}

.fork-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .fork-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
}

.fork-card {
  background: var(--ion-background-color, #ffffff);
  border-radius: 8px;
  padding: 1rem;
  border: 2px solid var(--ion-color-light-shade);
  transition: all 0.2s ease;
}

.fork-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.fork-card.user-fork {
  border-color: #3b82f6;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.02));
}

.fork-card.ai-fork {
  border-color: #10b981;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.02));
}

.fork-card.arbitrator-fork {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(139, 92, 246, 0.02));
}

.fork-card.legacy-assessment {
  border-color: var(--ion-color-medium);
  background: linear-gradient(135deg, rgba(156, 163, 175, 0.05), rgba(156, 163, 175, 0.02));
}

.fork-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.fork-icon {
  font-size: 1.25rem;
}

.fork-card.user-fork .fork-icon {
  color: #3b82f6;
}

.fork-card.ai-fork .fork-icon {
  color: #10b981;
}

.fork-card.arbitrator-fork .fork-icon {
  color: #8b5cf6;
}

.fork-card.legacy-assessment .fork-icon {
  color: var(--ion-color-medium);
}

.fork-title {
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fork-card.user-fork .fork-title {
  color: #3b82f6;
}

.fork-card.ai-fork .fork-title {
  color: #10b981;
}

.fork-card.arbitrator-fork .fork-title {
  color: #8b5cf6;
}

.fork-card.legacy-assessment .fork-title {
  color: var(--ion-color-medium);
}

.fork-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fork-direction {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--ion-color-light);
}

.direction-icon {
  font-size: 1.25rem;
  font-weight: bold;
}

.direction-text {
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}

.confidence-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--ion-color-dark);
  color: var(--ion-background-color);
  font-size: 0.8rem;
  font-weight: 600;
}

.fork-direction.direction-up {
  background: rgba(34, 197, 94, 0.1);
  border-left: 4px solid #22c55e;
}

.fork-direction.direction-up .direction-icon,
.fork-direction.direction-up .direction-text {
  color: #22c55e;
}

.fork-direction.direction-down {
  background: rgba(239, 68, 68, 0.1);
  border-left: 4px solid #ef4444;
}

.fork-direction.direction-down .direction-icon,
.fork-direction.direction-down .direction-text {
  color: #ef4444;
}

.fork-direction.direction-neutral {
  background: rgba(156, 163, 175, 0.1);
  border-left: 4px solid #9ca3af;
}

.fork-direction.direction-neutral .direction-icon,
.fork-direction.direction-neutral .direction-text {
  color: #9ca3af;
}

.fork-reasoning {
  margin: 0;
  line-height: 1.6;
  font-size: 0.85rem;
  color: var(--ion-color-medium-shade);
  padding: 0.5rem;
  background: var(--ion-color-light);
  border-radius: 4px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .analyst-card {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .fork-card {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .fork-direction {
    background: rgba(255, 255, 255, 0.05);
  }

  .fork-reasoning {
    background: rgba(255, 255, 255, 0.05);
  }
}
</style>
