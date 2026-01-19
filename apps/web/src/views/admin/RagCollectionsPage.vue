<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>RAG Collections</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="openCreateModal" v-permission="'rag:write'">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
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
              <div class="card-title-row">
                <ion-card-title>{{ collection.name }}</ion-card-title>
                <div class="card-actions">
                  <ion-icon
                    v-if="collection.allowedUsers !== null"
                    :icon="lockClosedOutline"
                    class="private-icon"
                    :title="getAccessLabel(collection)"
                  />
                  <ion-button
                    fill="clear"
                    color="danger"
                    size="small"
                    @click.stop="confirmDeleteCollection(collection)"
                    v-permission="'rag:write'"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </div>
              </div>
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
                <ion-chip :color="getComplexityColor(collection.complexityType)" size="small">
                  <ion-label>{{ collection.complexityType || 'basic' }}</ion-label>
                </ion-chip>
                <!-- Access indicator -->
                <ion-chip v-if="collection.allowedUsers !== null" color="warning" size="small">
                  <ion-icon :icon="lockClosedOutline" />
                  <ion-label>{{ getAccessLabel(collection) }}</ion-label>
                </ion-chip>
                <ion-chip v-if="collection.requiredRole" color="tertiary" size="small">
                  <ion-label>{{ collection.requiredRole }}</ion-label>
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
            <ion-item>
              <ion-label position="stacked">RAG Complexity Type</ion-label>
              <ion-select v-model="newCollection.complexityType" interface="popover">
                <ion-select-option
                  v-for="option in complexityTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }} - {{ option.description }}
                </ion-select-option>
              </ion-select>
            </ion-item>
          </ion-list>

          <!-- Access Control Section -->
          <ion-item-divider>
            <ion-label>Access Control</ion-label>
          </ion-item-divider>

          <ion-list>
            <ion-item lines="none">
              <ion-checkbox
                v-model="newCollection.privateToCreator"
                slot="start"
              />
              <ion-label>
                <h3>Only me</h3>
                <p>Only you can access this collection</p>
              </ion-label>
            </ion-item>

            <ion-item v-if="!newCollection.privateToCreator">
              <ion-label position="stacked">Required Role (optional)</ion-label>
              <ion-select
                v-model="newCollection.requiredRole"
                interface="popover"
                placeholder="No role requirement"
              >
                <ion-select-option :value="null">No role requirement</ion-select-option>
                <ion-select-option
                  v-for="role in availableRoles"
                  :key="role.name"
                  :value="role.name"
                >
                  {{ role.displayName }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item v-if="!newCollection.privateToCreator" button @click="openAccessControlModal">
              <ion-icon slot="start" :icon="peopleOutline" />
              <ion-label>
                <h3>Manage User Access</h3>
                <p>{{ accessSummary }}</p>
              </ion-label>
              <ion-icon slot="end" :icon="chevronForwardOutline" />
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

      <!-- Access Control Modal -->
      <AccessControlModal
        :is-open="showAccessControlModal"
        :current-allowed-users="newCollection.allowedUsers || null"
        :current-required-role="newCollection.requiredRole || null"
        @dismiss="showAccessControlModal = false"
        @save="handleAccessControlSave"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
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
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonCheckbox,
  IonItemDivider,
  toastController,
  alertController,
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
  peopleOutline,
  chevronForwardOutline,
  lockClosedOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRagStore } from '@/stores/ragStore';
import { useAuthStore } from '@/stores/rbacStore';
import ragService, { type RagCollection, type CreateCollectionDto, type RagComplexityType } from '@/services/ragService';
import rbacService, { type RbacRole } from '@/services/rbacService';
import AccessControlModal from '@/components/rag/AccessControlModal.vue';

const router = useRouter();
const ragStore = useRagStore();
const authStore = useAuthStore();

// Modal state
const showCreateModal = ref(false);
const showAccessControlModal = ref(false);
const isCreating = ref(false);
const availableRoles = ref<RbacRole[]>([]);
const newCollection = ref<CreateCollectionDto>({
  name: '',
  slug: '',
  description: '',
  embeddingModel: 'nomic-embed-text',
  chunkSize: 1000,
  chunkOverlap: 200,
  privateToCreator: false,
  requiredRole: null,
  allowedUsers: null,
  complexityType: 'basic',
});

// Complexity type options with descriptions
const complexityTypeOptions: { value: RagComplexityType; label: string; description: string }[] = [
  { value: 'basic', label: 'Basic', description: 'Standard semantic search' },
  { value: 'attributed', label: 'Attributed', description: 'Semantic search with document citations' },
  { value: 'hybrid', label: 'Hybrid', description: 'Keyword + semantic search combined' },
  { value: 'cross-reference', label: 'Cross-Reference', description: 'Linked documents with related content' },
  { value: 'temporal', label: 'Temporal', description: 'Version-aware document tracking' },
];

// Computed
const accessSummary = computed(() => {
  if (newCollection.value.privateToCreator) {
    return 'Only you';
  }
  if (newCollection.value.allowedUsers && newCollection.value.allowedUsers.length > 0) {
    return `${newCollection.value.allowedUsers.length} specific user(s)`;
  }
  return 'Everyone in organization';
});

// Get organization slug from auth store
const getOrgSlug = () => {
  return authStore.currentOrganization || 'demo-org';
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
const openCreateModal = async () => {
  newCollection.value = {
    name: '',
    slug: '',
    description: '',
    embeddingModel: 'nomic-embed-text',
    chunkSize: 1000,
    chunkOverlap: 200,
    privateToCreator: false,
    requiredRole: null,
    allowedUsers: null,
    complexityType: 'basic',
  };
  // Load roles if not already loaded
  if (availableRoles.value.length === 0) {
    try {
      const roles = await rbacService.getAllRoles();
      availableRoles.value = roles.filter(r => !r.isSystem || r.name !== 'super-admin');
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
};

const openAccessControlModal = () => {
  showAccessControlModal.value = true;
};

const handleAccessControlSave = (data: {
  allowedUsers: string[] | null;
  requiredRole: string | null;
  clearAllowedUsers: boolean;
}) => {
  newCollection.value.allowedUsers = data.allowedUsers;
  newCollection.value.requiredRole = data.requiredRole;
  showAccessControlModal.value = false;
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

const getComplexityColor = (complexityType: string | undefined) => {
  switch (complexityType) {
    case 'basic':
      return 'medium';
    case 'attributed':
      return 'primary';
    case 'hybrid':
      return 'tertiary';
    case 'cross-reference':
      return 'secondary';
    case 'temporal':
      return 'warning';
    default:
      return 'medium';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const getAccessLabel = (collection: RagCollection) => {
  if (!collection.allowedUsers) {
    return 'Everyone';
  }
  if (collection.allowedUsers.length === 1 && collection.allowedUsers[0] === collection.createdBy) {
    return 'Private';
  }
  return `${collection.allowedUsers.length} users`;
};

// Delete collection with confirmation
const confirmDeleteCollection = async (collection: RagCollection) => {
  const alert = await alertController.create({
    header: 'Delete Collection?',
    message: `Are you sure you want to delete "${collection.name}"? This will permanently delete all ${collection.documentCount} documents and ${collection.chunkCount} chunks. This action cannot be undone.`,
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: () => {
          void deleteCollection(collection);
        },
      },
    ],
  });
  await alert.present();
};

const deleteCollection = async (collection: RagCollection) => {
  try {
    await ragService.deleteCollection(collection.id, getOrgSlug());
    ragStore.removeCollection(collection.id);

    const toast = await toastController.create({
      message: `Collection "${collection.name}" and all its contents have been deleted`,
      duration: 3000,
      color: 'success',
    });
    await toast.present();
  } catch (error) {
    const toast = await toastController.create({
      message: error instanceof Error ? error.message : 'Failed to delete collection',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
};

// Lifecycle
onMounted(() => {
  void loadCollections();
});
</script>

<style scoped>
/* Detail View Container */
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
}

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

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.private-icon {
  color: var(--ion-color-warning);
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .rag-collections-container {
    padding: 0.5rem;
  }
}
</style>
