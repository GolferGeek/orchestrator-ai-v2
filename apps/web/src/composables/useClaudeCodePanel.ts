/**
 * Composable for Claude Code Panel state management
 *
 * Manages the state and logic for the super admin Claude Code panel,
 * including SSE streaming, command execution, and output handling.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
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

export function useClaudeCodePanel() {
  // Server state
  const isServerAvailable = ref(false);
  const isCheckingServer = ref(false);

  // Execution state
  const isExecuting = ref(false);
  const prompt = ref('');
  const abortController = ref<AbortController | null>(null);

  // Output state
  const output = ref<OutputEntry[]>([]);
  const currentAssistantMessage = ref('');

  // Available commands and skills
  const commands = ref<ClaudeCommand[]>([]);
  const skills = ref<ClaudeSkill[]>([]);

  // Stats
  const totalCost = ref(0);
  const totalInputTokens = ref(0);
  const totalOutputTokens = ref(0);

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
   * Execute the current prompt
   */
  async function execute(): Promise<void> {
    if (!canExecute.value) return;

    const currentPrompt = prompt.value.trim();
    isExecuting.value = true;
    currentAssistantMessage.value = '';

    // Add user input to output
    addOutput('user', currentPrompt);

    // Clear prompt after sending
    prompt.value = '';

    try {
      abortController.value = await claudeCodeService.execute(
        currentPrompt,
        handleMessage,
        handleError,
        handleComplete,
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
   */
  function handleComplete(): void {
    isExecuting.value = false;

    // Flush any pending assistant message
    if (currentAssistantMessage.value) {
      addOutput('assistant', currentAssistantMessage.value);
      currentAssistantMessage.value = '';
    }

    addOutput('info', '✓ Execution completed');
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
   * Clear output history
   */
  function clearOutput(): void {
    output.value = [];
    currentAssistantMessage.value = '';
    totalCost.value = 0;
    totalInputTokens.value = 0;
    totalOutputTokens.value = 0;
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
  };
}
