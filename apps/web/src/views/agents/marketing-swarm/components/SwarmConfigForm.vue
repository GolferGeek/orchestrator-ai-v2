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

    <!-- LLM Selection -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>LLM Selection</ion-card-title>
        <ion-card-subtitle>Choose the AI model for content generation</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <ion-item>
          <ion-label position="stacked">Provider</ion-label>
          <ion-select
            v-model="selectedProvider"
            placeholder="Select provider"
            interface="popover"
            :disabled="llmProvidersLoading"
          >
            <ion-select-option
              v-for="provider in llmProviders"
              :key="provider.name"
              :value="provider.name"
            >
              {{ provider.displayName }}{{ provider.isLocal ? ' (Local)' : '' }}
            </ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Model</ion-label>
          <ion-select
            v-model="selectedModel"
            placeholder="Select model"
            interface="popover"
            :disabled="!selectedProvider || llmModelsLoading"
          >
            <ion-select-option
              v-for="model in filteredModels"
              :key="model.model"
              :value="model.model"
            >
              {{ model.displayName }} (in: ${{ model.inputPer1k.toFixed(4) }}/1K, out: ${{ model.outputPer1k.toFixed(4) }}/1K)
            </ion-select-option>
          </ion-select>
        </ion-item>

        <p v-if="selectedModelInfo" class="model-info">
          <strong>Tier:</strong> {{ selectedModelInfo.modelTier }} |
          <strong>Speed:</strong> {{ selectedModelInfo.speedTier }}
          <span v-if="selectedModelInfo.isLocal"> | <ion-badge color="success">Local</ion-badge></span>
        </p>
      </ion-card-content>
    </ion-card>

    <!-- Agent Selection -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Agent Selection</ion-card-title>
        <ion-card-subtitle>Select which agents to use (LLM is set above)</ion-card-subtitle>
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
          </div>
        </div>

        <!-- Execution Configuration -->
        <div class="execution-config-section">
          <h3>Execution Settings</h3>

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

          <!-- Top N for Final Ranking -->
          <ion-item>
            <ion-label>Top N for Final Ranking</ion-label>
            <ion-range
              v-model="topNForFinalRanking"
              :min="1"
              :max="10"
              :step="1"
              :pin="true"
              :snaps="true"
              :ticks="true"
            >
              <ion-label slot="start">1</ion-label>
              <ion-label slot="end">10</ion-label>
            </ion-range>
          </ion-item>

          <!-- Top N for Deliverable -->
          <ion-item>
            <ion-label>Top N in Deliverable</ion-label>
            <ion-range
              v-model="topNForDeliverable"
              :min="1"
              :max="10"
              :step="1"
              :pin="true"
              :snaps="true"
              :ticks="true"
            >
              <ion-label slot="start">1</ion-label>
              <ion-label slot="end">10</ion-label>
            </ion-range>
          </ion-item>

          <!-- Max Local Concurrent -->
          <ion-item>
            <ion-label>Max Local Concurrent</ion-label>
            <ion-range
              v-model="maxLocalConcurrent"
              :min="1"
              :max="3"
              :step="1"
              :pin="true"
              :snaps="true"
              :ticks="true"
            >
              <ion-label slot="start">1</ion-label>
              <ion-label slot="end">3</ion-label>
            </ion-range>
          </ion-item>

          <!-- Max Cloud Concurrent -->
          <ion-item>
            <ion-label>Max Cloud Concurrent</ion-label>
            <ion-range
              v-model="maxCloudConcurrent"
              :min="1"
              :max="10"
              :step="1"
              :pin="true"
              :snaps="true"
              :ticks="true"
            >
              <ion-label slot="start">1</ion-label>
              <ion-label slot="end">10</ion-label>
            </ion-range>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Summary and Execute -->
    <ion-card>
      <ion-card-header>
        <ion-card-title>Execution Summary</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p><strong>LLM:</strong> {{ selectedProvider }}/{{ selectedModel }}</p>
        <p><strong>Writers:</strong> {{ selectedWriterCount }} agent(s)</p>
        <p><strong>Editors:</strong> {{ selectedEditorCount }} agent(s)</p>
        <p><strong>Evaluators:</strong> {{ selectedEvaluatorCount }} agent(s)</p>
        <p><strong>Max Edit Cycles:</strong> {{ maxEditCycles }}</p>
        <p><strong>Top N for Final Ranking:</strong> {{ topNForFinalRanking }}</p>
        <p><strong>Top N in Deliverable:</strong> {{ topNForDeliverable }}</p>
        <p><strong>Concurrency:</strong> {{ maxLocalConcurrent }} local / {{ maxCloudConcurrent }} cloud</p>
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
import { ref, computed, watch, onMounted } from 'vue';
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
  IonRange,
  IonButton,
  IonBadge,
} from '@ionic/vue';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import { llmService, type LLMProvider, type LLMModel } from '@/services/llmService';
import type {
  PromptData,
  SwarmConfig,
  AgentConfig,
  MarketingAgent,
} from '@/types/marketing-swarm';

const emit = defineEmits<{
  (e: 'execute', data: { contentTypeSlug: string; contentTypeContext: string; promptData: PromptData; config: SwarmConfig }): void;
}>();

const store = useMarketingSwarmStore();

// Content type selection - default to blog-post for faster testing
const selectedContentType = ref<string>('blog-post');

const contentTypes = computed(() => store.contentTypes);

const selectedContentTypeDescription = computed(() => {
  const type = contentTypes.value.find((t) => t.slug === selectedContentType.value);
  return type?.description || '';
});

const selectedContentTypeContext = computed(() => {
  const type = contentTypes.value.find((t) => t.slug === selectedContentType.value);
  return type?.systemPromptTemplate || '';
});

// Prompt data - pre-filled with test defaults for faster testing
const promptData = ref<PromptData>({
  topic: 'AI-Powered Marketing Automation: How Small Businesses Can Compete with Enterprise',
  audience: 'Small business owners and marketing managers looking to leverage AI tools',
  goal: 'Educate readers on practical AI marketing tools and inspire them to start automating',
  keyPoints: [
    'AI marketing tools are now affordable for small businesses',
    'Start with email automation and social media scheduling',
    'Use AI for content generation and personalization',
    'Measure ROI and iterate on your strategy',
  ],
  tone: 'professional',
  constraints: '',
  examples: '',
  additionalContext: '',
});

const keyPointsText = ref(
  'AI marketing tools are now affordable for small businesses\nStart with email automation and social media scheduling\nUse AI for content generation and personalization\nMeasure ROI and iterate on your strategy'
);

watch(keyPointsText, (text) => {
  promptData.value.keyPoints = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
});

// LLM selection state
const llmProviders = ref<LLMProvider[]>([]);
const llmModels = ref<LLMModel[]>([]);
const llmProvidersLoading = ref(false);
const llmModelsLoading = ref(false);
const selectedProvider = ref<string>('anthropic');
const selectedModel = ref<string>('claude-sonnet-4-20250514');

// Filter models by selected provider
const filteredModels = computed(() => {
  if (!selectedProvider.value) return [];
  return llmModels.value.filter((m) => m.provider === selectedProvider.value);
});

// Get info about the selected model
const selectedModelInfo = computed(() => {
  if (!selectedModel.value) return null;
  return llmModels.value.find((m) => m.model === selectedModel.value);
});

// Load providers on mount
async function loadProviders() {
  llmProvidersLoading.value = true;
  try {
    llmProviders.value = await llmService.getProviders();
  } catch (error) {
    console.error('Failed to load LLM providers:', error);
  } finally {
    llmProvidersLoading.value = false;
  }
}

// Load all models on mount
async function loadModels() {
  llmModelsLoading.value = true;
  try {
    llmModels.value = await llmService.getModels();
  } catch (error) {
    console.error('Failed to load LLM models:', error);
  } finally {
    llmModelsLoading.value = false;
  }
}

// When provider changes, reset model selection if not valid
watch(selectedProvider, (newProvider) => {
  const validModels = llmModels.value.filter((m) => m.provider === newProvider);
  const currentModelValid = validModels.some((m) => m.model === selectedModel.value);
  if (!currentModelValid && validModels.length > 0) {
    // Select first model of new provider
    selectedModel.value = validModels[0].model;
  }
});

// Agent selection
const writerAgents = computed(() => store.writerAgents);
const editorAgents = computed(() => store.editorAgents);
const evaluatorAgents = computed(() => store.evaluatorAgents);

const selectedWriters = ref<AgentConfig[]>([]);
const selectedEditors = ref<AgentConfig[]>([]);
const selectedEvaluators = ref<AgentConfig[]>([]);

// Execution config
const maxEditCycles = ref(3);
const topNForFinalRanking = ref(3);
const topNForDeliverable = ref(3);
const maxLocalConcurrent = ref(1);
const maxCloudConcurrent = ref(5);

function isAgentSelected(role: 'writer' | 'editor' | 'evaluator', agentSlug: string): boolean {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;
  return list.value.some((c) => c.agentSlug === agentSlug);
}

function toggleAgent(role: 'writer' | 'editor' | 'evaluator', agent: MarketingAgent) {
  const list = role === 'writer' ? selectedWriters : role === 'editor' ? selectedEditors : selectedEvaluators;

  if (isAgentSelected(role, agent.slug)) {
    // Remove this agent
    list.value = list.value.filter((c) => c.agentSlug !== agent.slug);
  } else {
    // Add agent with selected LLM from dropdowns
    list.value.push({
      agentSlug: agent.slug,
      llmConfigId: `${selectedProvider.value}:${selectedModel.value}`,
      llmProvider: selectedProvider.value,
      llmModel: selectedModel.value,
      displayName: selectedModelInfo.value?.displayName || selectedModel.value,
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
    selectedProvider.value &&
    selectedModel.value &&
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
  if (!selectedProvider.value) return 'Please select an LLM provider';
  if (!selectedModel.value) return 'Please select an LLM model';
  if (selectedWriters.value.length === 0) return 'Please select at least one writer';
  return '';
});

// Load LLM data and auto-select first writer on mount
onMounted(async () => {
  // Load LLM providers and models
  await Promise.all([loadProviders(), loadModels()]);

  // Wait for store to load agents, then select defaults
  let unwatchFn: (() => void) | null = null;

  const selectFirstWriter = (agents: MarketingAgent[]) => {
    if (agents.length > 0 && selectedWriters.value.length === 0) {
      // Select first writer with current LLM selection
      const firstWriter = agents[0];
      selectedWriters.value.push({
        agentSlug: firstWriter.slug,
        llmConfigId: `${selectedProvider.value}:${selectedModel.value}`,
        llmProvider: selectedProvider.value,
        llmModel: selectedModel.value,
        displayName: selectedModelInfo.value?.displayName || selectedModel.value,
      });
      // Stop watching after selection
      if (unwatchFn) {
        unwatchFn();
      }
    }
  };

  unwatchFn = watch(() => writerAgents.value, selectFirstWriter, { immediate: true });
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
        maxLocalConcurrent: maxLocalConcurrent.value,
        maxCloudConcurrent: maxCloudConcurrent.value,
        maxEditCycles: maxEditCycles.value,
        topNForFinalRanking: topNForFinalRanking.value,
        topNForDeliverable: topNForDeliverable.value,
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

.agent-section h3,
.execution-config-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--ion-color-primary);
}

.execution-config-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light);
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

.model-info {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 8px;
  padding: 0 16px;
}

.model-info ion-badge {
  vertical-align: middle;
  margin-left: 4px;
}
</style>
