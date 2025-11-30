/**
 * Converse Actions (Conversation Operations)
 *
 * All operations use the unified A2A orchestrator which:
 * - Gets ExecutionContext from the store (agentSlug, conversationId, etc.)
 * - Builds JSON-RPC requests via request-switch
 * - Handles responses via response-switch
 * - Updates stores automatically
 *
 * @see docs/prd/unified-a2a-orchestrator.md
 */

import { a2aOrchestrator } from '../orchestrator';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type { Conversation, Message } from '@/stores/conversationsStore';

/**
 * Send a message in converse mode
 *
 * @param userMessage - User's message content
 * @returns The assistant's response message
 */
export async function sendMessage(
  userMessage: string,
): Promise<Message> {
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
      content: 'Thinking...',
      timestamp: new Date().toISOString(),
      metadata: { mode: 'converse' },
    });

    // Execute via orchestrator
    const result = await a2aOrchestrator.execute('converse.send', { userMessage });

    // Update assistant message based on result
    if (result.type === 'message') {
      conversationsStore.updateMessage(ctx.conversationId, assistantMessage.id, {
        content: result.message,
      });
      conversationsStore.updateMessageMetadata(ctx.conversationId, assistantMessage.id, {
        mode: 'converse',
        isCompleted: true,
        ...result.metadata,
      });

      chatUiStore.setIsSendingMessage(false);

      return {
        ...assistantMessage,
        content: result.message,
        metadata: {
          ...assistantMessage.metadata,
          ...result.metadata,
        },
      };
    } else if (result.type === 'error') {
      conversationsStore.updateMessage(ctx.conversationId, assistantMessage.id, {
        content: `Error: ${result.error}`,
      });
      conversationsStore.updateMessageMetadata(ctx.conversationId, assistantMessage.id, {
        mode: 'converse',
        error: result.error,
      });

      chatUiStore.setIsSendingMessage(false);
      throw new Error(result.error);
    }

    // Unexpected result type
    chatUiStore.setIsSendingMessage(false);
    throw new Error('Unexpected response type');
  } catch (error) {
    console.error('[Converse Send] Error:', error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(
      error instanceof Error ? error.message : 'Failed to send message',
    );
    throw error;
  }
}

/**
 * Create a new conversation
 *
 * @param agentName - Name of the agent
 * @param agentType - Type of the agent
 * @param organizationSlug - Organization slug
 * @param title - Optional conversation title
 * @returns The created conversation
 */
export async function createConversation(
  agentName: string,
  agentType: string,
  organizationSlug: string,
  title?: string,
): Promise<Conversation> {
  // Note: createConversation needs agentName, agentType, organizationSlug parameters
  // because these are used to SET the context, not read from it.
  // The context doesn't exist yet when creating a new conversation.

  // TODO: Once the orchestrator supports conversation creation, migrate this
  // For now, use the legacy API approach
  const { createAgent2AgentApi } = await import('@/services/agent2agent/api');
  const api = createAgent2AgentApi(agentName);

  const response = await api.conversations.create(agentName, agentType, organizationSlug);

  if (!response.success || !response.conversationId) {
    console.error('[Converse Create] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create conversation');
  }

  const conversation: Conversation = {
    id: response.conversationId,
    userId: '', // Will be set by backend
    title: title || `Chat with ${agentName}`,
    agentName,
    agentType,
    organizationSlug,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    taskCount: 0,
  };

  const conversationsStore = useConversationsStore();
  conversationsStore.addConversation(conversation);

  const chatUiStore = useChatUiStore();
  chatUiStore.setActiveConversation(conversation.id);

  return conversation;
}

/**
 * Load conversation from backend
 *
 * @param conversationId - Conversation ID to load
 * @returns The loaded conversation with messages
 */
export async function loadConversation(
  conversationId: string,
): Promise<Conversation> {
  // This would call a backend API to load the conversation
  // For now, we'll just return what's in the store
  const conversationsStore = useConversationsStore();
  const conversation = conversationsStore.conversationById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  return conversation;
}

/**
 * Delete a conversation
 *
 * @param conversationId - Conversation ID to delete
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();

  // Close the conversation tab if open
  chatUiStore.closeConversationTab(conversationId);

  // Remove from store
  conversationsStore.removeConversation(conversationId);
}
