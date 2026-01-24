<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Central Crawler</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="openCreateModal">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
        <ion-button fill="clear" size="small" @click="loadData">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="crawler-admin-container">
        <!-- Header Section -->
        <div class="page-header">
          <h1>Crawler Sources &amp; Articles</h1>
          <p>Manage shared data sources across all agents (prediction, risk, marketing)</p>
        </div>

        <!-- Stats Overview -->
        <div class="stats-section">
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="serverOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ stats.total_sources }}</h3>
                      <p>Total Sources</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon success">
                      <ion-icon :icon="checkmarkCircleOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ stats.active_sources }}</h3>
                      <p>Active Sources</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon">
                      <ion-icon :icon="documentOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ stats.total_articles }}</h3>
                      <p>Articles</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
              <ion-col size="12" size-md="3">
                <ion-card class="stat-card">
                  <ion-card-content>
                    <div class="stat-icon warning">
                      <ion-icon :icon="copyOutline" />
                    </div>
                    <div class="stat-info">
                      <h3>{{ totalDedup }}</h3>
                      <p>Deduplicated</p>
                    </div>
                  </ion-card-content>
                </ion-card>
              </ion-col>
            </ion-row>
          </ion-grid>
        </div>

        <!-- Deduplication Stats -->
        <div class="dedup-stats-section" v-if="stats.deduplication_stats">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Deduplication Breakdown</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="6" size-md="3">
                    <div class="dedup-stat">
                      <span class="dedup-value">{{ stats.deduplication_stats.exact }}</span>
                      <span class="dedup-label">Exact Match</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="dedup-stat">
                      <span class="dedup-value">{{ stats.deduplication_stats.cross_source }}</span>
                      <span class="dedup-label">Cross-Source</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="dedup-stat">
                      <span class="dedup-value">{{ stats.deduplication_stats.fuzzy_title }}</span>
                      <span class="dedup-label">Fuzzy Title</span>
                    </div>
                  </ion-col>
                  <ion-col size="6" size-md="3">
                    <div class="dedup-stat">
                      <span class="dedup-value">{{ stats.deduplication_stats.phrase_overlap }}</span>
                      <span class="dedup-label">Phrase Overlap</span>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Filter Toggle -->
        <div class="filter-section">
          <ion-item lines="none">
            <ion-checkbox v-model="showInactive" @ionChange="loadSources">
              Show Inactive Sources
            </ion-checkbox>
          </ion-item>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <ion-spinner name="crescent" />
          <p>Loading crawler data...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" />
          <p>{{ error }}</p>
          <ion-button @click="loadData">Retry</ion-button>
        </div>

        <!-- Empty State -->
        <div v-else-if="sources.length === 0" class="empty-state">
          <ion-icon :icon="cloudOutline" />
          <h3>No Sources Yet</h3>
          <p>Create your first data source to start crawling content</p>
          <ion-button @click="openCreateModal">
            Add Source
          </ion-button>
        </div>

        <!-- Sources List -->
        <div v-else class="sources-list">
          <ion-card
            v-for="source in sources"
            :key="source.id"
            class="source-card"
            :class="{ inactive: !source.is_active }"
          >
            <ion-card-header>
              <div class="card-title-row">
                <ion-card-title>{{ source.name }}</ion-card-title>
                <div class="card-actions">
                  <ion-chip :color="getStatusColor(source)" size="small">
                    {{ getStatusLabel(source) }}
                  </ion-chip>
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="editSource(source)"
                  >
                    <ion-icon slot="icon-only" :icon="createOutline" />
                  </ion-button>
                  <ion-button
                    fill="clear"
                    color="danger"
                    size="small"
                    @click="confirmDeleteSource(source)"
                  >
                    <ion-icon slot="icon-only" :icon="trashOutline" />
                  </ion-button>
                </div>
              </div>
              <ion-card-subtitle>{{ source.url }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <p v-if="source.description" class="description">
                {{ source.description }}
              </p>
              <div class="source-stats">
                <ion-chip color="primary" size="small">
                  <ion-icon :icon="documentOutline" />
                  <ion-label>{{ source.article_count }} articles</ion-label>
                </ion-chip>
                <ion-chip color="secondary" size="small">
                  <ion-icon :icon="timerOutline" />
                  <ion-label>Every {{ source.crawl_frequency_minutes }}m</ion-label>
                </ion-chip>
                <ion-chip :color="getTypeColor(source.source_type)" size="small">
                  <ion-label>{{ source.source_type }}</ion-label>
                </ion-chip>
                <ion-chip v-if="source.is_test" color="warning" size="small">
                  <ion-label>Test</ion-label>
                </ion-chip>
              </div>
              <div class="source-meta">
                <span v-if="source.last_crawl_at">
                  <ion-icon :icon="timeOutline" />
                  Last: {{ formatDate(source.last_crawl_at) }}
                </span>
                <span v-if="source.crawl_stats">
                  <ion-icon :icon="analyticsOutline" />
                  {{ source.crawl_stats.successful_crawls }}/{{ source.crawl_stats.total_crawls }} crawls
                </span>
                <span v-if="source.consecutive_errors > 0" class="error-count">
                  <ion-icon :icon="warningOutline" />
                  {{ source.consecutive_errors }} errors
                </span>
              </div>
              <!-- Subscriptions -->
              <div v-if="source.subscriptions && source.subscriptions.length > 0" class="subscriptions">
                <strong>Subscriptions:</strong>
                <ion-chip
                  v-for="sub in source.subscriptions"
                  :key="sub.subscription_id"
                  size="small"
                  :color="sub.agent_type === 'prediction' ? 'tertiary' : 'success'"
                >
                  {{ sub.agent_type }}: {{ sub.target_name || sub.scope_name }}
                </ion-chip>
              </div>
              <!-- Expand to show crawl history -->
              <ion-button
                fill="clear"
                size="small"
                @click="toggleSourceDetails(source)"
              >
                {{ expandedSourceId === source.id ? 'Hide Details' : 'Show Details' }}
                <ion-icon :icon="expandedSourceId === source.id ? chevronUpOutline : chevronDownOutline" slot="end" />
              </ion-button>
              <!-- Expanded Details -->
              <div v-if="expandedSourceId === source.id" class="source-details">
                <h4>Recent Crawls</h4>
                <div v-if="loadingCrawls" class="loading-inline">
                  <ion-spinner name="dots" />
                </div>
                <div v-else-if="sourceCrawls.length === 0" class="no-data">
                  No crawl history yet
                </div>
                <ion-list v-else>
                  <ion-item v-for="crawl in sourceCrawls" :key="crawl.id" lines="full">
                    <ion-label>
                      <h3>
                        <ion-chip :color="getCrawlStatusColor(crawl.status)" size="small">
                          {{ crawl.status }}
                        </ion-chip>
                        {{ formatDate(crawl.started_at) }}
                      </h3>
                      <p>
                        Found: {{ crawl.articles_found }} |
                        New: {{ crawl.articles_new }} |
                        Dedup: {{ crawl.duplicates_exact + crawl.duplicates_cross_source + crawl.duplicates_fuzzy_title + crawl.duplicates_phrase_overlap }}
                      </p>
                      <p v-if="crawl.crawl_duration_ms">
                        Duration: {{ (crawl.crawl_duration_ms / 1000).toFixed(1) }}s
                      </p>
                      <p v-if="crawl.error_message" class="error-text">
                        {{ crawl.error_message }}
                      </p>
                    </ion-label>
                  </ion-item>
                </ion-list>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Create/Edit Source Modal -->
      <ion-modal :is-open="showSourceModal" @didDismiss="closeSourceModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editingSource ? 'Edit Source' : 'Create Source' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeSourceModal">Cancel</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-list>
            <ion-item>
              <ion-label position="stacked">Name *</ion-label>
              <ion-input
                v-model="sourceForm.name"
                placeholder="e.g., Tech News RSS"
                required
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">URL *</ion-label>
              <ion-input
                v-model="sourceForm.url"
                placeholder="https://example.com/feed"
                type="url"
                required
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="sourceForm.description"
                placeholder="What content does this source provide?"
                auto-grow
              />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Source Type</ion-label>
              <ion-select v-model="sourceForm.source_type" interface="popover">
                <ion-select-option value="web">Web Page</ion-select-option>
                <ion-select-option value="rss">RSS Feed</ion-select-option>
                <ion-select-option value="api">API</ion-select-option>
                <ion-select-option value="twitter_search">Twitter Search</ion-select-option>
                <ion-select-option value="test_db">Test Database</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Crawl Frequency</ion-label>
              <ion-select v-model="sourceForm.crawl_frequency_minutes" interface="popover">
                <ion-select-option :value="5">Every 5 minutes</ion-select-option>
                <ion-select-option :value="10">Every 10 minutes</ion-select-option>
                <ion-select-option :value="15">Every 15 minutes</ion-select-option>
                <ion-select-option :value="30">Every 30 minutes</ion-select-option>
                <ion-select-option :value="60">Every hour</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">CSS Selector (optional)</ion-label>
              <ion-input
                v-model="sourceForm.crawl_config.selector"
                placeholder="article.content"
              />
            </ion-item>
            <ion-item>
              <ion-checkbox v-model="sourceForm.is_test">
                Test Source (not included in production crawls)
              </ion-checkbox>
            </ion-item>
            <ion-item v-if="editingSource">
              <ion-checkbox v-model="sourceForm.is_active">
                Active
              </ion-checkbox>
            </ion-item>
          </ion-list>
          <div class="modal-actions">
            <ion-button expand="block" @click="saveSource" :disabled="!isFormValid || saving">
              <ion-spinner v-if="saving" name="crescent" />
              <span v-else>{{ editingSource ? 'Update Source' : 'Create Source' }}</span>
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
  IonSpinner,
  IonChip,
  IonLabel,
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
  alertController,
} from '@ionic/vue';
import {
  addOutline,
  refreshOutline,
  serverOutline,
  checkmarkCircleOutline,
  documentOutline,
  copyOutline,
  alertCircleOutline,
  cloudOutline,
  createOutline,
  trashOutline,
  timerOutline,
  timeOutline,
  analyticsOutline,
  warningOutline,
  chevronDownOutline,
  chevronUpOutline,
} from 'ionicons/icons';
import {
  crawlerService,
  type SourceWithStats,
  type SourceCrawl,
  type DashboardStats,
  type CreateSourceData,
  type UpdateSourceData,
  type SourceType,
  type CrawlFrequency,
} from '@/services/crawlerService';
import { useAuthStore } from '@/stores/rbacStore';

// Auth store for organization context
const authStore = useAuthStore();

// Get organization slug from auth store
function getOrgSlug(): string {
  return authStore.currentOrganization || 'demo-org';
}

// State
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const loadingCrawls = ref(false);
const showInactive = ref(false);
const showSourceModal = ref(false);
const editingSource = ref<SourceWithStats | null>(null);
const expandedSourceId = ref<string | null>(null);

const stats = ref<DashboardStats>({
  total_sources: 0,
  active_sources: 0,
  total_articles: 0,
  articles_today: 0,
  total_crawls_24h: 0,
  successful_crawls_24h: 0,
  deduplication_stats: {
    exact: 0,
    cross_source: 0,
    fuzzy_title: 0,
    phrase_overlap: 0,
  },
});

const sources = ref<SourceWithStats[]>([]);
const sourceCrawls = ref<SourceCrawl[]>([]);

const sourceForm = ref<{
  name: string;
  url: string;
  description: string;
  source_type: SourceType;
  crawl_frequency_minutes: CrawlFrequency;
  crawl_config: { selector?: string };
  is_test: boolean;
  is_active: boolean;
}>({
  name: '',
  url: '',
  description: '',
  source_type: 'web',
  crawl_frequency_minutes: 60,
  crawl_config: {},
  is_test: false,
  is_active: true,
});

// Computed
const totalDedup = computed(() => {
  const d = stats.value.deduplication_stats;
  return d.exact + d.cross_source + d.fuzzy_title + d.phrase_overlap;
});

const isFormValid = computed(() => {
  return sourceForm.value.name.trim() !== '' && sourceForm.value.url.trim() !== '';
});

// Methods
async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    const orgSlug = getOrgSlug();
    const [statsData, sourcesData] = await Promise.all([
      crawlerService.getDashboardStats(orgSlug),
      crawlerService.getSources(orgSlug, showInactive.value),
    ]);
    stats.value = statsData;
    sources.value = sourcesData;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load crawler data';
    console.error('Failed to load crawler data:', e);
  } finally {
    loading.value = false;
  }
}

async function loadSources() {
  try {
    sources.value = await crawlerService.getSources(getOrgSlug(), showInactive.value);
  } catch (e) {
    console.error('Failed to load sources:', e);
  }
}

function openCreateModal() {
  editingSource.value = null;
  sourceForm.value = {
    name: '',
    url: '',
    description: '',
    source_type: 'web',
    crawl_frequency_minutes: 60,
    crawl_config: {},
    is_test: false,
    is_active: true,
  };
  showSourceModal.value = true;
}

function editSource(source: SourceWithStats) {
  editingSource.value = source;
  sourceForm.value = {
    name: source.name,
    url: source.url,
    description: source.description || '',
    source_type: source.source_type,
    crawl_frequency_minutes: source.crawl_frequency_minutes,
    crawl_config: { selector: source.crawl_config?.selector || '' },
    is_test: source.is_test,
    is_active: source.is_active,
  };
  showSourceModal.value = true;
}

function closeSourceModal() {
  showSourceModal.value = false;
  editingSource.value = null;
}

async function saveSource() {
  if (!isFormValid.value) return;

  saving.value = true;
  const orgSlug = getOrgSlug();
  try {
    if (editingSource.value) {
      const updateData: UpdateSourceData = {
        name: sourceForm.value.name,
        url: sourceForm.value.url,
        description: sourceForm.value.description || undefined,
        source_type: sourceForm.value.source_type,
        crawl_frequency_minutes: sourceForm.value.crawl_frequency_minutes,
        crawl_config: sourceForm.value.crawl_config,
        is_test: sourceForm.value.is_test,
        is_active: sourceForm.value.is_active,
      };
      await crawlerService.updateSource(orgSlug, editingSource.value.id, updateData);
    } else {
      const createData: CreateSourceData = {
        name: sourceForm.value.name,
        url: sourceForm.value.url,
        description: sourceForm.value.description || undefined,
        source_type: sourceForm.value.source_type,
        crawl_frequency_minutes: sourceForm.value.crawl_frequency_minutes,
        crawl_config: sourceForm.value.crawl_config,
        is_test: sourceForm.value.is_test,
      };
      await crawlerService.createSource(orgSlug, createData);
    }
    closeSourceModal();
    await loadData();
  } catch (e) {
    console.error('Failed to save source:', e);
    const alert = await alertController.create({
      header: 'Error',
      message: e instanceof Error ? e.message : 'Failed to save source',
      buttons: ['OK'],
    });
    await alert.present();
  } finally {
    saving.value = false;
  }
}

async function confirmDeleteSource(source: SourceWithStats) {
  const alert = await alertController.create({
    header: 'Delete Source',
    message: `Are you sure you want to delete "${source.name}"? This will deactivate the source but preserve its articles.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          try {
            await crawlerService.deleteSource(getOrgSlug(), source.id);
            await loadData();
          } catch (e) {
            console.error('Failed to delete source:', e);
          }
        },
      },
    ],
  });
  await alert.present();
}

async function toggleSourceDetails(source: SourceWithStats) {
  if (expandedSourceId.value === source.id) {
    expandedSourceId.value = null;
    sourceCrawls.value = [];
  } else {
    expandedSourceId.value = source.id;
    loadingCrawls.value = true;
    try {
      sourceCrawls.value = await crawlerService.getSourceCrawls(getOrgSlug(), source.id, 10);
    } catch (e) {
      console.error('Failed to load crawl history:', e);
      sourceCrawls.value = [];
    } finally {
      loadingCrawls.value = false;
    }
  }
}

function getStatusColor(source: SourceWithStats): string {
  if (!source.is_active) return 'medium';
  if (source.consecutive_errors > 0) return 'danger';
  if (source.last_crawl_status === 'success') return 'success';
  if (source.last_crawl_status === 'running') return 'primary';
  return 'warning';
}

function getStatusLabel(source: SourceWithStats): string {
  if (!source.is_active) return 'Inactive';
  if (source.consecutive_errors > 0) return 'Error';
  if (source.last_crawl_status === 'success') return 'Healthy';
  if (source.last_crawl_status === 'running') return 'Running';
  return 'Pending';
}

function getTypeColor(type: SourceType): string {
  switch (type) {
    case 'web':
      return 'primary';
    case 'rss':
      return 'success';
    case 'api':
      return 'tertiary';
    case 'twitter_search':
      return 'secondary';
    case 'test_db':
      return 'medium';
    default:
      return 'medium';
  }
}

function getCrawlStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'success';
    case 'running':
      return 'primary';
    case 'error':
      return 'danger';
    case 'timeout':
      return 'warning';
    default:
      return 'medium';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Lifecycle
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.crawler-admin-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem 0;
}

.page-header p {
  color: var(--ion-color-medium);
  margin: 0;
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stat-card {
  text-align: center;
}

.stat-card ion-card-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
}

.stat-icon {
  font-size: 2rem;
  color: var(--ion-color-primary);
}

.stat-icon.success {
  color: var(--ion-color-success);
}

.stat-icon.warning {
  color: var(--ion-color-warning);
}

.stat-info h3 {
  font-size: 1.75rem;
  margin: 0;
  font-weight: 600;
}

.stat-info p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
}

.dedup-stats-section {
  margin-bottom: 1.5rem;
}

.dedup-stat {
  text-align: center;
  padding: 0.5rem;
}

.dedup-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.dedup-label {
  display: block;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.filter-section {
  margin-bottom: 1rem;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
}

.loading-state ion-spinner,
.error-state ion-icon,
.empty-state ion-icon {
  font-size: 3rem;
  color: var(--ion-color-medium);
}

.error-state ion-icon {
  color: var(--ion-color-danger);
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.source-card {
  margin: 0;
}

.source-card.inactive {
  opacity: 0.6;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.description {
  margin-bottom: 1rem;
  color: var(--ion-color-medium-shade);
}

.source-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.source-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.source-meta span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.source-meta .error-count {
  color: var(--ion-color-danger);
}

.subscriptions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-color-light);
}

.subscriptions strong {
  margin-right: 0.5rem;
}

.source-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.source-details h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.loading-inline {
  padding: 1rem;
  text-align: center;
}

.no-data {
  padding: 1rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.error-text {
  color: var(--ion-color-danger);
  font-size: 0.8rem;
}

.modal-actions {
  padding: 1rem;
}

.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
}
</style>
