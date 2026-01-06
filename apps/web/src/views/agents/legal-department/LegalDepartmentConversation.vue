<template>
  <div class="legal-department-conversation">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <ion-spinner name="crescent" />
      <p>Initializing Legal Department AI...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error && currentView === 'upload'" class="error-container">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ error }}</p>
      <ion-button @click="handleRetry">Retry</ion-button>
    </div>

    <!-- Upload View -->
    <DocumentUpload
      v-else-if="currentView === 'upload'"
      @analysis-started="handleAnalysisStarted"
    />

    <!-- Analysis Progress View -->
    <AnalysisProgress
      v-else-if="currentView === 'analysis'"
      :current-phase="analysisPhase"
      :progress="analysisProgress"
      :current-step="currentStep"
      :error="error"
      :show-live-updates="true"
      @retry="handleRetryAnalysis"
    />

    <!-- Results View -->
    <ResultsDisplay
      v-else-if="currentView === 'results' && analysisResults"
      :results="analysisResults"
      @restart="handleRestart"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { IonSpinner, IonIcon, IonButton } from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { useRbacStore } from '@/stores/rbacStore';
import { legalDepartmentService } from './legalDepartmentService';
import agent2AgentConversationsService from '@/services/agent2AgentConversationsService';
import DocumentUpload from './components/DocumentUpload.vue';
import AnalysisProgress from './components/AnalysisProgress.vue';
import ResultsDisplay from './components/ResultsDisplay.vue';
import type {
  AnalysisPhase,
  AnalysisResults,
  CreateAnalysisRequest,
} from './legalDepartmentTypes';

// Props
const props = defineProps<{
  conversationId?: string;
}>();

// Stores
const executionContextStore = useExecutionContextStore();
const rbacStore = useRbacStore();

// State
const isLoading = ref(false);
const error = ref<string | null>(null);
const currentView = ref<'upload' | 'analysis' | 'results'>('upload');
const analysisPhase = ref<AnalysisPhase>('initializing');
const analysisProgress = ref({
  current: 0,
  total: 100,
  percentage: 0,
});
const currentStep = ref<string | undefined>();
const analysisResults = ref<AnalysisResults | null>(null);
const currentTaskId = ref<string | null>(null);

// Mounted
onMounted(async () => {
  await initializeConversation();
});

// Unmounted
onUnmounted(() => {
  // Cleanup if needed
});

/**
 * Initialize conversation and ExecutionContext
 */
async function initializeConversation() {
  isLoading.value = true;
  error.value = null;

  try {
    const orgSlug = rbacStore.currentOrganization || 'demo-org';
    const userId = rbacStore.user?.id || 'demo-user';

    // If conversationId is provided (from route), use it
    // Otherwise, create a new conversation
    let conversationIdToUse = props.conversationId;

    if (!conversationIdToUse) {
      // Create new conversation
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
      console.log('[LegalDepartment] Created new conversation:', conversationIdToUse);
    }

    // Initialize ExecutionContext
    executionContextStore.initialize({
      orgSlug,
      userId,
      conversationId: conversationIdToUse,
      agentSlug: 'legal-department',
      agentType: 'api',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    console.log('[LegalDepartment] ExecutionContext initialized:', executionContextStore.current);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to initialize';
    console.error('[LegalDepartment] Initialization failed:', err);
  } finally {
    isLoading.value = false;
  }
}

/**
 * Handle analysis started from DocumentUpload component
 */
async function handleAnalysisStarted(data: {
  documentId: string;
  documentName: string;
  options: Record<string, boolean>;
}) {
  error.value = null;
  currentView.value = 'analysis';
  analysisPhase.value = 'initializing';
  analysisProgress.value = { current: 0, total: 100, percentage: 0 };

  try {
    // Determine document type from file name
    const documentType = data.documentName.endsWith('.pdf')
      ? 'pdf'
      : data.documentName.match(/\.(docx?|doc)$/i)
      ? 'docx'
      : 'image';

    // Build analysis request
    const request: CreateAnalysisRequest = {
      documentId: data.documentId,
      documentName: data.documentName,
      documentType,
      analysisType: 'general',
      options: {
        extractKeyTerms: data.options.extractKeyTerms,
        identifyRisks: data.options.identifyRisks,
        generateRecommendations: data.options.generateRecommendations,
      },
    };

    // Start analysis via A2A endpoint
    analysisPhase.value = 'uploading';
    analysisProgress.value = { current: 10, total: 100, percentage: 10 };

    const response = await legalDepartmentService.startAnalysis(request);
    currentTaskId.value = response.taskId;

    console.log('[LegalDepartment] Analysis started:', response);

    // If analysis completed synchronously (unlikely), show results
    if (response.status === 'completed' && response.results) {
      analysisResults.value = response.results;
      currentView.value = 'results';
    } else {
      // Otherwise, simulate progress or poll for status
      // In a real implementation, you would use SSE for real-time updates
      await simulateAnalysisProgress();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[LegalDepartment] Analysis failed:', err);
  }
}

/**
 * Simulate analysis progress
 * In a real implementation, this would be replaced by SSE real-time updates
 */
async function simulateAnalysisProgress() {
  const phases: AnalysisPhase[] = [
    'extracting',
    'analyzing',
    'identifying_risks',
    'generating_recommendations',
    'completed',
  ];

  for (let i = 0; i < phases.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    analysisPhase.value = phases[i];
    analysisProgress.value = {
      current: (i + 1) * 20,
      total: 100,
      percentage: (i + 1) * 20,
    };

    currentStep.value = getPhaseDescription(phases[i]);

    // If completed, fetch results and show them
    if (phases[i] === 'completed') {
      if (currentTaskId.value) {
        try {
          const results = await legalDepartmentService.getAnalysisResults(currentTaskId.value);
          analysisResults.value = results;
          currentView.value = 'results';
        } catch (err) {
          error.value = err instanceof Error ? err.message : 'Failed to fetch results';
        }
      } else {
        // Use mock results for demonstration
        analysisResults.value = createMockResults();
        currentView.value = 'results';
      }
    }
  }
}

/**
 * Get phase description for display
 */
function getPhaseDescription(phase: AnalysisPhase): string {
  switch (phase) {
    case 'initializing':
      return 'Preparing document for analysis';
    case 'uploading':
      return 'Uploading document to analysis engine';
    case 'extracting':
      return 'Extracting text and structure from document';
    case 'analyzing':
      return 'Analyzing legal content and identifying key terms';
    case 'identifying_risks':
      return 'Identifying potential legal risks and liabilities';
    case 'generating_recommendations':
      return 'Generating actionable recommendations';
    case 'completed':
      return 'Analysis complete';
    case 'failed':
      return 'Analysis failed';
    default:
      return 'Processing...';
  }
}

/**
 * Create mock results for demonstration
 */
function createMockResults(): AnalysisResults {
  return {
    taskId: currentTaskId.value || 'demo-task',
    documentId: 'demo-doc',
    documentName: 'Sample Legal Document.pdf',
    summary:
      'This contract contains several standard clauses common to commercial agreements. Key areas of concern include liability limitations, intellectual property rights, and termination conditions. Overall risk level is moderate with several actionable recommendations for improvement.',
    findings: [
      {
        id: '1',
        type: 'clause',
        category: 'Liability',
        summary: 'Limitation of Liability Clause',
        details: 'The contract includes a limitation of liability clause capping damages at the contract value.',
        location: { page: 5, section: 'Section 8.2' },
        severity: 'medium',
        confidence: 0.92,
      },
      {
        id: '2',
        type: 'obligation',
        category: 'Intellectual Property',
        summary: 'IP Rights Assignment',
        details: 'Broad assignment of intellectual property rights to the client with limited exceptions.',
        location: { page: 7, section: 'Section 10.1' },
        severity: 'high',
        confidence: 0.88,
      },
      {
        id: '3',
        type: 'term',
        category: 'Termination',
        summary: 'Termination for Convenience',
        details: 'Either party may terminate with 30 days notice. No termination fees specified.',
        location: { page: 9, section: 'Section 12.3' },
        severity: 'low',
        confidence: 0.95,
      },
    ],
    risks: [
      {
        id: '1',
        category: 'Financial',
        title: 'Unlimited Indirect Liability',
        description:
          'While direct damages are capped, indirect and consequential damages are not limited, creating potential exposure.',
        severity: 'high',
        likelihood: 'medium',
        impact: 'Could result in significant financial exposure beyond the contract value.',
        mitigation:
          'Add explicit exclusion of consequential damages or include a global liability cap covering all types of damages.',
        relatedFindings: ['1'],
        confidence: 0.85,
      },
      {
        id: '2',
        category: 'Intellectual Property',
        title: 'Overly Broad IP Assignment',
        description:
          'The IP assignment clause transfers all work product without retaining rights to pre-existing materials or methodologies.',
        severity: 'critical',
        likelihood: 'high',
        impact: 'Loss of valuable IP assets and competitive advantage.',
        mitigation:
          'Revise clause to explicitly exclude pre-existing IP and retain rights to reusable components and methodologies.',
        relatedFindings: ['2'],
        confidence: 0.91,
      },
    ],
    recommendations: [
      {
        id: '1',
        category: 'Liability',
        priority: 'high',
        title: 'Add Consequential Damages Exclusion',
        description:
          'Modify the limitation of liability clause to explicitly exclude all consequential, indirect, and punitive damages.',
        rationale:
          'Without this exclusion, the liability cap may not protect against the most significant financial risks.',
        suggestedAction:
          'Add language: "In no event shall either party be liable for any consequential, indirect, incidental, special, or punitive damages."',
        relatedRisks: ['1'],
        estimatedEffort: '1-2 hours',
      },
      {
        id: '2',
        category: 'Intellectual Property',
        priority: 'critical',
        title: 'Revise IP Assignment Clause',
        description:
          'Restructure the intellectual property clause to protect pre-existing IP and reusable methodologies.',
        rationale:
          'Current clause transfers valuable company assets that should be retained for use in future projects.',
        suggestedAction:
          'Add carve-outs for: (1) Pre-existing IP, (2) General methodologies and frameworks, (3) Improvements to pre-existing IP.',
        relatedRisks: ['2'],
        estimatedEffort: '2-4 hours',
      },
      {
        id: '3',
        category: 'Termination',
        priority: 'medium',
        title: 'Add Termination Fee Structure',
        description: 'Include a reasonable termination fee structure to protect against early termination losses.',
        rationale:
          'Current termination clause provides no compensation for work in progress or business disruption.',
        suggestedAction:
          'Add sliding scale termination fees based on contract completion percentage and notice period.',
        relatedRisks: [],
        estimatedEffort: '1-2 hours',
      },
    ],
    metadata: {
      analyzedAt: new Date().toISOString(),
      processingTime: 8500,
      model: 'claude-sonnet-4-20250514',
      confidence: 0.89,
    },
  };
}

/**
 * Handle retry after error
 */
function handleRetry() {
  error.value = null;
  initializeConversation();
}

/**
 * Handle retry analysis
 */
function handleRetryAnalysis() {
  error.value = null;
  currentView.value = 'upload';
  analysisPhase.value = 'initializing';
  analysisProgress.value = { current: 0, total: 100, percentage: 0 };
  analysisResults.value = null;
}

/**
 * Handle restart - go back to upload
 */
function handleRestart() {
  currentView.value = 'upload';
  analysisPhase.value = 'initializing';
  analysisProgress.value = { current: 0, total: 100, percentage: 0 };
  analysisResults.value = null;
  currentTaskId.value = null;
  error.value = null;
}
</script>

<style scoped>
.legal-department-conversation {
  height: 100%;
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
  padding: 24px;
}

.error-container ion-icon {
  font-size: 64px;
}

.error-container p {
  text-align: center;
  color: var(--ion-color-medium);
  max-width: 400px;
}
</style>
