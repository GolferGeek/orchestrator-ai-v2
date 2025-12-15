<template>
  <div class="swarm-config-form">
    <ion-card>
      <ion-card-header>
        <ion-card-title>Content Configuration</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- Content Type Selection -->
        <ion-item>
          <ion-label position="stacked">Content Type</ion-label>
          <ion-select
            v-model="selectedContentType"
            placeholder="Select content type"
            interface="popover"
          >
            <ion-select-option
              v-for="type in contentTypes"
              :key="type.slug"
              :value="type.slug"
            >
              {{ type.name }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <p v-if="selectedContentTypeDescription" class="content-type-description">
          {{ selectedContentTypeDescription }}
        </p>
      </ion-card-content>
    </ion-card>

    <!-- Prompt Data Form -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Content Brief</ion-card-title>
        <ion-card-subtitle>Answer these questions to guide content creation</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label position="stacked">Topic *</ion-label>
          <ion-textarea
            v-model="promptData.topic"
            placeholder="What is the main topic or subject?"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Target Audience *</ion-label>
          <ion-textarea
            v-model="promptData.audience"
            placeholder="Who is the target audience?"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Goal *</ion-label>
          <ion-textarea
            v-model="promptData.goal"
            placeholder="What do you want the content to achieve?"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Key Points *</ion-label>
          <ion-textarea
            v-model="keyPointsText"
            placeholder="Enter key points (one per line)"
            :rows="4"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Tone *</ion-label>
          <ion-select v-model="promptData.tone" placeholder="Select tone" interface="popover">
            <ion-select-option value="professional">Professional</ion-select-option>
            <ion-select-option value="conversational">Conversational</ion-select-option>
            <ion-select-option value="casual">Casual</ion-select-option>
            <ion-select-option value="formal">Formal</ion-select-option>
            <ion-select-option value="persuasive">Persuasive</ion-select-option>
            <ion-select-option value="educational">Educational</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Constraints (optional)</ion-label>
          <ion-textarea
            v-model="promptData.constraints"
            placeholder="Any specific constraints or requirements?"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Examples (optional)</ion-label>
          <ion-textarea
            v-model="promptData.examples"
            placeholder="Any style examples or references?"
            :rows="2"
          ></ion-textarea>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Additional Context (optional)</ion-label>
          <ion-textarea
            v-model="promptData.additionalContext"
            placeholder="Any other relevant information?"
            :rows="2"
          ></ion-textarea>
        </ion-item>
      </ion-card-content>
    </ion-card>

    <!-- Agent Selection -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Agent Selection</ion-card-title>
        <ion-card-subtitle>Select agents and their LLM configurations</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <!-- Writers -->
        <div class="agent-section">
          <h3>Writers</h3>
          <div v-for="agent in writerAgents" :key="agent.slug" class="agent-item">
            <ion-checkbox
              :checked="isAgentSelected('writer', agent.slug)"
              @ionChange="toggleAgent('writer', agent)"
            >
              {{ agent.name }}
            </ion-checkbox>
            <div v-if="isAgentSelected('writer', agent.slug)" class="llm-configs">
              <ion-chip
                v-for="config in getLLMConfigsForAgent(agent.slug)"
                :key="config.id"
                :color="isLLMConfigSelected('writer', agent.slug, config.id) ? 'primary' : 'medium'"
                @click="toggleLLMConfig('writer', agent.slug, config)"
              >
                {{ config.displayName || `${config.llmProvider}/${config.llmModel}` }}
              </ion-chip>
            </div>
          </div>
        </div>

        <!-- Editors -->
        <div class="agent-section">
          <h3>Editors</h3>
          <div v-for="agent in editorAgents" :key="agent.slug" class="agent-item">
            <ion-checkbox
              :checked="isAgentSelected('editor', agent.slug)"
              @ionChange="toggleAgent('editor', agent)"
            >
              {{ agent.name }}
            </ion-checkbox>
            <div v-if="isAgentSelected('editor', agent.slug)" class="llm-configs">
              <ion-chip
                v-for="config in getLLMConfigsForAgent(agent.slug)"
                :key="config.id"
                :color="isLLMConfigSelected('editor', agent.slug, config.id) ? 'primary' : 'medium'"
                @click="toggleLLMConfig('editor', agent.slug, config)"
              >
                {{ config.displayName || `${config.llmProvider}/${config.llmModel}` }}
              </ion-chip>
            </div>
          </div>
        </div>

        <!-- Evaluators -->
        <div class="agent-section">
          <h3>Evaluators</h3>
          <div v-for="agent in evaluatorAgents" :key="agent.slug" class="agent-item">
            <ion-checkbox
              :checked="isAgentSelected('evaluator', agent.slug)"
              @ionChange="toggleAgent('evaluator', agent)"
            >
              {{ agent.name }}
            </ion-checkbox>
            <div v-if="isAgentSelected('evaluator', agent.slug)" class="llm-configs">
              <ion-chip
                v-for="config in getLLMConfigsForAgent(agent.slug)"
                :key="config.id"
                :color="isLLMConfigSelected('evaluator', agent.slug, config.id) ? 'primary' : 'medium'"
                @click="toggleLLMConfig('evaluator', agent.slug, config)"
              >
                {{ config.displayName || `${config.llmProvider}/${config.llmModel}` }}
              </ion-chip>
            </div>
          </div>
        </div>

        <!-- Max Edit Cycles -->
        <ion-item>
          <ion-label>Max Edit Cycles</ion-label>
          <ion-range
            v-model="maxEditCycles"
            :min="1"
            :max="5"
            :step="1"
            :pin="true"
            :snaps="true"
            :ticks="true"
          >
            <ion-label slot="start">1</ion-label>
            <ion-label slot="end">5</ion-label>
          </ion-range>
        </ion-item>
      </ion-card-content>
    </ion-card>

    <!-- Summary and Execute -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Execution Summary</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p><strong>Writers:</strong> {{ selectedWriterCount }} configurations</p>
        <p><strong>Editors:</strong> {{ selectedEditorCount }} configurations</p>
        <p><strong>Evaluators:</strong> {{ selectedEvaluatorCount }} configurations</p>
        <p><strong>Max Edit Cycles:</strong> {{ maxEditCycles }}</p>
        <p class="total-combinations">
          <strong>Total Combinations:</strong> {{ totalCombinations }}
        </p>

        <ion-button
          expand="block"
          :disabled="!canExecute"
          @click="handleExecute"
        >
          Start Marketing Swarm
        </ion-button>

        <p v-if="!canExecute" class="validation-error">
          {{ validationMessage }}
        </p>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonCheckbox,
  IonChip,
  IonRange,
  IonButton,
} from '@ionic/vue';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import type {
  PromptData,
  SwarmConfig,
  AgentConfig,
  MarketingAgent,
  AgentLLMConfig,
} from '@/types/marketing-swarm';

const emit = defineEmits<{
  (e: 'execute', data: { contentTypeSlug: string; contentTypeContext: string; promptData: PromptData; config: SwarmConfig }): void;
}>();

const store = useMarketingSwarmStore();

// Content type selection
const selectedContentType = ref<string>('');

const contentTypes = computed(() => store.contentTypes);

const selectedContentTypeDescription = computed(() => {
  const type = contentTypes.value.find((t) => t.slug === selectedContentType.value);
  return type?.description || '';
});

const selectedContentTypeContext = computed(() => {
  const type = contentTypes.value.find((t) => t.slug === selectedContentType.value);
  return type?.systemPromptTemplate || '';
});

// Prompt data
const promptData = ref<PromptData>({
  topic: '',
  audience: '',
  goal: '',
  keyPoints: [],
  tone: 'professional',
  constraints: '',
  examples: '',
  additionalContext: '',
});

const keyPointsText = ref('');

watch(keyPointsText, (text) => {
  promptData.value.keyPoints = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
});

// Agent selection
const writerAgents = computed(() => store.writerAgents);
const editorAgents = computed(() => store.editorAgents);
const evaluatorAgents = computed(() => store.evaluatorAgents);

const selectedWriters = ref<AgentConfig[]>([]);
const selectedEditors = ref<AgentConfig[]>([]);
const selectedEvaluators = ref<AgentConfig[]>([]);
const maxEditCycles = ref(3);

function getLLMConfigsForAgent(agentSlug: string): AgentLLMConfig[] {
  return store.getLLMConfigsForAgent(agentSlug);
}

function isAgentSelected(role: 'writer' | 'editor' | 'evaluator', agentSlug: string): boolean {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;
  return list.value.some((c) => c.agentSlug === agentSlug);
}

function isLLMConfigSelected(
  role: 'writer' | 'editor' | 'evaluator',
  agentSlug: string,
  configId: string
): boolean {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;
  return list.value.some((c) => c.agentSlug === agentSlug && c.llmConfigId === configId);
}

function toggleAgent(role: 'writer' | 'editor' | 'evaluator', agent: MarketingAgent) {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;

  if (isAgentSelected(role, agent.slug)) {
    // Remove all configs for this agent
    list.value = list.value.filter((c) => c.agentSlug !== agent.slug);
  } else {
    // Add default config for this agent
    const configs = getLLMConfigsForAgent(agent.slug);
    const defaultConfig = configs.find((c) => c.isDefault) || configs[0];
    if (defaultConfig) {
      list.value.push({
        agentSlug: agent.slug,
        llmConfigId: defaultConfig.id,
        llmProvider: defaultConfig.llmProvider,
        llmModel: defaultConfig.llmModel,
        displayName: defaultConfig.displayName,
      });
    }
  }
}

function toggleLLMConfig(
  role: 'writer' | 'editor' | 'evaluator',
  agentSlug: string,
  config: AgentLLMConfig
) {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;

  const existingIndex = list.value.findIndex(
    (c) => c.agentSlug === agentSlug && c.llmConfigId === config.id
  );

  if (existingIndex >= 0) {
    // Don't remove if it's the only config for this agent
    const agentConfigs = list.value.filter((c) => c.agentSlug === agentSlug);
    if (agentConfigs.length > 1) {
      list.value.splice(existingIndex, 1);
    }
  } else {
    list.value.push({
      agentSlug,
      llmConfigId: config.id,
      llmProvider: config.llmProvider,
      llmModel: config.llmModel,
      displayName: config.displayName,
    });
  }
}

// Summary calculations
const selectedWriterCount = computed(() => selectedWriters.value.length);
const selectedEditorCount = computed(() => selectedEditors.value.length);
const selectedEvaluatorCount = computed(() => selectedEvaluators.value.length);

const totalCombinations = computed(() => {
  const writers = selectedWriterCount.value || 1;
  const editors = selectedEditorCount.value || 1;
  return writers * editors;
});

// Validation
const canExecute = computed(() => {
  return (
    selectedContentType.value &&
    promptData.value.topic &&
    promptData.value.audience &&
    promptData.value.goal &&
    promptData.value.keyPoints.length > 0 &&
    promptData.value.tone &&
    selectedWriters.value.length > 0
  );
});

const validationMessage = computed(() => {
  if (!selectedContentType.value) return 'Please select a content type';
  if (!promptData.value.topic) return 'Please enter a topic';
  if (!promptData.value.audience) return 'Please enter target audience';
  if (!promptData.value.goal) return 'Please enter a goal';
  if (promptData.value.keyPoints.length === 0) return 'Please enter at least one key point';
  if (!promptData.value.tone) return 'Please select a tone';
  if (selectedWriters.value.length === 0) return 'Please select at least one writer';
  return '';
});

// Execute
function handleExecute() {
  if (!canExecute.value) return;

  emit('execute', {
    contentTypeSlug: selectedContentType.value,
    contentTypeContext: selectedContentTypeContext.value,
    promptData: { ...promptData.value },
    config: {
      writers: [...selectedWriters.value],
      editors: [...selectedEditors.value],
      evaluators: [...selectedEvaluators.value],
      maxEditCycles: maxEditCycles.value,
      execution: {
        maxLocalConcurrent: 1, // Default: 1 local LLM can run concurrently
        maxCloudConcurrent: 5, // Default: 5 cloud LLMs can run concurrently
        maxEditCycles: maxEditCycles.value, // Use the same value from form
        topNForFinalRanking: 1, // Default: rank top 1 for final evaluation
      },
    },
  });
}
</script>

<style scoped>
.swarm-config-form {
  padding: 16px;
  max-width: 800px;
  margin: 0 auto;
}

.content-type-description {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 8px;
  padding: 0 16px;
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

.agent-item {
  margin-bottom: 12px;
}

.llm-configs {
  margin-top: 8px;
  margin-left: 32px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.total-combinations {
  font-size: 1.125rem;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light);
}

.validation-error {
  color: var(--ion-color-danger);
  font-size: 0.875rem;
  margin-top: 12px;
  text-align: center;
}

ion-card {
  margin-bottom: 16px;
}
</style>
