<template>
  <div class="legal-department-conversation">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <ion-spinner name="crescent" />
      <p>Initializing Legal Department AI...</p>
    </div>

    <!-- Main Conversation Pane -->
    <template v-else>
      <!-- Scrollable Response Area -->
      <div class="response-area" ref="responseAreaRef">
        <!-- Welcome State (no request yet) -->
        <div v-if="!hasActiveRequest && !analysisResults" class="welcome-state">
          <div class="welcome-content">
            <ion-icon :icon="scaleOutline" class="welcome-icon" />
            <h2>Legal Department AI</h2>
            <p>Upload a document or ask a legal question to get started.</p>
            <div class="capabilities">
              <div class="capability">
                <ion-icon :icon="documentTextOutline" />
                <span>Contract Analysis</span>
              </div>
              <div class="capability">
                <ion-icon :icon="shieldCheckmarkOutline" />
                <span>Compliance Review</span>
              </div>
              <div class="capability">
                <ion-icon :icon="bulbOutline" />
                <span>IP Assessment</span>
              </div>
              <div class="capability">
                <ion-icon :icon="lockClosedOutline" />
                <span>Privacy Analysis</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Analysis Content -->
        <template v-if="hasActiveRequest || analysisResults">
          <!-- User Request Display -->
          <div v-if="currentRequest" class="request-display">
            <div class="request-header">
              <ion-icon :icon="personCircleOutline" />
              <span>Your Request</span>
            </div>
            <p class="request-message">{{ currentRequest.message }}</p>
            <div v-if="currentRequest.attachedDocument" class="request-attachment">
              <ion-icon :icon="documentAttachOutline" />
              <span>{{ currentRequest.attachedDocument.name }}</span>
            </div>
          </div>

          <!-- Processing Indicator (when no results yet) -->
          <div v-if="isProcessing && !analysisResults" class="processing-indicator">
            <div class="thinking-content">
              <div class="thinking-avatar">
                <ion-spinner name="dots" color="primary" />
              </div>
              <div class="thinking-bubble">
                <div class="thinking-text">
                  <div class="agent-thinking-name">Legal Department AI</div>
                  <div class="thinking-message">{{ thinkingMessage }}</div>
                </div>
                <div class="thinking-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
            </div>
            <div class="progress-section">
              <p class="progress-step">{{ currentStep || 'Processing...' }}</p>
              <ion-progress-bar :value="analysisProgress.percentage / 100" />
            </div>
          </div>

          <!-- Text-Only Response (for queries without document analysis) -->
          <div v-if="isTextOnlyResponse && analysisResults && !isProcessing" class="text-response-panel">
            <div class="response-header">
              <ion-icon :icon="chatbubbleOutline" />
              <span>Legal Department AI Response</span>
            </div>
            <div class="response-content">
              {{ analysisResults.summary }}
            </div>
            <div class="response-hint">
              <ion-icon :icon="informationCircleOutline" />
              <span>Upload a document for detailed specialist analysis</span>
            </div>
          </div>

          <!-- Full Document Analysis View -->
          <template v-if="!isTextOnlyResponse">
            <!-- Routing Visualization -->
            <RoutingVisualization
              v-if="routingDecision"
              :routing-decision="routingDecision"
              :specialist-states="specialistStates"
              @specialist-click="handleSpecialistClick"
            />

            <!-- Specialist Tabs (when we have outputs) -->
            <SpecialistTabs
              v-if="hasSpecialistOutputs"
              :specialist-outputs="analysisResults?.specialistOutputs"
              :routing-decision="routingDecision"
              :specialist-statuses="getSpecialistStatuses()"
            />

            <!-- Synthesis Panel (when analysis complete) -->
            <SynthesisPanel
              v-if="analysisResults && !isProcessing"
              :results="analysisResults"
              :specialist-outputs="analysisResults?.specialistOutputs"
            />
          </template>

          <!-- HITL Controls (when analysis complete - show for both text and document) -->
          <HITLControls
            v-if="analysisResults && !isProcessing"
            :disabled="hitlActionTaken"
            :show-export="!isTextOnlyResponse"
            @action="handleHITLAction"
            @export="handleExport"
          />
        </template>

        <!-- Error Display -->
        <div v-if="error" class="error-display">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <p>{{ error }}</p>
          <ion-button size="small" @click="handleRetry">Retry</ion-button>
        </div>
      </div>

      <!-- Fixed Request Input at Bottom -->
      <RequestInput
        :disabled="isProcessing"
        :placeholder="inputPlaceholder"
        :conversation-id="currentConversationId"
        @submit="handleRequestSubmit"
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonSpinner, IonIcon, IonButton, IonProgressBar } from '@ionic/vue';
import {
  alertCircleOutline,
  scaleOutline,
  documentTextOutline,
  shieldCheckmarkOutline,
  bulbOutline,
  lockClosedOutline,
  personCircleOutline,
  documentAttachOutline,
  chatbubbleOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { useRbacStore } from '@/stores/rbacStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { legalDepartmentService } from './legalDepartmentService';
import agent2AgentConversationsService from '@/services/agent2AgentConversationsService';
import { apiService } from '@/services/apiService';
import { deliverablesService, DeliverableType, DeliverableFormat } from '@/services/deliverablesService';
import RequestInput from './components/RequestInput.vue';
import RoutingVisualization from './components/RoutingVisualization.vue';
import SpecialistTabs from './components/SpecialistTabs.vue';
import SynthesisPanel from './components/SynthesisPanel.vue';
import HITLControls from './components/HITLControls.vue';
import type {
  AnalysisPhase,
  AnalysisResults,
  AnalysisTaskResponse,
  RoutingDecision,
  SpecialistType,
  SpecialistStatus,
  SpecialistState,
  HITLAction,
  ConversationRequest,
} from './legalDepartmentTypes';

// Props
const props = defineProps<{
  conversationId?: string;
}>();

// Router
const route = useRoute();

// Stores
const executionContextStore = useExecutionContextStore();
const rbacStore = useRbacStore();
const chatUiStore = useChatUiStore();

// Refs
const responseAreaRef = ref<HTMLElement | null>(null);

// State
const isLoading = ref(false);
const isProcessing = ref(false);
const error = ref<string | null>(null);
const currentRequest = ref<ConversationRequest | null>(null);
const routingDecision = ref<RoutingDecision | null>(null);
const specialistStates = ref<Record<SpecialistType, SpecialistState>>({} as Record<SpecialistType, SpecialistState>);
const analysisPhase = ref<AnalysisPhase>('initializing');
const analysisProgress = ref({ current: 0, total: 100, percentage: 0 });
const currentStep = ref<string | undefined>();
const analysisResults = ref<AnalysisResults | null>(null);
const hitlActionTaken = ref(false);

// Computed
const hasActiveRequest = computed(() => !!currentRequest.value);

const hasSpecialistOutputs = computed(() => {
  if (!analysisResults.value?.specialistOutputs) return false;
  return Object.keys(analysisResults.value.specialistOutputs).length > 0;
});

const isTextOnlyResponse = computed(() => {
  const result = analysisResults.value as (AnalysisResults & { isTextOnlyResponse?: boolean }) | null;
  return result?.isTextOnlyResponse === true || (
    analysisResults.value &&
    !hasSpecialistOutputs.value &&
    !routingDecision.value &&
    analysisResults.value.findings.length === 0
  );
});

const inputPlaceholder = computed(() => {
  if (isProcessing.value) return 'Analysis in progress...';
  if (analysisResults.value) return 'Ask a follow-up question...';
  return 'Ask a legal question or describe the document to analyze...';
});

// Contextual thinking message based on mode and analysis phase
const thinkingMessage = computed(() => {
  const mode = (chatUiStore.chatMode || 'converse').toLowerCase();
  const phase = analysisPhase.value;

  // Phase-specific messages
  if (phase === 'uploading') return 'Reviewing your document...';
  if (phase === 'extracting') return 'Extracting key information...';
  if (phase === 'analyzing') return 'Analyzing legal content...';
  if (phase === 'identifying_risks') return 'Identifying potential risks...';
  if (phase === 'generating_recommendations') return 'Preparing recommendations...';

  // Mode-specific fallbacks
  if (mode === 'converse') return 'Reviewing your question...';
  if (mode === 'plan') return 'Drafting a legal strategy...';
  if (mode === 'build') return 'Preparing your deliverable...';

  return 'Processing your request...';
});

const currentConversationId = computed(() => {
  return executionContextStore.conversationId || '';
});

// Lifecycle
onMounted(async () => {
  await initializeConversation();
});

// Watch for route query changes to handle new conversation requests
watch(
  () => route.query.conversationId,
  async (newConversationId, oldConversationId) => {
    if (newConversationId && newConversationId !== oldConversationId) {
      console.log('[LegalDepartment] Route conversationId changed:', { old: oldConversationId, new: newConversationId });
      resetState();
      await initializeConversation();
    }
  }
);

// Methods
function resetState() {
  // Reset all state for a fresh conversation
  isProcessing.value = false;
  error.value = null;
  currentRequest.value = null;
  routingDecision.value = null;
  specialistStates.value = {} as Record<SpecialistType, SpecialistState>;
  analysisPhase.value = 'initializing';
  analysisProgress.value = { current: 0, total: 100, percentage: 0 };
  currentStep.value = undefined;
  analysisResults.value = null;
  hitlActionTaken.value = false;
  console.log('[LegalDepartment] State reset for new conversation');
}

/**
 * Save analysis results as a deliverable for persistence
 */
async function saveAnalysisDeliverable() {
  if (!analysisResults.value || !currentConversationId.value) {
    console.log('[LegalDepartment] No results or conversation ID to save');
    return;
  }

  try {
    // Build the state to persist
    const persistedState = {
      analysisResults: analysisResults.value,
      routingDecision: routingDecision.value,
      currentRequest: currentRequest.value,
      specialistStates: specialistStates.value,
    };

    // Create a title from the request
    const title = currentRequest.value?.attachedDocument?.name
      ? `Legal Analysis - ${currentRequest.value.attachedDocument.name}`
      : `Legal Analysis - ${new Date().toLocaleDateString()}`;

    await deliverablesService.createDeliverable({
      title,
      description: analysisResults.value.summary || 'Legal Department AI analysis',
      type: DeliverableType.ANALYSIS,
      conversationId: currentConversationId.value,
      initialContent: JSON.stringify(persistedState),
      initialFormat: DeliverableFormat.JSON,
    });

    console.log('[LegalDepartment] Analysis saved as deliverable');
  } catch (err) {
    // Don't fail the whole flow if save fails - just log it
    console.error('[LegalDepartment] Failed to save deliverable:', err);
  }
}

/**
 * Load existing analysis from deliverables for this conversation
 */
async function loadExistingAnalysis(conversationId: string): Promise<boolean> {
  try {
    const deliverables = await deliverablesService.getConversationDeliverables(conversationId);

    // Find the most recent analysis deliverable
    const analysisDeliverable = deliverables
      .filter(d => d.type === DeliverableType.ANALYSIS)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!analysisDeliverable?.currentVersion?.content) {
      console.log('[LegalDepartment] No existing analysis found for conversation');
      return false;
    }

    // Parse and restore the state
    const persistedState = JSON.parse(analysisDeliverable.currentVersion.content);

    if (persistedState.analysisResults) {
      analysisResults.value = persistedState.analysisResults;
    }
    if (persistedState.routingDecision) {
      routingDecision.value = persistedState.routingDecision;
      updateSpecialistStates(persistedState.routingDecision);
    }
    if (persistedState.currentRequest) {
      currentRequest.value = persistedState.currentRequest;
    }
    if (persistedState.specialistStates) {
      specialistStates.value = persistedState.specialistStates;
    }

    // Mark as completed since we're loading existing results
    analysisPhase.value = 'completed';

    console.log('[LegalDepartment] Restored analysis from deliverable');
    return true;
  } catch (err) {
    console.error('[LegalDepartment] Failed to load existing analysis:', err);
    return false;
  }
}

async function initializeConversation() {
  isLoading.value = true;
  error.value = null;

  try {
    const orgSlug = rbacStore.currentOrganization || 'demo-org';
    const userId = rbacStore.user?.id || 'demo-user';

    // Check route query first, then props, then create new
    let conversationIdToUse = (route.query.conversationId as string) || props.conversationId;
    const isExistingConversation = !!conversationIdToUse;

    if (!conversationIdToUse) {
      conversationIdToUse = crypto.randomUUID();
      await agent2AgentConversationsService.createConversation({
        agentName: 'legal-department',
        agentType: 'api',
        organizationSlug: orgSlug,
        conversationId: conversationIdToUse,
        metadata: {
          source: 'legal-department-ui',
          contentType: 'legal-analysis',
        },
      });
    }

    executionContextStore.initialize({
      orgSlug,
      userId,
      conversationId: conversationIdToUse,
      agentSlug: 'legal-department',
      agentType: 'api',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    console.log('[LegalDepartment] Initialized:', executionContextStore.current);

    // If this is an existing conversation, try to load previous analysis
    if (isExistingConversation) {
      await loadExistingAnalysis(conversationIdToUse);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to initialize';
    console.error('[LegalDepartment] Initialization failed:', err);
  } finally {
    isLoading.value = false;
  }
}

async function handleRequestSubmit(data: {
  message: string;
  file?: File;
  options: {
    extractKeyTerms: boolean;
    identifyRisks: boolean;
    generateRecommendations: boolean;
  };
}) {
  console.log('[LegalDepartment] Submit request');
  error.value = null;
  isProcessing.value = true;
  hitlActionTaken.value = false;
  analysisResults.value = null;

  // Create request object
  currentRequest.value = {
    id: crypto.randomUUID(),
    message: data.message,
    attachedDocument: data.file ? {
      file: data.file,
      name: data.file.name,
      size: data.file.size,
      type: data.file.type,
    } : undefined,
    timestamp: new Date().toISOString(),
  };

  // Scroll to show response area
  await nextTick();
  scrollToBottom();

  try {
    if (data.file) {
      // Document analysis flow
      await processDocumentAnalysis(data.file, data.options);
    } else {
      // Text-only query flow (future: route to appropriate specialist)
      await processTextQuery(data.message);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[LegalDepartment] Request failed:', err);
  } finally {
    isProcessing.value = false;
    scrollToBottom();

    // Save results as deliverable if analysis completed successfully
    if (analysisResults.value && !error.value) {
      await saveAnalysisDeliverable();
    }
  }
}

async function processDocumentAnalysis(
  file: File,
  options: { extractKeyTerms: boolean; identifyRisks: boolean; generateRecommendations: boolean }
) {
  // Set initial phase
  analysisPhase.value = 'uploading';
  currentStep.value = 'Uploading document...';
  analysisProgress.value = { current: 10, total: 100, percentage: 10 };

  // Call service
  const result = await legalDepartmentService.uploadAndAnalyze(file, options);

  console.log('[LegalDepartment] Analysis result:', result);

  // Extract routing decision
  if (result.analysisResults) {
    // Update routing from result
    const routingData = (result as { routingDecision?: RoutingDecision }).routingDecision;
    if (routingData) {
      routingDecision.value = routingData;
      updateSpecialistStates(routingData);
    } else {
      // Infer routing from specialist outputs
      inferRoutingFromResults(result.analysisResults);
    }

    // Brief progress animation
    analysisPhase.value = 'analyzing';
    currentStep.value = 'Processing with specialists...';
    analysisProgress.value = { current: 50, total: 100, percentage: 50 };

    await new Promise(resolve => setTimeout(resolve, 500));

    // Complete
    analysisPhase.value = 'completed';
    currentStep.value = 'Analysis complete';
    analysisProgress.value = { current: 100, total: 100, percentage: 100 };

    analysisResults.value = result.analysisResults;

    // Mark all specialists as completed
    if (routingDecision.value) {
      markSpecialistsCompleted();
    }
  } else {
    // No immediate results - simulate progress
    await simulateAnalysisProgress();
  }
}

async function processTextQuery(message: string) {
  // For text-only queries without documents
  analysisPhase.value = 'analyzing';
  currentStep.value = 'Processing your legal question...';
  analysisProgress.value = { current: 20, total: 100, percentage: 20 };

  try {
    // Call the backend with text-only query
    const result = await legalDepartmentService.sendTextQuery(message);

    console.log('[LegalDepartment] Text query response:', result);

    // Update progress
    analysisProgress.value = { current: 60, total: 100, percentage: 60 };
    currentStep.value = 'Generating response...';

    // Extract routing decision if available
    if (result.routingDecision) {
      routingDecision.value = {
        specialist: (result.routingDecision.specialist as SpecialistType) || 'unknown',
        confidence: 0.85,
        reasoning: result.routingDecision.reasoning || 'Routed based on query content.',
        categories: ['text-query'],
        multiAgent: result.routingDecision.multiAgent,
      };
      updateSpecialistStates(routingDecision.value);
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    // Update progress
    analysisProgress.value = { current: 90, total: 100, percentage: 90 };
    currentStep.value = 'Finalizing response...';

    // If we have analysis results with specialist outputs, use them
    if (result.analysisResults && result.analysisResults.specialistOutputs) {
      analysisResults.value = result.analysisResults;

      // Infer routing from results if not already set
      if (!routingDecision.value) {
        inferRoutingFromResults(result.analysisResults);
      }
    } else {
      // For text-only queries without specialist analysis,
      // create a minimal result object with the conversational response
      const responseText = extractResponseText(result);
      if (responseText) {
        analysisResults.value = {
          taskId: result.taskId,
          documentId: result.taskId,
          documentName: 'Text Query',
          summary: responseText,
          findings: [],
          risks: [],
          recommendations: [],
          metadata: {
            analyzedAt: new Date().toISOString(),
            confidence: 0.9,
            model: 'claude-sonnet-4-20250514',
          },
          // Mark as text-only response (no specialist analysis)
          isTextOnlyResponse: true,
        } as AnalysisResults & { isTextOnlyResponse?: boolean };
      }
    }

    // Complete
    analysisPhase.value = 'completed';
    currentStep.value = 'Response complete';
    analysisProgress.value = { current: 100, total: 100, percentage: 100 };

    // Mark specialists as completed if we have any
    if (routingDecision.value) {
      markSpecialistsCompleted();
    }

  } catch (err) {
    console.error('[LegalDepartment] Text query failed:', err);
    error.value = err instanceof Error ? err.message : 'Failed to process your question. Please try again.';
    analysisPhase.value = 'idle';
    currentRequest.value = null;
  }
}

/**
 * Extract response text from various response formats
 */
function extractResponseText(result: AnalysisTaskResponse & { analysisResults?: AnalysisResults; response?: string }): string {
  // Check for direct response field (added by service for text queries)
  if (typeof result.response === 'string' && result.response) {
    return result.response;
  }
  // Try analysis results summary
  if (result.analysisResults?.summary) {
    return result.analysisResults.summary;
  }
  // The response might be in the raw result data
  const anyResult = result as Record<string, unknown>;
  if (anyResult.result && typeof (anyResult.result as Record<string, unknown>).response === 'string') {
    return (anyResult.result as Record<string, unknown>).response as string;
  }
  return '';
}

function inferRoutingFromResults(results: AnalysisResults) {
  if (!results.specialistOutputs) return;

  const specialists = Object.keys(results.specialistOutputs) as SpecialistType[];
  if (specialists.length === 0) return;

  routingDecision.value = {
    specialist: specialists[0],
    specialists: specialists.length > 1 ? specialists : undefined,
    confidence: 0.85,
    reasoning: `Routed to ${specialists.join(', ')} based on document content.`,
    categories: ['inferred'],
    multiAgent: specialists.length > 1,
  };

  updateSpecialistStates(routingDecision.value);
}

function updateSpecialistStates(routing: RoutingDecision) {
  const states: Record<SpecialistType, SpecialistState> = {} as Record<SpecialistType, SpecialistState>;
  const names: Record<SpecialistType, string> = {
    contract: 'Contract',
    compliance: 'Compliance',
    ip: 'IP',
    privacy: 'Privacy',
    employment: 'Employment',
    corporate: 'Corporate',
    litigation: 'Litigation',
    real_estate: 'Real Estate',
    unknown: 'Unknown',
  };

  const activeSpecialists = routing.multiAgent && routing.specialists
    ? routing.specialists
    : [routing.specialist];

  for (const slug of activeSpecialists) {
    states[slug] = {
      slug,
      name: names[slug] || slug,
      status: 'running',
    };
  }

  specialistStates.value = states;
}

function markSpecialistsCompleted() {
  for (const slug of Object.keys(specialistStates.value) as SpecialistType[]) {
    specialistStates.value[slug] = {
      ...specialistStates.value[slug],
      status: 'completed',
    };
  }
}

function getSpecialistStatuses(): Record<string, SpecialistStatus> {
  const statuses: Record<string, SpecialistStatus> = {};
  for (const [slug, state] of Object.entries(specialistStates.value)) {
    statuses[slug] = state.status;
  }
  return statuses;
}

async function simulateAnalysisProgress() {
  // No longer uses mock data - just shows progress animation
  // Real results come from the backend
  const phases: AnalysisPhase[] = [
    'extracting',
    'analyzing',
    'identifying_risks',
    'generating_recommendations',
    'completed',
  ];

  for (let i = 0; i < phases.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    analysisPhase.value = phases[i];
    analysisProgress.value = {
      current: (i + 1) * 20,
      total: 100,
      percentage: (i + 1) * 20,
    };
    currentStep.value = getPhaseDescription(phases[i]);
  }

  // If we reach here without results, show error
  if (!analysisResults.value) {
    error.value = 'Analysis completed but no results were returned from the backend.';
  }
}

function getPhaseDescription(phase: AnalysisPhase): string {
  const descriptions: Record<AnalysisPhase, string> = {
    initializing: 'Preparing document for analysis',
    uploading: 'Uploading document...',
    extracting: 'Extracting text and structure...',
    analyzing: 'Analyzing legal content...',
    identifying_risks: 'Identifying potential risks...',
    generating_recommendations: 'Generating recommendations...',
    completed: 'Analysis complete',
    failed: 'Analysis failed',
  };
  return descriptions[phase] || 'Processing...';
}

// Mock data removed - all results come from backend

function handleSpecialistClick(specialist: SpecialistType) {
  console.log('[LegalDepartment] Specialist clicked:', specialist);
  // Could scroll to specialist tab or highlight it
}

async function handleHITLAction(action: HITLAction, comment?: string) {
  console.log('[LegalDepartment] HITL action:', action, comment);

  // Immediately mark as taken to disable buttons
  hitlActionTaken.value = true;

  // Record the decision to the backend
  try {
    const taskId = analysisResults.value?.taskId || currentRequest.value?.taskId || 'unknown';
    const result = await legalDepartmentService.recordHITLDecision(taskId, action, comment);
    console.log('[LegalDepartment] HITL decision recorded:', result);

    // Show confirmation to user (could use toast notification)
    if (result.message) {
      console.log('[LegalDepartment]', result.message);
    }
  } catch (err) {
    console.error('[LegalDepartment] Error recording HITL decision:', err);
    // Don't block the UI - the decision was already visually confirmed
  }
}

function handleExport(format: 'json' | 'pdf') {
  if (!analysisResults.value) return;

  if (format === 'json') {
    const data = JSON.stringify(analysisResults.value, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legal-analysis-${analysisResults.value.taskId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Generate printable HTML for PDF export
    exportToPdf();
  }
}

function exportToPdf() {
  if (!analysisResults.value) return;

  const results = analysisResults.value;
  const timestamp = new Date().toLocaleString();

  // Build HTML content for PDF
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Legal Analysis Report - ${results.documentName || 'Analysis'}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #8B4513; padding-bottom: 10px; }
        h2 { color: #8B4513; margin-top: 30px; }
        h3 { color: #555; }
        .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .risk { padding: 10px; margin: 5px 0; border-left: 4px solid; border-radius: 4px; }
        .risk-critical { border-color: #dc3545; background: #f8d7da; }
        .risk-high { border-color: #fd7e14; background: #fff3cd; }
        .risk-medium { border-color: #6c757d; background: #e2e3e5; }
        .risk-low { border-color: #28a745; background: #d4edda; }
        .finding, .recommendation { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #8B4513; color: white; }
        @media print { body { margin: 0; padding: 15px; } }
      </style>
    </head>
    <body>
      <h1>Legal Analysis Report</h1>
      <div class="meta">
        <p><strong>Document:</strong> ${results.documentName || 'N/A'}</p>
        <p><strong>Task ID:</strong> ${results.taskId}</p>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Analyzed:</strong> ${results.metadata?.analyzedAt || 'N/A'}</p>
      </div>
  `;

  // Add summary
  if (results.summary) {
    html += `
      <h2>Executive Summary</h2>
      <div class="summary">${results.summary}</div>
    `;
  }

  // Add metrics table
  html += `
    <h2>Analysis Metrics</h2>
    <table>
      <tr><th>Metric</th><th>Count</th></tr>
      <tr><td>Findings</td><td>${results.findings?.length || 0}</td></tr>
      <tr><td>Risks Identified</td><td>${results.risks?.length || 0}</td></tr>
      <tr><td>Recommendations</td><td>${results.recommendations?.length || 0}</td></tr>
    </table>
  `;

  // Add risks
  if (results.risks && results.risks.length > 0) {
    html += '<h2>Risk Assessment</h2>';
    for (const risk of results.risks) {
      html += `
        <div class="risk risk-${risk.severity}">
          <strong>${risk.title || 'Risk'}</strong> (${risk.severity.toUpperCase()})
          <p>${risk.description || ''}</p>
        </div>
      `;
    }
  }

  // Add findings
  if (results.findings && results.findings.length > 0) {
    html += '<h2>Key Findings</h2>';
    for (const finding of results.findings) {
      html += `
        <div class="finding">
          <strong>${finding.title || 'Finding'}</strong>
          <p>${finding.description || ''}</p>
        </div>
      `;
    }
  }

  // Add recommendations
  if (results.recommendations && results.recommendations.length > 0) {
    html += '<h2>Recommendations</h2>';
    for (const rec of results.recommendations) {
      html += `
        <div class="recommendation">
          <strong>${rec.title || 'Recommendation'}</strong>
          <p>${rec.description || ''}</p>
        </div>
      `;
    }
  }

  html += `
      <div class="meta" style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
        <p><em>Generated by Legal Department AI - Orchestrator AI</em></p>
      </div>
    </body>
    </html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    console.error('[LegalDepartment] Failed to open print window');
    alert('Please allow popups to export PDF');
  }
}

function handleRetry() {
  error.value = null;
  currentRequest.value = null;
  routingDecision.value = null;
  analysisResults.value = null;
}

function scrollToBottom() {
  nextTick(() => {
    if (responseAreaRef.value) {
      responseAreaRef.value.scrollTop = responseAreaRef.value.scrollHeight;
    }
  });
}

// TTS: Check if response is too long for speech
function isResponseTooLong(text: string): boolean {
  if (text.length > 500) return true;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 5) return true;
  return false;
}

// TTS: Handle text-to-speech conversion
async function handleTextToSpeech(text: string) {
  try {
    console.log('[LegalDepartment] TTS: Synthesizing response');

    // Use fallback message if response is too long
    const textToSpeak = isResponseTooLong(text)
      ? 'I completed your request, but the response is quite lengthy. Please check the analysis for full details.'
      : text;

    const synthesizedAudio = await apiService.synthesizeText(
      textToSpeak,
      'EXAVITQu4vr4xnSDxMaL', // Default voice ID
      0.5 // Speaking rate/stability
    );

    // Play the audio
    await playAudio(synthesizedAudio.audioData);
    console.log('[LegalDepartment] TTS: Playback complete');
  } catch (err) {
    console.error('[LegalDepartment] TTS failed:', err);
  } finally {
    chatUiStore.setLastMessageWasSpeech(false);
  }
}

// Play audio from base64 or data URL
function playAudio(audioData: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.onended = () => resolve();
    audio.onerror = (err) => reject(err);

    if (audioData.startsWith('data:')) {
      audio.src = audioData;
    } else {
      audio.src = `data:audio/mpeg;base64,${audioData}`;
    }

    audio.play().catch(reject);
  });
}

// Watch for analysis results and trigger TTS if voice input was used
watch(analysisResults, (newResults) => {
  if (newResults && chatUiStore.lastMessageWasSpeech) {
    // Get text to speak
    let textToSpeak = newResults.summary || '';

    // For text-only responses, use the summary
    // For document analysis, provide a brief summary
    if (!textToSpeak && newResults.findings?.length > 0) {
      textToSpeak = `Analysis complete. Found ${newResults.findings.length} key findings and ${newResults.risks?.length || 0} risks.`;
    }

    if (textToSpeak) {
      handleTextToSpeech(textToSpeak);
    } else {
      chatUiStore.setLastMessageWasSpeech(false);
    }
  }
});
</script>

<style scoped>
.legal-department-conversation {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.response-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* Welcome State */
.welcome-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.welcome-content {
  text-align: center;
  max-width: 500px;
}

.welcome-icon {
  font-size: 64px;
  color: var(--ion-color-primary);
  margin-bottom: 16px;
}

.welcome-content h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
}

.welcome-content p {
  margin: 0 0 24px 0;
  color: var(--ion-color-medium);
}

.capabilities {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.capability {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
  font-size: 14px;
  color: var(--ion-text-color);
}

.capability ion-icon {
  font-size: 20px;
  color: var(--ion-color-primary);
}

/* Request Display */
.request-display {
  background: var(--ion-color-primary-tint);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.request-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: var(--ion-color-primary-shade);
}

.request-header ion-icon {
  font-size: 20px;
}

.request-message {
  margin: 0;
  line-height: 1.5;
}

.request-attachment {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  font-size: 13px;
}

.request-attachment ion-icon {
  font-size: 18px;
  color: var(--ion-color-primary);
}

/* Processing Indicator with Thinking Animation */
.processing-indicator {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--ion-color-light);
  border-radius: 12px;
  margin-bottom: 16px;
}

.thinking-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.thinking-avatar {
  width: 40px;
  height: 40px;
  background-color: var(--ion-color-primary-tint);
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
  border-top-left-radius: 4px;
  flex: 1;
  max-width: 300px;
}

.thinking-text {
  margin-bottom: 8px;
}

.agent-thinking-name {
  font-size: 0.8em;
  font-weight: bold;
  color: var(--ion-color-primary);
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

.thinking-dots .dot {
  width: 6px;
  height: 6px;
  background-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: thinking-pulse 1.4s infinite ease-in-out;
}

.thinking-dots .dot:nth-child(1) { animation-delay: -0.32s; }
.thinking-dots .dot:nth-child(2) { animation-delay: -0.16s; }
.thinking-dots .dot:nth-child(3) { animation-delay: 0s; }

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

.progress-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.progress-step {
  margin: 0;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.progress-section ion-progress-bar {
  width: 100%;
  max-width: 300px;
}

/* Error Display */
.error-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--ion-color-danger-tint);
  border-radius: 12px;
  margin-bottom: 16px;
}

.error-display ion-icon {
  font-size: 48px;
}

.error-display p {
  margin: 0;
  text-align: center;
  color: var(--ion-color-danger-shade);
}

/* Text Response Panel */
.text-response-panel {
  background: var(--ion-color-light);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.response-header ion-icon {
  font-size: 20px;
}

.response-content {
  line-height: 1.7;
  color: var(--ion-color-dark);
  white-space: pre-wrap;
}

.response-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  background: var(--ion-color-primary-tint);
  border-radius: 8px;
  font-size: 13px;
  color: var(--ion-color-primary-shade);
}

.response-hint ion-icon {
  font-size: 18px;
}

@media (max-width: 600px) {
  .capabilities {
    grid-template-columns: 1fr;
  }

  .response-area {
    padding: 16px;
  }
}
</style>
