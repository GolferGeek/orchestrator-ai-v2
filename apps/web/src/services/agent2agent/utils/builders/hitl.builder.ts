/**
 * HITL Request Builder
 * Creates fully-typed, validated HITL (Human-in-the-Loop) requests
 *
 * HITL operations use taskId for resuming workflows.
 * The taskId is used as LangGraph's thread_id internally.
 *
 * Note: Returns StrictA2ARequest for type compatibility with other builders.
 * The actual request structure follows the same pattern as plan/build builders.
 */

import type {
  AgentTaskMode,
  HitlAction,
  HitlDecision,
  HitlGeneratedContent,
  StrictTaskMessage,
  StrictA2ARequest,
} from '@orchestrator-ai/transport-types';

interface RequestMetadata {
  conversationId: string;
  taskId: string;
  userMessage?: string;
  messages?: StrictTaskMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Validation helper
 */
function validateRequired(value: unknown, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
}

/**
 * HITL request builders
 * All 4 HITL actions from the transport type system
 *
 * Note: These builders follow the same pattern as plan/build builders
 * for consistency, returning StrictA2ARequest type.
 */
export const hitlBuilder = {
  /**
   * Resume HITL workflow with decision
   *
   * @param metadata - Request metadata with taskId
   * @param resumeData - Decision and optional content/feedback
   */
  resume: (
    metadata: RequestMetadata,
    resumeData: {
      decision: HitlDecision;
      feedback?: string;
      content?: HitlGeneratedContent;
    },
  ): StrictA2ARequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.taskId, 'taskId');
    validateRequired(resumeData.decision, 'decision');

    // Validate decision-specific requirements
    if (resumeData.decision === 'regenerate' && !resumeData.feedback) {
      throw new Error('feedback is required when decision is "regenerate"');
    }
    if (resumeData.decision === 'replace' && !resumeData.content) {
      throw new Error('content is required when decision is "replace"');
    }

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.resume',
      params: {
        mode: 'hitl' as AgentTaskMode,
        action: 'resume' as HitlAction,
        conversationId: metadata.conversationId,
        taskId: metadata.taskId,
        userMessage: metadata.userMessage || `HITL decision: ${resumeData.decision}`,
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {
          action: 'resume',
          decision: resumeData.decision,
          ...(resumeData.feedback && { feedback: resumeData.feedback }),
          ...(resumeData.content && { content: resumeData.content }),
        },
      },
    } as StrictA2ARequest;
  },

  /**
   * Get current HITL status for a task
   *
   * @param metadata - Request metadata with taskId
   */
  status: (metadata: RequestMetadata): StrictA2ARequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.taskId, 'taskId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.status',
      params: {
        mode: 'hitl' as AgentTaskMode,
        action: 'status' as HitlAction,
        conversationId: metadata.conversationId,
        taskId: metadata.taskId,
        userMessage: metadata.userMessage || 'Get HITL status',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {
          action: 'status',
        },
      },
    } as StrictA2ARequest;
  },

  /**
   * Get HITL history for a task
   *
   * @param metadata - Request metadata with taskId
   */
  history: (metadata: RequestMetadata): StrictA2ARequest => {
    validateRequired(metadata.conversationId, 'conversationId');
    validateRequired(metadata.taskId, 'taskId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.history',
      params: {
        mode: 'hitl' as AgentTaskMode,
        action: 'history' as HitlAction,
        conversationId: metadata.conversationId,
        taskId: metadata.taskId,
        userMessage: metadata.userMessage || 'Get HITL history',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {
          action: 'history',
        },
      },
    } as StrictA2ARequest;
  },

  /**
   * Get all pending HITL reviews
   *
   * @param metadata - Request metadata (taskId can be empty for pending list)
   * @param options - Optional filter options
   */
  pending: (
    metadata: Omit<RequestMetadata, 'taskId'> & { taskId?: string },
    options?: { agentSlug?: string },
  ): StrictA2ARequest => {
    validateRequired(metadata.conversationId, 'conversationId');

    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.pending',
      params: {
        mode: 'hitl' as AgentTaskMode,
        action: 'pending' as HitlAction,
        conversationId: metadata.conversationId,
        taskId: metadata.taskId || '',
        userMessage: metadata.userMessage || 'Get pending HITL reviews',
        messages: metadata.messages || [],
        metadata: metadata.metadata,
        payload: {
          action: 'pending',
          ...(options?.agentSlug && { agentSlug: options.agentSlug }),
        },
      },
    } as StrictA2ARequest;
  },
};
