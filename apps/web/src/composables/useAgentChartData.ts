import { ref, computed } from 'vue';
import type { ObservabilityEvent } from './useAdminObservabilityStream';
import type { ChartDataPoint, TimeRange } from '../types/observability';

export function useAgentChartData(agentIdFilter?: string) {
  const timeRange = ref<TimeRange>('1m');
  const dataPoints = ref<ChartDataPoint[]>([]);
  const allEvents = ref<ObservabilityEvent[]>([]);
  
  // Debounce for high-frequency events
  let eventBuffer: ObservabilityEvent[] = [];
  let debounceTimer: number | null = null;
  const DEBOUNCE_DELAY = 50; // 50ms debounce
  
  const timeRangeConfig = {
    '1m': { duration: 60 * 1000, bucketSize: 1000, maxPoints: 60 },
    '3m': { duration: 3 * 60 * 1000, bucketSize: 3000, maxPoints: 60 },
    '5m': { duration: 5 * 60 * 1000, bucketSize: 5000, maxPoints: 60 },
    '10m': { duration: 10 * 60 * 1000, bucketSize: 10000, maxPoints: 60 }
  };
  
  const currentConfig = computed(() => timeRangeConfig[timeRange.value]);
  
  const getBucketTimestamp = (timestamp: number): number => {
    const config = currentConfig.value;
    return Math.floor(timestamp / config.bucketSize) * config.bucketSize;
  };
  
  const getEventTimestamp = (event: ObservabilityEvent): number => {
    if (event.timestamp) return event.timestamp;
    if (event.created_at) return new Date(event.created_at).getTime();
    return Date.now();
  };
  
  const getEventType = (event: ObservabilityEvent): string => {
    return event.hook_event_type || event.event_type || 'unknown';
  };
  
  const getSessionId = (event: ObservabilityEvent): string => {
    return event.session_id || event.task_id || event.taskId || 'unknown';
  };
  
  const processEventBuffer = () => {
    const eventsToProcess = [...eventBuffer];
    eventBuffer = [];
    
    allEvents.value.push(...eventsToProcess);
    
    eventsToProcess.forEach(event => {
      const timestamp = getEventTimestamp(event);
      
      // Skip if event doesn't match agent ID filter
      if (agentIdFilter) {
        const agentKey = event.agent_slug || event.agentSlug || event.task_id || event.taskId;
        if (agentKey !== agentIdFilter) return;
      }
      
      const bucketTime = getBucketTimestamp(timestamp);
      const eventType = getEventType(event);
      const sessionId = getSessionId(event);
      
      // Find existing bucket or create new one
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        if (!bucket.eventTypes) bucket.eventTypes = {};
        bucket.eventTypes[eventType] = (bucket.eventTypes[eventType] || 0) + 1;
        if (!bucket.sessions) bucket.sessions = {};
        bucket.sessions[sessionId] = (bucket.sessions[sessionId] || 0) + 1;
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [eventType]: 1 },
          sessions: { [sessionId]: 1 }
        });
      }
    });
    
    cleanOldData();
    cleanOldEvents();
  };
  
  const addEvent = (event: ObservabilityEvent) => {
    eventBuffer.push(event);
    
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = window.setTimeout(() => {
      processEventBuffer();
      debounceTimer = null;
    }, DEBOUNCE_DELAY);
  };
  
  const cleanOldData = () => {
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;
    
    dataPoints.value = dataPoints.value.filter(dp => dp.timestamp >= cutoffTime);
    
    if (dataPoints.value.length > currentConfig.value.maxPoints) {
      dataPoints.value = dataPoints.value.slice(-currentConfig.value.maxPoints);
    }
  };
  
  const cleanOldEvents = () => {
    const now = Date.now();
    const cutoffTime = now - 5 * 60 * 1000; // Keep events for max 5 minutes
    
    allEvents.value = allEvents.value.filter(event => {
      const timestamp = getEventTimestamp(event);
      return timestamp >= cutoffTime;
    });
  };
  
  const getChartData = (): ChartDataPoint[] => {
    const now = Date.now();
    const config = currentConfig.value;
    const startTime = now - config.duration;
    
    // Create array of all time buckets in range
    const buckets: ChartDataPoint[] = [];
    for (let time = startTime; time <= now; time += config.bucketSize) {
      const bucketTime = getBucketTimestamp(time);
      const existingBucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      buckets.push({
        timestamp: bucketTime,
        count: existingBucket?.count || 0,
        eventTypes: existingBucket?.eventTypes || {},
        sessions: existingBucket?.sessions || {}
      });
    }
    
    return buckets.slice(-config.maxPoints);
  };
  
  const setTimeRange = (range: TimeRange) => {
    timeRange.value = range;
    reaggregateData();
  };
  
  const reaggregateData = () => {
    dataPoints.value = [];
    
    const now = Date.now();
    const cutoffTime = now - currentConfig.value.duration;
    
    let relevantEvents = allEvents.value.filter(event => {
      const timestamp = getEventTimestamp(event);
      return timestamp >= cutoffTime;
    });
    
    if (agentIdFilter) {
      relevantEvents = relevantEvents.filter(event => {
        const agentKey = event.agent_slug || event.agentSlug || event.task_id || event.taskId;
        return agentKey === agentIdFilter;
      });
    }
    
    relevantEvents.forEach(event => {
      const timestamp = getEventTimestamp(event);
      const bucketTime = getBucketTimestamp(timestamp);
      const eventType = getEventType(event);
      const sessionId = getSessionId(event);
      
      let bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        if (!bucket.eventTypes) bucket.eventTypes = {};
        bucket.eventTypes[eventType] = (bucket.eventTypes[eventType] || 0) + 1;
        if (!bucket.sessions) bucket.sessions = {};
        bucket.sessions[sessionId] = (bucket.sessions[sessionId] || 0) + 1;
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [eventType]: 1 },
          sessions: { [sessionId]: 1 }
        });
      }
    });
    
    cleanOldData();
  };
  
  // Auto-clean old data every second
  const cleanupInterval = setInterval(() => {
    cleanOldData();
    cleanOldEvents();
  }, 1000);
  
  const cleanup = () => {
    clearInterval(cleanupInterval);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      processEventBuffer();
    }
  };
  
  // Compute event timing metrics
  const eventTimingMetrics = computed(() => {
    const now = Date.now();
    const config = currentConfig.value;
    const cutoffTime = now - config.duration;
    
    const windowEvents = allEvents.value
      .filter(e => getEventTimestamp(e) >= cutoffTime)
      .sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b));
    
    if (windowEvents.length < 2) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }
    
    const gaps: number[] = [];
    for (let i = 1; i < windowEvents.length; i++) {
      const gap = getEventTimestamp(windowEvents[i]) - getEventTimestamp(windowEvents[i - 1]);
      if (gap > 0) gaps.push(gap);
    }
    
    if (gaps.length === 0) {
      return { minGap: 0, maxGap: 0, avgGap: 0 };
    }
    
    const minGap = Math.min(...gaps);
    const maxGap = Math.max(...gaps);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    
    return { minGap, maxGap, avgGap };
  });
  
  return {
    timeRange,
    dataPoints,
    addEvent,
    getChartData,
    setTimeRange,
    cleanup,
    currentConfig,
    eventTimingMetrics
  };
}

