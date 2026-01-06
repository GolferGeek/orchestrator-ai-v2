<template>
  <div class="rag-sources-panel" v-if="sources && sources.length > 0">
    <div class="sources-header" @click="toggleExpanded">
      <ion-icon :icon="documentsOutline" />
      <span class="sources-title">Sources ({{ sources.length }})</span>
      <ion-icon :icon="expanded ? chevronUpOutline : chevronDownOutline" class="toggle-icon" />
    </div>
    <div v-if="expanded" class="sources-list">
      <div
        v-for="(source, index) in sources"
        :key="source.chunkId || index"
        class="source-item"
        @click="viewSource(source)"
      >
        <div class="source-info">
          <ion-icon :icon="documentTextOutline" class="doc-icon" />
          <div class="source-details">
            <span class="source-filename">{{ source.documentFilename || 'Document' }}</span>
            <span class="source-meta">
              <span v-if="source.pageNumber">Page {{ source.pageNumber }}</span>
              <span v-if="source.score" class="score-badge">{{ (source.score * 100).toFixed(0) }}%</span>
            </span>
          </div>
        </div>
        <div class="source-excerpt" v-if="source.content">
          {{ truncateContent(source.content) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  documentsOutline,
  chevronUpOutline,
  chevronDownOutline,
  documentTextOutline,
} from 'ionicons/icons';

export interface RagSource {
  chunkId?: string;
  documentId?: string;
  documentFilename?: string;
  content?: string;
  score?: number;
  pageNumber?: number | null;
  chunkIndex?: number;
  charOffset?: number;
  metadata?: Record<string, unknown>;
  documentIdRef?: string;
  sectionPath?: string;
}

defineProps<{
  sources: RagSource[];
  organizationSlug?: string;
}>();

const expanded = ref(false);

function toggleExpanded() {
  expanded.value = !expanded.value;
}

function truncateContent(content: string, maxLength = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

function viewSource(source: RagSource) {
  // Could open a modal with full document view in the future
  console.log('View source:', source);
}
</script>

<style scoped>
.rag-sources-panel {
  margin-top: 12px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.sources-header ion-icon {
  font-size: 18px;
  color: var(--ion-color-primary);
}

.sources-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--ion-color-primary);
}

.toggle-icon {
  font-size: 16px;
  color: var(--ion-color-medium);
}

.sources-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-item {
  padding: 10px;
  background: var(--ion-background-color);
  border-radius: 6px;
  border: 1px solid var(--ion-border-color, var(--ion-color-light-shade));
  cursor: pointer;
  transition: background 0.15s;
}

.source-item:hover {
  background: var(--ion-color-light-tint);
}

.source-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-icon {
  font-size: 20px;
  color: var(--ion-color-primary);
}

.source-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-filename {
  font-weight: 500;
  font-size: 13px;
  color: var(--ion-text-color);
}

.source-meta {
  font-size: 11px;
  color: var(--ion-color-medium);
  display: flex;
  gap: 8px;
}

.score-badge {
  padding: 1px 6px;
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
  border-radius: 4px;
  font-weight: 500;
}

.source-excerpt {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ion-color-medium-shade);
  line-height: 1.4;
}

/* Dark mode */
html.ion-palette-dark .rag-sources-panel,
html[data-theme="dark"] .rag-sources-panel {
  background: var(--ion-color-step-50, rgba(255, 255, 255, 0.05));
  border-color: var(--ion-border-color, rgba(255, 255, 255, 0.1));
}

html.ion-palette-dark .source-item,
html[data-theme="dark"] .source-item {
  background: var(--ion-color-step-100, rgba(255, 255, 255, 0.08));
  border-color: var(--ion-border-color, rgba(255, 255, 255, 0.1));
}

html.ion-palette-dark .source-item:hover,
html[data-theme="dark"] .source-item:hover {
  background: var(--ion-color-step-150, rgba(255, 255, 255, 0.12));
}
</style>
