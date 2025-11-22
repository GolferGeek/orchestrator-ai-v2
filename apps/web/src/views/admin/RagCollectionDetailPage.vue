<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/admin/rag/collections" />
        </ion-buttons>
        <ion-title>{{ collection?.name || 'Collection' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openQueryModal">
            <ion-icon slot="icon-only" :icon="searchOutline" />
          </ion-button>
          <ion-button @click="openUploadModal">
            <ion-icon slot="icon-only" :icon="cloudUploadOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="collection-detail-container">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <ion-spinner name="crescent" />
          <p>Loading collection...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" />
          <p>{{ error }}</p>
          <ion-button @click="loadCollection">Retry</ion-button>
        </div>

        <!-- Collection Content -->
        <template v-else-if="collection">
          <!-- Collection Info -->
          <ion-card class="info-card">
            <ion-card-header>
              <ion-card-title>{{ collection.name }}</ion-card-title>
              <ion-card-subtitle>{{ collection.slug }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p v-if="collection.description" class="description">
                {{ collection.description }}
              </p>
              <ion-grid>
                <ion-row>
                  <ion-col size="6" size-md="3">
                    <div class="info-item">
                      <ion-icon :icon="documentOutline" />
                      <span>{{ collection.documentCount }} documents</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="info-item">
                      <ion-icon :icon="layersOutline" />
                      <span>{{ collection.chunkCount }} chunks</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="info-item">
                      <ion-icon :icon="codeOutline" />
                      <span>{{ collection.embeddingModel }}</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="info-item">
                      <ion-chip :color="getStatusColor(collection.status)" size="small">
                        {{ collection.status }}
                      </ion-chip>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>

          <!-- Documents Section -->
          <div class="documents-section">
            <div class="section-header">
              <h2>Documents</h2>
              <ion-button fill="outline" size="small" @click="openUploadModal">
                <ion-icon slot="start" :icon="cloudUploadOutline" />
                Upload
              </ion-button>
            </div>

            <!-- Documents Loading -->
            <div v-if="ragStore.documentsLoading" class="loading-state small">
              <ion-spinner name="crescent" />
              <p>Loading documents...</p>
            </div>

            <!-- Empty Documents -->
            <div v-else-if="ragStore.documents.length === 0" class="empty-state small">
              <ion-icon :icon="documentOutline" />
              <p>No documents yet. Upload your first document to get started.</p>
            </div>

            <!-- Documents List -->
            <ion-list v-else>
              <ion-item
                v-for="doc in ragStore.documents"
                :key="doc.id"
                button
                @click="viewDocument(doc)"
              >
                <ion-icon :icon="getFileIcon(doc.fileType)" slot="start" />
                <ion-label>
                  <h3>{{ doc.filename }}</h3>
                  <p>
                    {{ formatFileSize(doc.fileSize) }} |
                    {{ doc.chunkCount }} chunks |
                    {{ doc.tokenCount }} tokens
                  </p>
                </ion-label>
                <ion-chip
                  slot="end"
                  :color="getDocStatusColor(doc.status)"
                  size="small"
                >
                  {{ doc.status }}
                </ion-chip>
                <ion-button
                  slot="end"
                  fill="clear"
                  color="danger"
                  @click.stop="confirmDeleteDocument(doc)"
                >
                  <ion-icon :icon="trashOutline" />
                </ion-button>
              </ion-item>
            </ion-list>
          </div>
        </template>
      </div>

      <!-- Upload Document Modal -->
      <ion-modal :is-open="showUploadModal" @didDismiss="closeUploadModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Upload Document</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeUploadModal">Cancel</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="upload-area" :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleFileDrop"
          >
            <ion-icon :icon="cloudUploadOutline" />
            <h3>Drag & Drop Files</h3>
            <p>or click to browse</p>
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              accept=".pdf,.docx,.doc,.txt,.md"
              multiple
              hidden
            />
            <ion-button fill="outline" @click="triggerFileSelect">
              Browse Files
            </ion-button>
          </div>

          <div v-if="selectedFiles.length > 0" class="selected-files">
            <h4>Selected Files</h4>
            <ion-list>
              <ion-item v-for="(file, index) in selectedFiles" :key="index">
                <ion-icon :icon="documentOutline" slot="start" />
                <ion-label>
                  <h3>{{ file.name }}</h3>
                  <p>{{ formatFileSize(file.size) }}</p>
                </ion-label>
                <ion-button slot="end" fill="clear" @click="removeFile(index)">
                  <ion-icon :icon="closeOutline" />
                </ion-button>
              </ion-item>
            </ion-list>
          </div>

          <div class="modal-actions">
            <ion-button
              expand="block"
              @click="uploadFiles"
              :disabled="selectedFiles.length === 0 || isUploading"
            >
              <ion-spinner v-if="isUploading" name="crescent" />
              <span v-else>Upload {{ selectedFiles.length }} File(s)</span>
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Query Modal -->
      <ion-modal :is-open="showQueryModal" @didDismiss="closeQueryModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Search Collection</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeQueryModal">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label position="stacked">Search Query</ion-label>
            <ion-textarea
              v-model="queryText"
              placeholder="Enter your search query..."
              auto-grow
              rows="3"
            />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Top K Results</ion-label>
            <ion-input v-model.number="queryTopK" type="number" min="1" max="20" />
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Strategy</ion-label>
            <ion-select v-model="queryStrategy" interface="popover">
              <ion-select-option value="basic">Basic (Similarity)</ion-select-option>
              <ion-select-option value="mmr">MMR (Diverse Results)</ion-select-option>
            </ion-select>
          </ion-item>

          <ion-button
            expand="block"
            @click="executeQuery"
            :disabled="!queryText || ragStore.searchLoading"
            class="ion-margin-top"
          >
            <ion-spinner v-if="ragStore.searchLoading" name="crescent" />
            <span v-else>Search</span>
          </ion-button>

          <!-- Search Results -->
          <div v-if="ragStore.searchResults.length > 0" class="search-results">
            <h4>
              Results ({{ ragStore.searchResults.length }})
              <span v-if="ragStore.lastSearchDuration">
                in {{ ragStore.lastSearchDuration }}ms
              </span>
            </h4>
            <ion-card v-for="result in ragStore.searchResults" :key="result.chunkId" class="result-card">
              <ion-card-header>
                <ion-card-subtitle>
                  {{ result.documentFilename }}
                  <span v-if="result.pageNumber">| Page {{ result.pageNumber }}</span>
                </ion-card-subtitle>
                <ion-chip size="small" color="primary">
                  Score: {{ (result.score * 100).toFixed(1) }}%
                </ion-chip>
              </ion-card-header>
              <ion-card-content>
                <p class="result-content">{{ result.content }}</p>
              </ion-card-content>
            </ion-card>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Delete Confirmation Alert -->
      <ion-alert
        :is-open="showDeleteAlert"
        header="Delete Document"
        :message="`Are you sure you want to delete '${documentToDelete?.filename}'? This will also delete all associated chunks.`"
        :buttons="[
          { text: 'Cancel', role: 'cancel', handler: () => showDeleteAlert = false },
          { text: 'Delete', role: 'destructive', handler: deleteDocument }
        ]"
        @didDismiss="showDeleteAlert = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonBackButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonModal,
  IonTextarea,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonAlert,
  toastController,
} from '@ionic/vue';
import {
  searchOutline,
  cloudUploadOutline,
  alertCircleOutline,
  documentOutline,
  documentTextOutline,
  layersOutline,
  codeOutline,
  trashOutline,
  closeOutline,
} from 'ionicons/icons';
import { useRagStore } from '@/stores/ragStore';
import { useAuthStore } from '@/stores/authStore';
import ragService, { type RagDocument } from '@/services/ragService';

const route = useRoute();
const ragStore = useRagStore();
const authStore = useAuthStore();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const collection = computed(() => ragStore.currentCollection);

// Upload Modal
const showUploadModal = ref(false);
const isDragOver = ref(false);
const selectedFiles = ref<File[]>([]);
const isUploading = ref(false);
const fileInput = ref<HTMLInputElement>();

// Query Modal
const showQueryModal = ref(false);
const queryText = ref('');
const queryTopK = ref(5);
const queryStrategy = ref<'basic' | 'mmr'>('basic');

// Delete Alert
const showDeleteAlert = ref(false);
const documentToDelete = ref<RagDocument | null>(null);

// Helpers
const getOrgSlug = () => authStore.currentOrganization?.slug || 'demo-org';
const collectionId = computed(() => route.params.id as string);

// Load collection and documents
const loadCollection = async () => {
  loading.value = true;
  error.value = null;
  try {
    const col = await ragService.getCollection(collectionId.value, getOrgSlug());
    ragStore.setCurrentCollection(col);
    await loadDocuments();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load collection';
  } finally {
    loading.value = false;
  }
};

const loadDocuments = async () => {
  if (!collectionId.value) return;
  ragStore.setDocumentsLoading(true);
  try {
    const docs = await ragService.getDocuments(collectionId.value, getOrgSlug());
    ragStore.setDocuments(docs);
  } catch (err) {
    console.error('Failed to load documents:', err);
  } finally {
    ragStore.setDocumentsLoading(false);
  }
};

// File handling
const triggerFileSelect = () => fileInput.value?.click();

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    selectedFiles.value = [...selectedFiles.value, ...Array.from(input.files)];
  }
};

const handleFileDrop = (event: DragEvent) => {
  isDragOver.value = false;
  if (event.dataTransfer?.files) {
    selectedFiles.value = [...selectedFiles.value, ...Array.from(event.dataTransfer.files)];
  }
};

const removeFile = (index: number) => {
  selectedFiles.value.splice(index, 1);
};

// Upload files
const uploadFiles = async () => {
  if (selectedFiles.value.length === 0 || !collectionId.value) return;

  isUploading.value = true;
  let successCount = 0;

  for (const file of selectedFiles.value) {
    try {
      await ragService.uploadDocument(collectionId.value, getOrgSlug(), file);
      successCount++;
    } catch (e) {
      console.error(`Failed to upload ${file.name}:`, e);
    }
  }

  isUploading.value = false;

  if (successCount > 0) {
    const toast = await toastController.create({
      message: `${successCount} file(s) uploaded successfully`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    await loadDocuments();
    await loadCollection(); // Refresh collection stats
  }

  closeUploadModal();
};

// Query
const executeQuery = async () => {
  if (!queryText.value || !collectionId.value) return;

  ragStore.setSearchLoading(true);
  ragStore.setSearchError(null);
  try {
    const response = await ragService.queryCollection(collectionId.value, getOrgSlug(), {
      query: queryText.value,
      topK: queryTopK.value,
      strategy: queryStrategy.value,
    });
    ragStore.setSearchResults(response.results);
    ragStore.setLastSearchDuration(response.searchDurationMs);
  } catch (e) {
    ragStore.setSearchError(e instanceof Error ? e.message : 'Search failed');
    const toast = await toastController.create({
      message: 'Search failed',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    ragStore.setSearchLoading(false);
  }
};

// Delete document
const confirmDeleteDocument = (doc: RagDocument) => {
  documentToDelete.value = doc;
  showDeleteAlert.value = true;
};

const deleteDocument = async () => {
  if (!documentToDelete.value || !collectionId.value) return;

  try {
    await ragService.deleteDocument(
      collectionId.value,
      documentToDelete.value.id,
      getOrgSlug()
    );
    ragStore.removeDocument(documentToDelete.value.id);
    await loadCollection(); // Refresh stats

    const toast = await toastController.create({
      message: 'Document deleted',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (e) {
    const toast = await toastController.create({
      message: 'Failed to delete document',
      duration: 2000,
      color: 'danger',
    });
    await toast.present();
  }
  showDeleteAlert.value = false;
  documentToDelete.value = null;
};

// View document (placeholder)
const viewDocument = (doc: RagDocument) => {
  console.log('View document:', doc);
  // Could expand to show chunks, metadata, etc.
};

// Modal handlers
const openUploadModal = () => {
  selectedFiles.value = [];
  showUploadModal.value = true;
};
const closeUploadModal = () => {
  showUploadModal.value = false;
  selectedFiles.value = [];
};

const openQueryModal = () => {
  ragStore.clearSearch();
  queryText.value = '';
  showQueryModal.value = true;
};
const closeQueryModal = () => {
  showQueryModal.value = false;
};

// Helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'processing': return 'warning';
    case 'error': return 'danger';
    default: return 'medium';
  }
};

const getDocStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'success';
    case 'processing': return 'warning';
    case 'pending': return 'tertiary';
    case 'error': return 'danger';
    default: return 'medium';
  }
};

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return documentTextOutline;
  return documentOutline;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Lifecycle
onMounted(() => {
  void loadCollection();
});
</script>

<style scoped>
.collection-detail-container {
  padding: 1rem;
  max-width: 1000px;
  margin: 0 auto;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.loading-state.small,
.empty-state.small {
  padding: 2rem;
}

.loading-state ion-spinner,
.error-state ion-icon,
.empty-state ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-state ion-icon {
  color: var(--ion-color-danger);
}

.empty-state ion-icon {
  color: var(--ion-color-medium);
}

.info-card .description {
  color: var(--ion-color-medium);
  margin-bottom: 1rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-medium);
}

.info-item ion-icon {
  color: var(--ion-color-primary);
}

.documents-section {
  margin-top: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0;
  color: var(--ion-color-primary);
}

.upload-area {
  border: 2px dashed var(--ion-color-medium);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary-tint);
}

.upload-area ion-icon {
  font-size: 3rem;
  color: var(--ion-color-primary);
}

.upload-area h3 {
  margin: 1rem 0 0.5rem;
}

.upload-area p {
  color: var(--ion-color-medium);
  margin-bottom: 1rem;
}

.selected-files {
  margin-top: 2rem;
}

.selected-files h4 {
  margin-bottom: 0.5rem;
}

.modal-actions {
  margin-top: 2rem;
}

.search-results {
  margin-top: 2rem;
}

.search-results h4 {
  margin-bottom: 1rem;
  color: var(--ion-color-primary);
}

.search-results h4 span {
  font-weight: normal;
  color: var(--ion-color-medium);
}

.result-card {
  margin-bottom: 1rem;
}

.result-content {
  white-space: pre-wrap;
  font-size: 0.9rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .collection-detail-container {
    padding: 0.5rem;
  }
}
</style>
