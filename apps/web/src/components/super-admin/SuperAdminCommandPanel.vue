<template>
  <div class="panel-overlay" @click.self="$emit('close')">
    <aside class="command-panel" :class="{ 'is-open': true }">
      <!-- Header -->
      <header class="panel-header">
        <div class="header-left">
          <ion-icon :icon="terminalOutline" class="header-icon" />
          <h2>Claude Code Panel</h2>
        </div>
        <div class="header-right">
          <span
            class="status-indicator"
            :class="{ 'is-connected': isServerAvailable, 'is-checking': isCheckingServer }"
            :title="statusTitle"
          >
            <span class="status-dot"></span>
            <span class="status-text">{{ statusText }}</span>
          </span>
          <button class="close-btn" @click="$emit('close')" title="Close panel">
            <ion-icon :icon="closeOutline" />
          </button>
        </div>
      </header>

      <!-- Quick Commands -->
      <div class="quick-commands">
        <div class="quick-commands-header">
          <span class="quick-commands-title">Pinned Commands</span>
        </div>
        <div class="quick-commands-list">
          <div
            v-for="cmd in quickCommands"
            :key="cmd.name"
            class="quick-cmd-wrapper"
          >
            <button
              class="quick-cmd-btn"
              :disabled="!isServerAvailable || isExecuting"
              @click="insertCommand(cmd.name)"
              :title="cmd.description"
            >
              {{ cmd.name }}
            </button>
            <button
              class="quick-cmd-pin-btn"
              @click="unpinCommand(cmd.name)"
              title="Unpin command"
            >
              <ion-icon :icon="star" />
            </button>
          </div>
        </div>
      </div>

      <!-- Output Area -->
      <div ref="outputRef" class="output-area">
        <div v-if="!hasOutput" class="empty-state">
          <ion-icon :icon="codeSlashOutline" class="empty-icon" />
          <p>Enter a command or describe what you want to do</p>
          <p class="hint">Try: /test, /commit, /monitor, or ask in natural language</p>
        </div>

        <div v-else class="output-entries">
          <div
            v-for="(entry, index) in output"
            :key="index"
            class="output-entry"
            :class="'entry-' + entry.type"
          >
            <!-- Tool use entry with special formatting -->
            <template v-if="entry.type === 'tool_use'">
              <span class="tool-icon">{{ getToolIcon(entry.toolName) }}</span>
              <span class="tool-name">{{ entry.toolName }}</span>
              <pre class="tool-input">{{ entry.content }}</pre>
            </template>
            <!-- Regular entry -->
            <template v-else>
              <span v-if="getEntryPrefix(entry.type)" class="entry-prefix">{{ getEntryPrefix(entry.type) }}</span>
              <pre class="entry-content">{{ entry.content }}</pre>
            </template>
          </div>

          <!-- Tool progress indicator -->
          <div v-if="isExecuting && (currentToolVerb || activeTools.size > 0)" class="tool-progress-wrapper">
            <ToolProgress :active-tools="activeTools" :current-verb="currentToolVerb" />
          </div>

          <!-- Current streaming message -->
          <div v-if="currentAssistantMessage" class="output-entry entry-assistant streaming">
            <span class="entry-prefix">Claude:</span>
            <pre class="entry-content">{{ currentAssistantMessage }}</pre>
            <span class="cursor-blink">|</span>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <div class="input-row">
          <div class="input-wrapper">
            <!-- eslint-disable vue/use-v-on-exact -->
            <textarea
              ref="textareaRef"
              v-model="prompt"
              class="prompt-input"
              :placeholder="inputPlaceholder"
              :disabled="!isServerAvailable || isExecuting"
              rows="3"
              @input="handleInput"
              @keydown="handleKeydown"
              @keydown.enter.meta.exact="execute"
              @keydown.enter.ctrl.exact="execute"
            ></textarea>
            <!-- eslint-enable vue/use-v-on-exact -->

            <!-- Auto-complete dropdown -->
            <div
              v-if="showAutoComplete && filteredCommands.length > 0"
              class="autocomplete-dropdown"
            >
              <button
                v-for="(cmd, index) in filteredCommands"
                :key="cmd.name"
                :class="{ 'is-selected': index === autoCompleteSelectedIndex }"
                @click="selectCommand(cmd.name)"
                @mouseenter="autoCompleteSelectedIndex = index"
              >
                <div class="autocomplete-item">
                  <span class="cmd-name">{{ cmd.name }}</span>
                  <span class="cmd-desc">{{ cmd.description }}</span>
                </div>
                <button
                  v-if="!isCommandPinned(cmd.name)"
                  class="autocomplete-pin-btn"
                  @click.stop="togglePin(cmd.name)"
                  title="Pin command"
                >
                  <ion-icon :icon="starOutline" />
                </button>
                <button
                  v-else
                  class="autocomplete-pin-btn pinned"
                  @click.stop="togglePin(cmd.name)"
                  title="Unpin command"
                >
                  <ion-icon :icon="star" />
                </button>
              </button>
            </div>
          </div>
        </div>
        <div class="action-row">
          <div class="action-left">
            <button
              v-if="hasOutput"
              class="action-btn secondary"
              @click="clearOutput"
              :disabled="isExecuting"
              title="Clear output"
            >
              <ion-icon :icon="trashOutline" />
              Clear
            </button>
          </div>
          <div class="action-right">
            <button
              v-if="isExecuting"
              class="action-btn danger"
              @click="cancel"
              title="Cancel execution"
            >
              <ion-icon :icon="stopOutline" />
              Cancel
            </button>
            <button
              v-else
              class="action-btn primary"
              :disabled="!canExecute"
              @click="execute"
              title="Execute command (Cmd/Ctrl+Enter)"
            >
              <ion-icon :icon="playOutline" />
              Execute
            </button>
          </div>
        </div>
      </div>

      <!-- Footer Stats -->
      <footer v-if="totalCost > 0" class="panel-footer">
        <span class="stat">Cost: ${{ totalCost.toFixed(4) }}</span>
        <span class="stat">Tokens: {{ totalInputTokens + totalOutputTokens }}</span>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  terminalOutline,
  closeOutline,
  codeSlashOutline,
  playOutline,
  stopOutline,
  trashOutline,
  starOutline,
  star,
} from 'ionicons/icons';
import { useClaudeCodePanel, type OutputEntry } from '@/composables/useClaudeCodePanel';
import ToolProgress from './ToolProgress.vue';

defineEmits<{
  (e: 'close'): void;
}>();

const {
  isServerAvailable,
  isCheckingServer,
  isExecuting,
  prompt,
  output,
  currentAssistantMessage,
  commands,
  totalCost,
  totalInputTokens,
  totalOutputTokens,
  activeTools,
  currentToolVerb,
  canExecute,
  hasOutput,
  execute,
  cancel,
  clearOutput,
  insertCommand,
  navigateHistory,
  pinCommand,
  unpinCommand,
  pinnedCommands,
} = useClaudeCodePanel();

const outputRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Auto-complete state
const showAutoComplete = ref(false);
const autoCompleteSelectedIndex = ref(0);
const autoCompleteFilter = ref('');

// Quick commands to show as buttons - use pinned commands
const quickCommands = computed(() => {
  // Map pinned command names to command objects
  return pinnedCommands.value.map((name) => {
    const cmd = commands.value.find((c) => c.name === name);
    return cmd || { name, description: '' };
  });
});

// Filtered commands for auto-complete
const filteredCommands = computed(() => {
  if (!autoCompleteFilter.value) {
    return commands.value.slice(0, 10);
  }
  const filter = autoCompleteFilter.value.toLowerCase();
  return commands.value
    .filter((cmd) => cmd.name.toLowerCase().includes(filter))
    .slice(0, 10);
});

// Status display
const statusText = computed(() => {
  if (isCheckingServer.value) return 'Checking...';
  if (isServerAvailable.value) return 'Connected';
  return 'Disconnected';
});

const statusTitle = computed(() => {
  if (isCheckingServer.value) return 'Checking server connection...';
  if (isServerAvailable.value) return 'Connected to Claude Code server';
  return 'Cannot connect to server. Make sure the API is running in development mode.';
});

const inputPlaceholder = computed(() => {
  if (!isServerAvailable.value) return 'Server not available...';
  if (isExecuting.value) return 'Executing...';
  return 'Enter a command like /test or describe what you want... (Cmd/Ctrl+Enter to execute)';
});

// Get prefix for output entry type
function getEntryPrefix(type: OutputEntry['type']): string {
  switch (type) {
    case 'user':
      return 'You:';
    case 'assistant':
      return 'Claude:';
    case 'system':
      return 'System:';
    case 'error':
      return 'Error:';
    case 'info':
      return '';
    case 'tool_use':
      return ''; // Will show tool icon instead
    case 'tool_result':
      return ''; // Will show result icon instead
    default:
      return '';
  }
}

// Get tool icon/emoji based on tool name
function getToolIcon(toolName?: string): string {
  if (!toolName) return '🔧';
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✍️',
    Edit: '✏️',
    Bash: '💻',
    Glob: '🔍',
    Grep: '🔎',
    Task: '🚀',
    WebFetch: '🌐',
    WebSearch: '🔍',
    TodoWrite: '📝',
    Skill: '⚡',
    LSP: '🔗',
  };
  return icons[toolName] || '🔧';
}

// Handle input for auto-complete
function handleInput(e: Event): void {
  const value = (e.target as HTMLTextAreaElement).value;
  const lastSlash = value.lastIndexOf('/');

  if (lastSlash !== -1 && lastSlash === value.length - 1) {
    // Just typed /
    showAutoComplete.value = true;
    autoCompleteFilter.value = '';
    autoCompleteSelectedIndex.value = 0;
  } else if (lastSlash !== -1 && !value.substring(lastSlash).includes(' ')) {
    // Typing after /
    showAutoComplete.value = true;
    autoCompleteFilter.value = value.substring(lastSlash);
    autoCompleteSelectedIndex.value = 0;
  } else {
    showAutoComplete.value = false;
  }
}

// Handle keydown for auto-complete and history
function handleKeydown(e: KeyboardEvent): void {
  // Handle auto-complete navigation
  if (showAutoComplete.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autoCompleteSelectedIndex.value = Math.min(
        autoCompleteSelectedIndex.value + 1,
        filteredCommands.value.length - 1,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autoCompleteSelectedIndex.value = Math.max(autoCompleteSelectedIndex.value - 1, 0);
    } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.metaKey && !e.ctrlKey)) {
      e.preventDefault();
      selectCommand(filteredCommands.value[autoCompleteSelectedIndex.value]?.name);
    } else if (e.key === 'Escape') {
      showAutoComplete.value = false;
    }
    return;
  }

  // Handle command history navigation
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateHistory('up');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateHistory('down');
  }
}

// Select a command from auto-complete
function selectCommand(name: string): void {
  if (!name) return;

  const lastSlash = prompt.value.lastIndexOf('/');
  if (lastSlash !== -1) {
    prompt.value = prompt.value.substring(0, lastSlash) + name + ' ';
  }
  showAutoComplete.value = false;
  autoCompleteSelectedIndex.value = 0;

  // Focus back on textarea
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

// Check if a command is pinned
function isCommandPinned(commandName: string): boolean {
  return pinnedCommands.value.includes(commandName);
}

// Toggle pin for a command
function togglePin(commandName: string): void {
  if (isCommandPinned(commandName)) {
    unpinCommand(commandName);
  } else {
    pinCommand(commandName);
  }
}

// Auto-scroll to bottom when output changes
watch(
  [output, currentAssistantMessage],
  async () => {
    await nextTick();
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight;
    }
  },
  { deep: true },
);
</script>

<style scoped>
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.command-panel {
  width: 480px;
  max-width: 100vw;
  height: 100vh;
  background: var(--ion-background-color, #ffffff);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.2s ease-out;
}

@media (prefers-color-scheme: dark) {
  .command-panel {
    background: var(--ion-background-color, #1a1a1a);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Header */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--ion-border-color);
  background: var(--ion-toolbar-background);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ion-color-medium);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-danger);
}

.status-indicator.is-connected .status-dot {
  background: var(--ion-color-success);
}

.status-indicator.is-checking .status-dot {
  background: var(--ion-color-warning);
  animation: pulse 1s infinite;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  color: var(--ion-text-color);
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--ion-color-light);
}

/* Quick Commands */
.quick-commands {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color);
}

.quick-commands-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.quick-commands-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quick-commands-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.quick-cmd-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-cmd-btn {
  padding: 6px 12px;
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  background: transparent;
  color: var(--ion-text-color);
  font-size: 13px;
  font-family: monospace;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.quick-cmd-btn:hover:not(:disabled) {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-color: var(--ion-color-primary);
}

.quick-cmd-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-cmd-pin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-warning);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.quick-cmd-pin-btn:hover {
  background: var(--ion-color-warning-tint);
}

.quick-cmd-pin-btn ion-icon {
  font-size: 16px;
}

/* Output Area */
.output-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--ion-item-background);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ion-color-medium);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 4px 0;
}

.empty-state .hint {
  font-size: 13px;
  opacity: 0.8;
}

.output-entries {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.output-entry {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
}

.entry-prefix {
  font-weight: 600;
  margin-right: 8px;
  display: block;
  margin-bottom: 4px;
}

.entry-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 13px;
  line-height: 1.5;
}

.entry-user {
  background: var(--ion-color-primary-tint);
  border-left: 3px solid var(--ion-color-primary);
}

.entry-assistant {
  background: var(--ion-color-light);
  border-left: 3px solid var(--ion-color-success);
}

.entry-system {
  background: var(--ion-color-light-tint);
  border-left: 3px solid var(--ion-color-medium);
  font-size: 12px;
}

.entry-error {
  background: var(--ion-color-danger);
  border-left: 3px solid var(--ion-color-danger-shade);
  color: #ffffff;
}

.entry-error .entry-prefix,
.entry-error .entry-content {
  color: #ffffff;
}

.entry-info {
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 12px;
  text-align: center;
  padding: 4px;
}

.entry-tool_use {
  background: #2d2d44;
  border-left: 3px solid #6366f1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
}

.tool-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1.5;
}

.tool-name {
  font-weight: 600;
  font-size: 13px;
  color: #a5b4fc;
  flex-shrink: 0;
  line-height: 1.5;
}

.tool-input {
  margin: 0;
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 12px;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-tool_result {
  background: var(--ion-color-light-tint);
  border-left: 3px solid var(--ion-color-medium);
  font-size: 12px;
}

.streaming .cursor-blink {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Tool Progress */
.tool-progress-wrapper {
  padding: 12px;
  border-radius: 8px;
  background: var(--ion-color-light-tint);
  border: 1px solid var(--ion-border-color);
}

/* Input Area */
.input-area {
  padding: 16px;
  border-top: 1px solid var(--ion-border-color);
  background: var(--ion-toolbar-background);
}

.input-row {
  margin-bottom: 12px;
}

.input-wrapper {
  position: relative;
}

.prompt-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  background: var(--ion-item-background);
  color: var(--ion-text-color);
  font-family: 'SF Mono', Monaco, Menlo, monospace;
  font-size: 14px;
  resize: none;
  transition: border-color 0.2s;
}

.prompt-input:focus {
  outline: none;
  border-color: var(--ion-color-primary);
}

.prompt-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Auto-complete dropdown */
.autocomplete-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.autocomplete-dropdown button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  gap: 8px;
}

.autocomplete-dropdown button:hover,
.autocomplete-dropdown button.is-selected {
  background: var(--ion-color-primary-tint);
}

.autocomplete-item {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.cmd-name {
  font-family: monospace;
  font-weight: 600;
  font-size: 14px;
  color: var(--ion-text-color);
}

.cmd-desc {
  color: var(--ion-color-medium);
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-pin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--ion-color-medium);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.autocomplete-pin-btn:hover {
  background: var(--ion-color-light);
  color: var(--ion-color-warning);
}

.autocomplete-pin-btn.pinned {
  color: var(--ion-color-warning);
}

.autocomplete-pin-btn ion-icon {
  font-size: 18px;
}

.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-left,
.action-right {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn ion-icon {
  font-size: 18px;
}

.action-btn.primary {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--ion-color-primary-shade);
}

.action-btn.secondary {
  background: var(--ion-color-light);
  color: var(--ion-text-color);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--ion-color-light-shade);
}

.action-btn.danger {
  background: var(--ion-color-danger);
  color: var(--ion-color-danger-contrast);
}

.action-btn.danger:hover {
  background: var(--ion-color-danger-shade);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Footer */
.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--ion-border-color);
  background: var(--ion-toolbar-background);
  font-size: 12px;
  color: var(--ion-color-medium);
}

.stat {
  font-family: monospace;
}
</style>
