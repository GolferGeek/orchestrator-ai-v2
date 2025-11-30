/**
 * Unified A2A Orchestrator
 *
 * Single entry point for ALL A2A calls. The transport type determines:
 * 1. How to build the request (request-switch)
 * 2. How to handle the response (response-switch)
 *
 * Uses ExecutionContext - the core context that flows through the entire system.
 *
 * Usage:
 * ```typescript
 * const result = await a2aOrchestrator.execute('hitl.approve', payload);
 *
 * switch (result.type) {
 *   case 'deliverable':
 *     openDeliverablesModal(result.deliverable);
 *     break;
 *   case 'hitl_waiting':
 *     // Stay in modal, show new content
 *     break;
 *   case 'error':
 *     showError(result.error);
 *     break;
 * }
 * ```
 *
 * @see docs/prd/unified-a2a-orchestrator.md
 */

import type { A2ATrigger, A2APayload, A2AResult } from './types';
import type { StrictA2ASuccessResponse, StrictA2AErrorResponse, TaskResponse } from '@orchestrator-ai/transport-types';
import { buildA2ARequest } from './request-switch';
import { handleA2AResponse } from './response-switch';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import { useRbacStore } from '@/stores/rbacStore';

// Get API base URL from environment
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  'http://localhost:7100';

/**
 * Unified A2A Orchestrator
 *
 * Single entry point for ALL A2A calls. The transport type determines:
 * 1. How to build the request (request-switch)
 * 2. How to handle the response (response-switch)
 *
 * Uses ExecutionContext - the core context that flows through the entire system.
 */
class A2AOrchestrator {
  /**
   * Execute an A2A call
   *
   * @param trigger - What action triggered this call
   * @param payload - Trigger-specific payload data (versionId, feedback, etc.)
   * @returns Unified result that UI can switch on
   *
   * **Context Handling (Store-First Approach):**
   * - Context is NEVER passed as parameters between functions
   * - Each function gets context from store internally when it needs it:
   *   - buildA2ARequest() -> gets context from store
   *   - API call -> uses agentSlug/orgSlug from store
   *   - handleA2AResponse() -> gets/updates context from store
   * - Only the backend can update context (adds planId/deliverableId)
   * - Store is automatically updated with returned context after response
   * - User can change provider/model via executionContextStore.setLLM()
   */
  async execute(trigger: A2ATrigger, payload: A2APayload = {}): Promise<A2AResult> {
    try {
      // 1. Get context from store
      const executionContextStore = useExecutionContextStore();
      const ctx = executionContextStore.current;

      // 2. Build the request - gets context from store internally
      const request = buildA2ARequest(trigger, payload);

      // 3. Inject execution context into request params
      const enrichedRequest = {
        ...request,
        params: {
          ...request.params,
          context: ctx,
        },
      };

      // 4. Get API configuration from stores
      const rbacStore = useRbacStore();
      const token = rbacStore.token;
      const orgSlug = ctx.orgSlug;
      const agentSlug = ctx.agentSlug;

      // 5. Send to API
      const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(orgSlug)}/${encodeURIComponent(agentSlug)}/tasks`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(enrichedRequest),
      });

      if (!response.ok) {
        const errorData = await this.tryParseJson(response);
        const errorMessage = this.extractErrorMessage(errorData, response.statusText);
        return {
          type: 'error',
          error: errorMessage,
          code: response.status,
        };
      }

      // 6. Parse response
      const data = await this.tryParseJson(response);
      if (!data) {
        return {
          type: 'error',
          error: 'Invalid JSON response from API',
        };
      }

      // 7. Extract TaskResponse from JSON-RPC envelope
      const taskResponse = this.extractTaskResponse(data);
      if (!taskResponse) {
        // Check if it's a JSON-RPC error
        const rpcError = (data as StrictA2AErrorResponse)?.error;
        if (rpcError) {
          return {
            type: 'error',
            error: rpcError.message || 'JSON-RPC error',
            code: rpcError.code,
          };
        }
        return {
          type: 'error',
          error: 'Invalid response structure from API',
        };
      }

      // 8. Handle response - gets context from store internally
      // This also updates the ExecutionContext store with the returned context
      return await handleA2AResponse(taskResponse);
    } catch (error) {
      console.error(`A2A Orchestrator error for trigger ${trigger}:`, error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Safely parse JSON from response
   */
  private async tryParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Extract error message from various error formats
   */
  private extractErrorMessage(data: unknown, fallback: string): string {
    if (!data || typeof data !== 'object') {
      return fallback;
    }

    const record = data as Record<string, unknown>;

    // JSON-RPC error format
    if (record.jsonrpc === '2.0' && record.error) {
      const error = record.error as Record<string, unknown>;
      if (typeof error.message === 'string') {
        return error.message;
      }
    }

    // Direct message field
    if (typeof record.message === 'string') {
      return record.message;
    }

    return fallback;
  }

  /**
   * Extract TaskResponse from JSON-RPC envelope
   */
  private extractTaskResponse(data: unknown): TaskResponse | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;

    // JSON-RPC 2.0 success response
    if (record.jsonrpc === '2.0' && record.result) {
      const result = record.result as TaskResponse;
      // Validate it looks like a TaskResponse
      if (typeof result.success === 'boolean' && typeof result.mode === 'string') {
        return result;
      }
    }

    // Direct TaskResponse (legacy support)
    if (typeof record.success === 'boolean' && typeof record.mode === 'string') {
      return record as unknown as TaskResponse;
    }

    return null;
  }
}

// Singleton instance
export const a2aOrchestrator = new A2AOrchestrator();

// Also export the class for testing
export { A2AOrchestrator };
