<template>
  <div class="dimensions-component">
    <div v-if="dimensions.length === 0" class="empty-state">
      <p>No dimensions configured for this scope</p>
    </div>

    <div v-else class="dimensions-grid">
      <div
        v-for="dimension in dimensions"
        :key="dimension.id"
        class="dimension-config-card"
        :class="{ inactive: !dimension.isActive }"
      >
        <div class="card-header">
          <span class="dimension-slug">{{ dimension.slug }}</span>
          <span class="dimension-weight">Weight: {{ formatPercent(dimension.weight) }}</span>
        </div>
        <h4>{{ dimension.name }}</h4>
        <p v-if="dimension.description">{{ dimension.description }}</p>
        <div class="card-meta">
          <span :class="dimension.isActive ? 'active' : 'inactive'">
            {{ dimension.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RiskDimension } from '@/types/risk-agent';

interface Props {
  dimensions: RiskDimension[];
  scopeId?: string;
}

defineProps<Props>();

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}
</script>

<style scoped>
.dimensions-component {
  max-width: 1000px;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium, #666);
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.dimension-config-card {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.dimension-config-card.inactive {
  opacity: 0.6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.dimension-slug {
  font-family: monospace;
  font-size: 0.75rem;
  background: var(--ion-color-light, #f4f5f8);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.dimension-weight {
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
}

.dimension-config-card h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.dimension-config-card p {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--ion-color-medium, #666);
  line-height: 1.4;
}

.card-meta {
  font-size: 0.75rem;
}

.card-meta .active {
  color: var(--ion-color-success, #2dd36f);
}

.card-meta .inactive {
  color: var(--ion-color-medium, #666);
}
</style>
