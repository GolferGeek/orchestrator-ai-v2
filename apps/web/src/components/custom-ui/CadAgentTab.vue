<template>
  <div class="cad-agent-tab">
    <!-- Header with Tab Navigation -->
    <div class="cad-header">
      <div class="header-top">
        <div class="header-info">
          <h2>CAD Agent</h2>
          <span v-if="conversation" class="conversation-title">{{ conversation.title }}</span>
        </div>
        <div class="header-actions" v-if="hasTaskData">
          <ion-button fill="clear" size="small" @click="handleRestart">
            <ion-icon :icon="refreshOutline" slot="start" />
            Start Over
          </ion-button>
        </div>
      </div>

      <!-- Tab Navigation - Only show when there's task data -->
      <div v-if="hasTaskData" class="tab-navigation">
        <ion-segment :value="currentView" @ionChange="handleTabChange">
          <ion-segment-button value="config">
            <ion-label>Config</ion-label>
          </ion-segment-button>
          <ion-segment-button value="progress" :disabled="!hasProgressData">
            <ion-label>Progress</ion-label>
            <ion-badge v-if="isGenerating" color="primary" class="status-badge">Live</ion-badge>
          </ion-segment-button>
          <ion-segment-button value="deliverables" :disabled="!hasDeliverables">
            <ion-label>Deliverables</ion-label>
            <ion-badge v-if="hasDeliverables && !isGenerating" color="success" class="status-badge">Done</ion-badge>
          </ion-segment-button>
        </ion-segment>
      </div>
    </div>

    <!-- Content Area -->
    <div class="cad-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent" />
        <p>Loading configuration...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !isGenerating" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger" />
        <p>{{ error }}</p>
        <ion-button @click="handleRestart">Retry</ion-button>
      </div>

      <!-- Config Panel -->
      <CadConfigPanel
        v-else-if="currentView === 'config'"
        @generate="handleGenerate"
      />

      <!-- Progress Panel -->
      <CadProgressPanel
        v-else-if="currentView === 'progress'"
      />

      <!-- Deliverables Panel -->
      <CadDeliverablePanel
        v-else-if="currentView === 'deliverables'"
        @restart="handleRestart"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import {
  IonButton,
  IonSpinner,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonBadge,
} from '@ionic/vue';
import { refreshOutline, alertCircleOutline } from 'ionicons/icons';
import { useCadAgentStore } from '@/stores/cadAgentStore';
import { useRbacStore } from '@/stores/rbacStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { cadAgentService } from '@/services/cadAgentService';
import CadConfigPanel from '@/views/agents/cad-agent/CadConfigPanel.vue';
import CadProgressPanel from '@/views/agents/cad-agent/CadProgressPanel.vue';
import CadDeliverablePanel from '@/views/agents/cad-agent/CadDeliverablePanel.vue';
import type { AgentConversation } from '@/types/conversation';
import type { CadConstraints } from '@/stores/cadAgentStore';

interface Props {
  conversation: AgentConversation | null;
}

const props = defineProps<Props>();

const store = useCadAgentStore();
const rbacStore = useRbacStore();
const executionContextStore = useExecutionContextStore();

// Computed properties from store
const currentView = computed(() => store.currentView);
const isLoading = computed(() => store.isLoading);
const isGenerating = computed(() => store.isGenerating);
const error = computed(() => store.error);
const hasTaskData = computed(() => store.hasTaskData);
const hasProgressData = computed(() => store.hasProgressData);
const hasDeliverables = computed(() => store.hasDeliverables);

// Get org slug from conversation or context
const orgSlug = computed(() => {
  return props.conversation?.organizationSlug || rbacStore.currentOrganization || 'demo-org';
});

const userId = computed(() => {
  return rbacStore.user?.id || 'demo-user';
});

// Handle tab change
function handleTabChange(event: CustomEvent) {
  const newView = event.detail.value as 'config' | 'progress' | 'deliverables';
  store.setUIView(newView);
}

// Handle generate from config panel
async function handleGenerate(data: {
  prompt: string;
  projectId?: string;
  newProjectName?: string;
  constraints: CadConstraints;
  outputFormats: string[];
}) {
  try {
    console.log('[CadAgentTab] Starting generation:', data);

    // Get llm_config from the conversation's agent
    const agentLlmConfig = props.conversation?.agent?.llm_config;
    const provider = agentLlmConfig?.provider || 'ollama';
    const model = agentLlmConfig?.model || 'qwen2.5-coder:14b'; // Fallback for CAD code generation
    const conversationId = props.conversation?.id || crypto.randomUUID();

    // Always update ExecutionContext to match this conversation's settings
    // The agent's llm_config is the source of truth for CAD agent
    if (!executionContextStore.isInitialized) {
      executionContextStore.initialize({
        orgSlug: orgSlug.value,
        userId: userId.value,
        conversationId,
        agentSlug: 'cad-agent',
        agentType: 'api',
        provider,
        model,
      });
      console.log('[CadAgentTab] ExecutionContext initialized with LLM:', provider, '/', model, '(from agent.llm_config:', !!agentLlmConfig, ')');
    } else {
      // Context already initialized - update to match this conversation's agent settings
      executionContextStore.setAgent('cad-agent', 'api');
      executionContextStore.setConversation(conversationId);
      executionContextStore.setLLM(provider, model);
      console.log('[CadAgentTab] ExecutionContext updated with LLM:', provider, '/', model, '(from agent.llm_config:', !!agentLlmConfig, ')');
    }

    // Connect to SSE stream BEFORE starting generation
    // This ensures we receive all progress events
    const activeConversationId = executionContextStore.current.conversationId;
    cadAgentService.connectToSSEStream(activeConversationId);
    console.log('[CadAgentTab] Connected to SSE stream for conversationId:', activeConversationId);

    // Call the CAD agent service (uses A2A orchestrator)
    const result = await cadAgentService.generateCad({
      prompt: data.prompt,
      projectId: data.projectId,
      newProjectName: data.newProjectName,
      constraints: data.constraints,
      outputFormats: data.outputFormats,
    });

    console.log('[CadAgentTab] Generation started:', result);

    // If completed synchronously, switch to deliverables
    if (result.status === 'completed') {
      store.setUIView('deliverables');
    }
    // Otherwise, SSE events will handle the transition

  } catch (err) {
    console.error('[CadAgentTab] Generation failed:', err);
    store.setGenerating(false);
    store.setError(err instanceof Error ? err.message : 'Generation failed');
  }
}

// Handle restart - go back to config
function handleRestart() {
  store.resetTaskState();
  store.setUIView('config');
}

// Load configuration on mount
onMounted(async () => {
  console.log('[CadAgentTab] Mounted with conversation:', props.conversation?.id);

  // TODO: Load any existing task state from conversation
  // If conversation has a task, restore it
  if (props.conversation?.id) {
    // Check for existing CAD tasks
    console.log('[CadAgentTab] Would load tasks for conversation:', props.conversation.id);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  console.log('[CadAgentTab] Unmounting');
  // Disconnect SSE stream when component unmounts
  cadAgentService.disconnectSSEStream();
});

// Watch for conversation changes
watch(() => props.conversation?.id, async (newId) => {
  if (newId) {
    console.log('[CadAgentTab] Conversation changed:', newId);
    store.resetTaskState();
    // TODO: Load state for new conversation
  }
});
</script>

<style scoped>
.cad-agent-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-color-step-50);
}

.cad-header {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--ion-color-light);
  background: white;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}

.header-info h2 {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.conversation-title {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  margin-left: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Tab Navigation */
.tab-navigation {
  padding: 0 16px 12px;
}

.tab-navigation ion-segment {
  --background: var(--ion-color-light);
  border-radius: 8px;
}

.tab-navigation ion-segment-button {
  --indicator-color: var(--ion-color-primary);
  --color: var(--ion-color-medium);
  --color-checked: var(--ion-color-primary-contrast);
  font-size: 0.85em;
  min-height: 36px;
  position: relative;
}

.tab-navigation ion-segment-button ion-label {
  font-weight: 500;
}

.tab-navigation .status-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.6em;
  padding: 2px 4px;
  min-width: unset;
  border-radius: 4px;
}

.cad-content {
  flex: 1;
  overflow-y: auto;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.error-container ion-icon {
  font-size: 48px;
}

.error-container p {
  color: var(--ion-color-medium);
  text-align: center;
  max-width: 300px;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .cad-agent-tab {
    background: #1a1a1a;
  }

  .cad-header {
    background: #2d3748;
    border-color: #4a5568;
  }

  .header-info h2 {
    color: #f7fafc;
  }

  .conversation-title {
    color: #a0aec0;
  }

  .tab-navigation ion-segment {
    --background: #3d4a5c;
  }
}

html[data-theme="dark"] .cad-agent-tab {
  background: #1a1a1a;
}

html[data-theme="dark"] .cad-header {
  background: #2d3748;
  border-color: #4a5568;
}

html[data-theme="dark"] .header-info h2 {
  color: #f7fafc;
}

html[data-theme="dark"] .conversation-title {
  color: #a0aec0;
}

html[data-theme="dark"] .tab-navigation ion-segment {
  --background: #3d4a5c;
}
</style>
