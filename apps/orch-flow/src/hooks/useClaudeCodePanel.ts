/**
 * React Hook for Claude Code Panel state management
 *
 * Manages the state and logic for the Claude Code panel,
 * including SSE streaming, command execution, and output handling.
 * Persists conversation history and session ID to localStorage for
 * continuity across page refreshes.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { claudeCodeService } from '@/services/claudeCodeService';
import type {
  OutputEntry,
  ClaudeCommand,
  ClaudeSkill,
  ClaudeMessage,
  StoredStats,
} from '@/types/claudeCode';

// LocalStorage keys
const STORAGE_KEYS = {
  SESSION_ID: 'claude-code-session-id',
  OUTPUT: 'claude-code-output',
  STATS: 'claude-code-stats',
  HISTORY: 'claude-code-history',
  PINNED: 'claude-code-pinned',
} as const;

// Default pinned commands
const DEFAULT_PINNED = ['/test', '/commit', '/create-pr', '/monitor'];

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
    return stored ? JSON.parse(stored) : DEFAULT_PINNED;
  } catch {
    return DEFAULT_PINNED;
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
  const [isServerAvailable, setIsServerAvailable] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Session state for multi-turn conversations - load from localStorage
  const [sessionId, setSessionId] = useState<string | undefined>(() => loadSessionId());

  // Output state - load from localStorage
  const [output, setOutput] = useState<OutputEntry[]>(() => loadOutput());
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');

  // Available commands and skills
  const [commands, setCommands] = useState<ClaudeCommand[]>([]);
  const [skills, setSkills] = useState<ClaudeSkill[]>([]);

  // Stats - load from localStorage
  const [stats, setStats] = useState<StoredStats>(() => loadStats());

  // Command history - load from localStorage
  const [commandHistory, setCommandHistory] = useState<string[]>(() => loadHistory());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isNavigatingHistoryRef = useRef(false);

  // Pinned commands - load from localStorage
  const [pinnedCommands, setPinnedCommands] = useState<string[]>(() => loadPinnedCommands());

  // Computed values
  const canExecute = useMemo(
    () => isServerAvailable && !isExecuting && prompt.trim() !== '',
    [isServerAvailable, isExecuting, prompt]
  );

  const hasOutput = useMemo(() => output.length > 0, [output]);

  /**
   * Check if the server is available
   */
  const checkServer = useCallback(async () => {
    setIsCheckingServer(true);
    try {
      const available = await claudeCodeService.isAvailable();
      setIsServerAvailable(available);
    } catch {
      setIsServerAvailable(false);
    } finally {
      setIsCheckingServer(false);
    }
  }, []);

  /**
   * Load available commands
   */
  const loadCommands = useCallback(async () => {
    try {
      const cmds = await claudeCodeService.getCommands();
      setCommands(cmds);
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  }, []);

  /**
   * Load available skills
   */
  const loadSkills = useCallback(async () => {
    try {
      const sk = await claudeCodeService.getSkills();
      setSkills(sk);
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  }, []);

  /**
   * Add entry to output
   */
  const addOutput = useCallback((type: OutputEntry['type'], content: string) => {
    setOutput((prev) => [
      ...prev,
      {
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  /**
   * Save command to history
   */
  const saveToHistory = useCallback((command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    setCommandHistory((prev) => {
      // Dedupe - don't add if it's the same as the last entry
      if (prev[0] === trimmed) return prev;

      const newHistory = [trimmed, ...prev].slice(0, 50);
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  /**
   * Navigate command history (up/down arrows)
   */
  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      isNavigatingHistoryRef.current = true;

      if (direction === 'up' && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setPrompt(commandHistory[newIndex]);
      } else if (direction === 'down' && historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setPrompt(newIndex === -1 ? '' : commandHistory[newIndex]);
      }

      // Reset flag after a short delay
      setTimeout(() => {
        isNavigatingHistoryRef.current = false;
      }, 10);
    },
    [historyIndex, commandHistory]
  );

  /**
   * Pin a command
   */
  const pinCommand = useCallback((command: string) => {
    setPinnedCommands((prev) => {
      if (prev.includes(command)) return prev;
      const newPinned = [...prev, command];
      savePinnedCommands(newPinned);
      return newPinned;
    });
  }, []);

  /**
   * Unpin a command
   */
  const unpinCommand = useCallback((command: string) => {
    setPinnedCommands((prev) => {
      const newPinned = prev.filter((c) => c !== command);
      savePinnedCommands(newPinned);
      return newPinned;
    });
  }, []);

  /**
   * Reorder pinned commands
   */
  const reorderPinnedCommands = useCallback((newOrder: string[]) => {
    setPinnedCommands(newOrder);
    savePinnedCommands(newOrder);
  }, []);

  /**
   * Handle incoming message from stream
   */
  const handleMessage = useCallback((message: ClaudeMessage) => {
    if (message.type === 'assistant') {
      const content = claudeCodeService.extractContent(message);
      if (content) {
        setCurrentAssistantMessage((prev) => prev + content);
      }
    } else if (message.type === 'result') {
      // Capture cost and usage stats
      setStats((prev) => {
        const newStats = { ...prev };
        if (message.total_cost_usd) {
          newStats.totalCost += message.total_cost_usd;
        }
        if (message.usage) {
          newStats.totalInputTokens += message.usage.input_tokens || 0;
          newStats.totalOutputTokens += message.usage.output_tokens || 0;
        }
        return newStats;
      });
    } else if (message.type === 'system') {
      addOutput('system', JSON.stringify(message, null, 2));
    }
  }, [addOutput]);

  /**
   * Handle stream error
   */
  const handleError = useCallback(
    (error: Error) => {
      setIsExecuting(false);

      // Flush any pending assistant message
      setCurrentAssistantMessage((prev) => {
        if (prev) {
          addOutput('assistant', prev);
        }
        return '';
      });

      addOutput('error', `Error: ${error.message}`);
    },
    [addOutput]
  );

  /**
   * Handle stream completion
   */
  const handleComplete = useCallback(
    (newSessionId?: string) => {
      setIsExecuting(false);

      // Store session ID for next execution
      if (newSessionId) {
        setSessionId(newSessionId);
        saveSessionId(newSessionId);
      }

      // Flush any pending assistant message
      setCurrentAssistantMessage((prev) => {
        if (prev) {
          addOutput('assistant', prev);
        }
        return '';
      });

      addOutput('info', '✓ Execution completed');

      // Persist output and stats to localStorage
      setOutput((currentOutput) => {
        saveOutput(currentOutput);
        return currentOutput;
      });
      setStats((currentStats) => {
        saveStats(currentStats);
        return currentStats;
      });
    },
    [addOutput]
  );

  /**
   * Execute the current prompt
   */
  const execute = useCallback(async () => {
    if (!canExecute) return;

    const currentPrompt = prompt.trim();

    // Save to history before clearing
    saveToHistory(currentPrompt);

    setIsExecuting(true);
    setCurrentAssistantMessage('');

    // Add user input to output
    addOutput('user', currentPrompt);

    // Clear prompt after sending
    setPrompt('');

    // Reset history index
    setHistoryIndex(-1);

    try {
      abortControllerRef.current = await claudeCodeService.execute(
        currentPrompt,
        handleMessage,
        handleError,
        handleComplete,
        sessionId
      );
    } catch (error) {
      handleError(error as Error);
    }
  }, [canExecute, prompt, saveToHistory, addOutput, handleMessage, handleError, handleComplete, sessionId]);

  /**
   * Cancel current execution
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExecuting(false);
    addOutput('info', '⚠ Execution cancelled');
  }, [addOutput]);

  /**
   * Clear output history and start a new session
   */
  const clearOutput = useCallback(() => {
    setOutput([]);
    setCurrentAssistantMessage('');
    setSessionId(undefined);
    setStats({ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0 });

    // Clear persisted state
    clearPersistedState();
  }, []);

  /**
   * Insert a command into the prompt
   */
  const insertCommand = useCallback((command: string) => {
    setPrompt(command);
  }, []);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await checkServer();
    };
    init();
  }, [checkServer]);

  // Load commands/skills when server becomes available
  useEffect(() => {
    if (isServerAvailable) {
      Promise.all([loadCommands(), loadSkills()]);
    }
  }, [isServerAvailable, loadCommands, loadSkills]);

  // Reset history index when prompt changes manually (not during navigation)
  useEffect(() => {
    if (!isNavigatingHistoryRef.current) {
      setHistoryIndex(-1);
    }
  }, [prompt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    isServerAvailable,
    isCheckingServer,
    isExecuting,
    prompt,
    setPrompt,
    output,
    currentAssistantMessage,
    commands,
    skills,
    totalCost: stats.totalCost,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
    sessionId,
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
