<template>
  <div class="learnings-component">
    <div v-if="learnings.length === 0" class="empty-state">
      <p>No pending learnings to review</p>
    </div>

    <div v-else class="learnings-list">
      <div
        v-for="learning in learnings"
        :key="learning.id"
        class="learning-card"
      >
        <div class="card-header">
          <span class="learning-type">{{ learning.learningType }}</span>
          <span v-if="learning.dimensionName" class="dimension-badge">
            {{ learning.dimensionName }}
          </span>
        </div>
        <p class="learning-description">{{ learning.description }}</p>
        <div class="suggested-change">
          <strong>Suggested Change:</strong>
          <pre>{{ JSON.stringify(learning.suggestedChange, null, 2) }}</pre>
        </div>
        <div class="card-actions">
          <button class="approve-btn" @click="$emit('approve', learning.id)">
            Approve
          </button>
          <button class="reject-btn" @click="$emit('reject', learning.id)">
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingLearningView } from '@/types/risk-agent';

interface Props {
  learnings: PendingLearningView[];
}

defineProps<Props>();

defineEmits<{
  (e: 'approve', learningId: string): void;
  (e: 'reject', learningId: string): void;
}>();
</script>

<style scoped>
.learnings-component {
  max-width: 800px;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium, #666);
}

.learnings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.learning-card {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.learning-type {
  font-size: 0.625rem;
  text-transform: uppercase;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--ion-color-primary-tint, #e0ecff);
  color: var(--ion-color-primary, #3880ff);
}

.dimension-badge {
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--ion-color-light, #f4f5f8);
}

.learning-description {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.suggested-change {
  margin-bottom: 1rem;
}

.suggested-change strong {
  font-size: 0.75rem;
  display: block;
  margin-bottom: 0.25rem;
}

.suggested-change pre {
  margin: 0;
  padding: 0.75rem;
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 4px;
  font-size: 0.75rem;
  overflow-x: auto;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.approve-btn,
.reject-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8125rem;
}

.approve-btn {
  background: var(--ion-color-success, #2dd36f);
  color: white;
}

.approve-btn:hover {
  background: var(--ion-color-success-shade, #28ba62);
}

.reject-btn {
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-text-color, #333);
}

.reject-btn:hover {
  background: var(--ion-color-light-shade, #d7d8da);
}
</style>
