<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
        <div class="modal-content analysis-progress-modal">
          <div class="modal-header">
            <h3>Risk Analysis</h3>
            <div class="header-badge" :class="statusClass">{{ statusLabel }}</div>
          </div>

          <div class="modal-body">
            <!-- Subject Info -->
            <div class="subject-info">
              <span class="subject-label">Analyzing:</span>
              <span class="subject-name">{{ subjectIdentifier }}</span>
            </div>

            <!-- Progress Bar -->
            <div class="progress-container">
              <div class="progress-bar-wrapper">
                <div
                  class="progress-bar"
                  :style="{ width: `${progress}%` }"
                  :class="{ 'progress-complete': progress >= 100 }"
                ></div>
              </div>
              <span class="progress-text">{{ progress }}%</span>
            </div>

            <!-- Current Step -->
            <div class="current-step">
              <span class="step-icon" :class="stepIconClass">{{ stepIcon }}</span>
              <span class="step-message">{{ currentMessage }}</span>
            </div>

            <!-- Dimension Progress -->
            <div v-if="dimensionProgress.length > 0" class="dimensions-progress">
              <h4>Dimension Analysis</h4>
              <div class="dimension-list">
                <div
                  v-for="dim in dimensionProgress"
                  :key="dim.slug"
                  class="dimension-item"
                  :class="dim.status"
                >
                  <span class="dim-status-icon">{{ getDimIcon(dim.status) }}</span>
                  <span class="dim-name">{{ dim.name }}</span>
                  <span v-if="dim.score !== null" class="dim-score">{{ formatScore(dim.score) }}</span>
                </div>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="error-message">
              <span class="error-icon">⚠</span>
              <span>{{ error }}</span>
            </div>

            <!-- Result Summary (when complete) -->
            <div v-if="isComplete && result" class="result-summary">
              <div class="result-row">
                <span class="result-label">Overall Risk Score:</span>
                <span class="result-value score-value" :class="getScoreClass(result.overallScore / 100)">
                  {{ formatScore(result.overallScore) }}
                </span>
              </div>
              <div class="result-row">
                <span class="result-label">Confidence:</span>
                <span class="result-value">{{ formatPercent(result.confidence) }}</span>
              </div>
              <div class="result-row">
                <span class="result-label">Dimensions Analyzed:</span>
                <span class="result-value">{{ result.assessmentCount }}</span>
              </div>
              <div v-if="result.debateTriggered" class="result-row debate-triggered">
                <span class="result-label">Red vs Blue Debate:</span>
                <span class="result-value">Triggered</span>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              v-if="!isComplete"
              class="btn-cancel"
              @click="handleCancel"
              :disabled="progress > 80"
            >
              Cancel
            </button>
            <button
              v-if="isComplete"
              class="btn-close"
              @click="handleClose"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';

interface DimensionProgress {
  slug: string;
  name: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  score: number | null;
}

interface AnalysisResult {
  overallScore: number;
  confidence: number;
  assessmentCount: number;
  debateTriggered: boolean;
}

interface ProgressEvent {
  step: string;
  message: string;
  progress: number;
  dimensionSlug?: string;
  currentDimension?: string;
  totalDimensions?: number;
  overallScore?: number;
  confidence?: number;
  assessmentCount?: number;
  debateTriggered?: boolean;
}

interface Props {
  isVisible: boolean;
  subjectIdentifier: string;
  taskId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'cancel'): void;
  (e: 'complete', result: AnalysisResult): void;
}>();

// State
const progress = ref(0);
const currentStep = ref('initializing');
const currentMessage = ref('Initializing analysis...');
const dimensionProgress = ref<DimensionProgress[]>([]);
const error = ref<string | null>(null);
const isComplete = ref(false);
const result = ref<AnalysisResult | null>(null);

// SSE connection
let eventSource: EventSource | null = null;

// Computed
const statusClass = computed(() => {
  if (error.value) return 'status-error';
  if (isComplete.value) return 'status-complete';
  return 'status-running';
});

const statusLabel = computed(() => {
  if (error.value) return 'Error';
  if (isComplete.value) return 'Complete';
  return 'Running';
});

const stepIcon = computed(() => {
  if (error.value) return '⚠';
  if (isComplete.value) return '✔';
  if (currentStep.value.startsWith('analyzing-')) return '🔍';
  if (currentStep.value === 'running-debate') return '⚔';
  return '⏳';
});

const stepIconClass = computed(() => {
  if (error.value) return 'icon-error';
  if (isComplete.value) return 'icon-complete';
  return 'icon-running';
});

// Methods
// formatPercent: For 0-1 values like confidence
function formatPercent(value: number): string {
  if (value === undefined || value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

// formatScore: For 0-100 values like overallScore (from API)
function formatScore(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  // Score is already 0-100, just format it
  return `${value.toFixed(1)}%`;
}

function getScoreClass(score: number): string {
  if (score >= 0.7) return 'score-high';
  if (score >= 0.4) return 'score-medium';
  return 'score-low';
}

function getDimIcon(status: string): string {
  switch (status) {
    case 'complete': return '✔';
    case 'analyzing': return '⏳';
    case 'error': return '✘';
    default: return '○';
  }
}

function handleProgressEvent(event: ProgressEvent) {
  progress.value = event.progress;
  currentStep.value = event.step;
  currentMessage.value = event.message;

  // Update dimension progress
  if (event.dimensionSlug && event.currentDimension) {
    const existingIndex = dimensionProgress.value.findIndex(d => d.slug === event.dimensionSlug);
    if (existingIndex >= 0) {
      dimensionProgress.value[existingIndex].status = 'analyzing';
    } else {
      dimensionProgress.value.push({
        slug: event.dimensionSlug,
        name: event.currentDimension,
        status: 'analyzing',
        score: null,
      });
    }
  }

  // Handle completion
  if (event.step === 'complete') {
    isComplete.value = true;
    result.value = {
      overallScore: event.overallScore || 0,
      confidence: event.confidence || 0,
      assessmentCount: event.assessmentCount || 0,
      debateTriggered: event.debateTriggered || false,
    };

    // Mark all dimensions as complete
    dimensionProgress.value = dimensionProgress.value.map(d => ({
      ...d,
      status: 'complete' as const,
    }));

    emit('complete', result.value);
  }
}

function connectToSSE() {
  if (!props.taskId) return;

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6100';
  const orgSlug = 'default'; // TODO: Get from store
  const agentSlug = 'investment-risk-agent';

  const url = `${baseUrl}/agent-to-agent/${orgSlug}/${agentSlug}/tasks/${props.taskId}/stream`;

  eventSource = new EventSource(url, { withCredentials: true });

  eventSource.addEventListener('agent.stream.chunk', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.chunk?.metadata?.mode === 'analysis' ||
          data.source_app === 'risk-analysis' ||
          data.hook_event_type === 'risk.analysis.progress') {
        handleProgressEvent({
          step: data.chunk?.metadata?.step || data.step || 'unknown',
          message: data.chunk?.content || data.message || '',
          progress: data.chunk?.metadata?.progress || data.progress || 0,
          dimensionSlug: data.chunk?.metadata?.dimensionSlug,
          currentDimension: data.chunk?.metadata?.currentDimension,
          totalDimensions: data.chunk?.metadata?.totalDimensions,
          overallScore: data.chunk?.metadata?.overallScore,
          confidence: data.chunk?.metadata?.confidence,
          assessmentCount: data.chunk?.metadata?.assessmentCount,
          debateTriggered: data.chunk?.metadata?.debateTriggered,
        });
      }
    } catch (e) {
      console.warn('Failed to parse SSE event:', e);
    }
  });

  eventSource.addEventListener('agent.stream.error', (event) => {
    try {
      const data = JSON.parse(event.data);
      error.value = data.error || 'Analysis failed';
    } catch (e) {
      error.value = 'Analysis failed';
    }
  });

  eventSource.onerror = () => {
    // SSE connection lost - may happen if task completes
    if (!isComplete.value && progress.value < 100) {
      // Only show error if we weren't done
      console.warn('SSE connection lost');
    }
  };
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function handleCancel() {
  disconnectSSE();
  emit('cancel');
}

function handleClose() {
  disconnectSSE();
  emit('close');
}

// Watch for visibility to connect/disconnect SSE
watch(() => props.isVisible, (visible) => {
  if (visible && props.taskId) {
    // Reset state
    progress.value = 0;
    currentStep.value = 'initializing';
    currentMessage.value = 'Initializing analysis...';
    dimensionProgress.value = [];
    error.value = null;
    isComplete.value = false;
    result.value = null;

    connectToSSE();
  } else {
    disconnectSSE();
  }
});

// Cleanup on unmount
onUnmounted(() => {
  disconnectSSE();
});

// Expose method for parent to push progress updates (polling fallback)
defineExpose({
  handleProgressEvent,
  setError: (msg: string) => { error.value = msg; },
  setComplete: (res: AnalysisResult) => {
    isComplete.value = true;
    progress.value = 100;
    result.value = res;
    currentStep.value = 'complete';
    // overallScore is already 0-100 from API, no need to multiply
    currentMessage.value = `Analysis complete: ${res.overallScore.toFixed(0)}% risk score`;
    // Mark all dimensions as complete
    dimensionProgress.value = dimensionProgress.value.map(d => ({
      ...d,
      status: 'complete' as const,
    }));
  },
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: var(--ion-card-background, #fff);
  border-radius: 12px;
  max-width: 480px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
  background: var(--ion-color-light, #f4f5f8);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.header-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-running {
  background: #3b82f6;
  color: white;
}

.status-complete {
  background: #10b981;
  color: white;
}

.status-error {
  background: #ef4444;
  color: white;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  max-height: calc(80vh - 130px);
}

.subject-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.subject-label {
  color: var(--ion-color-medium, #666);
  font-size: 0.875rem;
}

.subject-name {
  font-weight: 600;
  font-size: 1rem;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.progress-bar-wrapper {
  flex: 1;
  height: 8px;
  background: var(--ion-color-light, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar.progress-complete {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.current-step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.step-icon {
  font-size: 1.25rem;
}

.icon-running {
  animation: pulse 1.5s ease-in-out infinite;
}

.icon-complete {
  color: #10b981;
}

.icon-error {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.step-message {
  font-size: 0.875rem;
  color: var(--ion-text-color, #333);
}

.dimensions-progress {
  margin-bottom: 1rem;
}

.dimensions-progress h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--ion-color-medium, #666);
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dimension-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8125rem;
}

.dimension-item.pending {
  opacity: 0.5;
}

.dimension-item.analyzing {
  background: rgba(59, 130, 246, 0.1);
}

.dimension-item.complete {
  background: rgba(16, 185, 129, 0.1);
}

.dimension-item.error {
  background: rgba(239, 68, 68, 0.1);
}

.dim-status-icon {
  width: 16px;
  text-align: center;
}

.dim-name {
  flex: 1;
}

.dim-score {
  font-weight: 600;
  color: var(--ion-color-primary, #3880ff);
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.error-icon {
  font-size: 1.25rem;
}

.result-summary {
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 8px;
  padding: 1rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
}

.result-row:last-child {
  border-bottom: none;
}

.result-label {
  color: var(--ion-color-medium, #666);
  font-size: 0.875rem;
}

.result-value {
  font-weight: 600;
  font-size: 0.9375rem;
}

.score-value {
  font-size: 1.125rem;
}

.score-high {
  color: #dc2626;
}

.score-medium {
  color: #f59e0b;
}

.score-low {
  color: #10b981;
}

.debate-triggered .result-value {
  color: #8b5cf6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--ion-border-color, #e0e0e0);
  background: var(--ion-color-light, #f4f5f8);
}

.btn-cancel,
.btn-close {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--ion-color-medium, #666);
  color: var(--ion-color-medium, #666);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--ion-color-light-shade, #e0e0e0);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-close {
  background: var(--ion-color-primary, #3880ff);
  border: none;
  color: white;
}

.btn-close:hover {
  background: var(--ion-color-primary-shade, #3171e0);
}

/* Modal transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .modal-content {
    background: #1a1a1a;
  }

  .modal-header,
  .modal-footer {
    background: #2a2a2a;
  }

  .current-step,
  .result-summary {
    background: #2a2a2a;
  }
}
</style>
