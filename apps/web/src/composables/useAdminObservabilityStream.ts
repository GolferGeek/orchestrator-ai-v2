import { ref, onUnmounted, computed } from 'vue';
import { useAuthStore, useRbacStore } from '@/stores/rbacStore';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';

export interface ObservabilityEvent {
  /** Full ExecutionContext capsule (when available from SSE events) */
  context?: ExecutionContext;
  id?: number;
  source_app?: string;
  session_id?: string;
  hook_event_type?: string;
  event_type?: string; // New field for task/agent events
  user_id?: string | null;
  userId?: string; // Alternative casing from task events
  username?: string | null;
  conversation_id?: string | null;
  task_id?: string;
  taskId?: string; // Alternative casing from task events
  agent_slug?: string | null;
  agentSlug?: string; // Alternative casing from task events
  organization_slug?: string | null;
  mode?: string | null;
  status?: string;
  message?: string | null;
  progress?: number;
  step?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>; // Task events use 'data' instead of 'payload'
  result?: unknown; // For task.completed events
  error?: unknown; // For task.failed events
  timestamp?: number;
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

    // First pass: build a mapping of session_id -> conversation_id
    // This allows us to correlate events that have session_id with their conversation
    const sessionToConversation: Record<string, string> = {};
    for (const event of allEvents.value) {
      const eventRecord = event as Record<string, unknown>;
      const convId = event.conversation_id || eventRecord.conversationId as string;
      const sessId = event.session_id || eventRecord.sessionId as string;
      if (convId && sessId && !sessionToConversation[sessId]) {
        sessionToConversation[sessId] = convId;
      }
    }

    for (const event of allEvents.value) {
      // Group by conversation_id - each conversation gets its own swim lane
      // Use the session->conversation mapping to correlate events
      const eventRecord = event as Record<string, unknown>;
      const sessionId = event.session_id || eventRecord.sessionId as string;
      const directConvId = event.conversation_id || eventRecord.conversationId as string;

      // Try to get conversation_id directly, then via session mapping, then fall back
      const conversationId = directConvId ||
                             (sessionId ? sessionToConversation[sessionId] : undefined) ||
                             sessionId ||
                             event.task_id || eventRecord.taskId as string;
      if (!conversationId) continue;

      if (!activities[conversationId]) {
        // Extract user and org info from first event
        const username = event.username || eventRecord.userName as string || event.user_id || 'Unknown User';
        const organizationSlug = event.organization_slug || eventRecord.organizationSlug as string || 'unknown-org';

        // Determine label based on what ID we're using
        let displayLabel: string;
        if (directConvId || (sessionId && sessionToConversation[sessionId])) {
          displayLabel = `Conversation ${conversationId.substring(0, 8).toUpperCase()}`;
        } else if (sessionId) {
          displayLabel = `Session ${conversationId.substring(0, 8).toUpperCase()}`;
        } else {
          displayLabel = `Task ${conversationId.substring(0, 8).toUpperCase()}`;
        }

        activities[conversationId] = {
          agentSlug: displayLabel,
          conversationId: conversationId,
          username: username,
          organizationSlug: organizationSlug,
          lastEvent: event,
          events: [],
          status: 'idle',
        };
      }

      const activity = activities[conversationId];

      // Update org/username if we have better data from this event
      const eventOrg = event.organization_slug || eventRecord.organizationSlug as string;
      const eventUser = event.username || eventRecord.userName as string;
      if (eventOrg && activity.organizationSlug === 'unknown-org') {
        activity.organizationSlug = eventOrg;
      }
      if (eventUser && activity.username === 'Unknown User') {
        activity.username = eventUser;
      }

      activity.events.push(event);
      activity.lastEvent = event;

      // Determine status based on event type (check both hook_event_type and event_type)
      const eventType = event.hook_event_type || event.event_type;

      if (eventType === 'agent.failed' || eventType === 'task.failed') {
        activity.status = 'error';
      } else if (
        eventType === 'agent.started' ||
        eventType === 'agent.progress' ||
        eventType === 'task.started' ||
        eventType === 'task.progress' ||
        eventType === 'agent.stream.chunk'
      ) {
        activity.status = 'active';
      } else if (
        eventType === 'agent.completed' ||
        eventType === 'task.completed' ||
        eventType === 'agent.stream.complete'
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
  
  // Filter helpers
  // Only shows conversations with events from the last 5 minutes
  const eventsByConversation = computed(() => {
    const byConv: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      if (!event.conversation_id) continue;
      if (!isRecentEvent(event)) continue; // Skip events older than 5 minutes
      if (!byConv[event.conversation_id]) {
        byConv[event.conversation_id] = [];
      }
      byConv[event.conversation_id].push(event);
    }
    return byConv;
  });
  
  const eventsByTask = computed(() => {
    const byTask: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      if (!event.task_id) continue;
      if (!byTask[event.task_id]) {
        byTask[event.task_id] = [];
      }
      byTask[event.task_id].push(event);
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
      
      eventSource = new EventSource(urlWithAuth);
      
      eventSource.onopen = () => {
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

          const data = JSON.parse(event.data) as ObservabilityEvent;
          allEvents.value.push(data);
          lastHeartbeat.value = new Date();

          // Limit stored events to prevent memory issues
          if (allEvents.value.length > 1000) {
            allEvents.value = allEvents.value.slice(-500);
          }
        } catch {
          // Silently ignore parse errors
        }
      };

      eventSource.onerror = (_event: Event) => {
        // EventSource doesn't provide detailed error info, but we can check readyState
        const readyState = eventSource?.readyState;
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
    return allEvents.value.filter(e => e.agent_slug === agentSlug);
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

