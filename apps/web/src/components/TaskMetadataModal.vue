<template>
  <ion-modal :is-open="isOpen" @did-dismiss="handleClose">
    <ion-header>
      <ion-toolbar>
        <ion-title>Task Metadata</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleClose">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="metadata-container" v-if="taskData">
        <!-- Task Information Section -->
        <div class="metadata-section">
          <h3>Task Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="label">Task ID:</span>
              <span class="value">{{ taskData.id }}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Method:</span>
              <span class="value">{{ taskData.method }}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Status:</span>
              <span class="value" :class="getStatusClass(taskData.status)">{{ taskData.status }}</span>
            </div>
            <div class="metadata-item">
              <span class="label">Progress:</span>
              <span class="value">{{ taskData.progress }}%</span>
            </div>
            <div class="metadata-item" v-if="taskData.progressMessage">
              <span class="label">Progress Message:</span>
              <span class="value">{{ taskData.progressMessage }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.timeoutSeconds">
              <span class="label">Timeout:</span>
              <span class="value">{{ taskData.timeoutSeconds }}s</span>
            </div>
          </div>
        </div>
        <!-- Agent Information Section -->
        <div class="metadata-section" v-if="hasAgentInfo">
          <h3>Agent Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="taskMetadata?.agentName">
              <span class="label">Agent Name:</span>
              <span class="value">{{ taskMetadata.agentName }}</span>
            </div>
            <div class="metadata-item" v-if="taskMetadata?.agentType">
              <span class="label">Agent Type:</span>
              <span class="value">{{ taskMetadata.agentType }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.agentConversationId">
              <span class="label">Conversation ID:</span>
              <span class="value">{{ taskData.agentConversationId }}</span>
            </div>
            <div class="metadata-item" v-if="taskMetadata?.delegatedTo">
              <span class="label">Delegated To:</span>
              <span class="value">{{ taskMetadata.delegatedTo }}</span>
            </div>
            <div class="metadata-item" v-if="taskMetadata?.delegationReason">
              <span class="label">Delegation Reason:</span>
              <span class="value">{{ taskMetadata.delegationReason }}</span>
            </div>
            <div class="metadata-item" v-if="taskMetadata?.confidence">
              <span class="label">Confidence:</span>
              <span class="value">{{ ((taskMetadata.confidence as number) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
        <!-- LLM Information Section -->
        <div class="metadata-section" v-if="hasLLMInfo">
          <h3>LLM Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="getLLMProviderName()">
              <span class="label">Provider:</span>
              <span class="value">{{ getLLMProviderName() }}</span>
            </div>
            <div class="metadata-item" v-if="getLLMModelName()">
              <span class="label">Model:</span>
              <span class="value">{{ getLLMModelName() }}</span>
            </div>
            <div class="metadata-item" v-if="getLLMMetadata()?.temperature !== undefined">
              <span class="label">Temperature:</span>
              <span class="value">{{ getLLMMetadata()?.temperature }}</span>
            </div>
            <div class="metadata-item" v-if="getLLMMetadata()?.maxTokens">
              <span class="label">Max Tokens:</span>
              <span class="value">{{ getLLMMetadata()?.maxTokens }}</span>
            </div>
            <div class="metadata-item" v-if="getLLMMetadata()?.responseTimeMs">
              <span class="label">Response Time:</span>
              <span class="value">{{ getLLMMetadata()?.responseTimeMs }}ms</span>
            </div>
            <div class="metadata-item" v-if="getLLMMetadata()?.operationType">
              <span class="label">Operation Type:</span>
              <span class="value">{{ getLLMMetadata()?.operationType }}</span>
            </div>
          </div>
        </div>
        <!-- CIDAFM Information Section -->
        <div class="metadata-section" v-if="hasCIDAFMInfo">
          <h3>CIDAFM (Behavior Modification)</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="(cidafmOptions?.activeStateModifiers as string[] | undefined)?.length">
              <span class="label">State Modifiers:</span>
              <span class="value">{{ (cidafmOptions?.activeStateModifiers as string[] | undefined)?.join(', ') }}</span>
            </div>
            <div class="metadata-item" v-if="(cidafmOptions?.responseModifiers as string[] | undefined)?.length">
              <span class="label">Response Modifiers:</span>
              <span class="value">{{ (cidafmOptions?.responseModifiers as string[] | undefined)?.join(', ') }}</span>
            </div>
            <div class="metadata-item" v-if="(cidafmOptions?.executedCommands as string[] | undefined)?.length">
              <span class="label">Executed Commands:</span>
              <span class="value">{{ (cidafmOptions?.executedCommands as string[] | undefined)?.join(', ') }}</span>
            </div>
          </div>
        </div>
        <!-- Token Usage Section -->
        <div class="metadata-section" v-if="hasUsageInfo">
          <h3>Token Usage</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="usage?.inputTokens">
              <span class="label">Input Tokens:</span>
              <span class="value">{{ (usage.inputTokens as number).toLocaleString() }}</span>
            </div>
            <div class="metadata-item" v-if="usage?.outputTokens">
              <span class="label">Output Tokens:</span>
              <span class="value">{{ (usage.outputTokens as number).toLocaleString() }}</span>
            </div>
            <div class="metadata-item" v-if="usage?.inputTokens && usage?.outputTokens">
              <span class="label">Total Tokens:</span>
              <span class="value">{{ ((usage.inputTokens as number) + (usage.outputTokens as number)).toLocaleString() }}</span>
            </div>
          </div>
        </div>
        <!-- Cost Information Section -->
        <div class="metadata-section" v-if="hasCostInfo">
          <h3>Cost Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="costCalculation?.inputCost">
              <span class="label">Input Cost:</span>
              <span class="value">${{ formatCost(costCalculation.inputCost as number) }}</span>
            </div>
            <div class="metadata-item" v-if="costCalculation?.outputCost">
              <span class="label">Output Cost:</span>
              <span class="value">${{ formatCost(costCalculation.outputCost as number) }}</span>
            </div>
            <div class="metadata-item" v-if="costCalculation?.totalCost">
              <span class="label">Total Cost:</span>
              <span class="value total-cost">${{ formatCost(costCalculation.totalCost as number) }}</span>
            </div>
            <div class="metadata-item" v-if="costCalculation?.currency">
              <span class="label">Currency:</span>
              <span class="value">{{ costCalculation.currency as string }}</span>
            </div>
          </div>
        </div>
        <!-- Task Evaluation Section -->
        <div class="metadata-section" v-if="hasEvaluationInfo">
          <h3>Task Evaluation</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="evaluation?.userRating">
              <span class="label">User Rating:</span>
              <span class="value">{{ evaluation.userRating }}/5</span>
            </div>
            <div class="metadata-item" v-if="evaluation?.speedRating">
              <span class="label">Speed Rating:</span>
              <span class="value">{{ evaluation.speedRating }}/5</span>
            </div>
            <div class="metadata-item" v-if="evaluation?.accuracyRating">
              <span class="label">Accuracy Rating:</span>
              <span class="value">{{ evaluation.accuracyRating }}/5</span>
            </div>
            <div class="metadata-item" v-if="evaluation?.evaluationTimestamp">
              <span class="label">Evaluated At:</span>
              <span class="value">{{ formatTimestamp(evaluation.evaluationTimestamp as string) }}</span>
            </div>
            <div class="metadata-item" v-if="evaluation?.userNotes">
              <span class="label">User Notes:</span>
              <span class="value">{{ evaluation.userNotes }}</span>
            </div>
          </div>
        </div>
        <!-- Timing Information Section -->
        <div class="metadata-section" v-if="hasTimingInfo">
          <h3>Timing Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="taskData.createdAt">
              <span class="label">Created At:</span>
              <span class="value">{{ formatTimestamp(taskData.createdAt) }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.startedAt">
              <span class="label">Started At:</span>
              <span class="value">{{ formatTimestamp(taskData.startedAt) }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.completedAt">
              <span class="label">Completed At:</span>
              <span class="value">{{ formatTimestamp(taskData.completedAt) }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.updatedAt">
              <span class="label">Updated At:</span>
              <span class="value">{{ formatTimestamp(taskData.updatedAt) }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.startedAt && taskData.completedAt">
              <span class="label">Execution Time:</span>
              <span class="value">{{ calculateExecutionTime(taskData.startedAt, taskData.completedAt) }}</span>
            </div>
          </div>
        </div>
        <!-- Error Information Section -->
        <div class="metadata-section" v-if="hasErrorInfo">
          <h3>Error Information</h3>
          <div class="metadata-grid">
            <div class="metadata-item" v-if="taskData.errorCode">
              <span class="label">Error Code:</span>
              <span class="value error-text">{{ taskData.errorCode }}</span>
            </div>
            <div class="metadata-item" v-if="taskData.errorMessage">
              <span class="label">Error Message:</span>
              <span class="value error-text">{{ taskData.errorMessage }}</span>
            </div>
          </div>
        </div>
        <!-- Task Parameters Section -->
        <div class="metadata-section" v-if="taskData.params">
          <h3>Task Parameters</h3>
          <div class="raw-metadata">
            <pre>{{ JSON.stringify(taskData.params, null, 2) }}</pre>
          </div>
        </div>
        <!-- Raw Task Data Section (for debugging) -->
        <div class="metadata-section">
          <h3>Raw Task Data (Debug)</h3>
          <div class="raw-metadata">
            <pre>{{ JSON.stringify(taskData, null, 2) }}</pre>
          </div>
        </div>
      </div>
      <!-- Loading State -->
      <div v-else class="loading-container">
        <ion-spinner></ion-spinner>
        <p>Loading task metadata...</p>
      </div>
    </ion-content>
  </ion-modal>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSpinner,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { tasksService } from '../services/tasksService';
import { useLLMPreferencesStore } from '../stores/llmPreferencesStore';
import type { TaskDetail } from '../types/task';
interface Props {
  isOpen: boolean;
  taskId: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();
const taskData = ref<TaskDetail | null>(null);
const isLoading = ref(false);
const llmStore = useLLMPreferencesStore();

// Computed property to break deep type instantiation
const taskMetadata = computed(() => {
  return taskData.value?.metadata as Record<string, unknown> | undefined;
});

// Computed property for CIDAFM options to avoid deep type instantiation
const cidafmOptions = computed(() => {
  const llmMeta = getLLMMetadata();
  return (llmMeta as Record<string, unknown> | undefined)?.cidafmOptions as Record<string, unknown> | undefined;
});

// Computed property for response metadata to avoid deep type instantiation
const responseMetadata = computed(() => {
  return taskData.value?.responseMetadata as Record<string, unknown> | undefined;
});

// Computed properties for nested metadata to avoid deep type instantiation
const usage = computed(() => {
  const meta = responseMetadata.value;
  return meta?.usage as Record<string, unknown> | undefined;
});

const costCalculation = computed(() => {
  const meta = responseMetadata.value;
  return meta?.costCalculation as Record<string, unknown> | undefined;
});

// Computed property for evaluation to avoid deep type instantiation
const evaluation = computed(() => {
  return taskData.value?.evaluation as Record<string, unknown> | undefined;
});

// Computed property for llmMetadata to avoid deep type instantiation
const llmMetadata = computed(() => {
  return taskData.value?.llmMetadata as Record<string, unknown> | undefined;
});
const handleClose = () => {
  emit('close');
};
// Initialize LLM store when component mounts
onMounted(async () => {
  await llmStore.initialize();
});
const loadTaskData = async () => {
  if (!props.taskId) return;
  try {
    isLoading.value = true;
    // Ensure LLM store is initialized before loading task data
    if (llmStore.providers.length === 0) {
      await llmStore.initialize();
    }
    taskData.value = await tasksService.getTaskById(props.taskId);
  } catch {
    // Error loading task data
  } finally {
    isLoading.value = false;
  }
};
// Watch for modal opening - only load data when modal is actually opened
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.taskId) {
    loadTaskData();
  }
});
const hasAgentInfo = computed((): boolean => {
  const meta = taskMetadata.value;
  return !!(meta?.agentName ||
         meta?.agentType ||
         taskData.value?.agentConversationId ||
         meta?.delegatedTo ||
         meta?.delegationReason ||
         meta?.confidence);
});
const hasLLMInfo = computed((): boolean => {
  const metaAsRecord = taskMetadata.value as Record<string, unknown> | undefined;
  const llmMetadataField = metaAsRecord?.llmMetadata as Record<string, unknown> | undefined;
  const hasInfo = (llmMetadata.value as Record<string, unknown> | undefined)?.originalLLMSelection || llmMetadataField?.originalLLMSelection;
  return !!hasInfo;
});
const hasCIDAFMInfo = computed((): boolean => {
  const llmMeta = getLLMMetadata();
  return !!(llmMeta as Record<string, unknown> | undefined)?.cidafmOptions;
});
const hasUsageInfo = computed((): boolean => {
  const meta = responseMetadata.value as Record<string, unknown> | undefined;
  return !!meta?.usage;
});
const hasCostInfo = computed((): boolean => {
  const meta = responseMetadata.value as Record<string, unknown> | undefined;
  return !!meta?.costCalculation;
});
const hasEvaluationInfo = computed((): boolean => {
  const hasInfo = evaluation.value;
  return !!hasInfo;
});
const hasTimingInfo = computed((): boolean => {
  return !!(taskData.value?.createdAt || taskData.value?.startedAt || taskData.value?.completedAt || taskData.value?.updatedAt);
});
const hasErrorInfo = computed((): boolean => {
  return !!(taskData.value?.errorCode || taskData.value?.errorMessage);
});
const getStatusClass = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'status-completed';
    case 'failed':
      return 'status-failed';
    case 'cancelled':
      return 'status-cancelled';
    case 'running':
      return 'status-running';
    default:
      return 'status-pending';
  }
};
const formatCost = (cost: number): string => {
  if (cost < 0.01) {
    return cost.toFixed(6);
  }
  return cost.toFixed(4);
};
const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};
const calculateExecutionTime = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diff = end.getTime() - start.getTime();
  if (diff < 1000) {
    return `${diff}ms`;
  } else if (diff < 60000) {
    return `${(diff / 1000).toFixed(1)}s`;
  } else {
    return `${(diff / 60000).toFixed(1)}min`;
  }
};
// Helper to get LLM metadata from the correct location
const getLLMMetadata = (): Record<string, unknown> | undefined => {
  // The LLM metadata is nested under originalLLMSelection
  const metaAsRecord = taskMetadata.value as Record<string, unknown> | undefined;
  const llmMetadataField = metaAsRecord?.llmMetadata as Record<string, unknown> | undefined;
  const llmMeta = (llmMetadata.value as Record<string, unknown> | undefined)?.originalLLMSelection || llmMetadataField?.originalLLMSelection;
  return llmMeta as Record<string, unknown> | undefined;
};
const getLLMProviderName = (): string => {
  const llmMetadata = getLLMMetadata();
  if (!llmMetadata) return '';
  // First try direct name fields
  if (llmMetadata.providerName) return llmMetadata.providerName as string;
  if (llmMetadata.provider) return llmMetadata.provider as string;
  // Legacy fallback for old data with IDs
  if (llmMetadata.providerId) {
    const provider = llmStore.getProviderByName(llmMetadata.providerId as string);
    if (provider) return provider.name;
    // If store lookup fails, show ID as fallback
    return `Provider ID: ${llmMetadata.providerId as string}`;
  }
  return '';
};
const getLLMModelName = (): string => {
  const llmMetadata = getLLMMetadata();
  if (!llmMetadata) return '';
  // First try direct name fields
  if (llmMetadata.modelName) return llmMetadata.modelName as string;
  if (llmMetadata.model) return llmMetadata.model as string;
  // Legacy fallback for old data with IDs
  if (llmMetadata.modelId) {
    // For legacy data, try to find by name if the ID is actually a name
    const model = llmStore.getModelByName((llmMetadata.providerName as string) || '', llmMetadata.modelId as string);
    if (model) return model.name;
    // If store lookup fails, show ID as fallback
    return `Model ID: ${llmMetadata.modelId as string}`;
  }
  return '';
};
</script>
<style scoped>
.metadata-container {
  max-width: 800px;
  margin: 0 auto;
}
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
}
.metadata-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
}
.metadata-section h3 {
  margin: 0 0 16px 0;
  color: var(--ion-color-primary);
  font-size: 1.1rem;
  font-weight: 600;
}
.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
}
.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--ion-color-light-tint);
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}
.label {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-right: 8px;
}
.value {
  font-family: 'Courier New', monospace;
  color: var(--ion-color-medium-shade);
  text-align: right;
  word-break: break-word;
}
.total-cost {
  font-weight: 700;
  color: var(--ion-color-success);
}
.error-text {
  color: var(--ion-color-danger);
}
.status-completed {
  color: var(--ion-color-success);
}
.status-failed {
  color: var(--ion-color-danger);
}
.status-cancelled {
  color: var(--ion-color-warning);
}
.status-running {
  color: var(--ion-color-primary);
}
.status-pending {
  color: var(--ion-color-medium);
}
.raw-metadata {
  background: var(--ion-color-dark);
  color: var(--ion-color-light);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}
.raw-metadata pre {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  white-space: pre-wrap;
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .metadata-section {
    background: var(--ion-color-dark-shade);
    border-left-color: var(--ion-color-primary-tint);
  }
  .metadata-item {
    background: var(--ion-color-dark-tint);
    border-color: var(--ion-color-dark);
  }
  .raw-metadata {
    background: var(--ion-color-step-800);
    color: var(--ion-color-light);
  }
}
/* Mobile responsive */
@media (max-width: 768px) {
  .metadata-grid {
    grid-template-columns: 1fr;
  }
  .metadata-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .value {
    text-align: left;
  }
}
</style>