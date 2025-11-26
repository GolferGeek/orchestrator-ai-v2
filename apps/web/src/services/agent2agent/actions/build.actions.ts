/**
 * Build Actions (Deliverable Operations)
 * Orchestrates deliverable operations: read from store → build request → send → handle response → update store
 *
 * This layer coordinates between:
 * - Store (read-only access to get data)
 * - tasksService (send requests)
 * - Store mutations (update state)
 */

import { tasksService } from "@/services/tasksService";
import { useConversationsStore } from "@/stores/conversationsStore";
import { useChatUiStore } from "@/stores/ui/chatUiStore";
import { useLLMPreferencesStore } from "@/stores/llmPreferencesStore";
import { useDeliverablesStore } from "@/stores/deliverablesStore";
import { useErrorStore } from "@/stores/errorStore";
import { createAgent2AgentApi } from "@/services/agent2agent/api";
import type {
  DeliverableData,
  DeliverableVersionData,
  TaskResponse,
  BuildCreateResponseContent,
  BuildResponseMetadata,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponse,
} from "@orchestrator-ai/transport-types";

// Local workflow step type for SSE tracking
interface WorkflowStep {
  stepIndex?: number;
  status?: string;
  [key: string]: unknown;
}

/**
 * Create a new deliverable
 *
 * Component usage (no await needed - Vue reactivity handles updates):
 * ```typescript
 * function handleCreateDeliverable() {
 *   createDeliverable(agentName, conversationId, message, planId);
 *   // UI updates automatically when store changes
 * }
 * ```
 *
 * @param agentName - Name of the agent to use
 * @param conversationId - Conversation ID
 * @param userMessage - User's message requesting the deliverable
 * @param planId - Optional plan ID to link
 * @returns The created deliverable and initial version
 */
export async function createDeliverable(
  agentName: string,
  conversationId: string,
  userMessage: string,
  planId?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const conversationsStore = useConversationsStore();
  const chatUiStore = useChatUiStore();
  const llmStore = useLLMPreferencesStore();
  const deliverablesStore = useDeliverablesStore();

  try {
    // 1. Mark as sending
    chatUiStore.setIsSendingMessage(true);

    // 2. Add user message to conversation
    const conversation = conversationsStore.conversationById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    conversationsStore.addMessage(conversationId, {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // 3. Build conversation history
    const messages = conversationsStore.messagesByConversation(conversationId);
    const conversationHistory = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 4. Build LLM selection from preferences store
    const llmSelection =
      llmStore.selectedProvider && llmStore.selectedModel
        ? {
          providerName: llmStore.selectedProvider.name,
          modelName: llmStore.selectedModel.modelName,
        }
        : undefined;

    // 5. Set up for SSE connection (if using real-time/polling mode)
    const executionMode = chatUiStore.executionMode || "polling";
    const workflowSteps = new Map<number, WorkflowStep>();
    let assistantMessageId: string | null = null;

    // Generate taskId upfront so we can use it for SSE connection
    const taskId = crypto.randomUUID();

    // Create assistant message upfront (will be updated with deliverable when complete)
    const assistantMessage = conversationsStore.addMessage(conversationId, {
      role: "assistant",
      content: "Processing your request...",
      timestamp: new Date().toISOString(),
      metadata: {
        taskId,
        mode: "build",
        workflow_steps_realtime: [],
        provider: llmSelection?.providerName || "n8n",
        model: llmSelection?.modelName || "workflow",
      },
    });
    assistantMessageId = assistantMessage.id;

    // 6. Start API call and SSE connection in parallel
    const resultPromise = tasksService.createAgentTask(
      conversation.agentType || "custom",
      agentName,
      {
        method: "build",
        prompt: userMessage,
        conversationId,
        conversationHistory,
        llmSelection,
        planId,
        executionMode,
        taskId,
      },
      { organization: conversation.organizationSlug || "global" },
    );

    // 7. If using SSE mode, connect for progress updates (in parallel with API call)
    // Note: API now returns synchronously with deliverable, SSE is only for progress updates
    if (executionMode === "real-time" || executionMode === "polling") {
      const { A2AStreamHandler } = await import(
        "@/services/agent2agent/sse/a2aStreamHandler"
      );
      const streamHandler = new A2AStreamHandler();
      const orgSlug = conversation.organizationSlug || "global";
      const streamId = taskId;

      // Retry connection with exponential backoff
      const connectWithRetry = async (attempt = 1, maxAttempts = 5) => {
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 2000); // 100ms, 200ms, 400ms, 800ms, 1600ms

        await new Promise((resolve) => setTimeout(resolve, delay));

        try {
          await streamHandler.connect({
            metadata: {
              streamId,
              taskId,
              agentSlug: agentName,
              conversationId,
              organizationSlug: orgSlug,
              streamUrl: `/agent-to-agent/${orgSlug}/${agentName}/tasks/${taskId}/stream?streamId=${streamId}`,
              streamTokenUrl: `/agent-to-agent/${orgSlug}/${agentName}/tasks/${taskId}/stream-token`,
            },
            onChunk: (data) => {

              const chunk = data.chunk;
              if (chunk?.metadata) {
                const { step, sequence, totalSteps, status, progress } =
                  chunk.metadata;
                const stepName = step || chunk.content || "Processing";

                let stepStatus:
                  | "pending"
                  | "in_progress"
                  | "completed"
                  | "failed" = "in_progress";
                if (status === "completed" || progress === 100) {
                  stepStatus = "completed";
                } else if (status === "failed" || status === "error") {
                  stepStatus = "failed";
                }

                const stepIndex = (sequence || 1) - 1;
                workflowSteps.set(stepIndex, {
                  stepName,
                  stepIndex,
                  totalSteps: totalSteps || workflowSteps.size + 1,
                  status: stepStatus,
                  message: chunk.content,
                  timestamp: new Date().toISOString(),
                });

                const stepsArray = Array.from(workflowSteps.values()).sort(
                  (a, b) => a.stepIndex - b.stepIndex,
                );

                if (assistantMessageId) {
                  // Create a new array reference to ensure Vue reactivity
                  conversationsStore.updateMessageMetadata(
                    conversationId,
                    assistantMessageId,
                    {
                      workflow_steps_realtime: [...stepsArray], // Spread to create new array reference
                    },
                  );
                }
              }
            },
            onComplete: (_data) => {
              // Note: Deliverable is now returned synchronously in the API response
              // SSE is only used for progress updates, not for deliverable delivery
              streamHandler.disconnect();
            },
            onError: (data) => {
              console.error("❌ [Build Create Action] SSE stream error:", data);
              streamHandler.disconnect();
            },
          });
        } catch (error) {
          console.error(
            `❌ [Build Create Action] SSE connection attempt ${attempt} failed:`,
            error,
          );
          if (attempt < maxAttempts) {
            return connectWithRetry(attempt + 1, maxAttempts);
          } else {
            console.error(
              "❌ [Build Create Action] Max SSE connection attempts reached, giving up",
            );
          }
        }
      };

      // Start connection in background (don't await - run in parallel)
      // SSE is only for progress updates, deliverable comes in API response
      connectWithRetry().catch((err) => {
        console.error("❌ [Build Create Action] SSE connection failed:", err);
      });
    }

    // 8. Now wait for the API call to complete with timeout
    let result;
    try {
      // Add timeout to prevent hanging (60 seconds for build operations)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Request timeout: The build request took too long to complete. Please try again.",
            ),
          );
        }, 60000); // 60 second timeout
      });

      result = await Promise.race([resultPromise, timeoutPromise]);
    } catch (error) {
      console.error("❌ [Build Create Action] API call failed:", error);
      console.error("❌ [Build Create Action] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      chatUiStore.setIsSendingMessage(false);

      // Extract meaningful error message
      let errorMessage = "Failed to create deliverable";
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check for specific error types
        if (error.message.includes("timeout")) {
          errorMessage =
            "Request timeout: The build request took too long. The server may be processing your request. Please check back in a moment.";
        } else if (
          error.message.includes("Network Error") ||
          error.message.includes("ERR_NETWORK")
        ) {
          errorMessage =
            "Network error: Unable to connect to the server. Please check your internet connection.";
        } else if (
          error.message.includes("401") ||
          error.message.includes("Unauthorized")
        ) {
          errorMessage = "Authentication error: Please log in again.";
        } else if (error.message.includes("500")) {
          errorMessage =
            "Server error: The server encountered an error processing your request. Please try again.";
        }
      }

      conversationsStore.setError(errorMessage);
      // Also log to error store for better tracking
      const errorStore = useErrorStore();
      if (error instanceof Error) {
        errorStore.addError(error, {
          component: "build.actions",
          url: window.location.href,
        });
      }
      throw error;
    }

    // 9. Parse result - tasksService.createAgentTask now handles JSON-RPC extraction
    // It returns: { taskId, conversationId, status, result: TaskResponseDto }
    // So we need to extract result.result to get the TaskResponseDto
    let parsedResult: unknown = result.result;

    // Handle case where result might be undefined or null
    if (!parsedResult) {
      console.error("❌ [Build Create Action] No result in response:", result);
      const errorMessage =
        (result as { error?: string })?.error || "No result from API";
      conversationsStore.setError(errorMessage);
      throw new Error(errorMessage);
    }

    // If parsedResult is a string, try to parse it
    if (typeof parsedResult === "string") {
      try {
        parsedResult = JSON.parse(parsedResult);
      } catch {
        // Failed to parse, will use as-is
      }
    }

    // Parse as TaskResponse with BuildCreateResponseContent
    // parsedResult should now be the TaskResponseDto: { success, mode, payload: { content, metadata }, humanResponse? }
    const taskResponse = parsedResult as TaskResponse;
    const buildContent = taskResponse?.payload
      ?.content as BuildCreateResponseContent;
    const metadata = taskResponse?.payload?.metadata as BuildResponseMetadata;

    // Check if the response indicates failure
    if (!taskResponse || !taskResponse.success || !buildContent) {
      // Check for JSON-RPC error format
      if (result && typeof result === "object" && "error" in result) {
        const jsonRpcError = (
          result as { error: { message?: string; code?: number } }
        ).error;
        const errorMessage = jsonRpcError?.message || "API call failed";
        console.error("❌ [Build Create Action] JSON-RPC error response:", {
          error: jsonRpcError,
          fullResult: result,
        });
        conversationsStore.setError(errorMessage);
        throw new Error(errorMessage);
      }

      // Extract error message from various possible locations
      let errorReason: string | undefined;
      
      // Try taskResponse.error first
      if (taskResponse?.error) {
        if (typeof taskResponse.error === "string") {
          errorReason = taskResponse.error;
        } else if (typeof taskResponse.error === "object" && taskResponse.error !== null) {
          errorReason = 
            (taskResponse.error as { message?: string })?.message ||
            (taskResponse.error as { error?: string })?.error ||
            JSON.stringify(taskResponse.error);
        }
      }
      
      // Try metadata.reason
      if (!errorReason && metadata?.reason) {
        errorReason = typeof metadata.reason === "string" 
          ? metadata.reason 
          : String(metadata.reason);
      }
      
      // Try result.error (JSON-RPC format)
      if (!errorReason && result && typeof result === "object" && "error" in result) {
        const errorObj = (result as { error: unknown }).error;
        if (typeof errorObj === "string") {
          errorReason = errorObj;
        } else if (errorObj && typeof errorObj === "object") {
          errorReason = 
            (errorObj as { message?: string })?.message ||
            (errorObj as { error?: string })?.error ||
            JSON.stringify(errorObj);
        }
      }
      
      // Try to extract from parsedResult if it's an error object
      if (!errorReason && parsedResult && typeof parsedResult === "object") {
        const parsed = parsedResult as Record<string, unknown>;
        if (parsed.error) {
          if (typeof parsed.error === "string") {
            errorReason = parsed.error;
          } else if (parsed.error && typeof parsed.error === "object") {
            errorReason = 
              (parsed.error as { message?: string })?.message ||
              JSON.stringify(parsed.error);
          }
        } else if (parsed.message && typeof parsed.message === "string") {
          errorReason = parsed.message;
        }
      }

      let errorMessage = errorReason || "API call failed";
      
      // Provide more helpful error messages for common cases
      if (errorMessage.includes("Mode not supported by agent")) {
        errorMessage = "This agent does not support Build mode. Please use Converse mode instead.";
      }
      
      console.error("❌ [Build Create Action] Backend returned failure:", {
        success: taskResponse?.success,
        error: errorMessage,
        taskResponseError: taskResponse?.error,
        metadataReason: metadata?.reason,
        fullResult: parsedResult,
        rawResult: result,
      });

      // Check if streaming is available (for polling mode)
      const streamingInfo = metadata?.streaming;
      if (streamingInfo) {
        // Don't throw error - let the streaming handle it
        // Return a placeholder response that indicates streaming is in progress
        return { deliverable: null, version: null };
      }

      conversationsStore.setError(errorMessage);
      throw new Error(errorMessage);
    }

    const thinkingContent = (
      taskResponse?.humanResponse as { thinking?: string }
    )?.thinking;
    const assistantContent =
      taskResponse?.humanResponse?.message ||
      "Deliverable created successfully";

    // Extract deliverable and version from proper transport type structure
    const deliverable = buildContent?.deliverable;
    const version = buildContent?.version;

    // Check if this is a conversational response (e.g., from RAG agent)
    const isConversational = (buildContent as { isConversational?: boolean })
      ?.isConversational;
    const conversationalMessage = (buildContent as { message?: string })
      ?.message;

    // Handle conversational responses (e.g., RAG agents) - no deliverable, just a message
    if (isConversational && conversationalMessage) {
      // Update the assistant message with the conversational content
      if (assistantMessageId) {
        const messages =
          conversationsStore.messagesByConversation(conversationId);
        const message = messages.find((m) => m.id === assistantMessageId);

        if (message) {
          conversationsStore.updateMessageMetadata(
            conversationId,
            assistantMessageId,
            {
              taskId: result.taskId,
              thinking: thinkingContent,
              provider: metadata?.provider || message.metadata?.provider,
              model: metadata?.model || message.metadata?.model,
              workflow_steps_realtime: Array.from(workflowSteps.values()).sort(
                (a, b) => (a.stepIndex || 0) - (b.stepIndex || 0),
              ),
              isConversational: true,
              sources: (buildContent as { sources?: unknown[] })?.sources,
            },
          );

          conversationsStore.updateMessage(conversationId, assistantMessageId, {
            content: conversationalMessage,
          });
        }
      }

      chatUiStore.setIsSendingMessage(false);

      // Return null for deliverable/version since this is conversational
      return {
        deliverable: null as unknown as DeliverableData,
        version: null as unknown as DeliverableVersionData,
      };
    }

    if (!deliverable || !version) {
      // For real-time/polling mode, the API now returns synchronously with the deliverable
      // If it's not here, something went wrong
      console.error(
        "❌ [Build Create Action] Could not find deliverable in response. Full result:",
        JSON.stringify(parsedResult, null, 2),
      );
      const errorMessage =
        metadata?.reason || "No deliverable or version in response";
      conversationsStore.setError(errorMessage);
      throw new Error(errorMessage);
    }

    // 7. Enrich version with LLM metadata from response
    const enrichedVersion: DeliverableVersionData = {
      ...version,
      metadata: {
        ...version.metadata,
        provider: metadata?.provider,
        model: metadata?.model,
        usage: metadata?.usage,
      },
    };

    // 8. Update deliverables store
    deliverablesStore.addDeliverable(deliverable);
    deliverablesStore.addVersion(deliverable.id, enrichedVersion);
    deliverablesStore.setCurrentVersion(deliverable.id, enrichedVersion.id);

    // Associate deliverable with conversation
    deliverablesStore.associateDeliverableWithConversation(
      deliverable.id,
      conversationId,
    );

    // 9. Update the existing assistant message with deliverable and final content
    if (assistantMessageId) {
      // Get current message to preserve existing data
      const messages =
        conversationsStore.messagesByConversation(conversationId);
      const message = messages.find((m) => m.id === assistantMessageId);

      if (message) {
        // Update message metadata
        conversationsStore.updateMessageMetadata(
          conversationId,
          assistantMessageId,
          {
            taskId: result.taskId,
            deliverableId: deliverable.id,
            thinking: thinkingContent,
            provider: metadata?.provider || message.metadata?.provider,
            model: metadata?.model || message.metadata?.model,
            workflow_steps_realtime: Array.from(workflowSteps.values()).sort(
              (a, b) => (a.stepIndex || 0) - (b.stepIndex || 0),
            ),
          },
        );

        // Update content and deliverableId
        conversationsStore.updateMessage(conversationId, assistantMessageId, {
          content: assistantContent,
          deliverableId: deliverable.id,
        });
      }
    }


    chatUiStore.setIsSendingMessage(false);

    return { deliverable, version: enrichedVersion };
  } catch (error) {
    console.error("❌ [Build Create Action] Error:", error);
    chatUiStore.setIsSendingMessage(false);
    conversationsStore.setError(
      error instanceof Error ? error.message : "Failed to create deliverable",
    );
    throw error;
  }
}

/**
 * Read an existing deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to read
 * @param versionId - Optional specific version ID
 * @returns The deliverable and version data
 */
export async function readDeliverable(
  agentName: string,
  deliverableId: string,
  versionId?: string,
): Promise<{ deliverable: DeliverableData; version?: DeliverableVersionData }> {
  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.read(deliverableId, versionId);

  if (!response.success) {
    console.error("❌ [Build Read Action] Failed:", response.error);
    throw new Error(response.error?.message || "Failed to read deliverable");
  }

  const deliverable = response.payload?.deliverable;
  const version = response.payload?.version;

  if (!deliverable) {
    throw new Error("No deliverable in response");
  }

  // Update store with latest data
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);

  if (version) {
    deliverablesStore.addVersion(deliverable.id, version);
  }


  return { deliverable, version };
}

/**
 * Edit an existing deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to edit
 * @param editInstructions - Instructions for the edit
 * @param conversationId - Conversation ID
 * @returns The updated deliverable and new version
 */
export async function editDeliverable(
  agentName: string,
  deliverableId: string,
  editInstructions: string,
  conversationId: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {

  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.edit(
    deliverableId,
    editInstructions,
    conversationId,
  );

  if (!response.success) {
    console.error("❌ [Build Edit Action] Failed:", response.error);
    throw new Error(response.error?.message || "Failed to edit deliverable");
  }

  const deliverable = response.payload?.deliverable;
  const version = response.payload?.version;

  if (!deliverable || !version) {
    throw new Error("No deliverable or version in response");
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);
  deliverablesStore.addVersion(deliverable.id, version);
  deliverablesStore.setCurrentVersion(deliverable.id, version.id);


  return { deliverable, version };
}

/**
 * List deliverables for a conversation
 *
 * @param agentName - Name of the agent
 * @param conversationId - Conversation ID
 * @returns Array of deliverables
 */
export async function listDeliverables(
  agentName: string,
  conversationId: string,
): Promise<DeliverableData[]> {

  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.list(conversationId);

  if (!response.success) {
    console.error("❌ [Build List Action] Failed:", response.error);
    throw new Error(response.error?.message || "Failed to list deliverables");
  }

  const deliverables = response.payload?.deliverables || [];

  // Update store with all deliverables
  const deliverablesStore = useDeliverablesStore();
  deliverables.forEach((deliverable: DeliverableData) => {
    deliverablesStore.addDeliverable(deliverable);
    deliverablesStore.associateDeliverableWithConversation(
      deliverable.id,
      conversationId,
    );
  });


  return deliverables;
}

/**
 * Rerun deliverable with different LLM
 *
 * @param agentName - Name of the agent
 * @param conversationId - Conversation ID
 * @param deliverableId - Deliverable ID to rerun
 * @param versionId - Version ID to rerun from
 * @param llmConfig - LLM configuration
 * @returns The new version
 */
export async function rerunDeliverable(
  agentName: string,
  conversationId: string,
  deliverableId: string,
  versionId: string,
  llmConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  },
  userMessage?: string,
): Promise<{ deliverable: DeliverableData; version: DeliverableVersionData }> {
  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.rerun(
    conversationId,
    versionId,
    llmConfig,
    userMessage,
  );

  if (!response.success) {
    console.error("❌ [Build Rerun Action] Failed:", response.error);
    throw new Error(response.error?.message || "Failed to rerun deliverable");
  }

  // The API client returns { success: true, data: content }
  // where content is the result from the handler
  const deliverable = response.data?.deliverable;
  const version = response.data?.version;

  if (!deliverable || !version) {
    console.error(
      "❌ [Build Rerun Action] Missing data. Response structure:",
      response,
    );
    throw new Error("No deliverable or version in response");
  }

  // Enrich version with LLM metadata from response
  // Response.data contains the deliverable/version with metadata already populated by backend
  const enrichedVersion: DeliverableVersionData = version;

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.addDeliverable(deliverable);
  deliverablesStore.addVersion(deliverable.id, enrichedVersion);


  return { deliverable, version: enrichedVersion };
}

/**
 * Set current version of a deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID
 * @param versionId - Version ID to set as current
 */
export async function setCurrentVersion(
  agentName: string,
  deliverableId: string,
  versionId: string,
): Promise<void> {
  const api = createAgent2AgentApi(agentName);
  const jsonRpcResponse = (await api.deliverables.setCurrent(
    deliverableId,
    versionId,
  )) as JsonRpcSuccessResponse<{ success: boolean }> | JsonRpcErrorResponse;


  // Handle JSON-RPC response format
  if ("error" in jsonRpcResponse) {
    console.error(
      "❌ [Build Set Current Action] Failed:",
      jsonRpcResponse.error,
    );
    throw new Error(
      jsonRpcResponse.error?.message || "Failed to set current version",
    );
  }

  const response = jsonRpcResponse.result;

  if (!response.success) {
    console.error("❌ [Build Set Current Action] Failed:", response);
    throw new Error("Failed to set current version");
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.setCurrentVersion(deliverableId, versionId);

}

/**
 * Delete a deliverable version
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID
 * @param versionId - Version ID to delete
 */
export async function deleteVersion(
  agentName: string,
  deliverableId: string,
  versionId: string,
): Promise<void> {
  const api = createAgent2AgentApi(agentName);
  const jsonRpcResponse = (await api.deliverables.deleteVersion(
    deliverableId,
    versionId,
  )) as JsonRpcSuccessResponse<{ success: boolean }> | JsonRpcErrorResponse;


  // Handle JSON-RPC response format
  if ("error" in jsonRpcResponse) {
    console.error(
      "❌ [Build Delete Version Action] Failed:",
      jsonRpcResponse.error,
    );
    throw new Error(
      jsonRpcResponse.error?.message || "Failed to delete version",
    );
  }

  const response = jsonRpcResponse.result;

  if (!response.success) {
    console.error("❌ [Build Delete Version Action] Failed:", response);
    throw new Error("Failed to delete version");
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.removeVersion(deliverableId, versionId);

}

/**
 * Delete entire deliverable
 *
 * @param agentName - Name of the agent
 * @param deliverableId - Deliverable ID to delete
 */
export async function deleteDeliverable(
  agentName: string,
  deliverableId: string,
): Promise<void> {
  const api = createAgent2AgentApi(agentName);
  const response = await api.deliverables.delete(deliverableId);

  if (!response.success) {
    console.error("❌ [Build Delete Action] Failed:", response.error);
    throw new Error(response.error?.message || "Failed to delete deliverable");
  }

  // Update store
  const deliverablesStore = useDeliverablesStore();
  deliverablesStore.removeDeliverable(deliverableId);

}
