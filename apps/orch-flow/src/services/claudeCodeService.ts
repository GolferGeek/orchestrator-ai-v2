/**
 * Claude Code Service
 *
 * API client for the Claude Code panel.
 * Connects to /super-admin endpoints for executing Claude Code commands.
 * Uses API authentication (token from localStorage) instead of direct Supabase calls.
 */
import type {
  ClaudeCommand,
  ClaudeSkill,
  ClaudeHealthResponse,
  ClaudeMessage,
} from '@/types/claudeCode';

class ClaudeCodeService {
  private readonly baseUrl: string;

  constructor() {
    // Use the API URL from environment or construct from port
    const apiPort = import.meta.env.VITE_API_PORT || '6100';
    this.baseUrl = import.meta.env.VITE_API_URL || `http://127.0.0.1:${apiPort}`;
  }

  /**
   * Get the current auth token from localStorage (auth store)
   */
  private getAuthToken(): string | null {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (!authStorage) {
        return null;
      }
      const { state } = JSON.parse(authStorage);
      return state?.token || null;
    } catch (error) {
      console.error('Error reading auth token from storage:', error);
      return null;
    }
  }

  /**
   * Check if the Claude Code server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const token = this.getAuthToken();
      if (!token) return false;

      const response = await fetch(`${this.baseUrl}/super-admin/health`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return false;

      const data: ClaudeHealthResponse = await response.json();
      return data.status === 'ok' && data.sdkAvailable === true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available commands
   */
  async getCommands(): Promise<ClaudeCommand[]> {
    try {
      const token = this.getAuthToken();
      if (!token) return [];

      const response = await fetch(`${this.baseUrl}/super-admin/commands`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.commands || [];
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
      const token = this.getAuthToken();
      if (!token) return [];

      const response = await fetch(`${this.baseUrl}/super-admin/skills`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.skills || [];
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
    const token = this.getAuthToken();

    if (!token) {
      onError(new Error('Not authenticated'));
      return abortController;
    }

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
                      type: (currentEvent as ClaudeMessage['type']) || 'assistant',
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
