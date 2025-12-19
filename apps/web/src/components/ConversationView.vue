<template>
  <div class="conversation-view">
    <!-- Custom UI for agents with hasCustomUI (like Marketing Swarm) -->
    <template v-if="hasCustomUI">
      <MarketingSwarmTab
        v-if="customUIComponent === 'marketing-swarm'"
        :conversation="conversation"
      />
      <!-- Add more custom UI components here as needed -->
      <div v-else class="custom-ui-not-found">
        <p>Custom UI component "{{ customUIComponent }}" not found.</p>
      </div>
    </template>

    <!-- Standard Conversation UI -->
    <template v-else>
    <!-- Header -->
    <div class="conversation-header">
      <div class="conversation-info">
        <h2>{{ conversation?.title || 'Conversation' }}</h2>
        <span class="agent-name">with {{ currentAgent?.name }}</span>
        <!-- Sovereign Mode Indicator -->
        <SovereignModeTooltip position="bottom" :show-data-flow="true" :show-compliance="true">
          <SovereignModeBadge variant="compact" :clickable="false" />
        </SovereignModeTooltip>
      </div>
    </div>
    <div class="conversation-container">
      <!-- Conversation Content -->
      <div class="conversation-pane">
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner />
          <p>Loading conversation...</p>
        </div>
        <!-- Error State -->
        <div v-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <p>{{ error }}</p>
          <ion-button @click="clearError">Dismiss</ion-button>
        </div>
        
        <!-- Sovereign Mode Banner -->
        <SovereignModeBanner 
          v-if="shouldShowSovereignBanner"
          :variant="sovereignBannerVariant"
          :dismissible="false"
          class="sovereign-conversation-banner"
        />
        
        <!-- Messages -->
        <div class="messages-container" ref="messagesContainer">
          <!-- Agent Resources Panel -->
          <AgentResourcesPanel
            v-if="shouldShowAgentResources"
            :agent-video-ids="agentVideoIds"
            :fallback-video-ids="fallbackVideoIds"
            :videos="allVideos"
            :agent-slug="agentSlug"
            :agent-name="currentAgent?.name"
          />
          
          <!-- Prominent thinking indicator (Converse/Plan/Build modes) -->
          <div v-if="isSendingMessage && (currentChatMode === 'converse' || currentChatMode === 'plan' || currentChatMode === 'build')" class="prominent-thinking-indicator">
            <div class="thinking-content">
              <div class="thinking-avatar">
                <ion-spinner name="dots" color="primary"></ion-spinner>
              </div>
              <div class="thinking-bubble">
                <div class="thinking-text">
                  <div class="agent-thinking-name">{{ currentAgent?.name || 'Agent' }}</div>
                  <div class="thinking-message">{{ thinkingMessage }}</div>
                </div>
                <div class="thinking-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-wrapper"
            :class="{
              'has-deliverable': messageHasDeliverable(message),
              'simple-message': isSimpleMessage(message)
            }"
          >
            <!-- Simple message bubble for converse mode -->
            <div v-if="isSimpleMessage(message)" class="simple-message-bubble" :class="message.role">
              <!-- eslint-disable-next-line vue/no-v-html -- Sanitized message content -->
              <div class="message-content" v-html="formatMessageContent(message.content)"></div>
              <div v-if="message.timestamp" class="message-timestamp">
                {{ formatTimestamp(message.timestamp) }}
              </div>
              <!-- Sub-agent attribution badge (Orchestrator V2) -->
              <div v-if="message.metadata?.resolvedByDisplayName" class="attribution-badge">
                ✓ Resolved by: {{ message.metadata.resolvedByDisplayName }}
              </div>
            </div>
            <!-- Task item for plan/build/orchestrate modes -->
            <AgentTaskItem
              v-else
              :message="message"
              :conversation-id="conversation?.id"
              :agent="currentAgent"
              :agent-name="currentAgent?.name"
              @deliverable-created="handleDeliverableCreated"
              @deliverable-selected="selectDeliverable"
            />
          </div>
        </div>
        <div
          v-if="shouldShowRecommendations"
          class="agent-llm-suggestions"
        >
          <div class="agent-llm-suggestions__header">
            <span>Popular picks for {{ currentAgent?.name || 'this agent' }}</span>
            <ion-spinner v-if="isRecommendationsLoading" name="lines" />
          </div>
          <div
            v-if="topAgentRecommendations.length"
            class="agent-llm-suggestions__chips"
          >
            <ion-chip
              v-for="rec in topAgentRecommendations"
              :key="`${rec.providerName}-${rec.modelName}`"
              class="agent-llm-suggestions__chip"
              :class="{ 'chip-selected': isRecommendationActive(rec) }"
              :outline="!isRecommendationActive(rec)"
              :color="isRecommendationActive(rec) ? 'primary' : undefined"
              @click="applyRecommendation(rec)"
            >
              <span class="chip-provider">{{ rec.providerName }}</span>
              <span class="chip-divider">•</span>
              <span class="chip-model">{{ rec.modelName }}</span>
              <span class="chip-rating">{{ rec.averageRating.toFixed(1) }}</span>
            </ion-chip>
          </div>
          <p
            v-else-if="!isRecommendationsLoading && !recommendationsError"
            class="agent-llm-suggestions__empty"
          >
            No highly rated runs yet.
          </p>
          <p
            v-if="!isRecommendationsLoading && !topAgentRecommendations.length && recommendationsError"
            class="agent-llm-suggestions__error"
          >
            {{ recommendationsError }}
          </p>
        </div>
        <!-- Input Area (always visible) -->
        <div class="input-area">
          <form @submit.prevent="sendMessage()">
            <ion-item>
              <ion-textarea
                v-model="messageText"
                placeholder="Type your message..."
                :rows="2"
                :disabled="!currentAgent"
                @keydown="handleKeydown"
              />
              <!-- Conversational Speech Button -->
              <ConversationalSpeechButton
                v-if="props.conversation?.id"
                slot="end"
                :conversation-id="props.conversation.id"
                :agent-name="currentAgent?.name"
                :agent-type="currentAgent?.type || 'generalists'"
                :disabled="!currentAgent"
                @conversation-start="handleConversationStart"
                @conversation-end="handleConversationEnd"
                @error="handleSpeechError"
              />
            </ion-item>
            <!-- Action Buttons Row -->
            <div class="action-buttons">
              <ion-button
                v-if="currentAgent"
                :fill="currentChatMode === 'converse' ? 'solid' : 'outline'"
                size="small"
                color="medium"
                :disabled="!currentAgent || isSendingMessage || currentAgent.execution_capabilities?.can_converse === false"
                @click="sendWithMode('converse')"
                :title="currentAgent.execution_capabilities?.can_converse === false ? 'Converse mode not supported for this agent' : 'Converse (Ctrl+C)'"
              >
                <ion-icon :icon="chatbubbleOutline" slot="start" />
                Converse
              </ion-button>
              <ion-button
                v-if="currentAgent"
                :fill="currentChatMode === 'plan' ? 'solid' : 'outline'"
                size="small"
                color="primary"
                :disabled="!currentAgent || isSendingMessage || currentAgent.execution_capabilities?.can_plan === false"
                @click="sendWithMode('plan')"
                :title="currentAgent.execution_capabilities?.can_plan === false ? 'Plan mode not supported for this agent' : 'Create Plan (Ctrl+P)'"
              >
                <ion-icon :icon="documentTextOutline" slot="start" />
                Plan
              </ion-button>
              <ion-button
                v-if="currentAgent"
                :fill="currentChatMode === 'build' ? 'solid' : 'outline'"
                size="small"
                color="success"
                :disabled="!currentAgent || isSendingMessage || currentAgent.execution_capabilities?.can_build === false"
                @click="sendWithMode('build')"
                :title="currentAgent.execution_capabilities?.can_build === false ? 'Build mode not supported for this agent' : 'Create Deliverable (Ctrl+B)'"
              >
                <ion-icon :icon="hammerOutline" slot="start" />
                Build
              </ion-button>
            </div>
          </form>
          <!-- Compact LLM + Execution Controls -->
          <div class="llm-controls">
            <CompactLLMControl />
            <TaskExecutionControls />
          </div>
        </div>
        <!-- Typing Indicator -->
        <div v-if="isSendingMessage" class="typing-indicator">
          <ion-spinner size="small" />
          <span>Processing...</span>
        </div>
      </div>
    </div>
    <!-- Mobile Work Product Selector -->
    <ion-action-sheet
      :is-open="showDeliverableSelector"
      header="Select Work Product"
      :buttons="deliverableActionButtons"
      @didDismiss="showDeliverableSelector = false"
    />
    <!-- Merge Modal -->
    <ion-modal :is-open="showMergeModal" @did-dismiss="closeMergeModal">
      <DeliverableMergeView
        v-if="mergeDeliverable"
        :deliverable="mergeDeliverable"
        @merge-completed="handleMergeCompleted"
        @merge-cancelled="closeMergeModal"
      />
    </ion-modal>
    
    <!-- LLM Reselector Modal (for rerun with different LLM) -->
    <LLMReselectorModal
      :is-open="showLLMRerunModal"
      @dismiss="closeLLMRerunModal"
      @execute="handleLLMExecute"
    />

    <!-- HITL Review Modal (new modal-based HITL UI) -->
    <HitlReviewModal
      :is-open="showHitlModal"
      :organization-slug="props.conversation?.organizationSlug || 'demo'"
      :agent-slug="agentSlug"
      :task-id="hitlData?.taskId || ''"
      :conversation-id="props.conversation?.id || ''"
      :deliverable-id="hitlData?.deliverableId"
      :topic="hitlData?.topic || ''"
      :initial-content="hitlData?.generatedContent"
      :current-version-number="hitlData?.currentVersionNumber"
      @close="handleHitlModalClose"
      @completed="handleHitlCompleted"
      @regenerated="handleHitlRegenerated"
    />

    <!-- Deliverables Modal (for viewing completed deliverables) -->
    <DeliverablesModal
      :is-open="showDeliverablesModal"
      :deliverable-id="selectedDeliverableId || ''"
      :title="selectedDeliverable?.title"
      :topic="selectedDeliverable?.title"
      :initial-content="selectedDeliverableContent"
      :current-version-number="selectedDeliverable?.currentVersion?.versionNumber"
      @close="handleDeliverablesModalClose"
      @edit="handleDeliverableEdit"
      @rerun="handleDeliverableRerun"
      @rerun-with-different-llm="handleDeliverableRerunWithDifferentLlm"
    />
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  IonIcon,
  IonButton,
  IonItem,
  IonTextarea,
  IonSpinner,
  IonActionSheet,
  IonModal,
  IonChip,
} from '@ionic/vue';
import {
  alertCircleOutline,
  documentTextOutline,
  hammerOutline,
  chatbubbleOutline,
} from 'ionicons/icons';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { deliverablesService } from '@/services/deliverablesService';
import { usePlanStore } from '@/stores/planStore';
import { useAuthStore } from '@/stores/rbacStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { videoService } from '@/services/videoService';
import {
  sendMessage as sendMessageAction,
  createPlan as createPlanAction,
  createDeliverable as createDeliverableAction,
  type HitlWaitingResult,
} from '@/services/agent2agent/actions';
import type { HitlGeneratedContent } from '@orchestrator-ai/transport-types';
import HitlReviewModal from '@/components/hitl/HitlReviewModal.vue';
import DeliverablesModal from '@/components/deliverables/DeliverablesModal.vue';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useUiStore } from '@/stores/uiStore';
// import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import type {
  AgentConversation,
  AgentChatMessage,
  AgentChatMode,
  LLMRunConfiguration,
} from '@/types/conversation';
import type { AgentLLMRecommendation } from '@/types/evaluation';
import { rerunPlan, rerunDeliverable } from '@/services/agent2agent/actions';
import AgentTaskItem from './AgentTaskItem.vue';
import AgentResourcesPanel from './AgentResourcesPanel.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import DeliverableMergeView from './DeliverableMergeView.vue';
import LLMReselectorModal from './LLMReselectorModal.vue';
import SovereignModeBadge from './SovereignMode/SovereignModeBadge.vue';
import SovereignModeTooltip from './SovereignMode/SovereignModeTooltip.vue';
import SovereignModeBanner from './SovereignMode/SovereignModeBanner.vue';
import ConversationalSpeechButton from './ConversationalSpeechButton.vue';
import MarketingSwarmTab from './custom-ui/MarketingSwarmTab.vue';
import type { Deliverable, DeliverableVersion } from '@/services/deliverablesService';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';

interface Props {
  conversation?: AgentConversation | null;
}
const props = defineProps<Props>();

interface DeliverableRerunContext {
  deliverable: Deliverable;
  version: DeliverableVersion;
}

interface PlanRerunContext {
  plan: PlanData;
  version: PlanVersionData;
}

type RerunContext = DeliverableRerunContext | PlanRerunContext;

const isPlanRerunContext = (context: RerunContext): context is PlanRerunContext =>
  'plan' in context;
// Stores
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const deliverablesStore = useDeliverablesStore();
const planStore = usePlanStore();
const authStore = useAuthStore();
const sovereignPolicyStore = usePrivacyStore();
const llmStore = useLLMPreferencesStore();
const uiStore = useUiStore();
const agentsStore = useAgentsStore();
// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const showDeliverableSelector = ref(false);
const showMergeModal = ref(false);
const mergeDeliverable = ref<Deliverable | null>(null);
const showLLMRerunModal = ref(false);
const rerunDeliverableData = ref<RerunContext | null>(null);

// HITL Modal State
const showHitlModal = ref(false);
const hitlData = ref<HitlWaitingResult | null>(null);

// Deliverables Modal State
const showDeliverablesModal = ref(false);
const selectedDeliverableId = ref<string | null>(null);
const selectedDeliverable = ref<Deliverable | null>(null);
const selectedDeliverableContent = ref<HitlGeneratedContent | undefined>(undefined);
// Computed properties
const currentAgent = computed(() => {
  if (!props.conversation?.agentName) return null;

  // Get the full agent data from the agents store
  const agentInfo = agentsStore.availableAgents.find(
    (agent) => agent.name === props.conversation.agentName
  );

  // If found in store, return with full capabilities
  if (agentInfo) {
    return agentInfo;
  }

  // Fallback: construct minimal object with default capabilities based on agent type
  // API agents typically don't support plan mode, context agents support all modes
  const agentType = props.conversation.agentType || 'custom';
  const defaultCapabilities = {
    can_converse: true,
    can_plan: agentType !== 'api', // API agents don't support plan by default
    can_build: true,
    requires_human_gate: false,
  };

  return {
    name: props.conversation.agentName || '',
    type: agentType,
    slug: props.conversation.agentName || '',
    id: props.conversation.agentName || '',
    organizationSlug: props.conversation.organizationSlug,
    execution_capabilities: defaultCapabilities,
  };
});

// Custom UI detection for agents like Marketing Swarm
const hasCustomUI = computed(() => {
  const agent = currentAgent.value;
  if (!agent) return false;
  // Check for hasCustomUI in the agent info (from agentsStore)
  // The agent info is populated from the backend agent metadata
  return Boolean((agent as Record<string, unknown>).hasCustomUI);
});

const customUIComponent = computed(() => {
  const agent = currentAgent.value;
  if (!agent) return null;
  return (agent as Record<string, unknown>).customUIComponent as string | null;
});

const currentAgentIdentifier = computed(() => currentAgent.value?.name ?? '');
const messages = computed<AgentChatMessage[]>(() => {
  // Always read from store - conversation.messages is legacy and may be empty/stale
  if (props.conversation?.id) {
    const msgs = conversationsStore.messagesByConversation(props.conversation.id);
    return msgs;
  }
  return [];
});

// Video-related computed properties
const agentSlug = computed(() => currentAgent.value?.slug ?? currentAgent.value?.id ?? '');

const agentVideoIds = computed(() => {
  const agentIdentifier = agentSlug.value || currentAgent.value?.name || '';
  if (!agentIdentifier) return [] as string[];
  return videoService.getAgentVideoIdsByNameOrSlug(agentIdentifier);
});

const fallbackVideoIds = computed(() => videoService.getDefaultVideoIds());

const allVideos = computed(() => videoService.getAllVideos());

const shouldShowAgentResources = computed(() => {
  if (!currentAgent.value) return false;
  return agentVideoIds.value.length > 0 || fallbackVideoIds.value.length > 0;
});
const isLoading = computed(() => chatUiStore.isLoading);
const error = computed(() => chatUiStore.error);
const isSendingMessage = computed(() => chatUiStore.isSendingMessage);
const canSend = computed(() => {
  return (
    messageText.value.trim().length > 0 &&
    !isSendingMessage.value &&
    Boolean(currentAgent.value)
  );
});
const currentChatMode = computed<AgentChatMode | string | undefined>(() => chatUiStore.chatMode);
const agentRecommendations = computed(() =>
  currentAgentIdentifier.value
    ? llmStore.getRecommendationsForAgent(currentAgentIdentifier.value)
    : [],
);
const topAgentRecommendations = computed(() => agentRecommendations.value.slice(0, 3));
const isRecommendationsLoading = computed(() => llmStore.isAgentRecommendationsLoading);
const recommendationsError = computed(() => llmStore.agentRecommendationsErrorMessage);
const shouldShowRecommendations = computed(
  () =>
    isRecommendationsLoading.value ||
    topAgentRecommendations.value.length > 0 ||
    !!recommendationsError.value,
);

// Current LLM selection for display (commented out as unused)
// const currentLLMProvider = computed(() => llmStore.selectedProvider?.name || 'No provider selected');
// const currentLLMModel = computed(() => llmStore.selectedModel?.modelName || 'No model selected');
// Informal thinking message for converse/plan/build
const thinkingMessage = computed(() => {
  const mode = (currentChatMode.value || '').toLowerCase();
  if (mode === 'converse') return 'One sec — thinking it through…';
  if (mode === 'plan') return 'Sketching a quick plan…';
  if (mode === 'build') return 'Building your deliverable…';
  return 'Processing…';
});
// Sovereign mode computed properties
const shouldShowSovereignBanner = computed(() => {
  // Show banner for enforced policy or when there are warnings
  return sovereignPolicyStore.policy?.enforced ||
         (sovereignPolicyStore.policyWarnings?.length ?? 0) > 0;
});

const sovereignBannerVariant = computed(() => {
  if (sovereignPolicyStore.policy?.enforced) {
    return 'enforced';
  }
  if ((sovereignPolicyStore.policyWarnings?.length ?? 0) > 0) {
    return 'warning';
  }
  if (sovereignPolicyStore.effectiveSovereignMode) {
    return 'success';
  }
  return 'info';
});
// Check if message should be displayed as simple bubble (converse mode)
const isSimpleMessage = (message: AgentChatMessage) => {
  // User messages are always simple
  if (message.role === 'user') return true;

  // Assistant messages without plan/deliverable/orchestration metadata are simple converse responses
  if (message.role === 'assistant') {
    const hasTaskMetadata = message.metadata?.planId ||
                           message.metadata?.deliverableId ||
                           message.metadata?.mode === 'plan' ||
                           message.metadata?.mode === 'build';
    return !hasTaskMetadata;
  }

  return false;
};

// Format message content (convert markdown to HTML for simple messages)
const formatMessageContent = (content: string) => {
  // Simple formatting - convert newlines to <br>
  // Could use marked here for full markdown support
  return content.replace(/\n/g, '<br>');
};

// Format timestamp
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const deliverableActionButtons = computed(() => {
  const conversationDeliverables = deliverablesStore.getDeliverablesByConversation(props.conversation?.id);
  return conversationDeliverables.map(deliverable => ({
    text: deliverable.title,
    handler: () => selectDeliverable(deliverable),
  })).concat([
    {
      text: 'Cancel',
      handler: () => {}  // Empty handler for cancel
    }
  ]);
});
// Speech event handlers
const handleConversationStart = () => {
  uiStore.setConversationalMode(true);
  messageText.value = ''; // Clear text input when starting conversation
};

const handleConversationEnd = () => {
  uiStore.setConversationalMode(false);
};

const handleSpeechError = (error: unknown) => {
  console.error('Speech error:', error);
  uiStore.setConversationalMode(false);
};

// Methods
const sendMessage = async (mode?: AgentChatMode) => {
  if (!canSend.value) return;
  const content = messageText.value.trim();
  messageText.value = '';

  // If mode is provided, set it before sending
  // If no mode is set at all, default to 'converse' for new conversations
  if (mode) {
    chatUiStore.setChatMode(mode);
  } else if (!currentChatMode.value) {
    chatUiStore.setChatMode('converse');
  }

  const conversationId = props.conversation?.id;
  if (!conversationId) {
    console.error('Cannot send message: missing conversationId');
    return;
  }

  try {
    const agent = currentAgent.value;

    if (!agent) {
      console.error('Cannot send message: missing agent');
      return;
    }

    // Set sending state
    chatUiStore.setIsSendingMessage(true);
    chatUiStore.setError(null);

    const effectiveMode = mode || currentChatMode.value || 'converse';

    // Route to appropriate action based on mode
    // All actions now use the orchestrator and get context from the store
    if (effectiveMode === 'plan') {
      await createPlanAction(content);
    } else if (effectiveMode === 'build') {
      // Create deliverable - orchestrator gets context from store
      const result = await createDeliverableAction(content);

      // Check if this is an HITL waiting response
      if (result && 'isHitlWaiting' in result && result.isHitlWaiting) {
        console.log('🔄 [ConversationView] HITL waiting - showing modal:', result);
        hitlData.value = result;
        showHitlModal.value = true;
      }
    } else {
      // converse mode (default - 'conversational' or undefined)
      await sendMessageAction(content);
    }

    scrollToBottom();
  } catch (error) {
    console.error('Error sending message:', error);
    chatUiStore.setError(error instanceof Error ? error.message : 'Failed to send message');
    // Re-populate the input if there was an error
    messageText.value = content;
  } finally {
    chatUiStore.setIsSendingMessage(false);
  }
};

// Send with specific mode and set as active
const sendWithMode = async (mode: AgentChatMode) => {
  if (!currentAgent.value || isSendingMessage.value) return;

  const hasMessages = messages.value && messages.value.length > 0;

  // If no message text, use context-aware defaults
  if (!messageText.value.trim()) {
    if (mode === 'plan') {
      // For plan: use conversation context if exists, otherwise generic prompt
      messageText.value = hasMessages ? 'Create a plan based on our conversation' : 'Create a plan';
    } else if (mode === 'build') {
      // For build: use conversation context if exists, otherwise generic prompt
      messageText.value = hasMessages ? 'Create a deliverable based on our conversation' : 'Create a deliverable';
    } else {
      // For converse: only allow if there are already messages (continuing conversation)
      if (!hasMessages) {
        messageText.value = 'Hello';
      } else {
        messageText.value = 'Continue';
      }
    }
  }

  // Set this mode as active
  chatUiStore.setChatMode(mode);

  // Send with this mode
  await sendMessage(mode);
};

// Handle keyboard shortcuts
const handleKeydown = async (event: KeyboardEvent) => {
  // Ctrl+C for Converse
  if (event.ctrlKey && event.key === 'c') {
    event.preventDefault();
    await sendWithMode('converse');
    return;
  }

  // Ctrl+P for Plan
  if (event.ctrlKey && event.key === 'p') {
    event.preventDefault();
    await sendWithMode('plan');
    return;
  }

  // Ctrl+B for Build
  if (event.ctrlKey && event.key === 'b') {
    event.preventDefault();
    await sendWithMode('build');
    return;
  }

  // Enter key uses current active mode
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const mode = currentChatMode.value || 'converse';
    await sendMessage(mode);
  }
};

// Check if a recommendation matches the current selection
const isRecommendationActive = (recommendation: AgentLLMRecommendation) => {
  if (!recommendation || !recommendation.providerName || !recommendation.modelName) {
    return false;
  }
  
  return (
    llmStore.selectedProvider?.name?.toLowerCase() === recommendation.providerName.toLowerCase() &&
    llmStore.selectedModel?.modelName?.toLowerCase() === recommendation.modelName.toLowerCase()
  );
};

const applyRecommendation = async (recommendation: AgentLLMRecommendation) => {
  if (!recommendation || !recommendation.providerName || !recommendation.modelName) {
    console.error('❌ Invalid recommendation:', recommendation);
    return;
  }

  // Find provider by name
  const provider = llmStore.filteredProviders.find(
    (p) => p.name?.toLowerCase() === recommendation.providerName.toLowerCase(),
  );

  if (!provider) {
    console.error('❌ Provider not found:', recommendation.providerName);
    return;
  }

  // Set provider first and wait for models to load
  await llmStore.setProvider(provider);

  // Wait for next tick to ensure models list is updated
  await nextTick();

  // Find model - must match both provider and model name
  // The recommendation.modelName might be "ollama/gpt-oss:20b" format
  // We need to match against the actual model name which might be "gpt-oss:20b"
  const recommendedModelName = recommendation.modelName.toLowerCase();

  const model = llmStore.filteredModels.find((m) => {
    if (m.providerName !== provider.name) return false;

    const modelNameLower = m.modelName?.toLowerCase() || '';
    const modelDisplayNameLower = m.name?.toLowerCase() || '';

    // Debug log for each model checked

    // Try exact match first
    if (modelNameLower === recommendedModelName || modelDisplayNameLower === recommendedModelName) {
      return true;
    }

    // If recommendation includes provider prefix like "ollama/gpt-oss:20b", try without prefix
    const withoutPrefix = recommendedModelName.replace(`${provider.name?.toLowerCase() || ''}/`, '');
    if (modelNameLower === withoutPrefix || modelDisplayNameLower === withoutPrefix) {
      return true;
    }

    // Also try matching if one has :latest and the other doesn't
    const modelBase = modelNameLower.replace(':latest', '');
    const recBase = withoutPrefix.replace(':latest', '');
    if (modelBase === recBase) {
      return true;
    }

    return false;
  });

  if (!model) {
    console.error('❌ Model not found:', recommendation.modelName, 'for provider:', provider.name);
    return;
  }

  // Set model
  llmStore.setModel(model);

  // Note: Don't update user preferences here - that should only happen when
  // the user explicitly selects a model via the LLMSelectorModal.
  // This is just applying an agent recommendation, not a user preference change.

  // Verify the change happened
  nextTick(() => {
  });
};
const clearError = () => {
  conversationsStore.clearError();
};
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};
const messageHasDeliverable = (message: AgentChatMessage) => {
  return Boolean(message.deliverableId || message.metadata?.deliverableId);
};
// const getMessageDeliverable = (message: AgentChatMessage) => {
//   const deliverableId = message.deliverableId || message.metadata?.deliverableId;
//   return deliverableId ? deliverablesStore.getDeliverableById(deliverableId) : null;
// };
const selectDeliverable = async (deliverable: Deliverable | null) => {
  if (!deliverable) {
    return;
  }
  // Versions are already loaded by openExistingConversation, but load them if missing
  const versions = deliverablesStore.getDeliverableVersionsSync(deliverable.id);
  if (!versions || versions.length === 0) {
    try {
      const versionList = await deliverablesService.getVersionHistory(deliverable.id);
      versionList.forEach(v => {
        deliverablesStore.addVersion(deliverable.id, v);
      });
    } catch (error) {
      console.error('Failed to load deliverable versions:', error);
    }
  }

  // Parse content for the modal
  let content: HitlGeneratedContent | undefined;
  if (deliverable.currentVersion?.content) {
    try {
      content = JSON.parse(deliverable.currentVersion.content);
    } catch {
      content = { blogPost: deliverable.currentVersion.content };
    }
  }

  // Open DeliverablesModal
  selectedDeliverableId.value = deliverable.id;
  selectedDeliverable.value = deliverable;
  selectedDeliverableContent.value = content;
  showDeliverablesModal.value = true;
  showDeliverableSelector.value = false;
};

const handleDeliverableCreated = async (deliverable: Deliverable) => {
  // Ensure the deliverable belongs to the current conversation
  if (props.conversation?.id && deliverable.conversationId !== props.conversation.id) {
    return;
  }

  // Load versions for the newly created deliverable
  try {
    const versionList = await deliverablesService.getVersionHistory(deliverable.id);
    versionList.forEach(v => {
      deliverablesStore.addVersion(deliverable.id, v);
    });
  } catch (error) {
    console.error('❌ [handleDeliverableCreated] Error loading versions:', error);
  }

  // Parse content for the modal
  let content: HitlGeneratedContent | undefined;
  if (deliverable.currentVersion?.content) {
    try {
      content = JSON.parse(deliverable.currentVersion.content);
    } catch {
      // Content might be plain text
      content = { blogPost: deliverable.currentVersion.content };
    }
  }

  // Open DeliverablesModal to show the completed deliverable
  selectedDeliverableId.value = deliverable.id;
  selectedDeliverable.value = deliverable;
  selectedDeliverableContent.value = content;
  showDeliverablesModal.value = true;
};
const closeMergeModal = () => {
  showMergeModal.value = false;
  mergeDeliverable.value = null;
};
const handleMergeCompleted = () => {
  closeMergeModal();
};

const closeLLMRerunModal = () => {
  showLLMRerunModal.value = false;
  rerunDeliverableData.value = null;
};

const handleLLMExecute = async (llmConfig: LLMRunConfiguration) => {
  if (!rerunDeliverableData.value) {
    console.error('No rerun data available');
    return;
  }

  // Capture the rerun data before closing modal
  const capturedRerunData = { ...rerunDeliverableData.value } as RerunContext;

  // Close modal immediately to start conversation flow
  closeLLMRerunModal();

  // Execute the rerun with the provided config
  await executeRerunWithConfig(capturedRerunData, llmConfig);
};

// const canExecuteRerun = computed(() => {
//   return llmStore.selectedProvider && 
//          llmStore.selectedModel && 
//          rerunDeliverableData.value && 
//          rerunDeliverableData.value.version?.id;
// });

const executeRerunWithConfig = async (
  capturedRerunData: RerunContext,
  llmConfig: LLMRunConfiguration
) => {

  const plan = isPlanRerunContext(capturedRerunData) ? capturedRerunData.plan : null;
  const deliverable = 'deliverable' in capturedRerunData ? capturedRerunData.deliverable : null;
  const isDeliverable = Boolean(deliverable);
  const isPlan = Boolean(plan);

  // Use the user message that was captured when opening the modal
  const userPrompt = (capturedRerunData as { userMessage?: string }).userMessage || '';


  if (!userPrompt || userPrompt.trim() === '') {
    console.error('❌ [executeRerunWithConfig] User prompt is empty!');
    throw new Error('User message was not captured - cannot rerun without context');
  }

  try {
    // Set chat mode to converse to show proper UI state
    chatUiStore.setChatMode('converse');

    // Set loading state
    chatUiStore.setIsSendingMessage(true);

    // Create assistant message upfront (will be updated with deliverable when complete)
    // This matches the build flow pattern
    const rerunMessageId = `rerun-${Date.now()}`;
    const initialMessage: AgentChatMessage = {
      id: rerunMessageId,
      role: 'assistant',
      content: 'Regenerating...',
      timestamp: new Date(),
      metadata: {
        mode: isPlan ? 'plan' : 'build',
        isRerunRequest: true,
        originalVersionId: capturedRerunData.version.id,
        provider: llmConfig.provider,
        model: llmConfig.model,
      }
    };

    if (props.conversation) {
      conversationsStore.addMessage(props.conversation.id, initialMessage);
    }


    // Get agent slug from conversation (this is the reliable source)
    const agentSlug = props.conversation?.agentName || currentAgent.value?.slug;

    if (!agentSlug) {
      throw new Error('No agent slug available for rerun');
    }

    let result;
    if (isPlan) {
      // Call the rerunPlan action
      result = await rerunPlan(
        agentSlug,
        plan.conversationId,
        capturedRerunData.version.id,
        {
          provider: llmConfig.provider,
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        }
      );
    } else if (isDeliverable) {
      // Rerun deliverable - orchestrator gets context from store
      result = await rerunDeliverable(
        capturedRerunData.version.id,
        {
          provider: llmConfig.provider,
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        },
        userPrompt || undefined
      );
    }

    // Update the initial message with deliverable (matches initial build structure)
    const assistantContent = isDeliverable
      ? 'Deliverable created'
      : isPlan
      ? 'Plan created'
      : 'Created successfully';

    if (props.conversation) {
      // Update the message we created earlier
      conversationsStore.updateMessage(props.conversation.id, rerunMessageId, {
        content: assistantContent,
        ...(isPlan ? { planId: plan.id } : {}),
        ...(isDeliverable ? { deliverableId: deliverable.id } : {}),
        metadata: {
          mode: isPlan ? 'plan' : 'build',
          isCompleted: true,
          isRerunResponse: true,
          newVersionId: result.version.id,
          provider: llmConfig.provider,
          model: llmConfig.model,
          sourceVersionId: capturedRerunData.version.id,
          // Include usage/token data if available from response
          ...(result.version.metadata?.usage && { usage: result.version.metadata.usage }),
        }
      });
    }

    // For plans, the store is already updated by the rerunPlan action
    // The PlanDisplay component will automatically show the updated plan via Vue reactivity
    // No need to set activeWorkProduct - the plan is already displayed

  } catch (error) {
    console.error('Failed to rerun with different LLM:', error);

    // Create error message in conversation
    const errorMessage: AgentChatMessage = {
      id: `rerun-error-${Date.now()}`,
      role: 'assistant',
      content: `❌ Failed to regenerate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
      metadata: {
        isRerunError: true,
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    // Add error message to conversation
    if (props.conversation) {
      // Use store method instead of direct prop mutation
      conversationsStore.addMessage(props.conversation.id, errorMessage);
    }
  } finally {
    // Clear loading state
    chatUiStore.setIsSendingMessage(false);
  }
};

// HITL Modal Handlers (new modal-based HITL)
const handleHitlModalClose = () => {
  // When modal closes (approve/reject/replace), show processing message
  if (props.conversation && hitlData.value) {
    conversationsStore.addMessage(props.conversation.id, {
      id: `hitl-processing-${Date.now()}`,
      role: 'assistant',
      content: 'Finalizing your content... The approved content is being processed.',
      timestamp: new Date().toISOString(),
      metadata: {
        hitlProcessing: true,
        taskId: hitlData.value.taskId,
      },
    });
    scrollToBottom();
  }

  showHitlModal.value = false;
  hitlData.value = null;
};

/**
 * Handle HITL completed - per PRD, orchestrator already updated stores
 * This is just UI reaction: close modal, open deliverables modal
 */
const handleHitlCompleted = (deliverableId: string | undefined) => {
  // Close HITL modal
  showHitlModal.value = false;
  hitlData.value = null;
  scrollToBottom();

  // If there's a deliverable, open the DeliverablesModal
  // The orchestrator already fetched and added the deliverable to the store
  if (deliverableId && props.conversation) {
    const deliverable = deliverablesStore.getDeliverableById(deliverableId);
    if (deliverable) {
      handleDeliverableCreated(deliverable);
    }
  }
};

/**
 * Handle HITL regenerated - per PRD, just update local modal state
 * The modal stays open with new content
 */
const handleHitlRegenerated = (content: HitlGeneratedContent) => {
  // Update hitlData with new content so the modal can display it
  if (hitlData.value) {
    hitlData.value = {
      ...hitlData.value,
      generatedContent: content,
      currentVersionNumber: (hitlData.value.currentVersionNumber || 0) + 1,
    };
  }
};

// Deliverables Modal Handlers
const handleDeliverablesModalClose = () => {
  showDeliverablesModal.value = false;
  selectedDeliverableId.value = null;
  selectedDeliverable.value = null;
  selectedDeliverableContent.value = undefined;
};

const handleDeliverableEdit = (deliverableId: string, _versionId: string) => {
  // For now, just close the modal - edit functionality can be implemented later
  console.log('Edit requested for deliverable:', deliverableId);
  handleDeliverablesModalClose();
};

const handleDeliverableRerun = (deliverableId: string, versionId: string) => {
  // Rerun with current LLM settings (no modal)
  const deliverable = deliverablesStore.getDeliverableById(deliverableId);
  const version = deliverablesStore.getDeliverableVersionsSync(deliverableId)?.find(v => v.id === versionId);
  if (deliverable && version) {
    // TODO: Implement direct rerun with current LLM
    console.log('Rerun deliverable:', deliverableId, 'version:', versionId);
  }
  handleDeliverablesModalClose();
};

const handleDeliverableRerunWithDifferentLlm = (deliverableId: string, versionId: string, version?: DeliverableVersion) => {
  console.log('ConversationView: handleDeliverableRerunWithDifferentLlm called', { deliverableId, versionId, hasVersion: !!version });
  // Open the LLM reselector modal for rerun with different LLM
  const deliverable = deliverablesStore.getDeliverableById(deliverableId);
  // Use version from emit if provided, otherwise try to find in store
  const resolvedVersion = version || deliverablesStore.getDeliverableVersionsSync(deliverableId)?.find(v => v.id === versionId);
  console.log('ConversationView: deliverable found:', !!deliverable, 'version found:', !!resolvedVersion);
  if (deliverable && resolvedVersion) {
    // Get the last user message for the rerun context
    let userMessage = '';
    const allMessages = messages.value;
    if (allMessages && allMessages.length > 0) {
      const userMessages = allMessages.filter(msg =>
        msg.role === 'user' && !msg.metadata?.isRerunRequest
      );
      if (userMessages.length > 0) {
        userMessage = userMessages[userMessages.length - 1].content;
      }
    }

    rerunDeliverableData.value = { deliverable, version: resolvedVersion, userMessage };
    showLLMRerunModal.value = true;
  }
  // Keep deliverables modal open so user can see the new version after rerun completes
  // handleDeliverablesModalClose();
};

onMounted(() => {
  // Auto-scroll to bottom on mount
  scrollToBottom();
});
onUnmounted(() => {
  // Cleanup if needed
});
watch(
  () => currentAgentIdentifier.value,
  (agentName) => {
    if (!agentName) {
      return;
    }

    const existing = llmStore.getRecommendationsForAgent(agentName);
    if (!existing.length && !llmStore.isAgentRecommendationsLoading) {
      llmStore.fetchAgentRecommendations(agentName, 3);
    }
  },
  { immediate: true },
);

// Watch for media agent selection and update model type filter accordingly
watch(
  () => currentAgent.value,
  async (agent) => {
    if (!agent) return;

    // Check if this is a media agent (type: 'media')
    const agentType = agent.type || (agent.metadata?.agent_type);

    if (agentType === 'media') {
      // Get media type from agent metadata to determine model_type filter
      const mediaType = agent.metadata?.mediaType;
      const defaultProvider = agent.metadata?.defaultProvider;
      const defaultModel = agent.metadata?.defaultModel;

      // Map media type to model type
      let modelType: 'text-generation' | 'image-generation' | 'video-generation' = 'image-generation';
      if (mediaType === 'video') {
        modelType = 'video-generation';
      } else if (mediaType === 'image') {
        modelType = 'image-generation';
      }

      console.log(`🎨 [MEDIA-AGENT] Detected media agent: ${agent.name}, mediaType: ${mediaType}, modelType: ${modelType}`);
      console.log(`🎨 [MEDIA-AGENT] Default provider: ${defaultProvider}, model: ${defaultModel}`);

      // Update LLM store to filter by media model type and set default model
      await llmStore.setModelTypeForAgent(modelType, defaultProvider, defaultModel);
    } else if (llmStore.selectedModelType !== 'text-generation') {
      // If switching from a media agent to a non-media agent, reset to text generation
      await llmStore.setModelType('text-generation');
    }
  },
  { immediate: true },
);

// Watch for new messages and scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});
// Watch for conversation changes and load deliverables/plans
watch(() => props.conversation?.id, async (newId) => {
  if (newId && authStore.isAuthenticated) {
    // Set chat mode to 'converse' for new conversations if it's an allowed mode
    if (props.conversation?.allowedChatModes?.includes('converse' as AgentChatMode)) {
      chatUiStore.setChatMode('converse');
    }

    // Load plan for this conversation
    const conversationPlans = planStore.plansByConversationId(newId);
    if (conversationPlans.length === 0) {
      try {
        await planStore.loadPlansByConversation(newId);
      } catch (error) {
        console.error('Error loading plan:', error);
      }
    }

    // Load deliverables for this conversation
    let conversationDeliverables = deliverablesStore.getDeliverablesByConversation(newId);
    if (!conversationDeliverables || conversationDeliverables.length === 0) {
      try {
        const loadedDeliverables = await deliverablesService.getConversationDeliverables(newId);
        loadedDeliverables.forEach(d => {
          deliverablesStore.addDeliverable(d);
        });
        conversationDeliverables = loadedDeliverables;
      } catch (error) {
        console.error('Error loading deliverables:', error);
      }
    }

    // Auto-open deliverables modal if conversation has deliverables
    if (conversationDeliverables && conversationDeliverables.length > 0) {
      const firstDeliverable = conversationDeliverables[0];
      selectedDeliverableId.value = firstDeliverable.id;
      selectedDeliverable.value = firstDeliverable;
      showDeliverablesModal.value = true;
    }
  }
}, { immediate: true });
// Watch for authentication state changes and load deliverables when user logs in
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated && props.conversation?.id) {
    const deliverablesList = await deliverablesService.getConversationDeliverables(props.conversation.id);
    deliverablesList.forEach(d => {
      deliverablesStore.addDeliverable(d);
    });
  }
});

</script>
<style scoped>
.conversation-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-color-step-50);
}
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: white;
}
.conversation-info h2 {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
}
.agent-name {
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.conversation-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.conversation-pane {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}
.current-model-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.model-label {
  font-weight: 600;
  color: var(--ion-color-medium);
}

.agent-llm-suggestions {
  margin: 12px 16px 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}
.agent-llm-suggestions__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
}
.agent-llm-suggestions__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.agent-llm-suggestions__chip {
  cursor: pointer;
  --background: rgba(255, 255, 255, 0.94);
  --color: var(--ion-color-dark);
  font-size: 0.85rem;
  font-weight: 500;
}
.agent-llm-suggestions__chip:hover {
  --background: var(--ion-color-light);
  --color: var(--ion-color-dark);
  font-weight: 600;
}
.agent-llm-suggestions__chip .chip-provider {
  font-weight: 600;
}
.agent-llm-suggestions__chip .chip-divider {
  margin: 0 4px;
  opacity: 0.6;
}
.agent-llm-suggestions__chip .chip-rating {
  margin-left: 6px;
  font-weight: 600;
  color: var(--ion-color-primary);
}
.agent-llm-suggestions__empty,
.agent-llm-suggestions__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}
.agent-llm-suggestions__error {
  color: var(--ion-color-danger);
}
.message-wrapper {
  margin-bottom: 16px;
}
.message-wrapper.has-deliverable {
  position: relative;
}

/* Simple message bubbles for converse mode */
.simple-message-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  max-width: 80%;
  word-wrap: break-word;
}

.simple-message-bubble.user {
  background: var(--ion-color-primary);
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.simple-message-bubble.assistant {
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.simple-message-bubble .message-content {
  font-size: 15px;
  line-height: 1.5;
}

.simple-message-bubble .message-timestamp {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}

/* Sub-agent attribution badge (Orchestrator V2) */
.simple-message-bubble .attribution-badge {
  font-size: 10px;
  opacity: 0.6;
  margin-top: 6px;
  padding: 3px 8px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  border-radius: 4px;
  display: inline-block;
  color: var(--ion-color-primary-shade);
  font-weight: 500;
}

.simple-message-bubble.user .attribution-badge {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

html[data-theme="dark"] .simple-message-bubble .attribution-badge {
  background: rgba(var(--ion-color-primary-rgb), 0.15);
  color: var(--ion-color-primary-tint);
}

html[data-theme="dark"] .simple-message-bubble.user .attribution-badge {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.85);
}
.input-area {
  border-top: 1px solid var(--ion-color-light);
  background: white;
  padding: 0;
}
.input-area ion-item {
  --border-width: 0;
  --inner-border-width: 0;
}
.input-area ion-textarea {
  --padding-top: 12px;
  --padding-bottom: 12px;
}
.action-buttons {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--ion-color-step-50);
  border-top: 1px solid var(--ion-color-light-shade);
  justify-content: flex-start;
}
.action-buttons ion-button {
  flex: 0 1 auto;
  min-width: 120px;
}
.llm-controls {
  padding: 8px 16px;
  background: var(--ion-color-step-50);
  border-top: 1px solid var(--ion-color-light-shade);
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--ion-color-step-100);
  border-top: 1px solid var(--ion-color-light);
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
  text-align: center;
  color: var(--ion-color-medium);
}
.error-state {
  color: var(--ion-color-danger);
}
.empty-state {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 40px 20px;
}
.empty-state ion-icon {
  margin-bottom: 16px;
}
.empty-state h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}
.empty-state p {
  margin: 0;
  line-height: 1.5;
}
/* Custom UI not found fallback */
.custom-ui-not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium);
  font-size: 0.9em;
}
/* Prominent thinking indicator */
.prominent-thinking-indicator {
  margin-bottom: 16px;
  padding: 0 16px;
}
.thinking-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.thinking-avatar {
  width: 32px;
  height: 32px;
  background-color: var(--ion-color-medium-tint);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.thinking-bubble {
  background: var(--ion-color-light-shade);
  padding: 12px 16px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  flex: 1;
  max-width: 300px;
}
.thinking-text {
  margin-bottom: 8px;
}
.agent-thinking-name {
  font-size: 0.8em;
  font-weight: bold;
  color: var(--ion-color-medium-shade);
  margin-bottom: 2px;
}
.thinking-message {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  font-style: italic;
}
.thinking-dots {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}
.dot {
  width: 6px;
  height: 6px;
  background-color: var(--ion-color-medium);
  border-radius: 50%;
  animation: thinking-pulse 1.4s infinite ease-in-out;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }
@keyframes thinking-pulse {
  0%, 80%, 100% { 
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% { 
    transform: scale(1);
    opacity: 1;
  }
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .conversation-view {
    background: #1a1a1a;
  }
  .conversation-header {
    background: #2d3748;
    border-color: #4a5568;
    color: #f7fafc;
  }
  .conversation-info h2 {
    color: #f7fafc;
  }
  .agent-name {
    color: #a0aec0;
  }
  .conversation-pane {
    background: #1f2937;
  }
  .messages-container {
    background: #1f2937;
  }
  .input-area {
    background: #2d3748;
    border-color: #4a5568;
  }
  .thinking-indicator {
    background: #374151;
    border-color: #4b5563;
  }
  .agent-thinking-name {
    color: #d1d5db;
  }
  .thinking-message {
    color: #9ca3af;
  }
  .dot {
    background-color: #6b7280;
  }
}
/* Manual dark theme toggle support */
html[data-theme="dark"] .conversation-view {
  background: #1a1a1a;
}
html[data-theme="dark"] .conversation-header {
  background: #2d3748;
  border-color: #4a5568;
  color: #f7fafc;
}
html[data-theme="dark"] .conversation-info h2 {
  color: #f7fafc;
}
html[data-theme="dark"] .agent-name {
  color: #a0aec0;
}
html[data-theme="dark"] .conversation-pane {
  background: #1f2937;
}
html[data-theme="dark"] .messages-container {
  background: #1f2937;
}
html[data-theme="dark"] .agent-llm-suggestions {
  background: rgba(45, 55, 72, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
html[data-theme="dark"] .agent-llm-suggestions__header {
  color: #e2e8f0;
}
html[data-theme="dark"] .agent-llm-suggestions__chip {
  --background: rgba(55, 65, 81, 0.9);
  --color: #e2e8f0;
}
html[data-theme="dark"] .agent-llm-suggestions__chip .chip-rating {
  color: var(--ion-color-primary-tint);
}
html[data-theme="dark"] .agent-llm-suggestions__empty,
html[data-theme="dark"] .agent-llm-suggestions__error {
  color: #a0aec0;
}
html[data-theme="dark"] .input-area {
  background: #2d3748;
  border-color: #4a5568;
}
html[data-theme="dark"] .thinking-indicator {
  background: #374151;
  border-color: #4b5563;
}
html[data-theme="dark"] .agent-thinking-name {
  color: #d1d5db;
}
html[data-theme="dark"] .thinking-message {
  color: #9ca3af;
}
html[data-theme="dark"] .dot {
  background-color: #6b7280;
}

/* Sovereign Mode Styles */
.sovereign-conversation-banner {
  margin: 1rem;
  margin-bottom: 0.5rem;
}

.conversation-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.conversation-info h2 {
  margin: 0;
  flex-shrink: 0;
}

.agent-name {
  flex-shrink: 0;
}

/* Responsive adjustments for sovereign mode */
@media (max-width: 768px) {
  .sovereign-conversation-banner {
    margin: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .conversation-info {
    gap: 0.5rem;
  }
}

/* LLM Rerun Modal Styles */
.llm-rerun-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rerun-info h3 {
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
  font-size: 1.2em;
  font-weight: 600;
}

.rerun-info p {
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--ion-color-light);
}

.modal-footer {
  position: sticky;
  bottom: 0;
  background: var(--ion-color-step-50, #ffffff);
  border-top: 1px solid var(--ion-color-light);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.llm-selector-wrapper {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: 20px;
}

html[data-theme="dark"] .rerun-info h3 {
  color: #f7fafc;
}

html[data-theme="dark"] .rerun-info p {
  color: #a0aec0;
}

html[data-theme="dark"] .modal-actions {
  border-color: #4a5568;
}

html[data-theme="dark"] .modal-footer {
  background: var(--ion-color-step-100, #1a1a1a);
  border-color: #4a5568;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}
</style>
