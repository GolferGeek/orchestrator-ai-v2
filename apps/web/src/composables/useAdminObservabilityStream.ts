import { ref, onUnmounted, computed } from 'vue';
import { useAuthStore, useRbacStore } from '@/stores/rbacStore';

/**
 * ObservabilityEvent
 *
 * Events received from the admin observability SSE stream.
 * These are monitoring/display events, not part of the A2A execution flow.
 * Use the flat properties directly for filtering and display.
 */
export interface ObservabilityEvent {
  /** ExecutionContext capsule - optional, may be present for newer events */
  context?: {
    conversationId?: string;
    taskId?: string;
    orgSlug?: string;
    userId?: string;
    agentSlug?: string;
    [key: string]: unknown;
  };
  /** Database record ID */
  id?: number;
  /** Source application identifier */
  source_app?: string;
  /** Session identifier */
  session_id?: string;
  /** Event type (e.g., 'langgraph.started', 'agent.progress') */
  hook_event_type?: string;
  /** Alternative event type field */
  event_type?: string;
  /** User ID (from context, stored flat for DB) */
  user_id?: string | null;
  /** Username (resolved from userId) */
  username?: string | null;
  /** Conversation ID (from context, stored flat for DB) */
  conversation_id?: string | null;
  /** Task ID (from context, stored flat for DB) */
  task_id?: string;
  /** Agent slug (from context, stored flat for DB) */
  agent_slug?: string | null;
  /** Organization slug (from context, stored flat for DB) */
  organization_slug?: string | null;
  /** Mode (plan, build, converse) */
  mode?: string | null;
  /** Event status */
  status?: string;
  /** Human-readable message */
  message?: string | null;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current step/phase name */
  step?: string;
  /** Full event payload */
  payload?: Record<string, unknown>;
  /** Alternative payload field */
  data?: Record<string, unknown>;
  /** Result for completed events */
  result?: unknown;
  /** Error for failed events */
  error?: unknown;
  /** Unix timestamp (milliseconds) */
  timestamp?: number;
  /** ISO timestamp string */
  created_at?: string;
}

export interface AgentActivity {
  agentSlug: string;
  conversationId: string | null;
  username: string | null;
  organizationSlug: string | null;
  lastEvent: ObservabilityEvent;
  events: ObservabilityEvent[];
  status: 'active' | 'idle' | 'error';
}

/**
 * Composable for connecting to the admin observability SSE stream
 * Provides real-time monitoring of all agent executions
 */
export function useAdminObservabilityStream() {
  const authStore = useAuthStore();
  const rbacStore = useRbacStore();
  
  // Connection state
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref<string | null>(null);
  const lastHeartbeat = ref<Date | null>(null);
  
  // Events storage
  const allEvents = ref<ObservabilityEvent[]>([]);
  const recentEvents = computed(() => allEvents.value.slice(-100)); // Last 100 events

  // Helper function to check if event is recent (within 5 minutes)
  const isRecentEvent = (event: ObservabilityEvent): boolean => {
    // Check for timestamp in various formats
    let eventTime: number;
    if (event.timestamp) {
      eventTime = typeof event.timestamp === 'number' ? event.timestamp : parseInt(event.timestamp as string, 10);
    } else if (event.created_at) {
      eventTime = new Date(event.created_at).getTime();
    } else if ('createdAt' in event && typeof (event as Record<string, unknown>).createdAt === 'string') {
      eventTime = new Date((event as Record<string, unknown>).createdAt as string).getTime();
    } else {
      eventTime = Date.now();
    }

    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return eventTime > fiveMinutesAgo;
  };

  // Agent activities (grouped by conversation ID)
  // Only shows activities with events from the last 5 minutes
  const agentActivities = computed<Record<string, AgentActivity>>(() => {
    const activities: Record<string, AgentActivity> = {};

    for (const event of allEvents.value) {
      // Use flat properties directly - these are monitoring events, not execution context
      const conversationId = event.context?.conversationId || event.conversation_id || null;
      const taskId = event.context?.taskId || event.task_id || null;
      const orgSlug = event.context?.orgSlug || event.organization_slug || 'unknown-org';
      const userId = event.context?.userId || event.user_id || null;
      const username = event.username || userId || 'Unknown User';

      // Group by conversationId - each conversation gets its own swim lane
      const groupKey = conversationId || taskId;
      if (!groupKey) continue;

      if (!activities[groupKey]) {
        // Determine label based on what ID we're using
        const displayLabel = conversationId
          ? `Conversation ${groupKey.substring(0, 8).toUpperCase()}`
          : `Task ${groupKey.substring(0, 8).toUpperCase()}`;

        activities[groupKey] = {
          agentSlug: displayLabel,
          conversationId: conversationId,
          username: username,
          organizationSlug: orgSlug,
          lastEvent: event,
          events: [],
          status: 'idle',
        };
      }

      const activity = activities[groupKey];

      // Update org/username if we have better data from this event
      if (orgSlug && orgSlug !== 'unknown-org' && activity.organizationSlug === 'unknown-org') {
        activity.organizationSlug = orgSlug;
      }
      if (username && username !== 'Unknown User' && activity.username === 'Unknown User') {
        activity.username = username;
      }

      activity.events.push(event);
      activity.lastEvent = event;

      // Determine status based on event type
      const eventType = event.hook_event_type || event.event_type;

      if (eventType === 'agent.failed' || eventType === 'task.failed' || eventType === 'langgraph.failed') {
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

    // Filter out activities where the last event is older than 5 minutes
    const recentActivities: Record<string, AgentActivity> = {};
    for (const [key, activity] of Object.entries(activities)) {
      if (isRecentEvent(activity.lastEvent)) {
        recentActivities[key] = activity;
      }
    }

    return recentActivities;
  });
  
  // Filter helpers - use context as single source of truth
  // Only shows conversations with events from the last 5 minutes
  const eventsByConversation = computed(() => {
    const byConv: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      const conversationId = event.context?.conversationId || event.conversation_id;
      if (!conversationId) continue;
      if (!isRecentEvent(event)) continue; // Skip events older than 5 minutes
      if (!byConv[conversationId]) {
        byConv[conversationId] = [];
      }
      byConv[conversationId].push(event);
    }
    return byConv;
  });

  const eventsByTask = computed(() => {
    const byTask: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      const taskId = event.context?.taskId || event.task_id;
      if (!taskId) continue;
      if (!byTask[taskId]) {
        byTask[taskId] = [];
      }
      byTask[taskId].push(event);
    }
    return byTask;
  });
  
  // SSE connection
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  /**
   * Connect to the admin observability SSE stream
   */
  async function connect(): Promise<void> {
    if (isConnecting.value || isConnected.value) {
      return;
    }
    
    // Ensure we have an auth token
    const token = authStore.token;
    if (!token) {
      error.value = 'Authentication token required - please log in again';
      return;
    }

    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      error.value = 'Invalid authentication token format';
      return;
    }

    // Check if user has required permission
    if (!rbacStore.isInitialized) {
      try {
        await rbacStore.initialize();
      } catch {
        error.value = 'Failed to check permissions - please refresh the page';
        return;
      }
    }

    // Check for admin:audit permission
    const hasPermission = rbacStore.hasPermission('admin:audit');
    if (!hasPermission) {
      error.value = 'Permission denied: This endpoint requires admin:audit permission. Please contact your administrator.';
      return;
    }

    try {
      isConnecting.value = true;
      error.value = null;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100';
      const url = `${apiUrl}/observability/stream`;

      // Create EventSource with authorization header (via query param as workaround)
      // Note: EventSource doesn't support custom headers, so we'd need to send token as query param
      // OR implement a different auth strategy for SSE. For now, using query param:
      const urlWithAuth = `${url}?token=${encodeURIComponent(token)}`;
      console.log('[Observability] Connecting to SSE stream:', urlWithAuth.replace(token, 'TOKEN_HIDDEN'));
      
      eventSource = new EventSource(urlWithAuth);
      
      eventSource.onopen = () => {
        console.log('[Observability] SSE connection opened');
        isConnected.value = true;
        isConnecting.value = false;
        reconnectAttempts = 0;
        lastHeartbeat.value = new Date();
        error.value = null;
      };
      
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          // Handle heartbeat (SSE comments are not received as messages)
          if (event.data.startsWith(':')) {
            lastHeartbeat.value = new Date();
            return;
          }

          console.log('[Observability] Received SSE message:', event.data);
          const data = JSON.parse(event.data) as ObservabilityEvent;
          console.log('[Observability] Parsed event:', data);
          allEvents.value.push(data);
          lastHeartbeat.value = new Date();

          // Limit stored events to prevent memory issues
          if (allEvents.value.length > 1000) {
            allEvents.value = allEvents.value.slice(-500);
          }
        } catch (error) {
          console.error('[Observability] Failed to parse SSE event:', error, 'Data:', event.data);
        }
      };

      eventSource.onerror = (_event: Event) => {
        // EventSource doesn't provide detailed error info, but we can check readyState
        const readyState = eventSource?.readyState;
        console.error('[Observability] SSE error, readyState:', readyState);
        let errorMessage = 'SSE connection error';

        if (readyState === EventSource.CONNECTING) {
          errorMessage = 'Connection failed - check authentication and network';
        } else if (readyState === EventSource.CLOSED) {
          errorMessage = 'Connection closed - Authentication or permission issue. This endpoint requires admin:audit permission.';
        }

        disconnect();
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          error.value = `${errorMessage} Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
          
          reconnectTimeout = setTimeout(() => {
            connect();
          }, delay);
        } else {
          error.value = `${errorMessage} Maximum reconnection attempts reached. Please verify: 1) User has admin:audit permission, 2) Token is valid, 3) Server is running.`;
        }
      };
    } catch (err) {
      isConnecting.value = false;
      error.value = err instanceof Error ? err.message : 'Connection failed';
    }
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
    
    isConnected.value = false;
    isConnecting.value = false;
  }
  
  /**
   * Clear all stored events
   */
  function clearEvents(): void {
    allEvents.value = [];
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
    return allEvents.value.filter(e => 
      e.context?.agentSlug === agentSlug || e.agent_slug === agentSlug
    );
  }
  
  // Auto-disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    // Connection state
    isConnected,
    isConnecting,
    error,
    lastHeartbeat,
    
    // Events
    allEvents,
    recentEvents,
    agentActivities,
    
    // Filtered views
    eventsByConversation,
    eventsByTask,
    
    // Actions
    connect,
    disconnect,
    clearEvents,
    getConversationEvents,
    getTaskEvents,
    getAgentEvents,
  };
}

