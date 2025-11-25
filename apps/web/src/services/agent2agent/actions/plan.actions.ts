/**
 * Plan Actions
 * Orchestrates plan operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - tasksService (send requests)
 * - Store mutations (update state)
 */

import { tasksService } from '@/services/tasksService';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { usePlanStore } from '@/stores/planStore';
import { createAgent2AgentApi } from '@/services/agent2agent/api';
import type {
  PlanData,
  PlanVersionData,
  TaskResponse,
  PlanCreateResponseContent,
  // PlanRerunResponseContent,
  PlanResponseMetadata,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse
} from '@orchestrator-ai/transport-types';

/**
 * Create a new plan
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreatePlan() {
 *   createPlan(agentName, conversationId, message);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param userMessage - User's message requesting the plan
 * @returns The created plan and initial version (mainly for testing/logging)
 */
export async function createPlan(
  agentName: string,
  conversationId: string,
  userMessage: string,
): Promise<{ plan: PlanData; version: PlanVersionData; isNew: boolean }> {

  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();
  const llmStore = useLLMPreferencesStore();
  const planStore = usePlanStore();

  try {
    // 1. Mark as sending
    chatUiStore.setIsSendingMessage(true);

    // 2. Add user message to conversation
    const conversation = conversationsStore.conversationById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    conversationsStore.addMessage(conversationId, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // 3. Build conversation history
    const messages = conversationsStore.messagesByConversation(conversationId);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 4. Build LLM selection from preferences store
    const llmSelection = llmStore.selectedProvider && llmStore.selectedModel ? {
      providerName: llmStore.selectedProvider.name,
      modelName: llmStore.selectedModel.modelName,
    } : undefined;

    // 5. Call tasksService to create and execute the plan task

    const result = await tasksService.createAgentTask(
      conversation.agentType || 'custom',
      agentName,
      {
        method: 'plan',
        prompt: userMessage,
        conversationId,
        conversationHistory,
        llmSelection,
        executionMode: chatUiStore.executionMode || 'polling',
      },
      { organization: conversation.organizationSlug || 'global' }
    );


    // 6. Parse result to extract plan
    let parsedResult = result.result;
    if (typeof parsedResult === 'string') {
      try {
        parsedResult = JSON.parse(parsedResult);
      } catch {
        // If direct parsing fails, try to find JSON in the text
        const jsonMatch = parsedResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResult = JSON.parse(jsonMatch[0]);
          } catch {
            // Still not valid JSON, use as-is
          }
        }
      }
    }

    // Extract thinking content - if original result was a string with thinking before JSON, extract it
    let extractedThinking: string | undefined;
    if (typeof result.result === 'string') {
      const jsonMatch = result.result.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch.index !== undefined && jsonMatch.index > 0) {
        extractedThinking = result.result.substring(0, jsonMatch.index).trim();
      }
    }

    // Parse as TaskResponse with PlanCreateResponseContent
    const taskResponse = parsedResult as TaskResponse;
    const planContent = taskResponse?.payload?.content as PlanCreateResponseContent;
    const responseMetadata = taskResponse?.payload?.metadata as PlanResponseMetadata;

    // Extract thinking content
    const thinkingContent =
      extractedThinking ||
      (taskResponse?.humanResponse as { thinking?: string })?.thinking;

    // Extract the actual message content
    let assistantContent =
      taskResponse?.humanResponse?.message ||
      'Plan created successfully';

    // Strip <thinking> tags from message content if they exist
    if (typeof assistantContent === 'string') {
      const thinkingTagRegex = /<thinking>[\s\S]*?<\/thinking>/gi;
      const strippedContent = assistantContent.replace(thinkingTagRegex, '').trim();

      // If we stripped thinking tags and don't have separate thinking content, extract it
      let extractedThinkingFromTags: string | undefined;
      if (!thinkingContent && thinkingTagRegex.test(assistantContent)) {
        const thinkingMatch = assistantContent.match(/<thinking>([\s\S]*?)<\/thinking>/i);
        if (thinkingMatch && thinkingMatch[1]) {
          extractedThinkingFromTags = thinkingMatch[1].trim();
        }
      }

      // Try to detect untagged thinking at the start of the response
      // Common patterns: "Let me think...", "I need to...", "First, I'll...", etc.
      let extractedThinkingFromPattern: string | undefined;
      if (!thinkingContent && !extractedThinkingFromTags && strippedContent.length > 200) {
        const thinkingPatterns = [
          /^(Let me think|I need to|First,? I'?ll?|I'?ll? need to|My approach|I should|To (create|plan|develop))[\s\S]{100,}?(?=\n\n[A-Z#]|\n\n\*)/i,
          /^[\s\S]{50,}?(?=\n\n#{1,3}\s)/,  // Text before markdown headers
        ];

        for (const pattern of thinkingPatterns) {
          const match = strippedContent.match(pattern);
          if (match) {
            extractedThinkingFromPattern = match[0].trim();
            assistantContent = strippedContent.substring(match[0].length).trim();
            break;
          }
        }
      }

      const _finalThinking = thinkingContent || extractedThinkingFromTags || extractedThinkingFromPattern;

      assistantContent = strippedContent || 'Plan created successfully';
    }

    // Extract plan from response - backend returns at payload.content.plan

    const plan = planContent?.plan;
    const version = planContent?.version;

    if (!plan || !version) {
      console.error('❌ [Plan Create Action] No plan or version found. Full response:', JSON.stringify(result, null, 2));
      throw new Error('No plan or version in response');
    }


    // 7. Enrich version with LLM metadata from response
    const enrichedVersion: PlanVersionData = {
      ...version,
      metadata: {
        ...version.metadata,
        provider: responseMetadata?.provider,
        model: responseMetadata?.model,
        usage: responseMetadata?.usage,
      },
    };


    // 8. Update plan store
    planStore.addPlan(plan, enrichedVersion);
    planStore.associatePlanWithConversation(plan.id, conversationId);

    if (enrichedVersion) {
      planStore.setCurrentVersion(plan.id, enrichedVersion.id);
    }

    // 9. Add assistant message to conversation
    conversationsStore.addMessage(conversationId, {
      role: 'assistant',
      content: assistantContent,
      timestamp: new Date().toISOString(),
      planId: plan.id,
      metadata: {
        taskId: result.taskId,
        planId: plan.id,
        thinking: thinkingContent,
        provider: responseMetadata?.provider,
        model: responseMetadata?.model,
      },
    });


    chatUiStore.setIsSendingMessage(false);

    return {
      plan,
      version: enrichedVersion,
      isNew: true,
    };
  } catch (error) {
    console.error('❌ [Plan Create Action] Error:', error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(error instanceof Error ? error.message : 'Failed to create plan');
    throw error;
  }
}

/**
 * Rerun plan with different LLM
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleRerunPlan() {
 *   rerunPlan(agentName, conversationId, versionId, llmConfig);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param versionId - Version ID to rerun
 * @param llmConfig - LLM configuration for rerun
 * @returns The new plan version (mainly for testing/logging)
 */
export async function rerunPlan(
  agentName: string,
  conversationId: string,
  versionId: string,
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<{ plan: PlanData; version: PlanVersionData }> {

  // 1. Get existing plan from store (for context) - accessing for reactivity
  const planStore = usePlanStore();
  void planStore.plansByConversationId(conversationId);

  // 2. Create API client
  const api = createAgent2AgentApi(agentName);

  // 3. Build and send request
  const response = await api.plans.rerun(conversationId, versionId, llmConfig) as { plan: PlanData; version: PlanVersionData };


  // 4. Validate - response is already transformed by handleResponse.plan.handle()
  // It returns { plan, version } directly
  if (!response.plan || !response.version) {
    console.error('❌ [Plan Rerun Action] No plan or version in response:', JSON.stringify(response, null, 2));
    throw new Error('No plan or version in rerun response');
  }

  const { plan, version } = response;


  // 5. Version already has metadata from backend, use as-is
  const enrichedVersion = version;


  // 6. Update store
  // Add the new version to the store
  planStore.addVersion(plan.id, enrichedVersion);

  // Set the new version as current (optional - depends on UX preference)
  planStore.setCurrentVersion(plan.id, enrichedVersion.id);


  // 7. Return the result
  return {
    plan,
    version: enrichedVersion,
  };
}

/**
 * Set current version of a plan
 *
 * @param agentName - Name of the agent
 * @param planId - Plan ID (conversationId)
 * @param versionId - Version ID to set as current
 */
export async function setCurrentPlanVersion(
  agentName: string,
  planId: string,
  versionId: string,
): Promise<void> {

  const api = createAgent2AgentApi(agentName);
  const jsonRpcResponse = await api.plans.setCurrent(planId, versionId) as JsonRpcSuccessResponse<{ success: boolean }> | JsonRpcErrorResponse;


  // Handle JSON-RPC response format
  if ('error' in jsonRpcResponse) {
    console.error('❌ [Plan Set Current Action] Failed:', jsonRpcResponse.error);
    throw new Error(jsonRpcResponse.error?.message || 'Failed to set current version');
  }

  const response = jsonRpcResponse.result;

  if (!response.success) {
    console.error('❌ [Plan Set Current Action] Failed:', response);
    throw new Error('Failed to set current version');
  }

  // Update store
  const planStore = usePlanStore();
  planStore.setCurrentVersion(planId, versionId);

}

/**
 * Delete a plan version
 *
 * @param agentName - Name of the agent
 * @param planId - Plan ID (conversationId)
 * @param versionId - Version ID to delete
 */
export async function deletePlanVersion(
  agentName: string,
  planId: string,
  versionId: string,
): Promise<void> {

  const api = createAgent2AgentApi(agentName);
  const jsonRpcResponse = await api.plans.deleteVersion(planId, versionId) as JsonRpcSuccessResponse<{ success: boolean }> | JsonRpcErrorResponse;


  // Handle JSON-RPC response format
  if ('error' in jsonRpcResponse) {
    console.error('❌ [Plan Delete Version Action] Failed:', jsonRpcResponse.error);
    throw new Error(jsonRpcResponse.error?.message || 'Failed to delete version');
  }

  const response = jsonRpcResponse.result;

  if (!response.success) {
    console.error('❌ [Plan Delete Version Action] Failed:', response);
    throw new Error('Failed to delete version');
  }

  // Update store
  const planStore = usePlanStore();
  planStore.removeVersion(planId, versionId);

}
