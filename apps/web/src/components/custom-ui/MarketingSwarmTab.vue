<template>
  <div class="marketing-swarm-tab">
    <!-- Header (simplified for tab context) -->
    <div class="swarm-header">
      <div class="header-info">
        <h2>Marketing Swarm</h2>
        <span v-if="conversation" class="conversation-title">{{ conversation.title }}</span>
      </div>
      <div class="header-actions" v-if="uiState.currentView !== 'config'">
        <ion-button fill="clear" size="small" @click="handleRestart">
          <ion-icon :icon="refreshOutline" slot="start" />
          Start Over
        </ion-button>
      </div>
    </div>

    <!-- Content Area -->
    <div class="swarm-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent" />
        <p>Loading configuration...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !isExecuting" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger" />
        <p>{{ error }}</p>
        <ion-button @click="loadConfiguration">Retry</ion-button>
      </div>

      <!-- Config Form -->
      <SwarmConfigForm
        v-else-if="uiState.currentView === 'config'"
        @execute="handleExecute"
      />

      <!-- Progress View -->
      <SwarmProgress
        v-else-if="uiState.currentView === 'progress'"
      />

      <!-- Results View -->
      <SwarmResults
        v-else-if="uiState.currentView === 'results'"
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
} from '@ionic/vue';
import { refreshOutline, alertCircleOutline } from 'ionicons/icons';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import { marketingSwarmService } from '@/services/marketingSwarmService';
import { useRbacStore } from '@/stores/rbacStore';
import SwarmConfigForm from '@/views/agents/marketing-swarm/components/SwarmConfigForm.vue';
import SwarmProgress from '@/views/agents/marketing-swarm/components/SwarmProgress.vue';
import SwarmResults from '@/views/agents/marketing-swarm/components/SwarmResults.vue';
import type { PromptData, SwarmConfig } from '@/types/marketing-swarm';
import type { AgentConversation } from '@/types/conversation';

interface Props {
  conversation: AgentConversation | null;
}

const props = defineProps<Props>();

const store = useMarketingSwarmStore();
const rbacStore = useRbacStore();

const isLoading = computed(() => store.isLoading);
const isExecuting = computed(() => store.isExecuting);
const error = computed(() => store.error);
const uiState = computed(() => store.uiState);

// Get org slug from conversation or context
const orgSlug = computed(() => {
  return props.conversation?.organizationSlug || rbacStore.currentOrganization || 'demo-org';
});

const userId = computed(() => {
  return rbacStore.user?.id || 'demo-user';
});

// Load configuration data on mount
async function loadConfiguration() {
  try {
    await marketingSwarmService.fetchAllConfiguration(orgSlug.value);
  } catch (err) {
    console.error('Failed to load configuration:', err);
  }
}

onMounted(async () => {
  console.log('[MarketingSwarmTab] Mounted with conversation:', props.conversation?.id);
  await loadConfiguration();

  // Check if the initial conversation has completed results
  if (props.conversation?.id) {
    const messages = props.conversation?.messages || [];
    const completedMessage = messages.find((msg) =>
      msg.metadata?.marketingSwarmCompleted === true
    );

    if (completedMessage?.metadata?.taskId) {
      console.log('[MarketingSwarmTab] Initial load - found completed task:', completedMessage.metadata.taskId);
      try {
        const state = await marketingSwarmService.getSwarmState(completedMessage.metadata.taskId as string);
        console.log('[MarketingSwarmTab] Initial load - loaded state:', state);
        store.setUIView('results');
      } catch (err) {
        console.error('[MarketingSwarmTab] Initial load - failed to load state:', err);
        // Fall back to config view
        store.setUIView('config');
      }
    }
  }
});

// Cleanup SSE connection when component unmounts
onUnmounted(() => {
  console.log('[MarketingSwarmTab] Unmounting - disconnecting SSE');
  marketingSwarmService.disconnectSSEStream();
});

// Watch for conversation changes
watch(() => props.conversation?.id, async (newId) => {
  if (newId) {
    console.log('[MarketingSwarmTab] Conversation changed:', newId);
    // Reset state when switching to a new conversation
    store.resetTaskState();

    // Check if this conversation has completed results
    // Look for marketingSwarmCompleted in message metadata
    const messages = props.conversation?.messages || [];
    const completedMessage = messages.find((msg) =>
      msg.metadata?.marketingSwarmCompleted === true
    );

    if (completedMessage?.metadata?.taskId) {
      console.log('[MarketingSwarmTab] Found completed task:', completedMessage.metadata.taskId);
      // Fetch the full state from LangGraph and display results
      try {
        const state = await marketingSwarmService.getSwarmState(completedMessage.metadata.taskId as string);
        console.log('[MarketingSwarmTab] Loaded completed state:', state);
        // State is already populated in store by getSwarmState
        store.setUIView('results');
      } catch (err) {
        console.error('[MarketingSwarmTab] Failed to load completed state:', err);
        // Fall back to config view if we can't load the state
        store.setUIView('config');
      }
    } else {
      // No completed results, show config
      store.setUIView('config');
    }
  }
});

// Handle execute from config form
async function handleExecute(data: {
  contentTypeSlug: string;
  contentTypeContext: string;
  promptData: PromptData;
  config: SwarmConfig;
}) {
  try {
    // Initialize agent card states
    for (const writer of data.config.writers) {
      store.setAgentCardState(writer.agentSlug, writer.llmConfigId, {
        agentSlug: writer.agentSlug,
        llmConfigId: writer.llmConfigId,
        status: 'idle',
      });
    }
    for (const editor of data.config.editors) {
      store.setAgentCardState(editor.agentSlug, editor.llmConfigId, {
        agentSlug: editor.agentSlug,
        llmConfigId: editor.llmConfigId,
        status: 'idle',
      });
    }
    for (const evaluator of data.config.evaluators) {
      store.setAgentCardState(evaluator.agentSlug, evaluator.llmConfigId, {
        agentSlug: evaluator.agentSlug,
        llmConfigId: evaluator.llmConfigId,
        status: 'idle',
      });
    }

    // Use conversationId from props (created when user clicked on agent in sidebar)
    const currentConversationId = props.conversation?.id;

    if (!currentConversationId) {
      console.error('[MarketingSwarmTab] No conversation ID provided');
      store.setError('No conversation ID. Please try again.');
      return;
    }

    // Initialize ExecutionContext with existing conversation from sidebar
    marketingSwarmService.initializeWithExistingConversation(
      currentConversationId,
      orgSlug.value,
      userId.value,
      data.config
    );
    console.log('[MarketingSwarmTab] Using conversation:', currentConversationId);

    // Connect to SSE stream for real-time updates BEFORE starting execution
    marketingSwarmService.connectToSSEStream(currentConversationId);
    console.log('[MarketingSwarmTab] Connected to SSE stream');

    // Start execution (uses the initialized ExecutionContext)
    const response = await marketingSwarmService.startSwarmExecution(
      data.contentTypeSlug,
      data.contentTypeContext,
      data.promptData,
      data.config
    );

    console.log('Swarm execution completed:', response);
  } catch (err) {
    console.error('Swarm execution failed:', err);
    // Disconnect SSE on error
    marketingSwarmService.disconnectSSEStream();
  }
}

// Handle restart - go back to config
function handleRestart() {
  // Disconnect SSE when restarting
  marketingSwarmService.disconnectSSEStream();
  store.resetTaskState();
  store.setUIView('config');
}
</script>

<style scoped>
.marketing-swarm-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-color-step-50);
}

.swarm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: white;
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

.swarm-content {
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
  .marketing-swarm-tab {
    background: #1a1a1a;
  }

  .swarm-header {
    background: #2d3748;
    border-color: #4a5568;
  }

  .header-info h2 {
    color: #f7fafc;
  }

  .conversation-title {
    color: #a0aec0;
  }
}

html[data-theme="dark"] .marketing-swarm-tab {
  background: #1a1a1a;
}

html[data-theme="dark"] .swarm-header {
  background: #2d3748;
  border-color: #4a5568;
}

html[data-theme="dark"] .header-info h2 {
  color: #f7fafc;
}

html[data-theme="dark"] .conversation-title {
  color: #a0aec0;
}
</style>
