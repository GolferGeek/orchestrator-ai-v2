<template>
  <div class="event-row" :class="`event-${eventTypeClass}`">
    <div class="event-icon">
      <ion-icon :icon="eventIcon" :color="eventColor" />
    </div>
    
    <div class="event-content">
      <div class="event-header">
        <span class="event-type">{{ event.hook_event_type || 'unknown' }}</span>
        <span class="event-time">{{ formattedTime }}</span>
      </div>

      <div class="event-details">
        <div class="event-detail-row">
          <ion-chip
            v-if="displayUsername"
            size="small"
            color="secondary"
          >
            <ion-icon :icon="personOutline" />
            <ion-label>{{ displayUsername }}</ion-label>
          </ion-chip>
          
          <ion-chip
            v-if="event.context?.agentSlug"
            size="small"
            color="primary"
          >
            <ion-icon :icon="constructOutline" />
            <ion-label>{{ event.context.agentSlug }}</ion-label>
          </ion-chip>

          <ion-chip
            v-if="event.context?.conversationId"
            size="small"
            color="tertiary"
            @click="handleConversationClick"
            class="clickable"
          >
            <ion-icon :icon="chatbubbleOutline" />
            <ion-label>{{ truncateId(event.context.conversationId) }}</ion-label>
          </ion-chip>

          <ion-chip
            v-if="event.context?.taskId"
            size="small"
            color="medium"
          >
            <ion-icon :icon="documentOutline" />
            <ion-label>{{ truncateId(event.context.taskId) }}</ion-label>
          </ion-chip>
        </div>
        
        <div v-if="event.message" class="event-message">
          {{ event.message }}
        </div>
        
        <ion-progress-bar 
          v-if="showProgress"
          :value="event.progress / 100"
          :color="progressColor"
        />
        
        <!-- Expandable Details -->
        <div v-if="hasAdditionalDetails" class="additional-details">
          <ion-button
            fill="clear"
            size="small"
            @click="showDetails = !showDetails"
          >
            <ion-icon :icon="showDetails ? chevronUpOutline : chevronDownOutline" />
            {{ showDetails ? 'Hide' : 'Show' }} Details
          </ion-button>
          
          <div v-if="showDetails" class="details-content">
            <!-- Organization -->
            <div v-if="event.context?.orgSlug" class="detail-item">
              <strong>Organization:</strong> {{ event.context.orgSlug }}
            </div>

            <!-- Mode -->
            <div v-if="event.payload?.mode" class="detail-item">
              <strong>Mode:</strong> {{ event.payload.mode }}
            </div>
            
            <!-- Status -->
            <div v-if="event.status" class="detail-item">
              <strong>Status:</strong> {{ event.status }}
            </div>
            
            <!-- Step -->
            <div v-if="event.step" class="detail-item">
              <strong>Step:</strong> {{ event.step }}
            </div>
            
            <!-- Result (for completed events) -->
            <div v-if="event.result" class="detail-item">
              <strong>Result:</strong>
              <pre class="detail-json">{{ formatJSON(event.result) }}</pre>
            </div>
            
            <!-- Error (for failed events) -->
            <div v-if="event.error" class="detail-item error-detail">
              <strong>Error:</strong>
              <pre class="detail-json">{{ formatJSON(event.error) }}</pre>
            </div>
            
            <!-- Payload/Data -->
            <div v-if="eventPayload" class="detail-item">
              <strong>Payload:</strong>
              <pre class="detail-json">{{ formatJSON(eventPayload) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonIcon,
  IonChip,
  IonLabel,
  IonProgressBar,
  IonButton,
} from '@ionic/vue';
import {
  personOutline,
  constructOutline,
  chatbubbleOutline,
  documentOutline,
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
  chevronUpOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import type { ObservabilityEvent } from '@/composables/useAdminObservabilityStream';

interface Props {
  event: ObservabilityEvent;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

const showDetails = ref(false);

// Format timestamp
const formattedTime = computed(() => {
  const date = props.event.created_at 
    ? new Date(props.event.created_at)
    : new Date(props.event.timestamp);
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

const showProgress = computed(() => {
  return props.event.progress !== undefined && props.event.progress > 0;
});

const progressColor = computed(() => {
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
.event-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-left: 3px solid var(--ion-color-medium);
  background: var(--ion-color-step-50);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.event-row:hover {
  background: var(--ion-color-step-100);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.event-agent-started {
  border-left-color: var(--ion-color-primary);
}

.event-agent-completed {
  border-left-color: var(--ion-color-success);
}

.event-agent-failed {
  border-left-color: var(--ion-color-danger);
}

.event-agent-progress {
  border-left-color: var(--ion-color-tertiary);
}

.event-icon {
  font-size: 24px;
  padding-top: 2px;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-type {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ion-color-dark);
}

.event-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-detail-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.event-message {
  font-size: 0.875rem;
  color: var(--ion-color-step-700);
  margin-top: 4px;
}

.clickable {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.clickable:hover {
  transform: scale(1.05);
}

.additional-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ion-color-step-150);
}

.details-content {
  margin-top: 8px;
  padding: 12px;
  background: var(--ion-color-step-100);
  border-radius: 4px;
  border: 1px solid var(--ion-color-step-200);
}

.detail-item {
  margin-bottom: 12px;
  font-size: 0.875rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item strong {
  color: var(--ion-color-dark);
  display: block;
  margin-bottom: 4px;
}

.detail-json {
  background: var(--ion-color-step-50);
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--ion-color-step-200);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  color: var(--ion-color-step-850);
  margin: 4px 0 0 0;
}

.error-detail {
  border-left: 3px solid var(--ion-color-danger);
  padding-left: 8px;
}

.error-detail strong {
  color: var(--ion-color-danger);
}

ion-chip {
  margin: 0;
}
</style>

