<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Finance Universes</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="openCreateModal" v-permission="'finance:admin'">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="finance-universes-container">
        <!-- Header Section -->
        <div class="page-header">
          <h1>Trading Universes</h1>
          <p>Manage instrument universes for finance research and recommendations</p>
        </div>

        <!-- Stats Overview -->
        <div class="stats-section">
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="planetOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ financeStore.universes.length }}</h3>
                      <p>Universes</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="statsChartOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ totalInstruments }}</h3>
                      <p>Instruments</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="analyticsOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ totalRecommendations }}</h3>
                      <p>Recommendations</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="trophyOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ winRate.toFixed(1) }}%</h3>
                      <p>Win Rate</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- Loading State -->
        <div v-if="financeStore.universesLoading" class="loading-state">
          <ion-spinner name="crescent" />
          <p>Loading universes...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="financeStore.universesError" class="error-state">
          <ion-icon :icon="alertCircleOutline" />
          <p>{{ financeStore.universesError }}</p>
          <ion-button @click="loadUniverses">Retry</ion-button>
        </div>

        <!-- Empty State -->
        <div v-else-if="!financeStore.hasUniverses" class="empty-state">
          <ion-icon :icon="planetOutline" />
          <h3>No Universes Yet</h3>
          <p>Create your first universe to start tracking instruments</p>
          <ion-button @click="openCreateModal">
            Create Universe
          </ion-button>
        </div>

        <!-- Universes List -->
        <div v-else class="universes-list">
          <ion-card
            v-for="universe in financeStore.universes"
            :key="universe.id"
            class="universe-card"
          >
            <ion-card-header>
              <div class="card-title-row">
                <ion-card-title>{{ universe.name }}</ion-card-title>
                <div class="card-actions">
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="selectUniverse(universe)"
                  >
                    <ion-icon slot="icon-only" :icon="settingsOutline" />
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    size="small"
                    @click="confirmDeleteUniverse(universe)"
                    v-permission="'finance:admin'"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </div>
              </div>
              <ion-card-subtitle>{{ universe.slug }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p v-if="universe.description" class="description">
                {{ universe.description }}
              </p>
              <div class="universe-stats">
                <ion-chip v-if="getActiveVersion(universe.id)" color="success" size="small">
                  <ion-label>v{{ getActiveVersion(universe.id)?.version }}</ion-label>
                </ion-chip>
                <ion-chip color="primary" size="small">
                  <ion-icon :icon="statsChartOutline" />
                  <ion-label>{{ getInstrumentCount(universe.id) }} instruments</ion-label>
                </ion-chip>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </div>

    <!-- Create Universe Modal -->
    <ion-modal :is-open="showCreateModal" @did-dismiss="closeCreateModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Create Universe</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeCreateModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-list>
          <ion-item>
            <ion-input
              v-model="newUniverse.name"
              label="Name"
              label-placement="stacked"
              placeholder="e.g., US Tech Stocks"
            />
          </ion-item>
          <ion-item>
            <ion-input
              v-model="newUniverse.slug"
              label="Slug (optional)"
              label-placement="stacked"
              placeholder="e.g., us-tech-stocks"
            />
          </ion-item>
          <ion-item>
            <ion-textarea
              v-model="newUniverse.description"
              label="Description"
              label-placement="stacked"
              placeholder="Describe this universe..."
              :rows="3"
            />
          </ion-item>
        </ion-list>
        <div class="modal-actions">
          <ion-button expand="block" @click="createUniverse" :disabled="!newUniverse.name">
            Create Universe
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Universe Detail Modal -->
    <ion-modal :is-open="showDetailModal" @did-dismiss="closeDetailModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ selectedUniverse?.name }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeDetailModal">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding" v-if="selectedUniverse">
        <div class="universe-detail">
          <h3>Versions</h3>
          <div v-if="universeVersions.length === 0" class="empty-versions">
            <p>No versions yet. Create your first version to add instruments.</p>
          </div>
          <div v-else class="versions-list">
            <ion-card
              v-for="version in universeVersions"
              :key="version.id"
              :class="{ active: version.isActive }"
            >
              <ion-card-header>
                <div class="version-header">
                  <ion-card-title>Version {{ version.version }}</ion-card-title>
                  <ion-badge v-if="version.isActive" color="success">Active</ion-badge>
                  <ion-button
                    v-else
                    fill="clear"
                    size="small"
                    @click="activateVersion(version)"
                  >
                    Set Active
                  </ion-button>
                </div>
              </ion-card-header>
              <ion-card-content>
                <div class="instruments-grid">
                  <ion-chip
                    v-for="inst in version.config.instruments"
                    :key="inst.symbol"
                    size="small"
                  >
                    {{ inst.symbol }}
                  </ion-chip>
                </div>
              </ion-card-content>
            </ion-card>
          </div>

          <h3>Create New Version</h3>
          <div class="new-version-form">
            <ion-item>
              <ion-textarea
                v-model="newVersionInstruments"
                label="Instruments (comma-separated symbols)"
                label-placement="stacked"
                placeholder="AAPL, MSFT, GOOGL, AMZN"
                :rows="2"
              />
            </ion-item>
            <ion-item>
              <ion-checkbox v-model="newVersionSetActive">Set as active version</ion-checkbox>
            </ion-item>
            <ion-button expand="block" @click="createVersion" :disabled="!newVersionInstruments">
              Create Version
            </ion-button>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Delete Confirmation -->
    <ion-alert
      :is-open="showDeleteAlert"
      header="Delete Universe"
      :message="`Are you sure you want to delete '${universeToDelete?.name}'? This will also delete all versions and recommendations.`"
      :buttons="[
        { text: 'Cancel', role: 'cancel', handler: () => showDeleteAlert = false },
        { text: 'Delete', role: 'destructive', handler: deleteUniverse }
      ]"
      @did-dismiss="showDeleteAlert = false"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import {
  IonButton,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
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
  IonCheckbox,
  IonBadge,
  IonAlert,
} from '@ionic/vue';
import {
  addOutline,
  planetOutline,
  statsChartOutline,
  analyticsOutline,
  trophyOutline,
  alertCircleOutline,
  settingsOutline,
  trashOutline,
} from 'ionicons/icons';
import { useFinanceStore } from '@/stores/financeStore';
import { financeService } from '@/services/financeService';
import type { Universe, UniverseVersion } from '@/services/financeService';

const financeStore = useFinanceStore();

// State
const showCreateModal = ref(false);
const showDetailModal = ref(false);
const showDeleteAlert = ref(false);
const selectedUniverse = ref<Universe | null>(null);
const universeToDelete = ref<Universe | null>(null);
const universeVersions = ref<UniverseVersion[]>([]);

const newUniverse = ref({
  name: '',
  slug: '',
  description: '',
});

const newVersionInstruments = ref('');
const newVersionSetActive = ref(true);

// Computed
const totalInstruments = computed(() => {
  return financeStore.activeVersionInstrumentCount;
});

const totalRecommendations = computed(() => {
  return financeStore.recommendationsWithOutcomes.length;
});

const winRate = computed(() => {
  return financeStore.overallWinRate;
});

// Methods
function openCreateModal() {
  newUniverse.value = { name: '', slug: '', description: '' };
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
}

function closeDetailModal() {
  showDetailModal.value = false;
  selectedUniverse.value = null;
}

async function loadUniverses() {
  try {
    financeStore.setUniversesLoading(true);
    financeStore.setUniversesError(null);
    const universes = await financeService.getUniverses();
    financeStore.setUniverses(universes);
  } catch (err) {
    financeStore.setUniversesError(err instanceof Error ? err.message : 'Failed to load universes');
  } finally {
    financeStore.setUniversesLoading(false);
  }
}

async function createUniverse() {
  try {
    const universe = await financeService.createUniverse(newUniverse.value);
    financeStore.addUniverse(universe);
    closeCreateModal();
  } catch (err) {
    console.error('Failed to create universe:', err);
  }
}

async function selectUniverse(universe: Universe) {
  selectedUniverse.value = universe;
  try {
    universeVersions.value = await financeService.getUniverseVersions(universe.id);
  } catch (err) {
    console.error('Failed to load versions:', err);
    universeVersions.value = [];
  }
  showDetailModal.value = true;
}

function confirmDeleteUniverse(universe: Universe) {
  universeToDelete.value = universe;
  showDeleteAlert.value = true;
}

async function deleteUniverse() {
  if (!universeToDelete.value) return;

  try {
    await financeService.deleteUniverse(universeToDelete.value.id);
    financeStore.removeUniverse(universeToDelete.value.id);
    showDeleteAlert.value = false;
    universeToDelete.value = null;
  } catch (err) {
    console.error('Failed to delete universe:', err);
  }
}

async function activateVersion(version: UniverseVersion) {
  if (!selectedUniverse.value) return;

  try {
    await financeService.setActiveVersion(selectedUniverse.value.id, version.id);
    universeVersions.value = await financeService.getUniverseVersions(selectedUniverse.value.id);
    financeStore.setActiveVersion(version.id);
  } catch (err) {
    console.error('Failed to activate version:', err);
  }
}

async function createVersion() {
  if (!selectedUniverse.value || !newVersionInstruments.value) return;

  const symbols = newVersionInstruments.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const instruments = symbols.map(symbol => ({
    symbol,
    name: symbol,
    type: 'stock' as const,
  }));

  try {
    await financeService.createUniverseVersion(selectedUniverse.value.id, {
      config: { instruments },
      setActive: newVersionSetActive.value,
    });
    universeVersions.value = await financeService.getUniverseVersions(selectedUniverse.value.id);
    newVersionInstruments.value = '';
  } catch (err) {
    console.error('Failed to create version:', err);
  }
}

function getActiveVersion(universeId: string): UniverseVersion | undefined {
  // In real implementation, would cache versions per universe
  return undefined;
}

function getInstrumentCount(universeId: string): number {
  // In real implementation, would get from cached version
  return 0;
}

// Lifecycle
onMounted(async () => {
  await loadUniverses();
});
</script>

<style scoped>
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--ion-border-color);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.page-header p {
  margin: 0;
  color: var(--ion-color-medium);
}

.stats-section {
  margin-bottom: 24px;
}

.stat-card {
  margin: 0;
}

.stat-card ion-card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon ion-icon {
  font-size: 32px;
  color: var(--ion-color-primary);
}

.stat-info h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.stat-info p {
  margin: 4px 0 0 0;
  color: var(--ion-color-medium);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
}

.loading-state ion-icon,
.error-state ion-icon,
.empty-state ion-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
}

.universes-list {
  display: grid;
  gap: 16px;
}

.universe-card {
  margin: 0;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-actions {
  display: flex;
  gap: 4px;
}

.description {
  margin: 0 0 12px 0;
  color: var(--ion-color-medium);
}

.universe-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.modal-actions {
  margin-top: 24px;
}

.universe-detail h3 {
  margin: 24px 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
}

.universe-detail h3:first-child {
  margin-top: 0;
}

.empty-versions {
  padding: 24px;
  text-align: center;
  color: var(--ion-color-medium);
}

.versions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.versions-list ion-card {
  margin: 0;
}

.versions-list ion-card.active {
  border-left: 4px solid var(--ion-color-success);
}

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.instruments-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.new-version-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
