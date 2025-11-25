/**
 * Converse Actions (Conversation Operations)
 * Orchestrates conversation operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - API (send requests)
 * - Handlers (validate and extract responses)
 * - Store mutations (update state)
 */

import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { tasksService } from '@/services/tasksService';
import { createAgent2AgentApi } from '@/services/agent2agent/api';
import type { Conversation, Message } from '@/stores/conversationsStore';
import type {
  TaskResponse,
  ConverseResponseContent,
  ConverseResponseMetadata
} from '@orchestrator-ai/transport-types';

/**
 * Send a message in converse mode
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleSendMessage() {
 *   sendMessage(agentName, conversationId, messageContent);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to converse with
 * @param conversationId - Conversation ID
 * @param userMessage - User's message content
 * @returns The assistant's response message
 */
export async function sendMessage(
  agentName: string,
  conversationId: string,
  userMessage: string,
): Promise<Message> {

  // 1. Get conversation from store (for context)
  const conversationsStore = useConversationsStore();
  const conversation = conversationsStore.conversationById(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }


  // 2. Add user message to store immediately (optimistic update)
  const userMessageObj: Omit<Message, 'id'> = {
    conversationId,
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  const _addedUserMessage = conversationsStore.addMessage(conversationId, userMessageObj);

  // 3. Get conversation history and UI preferences
  const chatUiStore = useChatUiStore();
  const llmStore = useLLMPreferencesStore();
  const messages = conversationsStore.messagesByConversation(conversationId);
  const conversationHistory = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp || new Date().toISOString(),
  }));

  // 4. Build LLM selection from preferences store
  const llmSelection = llmStore.selectedProvider && llmStore.selectedModel ? {
    providerName: llmStore.selectedProvider.name,
    modelName: llmStore.selectedModel.modelName,
  } : undefined;

  // 5. Call tasksService to create and execute the converse task
  try {

    const result = await tasksService.createAgentTask(
      conversation.agentType || 'custom',
      agentName,
      {
        method: 'converse',
        prompt: userMessage,
        conversationId,
        conversationHistory,
        llmSelection,
        executionMode: chatUiStore.executionMode || 'polling',
      },
      { organization: conversation.organizationSlug || 'global' }
    );


    // 5. Extract assistant message from task result - backend should provide clean response
    let parsedResult = result.result;
    if (typeof parsedResult === 'string') {
      try {
        parsedResult = JSON.parse(parsedResult);
      } catch {
      }
    }

    // Handle case where parsedResult is undefined or null (e.g., error response)
    if (!parsedResult) {
      const errorMessage = result.error || 'No response from agent';
      console.error('❌ [Converse Action] No valid result from backend:', errorMessage);
      conversationsStore.setError(errorMessage);
      throw new Error(errorMessage);
    }


    // Parse as TaskResponse with ConverseResponseContent
    const taskResponse = parsedResult as TaskResponse;
    const converseContent = taskResponse?.payload?.content as ConverseResponseContent;
    const responseMetadata = taskResponse?.payload?.metadata as ConverseResponseMetadata;

    const thinkingContent = (taskResponse?.humanResponse as { thinking?: string })?.thinking;
    const assistantContent = converseContent?.message || 'No response content';


    // Extract provider/model metadata from proper transport type structure
    const metadata = {
      taskId: result.taskId,
      provider: responseMetadata?.provider,
      model: responseMetadata?.model,
      thinking: thinkingContent,
      usage: responseMetadata?.usage,
      routingDecision: responseMetadata?.routingDecision,
      current_sub_agent: responseMetadata?.current_sub_agent,
    };

    const assistantMessage = conversationsStore.addMessage(conversationId, {
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
      metadata,
    });


    return assistantMessage;
  } catch (error) {
    console.error('❌ [Converse Send Action] Error:', error);
    conversationsStore.setError(error instanceof Error ? error.message : 'Failed to send message');
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

  // 1. Create API client
  const api = createAgent2AgentApi(agentName);

  // 2. Send create conversation request
  const response = await api.conversations.create(agentName, agentType, organizationSlug);


  // 3. Validate response
  if (!response.success || !response.conversationId) {
    console.error('❌ [Converse Create Action] Request failed:', response.error);
    throw new Error(response.error?.message || 'Failed to create conversation');
  }

  // 4. Create conversation object
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

  // 5. Update store
  const conversationsStore = useConversationsStore();
  conversationsStore.addConversation(conversation);

  // 6. Set as active conversation
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

  // 1. Close the conversation tab if open
  chatUiStore.closeConversationTab(conversationId);

  // 2. Remove from store
  conversationsStore.removeConversation(conversationId);

}
