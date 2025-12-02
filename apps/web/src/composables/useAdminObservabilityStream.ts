import { ref, onUnmounted, computed } from 'vue';
import { useAuthStore, useRbacStore } from '@/stores/rbacStore';

/**
 * ObservabilityEvent
 *
 * Events received from the admin observability SSE stream.
 * All identity fields come from context - no duplication.
 */
export interface ObservabilityEvent {
  /** ExecutionContext capsule - contains all identity fields */
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
  /** Event type (e.g., 'langgraph.started', 'agent.progress') */
  hook_event_type?: string;
  /** Event status */
  status?: string;
  /** Human-readable message */
  message?: string | null;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Current step/phase name */
  step?: string;
  /** Full event payload (includes mode, sequence, totalSteps, username, etc.) */
  payload?: Record<string, unknown>;
  /** Unix timestamp (milliseconds) */
  timestamp?: number;
  /** ISO timestamp from database */
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
    const isRecent = eventTime > fiveMinutesAgo;
    console.log(`[Observability] isRecentEvent check: eventTime=${eventTime}, now=${Date.now()}, fiveMinAgo=${fiveMinutesAgo}, isRecent=${isRecent}, event.timestamp=${event.timestamp}, event.created_at=${event.created_at}`);
    return isRecent;
  };

  // Agent activities (grouped by conversation ID)
  // Only shows activities with events from the last 5 minutes
  const agentActivities = computed<Record<string, AgentActivity>>(() => {
    console.log(`[Observability] agentActivities computing... allEvents.length=${allEvents.value.length}`);
    const activities: Record<string, AgentActivity> = {};

    for (const event of allEvents.value) {
      const conversationId = event.context?.conversationId || null;
      const taskId = event.context?.taskId || null;
      const orgSlug = event.context?.orgSlug || 'unknown-org';
      const userId = event.context?.userId || null;
      const username = (event.payload?.username as string) || userId || 'Unknown User';

      console.log(`[Observability] Processing event: conversationId=${conversationId}, taskId=${taskId}, hook_event_type=${event.hook_event_type}`);

      // Group by conversationId - each conversation gets its own swim lane
      const groupKey = conversationId || taskId;
      if (!groupKey) {
        console.log(`[Observability] ⚠️ Skipping event - no groupKey (conversationId or taskId)`);
        continue;
      }

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
      const eventType = event.hook_event_type;

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
    console.log(`[Observability] Built ${Object.keys(activities).length} activities before time filtering`);
    const recentActivities: Record<string, AgentActivity> = {};
    for (const [key, activity] of Object.entries(activities)) {
      const recent = isRecentEvent(activity.lastEvent);
      console.log(`[Observability] Activity ${key}: ${activity.events.length} events, status=${activity.status}, isRecent=${recent}`);
      if (recent) {
        recentActivities[key] = activity;
      }
    }

    console.log(`[Observability] Returning ${Object.keys(recentActivities).length} recent activities`);
    return recentActivities;
  });
  
  // Filter helpers - use context as single source of truth
  // Only shows conversations with events from the last 5 minutes
  const eventsByConversation = computed(() => {
    const byConv: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      const conversationId = event.context?.conversationId;
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
      const taskId = event.context?.taskId;
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
    console.log('[Observability] 🔌 connect() called');
    console.log('[Observability] Current state: isConnecting=', isConnecting.value, 'isConnected=', isConnected.value);

    if (isConnecting.value || isConnected.value) {
      console.log('[Observability] Already connecting or connected, returning');
      return;
    }

    // Ensure we have an auth token
    const token = authStore.token;
    console.log('[Observability] Auth token present:', !!token, 'length:', token?.length);
    if (!token) {
      error.value = 'Authentication token required - please log in again';
      console.error('[Observability] ❌ No auth token');
      return;
    }

    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      error.value = 'Invalid authentication token format';
      console.error('[Observability] ❌ Invalid token format');
      return;
    }

    // Check if user has required permission
    console.log('[Observability] Checking RBAC permissions...');
    if (!rbacStore.isInitialized) {
      console.log('[Observability] RBAC not initialized, initializing...');
      try {
        await rbacStore.initialize();
        console.log('[Observability] RBAC initialized');
      } catch (e) {
        error.value = 'Failed to check permissions - please refresh the page';
        console.error('[Observability] ❌ RBAC initialization failed:', e);
        return;
      }
    }

    // Check for admin:audit permission
    const hasPermission = rbacStore.hasPermission('admin:audit');
    console.log('[Observability] Has admin:audit permission:', hasPermission);
    if (!hasPermission) {
      error.value = 'Permission denied: This endpoint requires admin:audit permission. Please contact your administrator.';
      console.error('[Observability] ❌ Missing admin:audit permission');
      return;
    }

    try {
      isConnecting.value = true;
      error.value = null;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100';
      const url = `${apiUrl}/observability/stream`;
      console.log('[Observability] API URL:', apiUrl);
      console.log('[Observability] Stream URL:', url);

      // Create EventSource with authorization header (via query param as workaround)
      // Note: EventSource doesn't support custom headers, so we'd need to send token as query param
      // OR implement a different auth strategy for SSE. For now, using query param:
      const urlWithAuth = `${url}?token=${encodeURIComponent(token)}`;
      console.log('[Observability] 🔌 Connecting to SSE stream:', urlWithAuth.replace(token, 'TOKEN_HIDDEN'));
      
      eventSource = new EventSource(urlWithAuth);
      console.log('[Observability] EventSource created');

      eventSource.onopen = () => {
        console.log('[Observability] ✅ SSE connection opened successfully');
        isConnected.value = true;
        isConnecting.value = false;
        reconnectAttempts = 0;
        lastHeartbeat.value = new Date();
        error.value = null;
      };

      eventSource.onmessage = (event: MessageEvent) => {
        console.log('[Observability] 📨 onmessage triggered');
        try {
          // Handle heartbeat (SSE comments are not received as messages)
          if (event.data.startsWith(':')) {
            console.log('[Observability] 💓 Heartbeat received');
            lastHeartbeat.value = new Date();
            return;
          }

          console.log('[Observability] 📨 Received SSE message, raw data length:', event.data?.length);
          console.log('[Observability] 📨 Raw data (first 500 chars):', event.data?.substring(0, 500));
          const data = JSON.parse(event.data) as ObservabilityEvent;

          // Skip connection confirmation events (they don't have context or hook_event_type)
          const eventType = data.hook_event_type || (data as { event_type?: string }).event_type;
          if (eventType === 'connected') {
            console.log('[Observability] ✅ Connection confirmed, skipping storage');
            return;
          }

          console.log('[Observability] ✅ Parsed event:', {
            hook_event_type: data.hook_event_type,
            conversationId: data.context?.conversationId,
            taskId: data.context?.taskId,
            agentSlug: data.context?.agentSlug,
            status: data.status,
            message: data.message?.substring(0, 50),
          });
          allEvents.value.push(data);
          console.log('[Observability] Total events stored:', allEvents.value.length);
          lastHeartbeat.value = new Date();

          // Limit stored events to prevent memory issues
          if (allEvents.value.length > 1000) {
            allEvents.value = allEvents.value.slice(-500);
            console.log('[Observability] Events trimmed to 500');
          }
        } catch (parseError) {
          console.error('[Observability] ❌ Failed to parse SSE event:', parseError);
          console.error('[Observability] ❌ Raw data:', event.data);
        }
      };

      eventSource.onerror = (errorEvent: Event) => {
        // EventSource doesn't provide detailed error info, but we can check readyState
        const readyState = eventSource?.readyState;
        console.error('[Observability] ❌ SSE error event:', errorEvent);
        console.error('[Observability] ❌ ReadyState:', readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSED)');
        let errorMessage = 'SSE connection error';

        if (readyState === EventSource.CONNECTING) {
          errorMessage = 'Connection failed - check authentication and network';
          console.error('[Observability] ❌ State: CONNECTING - likely auth or network issue');
        } else if (readyState === EventSource.CLOSED) {
          errorMessage = 'Connection closed - Authentication or permission issue. This endpoint requires admin:audit permission.';
          console.error('[Observability] ❌ State: CLOSED - server closed connection');
        }

        disconnect();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          error.value = `${errorMessage} Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
          console.log('[Observability] 🔄 Scheduling reconnect attempt', reconnectAttempts, 'in', delay, 'ms');

          reconnectTimeout = setTimeout(() => {
            console.log('[Observability] 🔄 Reconnecting...');
            connect();
          }, delay);
        } else {
          error.value = `${errorMessage} Maximum reconnection attempts reached. Please verify: 1) User has admin:audit permission, 2) Token is valid, 3) Server is running.`;
          console.error('[Observability] ❌ Max reconnect attempts reached');
        }
      };
    } catch (err) {
      isConnecting.value = false;
      error.value = err instanceof Error ? err.message : 'Connection failed';
      console.error('[Observability] ❌ Connection exception:', err);
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
    return allEvents.value.filter(e => e.context?.agentSlug === agentSlug);
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

