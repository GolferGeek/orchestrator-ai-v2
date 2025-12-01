/**
 * ExecutionContext Store
 *
 * The single source of truth for the current execution context in the UI layer.
 * This store manages the "capsule" that flows through the entire A2A system.
 *
 * Key Principles:
 * 1. Context is created once when conversation is selected
 * 2. Context is immutable except for backend updates (planId, deliverableId)
 * 3. All A2A calls get context from this store - never passed as parameters
 * 4. After every A2A response, the store is updated with returned context
 *
 * @see docs/prd/unified-a2a-orchestrator.md - ExecutionContext section
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

// NIL_UUID constant for optional UUID fields (same value as transport-types)
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Parameters for initializing the ExecutionContext
 */
export interface ExecutionContextInitParams {
  orgSlug: string;
  userId: string;
  conversationId: string;
  agentSlug: string;
  agentType: string;
  provider: string;
  model: string;
  // Optional: pre-set these if loading existing conversation
  taskId?: string;
  planId?: string;
  deliverableId?: string;
}

export const useExecutionContextStore = defineStore('executionContext', () => {
  // ============================================================================
  // STATE
  // ============================================================================

  const context = ref<ExecutionContext | null>(null);

  // ============================================================================
  // COMPUTED / GETTERS
  // ============================================================================

  /**
   * Get current context - throws if not initialized
   * Use this when context is required (most A2A operations)
   */
  const current = computed((): ExecutionContext => {
    if (!context.value) {
      throw new Error('ExecutionContext not initialized. Select a conversation first.');
    }
    return context.value;
  });

  /**
   * Check if context is initialized
   * Use this before operations that need context
   */
  const isInitialized = computed((): boolean => {
    return context.value !== null;
  });

  /**
   * Get context or null (for optional access)
   */
  const contextOrNull = computed((): ExecutionContext | null => {
    return context.value;
  });

  /**
   * Convenience getters for common fields
   */
  const conversationId = computed(() => context.value?.conversationId ?? null);
  const taskId = computed(() => context.value?.taskId ?? null);
  const planId = computed(() => context.value?.planId ?? null);
  const deliverableId = computed(() => context.value?.deliverableId ?? null);
  const agentSlug = computed(() => context.value?.agentSlug ?? null);
  const orgSlug = computed(() => context.value?.orgSlug ?? null);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Create the capsule when conversation is selected.
   * This is the ONLY place the capsule is created on the frontend.
   *
   * @param params - Required context parameters
   */
  function initialize(params: ExecutionContextInitParams): void {
    context.value = {
      orgSlug: params.orgSlug,
      userId: params.userId,
      conversationId: params.conversationId,
      agentSlug: params.agentSlug,
      agentType: params.agentType,
      provider: params.provider,
      model: params.model,
      // Use NIL_UUID for optional IDs until set by backend
      taskId: params.taskId ?? NIL_UUID,
      planId: params.planId ?? NIL_UUID,
      deliverableId: params.deliverableId ?? NIL_UUID,
    };
  }

  /**
   * Replace capsule with one returned from API.
   * Called after EVERY API response - backend may have added planId or deliverableId.
   *
   * This is the ONLY way the context changes after initialization (besides setLLM).
   * The orchestrator never mutates context - it only reads from store and updates after response.
   *
   * @param ctx - The ExecutionContext returned from the API
   */
  function update(ctx: ExecutionContext): void {
    context.value = ctx;
  }

  /**
   * Change LLM for "rerun with different model" scenarios.
   * This is the ONLY user-initiated mutation of the context.
   *
   * All other mutations come from backend responses (planId/deliverableId).
   *
   * @param provider - LLM provider (e.g., 'anthropic', 'openai')
   * @param model - Model identifier (e.g., 'llama3.2:1b')
   */
  function setLLM(provider: string, model: string): void {
    if (context.value) {
      context.value = { ...context.value, provider, model };
    }
  }

  /**
   * Update agent information when switching agents within same conversation
   *
   * @param agentSlug - New agent slug
   * @param agentType - New agent type
   */
  function setAgent(agentSlug: string, agentType: string): void {
    if (context.value) {
      context.value = { ...context.value, agentSlug, agentType };
    }
  }

  /**
   * Clear when leaving conversation or logging out
   */
  function clear(): void {
    context.value = null;
  }

  // ============================================================================
  // RETURN (Public API)
  // ============================================================================

  return {
    // Getters (computed)
    current,
    isInitialized,
    contextOrNull,
    conversationId,
    taskId,
    planId,
    deliverableId,
    agentSlug,
    orgSlug,

    // Actions
    initialize,
    update,
    setLLM,
    setAgent,
    clear,
  };
});
