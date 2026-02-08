/**
 * useAdminObservabilityStream Composable
 *
 * Provides SSE connection management and history fetching for observability.
 * Uses observabilityStore for state and observabilityService for API calls.
 *
 * This composable handles:
 * - SSE connection lifecycle
 * - Historical data fetching
 * - Reconnection logic
 *
 * Components should use the store directly for reactive state access.
 */

import { onUnmounted, computed } from 'vue';
import { useAuthStore } from '@/stores/rbacStore';
import {
  useObservabilityStore,
  HISTORY_TIME_RANGES,
  type HistoryTimeRange,
  type ObservabilityEvent,
  type AgentActivity,
} from '@/stores/observabilityStore';
import { observabilityService } from '@/services/observabilityService';
import { getSecureApiBaseUrl } from '@/utils/securityConfig';

// Re-export types and constants for backwards compatibility
export { HISTORY_TIME_RANGES };
export type { HistoryTimeRange, ObservabilityEvent, AgentActivity };

/**
 * Composable for admin observability stream management
 */
export function useAdminObservabilityStream() {
  const authStore = useAuthStore();
  const store = useObservabilityStore();

  // SSE connection management
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  /**
   * Connect to the observability SSE stream
   */
  async function connect(filters?: {
    userId?: string;
    agentSlug?: string;
    conversationId?: string;
  }): Promise<void> {
    // Don't reconnect if already connected
    if (store.isConnected || store.isConnecting) {
      console.log('[Observability] Already connected or connecting, skipping');
      return;
    }

    const token = authStore.token;
    if (!token) {
      store.setConnectionError('Authentication required');
      console.error('[Observability] No auth token available');
      return;
    }

    store.setConnecting(true);
    store.setConnectionError(null);
    console.log('[Observability] Connecting to SSE stream...');

    try {
      const apiUrl = getSecureApiBaseUrl();
      const queryParams = new URLSearchParams();

      if (filters?.userId) queryParams.append('userId', filters.userId);
      if (filters?.agentSlug) queryParams.append('agentSlug', filters.agentSlug);
      if (filters?.conversationId)
        queryParams.append('conversationId', filters.conversationId);

      // EventSource doesn't support Authorization header, so we use a different approach
      // The backend SSE endpoint uses cookie-based auth or we pass token via query param
      queryParams.append('token', token);

      const url = `${apiUrl}/observability/stream?${queryParams.toString()}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('[Observability] SSE connection opened');
        store.setConnected(true);
        store.setConnecting(false);
        store.setConnectionError(null);
        reconnectAttempts = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle connection event
          if (data.event_type === 'connected') {
            console.log('[Observability] Received connection confirmation');
            store.updateHeartbeat();
            return;
          }

          // Handle heartbeat (SSE comment lines)
          if (!data.hook_event_type) {
            store.updateHeartbeat();
            return;
          }

          // Add event to store
          store.addEvent(data as ObservabilityEvent);
          store.updateHeartbeat();
        } catch (err) {
          console.error('[Observability] Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[Observability] SSE error:', err);
        store.setConnected(false);
        store.setConnecting(false);

        if (eventSource?.readyState === EventSource.CLOSED) {
          store.setConnectionError('Connection closed');
          scheduleReconnect();
        }
      };
    } catch (err) {
      store.setConnectionError(
        err instanceof Error ? err.message : 'Connection failed',
      );
      store.setConnecting(false);
      console.error('[Observability] Connection exception:', err);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  function scheduleReconnect(): void {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(
        '[Observability] Max reconnect attempts reached, giving up',
      );
      store.setConnectionError('Max reconnection attempts reached');
      return;
    }

    const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    console.log(
      `[Observability] Scheduling reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`,
    );

    reconnectTimeout = setTimeout(() => {
      connect();
    }, delay);
  }

  /**
   * Disconnect from the SSE stream
   */
  function disconnect(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    store.setConnected(false);
    store.setConnecting(false);
  }

  /**
   * Fetch historical events from the database
   */
  async function fetchHistory(range?: HistoryTimeRange): Promise<void> {
    const rangeToUse = range || store.selectedHistoryRange;
    const rangeConfig = HISTORY_TIME_RANGES[rangeToUse];

    if (!rangeConfig) {
      console.error('[Observability] Invalid history range:', rangeToUse);
      return;
    }

    const token = authStore.token;
    if (!token) {
      store.setHistoryError('Authentication required');
      return;
    }

    store.setLoadingHistory(true);
    store.setHistoryError(null);

    try {
      // Calculate timestamps
      let since: number;
      let until: number | undefined;

      if (rangeToUse === 'custom') {
        since = store.customStartTime
          ? new Date(store.customStartTime).getTime()
          : Date.now() - 60 * 60 * 1000;
        until = store.customEndTime
          ? new Date(store.customEndTime).getTime()
          : undefined;
      } else {
        since = Date.now() - rangeConfig.ms;
      }

      console.log(
        `[Observability] Fetching history for ${rangeConfig.label} (since ${new Date(since).toISOString()}${until ? ` until ${new Date(until).toISOString()}` : ''})`,
      );

      const response = await observabilityService.fetchHistoricalEvents({
        since,
        until,
        limit: 5000,
      });

      console.log(`[Observability] Loaded ${response.count} historical events`);

      // Replace all events with the new set from history
      // This ensures the view reflects only the selected time range
      store.setEvents(response.events);

      console.log(
        `[Observability] Total events after update: ${store.events.length}`,
      );
    } catch (err) {
      console.error('[Observability] Failed to fetch history:', err);
      store.setHistoryError(
        err instanceof Error ? err.message : 'Failed to load history',
      );
    } finally {
      store.setLoadingHistory(false);
    }
  }

  /**
   * Set history range and fetch events
   */
  function setHistoryRange(range: HistoryTimeRange): void {
    store.setHistoryRange(range);
    fetchHistory(range);
  }

  /**
   * Set custom start time
   */
  function setCustomStartTime(time: string): void {
    store.setCustomStartTime(time);
  }

  /**
   * Set custom end time
   */
  function setCustomEndTime(time: string): void {
    store.setCustomEndTime(time);
  }

  // Auto-disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });

  // ===================
  // RETURN PUBLIC API
  // ===================

  // Expose store state as computed refs for backwards compatibility
  return {
    // Connection state (from store)
    isConnected: computed(() => store.isConnected),
    isConnecting: computed(() => store.isConnecting),
    error: computed(() => store.connectionError),
    lastHeartbeat: computed(() => store.lastHeartbeat),

    // Events (from store)
    allEvents: computed(() => store.events),
    recentEvents: computed(() => store.recentEvents),
    agentActivities: computed(() => store.agentActivities),

    // Filtered views (from store)
    eventsByConversation: computed(() => store.eventsByConversation),
    eventsByTask: computed(() => store.eventsByTask),

    // History (from store)
    selectedHistoryRange: computed(() => store.selectedHistoryRange),
    isLoadingHistory: computed(() => store.isLoadingHistory),
    historyError: computed(() => store.historyError),
    customStartTime: computed(() => store.customStartTime),
    customEndTime: computed(() => store.customEndTime),

    // Actions
    connect,
    disconnect,
    clearEvents: () => store.clearEvents(),
    getConversationEvents: (id: string) => store.getConversationEvents(id),
    getTaskEvents: (id: string) => store.getTaskEvents(id),
    getAgentEvents: (slug: string) => store.getAgentEvents(slug),
    fetchHistory,
    setHistoryRange,
    setCustomStartTime,
    setCustomEndTime,
  };
}
