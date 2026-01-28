<template>
  <div
    class="event-row"
    :class="[`event-${eventTypeClass}`, { 'is-new': isNewEvent }]"
    :style="newEventStyle"
  >
    <!-- Compact inline layout -->
    <div class="event-icon-compact">
      <ion-icon :icon="eventIcon" :color="eventColor" />
    </div>

    <span class="event-type-compact">{{ eventTypeShort }}</span>

    <div class="event-chips-compact">
      <span v-if="event.context?.agentSlug" class="chip-compact chip-agent" :title="event.context.agentSlug">
        {{ truncateLabel(event.context.agentSlug, 12) }}
      </span>
      <span v-if="displayUsername" class="chip-compact chip-user" :title="displayUsername">
        {{ truncateLabel(displayUsername, 10) }}
      </span>
      <span
        v-if="event.context?.conversationId"
        class="chip-compact chip-conv clickable"
        :title="event.context.conversationId"
        @click="handleConversationClick"
      >
        {{ truncateId(event.context.conversationId) }}
      </span>
    </div>

    <span v-if="event.message" class="event-message-compact" :title="event.message">
      {{ truncateLabel(event.message, 40) }}
    </span>

    <span class="event-time-compact">{{ formattedTime }}</span>

    <!-- Expand button for details - opens modal -->
    <ion-button
      v-if="hasAdditionalDetails"
      fill="clear"
      size="small"
      class="expand-btn"
      @click="showDetailsModal = true"
    >
      <ion-icon :icon="chevronDownOutline" />
    </ion-button>
  </div>

  <!-- Event Details Modal -->
  <ion-modal :is-open="showDetailsModal" @did-dismiss="showDetailsModal = false">
    <ion-header>
      <ion-toolbar>
        <ion-title>Event Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showDetailsModal = false">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Event Header -->
      <div class="modal-event-header">
        <ion-icon :icon="eventIcon" :color="eventColor" class="modal-event-icon" />
        <div class="modal-event-title">
          <h2>{{ event.hook_event_type || 'Unknown Event' }}</h2>
          <p class="modal-event-time">{{ formattedTime }} &bull; {{ formattedDate }}</p>
        </div>
      </div>

      <!-- Context Section -->
      <ion-card>
        <ion-card-header>
          <ion-card-title>Context</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item v-if="event.context?.agentSlug">
              <ion-label>
                <p>Agent</p>
                <h3>{{ event.context.agentSlug }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="displayUsername">
              <ion-label>
                <p>User</p>
                <h3>{{ displayUsername }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="event.context?.orgSlug">
              <ion-label>
                <p>Organization</p>
                <h3>{{ event.context.orgSlug }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="event.context?.conversationId">
              <ion-label>
                <p>Conversation ID</p>
                <h3 class="mono-text">{{ event.context.conversationId }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="event.context?.taskId">
              <ion-label>
                <p>Task ID</p>
                <h3 class="mono-text">{{ event.context.taskId }}</h3>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Status Section -->
      <ion-card v-if="event.status || event.step || event.progress !== null">
        <ion-card-header>
          <ion-card-title>Status</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list lines="none">
            <ion-item v-if="event.status">
              <ion-label>
                <p>Status</p>
                <h3>{{ event.status }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="event.step">
              <ion-label>
                <p>Step</p>
                <h3>{{ event.step }}</h3>
              </ion-label>
            </ion-item>
            <ion-item v-if="event.progress !== null">
              <ion-label>
                <p>Progress</p>
                <h3>{{ event.progress }}%</h3>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Message Section -->
      <ion-card v-if="event.message">
        <ion-card-header>
          <ion-card-title>Message</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p class="message-text">{{ event.message }}</p>
        </ion-card-content>
      </ion-card>

      <!-- Payload Section -->
      <ion-card v-if="eventPayload">
        <ion-card-header>
          <ion-card-title>Payload</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <pre class="payload-json">{{ formatJSON(eventPayload) }}</pre>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonIcon,
  IonButton,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import {
  playCircleOutline,
  pauseCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  arrowForwardCircleOutline,
  cloudUploadOutline,
  globeOutline,
  codeSlashOutline,
  addCircleOutline,
  stopCircleOutline,
  syncOutline,
  playForwardOutline,
  alertCircleOutline,
  handRightOutline,
  checkmarkDoneOutline,
  timeOutline,
  informationCircleOutline,
  chevronDownOutline,
  chatbubbleOutline,
  closeOutline,
} from 'ionicons/icons';
import type { ObservabilityEvent } from '@/composables/useAdminObservabilityStream';

interface Props {
  event: ObservabilityEvent;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

const showDetailsModal = ref(false);
const currentTime = ref(Date.now());
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null;

// Update current time every second for gradient calculation
onMounted(() => {
  timeUpdateInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
});

// Calculate event age for gradient effect (fades over 20 seconds)
const eventAge = computed(() => {
  const eventTime = props.event.timestamp || (props.event.created_at ? new Date(props.event.created_at).getTime() : currentTime.value);
  return currentTime.value - eventTime;
});

const isNewEvent = computed(() => eventAge.value < 20000); // Under 20 seconds

// Gradient background style - bright yellow fading to white over 20 seconds
const newEventStyle = computed(() => {
  if (!isNewEvent.value) return {};

  const age = eventAge.value;
  const maxAge = 20000; // 20 seconds
  const progress = Math.min(age / maxAge, 1); // 0 to 1

  // Start with bright yellow (rgb(255, 255, 150)), fade to white
  const r = 255;
  const g = 255;
  const b = Math.round(150 + (105 * progress)); // 150 -> 255

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    transition: 'background-color 1s ease',
  };
});

// Shortened event type for compact display
const eventTypeShort = computed(() => {
  const type = props.event.hook_event_type || 'unknown';
  // Remove common prefixes and shorten
  return type
    .replace('agent.', '')
    .replace('task.', '')
    .replace('langgraph.', 'lg.')
    .replace('.stream', '')
    .replace('human_input.', 'hitl.');
});

// Format timestamp
const formattedTime = computed(() => {
  let date: Date;
  if (props.event.created_at) {
    date = new Date(props.event.created_at);
  } else if (props.event.timestamp) {
    date = new Date(props.event.timestamp);
  } else {
    date = new Date();
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

// Format date for modal
const formattedDate = computed(() => {
  let date: Date;
  if (props.event.created_at) {
    date = new Date(props.event.created_at);
  } else if (props.event.timestamp) {
    date = new Date(props.event.timestamp);
  } else {
    date = new Date();
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
});

// Username from payload or context
const displayUsername = computed(() => {
  return (props.event.payload?.username as string) || props.event.context?.userId || null;
});

// Determine event icon and color based on event type
const eventIcon = computed(() => {
  const type = props.event.hook_event_type || '';

  // Task lifecycle events
  if (type === 'task.created') return addCircleOutline;
  if (type === 'task.started' || type === 'agent.started') return playCircleOutline;
  if (type === 'task.completed' || type === 'agent.completed') return checkmarkCircleOutline;
  if (type === 'task.failed' || type === 'agent.failed') return closeCircleOutline;
  if (type === 'task.cancelled') return stopCircleOutline;
  if (type === 'task.progress' || type === 'agent.progress') {
    const msg = props.event.message?.toLowerCase() || '';
    if (msg.includes('calling llm')) return codeSlashOutline;
    if (msg.includes('api')) return cloudUploadOutline;
    if (msg.includes('external')) return globeOutline;
    return arrowForwardCircleOutline;
  }
  if (type === 'task.status_changed') return syncOutline;
  if (type === 'task.message') return chatbubbleOutline;
  if (type === 'task.resumed') return playForwardOutline;

  // Agent streaming events
  if (type === 'agent.stream.start') return playCircleOutline;
  if (type === 'agent.stream.chunk') return arrowForwardCircleOutline;
  if (type === 'agent.stream.complete') return checkmarkCircleOutline;
  if (type === 'agent.stream.error') return alertCircleOutline;

  // Human-in-the-loop events
  if (type === 'human_input.required') return handRightOutline;
  if (type === 'human_input.response') return checkmarkDoneOutline;
  if (type === 'human_input.timeout') return timeOutline;

  // Connection/info events
  if (type === 'connected' || type === 'info') return informationCircleOutline;

  return pauseCircleOutline;
});

const eventColor = computed(() => {
  const type = props.event.hook_event_type || '';

  // Task lifecycle colors
  if (type === 'task.created') return 'secondary';
  if (type === 'task.started' || type === 'agent.started' || type === 'agent.stream.start') return 'primary';
  if (type === 'task.completed' || type === 'agent.completed' || type === 'agent.stream.complete') return 'success';
  if (type === 'task.failed' || type === 'agent.failed' || type === 'agent.stream.error') return 'danger';
  if (type === 'task.cancelled') return 'warning';
  if (type === 'task.progress' || type === 'agent.progress' || type === 'agent.stream.chunk') return 'tertiary';
  if (type === 'task.status_changed' || type === 'task.message') return 'secondary';
  if (type === 'task.resumed') return 'primary';

  // Human-in-the-loop colors
  if (type === 'human_input.required') return 'warning';
  if (type === 'human_input.response') return 'success';
  if (type === 'human_input.timeout') return 'danger';

  // Connection/info colors
  if (type === 'connected' || type === 'info') return 'medium';

  return 'medium';
});

const eventTypeClass = computed(() => {
  const type = props.event.hook_event_type || 'unknown';
  return type.replace(/\./g, '-');
});

const _showProgress = computed(() => {
  return props.event.progress !== null && props.event.progress !== undefined && props.event.progress > 0;
});

const _progressColor = computed(() => {
  const progress = props.event.progress || 0;
  if (progress >= 100) return 'success';
  if (progress >= 50) return 'primary';
  return 'warning';
});

// Handlers
function handleConversationClick() {
  if (props.event.context?.conversationId) {
    emit('conversation-click', props.event.context.conversationId);
  }
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.substring(0, 8)}...`;
}

function truncateLabel(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.substring(0, maxLen - 2)}..`;
}

// Check if event has additional details worth showing
const hasAdditionalDetails = computed(() => {
  return !!(
    props.event.payload ||
    props.event.context?.orgSlug ||
    props.event.status ||
    props.event.step
  );
});

// Get payload
const eventPayload = computed(() => {
  return props.event.payload || null;
});

// Format JSON for display
function formatJSON(obj: unknown): string {
  if (!obj) return '';
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
</script>

<style scoped>
/* Compact single-line event row */
.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  min-height: 32px;
  border-left: 3px solid var(--ion-color-medium);
  background: var(--ion-color-step-50);
  border-radius: 4px;
  transition: all 0.15s ease;
  font-size: 12px;
  flex-wrap: wrap;
  position: relative;
}

.event-row:hover {
  background: var(--ion-color-step-100);
}

.event-row.is-new {
  border-left-color: var(--ion-color-warning);
  border-left-width: 4px;
}


/* Border colors by event type */
.event-agent-started,
.event-task-started {
  border-left-color: var(--ion-color-primary);
}

.event-agent-completed,
.event-task-completed {
  border-left-color: var(--ion-color-success);
}

.event-agent-failed,
.event-task-failed {
  border-left-color: var(--ion-color-danger);
}

.event-agent-progress,
.event-task-progress {
  border-left-color: var(--ion-color-tertiary);
}

/* Compact icon */
.event-icon-compact {
  font-size: 16px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Event type label */
.event-type-compact {
  font-weight: 700;
  color: var(--ion-color-dark);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 80px;
  font-size: 12px;
}

/* Compact chips container */
.event-chips-compact {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* Mini chip style */
.chip-compact {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-agent {
  background: #8b5a3c; /* Primary brown */
  color: white;
}

.chip-user {
  background: #15803d; /* Secondary forest green */
  color: white;
}

.chip-conv {
  background: #ca8a04; /* Tertiary golden amber */
  color: white;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* Message preview */
.event-message-compact {
  flex: 1;
  min-width: 0;
  color: var(--ion-color-step-700);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

/* Time display */
.event-time-compact {
  font-size: 11px;
  color: var(--ion-color-medium-shade);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
  font-weight: 500;
}

/* Expand button */
.expand-btn {
  --padding-start: 6px;
  --padding-end: 6px;
  height: 24px;
  font-size: 14px;
  flex-shrink: 0;
}

/* Modal styles */
.modal-event-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--ion-color-step-50);
  border-radius: 8px;
}

.modal-event-icon {
  font-size: 40px;
}

.modal-event-title h2 {
  margin: 0 0 4px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.modal-event-time {
  margin: 0;
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}

.mono-text {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.85rem;
  word-break: break-all;
}

.message-text {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--ion-color-dark);
  white-space: pre-wrap;
  word-break: break-word;
}

.payload-json {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

ion-card {
  margin-bottom: 16px;
}

ion-card-title {
  font-size: 1rem;
  font-weight: 600;
}

ion-item ion-label p {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-bottom: 2px;
}

ion-item ion-label h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--ion-color-dark);
}
</style>

