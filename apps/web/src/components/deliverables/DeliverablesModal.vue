<template>
  <ion-modal
    :is-open="isOpen"
    @did-dismiss="handleClose"
    class="deliverables-modal"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title || 'Deliverable' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleClose">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Version Badge -->
      <div class="version-info">
        <VersionBadge
          :version-number="displayVersionNumber"
          :creation-type="currentCreationType"
          :is-current="true"
        />
        <span v-if="topic" class="topic-label">{{ topic }}</span>
      </div>

      <!-- Version History -->
      <VersionSelector
        v-if="versions.length > 1"
        :versions="versions"
        :selected-version-id="selectedVersionId"
        :loading="isLoadingVersions"
        @select="handleVersionSelect"
        class="version-section"
      />

      <!-- Content Viewer -->
      <ContentViewer
        :blog-post="displayContent.blogPost"
        :seo-description="displayContent.seoDescription"
        :social-posts="displayContent.socialPosts"
        :loading="isLoading"
      />
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <DeliverableActionButtons
          :deliverable-id="deliverableId"
          :current-version-id="selectedVersionId"
          :is-loading="isActionLoading"
          @edit="handleEdit"
          @rerun="handleRerun"
          @export="handleExport"
        />
      </ion-toolbar>
    </ion-footer>
  </ion-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonFooter,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import ContentViewer from '@/components/shared/ContentViewer.vue';
import VersionSelector from '@/components/shared/VersionSelector.vue';
import VersionBadge from '@/components/shared/VersionBadge.vue';
import DeliverableActionButtons from './DeliverableActionButtons.vue';
import { deliverablesService } from '@/services/deliverablesService';
import type { DeliverableVersion } from '@/services/deliverablesService';
import type { VersionCreationType } from '@/components/shared/types';
import type { HitlGeneratedContent } from '@orchestrator-ai/transport-types';

interface Props {
  isOpen: boolean;
  deliverableId: string;
  title?: string;
  topic?: string;
  initialContent?: HitlGeneratedContent;
  currentVersionNumber?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  edit: [deliverableId: string, versionId: string];
  rerun: [deliverableId: string, versionId: string];
}>();

// State
const isLoading = ref(false);
const isLoadingVersions = ref(false);
const isActionLoading = ref(false);
const versions = ref<DeliverableVersion[]>([]);
const selectedVersionId = ref<string | undefined>();

// Content state
const displayContent = reactive<HitlGeneratedContent>({
  blogPost: '',
  seoDescription: '',
  socialPosts: [],
});

// Computed
const displayVersionNumber = computed(() => {
  const current = versions.value.find((v) => v.id === selectedVersionId.value);
  return current?.versionNumber ?? props.currentVersionNumber ?? 1;
});

const currentCreationType = computed<VersionCreationType>(() => {
  const current = versions.value.find((v) => v.id === selectedVersionId.value);
  return (current?.createdByType as VersionCreationType) || 'ai_response';
});

// Initialize content when modal opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      // Set initial content if provided
      if (props.initialContent) {
        displayContent.blogPost = props.initialContent.blogPost || '';
        displayContent.seoDescription = props.initialContent.seoDescription || '';
        displayContent.socialPosts = props.initialContent.socialPosts || [];
      }

      // Load versions
      if (props.deliverableId) {
        await loadVersions();
      }
    }
  }
);

// Load version history
async function loadVersions() {
  if (!props.deliverableId) return;

  isLoadingVersions.value = true;
  try {
    const history = await deliverablesService.getVersionHistory(props.deliverableId);
    versions.value = history;

    // Select current version
    const current = history.find((v) => v.isCurrentVersion);
    selectedVersionId.value = current?.id;

    // Load content from current version if no initial content
    if (current && !props.initialContent) {
      loadVersionContent(current);
    }
  } catch (error) {
    console.error('Failed to load versions:', error);
  } finally {
    isLoadingVersions.value = false;
  }
}

// Load content from a version
function loadVersionContent(version: DeliverableVersion) {
  if (version.content) {
    try {
      const content = JSON.parse(version.content);
      displayContent.blogPost = content.blogPost || '';
      displayContent.seoDescription = content.seoDescription || '';
      displayContent.socialPosts = content.socialPosts || [];
    } catch {
      // Content might be plain text
      displayContent.blogPost = version.content;
      displayContent.seoDescription = '';
      displayContent.socialPosts = [];
    }
  }
}

// Handle version selection
function handleVersionSelect(version: DeliverableVersion) {
  selectedVersionId.value = version.id;
  loadVersionContent(version);
}

// Action handlers
function handleEdit() {
  if (selectedVersionId.value) {
    emit('edit', props.deliverableId, selectedVersionId.value);
  }
}

function handleRerun() {
  if (selectedVersionId.value) {
    emit('rerun', props.deliverableId, selectedVersionId.value);
  }
}

async function handleExport(format: 'markdown' | 'html' | 'json') {
  isActionLoading.value = true;
  try {
    let content = '';
    const filename = `${props.title || 'deliverable'}.${format === 'json' ? 'json' : format === 'html' ? 'html' : 'md'}`;

    if (format === 'json') {
      content = JSON.stringify(displayContent, null, 2);
    } else if (format === 'html') {
      // Simple HTML export
      content = `<!DOCTYPE html>
<html>
<head><title>${props.title || 'Deliverable'}</title></head>
<body>
<h1>${props.title || 'Deliverable'}</h1>
${displayContent.blogPost ? `<article>${displayContent.blogPost}</article>` : ''}
${displayContent.seoDescription ? `<p><strong>SEO:</strong> ${displayContent.seoDescription}</p>` : ''}
${displayContent.socialPosts?.length ? `<h2>Social Posts</h2><ul>${displayContent.socialPosts.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
</body>
</html>`;
    } else {
      // Markdown export
      content = `# ${props.title || 'Deliverable'}\n\n`;
      if (displayContent.blogPost) {
        content += `${displayContent.blogPost}\n\n`;
      }
      if (displayContent.seoDescription) {
        content += `## SEO Description\n\n${displayContent.seoDescription}\n\n`;
      }
      if (displayContent.socialPosts?.length) {
        content += `## Social Posts\n\n${displayContent.socialPosts.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`;
      }
    }

    // Download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export:', error);
  } finally {
    isActionLoading.value = false;
  }
}

function handleClose() {
  emit('close');
}
</script>

<style scoped>
.deliverables-modal {
  --width: 90%;
  --max-width: 800px;
  --height: 90%;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.topic-label {
  font-size: 1.1rem;
  font-weight: 500;
}

.version-section {
  margin-bottom: 1rem;
}
</style>
