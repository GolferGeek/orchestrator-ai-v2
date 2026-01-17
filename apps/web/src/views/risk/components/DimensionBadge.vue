<template>
  <div
    class="dimension-badge"
    :style="badgeStyle"
    :title="tooltip"
  >
    <span v-if="showIcon" class="badge-icon">
      <component :is="iconComponent" v-if="iconComponent" />
      <span v-else class="icon-fallback">{{ iconFallback }}</span>
    </span>
    <span class="badge-label">{{ displayLabel }}</span>
    <span v-if="showScore" class="badge-score" :class="scoreClass">
      {{ formattedScore }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import type { RiskDimension } from '@/types/risk-agent';

interface Props {
  dimension?: RiskDimension | null;
  slug?: string;
  name?: string;
  displayName?: string;
  icon?: string;
  color?: string;
  score?: number | null;
  showIcon?: boolean;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  dimension: null,
  showIcon: true,
  showScore: false,
  size: 'md',
});

// Icon mapping for lucide-vue-next icons
const iconMap: Record<string, () => Promise<any>> = {
  'chart-line': () => import('lucide-vue-next').then(m => m.TrendingUp),
  'trending-up': () => import('lucide-vue-next').then(m => m.TrendingUp),
  'droplet': () => import('lucide-vue-next').then(m => m.Droplet),
  'water': () => import('lucide-vue-next').then(m => m.Droplet),
  'credit-card': () => import('lucide-vue-next').then(m => m.CreditCard),
  'scale': () => import('lucide-vue-next').then(m => m.Scale),
  'cog': () => import('lucide-vue-next').then(m => m.Cog),
  'settings': () => import('lucide-vue-next').then(m => m.Settings),
  'activity': () => import('lucide-vue-next').then(m => m.Activity),
  'bar-chart-2': () => import('lucide-vue-next').then(m => m.BarChart2),
  'globe': () => import('lucide-vue-next').then(m => m.Globe),
  'git-merge': () => import('lucide-vue-next').then(m => m.GitMerge),
  'zap': () => import('lucide-vue-next').then(m => m.Zap),
  'target': () => import('lucide-vue-next').then(m => m.Target),
  'map': () => import('lucide-vue-next').then(m => m.Map),
  'percent': () => import('lucide-vue-next').then(m => m.Percent),
  'dollar-sign': () => import('lucide-vue-next').then(m => m.DollarSign),
  'cpu': () => import('lucide-vue-next').then(m => m.Cpu),
  'users': () => import('lucide-vue-next').then(m => m.Users),
  'shield': () => import('lucide-vue-next').then(m => m.Shield),
  'alert-triangle': () => import('lucide-vue-next').then(m => m.AlertTriangle),
  'circle': () => import('lucide-vue-next').then(m => m.Circle),
};

// Get values from dimension object or direct props
const resolvedIcon = computed(() => {
  return props.icon || props.dimension?.icon || 'circle';
});

const resolvedColor = computed(() => {
  return props.color || props.dimension?.color || '#6B7280';
});

const resolvedName = computed(() => {
  return props.displayName || props.name || props.dimension?.displayName || props.dimension?.name || props.slug || 'Unknown';
});

const resolvedSlug = computed(() => {
  return props.slug || props.dimension?.slug || '';
});

const displayLabel = computed(() => {
  return resolvedName.value;
});

const tooltip = computed(() => {
  const desc = props.dimension?.description;
  return desc ? `${resolvedName.value}: ${desc}` : resolvedName.value;
});

const iconComponent = computed(() => {
  const iconName = resolvedIcon.value;
  if (iconName && iconMap[iconName]) {
    return defineAsyncComponent(iconMap[iconName]);
  }
  return null;
});

const iconFallback = computed(() => {
  // First letter of slug or name
  const text = resolvedSlug.value || resolvedName.value;
  return text.charAt(0).toUpperCase();
});

const badgeStyle = computed(() => {
  const color = resolvedColor.value;
  const lightBg = hexToRgba(color, 0.1);
  const borderColor = hexToRgba(color, 0.3);

  return {
    '--badge-color': color,
    '--badge-bg': lightBg,
    '--badge-border': borderColor,
  };
});

const formattedScore = computed(() => {
  if (props.score === null || props.score === undefined) return '-';
  // Handle both 0-1 and 0-100 scales
  const normalized = props.score > 1 ? props.score : props.score * 100;
  return `${Math.round(normalized)}%`;
});

const scoreClass = computed(() => {
  if (props.score === null || props.score === undefined) return '';
  const normalized = props.score > 1 ? props.score / 100 : props.score;
  if (normalized >= 0.7) return 'high';
  if (normalized >= 0.4) return 'medium';
  return 'low';
});

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(107, 114, 128, ${alpha})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}
</script>

<style scoped>
.dimension-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background: var(--badge-bg);
  border: 1px solid var(--badge-border);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--badge-color);
  transition: all 0.2s;
}

.dimension-badge:hover {
  background: var(--badge-border);
}

/* Icon */
.badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.badge-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.icon-fallback {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

/* Label */
.badge-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

/* Score */
.badge-score {
  margin-left: 0.25rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
}

.badge-score.high {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.badge-score.medium {
  background: rgba(234, 179, 8, 0.15);
  color: #ca8a04;
}

.badge-score.low {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

/* Size variants */
.dimension-badge[data-size="sm"] {
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
}

.dimension-badge[data-size="sm"] .badge-icon {
  width: 12px;
  height: 12px;
}

.dimension-badge[data-size="sm"] .badge-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.dimension-badge[data-size="lg"] {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  gap: 0.5rem;
}

.dimension-badge[data-size="lg"] .badge-icon {
  width: 18px;
  height: 18px;
}

.dimension-badge[data-size="lg"] .badge-icon :deep(svg) {
  width: 18px;
  height: 18px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .dimension-badge {
    background: var(--badge-border);
  }

  .dimension-badge:hover {
    background: var(--badge-bg);
  }
}
</style>
