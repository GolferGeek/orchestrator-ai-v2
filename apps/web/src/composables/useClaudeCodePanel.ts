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
  type ClaudeCommand,
  type ClaudeSkill,
  type ClaudeMessage,
} from '@/services/claudeCodeService';

export interface OutputEntry {
  type: 'user' | 'assistant' | 'system' | 'error' | 'info';
  content: string;
  timestamp: Date;
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
      );
    } catch (error) {
      handleError(error as Error);
    }
  }

  /**
   * Handle incoming message from stream
   */
  function handleMessage(message: ClaudeMessage): void {
    if (message.type === 'assistant') {
      const content = claudeCodeService.extractContent(message);
      if (content) {
        currentAssistantMessage.value += content;
      }
    } else if (message.type === 'result') {
      // Capture cost and usage stats
      if (message.total_cost_usd) {
        totalCost.value += message.total_cost_usd;
      }
      if (message.usage) {
        totalInputTokens.value += message.usage.input_tokens || 0;
        totalOutputTokens.value += message.usage.output_tokens || 0;
      }
    } else if (message.type === 'system') {
      addOutput('system', JSON.stringify(message, null, 2));
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

    // Flush any pending assistant message
    if (currentAssistantMessage.value) {
      addOutput('assistant', currentAssistantMessage.value);
      currentAssistantMessage.value = '';
    }

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
