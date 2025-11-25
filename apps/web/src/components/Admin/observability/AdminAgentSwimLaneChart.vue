<template>
  <div class="agent-swim-lane-chart">
    <!-- Lane Header with Badges -->
    <div class="lane-header">
      <div class="header-left">
        <!-- Agent/Task Label -->
        <div class="agent-label">
          <span class="font-mono text-xs font-bold">{{ agentLabel }}</span>
        </div>
        
        <!-- Organization Badge -->
        <div
          v-if="organizationSlug"
          class="org-badge"
          :title="`Organization: ${organizationSlug}`"
        >
          <span class="text-base">🏢</span>
          <span class="text-xs font-bold">{{ organizationSlug }}</span>
        </div>
        
        <!-- Username Badge -->
        <div
          v-if="username"
          class="user-badge"
          :title="`User: ${username}`"
        >
          <span class="text-base">👤</span>
          <span class="text-xs font-bold">{{ username }}</span>
        </div>
        
        <!-- Event Count Badge -->
        <div
          class="metric-badge"
          @mouseover="hoveredEventCount = true"
          @mouseleave="hoveredEventCount = false"
          :title="`Total events in the last ${timeRangeLabel}`"
        >
          <span class="text-base">⚡</span>
          <span class="text-xs font-bold">
            {{ hoveredEventCount ? `${totalEventCount} Events` : totalEventCount }}
          </span>
        </div>
        
        <!-- Status Badge -->
        <ion-chip :color="statusColor" size="small">
          <ion-icon :icon="statusIcon" />
          <ion-label>{{ activity.status }}</ion-label>
        </ion-chip>
        
        <!-- Average Gap Time -->
        <div
          class="metric-badge"
          @mouseover="hoveredAvgTime = true"
          @mouseleave="hoveredAvgTime = false"
          :title="`Average time between events`"
        >
          <span class="text-base">🕐</span>
          <span class="text-xs font-bold">
            {{ hoveredAvgTime ? `Avg: ${formatGap(eventTimingMetrics.avgGap)}` : formatGap(eventTimingMetrics.avgGap) }}
          </span>
        </div>
        
        <!-- Time Range Selector -->
        <ion-segment v-model="selectedTimeRange" size="small" class="time-range-selector">
          <ion-segment-button value="1m">
            <ion-label>1m</ion-label>
          </ion-segment-button>
          <ion-segment-button value="3m">
            <ion-label>3m</ion-label>
          </ion-segment-button>
          <ion-segment-button value="5m">
            <ion-label>5m</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>
    </div>
    
    <!-- Canvas Chart -->
    <div ref="chartContainer" class="chart-wrapper">
      <canvas
        ref="canvas"
        class="chart-canvas"
        :style="{ height: chartHeight + 'px' }"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @click="handleCanvasClick"
        role="img"
        :aria-label="chartAriaLabel"
      />
      
      <!-- Tooltip -->
      <div
        v-if="tooltip.visible"
        class="chart-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        {{ tooltip.text }}
      </div>
      
      <!-- No Data Message -->
      <div v-if="!hasData" class="no-data-message">
        <span class="mr-1">⏳</span>
        Waiting for events...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { IonChip, IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import {
  playCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  pauseCircleOutline,
} from 'ionicons/icons';
import type { AgentActivity } from '@/composables/useAdminObservabilityStream';
import type { TimeRange, ChartConfig } from '@/types/observability';
import { useAgentChartData } from '@/composables/useAgentChartData';
import { createChartRenderer, type ChartDimensions } from '@/utils/chartRenderer';
import { useEventEmojis } from '@/composables/useEventEmojis';
import { useEventColors } from '@/composables/useEventColors';

const props = defineProps<{
  activity: AgentActivity;
}>();

const emit = defineEmits<{
  'conversation-click': [conversationId: string];
  'bucket-click': [data: {
    timestamp: number;
    events: typeof props.activity.events;
    eventTypes: Record<string, number>;
    count: number;
  }];
}>();

// Chart setup
const canvas = ref<HTMLCanvasElement>();
const chartContainer = ref<HTMLDivElement>();
const chartHeight = 80;
const selectedTimeRange = ref<TimeRange>('1m');
const hoveredEventCount = ref(false);
const hoveredAvgTime = ref(false);

// Get agent identifier and metadata
const agentId = computed(() => props.activity.conversationId || props.activity.agentSlug);
const agentLabel = computed(() => {
  const label = props.activity.agentSlug;
  // Truncate long labels
  if (label.length > 50) {
    return label.substring(0, 47) + '...';
  }
  return label;
});

// Use stored org and username from activity (set when conversation is created)
const organizationSlug = computed(() => {
  return props.activity.organizationSlug || null;
});

const username = computed(() => {
  return props.activity.username || null;
});

// Initialize chart data composable
const {
  dataPoints,
  addEvent,
  getChartData,
  setTimeRange,
  cleanup: cleanupChartData,
  eventTimingMetrics
} = useAgentChartData(agentId.value);

// Chart renderer
let renderer: ReturnType<typeof createChartRenderer> | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrame: number | null = null;
const processedEventIds = new Set<string>();

const { formatEventTypeLabel } = useEventEmojis();
const { getHexColorForSession } = useEventColors();

// Computed properties
const hasData = computed(() => dataPoints.value.some(dp => dp.count > 0));

const totalEventCount = computed(() => {
  return dataPoints.value.reduce((sum, dp) => sum + dp.count, 0);
});

const timeRangeLabel = computed(() => {
  switch (selectedTimeRange.value) {
    case '1m': return '1 minute';
    case '3m': return '3 minutes';
    case '5m': return '5 minutes';
    default: return '1 minute';
  }
});

const chartAriaLabel = computed(() => {
  return `Activity chart for ${agentLabel.value} showing ${totalEventCount.value} events`;
});

const statusColor = computed(() => {
  switch (props.activity.status) {
    case 'active': return 'primary';
    case 'error': return 'danger';
    case 'idle': return 'success';
    default: return 'medium';
  }
});

const statusIcon = computed(() => {
  switch (props.activity.status) {
    case 'active': return playCircleOutline;
    case 'error': return closeCircleOutline;
    case 'idle': return checkmarkCircleOutline;
    default: return pauseCircleOutline;
  }
});

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  text: ''
});

// Helper functions
const formatGap = (gapMs: number): string => {
  if (gapMs === 0) return '—';
  if (gapMs < 1000) return `${Math.round(gapMs)}ms`;
  return `${(gapMs / 1000).toFixed(1)}s`;
};

const getThemeColor = (property: string): string => {
  const ionColor = getComputedStyle(document.documentElement).getPropertyValue(`--ion-color-${property}`).trim();
  if (ionColor) return ionColor;
  
  // Fallback colors
  const fallbacks: Record<string, string> = {
    'primary': '#3880ff',
    'secondary': '#3dc2ff',
    'tertiary': '#5260ff',
    'success': '#2dd36f',
    'warning': '#ffc409',
    'danger': '#eb445a',
    'medium': '#92949c',
    'light': '#f4f5f8'
  };
  return fallbacks[property] || '#3880ff';
};

const getActiveConfig = (): ChartConfig => {
  return {
    maxDataPoints: 60,
    animationDuration: 300,
    barWidth: 3,
    barGap: 1,
    colors: {
      primary: getThemeColor('primary'),
      glow: getThemeColor('primary'),
      axis: getThemeColor('medium'),
      text: getThemeColor('medium')
    }
  };
};

const getDimensions = (): ChartDimensions => {
  const width = chartContainer.value?.offsetWidth || 800;
  return {
    width,
    height: chartHeight,
    padding: {
      top: 7,
      right: 7,
      bottom: 20,
      left: 7
    }
  };
};

const render = () => {
  if (!renderer || !canvas.value) return;
  
  const data = getChartData();
  const maxValue = Math.max(...data.map(d => d.count), 1);
  
  renderer.clear();
  renderer.drawBackground();
  renderer.drawAxes();
  renderer.drawTimeLabels(selectedTimeRange.value);
  renderer.drawBars(data, maxValue, 1, formatEventTypeLabel, getHexColorForSession);
};

const animateNewEvent = (x: number, y: number) => {
  let radius = 0;
  let opacity = 0.8;
  
  const animate = () => {
    if (!renderer) return;
    
    render();
    renderer.drawPulseEffect(x, y, radius, opacity);
    
    radius += 2;
    opacity -= 0.02;
    
    if (opacity > 0) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = null;
    }
  };
  
  animate();
};

const handleResize = () => {
  if (!renderer || !canvas.value) return;
  
  const dimensions = getDimensions();
  renderer.resize(dimensions);
  render();
};

const processNewEvents = () => {
  const currentEvents = props.activity.events;
  const newEventsToProcess: typeof currentEvents = [];
  
  // Find events that haven't been processed yet
  currentEvents.forEach(event => {
    const eventKey = `${event.id || event.timestamp}-${event.task_id || event.taskId}`;
    if (!processedEventIds.has(eventKey)) {
      processedEventIds.add(eventKey);
      newEventsToProcess.push(event);
    }
  });
  
  // Process new events
  newEventsToProcess.forEach(event => {
    const eventType = event.hook_event_type || event.event_type;
    if (eventType !== 'heartbeat' && eventType !== 'connected') {
      addEvent(event);
      
      // Trigger pulse animation for new event
      if (renderer && canvas.value) {
        const chartArea = getDimensions();
        const x = chartArea.width - chartArea.padding.right - 10;
        const y = chartArea.height / 2;
        animateNewEvent(x, y);
      }
    }
  });
  
  // Clean up old event IDs to prevent memory leak
  const currentEventIds = new Set(
    currentEvents.map(e => `${e.id || e.timestamp}-${e.task_id || e.taskId}`)
  );
  processedEventIds.forEach(id => {
    if (!currentEventIds.has(id)) {
      processedEventIds.delete(id);
    }
  });
  
  render();
};

// Watch for new events
watch(() => props.activity.events, processNewEvents, { deep: true, immediate: true });

// Watch for time range changes
watch(selectedTimeRange, (newRange) => {
  setTimeRange(newRange);
  render();
});

const handleMouseMove = (event: MouseEvent) => {
  if (!canvas.value || !chartContainer.value) return;
  
  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const data = getChartData();
  const dimensions = getDimensions();
  const chartArea = {
    x: dimensions.padding.left,
    y: dimensions.padding.top,
    width: dimensions.width - dimensions.padding.left - dimensions.padding.right,
    height: dimensions.height - dimensions.padding.top - dimensions.padding.bottom
  };
  
  const barWidth = chartArea.width / data.length;
  const barIndex = Math.floor((x - chartArea.x) / barWidth);
  
  if (barIndex >= 0 && barIndex < data.length && y >= chartArea.y && y <= chartArea.y + chartArea.height) {
    const point = data[barIndex];
    if (point.count > 0) {
      const eventTypesText = Object.entries(point.eventTypes || {})
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      
      tooltip.value = {
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 30,
        text: `${point.count} events${eventTypesText ? ` (${eventTypesText})` : ''}`
      };
      return;
    }
  }
  
  tooltip.value.visible = false;
};

const handleMouseLeave = () => {
  tooltip.value.visible = false;
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!canvas.value || !chartContainer.value) return;
  
  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  const data = getChartData();
  const dimensions = getDimensions();
  const chartArea = {
    x: dimensions.padding.left,
    y: dimensions.padding.top,
    width: dimensions.width - dimensions.padding.left - dimensions.padding.right,
    height: dimensions.height - dimensions.padding.top - dimensions.padding.bottom
  };
  
  const barWidth = chartArea.width / data.length;
  const barIndex = Math.floor((x - chartArea.x) / barWidth);
  
  if (barIndex >= 0 && barIndex < data.length && y >= chartArea.y && y <= chartArea.y + chartArea.height) {
    const point = data[barIndex];
    if (point.count > 0) {
      // Find events in this time bucket
      const bucketEvents = props.activity.events.filter(event => {
        const timestamp = event.timestamp || (event.created_at ? new Date(event.created_at).getTime() : Date.now());
        return Math.abs(timestamp - point.timestamp) < 1000; // Within 1 second of bucket
      });
      
      // Emit event with bucket details
      emit('bucket-click', {
        timestamp: point.timestamp,
        events: bucketEvents,
        eventTypes: point.eventTypes || {},
        count: point.count
      });
    }
  }
};

// Lifecycle
onMounted(() => {
  if (!canvas.value || !chartContainer.value) return;
  
  const dimensions = getDimensions();
  const config = getActiveConfig();
  
  renderer = createChartRenderer(canvas.value, dimensions, config);
  
  // Set up resize observer
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(chartContainer.value);
  
  // Initial render
  render();
  
  // Start optimized render loop with FPS limiting
  let lastRenderTime = 0;
  const targetFPS = 30;
  const frameInterval = 1000 / targetFPS;
  
  const renderLoop = (currentTime: number) => {
    const deltaTime = currentTime - lastRenderTime;
    
    if (deltaTime >= frameInterval) {
      render();
      lastRenderTime = currentTime - (deltaTime % frameInterval);
    }
    
    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);
});

onUnmounted(() => {
  cleanupChartData();
  
  if (renderer) {
    renderer.stopAnimation();
  }
  
  if (resizeObserver && chartContainer.value) {
    resizeObserver.disconnect();
  }
  
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
});
</script>

<style scoped>
.agent-swim-lane-chart {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--ion-color-step-50);
  border-radius: 8px;
  border: 1px solid var(--ion-color-step-150);
}

.lane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.agent-label {
  padding: 6px 12px;
  background: var(--ion-color-primary);
  color: white;
  border-radius: 6px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.org-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--ion-color-secondary);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--ion-color-tertiary);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--ion-color-step-100);
  border: 1px solid var(--ion-color-step-200);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.metric-badge:hover {
  background: var(--ion-color-step-150);
  border-color: var(--ion-color-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.time-range-selector {
  width: auto;
  min-width: 150px;
}

.chart-wrapper {
  position: relative;
  width: 100%;
  border: 1px solid var(--ion-color-step-200);
  border-radius: 6px;
  overflow: hidden;
  background: var(--ion-color-step-100);
}

.chart-canvas {
  width: 100%;
  cursor: crosshair;
  display: block;
}

.chart-tooltip {
  position: absolute;
  background: linear-gradient(135deg, var(--ion-color-primary), var(--ion-color-primary-shade));
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.no-data-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-medium);
  font-size: 14px;
  font-weight: 600;
}

ion-chip {
  margin: 0;
}
</style>

