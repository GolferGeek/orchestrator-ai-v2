<template>
  <div class="swim-lane-wrapper">
    <AdminAgentSwimLaneChart
      :activity="activity"
      @conversation-click="handleConversationClick"
      @bucket-click="handleBucketClick"
    />
    
    <!-- Expandable Details Section -->
    <ion-card v-if="expanded" class="details-card">
      <ion-card-header>
        <ion-card-title>
          {{ selectedBucket ? `Events at ${new Date(selectedBucket.timestamp).toLocaleTimeString()}` : 'All Events' }}
        </ion-card-title>
        <ion-button
          v-if="selectedBucket"
          fill="clear"
          size="small"
          @click="selectedBucket = null"
        >
          Show All
        </ion-button>
      </ion-card-header>
      <ion-card-content>
        <div class="all-events">
          <AdminEventRow
            v-for="event in displayedEvents"
            :key="eventKey(event)"
            :event="event"
            @conversation-click="handleConversationClick"
          />
        </div>
      </ion-card-content>
    </ion-card>
    
    <!-- Expand/Collapse Button -->
    <ion-button 
      v-if="activity.events.length > 5"
      fill="clear" 
      size="small"
      @click="expanded = !expanded"
      class="expand-button"
    >
      <ion-icon :icon="expanded ? chevronUpOutline : chevronDownOutline" />
      {{ expanded ? 'Hide details' : `Show ${activity.events.length} events` }}
    </ion-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonButton,
} from '@ionic/vue';
import {
  chevronUpOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import type { AgentActivity, ObservabilityEvent } from '@/composables/useAdminObservabilityStream';
import AdminEventRow from './AdminEventRow.vue';
import AdminAgentSwimLaneChart from './AdminAgentSwimLaneChart.vue';

interface Props {
  activity: AgentActivity;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

const expanded = ref(false);
const selectedBucket = ref<{
  timestamp: number;
  events: ObservabilityEvent[];
  eventTypes: Record<string, number>;
  count: number;
} | null>(null);

// Computed for displayed events (either bucket events or all events)
const displayedEvents = computed(() => {
  if (selectedBucket.value) {
    return selectedBucket.value.events;
  }
  return props.activity.events;
});

// Helpers
function eventKey(event: ObservabilityEvent): string {
  return `${event.id || event.timestamp}-${event.context?.taskId}-${event.hook_event_type}`;
}

function handleConversationClick(conversationId: string) {
  emit('conversation-click', conversationId);
}

function handleBucketClick(bucketData: {
  timestamp: number;
  events: ObservabilityEvent[];
  eventTypes: Record<string, number>;
  count: number;
}) {
  selectedBucket.value = bucketData;
  expanded.value = true; // Auto-expand to show the events
}
</script>

<style scoped>
.swim-lane-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.details-card {
  margin: 0;
}

.all-events {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.expand-button {
  margin: 0 auto;
  display: block;
}

ion-chip {
  margin: 0;
}
</style>

