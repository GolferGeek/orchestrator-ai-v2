/**
 * Claude Code Service
 *
 * API client for the Super Admin Claude Code panel.
 * Connects to /super-admin endpoints for executing Claude Code commands.
 */

import { apiService } from './apiService';

export interface ClaudeCommand {
  name: string;
  description: string;
}

export interface ClaudeSkill {
  name: string;
  description: string;
}

export interface ClaudeHealthResponse {
  status: string;
  sdkAvailable: boolean;
  nodeEnv: string;
}

export interface ContentBlock {
  type: string;
  text?: string;
  // Tool use block fields
  id?: string;
  name?: string;
  input?: unknown;
}

export interface RawMessageStreamEvent {
  type: string;
  index?: number;
  content_block?: ContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  // Additional event types
  message?: {
    id?: string;
    type?: string;
    role?: string;
    content?: ContentBlock[];
    model?: string;
    stop_reason?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ClaudeMessage {
  type:
    | 'system'
    | 'assistant'
    | 'user'
    | 'result'
    | 'stream_event'
    | 'error'
    | 'session'
    | 'tool_progress';
  message?: {
    content: string | ContentBlock[];
  };
  result?: unknown;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
  sessionId?: string;
  // Tool progress fields (from SDK tool_progress events)
  tool_use_id?: string;
  tool_name?: string;
  elapsed_time_seconds?: number;
  parent_tool_use_id?: string | null;
  // Stream event fields (for parsing tool_use blocks)
  event?: RawMessageStreamEvent;
}

/**
 * Active tool execution tracking
 */
export interface ActiveTool {
  id: string;
  name: string;
  startTime: number;
  elapsedSeconds: number;
  status: 'running' | 'completed' | 'error';
}

/**
 * Fun verbs for tool progress display (like Claude Code CLI)
 */
export const TOOL_VERBS: Record<string, string[]> = {
  Read: ['Reading', 'Scanning', 'Examining', 'Perusing', 'Inspecting'],
  Write: ['Writing', 'Crafting', 'Composing', 'Creating', 'Generating'],
  Edit: ['Editing', 'Modifying', 'Tweaking', 'Refining', 'Adjusting'],
  Bash: ['Executing', 'Running', 'Processing', 'Computing', 'Operating'],
  Glob: ['Searching', 'Finding', 'Locating', 'Discovering', 'Scanning'],
  Grep: ['Searching', 'Hunting', 'Scanning', 'Probing', 'Investigating'],
  Task: ['Delegating', 'Spawning', 'Launching', 'Dispatching', 'Orchestrating'],
  WebFetch: ['Fetching', 'Retrieving', 'Downloading', 'Pulling', 'Grabbing'],
  WebSearch: ['Searching', 'Querying', 'Exploring', 'Investigating', 'Researching'],
  TodoWrite: ['Planning', 'Organizing', 'Tracking', 'Managing', 'Scheduling'],
  default: ['Processing', 'Working', 'Thinking', 'Computing', 'Analyzing'],
};

/**
 * Get a random verb for a tool
 */
export function getToolVerb(toolName: string): string {
  const verbs = TOOL_VERBS[toolName] || TOOL_VERBS.default;
  return verbs[Math.floor(Math.random() * verbs.length)];
}

export interface ExecuteResult {
  abortController: AbortController;
  sessionId?: string;
}

class ClaudeCodeService {
  private readonly baseUrl: string;

  constructor() {
    const apiPort = import.meta.env.VITE_API_PORT || '6100';
    this.baseUrl = import.meta.env.VITE_API_URL || `http://localhost:${apiPort}`;
  }

  /**
   * Check if the Claude Code server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response =
        await apiService.get<ClaudeHealthResponse>('/super-admin/health');
      return response.status === 'ok' && response.sdkAvailable === true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available commands
   */
  async getCommands(): Promise<ClaudeCommand[]> {
    try {
      const response = await apiService.get<{ commands: ClaudeCommand[] }>(
        '/super-admin/commands',
      );
      return response.commands || [];
    } catch (error) {
      console.error('Failed to fetch commands:', error);
      return [];
    }
  }

  /**
   * Get list of available skills
   */
  async getSkills(): Promise<ClaudeSkill[]> {
    try {
      const response = await apiService.get<{ skills: ClaudeSkill[] }>(
        '/super-admin/skills',
      );
      return response.skills || [];
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      return [];
    }
  }

  /**
   * Execute a prompt/command and stream results
   * Returns an AbortController for cancellation
   * Supports session resumption for multi-turn conversations
   * Supports source context to provide app-specific guidance
   */
  async execute(
    prompt: string,
    onMessage: (message: ClaudeMessage) => void,
    onError: (error: Error) => void,
    onComplete: (sessionId?: string) => void,
    sessionId?: string,
    sourceContext?: 'web-app' | 'orch-flow' | 'default',
  ): Promise<AbortController> {
    const abortController = new AbortController();
    // TokenStorageService migrates tokens to sessionStorage, so check there first
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');

    // Track session ID from the response
    let currentSessionId: string | undefined = sessionId;

    try {
      const response = await fetch(`${this.baseUrl}/super-admin/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt, sessionId, sourceContext }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Process the SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              onComplete(currentSessionId);
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            let currentEvent = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (data) {
                  try {
                    const parsed = JSON.parse(data);

                    // Capture session ID from session or done events
                    if (currentEvent === 'session' && parsed.sessionId) {
                      currentSessionId = parsed.sessionId;
                      // Don't call onMessage for session events - just capture the ID
                      continue;
                    }

                    if (currentEvent === 'done') {
                      // Done event may include sessionId
                      if (parsed.sessionId) {
                        currentSessionId = parsed.sessionId;
                      }
                      onComplete(currentSessionId);
                      return;
                    }

                    if (currentEvent === 'error') {
                      onError(new Error(parsed.error || 'Unknown error'));
                      return;
                    }

                    onMessage({
                      type: (currentEvent as ClaudeMessage['type']) || 'message',
                      ...parsed,
                    });
                  } catch {
                    // Skip invalid JSON lines
                    console.debug('Skipping invalid JSON:', data);
                  }
                }
              }
            }
          }
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            console.log('Stream aborted by user');
          } else {
            onError(error as Error);
          }
        }
      };

      processStream();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted by user');
      } else {
        onError(error as Error);
      }
    }

    return abortController;
  }

  /**
   * Extract text content from a Claude message
   */
  extractContent(message: ClaudeMessage): string {
    if (!message.message?.content) {
      return '';
    }

    const content = message.message.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text)
        .join('\n');
    }

    return '';
  }
}

export const claudeCodeService = new ClaudeCodeService();
