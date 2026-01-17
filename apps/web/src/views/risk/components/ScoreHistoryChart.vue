<template>
  <div class="score-history-chart">
    <!-- Header with controls -->
    <div class="chart-header">
      <h3 v-if="showTitle">{{ title }}</h3>
      <div class="chart-controls">
        <div class="date-range-selector">
          <button
            v-for="range in dateRanges"
            :key="range.value"
            :class="['range-btn', { active: selectedRange === range.value }]"
            @click="selectedRange = range.value"
          >
            {{ range.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="chart-loading">
      <div class="spinner"></div>
      <span>Loading history...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="chart-error">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="!chartData.length" class="chart-empty">
      <span class="empty-icon">📈</span>
      <span>No historical data available</span>
    </div>

    <!-- Chart -->
    <div v-else class="chart-container" ref="chartContainer">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <!-- Trend indicator -->
    <div v-if="!isLoading && chartData.length > 1" class="trend-indicator">
      <span class="trend-label">Trend:</span>
      <span :class="['trend-value', trendClass]">
        <span class="trend-arrow">{{ trendArrow }}</span>
        {{ trendText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';
import type { ScoreHistoryEntry } from '@/types/risk-agent';

// Register Chart.js components
Chart.register(...registerables);

interface Props {
  subjectId?: string;
  history?: ScoreHistoryEntry[];
  title?: string;
  showTitle?: boolean;
  height?: number;
  showGrid?: boolean;
  showDataPoints?: boolean;
  lineColor?: string;
  fillColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Score History',
  showTitle: true,
  height: 200,
  showGrid: true,
  showDataPoints: true,
  lineColor: '#a87c4f',
  fillColor: 'rgba(168, 124, 79, 0.1)',
});

const emit = defineEmits<{
  'range-change': [days: number];
  'point-click': [entry: ScoreHistoryEntry];
}>();

const chartContainer = ref<HTMLElement | null>(null);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const isLoading = ref(false);
const error = ref<string | null>(null);
const selectedRange = ref(30);

const dateRanges = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

// Filter data based on selected range
const chartData = computed(() => {
  if (!props.history || props.history.length === 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - selectedRange.value);

  return props.history
    .filter(entry => new Date(entry.createdAt) >= cutoffDate)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
});

// Calculate trend
const trend = computed(() => {
  if (chartData.value.length < 2) return 0;
  const first = chartData.value[0].overallScore;
  const last = chartData.value[chartData.value.length - 1].overallScore;
  return last - first;
});

const trendClass = computed(() => {
  if (trend.value > 5) return 'up-bad'; // Risk increasing = bad
  if (trend.value > 0) return 'up-slight';
  if (trend.value < -5) return 'down-good'; // Risk decreasing = good
  if (trend.value < 0) return 'down-slight';
  return 'neutral';
});

const trendArrow = computed(() => {
  if (trend.value > 0) return '↑';
  if (trend.value < 0) return '↓';
  return '→';
});

const trendText = computed(() => {
  const absChange = Math.abs(trend.value);
  if (absChange < 1) return 'Stable';
  return `${absChange.toFixed(0)}% ${trend.value > 0 ? 'increase' : 'decrease'}`;
});

// Create/update chart
function createChart() {
  if (!chartCanvas.value || chartData.value.length === 0) return;

  // Destroy existing chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  const labels = chartData.value.map(entry => formatDate(entry.createdAt));
  const scores = chartData.value.map(entry => entry.overallScore);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Risk Score',
          data: scores,
          borderColor: props.lineColor,
          backgroundColor: props.fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: props.showDataPoints ? 4 : 0,
          pointHoverRadius: 6,
          pointBackgroundColor: props.lineColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              return formatDateFull(chartData.value[idx].createdAt);
            },
            label: (item) => {
              const idx = item.dataIndex;
              const entry = chartData.value[idx];
              const lines = [`Score: ${entry.overallScore}%`];
              if (entry.scoreChange !== 0) {
                const sign = entry.scoreChange > 0 ? '+' : '';
                lines.push(`Change: ${sign}${entry.scoreChange}%`);
              }
              if (entry.confidence) {
                lines.push(`Confidence: ${(entry.confidence * 100).toFixed(0)}%`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: props.showGrid,
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: { size: 10 },
            color: '#6b7280',
            maxRotation: 0,
            maxTicksLimit: 6,
          },
        },
        y: {
          display: true,
          min: 0,
          max: 100,
          grid: {
            display: props.showGrid,
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: { size: 10 },
            color: '#6b7280',
            stepSize: 25,
            callback: (value) => `${value}%`,
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          emit('point-click', chartData.value[idx]);
        }
      },
    },
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Watch for data changes
watch(
  () => [props.history, selectedRange.value],
  () => {
    nextTick(() => {
      createChart();
    });
  },
  { deep: true }
);

// Watch for range changes and emit
watch(selectedRange, (newRange) => {
  emit('range-change', newRange);
});

// Lifecycle
onMounted(() => {
  nextTick(() => {
    createChart();
  });
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});

// Expose methods
defineExpose({
  refresh: createChart,
});
</script>

<style scoped>
.score-history-chart {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Header */
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chart-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

/* Controls */
.chart-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-range-selector {
  display: flex;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
  padding: 2px;
}

.range-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.range-btn:hover {
  color: var(--text-primary, #111827);
}

.range-btn.active {
  background: var(--bg-primary, #ffffff);
  color: var(--primary-color, #a87c4f);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Chart container */
.chart-container {
  position: relative;
  height: v-bind('`${height}px`');
  width: 100%;
}

.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}

/* Trend indicator */
.trend-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-secondary, #f3f4f6);
  border-radius: 6px;
  font-size: 0.75rem;
}

.trend-label {
  color: var(--text-secondary, #6b7280);
}

.trend-value {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
}

.trend-arrow {
  font-size: 1rem;
}

.trend-value.up-bad {
  color: #dc2626;
}

.trend-value.up-slight {
  color: #f97316;
}

.trend-value.down-good {
  color: #16a34a;
}

.trend-value.down-slight {
  color: #22c55e;
}

.trend-value.neutral {
  color: #6b7280;
}

/* States */
.chart-loading,
.chart-error,
.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: v-bind('`${height}px`');
  gap: 0.5rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #a87c4f);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 2rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .chart-header h3 {
    color: #f9fafb;
  }

  .date-range-selector {
    background: #374151;
  }

  .range-btn {
    color: #9ca3af;
  }

  .range-btn:hover {
    color: #f9fafb;
  }

  .range-btn.active {
    background: #4b5563;
    color: #d4a574;
  }

  .trend-indicator {
    background: #374151;
  }

  .trend-label {
    color: #9ca3af;
  }
}
</style>
