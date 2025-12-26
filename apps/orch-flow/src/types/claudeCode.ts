/**
 * Claude Code Panel Types
 *
 * Type definitions for the Claude Code panel integration.
 */

export interface OutputEntry {
  type: 'user' | 'assistant' | 'system' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

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

export interface ClaudeMessage {
  type:
    | 'system'
    | 'assistant'
    | 'user'
    | 'result'
    | 'stream_event'
    | 'error'
    | 'session';
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
}

export interface ContentBlock {
  type: string;
  text?: string;
}

export interface StoredStats {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface ClaudeCodePanelState {
  isServerAvailable: boolean;
  isCheckingServer: boolean;
  isExecuting: boolean;
  prompt: string;
  output: OutputEntry[];
  currentAssistantMessage: string;
  commands: ClaudeCommand[];
  skills: ClaudeSkill[];
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionId: string | undefined;
  commandHistory: string[];
  historyIndex: number;
  pinnedCommands: string[];
}
