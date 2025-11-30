/**
 * HITL Service
 *
 * All HITL operations go through the A2A endpoint using JSON-RPC methods:
 * - hitl.resume: Resume workflow with decision
 * - hitl.status: Get current HITL status
 * - hitl.history: Get version history
 * - hitl.pending: Get all pending HITL reviews for user
 */

import type {
  HitlDecision,
  HitlStatus,
  HitlDeliverableResponse,
  HitlResumeRequest,
  HitlStatusResponse,
  HitlHistoryResponse,
  HitlPendingListResponse,
  HitlGeneratedContent,
} from '@orchestrator-ai/transport-types';
import { useAuthStore } from '@/stores/rbacStore';

// Re-export types for convenience
export type {
  HitlDecision,
  HitlStatus,
  HitlDeliverableResponse,
  HitlResumeRequest,
  HitlStatusResponse,
  HitlHistoryResponse,
  HitlPendingListResponse,
  HitlGeneratedContent,
};

// Get API base URL from environment
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  'http://localhost:7100';

/**
 * JSON-RPC request structure for A2A endpoint
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id: number;
}

/**
 * JSON-RPC response structure
 * The result contains the TaskResponseDto from the backend
 */
interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  result?: {
    success: boolean;
    mode?: string;
    payload: {
      content: T;
      metadata?: Record<string, unknown>;
    };
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * HITL Service class
 * Communicates with agents via A2A protocol for HITL operations
 */
class HitlService {
  private requestId = 0;

  /**
   * Get auth token from localStorage or auth store
   * Falls back to localStorage if Pinia store isn't available yet
   */
  private getToken(): string | null {
    // First try to get from localStorage directly (most reliable)
    const localToken = localStorage.getItem('authToken');
    if (localToken) {
      return localToken;
    }

    // Fallback to auth store if available
    try {
      const authStore = useAuthStore();
      return authStore.token;
    } catch {
      // Pinia might not be initialized yet
      return null;
    }
  }

  /**
   * Get auth headers
   */
  private getHeaders(): Record<string, string> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Build A2A endpoint URL
   */
  private getEndpoint(organizationSlug: string, agentSlug: string): string {
    return `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(agentSlug)}/tasks`;
  }

  /**
   * Send JSON-RPC request to A2A endpoint
   */
  private async sendJsonRpc<T>(
    organizationSlug: string,
    agentSlug: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const endpoint = this.getEndpoint(organizationSlug, agentSlug);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || error.error?.message || `HTTP ${response.status}`);
    }

    const jsonRpcResponse = (await response.json()) as JsonRpcResponse<T>;

    if (jsonRpcResponse.error) {
      throw new Error(jsonRpcResponse.error.message);
    }

    if (!jsonRpcResponse.result?.success) {
      throw new Error('HITL request failed');
    }

    // Extract the content from payload.content (TaskResponseDto structure)
    return jsonRpcResponse.result.payload.content;
  }

  /**
   * Resume HITL workflow with a decision
   */
  async resume(
    organizationSlug: string,
    agentSlug: string,
    request: HitlResumeRequest
  ): Promise<HitlDeliverableResponse> {
    return this.sendJsonRpc<HitlDeliverableResponse>(
      organizationSlug,
      agentSlug,
      'hitl.resume',
      {
        taskId: request.taskId,
        decision: request.decision,
        feedback: request.feedback,
        content: request.content,
      }
    );
  }

  /**
   * Approve current content and continue workflow
   */
  async approve(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'approve',
    });
  }

  /**
   * Regenerate content with feedback
   */
  async regenerate(
    organizationSlug: string,
    agentSlug: string,
    taskId: string,
    feedback: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'regenerate',
      feedback,
    });
  }

  /**
   * Replace content with user-provided content
   */
  async replace(
    organizationSlug: string,
    agentSlug: string,
    taskId: string,
    content: HitlGeneratedContent
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'replace',
      content,
    });
  }

  /**
   * Reject current content and regenerate from scratch
   */
  async reject(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'reject',
    });
  }

  /**
   * Skip this review point (auto-approve)
   */
  async skip(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlDeliverableResponse> {
    return this.resume(organizationSlug, agentSlug, {
      taskId,
      decision: 'skip',
    });
  }

  /**
   * Get current HITL status for a task
   */
  async getStatus(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlStatusResponse> {
    return this.sendJsonRpc<HitlStatusResponse>(
      organizationSlug,
      agentSlug,
      'hitl.status',
      { taskId }
    );
  }

  /**
   * Get version history for a task's deliverable
   */
  async getHistory(
    organizationSlug: string,
    agentSlug: string,
    taskId: string
  ): Promise<HitlHistoryResponse> {
    return this.sendJsonRpc<HitlHistoryResponse>(
      organizationSlug,
      agentSlug,
      'hitl.history',
      { taskId }
    );
  }

  /**
   * Get all pending HITL reviews for current user
   * Note: This doesn't need agent-specific routing, but we use a default agent
   */
  async getPendingReviews(organizationSlug: string): Promise<HitlPendingListResponse> {
    // Use a system agent or first available agent for this query
    // The backend will query across all conversations regardless of agent
    return this.sendJsonRpc<HitlPendingListResponse>(
      organizationSlug,
      '_system', // Special slug for cross-agent queries
      'hitl.pending',
      {}
    );
  }
}

export const hitlService = new HitlService();

// Default export for compatibility
export default hitlService;
