/**
 * Observability Store
 *
 * Manages observability event state for system monitoring.
 * Pure state management - services handle API calls.
 *
 * State includes:
 * - All events (historical + real-time)
 * - Connection status
 * - History range settings
 * - Computed views (by conversation, by task, agent activities)
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * History time range options
 */
export type HistoryTimeRange =
  | '1h'
  | '2h'
  | '6h'
  | '12h'
  | '1d'
  | '2d'
  | '3d'
  | '1w'
  | 'custom';

export const HISTORY_TIME_RANGES: Record<
  HistoryTimeRange,
  { label: string; ms: number }
> = {
  '1h': { label: 'Last hour', ms: 60 * 60 * 1000 },
  '2h': { label: 'Last 2 hours', ms: 2 * 60 * 60 * 1000 },
  '6h': { label: 'Last 6 hours', ms: 6 * 60 * 60 * 1000 },
  '12h': { label: 'Last 12 hours', ms: 12 * 60 * 60 * 1000 },
  '1d': { label: 'Last day', ms: 24 * 60 * 60 * 1000 },
  '2d': { label: 'Last 2 days', ms: 2 * 24 * 60 * 60 * 1000 },
  '3d': { label: 'Last 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  '1w': { label: 'Last week', ms: 7 * 24 * 60 * 60 * 1000 },
  custom: { label: 'Custom range', ms: 0 },
};

/**
 * ObservabilityEvent - Event record
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
 * AgentActivity - Grouped events by conversation/task
 */
export interface AgentActivity {
  agentSlug: string;
  conversationId: string | null;
  username: string | null;
  organizationSlug: string | null;
  lastEvent: ObservabilityEvent;
  events: ObservabilityEvent[];
  status: 'idle' | 'active' | 'error';
}

export const useObservabilityStore = defineStore('observability', () => {
  // ===================
  // STATE
  // ===================

  // All events (sorted by timestamp)
  const events = ref<ObservabilityEvent[]>([]);

  // Connection state
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionError = ref<string | null>(null);
  const lastHeartbeat = ref<Date | null>(null);

  // History state
  const selectedHistoryRange = ref<HistoryTimeRange>('1h');
  const customStartTime = ref<string>('');
  const customEndTime = ref<string>('');
  const isLoadingHistory = ref(false);
  const historyError = ref<string | null>(null);

  // ===================
  // GETTERS (Computed)
  // ===================

  /**
   * Recent events (last 100)
   */
  const recentEvents = computed(() => {
    return events.value.slice(-100);
  });

  /**
   * Events grouped by conversation ID
   */
  const eventsByConversation = computed(() => {
    const grouped: Record<string, ObservabilityEvent[]> = {};
    for (const event of events.value) {
      const convId = event.context?.conversationId;
      if (convId) {
        if (!grouped[convId]) grouped[convId] = [];
        grouped[convId].push(event);
      }
    }
    return grouped;
  });

  /**
   * Events grouped by task ID
   */
  const eventsByTask = computed(() => {
    const grouped: Record<string, ObservabilityEvent[]> = {};
    for (const event of events.value) {
      const taskId = event.context?.taskId;
      if (taskId) {
        if (!grouped[taskId]) grouped[taskId] = [];
        grouped[taskId].push(event);
      }
    }
    return grouped;
  });

  /**
   * Agent activities (grouped by conversation, sorted by recency)
   */
  const agentActivities = computed<Record<string, AgentActivity>>(() => {
    const activities: Record<string, AgentActivity> = {};

    for (const event of events.value) {
      const conversationId = event.context?.conversationId || null;
      const taskId = event.context?.taskId || null;
      const orgSlug = event.context?.orgSlug || null;
      const agentSlug = event.context?.agentSlug || null;
      const userId = event.context?.userId || null;
      const username =
        (event.payload?.username as string) || userId || null;

      const groupKey = conversationId || taskId;
      if (!groupKey) continue;

      if (!activities[groupKey]) {
        activities[groupKey] = {
          agentSlug:
            agentSlug || `Task ${groupKey.substring(0, 8).toUpperCase()}`,
          conversationId,
          username,
          organizationSlug: orgSlug,
          lastEvent: event,
          events: [],
          status: 'idle',
        };
      }

      const activity = activities[groupKey];

      // Update with better data if available
      if (orgSlug && !activity.organizationSlug) {
        activity.organizationSlug = orgSlug;
      }
      if (username && !activity.username) {
        activity.username = username;
      }
      if (agentSlug && activity.agentSlug.startsWith('Task ')) {
        activity.agentSlug = agentSlug;
      }

      activity.events.push(event);
      activity.lastEvent = event;

      // Determine status
      const eventType = event.hook_event_type;
      if (
        eventType === 'agent.failed' ||
        eventType === 'task.failed' ||
        eventType === 'langgraph.failed'
      ) {
        activity.status = 'error';
      } else if (
        eventType === 'agent.started' ||
        eventType === 'agent.progress' ||
        eventType === 'task.started' ||
        eventType === 'task.progress' ||
        eventType === 'agent.stream.chunk' ||
        eventType === 'langgraph.started' ||
        eventType === 'langgraph.processing'
      ) {
        activity.status = 'active';
      } else if (
        eventType === 'agent.completed' ||
        eventType === 'task.completed' ||
        eventType === 'agent.stream.complete' ||
        eventType === 'langgraph.completed'
      ) {
        activity.status = 'idle';
      }
    }

    // Sort by most recent and limit to 20
    const sortedEntries = Object.entries(activities).sort((a, b) => {
      const aTime =
        a[1].lastEvent.timestamp ||
        (a[1].lastEvent.created_at
          ? new Date(a[1].lastEvent.created_at).getTime()
          : 0);
      const bTime =
        b[1].lastEvent.timestamp ||
        (b[1].lastEvent.created_at
          ? new Date(b[1].lastEvent.created_at).getTime()
          : 0);
      return bTime - aTime;
    });

    const result: Record<string, AgentActivity> = {};
    for (const [key, activity] of sortedEntries.slice(0, 20)) {
      result[key] = activity;
    }

    return result;
  });

  /**
   * Total event count
   */
  const totalEventCount = computed(() => events.value.length);

  /**
   * Active agent count
   */
  const activeAgentCount = computed(() => {
    return Object.values(agentActivities.value).filter(
      (a) => a.status === 'active',
    ).length;
  });

  /**
   * Unique conversation count
   */
  const uniqueConversationCount = computed(() => {
    return Object.keys(eventsByConversation.value).length;
  });

  /**
   * Event type breakdown
   */
  const eventTypeBreakdown = computed(() => {
    const breakdown: Record<string, number> = {};
    for (const event of events.value) {
      const type = event.hook_event_type || 'unknown';
      breakdown[type] = (breakdown[type] || 0) + 1;
    }
    return breakdown;
  });

  // ===================
  // ACTIONS
  // ===================

  /**
   * Add a single event (from SSE stream)
   */
  function addEvent(event: ObservabilityEvent): void {
    events.value.push(event);
    // Keep sorted by timestamp
    events.value.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  /**
   * Add multiple events (from history fetch)
   * Merges with existing events, deduplicates
   */
  function mergeEvents(newEvents: ObservabilityEvent[]): void {
    const eventMap = new Map<string, ObservabilityEvent>();

    // Add new events first
    for (const event of newEvents) {
      const key = event.id
        ? `id-${event.id}`
        : `${event.timestamp}-${event.context?.taskId}`;
      eventMap.set(key, event);
    }

    // Add existing events (override with newer data)
    for (const event of events.value) {
      const key = event.id
        ? `id-${event.id}`
        : `${event.timestamp}-${event.context?.taskId}`;
      eventMap.set(key, event);
    }

    // Sort and update
    events.value = Array.from(eventMap.values()).sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    );
  }

  /**
   * Replace all events with new set (for time range changes)
   * Unlike mergeEvents, this completely replaces the events array
   */
  function setEvents(newEvents: ObservabilityEvent[]): void {
    events.value = [...newEvents].sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
    );
  }

  /**
   * Clear all events
   */
  function clearEvents(): void {
    events.value = [];
  }

  /**
   * Set connection status
   */
  function setConnected(connected: boolean): void {
    isConnected.value = connected;
    if (!connected) {
      isConnecting.value = false;
    }
  }

  /**
   * Set connecting status
   */
  function setConnecting(connecting: boolean): void {
    isConnecting.value = connecting;
  }

  /**
   * Set connection error
   */
  function setConnectionError(error: string | null): void {
    connectionError.value = error;
  }

  /**
   * Update heartbeat timestamp
   */
  function updateHeartbeat(): void {
    lastHeartbeat.value = new Date();
  }

  /**
   * Set history range
   */
  function setHistoryRange(range: HistoryTimeRange): void {
    selectedHistoryRange.value = range;
  }

  /**
   * Set custom start time
   */
  function setCustomStartTime(time: string): void {
    customStartTime.value = time;
  }

  /**
   * Set custom end time
   */
  function setCustomEndTime(time: string): void {
    customEndTime.value = time;
  }

  /**
   * Set loading history status
   */
  function setLoadingHistory(loading: boolean): void {
    isLoadingHistory.value = loading;
  }

  /**
   * Set history error
   */
  function setHistoryError(error: string | null): void {
    historyError.value = error;
  }

  /**
   * Get events for a specific conversation
   */
  function getConversationEvents(conversationId: string): ObservabilityEvent[] {
    return eventsByConversation.value[conversationId] || [];
  }

  /**
   * Get events for a specific task
   */
  function getTaskEvents(taskId: string): ObservabilityEvent[] {
    return eventsByTask.value[taskId] || [];
  }

  /**
   * Get events for a specific agent
   */
  function getAgentEvents(agentSlug: string): ObservabilityEvent[] {
    return events.value.filter((e) => e.context?.agentSlug === agentSlug);
  }

  /**
   * Reset store (on logout)
   */
  function reset(): void {
    events.value = [];
    isConnected.value = false;
    isConnecting.value = false;
    connectionError.value = null;
    lastHeartbeat.value = null;
    selectedHistoryRange.value = '1h';
    customStartTime.value = '';
    customEndTime.value = '';
    isLoadingHistory.value = false;
    historyError.value = null;
  }

  // ===================
  // RETURN PUBLIC API
  // ===================

  return {
    // State (read-only)
    events: readonly(events),
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    connectionError: readonly(connectionError),
    lastHeartbeat: readonly(lastHeartbeat),
    selectedHistoryRange: readonly(selectedHistoryRange),
    customStartTime: readonly(customStartTime),
    customEndTime: readonly(customEndTime),
    isLoadingHistory: readonly(isLoadingHistory),
    historyError: readonly(historyError),

    // Getters
    recentEvents,
    eventsByConversation,
    eventsByTask,
    agentActivities,
    totalEventCount,
    activeAgentCount,
    uniqueConversationCount,
    eventTypeBreakdown,

    // Actions
    addEvent,
    mergeEvents,
    setEvents,
    clearEvents,
    setConnected,
    setConnecting,
    setConnectionError,
    updateHeartbeat,
    setHistoryRange,
    setCustomStartTime,
    setCustomEndTime,
    setLoadingHistory,
    setHistoryError,
    getConversationEvents,
    getTaskEvents,
    getAgentEvents,
    reset,
  };
});
