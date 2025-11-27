/**
 * useHitl Composable
 *
 * Provides reactive state management for Human-in-the-Loop (HITL) workflows.
 * Uses the A2A transport protocol via hitlService.
 */

import { ref, computed, onUnmounted } from 'vue';
import {
  hitlService,
  type HitlStatus,
  type HitlGeneratedContent,
  type HitlStatusResponse,
} from '@/services/hitlService';

// Re-export types
export type { HitlStatus, HitlGeneratedContent };

/**
 * Options for the useHitl composable
 */
export interface UseHitlOptions {
  /** Agent slug for API calls */
  agentSlug: string;
  /** Conversation ID */
  conversationId: string;
  /** Polling interval in milliseconds (default: 3000) */
  pollingInterval?: number;
  /** Whether to automatically start polling when threadId is set */
  autoPolling?: boolean;
}

/**
 * Return type for useHitl composable
 */
export interface UseHitlReturn {
  // State
  threadId: ReturnType<typeof ref<string | null>>;
  status: ReturnType<typeof ref<HitlStatus | null>>;
  generatedContent: ReturnType<typeof ref<HitlGeneratedContent | null>>;
  finalContent: ReturnType<typeof ref<HitlGeneratedContent | null>>;
  topic: ReturnType<typeof ref<string>>;
  error: ReturnType<typeof ref<string | null>>;
  isLoading: ReturnType<typeof ref<boolean>>;
  hitlPending: ReturnType<typeof computed<boolean>>;

  // Methods
  setThread: (threadId: string, initialStatus?: HitlStatus) => void;
  refreshStatus: () => Promise<void>;
  approve: (feedback?: string, originalTaskId?: string) => Promise<void>;
  submitEdits: (editedContent: Partial<HitlGeneratedContent>, feedback?: string, originalTaskId?: string) => Promise<void>;
  reject: (feedback?: string, originalTaskId?: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  reset: () => void;
}

/**
 * useHitl composable
 *
 * @param options - Configuration options including agentSlug and conversationId
 * @returns Reactive state and methods for HITL workflows
 */
export function useHitl(options: UseHitlOptions): UseHitlReturn {
  const { agentSlug, conversationId, pollingInterval = 3000, autoPolling = false } = options;

  // Reactive state
  const threadId = ref<string | null>(null);
  const status = ref<HitlStatus | null>(null);
  const generatedContent = ref<HitlGeneratedContent | null>(null);
  const finalContent = ref<HitlGeneratedContent | null>(null);
  const topic = ref<string>('');
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  // Polling state
  let pollingTimer: ReturnType<typeof setInterval> | null = null;

  // Computed
  const hitlPending = computed(() => {
    return status.value === 'hitl_waiting';
  });

  /**
   * Set thread ID (used when task response includes HITL status)
   */
  const setThread = (newThreadId: string, initialStatus?: HitlStatus): void => {
    threadId.value = newThreadId;
    if (initialStatus) {
      status.value = initialStatus;
    }

    // Start polling if enabled
    if (autoPolling && !isFinalStatus(initialStatus || null)) {
      startPolling();
    }
  };

  /**
   * Refresh status from server
   */
  const refreshStatus = async (): Promise<void> => {
    if (!threadId.value) {
      return;
    }

    try {
      const response = await hitlService.getStatus(agentSlug, threadId.value, conversationId);
      updateFromStatusResponse(response);
    } catch (err) {
      // Don't update error state for polling failures
      console.error('Failed to refresh HITL status:', err);
    }
  };

  /**
   * Approve content
   */
  const approve = async (feedback?: string, originalTaskId?: string): Promise<void> => {
    console.log('[HITL-COMPOSABLE] approve() called', { threadId: threadId.value, agentSlug, conversationId, feedback, originalTaskId });

    if (!threadId.value) {
      throw new Error('No active thread');
    }

    isLoading.value = true;
    error.value = null;

    try {
      console.log('[HITL-COMPOSABLE] Calling hitlService.approve...');
      const response = await hitlService.approve(
        agentSlug,
        threadId.value,
        conversationId,
        feedback,
        originalTaskId
      );

      console.log('[HITL-COMPOSABLE] Response received:', response);
      console.log('[HITL-COMPOSABLE] response.data:', response.data);
      console.log('[HITL-COMPOSABLE] response.data.status:', response.data.status);
      console.log('[HITL-COMPOSABLE] response.data.finalContent:', response.data.finalContent);

      status.value = response.data.status;
      finalContent.value = response.data.finalContent || null;

      console.log('[HITL-COMPOSABLE] Updated state - status:', status.value, 'finalContent:', finalContent.value);

      if (response.data.error) {
        error.value = response.data.error;
        console.log('[HITL-COMPOSABLE] Error in response.data:', response.data.error);
      }

      // Stop polling after final decision
      stopPolling();
      console.log('[HITL-COMPOSABLE] approve() completed successfully');
    } catch (err) {
      console.error('[HITL-COMPOSABLE] Error in approve():', err);
      error.value = err instanceof Error ? err.message : 'Failed to approve content';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Submit edits
   */
  const submitEdits = async (
    editedContent: Partial<HitlGeneratedContent>,
    feedback?: string,
    originalTaskId?: string
  ): Promise<void> => {
    if (!threadId.value) {
      throw new Error('No active thread');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await hitlService.submitEdits(
        agentSlug,
        threadId.value,
        conversationId,
        editedContent,
        feedback,
        originalTaskId
      );

      status.value = response.data.status;
      finalContent.value = response.data.finalContent || null;

      if (response.data.error) {
        error.value = response.data.error;
      }

      // Stop polling after final decision
      stopPolling();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to submit edits';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Reject content
   */
  const reject = async (feedback?: string, originalTaskId?: string): Promise<void> => {
    if (!threadId.value) {
      throw new Error('No active thread');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await hitlService.reject(
        agentSlug,
        threadId.value,
        conversationId,
        feedback,
        originalTaskId
      );

      status.value = response.data.status;

      if (response.data.error) {
        error.value = response.data.error;
      }

      // Stop polling after final decision
      stopPolling();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to reject content';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Start polling for status updates
   */
  const startPolling = (): void => {
    if (pollingTimer) {
      return; // Already polling
    }

    pollingTimer = setInterval(() => {
      if (threadId.value && !isFinalStatus(status.value)) {
        refreshStatus();
      } else if (isFinalStatus(status.value)) {
        stopPolling();
      }
    }, pollingInterval);
  };

  /**
   * Stop polling
   */
  const stopPolling = (): void => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  };

  /**
   * Reset state
   */
  const reset = (): void => {
    stopPolling();
    threadId.value = null;
    status.value = null;
    generatedContent.value = null;
    finalContent.value = null;
    topic.value = '';
    error.value = null;
    isLoading.value = false;
  };

  /**
   * Check if status is final (no more changes expected)
   */
  const isFinalStatus = (s: HitlStatus | null): boolean => {
    return s === 'completed' || s === 'rejected' || s === 'failed';
  };

  /**
   * Update state from status response
   */
  const updateFromStatusResponse = (response: HitlStatusResponse): void => {
    status.value = response.data.status;
    topic.value = response.data.topic;
    generatedContent.value = response.data.generatedContent || null;
    finalContent.value = response.data.finalContent || null;

    if (response.data.error) {
      error.value = response.data.error;
    }
  };

  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling();
  });

  return {
    // State
    threadId,
    status,
    generatedContent,
    finalContent,
    topic,
    error,
    isLoading,
    hitlPending,

    // Methods
    setThread,
    refreshStatus,
    approve,
    submitEdits,
    reject,
    startPolling,
    stopPolling,
    reset,
  };
}

// Default export
export default useHitl;
