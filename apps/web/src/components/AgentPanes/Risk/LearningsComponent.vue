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
          <span class="learning-type" :class="getLearningTypeClass(learning)">
            {{ formatLearningType(getLearningType(learning)) }}
          </span>
          <span v-if="getDimensionName(learning)" class="dimension-badge">
            {{ getDimensionName(learning) }}
          </span>
          <span v-if="getScopeName(learning)" class="scope-badge">
            {{ getScopeName(learning) }}
          </span>
        </div>

        <p class="learning-description">{{ getDescription(learning) || 'No description provided' }}</p>

        <div class="suggested-change" v-if="getSuggestedChange(learning)">
          <strong>Suggested Change:</strong>
          <!-- eslint-disable-next-line vue/no-v-html -- Intentional: Rendering sanitized markdown/HTML content from trusted source -->
          <div class="change-content" v-html="formatSuggestedChange(getSuggestedChange(learning))"></div>
        </div>

        <div class="learning-meta">
          <span class="meta-item">
            <span class="meta-label">Created:</span>
            {{ formatDate(getCreatedAt(learning)) }}
          </span>
          <span class="meta-item" v-if="getStatus(learning)">
            <span class="meta-label">Status:</span>
            <span class="status-badge" :class="getStatus(learning)">{{ getStatus(learning) }}</span>
          </span>
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

// Helper functions to handle snake_case/camelCase API responses
function getLearningType(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.learningType || l.learning_type || 'unknown');
}

function getDimensionName(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.dimensionName || l.dimension_name || '');
}

function getScopeName(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.scopeName || l.scope_name || '');
}

function getDescription(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.description || '');
}

function getSuggestedChange(learning: PendingLearningView): Record<string, unknown> | null {
  const l = learning as unknown as Record<string, unknown>;
  const change = l.suggestedChange || l.suggested_change;
  if (!change || (typeof change === 'object' && Object.keys(change as object).length === 0)) {
    return null;
  }
  return change as Record<string, unknown>;
}

function getCreatedAt(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.createdAt || l.created_at || '');
}

function getStatus(learning: PendingLearningView): string {
  const l = learning as unknown as Record<string, unknown>;
  return String(l.status || 'pending');
}

function getLearningTypeClass(learning: PendingLearningView): string {
  const type = getLearningType(learning);
  return type.replace(/_/g, '-');
}

function formatLearningType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSuggestedChange(change: Record<string, unknown> | null): string {
  if (!change) return '<em>No changes specified</em>';

  const entries = Object.entries(change);
  if (entries.length === 0) return '<em>No changes specified</em>';

  return entries.map(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const formattedValue = typeof value === 'object'
      ? `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`
      : `<span class="change-value">${escapeHtml(String(value))}</span>`;
    return `<div class="change-item"><strong>${escapeHtml(label)}:</strong> ${formattedValue}</div>`;
  }).join('');
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m] || m);
}
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

.scope-badge {
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--ion-color-tertiary-tint, #e0f0ff);
  color: var(--ion-color-tertiary, #5260ff);
}

.learning-type.prompt-improvement {
  background: var(--ion-color-primary-tint, #e0ecff);
  color: var(--ion-color-primary, #3880ff);
}

.learning-type.weight-adjustment {
  background: var(--ion-color-warning-tint, #fff3cd);
  color: var(--ion-color-warning-shade, #e0ac08);
}

.learning-type.threshold-change {
  background: var(--ion-color-secondary-tint, #ffe0f0);
  color: var(--ion-color-secondary, #eb445a);
}

.learning-type.new-signal {
  background: var(--ion-color-success-tint, #d4edda);
  color: var(--ion-color-success, #2dd36f);
}

.change-content {
  margin-top: 0.5rem;
}

.change-content :deep(.change-item) {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.change-content :deep(.change-item strong) {
  color: var(--ion-color-primary, #3880ff);
}

.change-content :deep(.change-value) {
  color: var(--ion-text-color, #333);
}

.change-content :deep(pre) {
  margin: 0.25rem 0 0;
  padding: 0.5rem;
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 4px;
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.learning-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
}

.meta-item {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.meta-label {
  color: var(--ion-color-medium, #666);
}

.status-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.625rem;
  text-transform: uppercase;
  font-weight: 600;
}

.status-badge.pending {
  background: var(--ion-color-warning-tint, #fff3cd);
  color: var(--ion-color-warning-shade, #e0ac08);
}

.status-badge.approved {
  background: var(--ion-color-success-tint, #d4edda);
  color: var(--ion-color-success, #2dd36f);
}

.status-badge.rejected {
  background: var(--ion-color-danger-tint, #ffcccc);
  color: var(--ion-color-danger, #eb445a);
}

.status-badge.applied {
  background: var(--ion-color-primary-tint, #e0ecff);
  color: var(--ion-color-primary, #3880ff);
}
</style>
