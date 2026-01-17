<template>
  <div class="learnings-tab">
    <div v-if="learnings.length === 0" class="empty-state">
      <span class="empty-icon">💡</span>
      <h3>No Pending Learnings</h3>
      <p>The system will suggest learnings based on analysis outcomes.</p>
    </div>

    <div v-else class="learnings-list">
      <div
        v-for="learning in learnings"
        :key="learning.id"
        class="learning-card"
      >
        <div class="learning-header">
          <span :class="['type-badge', getLearningType(learning as any)]">
            {{ formatType(getLearningType(learning as any)) }}
          </span>
          <span class="learning-scope">{{ getScopeName(learning as any) }}</span>
        </div>

        <p class="learning-description">{{ getDescription(learning as any) }}</p>

        <div v-if="getDimensionName(learning as any)" class="learning-dimension">
          <strong>Dimension:</strong> {{ getDimensionName(learning as any) }}
        </div>

        <div v-if="getSuggestedChange(learning as any)" class="learning-change">
          <strong>Suggested Change:</strong>
          <pre>{{ JSON.stringify(getSuggestedChange(learning as any), null, 2) }}</pre>
        </div>

        <div class="learning-meta">
          <span>Created: {{ formatDate(getCreatedAt(learning as any)) }}</span>
          <span v-if="getQueuePriority(learning as any)">Confidence: {{ (getQueuePriority(learning as any)! * 100).toFixed(0) }}%</span>
        </div>

        <div class="learning-actions">
          <button class="btn btn-success" @click="$emit('approve', learning.id)">
            Approve
          </button>
          <button class="btn btn-danger" @click="$emit('reject', learning.id)">
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingLearningView } from '@/types/risk-agent';

// Extended type to handle snake_case from API
type ApiLearning = PendingLearningView & {
  learning_type?: string;
  learningType?: string;
  suggested_learning_type?: string;
  scope_name?: string;
  scopeName?: string;
  dimension_name?: string;
  dimensionName?: string;
  suggested_change?: Record<string, unknown>;
  suggestedChange?: Record<string, unknown>;
  suggested_config?: Record<string, unknown>;
  queue_priority?: number;
  queuePriority?: number;
  ai_confidence?: number;
  aiConfidence?: number;
  created_at?: string;
  createdAt?: string;
  suggested_title?: string;
  suggested_description?: string;
  ai_reasoning?: string;
};

defineProps<{
  learnings: PendingLearningView[];
}>();

defineEmits<{
  approve: [learningId: string];
  reject: [learningId: string];
}>();

function getLearningType(learning: ApiLearning): string {
  return learning.learningType || learning.learning_type || learning.suggested_learning_type || 'pattern';
}

function getScopeName(learning: ApiLearning): string {
  return learning.scopeName || learning.scope_name || 'Unknown Scope';
}

function getDimensionName(learning: ApiLearning): string | undefined {
  return learning.dimensionName || learning.dimension_name;
}

function getDescription(learning: ApiLearning): string {
  return learning.description || learning.suggested_description || '';
}

function getSuggestedChange(learning: ApiLearning): Record<string, unknown> | undefined {
  return learning.suggestedChange || learning.suggested_change || learning.suggested_config;
}

function getQueuePriority(learning: ApiLearning): number | undefined {
  return learning.queuePriority ?? learning.queue_priority ?? learning.aiConfidence ?? learning.ai_confidence;
}

function getCreatedAt(learning: ApiLearning): string {
  return learning.createdAt || learning.created_at || '';
}

function formatType(type: string | undefined): string {
  if (!type) return 'Unknown';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(isoString: string | undefined): string {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}
</script>

<style scoped>
.learnings-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0.5rem 0 0 0;
}

.learnings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.learning-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
}

.learning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.type-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.type-badge.prompt_improvement {
  background: #eff6ff;
  color: #2563eb;
}

.type-badge.weight_adjustment {
  background: #fefce8;
  color: #ca8a04;
}

.type-badge.threshold_change {
  background: #fef2f2;
  color: #dc2626;
}

.type-badge.new_signal {
  background: #f0fdf4;
  color: #16a34a;
}

.learning-scope {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.learning-description {
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.learning-dimension {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.75rem;
}

.learning-change {
  font-size: 0.75rem;
  margin-bottom: 0.75rem;
}

.learning-change strong {
  display: block;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.25rem;
}

.learning-change pre {
  background: var(--code-bg, #f3f4f6);
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.75rem;
  margin: 0;
}

.learning-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.75rem;
}

.learning-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-success {
  background: #dcfce7;
  color: #16a34a;
}

.btn-success:hover {
  background: #bbf7d0;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fee2e2;
}
</style>
