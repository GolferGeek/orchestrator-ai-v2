import { ref, computed } from 'vue';
import type { ObservabilityEvent } from './useAdminObservabilityStream';
import type { ChartDataPoint, TimeRange } from '../types/observability';

export function useAgentChartData(agentIdFilter?: string) {
  const timeRange = ref<TimeRange>('20s');
  const dataPoints = ref<ChartDataPoint[]>([]);
  const allEvents = ref<ObservabilityEvent[]>([]);

  // Debounce for high-frequency events
  let eventBuffer: ObservabilityEvent[] = [];
  let debounceTimer: number | null = null;
  const DEBOUNCE_DELAY = 50; // 50ms debounce

  const timeRangeConfig = {
    '20s': { duration: 20 * 1000, bucketSize: 500, maxPoints: 40 },
    '1m': { duration: 60 * 1000, bucketSize: 1500, maxPoints: 40 },
    '2m': { duration: 2 * 60 * 1000, bucketSize: 3000, maxPoints: 40 },
  };
  
  const currentConfig = computed(() => timeRangeConfig[timeRange.value]);
  
  const getBucketTimestamp = (timestamp: number): number => {
    const config = currentConfig.value;
    return Math.floor(timestamp / config.bucketSize) * config.bucketSize;
  };
  
  const getEventTimestamp = (event: ObservabilityEvent): number => {
    // Check for timestamp in milliseconds
    if (event.timestamp) {
      return typeof event.timestamp === 'number' ? event.timestamp : parseInt(event.timestamp as string, 10);
    }
    // Check for created_at (snake_case)
    if (event.created_at) {
      return new Date(event.created_at).getTime();
    }
    // Check for createdAt (camelCase) - from legacy events
    const eventRecord = event as Record<string, unknown>;
    if ('createdAt' in event && typeof eventRecord.createdAt === 'string') {
      return new Date(eventRecord.createdAt).getTime();
    }
    return Date.now();
  };
  
  const getEventType = (event: ObservabilityEvent): string => {
    return event.hook_event_type || 'unknown';
  };
  
  const getSessionId = (event: ObservabilityEvent): string => {
    return event.context?.taskId || 'unknown';
  };

  const processEventBuffer = () => {
    const eventsToProcess = [...eventBuffer];
    eventBuffer = [];

    allEvents.value.push(...eventsToProcess);

    console.log(`[ChartData] Processing ${eventsToProcess.length} events, filter=${agentIdFilter}`);

    eventsToProcess.forEach(event => {
      const timestamp = getEventTimestamp(event);

      // Skip if event doesn't match agent ID filter
      // Filter can be conversationId, taskId, or agentSlug
      if (agentIdFilter) {
        const eventConversationId = event.context?.conversationId;
        const eventTaskId = event.context?.taskId;
        const eventAgentSlug = event.context?.agentSlug;

        // Match if any of these identifiers match the filter
        const matches =
          eventConversationId === agentIdFilter ||
          eventTaskId === agentIdFilter ||
          eventAgentSlug === agentIdFilter;

        console.log(`[ChartData] Event check: filter=${agentIdFilter}, convId=${eventConversationId}, taskId=${eventTaskId}, agentSlug=${eventAgentSlug}, matches=${matches}`);

        if (!matches) return;
      }
      
      const bucketTime = getBucketTimestamp(timestamp);
      const eventType = getEventType(event);
      const sessionId = getSessionId(event);
      
      // Find existing bucket or create new one
      const bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
      if (bucket) {
        bucket.count++;
        if (!bucket.eventTypes) bucket.eventTypes = {};
        bucket.eventTypes[eventType] = (bucket.eventTypes[eventType] || 0) + 1;
        if (!bucket.sessions) bucket.sessions = {};
        bucket.sessions[sessionId] = (bucket.sessions[sessionId] || 0) + 1;
        console.log(`[ChartData] ✅ Updated bucket at ${bucketTime}, count now ${bucket.count}`);
      } else {
        dataPoints.value.push({
          timestamp: bucketTime,
          count: 1,
          eventTypes: { [eventType]: 1 },
          sessions: { [sessionId]: 1 }
        });
        console.log(`[ChartData] ✅ Created new bucket at ${bucketTime}`);
      }
    });

    console.log(`[ChartData] Total dataPoints: ${dataPoints.value.length}, total count: ${dataPoints.value.reduce((s, d) => s + d.count, 0)}`);

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
        const eventConversationId = event.context?.conversationId;
        const eventTaskId = event.context?.taskId;
        const eventAgentSlug = event.context?.agentSlug;

        return (
          eventConversationId === agentIdFilter ||
          eventTaskId === agentIdFilter ||
          eventAgentSlug === agentIdFilter
        );
      });
    }
    
    relevantEvents.forEach(event => {
      const timestamp = getEventTimestamp(event);
      const bucketTime = getBucketTimestamp(timestamp);
      const eventType = getEventType(event);
      const sessionId = getSessionId(event);
      
      const bucket = dataPoints.value.find(dp => dp.timestamp === bucketTime);
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


















