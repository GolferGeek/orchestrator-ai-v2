<template>
  <div class="risk-radar-chart">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`">
      <!-- Grid circles -->
      <circle
        v-for="i in 5"
        :key="`grid-${i}`"
        :cx="center"
        :cy="center"
        :r="(radius / 5) * i"
        fill="none"
        stroke="var(--ion-border-color, #e0e0e0)"
        stroke-width="1"
      />

      <!-- Axis lines -->
      <line
        v-for="(point, index) in axisPoints"
        :key="`axis-${index}`"
        :x1="center"
        :y1="center"
        :x2="point.x"
        :y2="point.y"
        stroke="var(--ion-border-color, #e0e0e0)"
        stroke-width="1"
      />

      <!-- Data polygon -->
      <polygon
        :points="dataPolygon"
        fill="var(--ion-color-primary, #3880ff)"
        fill-opacity="0.3"
        stroke="var(--ion-color-primary, #3880ff)"
        stroke-width="2"
      />

      <!-- Data points -->
      <circle
        v-for="(point, index) in dataPoints"
        :key="`point-${index}`"
        :cx="point.x"
        :cy="point.y"
        r="4"
        fill="var(--ion-color-primary, #3880ff)"
      />

      <!-- Labels -->
      <text
        v-for="(label, index) in labelPoints"
        :key="`label-${index}`"
        :x="label.x"
        :y="label.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="dimension-label"
      >
        {{ label.text }}
      </text>
    </svg>

    <!-- Legend -->
    <div class="legend">
      <div
        v-for="assessment in assessments"
        :key="assessment.id"
        class="legend-item"
      >
        <span class="legend-color" :style="{ background: getScoreColor(assessment.score) }"></span>
        <span class="legend-name">{{ assessment.dimensionName || assessment.dimensionSlug }}</span>
        <span class="legend-score">{{ formatPercent(assessment.score) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RiskAssessment } from '@/types/risk-agent';

interface Props {
  assessments: RiskAssessment[];
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 300,
});

const center = computed(() => props.size / 2);
const radius = computed(() => (props.size / 2) - 40);

// Calculate axis endpoint positions
const axisPoints = computed(() => {
  const count = props.assessments.length;
  if (count === 0) return [];

  return props.assessments.map((_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    return {
      x: center.value + Math.cos(angle) * radius.value,
      y: center.value + Math.sin(angle) * radius.value,
    };
  });
});

// Calculate data point positions based on scores
const dataPoints = computed(() => {
  const count = props.assessments.length;
  if (count === 0) return [];

  return props.assessments.map((assessment, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = radius.value * assessment.score;
    return {
      x: center.value + Math.cos(angle) * r,
      y: center.value + Math.sin(angle) * r,
    };
  });
});

// Create polygon points string
const dataPolygon = computed(() => {
  return dataPoints.value.map((p) => `${p.x},${p.y}`).join(' ');
});

// Calculate label positions (slightly outside the chart)
const labelPoints = computed(() => {
  const count = props.assessments.length;
  if (count === 0) return [];

  return props.assessments.map((assessment, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const r = radius.value + 25;
    return {
      x: center.value + Math.cos(angle) * r,
      y: center.value + Math.sin(angle) * r,
      text: assessment.dimensionSlug?.substring(0, 8) || `D${i + 1}`,
    };
  });
});

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'var(--ion-color-danger, #eb445a)';
  if (score >= 0.6) return 'var(--ion-color-warning, #ffc409)';
  if (score >= 0.4) return '#ffd966';
  return 'var(--ion-color-success, #2dd36f)';
}
</script>

<style scoped>
.risk-radar-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.dimension-label {
  font-size: 0.625rem;
  fill: var(--ion-text-color, #333);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-name {
  color: var(--ion-color-medium, #666);
}

.legend-score {
  font-weight: 600;
}
</style>
