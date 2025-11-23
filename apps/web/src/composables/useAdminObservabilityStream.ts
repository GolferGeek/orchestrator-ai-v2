import { ref, onUnmounted, computed } from 'vue';
import { useAuthStore, useRbacStore } from '@/stores/rbacStore';

export interface ObservabilityEvent {
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
  
  // Agent activities (grouped by agent slug or task ID)
  const agentActivities = computed<Record<string, AgentActivity>>(() => {
    const activities: Record<string, AgentActivity> = {};
    
    for (const event of allEvents.value) {
      // Get agent identifier - try multiple fields (snake_case and camelCase)
      const agentKey = event.agent_slug || event.agentSlug || event.task_id || event.taskId;
      if (!agentKey) continue;
      
      if (!activities[agentKey]) {
        activities[agentKey] = {
          agentSlug: agentKey,
          lastEvent: event,
          events: [],
          status: 'idle',
        };
      }
      
      const activity = activities[agentKey];
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
    
    return activities;
  });
  
  // Filter helpers
  const eventsByConversation = computed(() => {
    const byConv: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      if (!event.conversation_id) continue;
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
      console.error('❌ [ObservabilityStream] No authentication token available');
      return;
    }
    
    // Validate token format (basic check)
    if (typeof token !== 'string' || token.length < 10) {
      error.value = 'Invalid authentication token format';
      console.error('❌ [ObservabilityStream] Invalid token format:', typeof token, token?.length);
      return;
    }
    
    // Check if user has required permission
    if (!rbacStore.isInitialized) {
      try {
        console.log('🔍 [ObservabilityStream] Initializing RBAC store...');
        await rbacStore.initialize();
      } catch (err) {
        console.error('❌ [ObservabilityStream] Failed to initialize RBAC:', err);
        error.value = 'Failed to check permissions - please refresh the page';
        return;
      }
    }
    
    // Check for admin:audit permission
    const hasPermission = rbacStore.hasPermission('admin:audit');
    if (!hasPermission) {
      error.value = 'Permission denied: This endpoint requires admin:audit permission. Please contact your administrator.';
      console.error('❌ [ObservabilityStream] Permission denied - user does not have admin:audit permission');
      console.error('   User permissions:', rbacStore.userPermissions);
      console.error('   Is super admin:', rbacStore.isSuperAdmin);
      return;
    }
    
    console.log('✅ [ObservabilityStream] Permission check passed - user has admin:audit permission');
    
    try {
      isConnecting.value = true;
      error.value = null;
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100';
      const url = `${apiUrl}/observability/stream`;
      
      // Create EventSource with authorization header (via query param as workaround)
      // Note: EventSource doesn't support custom headers, so we'd need to send token as query param
      // OR implement a different auth strategy for SSE. For now, using query param:
      const urlWithAuth = `${url}?token=${encodeURIComponent(token)}`;
      
      console.log('🔌 [ObservabilityStream] Connecting to:', url);
      console.log('🔌 [ObservabilityStream] Token present:', !!token, token ? `${token.substring(0, 20)}...` : 'none');
      
      eventSource = new EventSource(urlWithAuth);
      
      eventSource.onopen = () => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectAttempts = 0;
        lastHeartbeat.value = new Date();
        error.value = null;
        console.log('✅ [ObservabilityStream] Connected to admin observability stream');
      };
      
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          // Handle heartbeat (SSE comments are not received as messages)
          if (event.data.startsWith(':')) {
            lastHeartbeat.value = new Date();
            return;
          }

          console.log('📥 [ObservabilityStream] SSE Event received:', event.data.substring(0, 200));
          const data = JSON.parse(event.data) as ObservabilityEvent;
          console.log('📥 [ObservabilityStream] Parsed event:', data.event_type || data.hook_event_type, data);
          allEvents.value.push(data);
          lastHeartbeat.value = new Date();
          
          // Limit stored events to prevent memory issues
          if (allEvents.value.length > 1000) {
            allEvents.value = allEvents.value.slice(-500);
          }
        } catch (err) {
          console.error('❌ [ObservabilityStream] Failed to parse SSE message:', err);
        }
      };
      
      eventSource.onerror = (event: Event) => {
        // EventSource doesn't provide detailed error info, but we can check readyState
        const readyState = eventSource?.readyState;
        let errorMessage = 'SSE connection error';
        
        if (readyState === EventSource.CONNECTING) {
          errorMessage = 'Connection failed - check authentication and network';
        } else if (readyState === EventSource.CLOSED) {
          // Connection closed immediately usually means auth/permission failure
          errorMessage = 'Connection closed - Authentication or permission issue. This endpoint requires admin:audit permission.';
          console.error('❌ [ObservabilityStream] Connection closed immediately - likely permission issue');
          console.error('   Required permission: admin:audit');
          console.error('   Check that your user has this permission in the RBAC system');
        }
        
        console.error(`❌ [ObservabilityStream] ${errorMessage}`, {
          readyState,
          url: urlWithAuth.substring(0, urlWithAuth.indexOf('token=') + 20) + '...',
          hasToken: !!token,
          readyStateText: readyState === EventSource.CONNECTING ? 'CONNECTING' : readyState === EventSource.OPEN ? 'OPEN' : 'CLOSED'
        });
        
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
      console.error('Failed to connect to observability stream:', err);
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

