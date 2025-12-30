/**
 * Composable for Claude Code Panel state management
 *
 * Manages the state and logic for the super admin Claude Code panel,
 * including SSE streaming, command execution, and output handling.
 * Persists conversation history and session ID to localStorage for
 * continuity across page refreshes.
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  claudeCodeService,
  getToolVerb,
  type ClaudeCommand,
  type ClaudeSkill,
  type ClaudeMessage,
  type ActiveTool,
} from '@/services/claudeCodeService';

export interface OutputEntry {
  type: 'user' | 'assistant' | 'system' | 'error' | 'info' | 'tool_use' | 'tool_result';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: unknown;
  isStreaming?: boolean;
}

// LocalStorage keys
const STORAGE_KEYS = {
  SESSION_ID: 'claude-code-session-id',
  OUTPUT: 'claude-code-output',
  STATS: 'claude-code-stats',
  HISTORY: 'claude-code-history',
  PINNED: 'claude-code-pinned',
} as const;

/**
 * Stored stats interface for localStorage
 */
interface StoredStats {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Load session ID from localStorage
 */
function loadSessionId(): string | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    return stored || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save session ID to localStorage
 */
function saveSessionId(sessionId: string | undefined): void {
  try {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load output history from localStorage
 */
function loadOutput(): OutputEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.OUTPUT);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as Array<{
      type: OutputEntry['type'];
      content: string;
      timestamp: string;
    }>;

    // Convert timestamp strings back to Date objects
    return parsed.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    }));
  } catch {
    return [];
  }
}

/**
 * Save output history to localStorage
 */
function saveOutput(entries: OutputEntry[]): void {
  try {
    // Keep only the last 100 entries to prevent localStorage bloat
    const toSave = entries.slice(-100);
    localStorage.setItem(STORAGE_KEYS.OUTPUT, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Load stats from localStorage
 */
function loadStats(): StoredStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STATS);
    if (!stored) return { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0 };
    return JSON.parse(stored) as StoredStats;
  } catch {
    return { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0 };
  }
}

/**
 * Save stats to localStorage
 */
function saveStats(stats: StoredStats): void {
  try {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load command history from localStorage
 */
function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save command history to localStorage
 */
function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load pinned commands from localStorage
 */
function loadPinnedCommands(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PINNED);
    return stored ? JSON.parse(stored) : ['/test', '/commit', '/create-pr', '/monitor'];
  } catch {
    return ['/test', '/commit', '/create-pr', '/monitor'];
  }
}

/**
 * Save pinned commands to localStorage
 */
function savePinnedCommands(pinned: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PINNED, JSON.stringify(pinned));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all persisted state
 */
function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.OUTPUT);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    // Don't clear history and pinned commands on clear - they persist across sessions
  } catch {
    // Ignore storage errors
  }
}

export function useClaudeCodePanel() {
  // Server state
  const isServerAvailable = ref(false);
  const isCheckingServer = ref(false);

  // Execution state
  const isExecuting = ref(false);
  const prompt = ref('');
  const abortController = ref<AbortController | null>(null);

  // Session state for multi-turn conversations - load from localStorage
  const sessionId = ref<string | undefined>(loadSessionId());

  // Output state - load from localStorage
  const output = ref<OutputEntry[]>(loadOutput());
  const currentAssistantMessage = ref('');

  // Tool progress state
  const activeTools = ref<Map<string, ActiveTool>>(new Map());
  const currentToolVerb = ref('');
  const toolVerbsCache = new Map<string, string>(); // Cache verbs per tool ID

  // Available commands and skills
  const commands = ref<ClaudeCommand[]>([]);
  const skills = ref<ClaudeSkill[]>([]);

  // Stats - load from localStorage
  const storedStats = loadStats();
  const totalCost = ref(storedStats.totalCost);
  const totalInputTokens = ref(storedStats.totalInputTokens);
  const totalOutputTokens = ref(storedStats.totalOutputTokens);

  // Command history - load from localStorage
  const commandHistory = ref<string[]>(loadHistory());
  const historyIndex = ref(-1);
  const isNavigatingHistory = ref(false);

  // Pinned commands - load from localStorage
  const pinnedCommands = ref<string[]>(loadPinnedCommands());

  // Computed
  const canExecute = computed(
    () =>
      isServerAvailable.value && !isExecuting.value && prompt.value.trim() !== '',
  );

  const hasOutput = computed(() => output.value.length > 0);

  /**
   * Check if the server is available
   */
  async function checkServer(): Promise<void> {
    isCheckingServer.value = true;
    try {
      isServerAvailable.value = await claudeCodeService.isAvailable();
    } catch {
      isServerAvailable.value = false;
    } finally {
      isCheckingServer.value = false;
    }
  }

  /**
   * Load available commands
   */
  async function loadCommands(): Promise<void> {
    try {
      commands.value = await claudeCodeService.getCommands();
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  }

  /**
   * Load available skills
   */
  async function loadSkills(): Promise<void> {
    try {
      skills.value = await claudeCodeService.getSkills();
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  }

  /**
   * Add entry to output
   */
  function addOutput(
    type: OutputEntry['type'],
    content: string,
  ): void {
    output.value.push({
      type,
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Save command to history
   */
  function saveToHistory(command: string): void {
    const trimmed = command.trim();
    if (!trimmed) return;

    // Dedupe - don't add if it's the same as the last entry
    if (commandHistory.value[0] !== trimmed) {
      commandHistory.value.unshift(trimmed);
      // Limit to 50 entries
      commandHistory.value = commandHistory.value.slice(0, 50);
      saveHistory(commandHistory.value);
    }
  }

  /**
   * Navigate command history (up/down arrows)
   */
  function navigateHistory(direction: 'up' | 'down'): void {
    isNavigatingHistory.value = true;

    if (direction === 'up' && historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++;
      prompt.value = commandHistory.value[historyIndex.value];
    } else if (direction === 'down' && historyIndex.value > -1) {
      historyIndex.value--;
      prompt.value = historyIndex.value === -1 ? '' : commandHistory.value[historyIndex.value];
    }

    // Reset flag after a short delay
    setTimeout(() => {
      isNavigatingHistory.value = false;
    }, 10);
  }

  /**
   * Pin a command
   */
  function pinCommand(command: string): void {
    if (!pinnedCommands.value.includes(command)) {
      pinnedCommands.value.push(command);
      savePinnedCommands(pinnedCommands.value);
    }
  }

  /**
   * Unpin a command
   */
  function unpinCommand(command: string): void {
    pinnedCommands.value = pinnedCommands.value.filter((c) => c !== command);
    savePinnedCommands(pinnedCommands.value);
  }

  /**
   * Reorder pinned commands
   */
  function reorderPinnedCommands(newOrder: string[]): void {
    pinnedCommands.value = newOrder;
    savePinnedCommands(pinnedCommands.value);
  }

  /**
   * Execute the current prompt
   * Automatically resumes session if one exists for multi-turn conversation
   */
  async function execute(): Promise<void> {
    if (!canExecute.value) return;

    const currentPrompt = prompt.value.trim();

    // Save to history before clearing
    saveToHistory(currentPrompt);

    isExecuting.value = true;
    currentAssistantMessage.value = '';

    // Add user input to output
    addOutput('user', currentPrompt);

    // Clear prompt after sending
    prompt.value = '';

    // Reset history index
    historyIndex.value = -1;

    try {
      abortController.value = await claudeCodeService.execute(
        currentPrompt,
        handleMessage,
        handleError,
        handleComplete,
        sessionId.value, // Pass session ID for resumption
        'web-app', // Pass source context for app-specific guidance
      );
    } catch (error) {
      handleError(error as Error);
    }
  }

  /**
   * Handle tool progress events
   */
  function handleToolProgress(message: ClaudeMessage): void {
    const toolId = message.tool_use_id;
    const toolName = message.tool_name;
    const elapsed = message.elapsed_time_seconds || 0;

    if (!toolId || !toolName) return;

    // Get or create a verb for this tool
    if (!toolVerbsCache.has(toolId)) {
      toolVerbsCache.set(toolId, getToolVerb(toolName));
    }
    const verb = toolVerbsCache.get(toolId) || 'Processing';
    currentToolVerb.value = `${verb}...`;

    // Update active tools
    const existing = activeTools.value.get(toolId);
    if (existing) {
      activeTools.value.set(toolId, { ...existing, elapsedSeconds: elapsed });
    } else {
      activeTools.value.set(toolId, {
        id: toolId,
        name: toolName,
        startTime: Date.now(),
        elapsedSeconds: elapsed,
        status: 'running',
      });
    }
    // Trigger reactivity
    activeTools.value = new Map(activeTools.value);
  }

  // Track tool inputs as they stream in
  const toolInputBuffers = new Map<string, string>();
  // Track which tools we've already displayed
  const displayedTools = new Set<string>();

  /**
   * Handle stream event - detect tool_use blocks starting/completing and stream text
   */
  function handleStreamEvent(message: ClaudeMessage): void {
    const event = message.event;
    if (!event) return;

    // Handle content_block_start for tool_use
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      const toolId = event.content_block.id;
      const toolName = event.content_block.name;

      if (toolId && toolName) {
        // Generate and cache a verb for this tool
        const verb = getToolVerb(toolName);
        toolVerbsCache.set(toolId, verb);
        currentToolVerb.value = `${verb}...`;

        // Initialize input buffer for this tool
        toolInputBuffers.set(toolId, '');

        activeTools.value.set(toolId, {
          id: toolId,
          name: toolName,
          startTime: Date.now(),
          elapsedSeconds: 0,
          status: 'running',
        });
        // Trigger reactivity
        activeTools.value = new Map(activeTools.value);
      }
    }

    // Handle content_block_delta - accumulate tool input JSON or stream text
    if (event.type === 'content_block_delta' && event.delta) {
      // Handle tool input JSON streaming
      if (event.delta.type === 'input_json_delta' && event.delta.partial_json) {
        // Find the tool that's currently receiving input (most recent running tool)
        for (const [toolId] of activeTools.value.entries()) {
          const existingBuffer = toolInputBuffers.get(toolId) || '';
          toolInputBuffers.set(toolId, existingBuffer + event.delta.partial_json);
          break;
        }
      }

      // Handle streaming text
      if (event.delta.type === 'text_delta' && event.delta.text) {
        currentAssistantMessage.value += event.delta.text;
      }
    }

    // Handle content_block_stop - tool finished, display it
    if (event.type === 'content_block_stop' && event.index !== undefined) {
      // Mark most recent running tool as completed and display it
      for (const [id, tool] of activeTools.value.entries()) {
        if (tool.status === 'running') {
          // Parse and display the tool call if we haven't already
          if (!displayedTools.has(id)) {
            displayedTools.add(id);
            const inputJson = toolInputBuffers.get(id) || '';
            let parsedInput: unknown = null;
            try {
              if (inputJson) {
                parsedInput = JSON.parse(inputJson);
              }
            } catch {
              parsedInput = inputJson; // Use raw string if parse fails
            }

            // Add tool use to output
            output.value.push({
              type: 'tool_use',
              content: formatToolCall(tool.name, parsedInput),
              timestamp: new Date(),
              toolName: tool.name,
              toolInput: parsedInput,
            });
          }

          activeTools.value.set(id, { ...tool, status: 'completed' });
          // Trigger reactivity
          activeTools.value = new Map(activeTools.value);
          // Clear verb after tool completes
          setTimeout(() => {
            currentToolVerb.value = '';
            toolVerbsCache.delete(id);
            toolInputBuffers.delete(id);
          }, 500);
          break;
        }
      }
    }

    // Handle message_stop - flush any streaming text
    if (event.type === 'message_stop') {
      if (currentAssistantMessage.value) {
        addOutput('assistant', currentAssistantMessage.value);
        currentAssistantMessage.value = '';
      }
    }
  }

  /**
   * Format a tool call for display
   */
  function formatToolCall(toolName: string, input: unknown): string {
    if (!input) return toolName;

    // Format based on tool type for better readability
    if (toolName === 'Read' && typeof input === 'object' && input !== null) {
      const readInput = input as { file_path?: string };
      return readInput.file_path || JSON.stringify(input);
    }

    if (toolName === 'Glob' && typeof input === 'object' && input !== null) {
      const globInput = input as { pattern?: string; path?: string };
      return globInput.pattern ? `${globInput.pattern}${globInput.path ? ` in ${globInput.path}` : ''}` : JSON.stringify(input);
    }

    if (toolName === 'Grep' && typeof input === 'object' && input !== null) {
      const grepInput = input as { pattern?: string; path?: string; glob?: string };
      let result = grepInput.pattern || '';
      if (grepInput.glob) result += ` (${grepInput.glob})`;
      if (grepInput.path) result += ` in ${grepInput.path}`;
      return result || JSON.stringify(input);
    }

    if (toolName === 'Bash' && typeof input === 'object' && input !== null) {
      const bashInput = input as { command?: string; description?: string };
      return bashInput.description || bashInput.command || JSON.stringify(input);
    }

    if (toolName === 'Edit' && typeof input === 'object' && input !== null) {
      const editInput = input as { file_path?: string };
      return editInput.file_path || JSON.stringify(input);
    }

    if (toolName === 'Write' && typeof input === 'object' && input !== null) {
      const writeInput = input as { file_path?: string };
      return writeInput.file_path || JSON.stringify(input);
    }

    if (toolName === 'WebSearch' && typeof input === 'object' && input !== null) {
      const searchInput = input as { query?: string };
      return searchInput.query || JSON.stringify(input);
    }

    if (toolName === 'WebFetch' && typeof input === 'object' && input !== null) {
      const fetchInput = input as { url?: string };
      return fetchInput.url || JSON.stringify(input);
    }

    if (toolName === 'Task' && typeof input === 'object' && input !== null) {
      const taskInput = input as { description?: string; subagent_type?: string };
      return taskInput.description
        ? `${taskInput.subagent_type || 'agent'}: ${taskInput.description}`
        : JSON.stringify(input);
    }

    // Default: show JSON
    return typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  }

  /**
   * Clear tool progress state
   */
  function clearToolProgress(): void {
    activeTools.value = new Map();
    currentToolVerb.value = '';
    toolVerbsCache.clear();
    toolInputBuffers.clear();
    displayedTools.clear();
  }

  /**
   * Handle incoming message from stream
   */
  function handleMessage(message: ClaudeMessage): void {
    // Debug logging to see what events we're receiving
    console.debug('[Claude SSE]', message.type, message);

    if (message.type === 'assistant') {
      // The 'assistant' message contains the complete response
      // If we've been streaming text via stream_event deltas, flush that first
      if (currentAssistantMessage.value) {
        addOutput('assistant', currentAssistantMessage.value);
        currentAssistantMessage.value = '';
      } else {
        // Fallback: if no streaming happened, extract from the complete message
        const content = claudeCodeService.extractContent(message);
        if (content) {
          addOutput('assistant', content);
        }
      }
    } else if (message.type === 'tool_progress') {
      // Handle tool progress events
      handleToolProgress(message);
    } else if (message.type === 'stream_event') {
      // Handle stream events for tool_use detection and text streaming
      handleStreamEvent(message);
    } else if (message.type === 'result') {
      // Flush any remaining streaming text
      if (currentAssistantMessage.value) {
        addOutput('assistant', currentAssistantMessage.value);
        currentAssistantMessage.value = '';
      }
      // Capture cost and usage stats
      if (message.total_cost_usd) {
        totalCost.value += message.total_cost_usd;
      }
      if (message.usage) {
        totalInputTokens.value += message.usage.input_tokens || 0;
        totalOutputTokens.value += message.usage.output_tokens || 0;
      }
      // Clear tool state on result
      clearToolProgress();
    } else if (message.type === 'system') {
      // Don't log all system messages, just important ones
      // addOutput('system', JSON.stringify(message, null, 2));
    }
  }

  /**
   * Handle stream error
   */
  function handleError(error: Error): void {
    isExecuting.value = false;

    // Flush any pending assistant message
    if (currentAssistantMessage.value) {
      addOutput('assistant', currentAssistantMessage.value);
      currentAssistantMessage.value = '';
    }

    addOutput('error', `Error: ${error.message}`);
  }

  /**
   * Handle stream completion
   * Captures session ID for future resumption and persists state
   */
  function handleComplete(newSessionId?: string): void {
    isExecuting.value = false;

    // Store session ID for next execution
    if (newSessionId) {
      sessionId.value = newSessionId;
      saveSessionId(newSessionId);
    }

    // Clear any leftover streaming state (shouldn't be any now)
    currentAssistantMessage.value = '';
    clearToolProgress();

    addOutput('info', '✓ Execution completed');

    // Persist output and stats to localStorage
    saveOutput(output.value);
    saveStats({
      totalCost: totalCost.value,
      totalInputTokens: totalInputTokens.value,
      totalOutputTokens: totalOutputTokens.value,
    });
  }

  /**
   * Cancel current execution
   */
  function cancel(): void {
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
    isExecuting.value = false;
    // Clear tool progress state
    clearToolProgress();
    addOutput('info', '⚠ Execution cancelled');
  }

  /**
   * Clear output history and start a new session
   * Also clears localStorage to ensure fresh start on refresh
   */
  function clearOutput(): void {
    output.value = [];
    currentAssistantMessage.value = '';
    sessionId.value = undefined; // Clear session to start fresh
    totalCost.value = 0;
    totalInputTokens.value = 0;
    totalOutputTokens.value = 0;
    // Clear tool progress state
    clearToolProgress();

    // Clear persisted state
    clearPersistedState();
  }

  /**
   * Insert a command into the prompt
   */
  function insertCommand(command: string): void {
    prompt.value = command;
  }

  // Initialize on mount
  onMounted(async () => {
    await checkServer();
    if (isServerAvailable.value) {
      await Promise.all([loadCommands(), loadSkills()]);
    }
  });

  // Reset history index when prompt changes manually (not during navigation)
  watch(prompt, () => {
    if (!isNavigatingHistory.value) {
      historyIndex.value = -1;
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (abortController.value) {
      abortController.value.abort();
    }
  });

  return {
    // State
    isServerAvailable,
    isCheckingServer,
    isExecuting,
    prompt,
    output,
    currentAssistantMessage,
    commands,
    skills,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    sessionId, // Expose session ID for UI indicators
    commandHistory,
    historyIndex,
    pinnedCommands,

    // Tool progress state
    activeTools,
    currentToolVerb,

    // Computed
    canExecute,
    hasOutput,

    // Actions
    checkServer,
    loadCommands,
    loadSkills,
    execute,
    cancel,
    clearOutput,
    insertCommand,
    navigateHistory,
    pinCommand,
    unpinCommand,
    reorderPinnedCommands,
  };
}
