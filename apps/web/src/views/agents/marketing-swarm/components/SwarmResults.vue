<template>
  <div class="swarm-results">
    <!-- Summary Card -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Results Summary</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <div class="summary-stats">
          <div class="stat">
            <div class="stat-value">{{ outputs.length }}</div>
            <div class="stat-label">Outputs Generated</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ evaluations.length }}</div>
            <div class="stat-label">Evaluations</div>
          </div>
          <div class="stat" v-if="bestOutput">
            <div class="stat-value">{{ bestScore }}/10</div>
            <div class="stat-label">Best Score</div>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Ranked Results -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Ranked Outputs</ion-card-title>
        <ion-card-subtitle>Sorted by average evaluation score</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-list>
          <ion-item
            v-for="(result, index) in rankedResults"
            :key="result.outputId"
            :button="true"
            :detail="true"
            @click="selectOutput(result.outputId)"
            :class="{ 'selected': selectedOutputId === result.outputId }"
          >
            <ion-badge slot="start" :color="getRankColor(index)">
              #{{ index + 1 }}
            </ion-badge>
            <ion-label>
              <h2>{{ getOutputTitle(result.outputId) }}</h2>
              <p>{{ getOutputAgentInfo(result.outputId) }}</p>
            </ion-label>
            <ion-badge slot="end" color="primary">
              {{ result.averageScore.toFixed(1) }}/10
            </ion-badge>
          </ion-item>
        </ion-list>
      </ion-card-content>
    </ion-card>

    <!-- Selected Output Detail -->
    <ion-card v-if="selectedOutput">
      <ion-card-header>
        <ion-card-title>
          Output Detail
          <ion-button fill="clear" size="small" @click="selectedOutputId = undefined">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-card-title>
        <ion-card-subtitle>
          {{ getOutputAgentInfo(selectedOutput.id) }}
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <!-- Content -->
        <div class="output-content">
          <h4>Content</h4>
          <!-- eslint-disable-next-line vue/no-v-html -- AI-generated content with basic formatting -->
          <div class="content-preview" v-html="formatContent(selectedOutput.content)"></div>
        </div>

        <!-- Edit History -->
        <div v-if="selectedOutput.editCycle > 0" class="edit-history">
          <h4>Edit Cycles: {{ selectedOutput.editCycle }}</h4>
          <p v-if="selectedOutput.editorFeedback">
            <strong>Editor Feedback:</strong> {{ selectedOutput.editorFeedback }}
          </p>
          <ion-badge :color="selectedOutput.editorApproved ? 'success' : 'warning'">
            {{ selectedOutput.editorApproved ? 'Approved' : 'Revised' }}
          </ion-badge>
        </div>

        <!-- Evaluations -->
        <div class="output-evaluations">
          <h4>Evaluations</h4>
          <div v-for="evaluation in selectedOutputEvaluations" :key="evaluation.id" class="evaluation-item">
            <div class="evaluation-header">
              <span class="evaluator-name">{{ getAgentName(evaluation.evaluatorAgentSlug) }}</span>
              <ion-badge :color="getScoreColor(evaluation.score)">
                {{ evaluation.score }}/10
              </ion-badge>
            </div>
            <p class="evaluation-reasoning">{{ evaluation.reasoning }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="output-actions">
          <ion-button expand="block" @click="copyContent(selectedOutput.content)">
            <ion-icon :icon="copyOutline" slot="start" />
            Copy Content
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Back to Config -->
    <div class="actions-footer">
      <ion-button fill="outline" @click="$emit('restart')">
        <ion-icon :icon="refreshOutline" slot="start" />
        Start New Swarm
      </ion-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonIcon,
} from '@ionic/vue';
import {
  closeOutline,
  copyOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import type { SwarmOutput } from '@/types/marketing-swarm';

defineEmits<{
  (e: 'restart'): void;
}>();

const store = useMarketingSwarmStore();

const outputs = computed(() => store.outputs);
const evaluations = computed(() => store.evaluations);
const rankedResults = computed(() => store.rankedResults);
const bestOutput = computed(() => store.bestOutput);

const bestScore = computed(() => {
  if (rankedResults.value.length === 0) return 0;
  return rankedResults.value[0].averageScore.toFixed(1);
});

const selectedOutputId = ref<string | undefined>(
  bestOutput.value?.id
);

const selectedOutput = computed<SwarmOutput | undefined>(() => {
  if (!selectedOutputId.value) return undefined;
  return store.getOutputById(selectedOutputId.value);
});

const selectedOutputEvaluations = computed(() => {
  if (!selectedOutputId.value) return [];
  return store.getEvaluationsForOutput(selectedOutputId.value);
});

function selectOutput(outputId: string) {
  selectedOutputId.value = outputId;
}

function getOutputTitle(outputId: string): string {
  const output = store.getOutputById(outputId);
  if (!output) return 'Unknown Output';
  // Extract first line or first 50 chars as title
  const firstLine = output.content.split('\n')[0];
  return firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '');
}

function getOutputAgentInfo(outputId: string): string {
  const output = store.getOutputById(outputId);
  if (!output) return '';
  const writer = store.getAgentBySlug(output.writerAgentSlug);
  const writerConfigs = store.getLLMConfigsForAgent(output.writerAgentSlug);
  const writerConfig = writerConfigs.find((c) => c.id === output.writerLlmConfigId);

  let info = `${writer?.name || output.writerAgentSlug} (${writerConfig?.displayName || writerConfig?.llmModel})`;

  if (output.editorAgentSlug) {
    const editor = store.getAgentBySlug(output.editorAgentSlug);
    info += ` + ${editor?.name || output.editorAgentSlug}`;
  }

  return info;
}

function getAgentName(agentSlug: string): string {
  const agent = store.getAgentBySlug(agentSlug);
  return agent?.name || agentSlug;
}

function getRankColor(index: number): string {
  if (index === 0) return 'success';
  if (index === 1) return 'warning';
  if (index === 2) return 'tertiary';
  return 'medium';
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'success';
  if (score >= 6) return 'warning';
  if (score >= 4) return 'tertiary';
  return 'danger';
}

function formatContent(content: string): string {
  // Basic markdown-like formatting
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

async function copyContent(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    // Could add a toast notification here
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}
</script>

<style scoped>
.swarm-results {
  padding: 16px;
}

.summary-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat {
  padding: 12px;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

ion-item.selected {
  --background: var(--ion-color-primary-tint);
}

.output-content {
  margin-bottom: 24px;
}

.output-content h4,
.edit-history h4,
.output-evaluations h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--ion-color-primary);
}

.content-preview {
  background: var(--ion-color-light);
  padding: 16px;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
}

.edit-history {
  margin-bottom: 24px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.output-evaluations {
  margin-bottom: 24px;
}

.evaluation-item {
  background: var(--ion-color-light);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.evaluation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.evaluator-name {
  font-weight: 600;
}

.evaluation-reasoning {
  font-size: 0.875rem;
  color: var(--ion-color-medium-shade);
  margin: 0;
}

.output-actions {
  margin-top: 16px;
}

.actions-footer {
  margin-top: 24px;
  text-align: center;
}

ion-card {
  margin-bottom: 16px;
}
</style>
