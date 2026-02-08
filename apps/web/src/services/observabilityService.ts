/**
 * Observability Service
 *
 * Handles API calls for observability data:
 * - Historical events from database
 * - SSE stream connection management
 *
 * Domain: System Monitoring & Observability
 */

import { apiService } from './apiService';
import { getSecureApiBaseUrl } from '@/utils/securityConfig';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * ObservabilityEvent - Event record from observability system
 */
export interface ObservabilityEvent {
  id?: number;
  context: ExecutionContext;
  source_app: string;
  hook_event_type: string;
  status: string;
  message: string | null;
  progress: number | null;
  step: string | null;
  payload: Record<string, unknown>;
  timestamp: number;
  created_at?: string;
}

/**
 * HistoryResponse - Response from history API
 */
export interface HistoryResponse {
  events: ObservabilityEvent[];
  count: number;
}

/**
 * HistoryParams - Parameters for history query
 */
export interface HistoryParams {
  since: number; // Unix timestamp (ms)
  until?: number; // Unix timestamp (ms)
  limit?: number;
}

/**
 * Fetch historical events from the database
 */
export async function fetchHistoricalEvents(
  params: HistoryParams,
): Promise<HistoryResponse> {
  const queryParams = new URLSearchParams({
    since: params.since.toString(),
    limit: (params.limit || 5000).toString(),
  });

  if (params.until) {
    queryParams.append('until', params.until.toString());
  }

  const response = await apiService.get<HistoryResponse>(
    `/observability/history?${queryParams.toString()}`,
  );

  return response;
}

/**
 * Create SSE EventSource for real-time observability stream
 */
export function createObservabilityStream(
  token: string,
  filters?: {
    userId?: string;
    agentSlug?: string;
    conversationId?: string;
  },
): EventSource {
  const apiUrl = getSecureApiBaseUrl();
  const queryParams = new URLSearchParams();

  if (filters?.userId) queryParams.append('userId', filters.userId);
  if (filters?.agentSlug) queryParams.append('agentSlug', filters.agentSlug);
  if (filters?.conversationId)
    queryParams.append('conversationId', filters.conversationId);

  // Note: EventSource doesn't support custom headers, so we pass token as query param
  // The backend should accept this for SSE endpoints
  queryParams.append('token', token);

  const url = `${apiUrl}/observability/stream?${queryParams.toString()}`;

  return new EventSource(url);
}

export const observabilityService = {
  fetchHistoricalEvents,
  createObservabilityStream,
};
