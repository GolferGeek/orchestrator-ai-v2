<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>RAG Collections</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openCreateModal" v-permission="'rag:write'">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="rag-collections-container">
        <!-- Header Section -->
        <div class="page-header">
          <h1>Knowledge Base Collections</h1>
          <p>Manage document collections for RAG-powered AI responses</p>
        </div>

        <!-- Stats Overview -->
        <div class="stats-section">
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="4">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="folderOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ ragStore.collections.length }}</h3>
                      <p>Collections</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="documentOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ ragStore.totalDocuments }}</h3>
                      <p>Documents</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="4">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="layersOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ ragStore.totalChunks }}</h3>
                      <p>Chunks</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- Loading State -->
        <div v-if="ragStore.collectionsLoading" class="loading-state">
          <ion-spinner name="crescent" />
          <p>Loading collections...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="ragStore.collectionsError" class="error-state">
          <ion-icon :icon="alertCircleOutline" />
          <p>{{ ragStore.collectionsError }}</p>
          <ion-button @click="loadCollections">Retry</ion-button>
        </div>

        <!-- Empty State -->
        <div v-else-if="!ragStore.hasCollections" class="empty-state">
          <ion-icon :icon="folderOpenOutline" />
          <h3>No Collections Yet</h3>
          <p>Create your first collection to start building your knowledge base</p>
          <ion-button @click="openCreateModal">
            <ion-icon slot="start" :icon="addOutline" />
            Create Collection
          </ion-button>
        </div>

        <!-- Collections List -->
        <div v-else class="collections-list">
          <ion-card
            v-for="collection in ragStore.collections"
            :key="collection.id"
            button
            @click="viewCollection(collection)"
            class="collection-card"
          >
            <ion-card-header>
              <ion-card-title>{{ collection.name }}</ion-card-title>
              <ion-card-subtitle>{{ collection.slug }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p v-if="collection.description" class="description">
                {{ collection.description }}
              </p>
              <div class="collection-stats">
                <ion-chip color="primary" size="small">
                  <ion-icon :icon="documentOutline" />
                  <ion-label>{{ collection.documentCount }} docs</ion-label>
                </ion-chip>
                <ion-chip color="secondary" size="small">
                  <ion-icon :icon="layersOutline" />
                  <ion-label>{{ collection.chunkCount }} chunks</ion-label>
                </ion-chip>
                <ion-chip :color="getStatusColor(collection.status)" size="small">
                  <ion-label>{{ collection.status }}</ion-label>
                </ion-chip>
              </div>
              <div class="collection-meta">
                <span>
                  <ion-icon :icon="codeOutline" />
                  {{ collection.embeddingModel }}
                </span>
                <span>
                  <ion-icon :icon="timeOutline" />
                  {{ formatDate(collection.updatedAt) }}
                </span>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Create Collection Modal -->
      <ion-modal :is-open="showCreateModal" @didDismiss="closeCreateModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Create Collection</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeCreateModal">Cancel</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-list>
            <ion-item>
              <ion-label position="stacked">Name *</ion-label>
              <ion-input
                v-model="newCollection.name"
                placeholder="e.g., Company Policies"
                required
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Slug (optional)</ion-label>
              <ion-input
                v-model="newCollection.slug"
                placeholder="auto-generated from name"
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="newCollection.description"
                placeholder="Describe what documents this collection contains"
                auto-grow
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Embedding Model</ion-label>
              <ion-select v-model="newCollection.embeddingModel" interface="popover" disabled>
                <ion-select-option value="nomic-embed-text">nomic-embed-text (768d)</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Chunk Size</ion-label>
              <ion-input
                v-model.number="newCollection.chunkSize"
                type="number"
                min="100"
                max="4000"
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Chunk Overlap</ion-label>
              <ion-input
                v-model.number="newCollection.chunkOverlap"
                type="number"
                min="0"
                max="500"
              />
            </ion-item>
          </ion-list>
          <div class="modal-actions">
            <ion-button expand="block" @click="createCollection" :disabled="!newCollection.name || isCreating">
              <ion-spinner v-if="isCreating" name="crescent" />
              <span v-else>Create Collection</span>
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonMenuButton,
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
  IonLabel,
  IonSpinner,
  IonModal,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  toastController,
} from '@ionic/vue';
import {
  addOutline,
  folderOutline,
  folderOpenOutline,
  documentOutline,
  layersOutline,
  alertCircleOutline,
  codeOutline,
  timeOutline,
} from 'ionicons/icons';
import { useRagStore } from '@/stores/ragStore';
import { useAuthStore } from '@/stores/authStore';
import ragService, { type RagCollection, type CreateCollectionDto } from '@/services/ragService';

const router = useRouter();
const ragStore = useRagStore();
const authStore = useAuthStore();

// Modal state
const showCreateModal = ref(false);
const isCreating = ref(false);
const newCollection = ref<CreateCollectionDto>({
  name: '',
  slug: '',
  description: '',
  embeddingModel: 'nomic-embed-text',
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Get organization slug from auth store
const getOrgSlug = () => {
  return authStore.currentNamespace || 'demo-org';
};

// Load collections
const loadCollections = async () => {
  ragStore.setCollectionsLoading(true);
  ragStore.setCollectionsError(null);
  try {
    const collections = await ragService.getCollections(getOrgSlug());
    ragStore.setCollections(collections);
  } catch (error) {
    ragStore.setCollectionsError(
      error instanceof Error ? error.message : 'Failed to load collections'
    );
  } finally {
    ragStore.setCollectionsLoading(false);
  }
};

// Create collection
const createCollection = async () => {
  if (!newCollection.value.name) return;

  isCreating.value = true;
  try {
    const created = await ragService.createCollection(getOrgSlug(), newCollection.value);
    ragStore.addCollection(created);
    closeCreateModal();
    const toast = await toastController.create({
      message: `Collection "${created.name}" created successfully`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Failed to create collection',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    isCreating.value = false;
  }
};

// View collection details
const viewCollection = (collection: RagCollection) => {
  ragStore.setCurrentCollection(collection);
  router.push(`/app/admin/rag/collections/${collection.id}`);
};

// Modal handlers
const openCreateModal = () => {
  newCollection.value = {
    name: '',
    slug: '',
    description: '',
    embeddingModel: 'nomic-embed-text',
    chunkSize: 1000,
    chunkOverlap: 200,
  };
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

// Helpers
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'processing':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'medium';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

// Lifecycle
onMounted(() => {
  void loadCollections();
});
</script>

<style scoped>
.rag-collections-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h1 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--ion-color-medium);
}

.stats-section {
  margin-bottom: 2rem;
}

.stat-card {
  text-align: center;
}

.stat-card ion-card-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.stat-icon ion-icon {
  font-size: 2rem;
  color: var(--ion-color-primary);
}

.stat-info h3 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--ion-color-primary);
}

.stat-info p {
  margin: 0;
  color: var(--ion-color-medium);
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

.collections-list {
  display: grid;
  gap: 1rem;
}

.collection-card {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.collection-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.collection-card .description {
  color: var(--ion-color-medium);
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.collection-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

.collection-meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.collection-meta ion-icon {
  font-size: 1rem;
}

.modal-actions {
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .rag-collections-container {
    padding: 0.5rem;
  }
}
</style>
