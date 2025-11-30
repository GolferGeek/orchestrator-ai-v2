/**
 * Build Actions (Deliverable Operations)
 *
 * All operations use the unified A2A orchestrator which:
 * - Gets ExecutionContext from the store (agentSlug, conversationId, deliverableId, etc.)
 * - Builds JSON-RPC requests via request-switch
 * - Handles responses via response-switch
 * - Updates stores automatically
 * - Handles HITL detection
 *
 * @see docs/prd/unified-a2a-orchestrator.md
 */

import { a2aOrchestrator } from '../orchestrator';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type {
  DeliverableData,
  DeliverableVersionData,
  HitlGeneratedContent,
  HitlStatus,
} from '@orchestrator-ai/transport-types';
import type { A2AResult } from '../orchestrator/types';

/**
 * HITL waiting result - returned when agent needs human review before completing
 */
export interface HitlWaitingResult {
  isHitlWaiting: true;
  taskId: string;
  topic: string;
  status: HitlStatus;
  generatedContent: HitlGeneratedContent;
  agentSlug: string;
  conversationId: string;
}

/**
 * Normal deliverable result
 */
export interface DeliverableResult {
  isHitlWaiting: false;
  deliverable: DeliverableData;
  version: DeliverableVersionData;
}

/**
 * Result type that can be either HITL waiting or normal deliverable
 */
export type CreateDeliverableResult = HitlWaitingResult | DeliverableResult | null;

/**
 * Convert orchestrator result to CreateDeliverableResult format
 */
function convertResult(result: A2AResult): CreateDeliverableResult {
  const executionContextStore = useExecutionContextStore();
  const ctx = executionContextStore.current;

  switch (result.type) {
    case 'hitl_waiting':
      return {
        isHitlWaiting: true,
        taskId: result.taskId,
        topic: result.topic,
        status: 'hitl_waiting' as HitlStatus,
        generatedContent: result.generatedContent,
        agentSlug: ctx.agentSlug,
        conversationId: ctx.conversationId,
      };
    case 'deliverable':
      return {
        isHitlWaiting: false,
        deliverable: result.deliverable,
        version: result.version as DeliverableVersionData,
      };
    case 'error':
      throw new Error(result.error);
    default:
      return null;
  }
}

/**
 * Create a new deliverable
 *
 * @param userMessage - User's message requesting the deliverable
 * @returns The created deliverable and initial version, or HITL waiting result
 */
export async function createDeliverable(
  userMessage: string,
): Promise<CreateDeliverableResult> {
  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();
  const executionContextStore = useExecutionContextStore();
  const ctx = executionContextStore.current;

  try {
    chatUiStore.setIsSendingMessage(true);

    // Add user message to conversation
    conversationsStore.addMessage(ctx.conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Create assistant message placeholder
    const assistantMessage = conversationsStore.addMessage(ctx.conversationId, {
      role: 'assistant',
      content: 'Processing your request...',
      timestamp: new Date().toISOString(),
      metadata: { mode: 'build' },
    });

    // Execute via orchestrator
    const result = await a2aOrchestrator.execute('build.create', { userMessage });

    // Update assistant message based on result
    if (result.type === 'deliverable') {
      conversationsStore.updateMessage(ctx.conversationId, assistantMessage.id, {
        content: 'Deliverable created successfully',
        deliverableId: result.deliverable.id,
      });
      conversationsStore.updateMessageMetadata(ctx.conversationId, assistantMessage.id, {
        deliverableId: result.deliverable.id,
        mode: 'build',
        isCompleted: true,
      });
    } else if (result.type === 'hitl_waiting') {
      conversationsStore.updateMessage(ctx.conversationId, assistantMessage.id, {
        content: 'Content generated. Waiting for your review...',
      });
      conversationsStore.updateMessageMetadata(ctx.conversationId, assistantMessage.id, {
        taskId: result.taskId,
        hitlWaiting: true,
        mode: 'build',
      });
    } else if (result.type === 'error') {
      conversationsStore.updateMessage(ctx.conversationId, assistantMessage.id, {
        content: `Error: ${result.error}`,
      });
      conversationsStore.updateMessageMetadata(ctx.conversationId, assistantMessage.id, {
        mode: 'build',
        error: result.error,
      });
    }

    chatUiStore.setIsSendingMessage(false);
    return convertResult(result);
  } catch (error) {
    console.error('[Build Create] Error:', error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(
      error instanceof Error ? error.message : 'Failed to create deliverable',
    );
    throw error;
  }
}

/**
 * Read an existing deliverable
 *
 * @param versionId - Optional specific version ID
 * @returns The deliverable and version data
 */
export async function readDeliverable(
  versionId?: string,
): Promise<{ deliverable: DeliverableData; version?: DeliverableVersionData }> {
  const result = await a2aOrchestrator.execute('build.read', { versionId });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
  if (result.type !== 'deliverable') {
    throw new Error('Unexpected response type');
  }

  return { deliverable: result.deliverable, version: result.version };
}

/**
 * Edit an existing deliverable
 *
 * @param editInstructions - Instructions for the edit
 * @returns The updated deliverable and new version
 */
export async function editDeliverable(
  editInstructions: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const result = await a2aOrchestrator.execute('build.edit', {
    userMessage: editInstructions,
  });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
  if (result.type !== 'deliverable') {
    throw new Error('Unexpected response type');
  }

  return { deliverable: result.deliverable, version: result.version as DeliverableVersionData };
}

/**
 * List deliverables for the current conversation
 *
 * @returns Array of deliverables
 */
export async function listDeliverables(): Promise<DeliverableData[]> {
  const result = await a2aOrchestrator.execute('build.list', {});

  if (result.type === 'error') {
    throw new Error(result.error);
  }

  // TODO: Update response-switch to properly handle build.list responses
  console.warn('listDeliverables: Response handling needs implementation in response-switch');
  return [];
}

/**
 * Rerun deliverable with different LLM
 *
 * @param versionId - Version ID to rerun from
 * @param llmConfig - LLM configuration
 * @param userMessage - Optional user message for the rerun
 * @returns The new version
 */
export async function rerunDeliverable(
  versionId: string,
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
  userMessage?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const result = await a2aOrchestrator.execute('build.rerun', {
    versionId,
    rerunLlmOverride: llmConfig,
    userMessage,
  });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
  if (result.type !== 'deliverable') {
    throw new Error('Unexpected response type');
  }

  return { deliverable: result.deliverable, version: result.version as DeliverableVersionData };
}

/**
 * Set current version of a deliverable
 *
 * @param versionId - Version ID to set as current
 */
export async function setCurrentVersion(versionId: string): Promise<void> {
  const result = await a2aOrchestrator.execute('build.set_current', { versionId });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
}

/**
 * Delete a deliverable version
 *
 * @param versionId - Version ID to delete
 */
export async function deleteVersion(versionId: string): Promise<void> {
  const result = await a2aOrchestrator.execute('build.delete_version', { versionId });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
}

/**
 * Delete the current deliverable
 */
export async function deleteDeliverable(): Promise<void> {
  const result = await a2aOrchestrator.execute('build.delete', {});

  if (result.type === 'error') {
    throw new Error(result.error);
  }
}

/**
 * Copy a deliverable version
 *
 * @param versionId - Version ID to copy
 * @returns The new copied version
 */
export async function copyVersion(
  versionId: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const result = await a2aOrchestrator.execute('build.copy_version', { versionId });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
  if (result.type !== 'deliverable') {
    throw new Error('Unexpected response type');
  }

  return { deliverable: result.deliverable, version: result.version as DeliverableVersionData };
}

/**
 * Merge multiple deliverable versions
 *
 * @param versionIds - Version IDs to merge
 * @param mergePrompt - Prompt for how to merge the versions
 * @param userMessage - Optional user message
 * @returns The merged version
 */
export async function mergeVersions(
  versionIds: string[],
  mergePrompt: string,
  userMessage?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const result = await a2aOrchestrator.execute('build.merge_versions', {
    versionIds,
    mergePrompt,
    userMessage,
  });

  if (result.type === 'error') {
    throw new Error(result.error);
  }
  if (result.type !== 'deliverable') {
    throw new Error('Unexpected response type');
  }

  return { deliverable: result.deliverable, version: result.version as DeliverableVersionData };
}
