/**
 * HITL Service
 *
 * Service for interacting with agents that support Human-in-the-Loop (HITL).
 * Uses the A2A transport protocol - calls go through the main API, not directly to LangGraph.
 */

import type {
  HitlStatus,
  HitlDecision,
  HitlGeneratedContent,
  HitlResumePayload,
  HitlStatusPayload,
  HitlHistoryPayload,
  HitlResumeResponseContent,
  HitlStatusResponseContent,
  HitlHistoryResponseContent,
  HitlRequestMetadata,
} from '@orchestrator-ai/transport-types';
import { useAuthStore } from '@/stores/rbacStore';
import { buildResponseHandler } from '@/services/agent2agent/utils/handlers/build.handler';

// Re-export types for convenience
export type {
  HitlStatus,
  HitlDecision,
  HitlGeneratedContent,
  HitlResumeResponseContent,
  HitlStatusResponseContent,
  HitlHistoryResponseContent,
};

/**
 * HITL Resume Request
 */
export interface HitlResumeRequest {
  decision: HitlDecision;
  editedContent?: Partial<HitlGeneratedContent>;
  feedback?: string;
}

/**
 * HITL Resume Response (wrapped in API response format)
 */
export interface HitlResumeResponse {
  success: boolean;
  data: HitlResumeResponseContent;
  message?: string;
}

/**
 * HITL Status Response (wrapped in API response format)
 */
export interface HitlStatusResponse {
  success: boolean;
  data: HitlStatusResponseContent;
}

/**
 * HITL History Response (wrapped in API response format)
 */
export interface HitlHistoryResponse {
  success: boolean;
  data: HitlHistoryResponseContent;
}

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:7100';

/**
 * HITL Service class
 * Communicates with agents via A2A protocol for HITL operations
 */
class HitlService {
  private authStore: ReturnType<typeof useAuthStore> | null = null;

  /**
   * Get auth store (lazy initialization to avoid circular dependencies)
   */
  private getAuthStore(): ReturnType<typeof useAuthStore> {
    if (!this.authStore) {
      this.authStore = useAuthStore();
    }
    return this.authStore;
  }

  /**
   * Get current organization slug
   */
  private getOrgSlug(): string {
    const org = this.getAuthStore().currentOrganization;
    if (!org) {
      throw new Error('No organization context available');
    }
    return org;
  }

  /**
   * Get auth headers
   */
  private getHeaders(): Record<string, string> {
    const token = this.getAuthStore().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Get current user ID
   */
  private getUserId(): string {
    const user = this.getAuthStore().user;
    return user?.id || 'anonymous';
  }

  /**
   * Build the A2A endpoint URL for an agent
   */
  private getEndpoint(agentSlug: string): string {
    const org = this.getOrgSlug();
    return `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(agentSlug)}/tasks`;
  }

  /**
   * Build request metadata
   */
  private buildMetadata(conversationId: string, originalTaskId?: string): HitlRequestMetadata {
    return {
      source: 'web-ui',
      userId: this.getUserId(),
      conversationId,
      organizationSlug: this.getOrgSlug(),
      originalTaskId,
    };
  }

  /**
   * Resume from HITL with decision
   */
  async resume(
    agentSlug: string,
    threadId: string,
    conversationId: string,
    request: HitlResumeRequest,
    originalTaskId?: string
  ): Promise<HitlResumeResponse> {
    const endpoint = this.getEndpoint(agentSlug);

    const payload: HitlResumePayload = {
      action: 'resume',
      threadId,
      decision: request.decision,
      editedContent: request.editedContent,
      feedback: request.feedback,
    };

    const requestBody = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.resume',
      params: {
        conversationId,
        payload,
        metadata: this.buildMetadata(conversationId, originalTaskId),
      },
    };

    console.log('[HITL-FE] Making resume request:', { endpoint, requestBody });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    console.log('[HITL-FE] Fetch response received:', { ok: response.ok, status: response.status });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.log('[HITL-FE] Error response:', error);
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    const jsonRpcResponse = await response.json();
    console.log('[HITL-FE] JSON-RPC response:', jsonRpcResponse);

    if (jsonRpcResponse.error) {
      console.log('[HITL-FE] JSON-RPC error:', jsonRpcResponse.error);
      throw new Error(jsonRpcResponse.error.message || 'HITL resume failed');
    }

    const result = jsonRpcResponse.result;
    console.log('[HITL-FE] Result:', result);
    console.log('[HITL-FE] result.mode:', result.mode);
    console.log('[HITL-FE] result.success:', result.success);

    // After HITL approval, the backend returns a BUILD response
    // Process it through the normal build handler to add deliverable to store
    if (result.mode === 'build' && result.success) {
      console.log('[HITL-FE] Processing BUILD response through buildResponseHandler');
      try {
        // The build handler expects the full response structure
        // It validates and adds the deliverable to the store
        const buildResult = buildResponseHandler.handleExecute(result);
        console.log('[HITL-FE] Build handler processed successfully:', buildResult);

        return {
          success: true,
          data: buildResult,
          message: result.humanResponse?.message,
        };
      } catch (error) {
        console.warn('[HITL-FE] Build handler failed, falling back to direct response:', error);
        // Fall through to return raw response
      }
    }

    // Fallback for non-BUILD responses (status, history, etc.)
    const finalResult = {
      success: result.success,
      data: result.payload?.content || result,
      message: result.humanResponse?.message,
    };
    console.log('[HITL-FE] Final result being returned:', finalResult);

    return finalResult;
  }

  /**
   * Get status of a HITL thread
   */
  async getStatus(
    agentSlug: string,
    threadId: string,
    conversationId: string
  ): Promise<HitlStatusResponse> {
    const endpoint = this.getEndpoint(agentSlug);

    const payload: HitlStatusPayload = {
      action: 'status',
      threadId,
    };

    const requestBody = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.status',
      params: {
        conversationId,
        payload,
        metadata: this.buildMetadata(conversationId),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Thread not found');
      }
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    const jsonRpcResponse = await response.json();

    if (jsonRpcResponse.error) {
      throw new Error(jsonRpcResponse.error.message || 'Failed to get HITL status');
    }

    const result = jsonRpcResponse.result;
    return {
      success: result.success,
      data: result.payload?.content || result,
    };
  }

  /**
   * Get history of a HITL thread
   */
  async getHistory(
    agentSlug: string,
    threadId: string,
    conversationId: string
  ): Promise<HitlHistoryResponse> {
    const endpoint = this.getEndpoint(agentSlug);

    const payload: HitlHistoryPayload = {
      action: 'history',
      threadId,
    };

    const requestBody = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'hitl.history',
      params: {
        conversationId,
        payload,
        metadata: this.buildMetadata(conversationId),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Thread not found');
      }
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    const jsonRpcResponse = await response.json();

    if (jsonRpcResponse.error) {
      throw new Error(jsonRpcResponse.error.message || 'Failed to get HITL history');
    }

    const result = jsonRpcResponse.result;
    return {
      success: result.success,
      data: result.payload?.content || result,
    };
  }

  /**
   * Helper: Approve content
   */
  async approve(
    agentSlug: string,
    threadId: string,
    conversationId: string,
    feedback?: string,
    originalTaskId?: string
  ): Promise<HitlResumeResponse> {
    return this.resume(agentSlug, threadId, conversationId, {
      decision: 'approve',
      feedback,
    }, originalTaskId);
  }

  /**
   * Helper: Submit edits
   */
  async submitEdits(
    agentSlug: string,
    threadId: string,
    conversationId: string,
    editedContent: Partial<HitlGeneratedContent>,
    feedback?: string,
    originalTaskId?: string
  ): Promise<HitlResumeResponse> {
    return this.resume(agentSlug, threadId, conversationId, {
      decision: 'edit',
      editedContent,
      feedback,
    }, originalTaskId);
  }

  /**
   * Helper: Reject content
   */
  async reject(
    agentSlug: string,
    threadId: string,
    conversationId: string,
    feedback?: string,
    originalTaskId?: string
  ): Promise<HitlResumeResponse> {
    return this.resume(agentSlug, threadId, conversationId, {
      decision: 'reject',
      feedback,
    }, originalTaskId);
  }
}

// Export singleton instance
export const hitlService = new HitlService();

// Default export for compatibility
export default hitlService;
