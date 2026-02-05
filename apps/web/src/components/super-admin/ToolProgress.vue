<script setup lang="ts">
/**
 * Tool Progress Component
 *
 * Displays the current tool execution status with animated verbs
 * like "Reading...", "Writing...", "Searching..." similar to Claude Code CLI.
 */

import { computed, ref, watchEffect, onUnmounted } from 'vue';
import { IonIcon } from '@ionic/vue';
import { refreshOutline, checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import type { ActiveTool } from '@/services/claudeCodeService';

const props = defineProps<{
  activeTools: Map<string, ActiveTool>;
  currentVerb: string;
}>();

// Get running tools
const runningTools = computed(() =>
  Array.from(props.activeTools.values()).filter((t) => t.status === 'running')
);

// Animated dots for verb
const dots = ref(0);
let dotsInterval: ReturnType<typeof setInterval> | null = null;

watchEffect(() => {
  if (props.currentVerb) {
    if (!dotsInterval) {
      dotsInterval = setInterval(() => {
        dots.value = (dots.value + 1) % 4;
      }, 400);
    }
  } else {
    if (dotsInterval) {
      clearInterval(dotsInterval);
      dotsInterval = null;
    }
    dots.value = 0;
  }
});

onUnmounted(() => {
  if (dotsInterval) {
    clearInterval(dotsInterval);
  }
});

// Format elapsed time
function formatElapsed(seconds: number): string {
  if (seconds < 1) return '';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Get verb text without trailing dots
const verbText = computed(() => props.currentVerb.replace(/\.+$/, ''));
const animatedDots = computed(() => '.'.repeat(dots.value));

// Whether to show the component
const shouldShow = computed(
  () => props.currentVerb || runningTools.value.length > 0
);
</script>

<template>
  <div v-if="shouldShow" class="tool-progress">
    <!-- Main verb indicator -->
    <div v-if="currentVerb" class="verb-indicator">
      <ion-icon :icon="refreshOutline" class="spin-icon" />
      <span class="verb-text">
        {{ verbText }}<span class="dots">{{ animatedDots }}</span>
      </span>
    </div>

    <!-- Individual tool indicators (only show if multiple) -->
    <div v-if="runningTools.length > 1" class="tool-indicators">
      <div
        v-for="tool in runningTools"
        :key="tool.id"
        class="tool-indicator"
        :class="'status-' + tool.status"
      >
        <ion-icon v-if="tool.status === 'running'" :icon="refreshOutline" class="spin-icon small" />
        <ion-icon v-else-if="tool.status === 'completed'" :icon="checkmarkCircleOutline" class="success-icon" />
        <ion-icon v-else-if="tool.status === 'error'" :icon="closeCircleOutline" class="error-icon" />
        <span class="tool-name">{{ tool.name }}</span>
        <span v-if="tool.elapsedSeconds > 0" class="elapsed">
          {{ formatElapsed(tool.elapsedSeconds) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.verb-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.spin-icon {
  font-size: 16px;
  animation: spin 1s linear infinite;
}

.spin-icon.small {
  font-size: 12px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.verb-text {
  display: flex;
}

.dots {
  display: inline-block;
  width: 24px;
  text-align: left;
}

.tool-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
}

.tool-indicator.status-running {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
}

.tool-indicator.status-completed {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success);
}

.tool-indicator.status-error {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.success-icon {
  font-size: 12px;
  color: var(--ion-color-success);
}

.error-icon {
  font-size: 12px;
  color: var(--ion-color-danger);
}

.tool-name {
  font-weight: 500;
}

.elapsed {
  color: var(--ion-color-medium);
}
</style>
