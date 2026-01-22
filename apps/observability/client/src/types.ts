// Chat message types for transcript display
export interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  source?: { media_type?: string };
}

export interface Message {
  role?: string;
  content?: string | ContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface ChatMessage {
  role?: string;
  type?: string;
  content?: string | ContentBlock[];
  message?: Message;
  timestamp?: string;
  toolUseID?: string;
  tool_use?: { name?: string };
  tool_result?: { content?: unknown };
  uuid?: string;
  sessionId?: string;
  toolUseResult?: unknown;
  isMeta?: boolean;
}

// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
  status?: 'pending' | 'responded' | 'timeout' | 'error'; // Status property
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, unknown>;
  chat?: ChatMessage[];
  summary?: string;
  timestamp?: number;
  model_name?: string;

  // Enriched fields for observability
  userId?: string;
  username?: string; // display_name or email (human-readable)
  conversationId?: string;
  taskId?: string;
  agentSlug?: string;
  organizationSlug?: string;
  mode?: string;

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;

  // Additional fields used in the UI (from payload or computed)
  eventType?: string; // Alias for hook_event_type
  model?: string; // Model information from payload
  tool_name?: string; // Tool name from payload
  tool_command?: string; // Tool command from payload
  tool_file?: { path?: string; [key: string]: unknown }; // Tool file from payload
  hitl_question?: string; // HITL question from payload
  hitl_permission?: string; // HITL permission from payload
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response';
  data: HookEvent | HookEvent[] | HumanInTheLoopResponse;
}

export type TimeRange = '1m' | '3m' | '5m' | '10m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}