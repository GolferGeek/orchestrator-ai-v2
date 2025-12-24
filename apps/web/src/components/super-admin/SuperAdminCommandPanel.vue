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
        <button
          v-for="cmd in quickCommands"
          :key="cmd.name"
          class="quick-cmd-btn"
          :disabled="!isServerAvailable || isExecuting"
          @click="insertCommand(cmd.name)"
          :title="cmd.description"
        >
          {{ cmd.name }}
        </button>
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
            <span class="entry-prefix">{{ getEntryPrefix(entry.type) }}</span>
            <pre class="entry-content">{{ entry.content }}</pre>
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
          <textarea
            v-model="prompt"
            class="prompt-input"
            :placeholder="inputPlaceholder"
            :disabled="!isServerAvailable || isExecuting"
            rows="3"
            @keydown.enter.meta="execute"
            @keydown.enter.ctrl="execute"
          ></textarea>
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
} from 'ionicons/icons';
import { useClaudeCodePanel, type OutputEntry } from '@/composables/useClaudeCodePanel';

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
  canExecute,
  hasOutput,
  execute,
  cancel,
  clearOutput,
  insertCommand,
} = useClaudeCodePanel();

const outputRef = ref<HTMLElement | null>(null);

// Quick commands to show as buttons
const quickCommands = computed(() => {
  const defaultCommands = [
    { name: '/test', description: 'Run tests' },
    { name: '/commit', description: 'Commit changes' },
    { name: '/create-pr', description: 'Create pull request' },
    { name: '/monitor', description: 'Run monitoring' },
  ];

  // Merge with loaded commands if available
  if (commands.value.length > 0) {
    return commands.value.slice(0, 4);
  }

  return defaultCommands;
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
    default:
      return '';
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
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color);
  overflow-x: auto;
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
  background: var(--ion-color-danger-tint);
  border-left: 3px solid var(--ion-color-danger);
  color: var(--ion-color-danger-shade);
}

.entry-info {
  background: transparent;
  color: var(--ion-color-medium);
  font-size: 12px;
  text-align: center;
  padding: 4px;
}

.streaming .cursor-blink {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
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
