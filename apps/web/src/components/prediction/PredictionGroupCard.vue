<template>
  <div
    class="prediction-group-card"
    :class="{ selected: isSelected }"
    @click="$emit('click')"
  >
    <div class="card-header">
      <div class="target-info">
        <span v-if="isTest" class="test-badge">TEST</span>
        <span class="target-symbol">{{ targetSymbol }}</span>
        <span class="target-name">{{ targetName }}</span>
      </div>
      <div class="meta-info">
        <span class="timeframe" v-if="timeframe">{{ timeframe }}</span>
        <span class="date">{{ formatDate(generatedAt) }}</span>
      </div>
    </div>

    <div class="analyst-indicators">
      <div
        v-for="analyst in analysts"
        :key="analyst.slug"
        class="analyst-indicator"
        :class="[getDirectionClass(analyst.direction), getAnalystClass(analyst.slug)]"
        :title="`${analyst.name}: ${analyst.direction} (${Math.round(analyst.confidence * 100)}%)`"
      >
        <span class="analyst-name">{{ getFullName(analyst.slug) }}</span>
        <span class="direction-arrow">{{ getDirectionArrow(analyst.direction) }}</span>
      </div>
    </div>

    <div class="card-footer">
      <span class="prediction-count">{{ analysts.length }} analysts</span>
      <span class="click-hint">Click to view details</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Prediction } from '@/services/predictionDashboardService';

interface AnalystSummary {
  slug: string;
  name: string;
  direction: string;
  confidence: number;
}

interface Props {
  predictions: Prediction[];
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
});

defineEmits<{
  click: [];
}>();

// Get target info from first prediction
const targetSymbol = computed(() => props.predictions[0]?.targetSymbol || 'N/A');
const targetName = computed(() => props.predictions[0]?.targetName || '');
const timeframe = computed(() => props.predictions[0]?.timeframe || '');
const generatedAt = computed(() => props.predictions[0]?.generatedAt || '');
const isTest = computed(() => props.predictions[0]?.isTest || false);

// Build analyst summary from predictions
const analysts = computed<AnalystSummary[]>(() => {
  return props.predictions
    .filter(p => p.analystSlug && p.analystSlug !== 'arbitrator')
    .map(p => ({
      slug: p.analystSlug!,
      name: formatAnalystName(p.analystSlug!),
      direction: p.direction || 'flat',
      confidence: p.confidence || 0,
    }))
    .sort((a, b) => {
      // Sort by analyst order: Fred, Tina, Sally, Alex, Carl
      const order = ['fundamental-fred', 'technical-tina', 'sentiment-sally', 'aggressive-alex', 'cautious-carl'];
      return order.indexOf(a.slug) - order.indexOf(b.slug);
    });
});

function formatAnalystName(slug: string): string {
  const nameMap: Record<string, string> = {
    'fundamental-fred': 'Fundamental Fred',
    'technical-tina': 'Technical Tina',
    'sentiment-sally': 'Sentiment Sally',
    'aggressive-alex': 'Aggressive Alex',
    'cautious-carl': 'Cautious Carl',
  };
  return nameMap[slug] || slug;
}

function getFullName(slug: string): string {
  const nameMap: Record<string, string> = {
    'fundamental-fred': 'Fundamental Fred',
    'technical-tina': 'Technical Tina',
    'sentiment-sally': 'Sentiment Sally',
    'aggressive-alex': 'Aggressive Alex',
    'cautious-carl': 'Cautious Carl',
  };
  return nameMap[slug] || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getDirectionClass(direction: string): string {
  const dir = direction?.toLowerCase();
  if (dir === 'up' || dir === 'bullish') return 'direction-up';
  if (dir === 'down' || dir === 'bearish') return 'direction-down';
  return 'direction-neutral';
}

function getAnalystClass(slug: string): string {
  const classMap: Record<string, string> = {
    'fundamental-fred': 'analyst-fred',
    'technical-tina': 'analyst-tina',
    'sentiment-sally': 'analyst-sally',
    'aggressive-alex': 'analyst-alex',
    'cautious-carl': 'analyst-carl',
  };
  return classMap[slug] || '';
}

function getDirectionArrow(direction: string): string {
  const dir = direction?.toLowerCase();
  if (dir === 'up' || dir === 'bullish') return '↑';
  if (dir === 'down' || dir === 'bearish') return '↓';
  return '→';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
.prediction-group-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prediction-group-card:hover {
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.prediction-group-card.selected {
  border-color: var(--primary-color, #3b82f6);
  background: var(--selected-bg, #eff6ff);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.target-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.target-symbol {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.target-name {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.test-badge {
  font-size: 0.5rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  background-color: rgba(139, 92, 246, 0.15);
  color: #7c3aed;
}

.meta-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.timeframe {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-color, #3b82f6);
}

.date {
  font-size: 0.625rem;
  color: var(--text-secondary, #6b7280);
}

.analyst-indicators {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.analyst-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.analyst-indicator:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.analyst-name {
  font-weight: 600;
  flex: 1;
}

.direction-arrow {
  font-size: 1.125rem;
  font-weight: 700;
}

/* Direction colors */
.analyst-indicator.direction-up {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.analyst-indicator.direction-down {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.analyst-indicator.direction-neutral {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
}

/* Analyst-specific accent colors (border) */
.analyst-indicator.analyst-fred {
  border: 2px solid rgba(59, 130, 246, 0.5);
}

.analyst-indicator.analyst-tina {
  border: 2px solid rgba(236, 72, 153, 0.5);
}

.analyst-indicator.analyst-sally {
  border: 2px solid rgba(34, 197, 94, 0.5);
}

.analyst-indicator.analyst-alex {
  border: 2px solid rgba(249, 115, 22, 0.5);
}

.analyst-indicator.analyst-carl {
  border: 2px solid rgba(107, 114, 128, 0.5);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.prediction-count {
  font-size: 0.625rem;
  color: var(--text-secondary, #6b7280);
}

.click-hint {
  font-size: 0.625rem;
  color: var(--text-tertiary, #9ca3af);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.prediction-group-card:hover .click-hint {
  opacity: 1;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .prediction-group-card {
    --card-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --text-tertiary: #6b7280;
    --selected-bg: #1e3a5f;
  }
}
</style>
