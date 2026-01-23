<template>
  <div class="prediction-activity-feed">
    <header class="feed-header">
      <h3>Prediction Activity Feed</h3>
      <div class="header-actions">
        <!-- Connection Status -->
        <span :class="['status-indicator', { connected: isConnected, connecting: isConnecting }]">
          {{ isConnected ? 'Live' : isConnecting ? 'Connecting...' : 'Disconnected' }}
        </span>
        <button class="btn btn-icon" @click="isConnected ? disconnect() : connect()" :title="isConnected ? 'Disconnect' : 'Connect'">
          <span v-if="isConnected">&#9632;</span>
          <span v-else>&#9658;</span>
        </button>
        <button class="btn btn-icon" @click="clearEvents" :disabled="!isConnected" title="Clear events">
          &#128465;
        </button>
        <button class="btn btn-icon" @click="$emit('close')" title="Close">
          &times;
        </button>
      </div>
    </header>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      {{ error }}
    </div>

    <!-- Event Type Filters -->
    <div class="filter-section">
      <div class="filter-chips">
        <button
          v-for="eventType in eventTypes"
          :key="eventType.value"
          :class="['filter-chip', { active: activeFilters.includes(eventType.value) }]"
          @click="toggleFilter(eventType.value)"
        >
          <span :class="['chip-dot', eventType.color]"></span>
          {{ eventType.label }}
        </button>
      </div>
      <span class="event-count">{{ filteredEvents.length }} events</span>
    </div>

    <!-- Events List -->
    <div class="events-container" ref="eventsContainer">
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <span class="empty-icon">&#128202;</span>
        <p>{{ emptyMessage }}</p>
      </div>

      <div
        v-for="event in filteredEvents"
        :key="eventKey(event)"
        :class="['event-row', getEventColorClass(event), 'clickable']"
        @click="showEventDetail(event)"
      >
        <div class="event-time">
          {{ formatTime(event.timestamp) }}
        </div>
        <div class="event-type">
          <span :class="['type-badge', getEventColorClass(event)]">
            {{ formatEventType(event.hook_event_type) }}
          </span>
        </div>
        <div class="event-message">
          {{ event.message }}
        </div>
        <div class="event-details">
          <span v-if="event.payload?.targetSymbol" class="detail-chip">
            {{ event.payload.targetSymbol }}
          </span>
          <span v-if="event.payload?.direction" :class="['detail-chip', event.payload.direction]">
            {{ event.payload.direction }}
          </span>
          <span v-if="event.payload?.confidence" class="detail-chip confidence">
            {{ (event.payload.confidence * 100).toFixed(0) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Event Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedEvent" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
          <header class="modal-header">
            <h3>
              <span :class="['type-badge', getEventColorClass(selectedEvent)]">
                {{ formatEventType(selectedEvent.hook_event_type) }}
              </span>
            </h3>
            <button class="btn-close" @click="closeModal">&times;</button>
          </header>

          <div class="modal-body">
            <!-- Timestamp -->
            <div class="detail-section">
              <label>Time</label>
              <span>{{ formatFullTime(selectedEvent.timestamp) }}</span>
            </div>

            <!-- Message -->
            <div class="detail-section">
              <label>Message</label>
              <p class="event-full-message">{{ selectedEvent.message }}</p>
            </div>

            <!-- Target Info -->
            <div v-if="selectedEvent.payload?.targetSymbol || selectedEvent.payload?.targetName" class="detail-section">
              <label>Target</label>
              <div class="target-info">
                <span v-if="selectedEvent.payload?.targetSymbol" class="symbol-badge">
                  {{ selectedEvent.payload.targetSymbol }}
                </span>
                <span v-if="selectedEvent.payload?.targetName">
                  {{ selectedEvent.payload.targetName }}
                </span>
              </div>
            </div>

            <!-- Direction & Confidence -->
            <div v-if="selectedEvent.payload?.direction || selectedEvent.payload?.confidence" class="detail-section">
              <label>Assessment</label>
              <div class="assessment-row">
                <span v-if="selectedEvent.payload?.direction" :class="['direction-badge', selectedEvent.payload.direction]">
                  {{ selectedEvent.payload.direction.toUpperCase() }}
                </span>
                <span v-if="selectedEvent.payload?.confidence" class="confidence-badge">
                  {{ (selectedEvent.payload.confidence * 100).toFixed(0) }}% confidence
                </span>
              </div>
            </div>

            <!-- Source Info (for crawl events) -->
            <div v-if="selectedEvent.payload?.sourceName || selectedEvent.payload?.sourceUrl" class="detail-section">
              <label>Source</label>
              <div class="source-info">
                <span v-if="selectedEvent.payload?.sourceName">{{ selectedEvent.payload.sourceName }}</span>
                <a v-if="selectedEvent.payload?.sourceUrl" :href="selectedEvent.payload.sourceUrl" target="_blank" class="source-link">
                  {{ selectedEvent.payload.sourceUrl }}
                </a>
              </div>
            </div>

            <!-- Article URL -->
            <div v-if="selectedEvent.payload?.url" class="detail-section">
              <label>Article URL</label>
              <a :href="selectedEvent.payload.url" target="_blank" class="article-link">
                {{ selectedEvent.payload.url }}
              </a>
            </div>

            <!-- Content Preview (for article/signal events) -->
            <div v-if="selectedEvent.payload?.content || selectedEvent.payload?.title" class="detail-section">
              <label>Content</label>
              <div class="content-preview">
                <strong v-if="selectedEvent.payload?.title">{{ selectedEvent.payload.title }}</strong>
                <p v-if="selectedEvent.payload?.content">{{ truncateContent(selectedEvent.payload.content) }}</p>
              </div>
            </div>

            <!-- Stats (for crawl completed events) -->
            <div v-if="selectedEvent.payload?.itemsFound !== undefined || selectedEvent.payload?.signalsCreated !== undefined" class="detail-section">
              <label>Results</label>
              <div class="stats-grid">
                <div v-if="selectedEvent.payload?.itemsFound !== undefined" class="stat-item">
                  <span class="stat-value">{{ selectedEvent.payload.itemsFound }}</span>
                  <span class="stat-label">Items Found</span>
                </div>
                <div v-if="selectedEvent.payload?.signalsCreated !== undefined" class="stat-item">
                  <span class="stat-value">{{ selectedEvent.payload.signalsCreated }}</span>
                  <span class="stat-label">Signals Created</span>
                </div>
                <div v-if="selectedEvent.payload?.duplicatesSkipped !== undefined" class="stat-item">
                  <span class="stat-value">{{ selectedEvent.payload.duplicatesSkipped }}</span>
                  <span class="stat-label">Duplicates Skipped</span>
                </div>
                <div v-if="selectedEvent.payload?.duration !== undefined" class="stat-item">
                  <span class="stat-value">{{ (selectedEvent.payload.duration / 1000).toFixed(1) }}s</span>
                  <span class="stat-label">Duration</span>
                </div>
              </div>
            </div>

            <!-- Raw Payload (collapsible) -->
            <details class="raw-payload-section">
              <summary>Raw Event Data</summary>
              <pre class="raw-payload">{{ JSON.stringify(selectedEvent, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useAuthStore } from '@/stores/rbacStore';
import type { ObservabilityEvent } from '@/stores/observabilityStore';

defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();

// SSE connection state
const isConnected = ref(false);
const isConnecting = ref(false);
const error = ref<string | null>(null);
const events = ref<ObservabilityEvent[]>([]);
const eventsContainer = ref<HTMLElement | null>(null);

// Modal state
const selectedEvent = ref<ObservabilityEvent | null>(null);

let eventSource: EventSource | null = null;

// Event type filters
const eventTypes = [
  { value: 'all', label: 'All', color: 'gray' },
  { value: 'source.crawl.started', label: 'Crawl Start', color: 'blue' },
  { value: 'source.crawl.completed', label: 'Crawl Done', color: 'green' },
  { value: 'article.discovered', label: 'Article', color: 'cyan' },
  { value: 'signal.detected', label: 'Signal', color: 'yellow' },
  { value: 'predictor.ready', label: 'Predictor', color: 'orange' },
  { value: 'prediction.created', label: 'Prediction', color: 'purple' },
  { value: 'prediction.evaluated', label: 'Evaluated', color: 'pink' },
];

const activeFilters = ref<string[]>(['all']);

const filteredEvents = computed(() => {
  // Always sort by descending timestamp (newest first)
  // Use id as secondary sort key for stable ordering when timestamps match
  const sorted = [...events.value].sort((a, b) => {
    const timeDiff = b.timestamp - a.timestamp;
    if (timeDiff !== 0) return timeDiff;
    // Secondary sort by id (if available) for stable ordering
    const aId = a.id ?? 0;
    const bId = b.id ?? 0;
    return bId - aId;
  });
  if (activeFilters.value.includes('all')) {
    return sorted;
  }
  return sorted.filter(e => activeFilters.value.includes(e.hook_event_type));
});

const isLoadingHistory = ref(false);

const emptyMessage = computed(() => {
  if (isLoadingHistory.value) {
    return 'Loading recent activity...';
  }
  if (!isConnected.value && events.value.length === 0) {
    return 'Connect to see live prediction activity';
  }
  if (activeFilters.value.length > 0 && !activeFilters.value.includes('all')) {
    return 'No events matching selected filters';
  }
  return 'Waiting for prediction activity...';
});

function toggleFilter(filter: string) {
  if (filter === 'all') {
    activeFilters.value = ['all'];
  } else {
    // Remove 'all' if selecting specific filter
    activeFilters.value = activeFilters.value.filter(f => f !== 'all');

    if (activeFilters.value.includes(filter)) {
      activeFilters.value = activeFilters.value.filter(f => f !== filter);
      // If no filters left, default to 'all'
      if (activeFilters.value.length === 0) {
        activeFilters.value = ['all'];
      }
    } else {
      activeFilters.value.push(filter);
    }
  }
}

async function connect() {
  if (isConnected.value || isConnecting.value) return;

  const token = authStore.token;
  if (!token) {
    error.value = 'Authentication required';
    return;
  }

  isConnecting.value = true;
  error.value = null;

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100';
    const queryParams = new URLSearchParams();
    queryParams.append('token', token);
    // Filter for prediction-related events
    queryParams.append('sourceApp', 'prediction-runner');

    const url = `${apiUrl}/observability/stream?${queryParams.toString()}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      isConnected.value = true;
      isConnecting.value = false;
      error.value = null;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip connection/heartbeat events
        if (data.event_type === 'connected' || data.event_type === 'heartbeat') {
          return;
        }

        // Only include prediction-related events
        if (isPredictionEvent(data.hook_event_type)) {
          // Add new events at the top (newest first)
          events.value.unshift(data);
          // Keep most recent 200 events
          if (events.value.length > 200) {
            events.value = events.value.slice(0, 200);
          }
          // Auto-scroll to top to show newest events
          nextTick(() => {
            if (eventsContainer.value) {
              eventsContainer.value.scrollTop = 0;
            }
          });
        }
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      isConnected.value = false;
      isConnecting.value = false;
      error.value = 'Connection lost. Click play to reconnect.';
      eventSource?.close();
      eventSource = null;
    };
  } catch (err) {
    isConnecting.value = false;
    error.value = err instanceof Error ? err.message : 'Connection failed';
  }
}

function disconnect() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  isConnected.value = false;
  isConnecting.value = false;
}

function clearEvents() {
  events.value = [];
}

function isPredictionEvent(eventType: string): boolean {
  const predictionEventTypes = [
    'source.crawl.started',
    'source.crawl.completed',
    'article.discovered',
    'signal.detected',
    'predictor.ready',
    'prediction.created',
    'prediction.evaluated',
  ];
  return predictionEventTypes.includes(eventType);
}

function eventKey(event: ObservabilityEvent): string {
  return `${event.timestamp}-${event.hook_event_type}-${event.context?.taskId || 'unknown'}`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatEventType(eventType: string): string {
  const typeMap: Record<string, string> = {
    'source.crawl.started': 'Crawl Started',
    'source.crawl.completed': 'Crawl Done',
    'article.discovered': 'Article',
    'signal.detected': 'Signal',
    'predictor.ready': 'Predictor Ready',
    'prediction.created': 'Prediction',
    'prediction.evaluated': 'Evaluated',
  };
  return typeMap[eventType] || eventType;
}

function getEventColorClass(event: ObservabilityEvent): string {
  const colorMap: Record<string, string> = {
    'source.crawl.started': 'event-blue',
    'source.crawl.completed': 'event-green',
    'article.discovered': 'event-cyan',
    'signal.detected': 'event-yellow',
    'predictor.ready': 'event-orange',
    'prediction.created': 'event-purple',
    'prediction.evaluated': 'event-pink',
  };
  return colorMap[event.hook_event_type] || 'event-gray';
}

function showEventDetail(event: ObservabilityEvent) {
  selectedEvent.value = event;
}

function closeModal() {
  selectedEvent.value = null;
}

function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncateContent(content: string, maxLength = 500): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

async function loadHistoricalEvents() {
  const token = authStore.token;
  if (!token) return;

  isLoadingHistory.value = true;

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:6100';
    // Get events from last 24 hours for a reasonable history
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const response = await fetch(`${apiUrl}/observability/history?since=${since}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Filter for prediction-related events and sort by descending date-time (newest first)
      const historicalEvents = (data.events || [])
        .filter((e: ObservabilityEvent) => isPredictionEvent(e.hook_event_type))
        .sort((a: ObservabilityEvent, b: ObservabilityEvent) => b.timestamp - a.timestamp);

      // Set historical events (sorted newest first), any live events will be added at the top
      events.value = [...historicalEvents];
    }
  } catch (err) {
    console.error('Failed to load historical events:', err);
  } finally {
    isLoadingHistory.value = false;
  }
}

onMounted(async () => {
  // Load historical events first
  await loadHistoricalEvents();
  // Then connect to live stream
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<style scoped>
.prediction-activity-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 600px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--header-bg, #f9fafb);
}

.feed-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: #ef4444;
  color: white;
}

.status-indicator.connected {
  background: #22c55e;
}

.status-indicator.connecting {
  background: #f59e0b;
}

.btn-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  font-size: 1rem;
}

.btn-icon:hover {
  background: var(--hover-bg, #e5e7eb);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-banner {
  padding: 0.5rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  font-size: 0.875rem;
  border-bottom: 1px solid #fecaca;
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--filter-bg, #fafafa);
}

.filter-chips {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.filter-chip:hover {
  background: var(--hover-bg, #f3f4f6);
}

.filter-chip.active {
  background: var(--primary-color, #3b82f6);
  color: white;
  border-color: var(--primary-color, #3b82f6);
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.chip-dot.gray { background: #6b7280; }
.chip-dot.blue { background: #3b82f6; }
.chip-dot.green { background: #22c55e; }
.chip-dot.cyan { background: #06b6d4; }
.chip-dot.yellow { background: #eab308; }
.chip-dot.orange { background: #f97316; }
.chip-dot.purple { background: #a855f7; }
.chip-dot.pink { background: #ec4899; }

.event-count {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.events-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.event-row {
  display: grid;
  grid-template-columns: 80px 100px 1fr auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  font-size: 0.813rem;
  border-left: 3px solid transparent;
}

.event-row.event-blue { border-left-color: #3b82f6; background: rgba(59, 130, 246, 0.05); }
.event-row.event-green { border-left-color: #22c55e; background: rgba(34, 197, 94, 0.05); }
.event-row.event-cyan { border-left-color: #06b6d4; background: rgba(6, 182, 212, 0.05); }
.event-row.event-yellow { border-left-color: #eab308; background: rgba(234, 179, 8, 0.05); }
.event-row.event-orange { border-left-color: #f97316; background: rgba(249, 115, 22, 0.05); }
.event-row.event-purple { border-left-color: #a855f7; background: rgba(168, 85, 247, 0.05); }
.event-row.event-pink { border-left-color: #ec4899; background: rgba(236, 72, 153, 0.05); }

.event-time {
  color: var(--text-secondary, #6b7280);
  font-family: monospace;
  font-size: 0.75rem;
}

.type-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.688rem;
  font-weight: 500;
  text-transform: uppercase;
}

.type-badge.event-blue { background: #dbeafe; color: #1d4ed8; }
.type-badge.event-green { background: #dcfce7; color: #15803d; }
.type-badge.event-cyan { background: #cffafe; color: #0891b2; }
.type-badge.event-yellow { background: #fef9c3; color: #a16207; }
.type-badge.event-orange { background: #ffedd5; color: #c2410c; }
.type-badge.event-purple { background: #f3e8ff; color: #7c3aed; }
.type-badge.event-pink { background: #fce7f3; color: #be185d; }

.event-message {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-details {
  display: flex;
  gap: 0.25rem;
}

.detail-chip {
  font-size: 0.688rem;
  padding: 0.125rem 0.375rem;
  background: var(--chip-bg, #f3f4f6);
  border-radius: 4px;
}

.detail-chip.bullish, .detail-chip.up { background: #dcfce7; color: #15803d; }
.detail-chip.bearish, .detail-chip.down { background: #fee2e2; color: #dc2626; }
.detail-chip.confidence { background: #dbeafe; color: #1d4ed8; }

.event-row.clickable {
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
}

.event-row.clickable:hover {
  transform: translateX(2px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--header-bg, #f9fafb);
}

.modal-header h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  font-size: 1.5rem;
  color: var(--text-secondary, #6b7280);
}

.btn-close:hover {
  background: var(--hover-bg, #e5e7eb);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.detail-section {
  margin-bottom: 1.25rem;
}

.detail-section label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.375rem;
  letter-spacing: 0.05em;
}

.event-full-message {
  margin: 0;
  line-height: 1.5;
}

.target-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.symbol-badge {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--primary-color, #3b82f6);
}

.assessment-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.direction-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
}

.direction-badge.bullish, .direction-badge.up {
  background: #dcfce7;
  color: #15803d;
}

.direction-badge.bearish, .direction-badge.down {
  background: #fee2e2;
  color: #dc2626;
}

.direction-badge.neutral, .direction-badge.flat {
  background: #f3f4f6;
  color: #6b7280;
}

.confidence-badge {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.source-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.source-link, .article-link {
  color: var(--primary-color, #3b82f6);
  text-decoration: none;
  font-size: 0.875rem;
  word-break: break-all;
}

.source-link:hover, .article-link:hover {
  text-decoration: underline;
}

.content-preview {
  background: var(--filter-bg, #fafafa);
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  line-height: 1.5;
}

.content-preview strong {
  display: block;
  margin-bottom: 0.5rem;
}

.content-preview p {
  margin: 0;
  color: var(--text-secondary, #6b7280);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
}

.stat-item {
  background: var(--filter-bg, #fafafa);
  padding: 0.75rem;
  border-radius: 6px;
  text-align: center;
}

.stat-item .stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-color, #3b82f6);
}

.stat-item .stat-label {
  display: block;
  font-size: 0.688rem;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  margin-top: 0.25rem;
}

.raw-payload-section {
  margin-top: 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  padding-top: 1rem;
}

.raw-payload-section summary {
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #6b7280);
  padding: 0.5rem 0;
}

.raw-payload {
  background: var(--filter-bg, #1f2937);
  color: var(--code-text, #e5e7eb);
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.75rem;
  overflow-x: auto;
  margin-top: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prediction-activity-feed {
    --card-bg: #1f2937;
    --border-color: #374151;
    --header-bg: #111827;
    --filter-bg: #1f2937;
    --hover-bg: #374151;
    --text-secondary: #9ca3af;
    --chip-bg: #374151;
    --code-text: #e5e7eb;
  }

  .error-banner {
    background: #450a0a;
    color: #fca5a5;
    border-color: #7f1d1d;
  }

  .modal-content {
    --card-bg: #1f2937;
    --header-bg: #111827;
    --border-color: #374151;
    --filter-bg: #374151;
  }

  .raw-payload {
    background: #111827;
  }
}
</style>
