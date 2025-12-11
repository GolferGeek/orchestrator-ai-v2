<template>
  <div class="swarm-progress">
    <!-- Phase Indicator -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Execution Progress</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="phase-steps">
          <div
            v-for="phase in phases"
            :key="phase.id"
            class="phase-step"
            :class="{
              'active': currentPhase === phase.id,
              'completed': isPhaseCompleted(phase.id),
              'failed': currentPhase === 'failed' && phase.id === failedPhase,
            }"
          >
            <div class="phase-icon">
              <ion-icon
                :icon="isPhaseCompleted(phase.id) ? checkmarkCircle : phase.icon"
              />
            </div>
            <div class="phase-label">{{ phase.label }}</div>
          </div>
        </div>

        <ion-progress-bar
          :value="progress.percentage / 100"
          :color="currentPhase === 'failed' ? 'danger' : 'primary'"
        ></ion-progress-bar>

        <div class="progress-text">
          {{ progress.completed }} / {{ progress.total }} steps completed
          ({{ progress.percentage }}%)
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Agent Cards Grid -->
    <div class="agent-cards-grid">
      <!-- Writers -->
      <div class="agent-section" v-if="writerSteps.length > 0">
        <h3>Writers</h3>
        <div class="cards-row">
          <div
            v-for="step in writerSteps"
            :key="step.id"
            class="agent-card"
            :class="step.status"
          >
            <div class="card-header">
              <ion-icon :icon="createOutline" />
              <span>{{ getAgentName(step.agentSlug) }}</span>
            </div>
            <div class="card-llm">
              {{ getLLMDisplayName(step.agentSlug, step.llmConfigId) }}
            </div>
            <div class="card-status">
              <ion-spinner v-if="step.status === 'processing'" name="crescent" />
              <ion-icon v-else-if="step.status === 'completed'" :icon="checkmarkCircle" color="success" />
              <ion-icon v-else-if="step.status === 'failed'" :icon="closeCircle" color="danger" />
              <ion-icon v-else :icon="timeOutline" color="medium" />
              <span>{{ formatStatus(step.status) }}</span>
            </div>
            <div v-if="step.resultId && getOutputPreview(step.resultId)" class="card-preview">
              {{ getOutputPreview(step.resultId) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Editors -->
      <div class="agent-section" v-if="editorSteps.length > 0">
        <h3>Editors</h3>
        <div class="cards-row">
          <div
            v-for="step in editorSteps"
            :key="step.id"
            class="agent-card"
            :class="step.status"
          >
            <div class="card-header">
              <ion-icon :icon="pencilOutline" />
              <span>{{ getAgentName(step.agentSlug) }}</span>
            </div>
            <div class="card-llm">
              {{ getLLMDisplayName(step.agentSlug, step.llmConfigId) }}
            </div>
            <div class="card-status">
              <ion-spinner v-if="step.status === 'processing'" name="crescent" />
              <ion-icon v-else-if="step.status === 'completed'" :icon="checkmarkCircle" color="success" />
              <ion-icon v-else-if="step.status === 'failed'" :icon="closeCircle" color="danger" />
              <ion-icon v-else-if="step.status === 'skipped'" :icon="removeCircle" color="medium" />
              <ion-icon v-else :icon="timeOutline" color="medium" />
              <span>{{ formatStatus(step.status) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Evaluators -->
      <div class="agent-section" v-if="evaluatorSteps.length > 0">
        <h3>Evaluators</h3>
        <div class="cards-row">
          <div
            v-for="step in evaluatorSteps"
            :key="step.id"
            class="agent-card"
            :class="step.status"
          >
            <div class="card-header">
              <ion-icon :icon="starOutline" />
              <span>{{ getAgentName(step.agentSlug) }}</span>
            </div>
            <div class="card-llm">
              {{ getLLMDisplayName(step.agentSlug, step.llmConfigId) }}
            </div>
            <div class="card-status">
              <ion-spinner v-if="step.status === 'processing'" name="crescent" />
              <ion-icon v-else-if="step.status === 'completed'" :icon="checkmarkCircle" color="success" />
              <ion-icon v-else-if="step.status === 'failed'" :icon="closeCircle" color="danger" />
              <ion-icon v-else :icon="timeOutline" color="medium" />
              <span>{{ formatStatus(step.status) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <ion-card v-if="error" color="danger">
      <ion-card-header>
        <ion-card-title>Error</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        {{ error }}
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonProgressBar,
  IonSpinner,
  IonIcon,
} from '@ionic/vue';
import {
  checkmarkCircle,
  closeCircle,
  removeCircle,
  timeOutline,
  createOutline,
  pencilOutline,
  starOutline,
  documentTextOutline,
  ribbonOutline,
  trophyOutline,
} from 'ionicons/icons';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';

const store = useMarketingSwarmStore();

const phases = [
  { id: 'initializing', label: 'Setup', icon: documentTextOutline },
  { id: 'writing', label: 'Writing', icon: createOutline },
  { id: 'editing', label: 'Editing', icon: pencilOutline },
  { id: 'evaluating', label: 'Evaluating', icon: starOutline },
  { id: 'ranking', label: 'Ranking', icon: ribbonOutline },
  { id: 'completed', label: 'Done', icon: trophyOutline },
];

const currentPhase = computed(() => store.currentPhase);
const progress = computed(() => store.progress);
const error = computed(() => store.error);

const failedPhase = computed(() => {
  if (currentPhase.value !== 'failed') return null;
  // Determine which phase failed based on queue state
  const queue = store.executionQueue;
  const failedStep = queue.find((s) => s.status === 'failed');
  if (failedStep) return failedStep.stepType === 'write' ? 'writing' : failedStep.stepType === 'edit' ? 'editing' : 'evaluating';
  return 'initializing';
});

const phaseOrder = ['initializing', 'writing', 'editing', 'evaluating', 'ranking', 'completed'];

function isPhaseCompleted(phaseId: string): boolean {
  const currentIndex = phaseOrder.indexOf(currentPhase.value);
  const phaseIndex = phaseOrder.indexOf(phaseId);
  return phaseIndex < currentIndex;
}

// Filter steps by type
const writerSteps = computed(() =>
  store.executionQueue.filter((s) => s.stepType === 'write')
);

const editorSteps = computed(() =>
  store.executionQueue.filter((s) => s.stepType === 'edit')
);

const evaluatorSteps = computed(() =>
  store.executionQueue.filter((s) => s.stepType === 'evaluate')
);

// Helper functions
function getAgentName(agentSlug: string): string {
  const agent = store.getAgentBySlug(agentSlug);
  return agent?.name || agentSlug;
}

function getLLMDisplayName(agentSlug: string, llmConfigId: string): string {
  const configs = store.getLLMConfigsForAgent(agentSlug);
  const config = configs.find((c) => c.id === llmConfigId);
  return config?.displayName || config?.llmModel || 'Unknown';
}

function getOutputPreview(outputId: string): string {
  const output = store.getOutputById(outputId);
  if (!output) return '';
  return output.content.slice(0, 100) + (output.content.length > 100 ? '...' : '');
}

function formatStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'Waiting';
    case 'processing':
      return 'Processing...';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    default:
      return status;
  }
}
</script>

<style scoped>
.swarm-progress {
  padding: 16px;
}

.phase-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.phase-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.3s, transform 0.3s;
}

.phase-step.active {
  opacity: 1;
  transform: scale(1.1);
}

.phase-step.completed {
  opacity: 1;
}

.phase-step.completed .phase-icon {
  color: var(--ion-color-success);
}

.phase-step.failed .phase-icon {
  color: var(--ion-color-danger);
}

.phase-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.phase-label {
  font-size: 0.75rem;
  text-align: center;
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.agent-cards-grid {
  margin-top: 24px;
}

.agent-section {
  margin-bottom: 24px;
}

.agent-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--ion-color-primary);
}

.cards-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.agent-card {
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 12px;
  min-width: 180px;
  max-width: 220px;
  transition: all 0.3s;
}

.agent-card.processing {
  border: 2px solid var(--ion-color-primary);
  animation: pulse 1.5s infinite;
}

.agent-card.completed {
  border: 2px solid var(--ion-color-success);
}

.agent-card.failed {
  border: 2px solid var(--ion-color-danger);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--ion-color-primary-rgb), 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--ion-color-primary-rgb), 0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-llm {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}

.card-preview {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
