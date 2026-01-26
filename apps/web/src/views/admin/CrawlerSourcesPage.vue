<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Crawler Sources</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="openCreateModal">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
        <ion-button fill="clear" size="small" @click="loadSources">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="crawler-sources-container">
        <!-- Header Section -->
        <div class="page-header">
          <h1>Data Sources</h1>
          <p>Manage shared data sources for crawling content across all agents</p>
        </div>

        <!-- Stats Overview -->
        <div class="stats-section">
          <div class="stat-card">
            <div class="stat-value">{{ stats.total_sources }}</div>
            <div class="stat-label">Total Sources</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.active_sources }}</div>
            <div class="stat-label">Active</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.total_articles }}</div>
            <div class="stat-label">Articles</div>
          </div>
        </div>

        <!-- Activity Feed Section -->
        <div class="activity-feed-section">
          <div class="section-header">
            <h3>Recent Activity</h3>
            <ion-button fill="clear" size="small" @click="loadRecentActivity">
              <ion-icon :icon="refreshOutline" slot="icon-only" />
            </ion-button>
          </div>
          <div v-if="loadingActivity" class="loading-state small">
            <ion-spinner name="dots" />
          </div>
          <div v-else-if="recentActivity.length === 0" class="empty-activity">
            No recent articles with signals
          </div>
          <div v-else class="activity-list">
            <div
              v-for="article in recentActivity"
              :key="article.id"
              class="activity-item"
            >
              <div class="activity-content">
                <div class="activity-title">{{ article.title || 'Untitled' }}</div>
                <div class="activity-meta">
                  {{ formatArticleDate(article.first_seen_at) }}
                </div>
              </div>
              <div class="activity-signals">
                <ion-chip
                  v-for="signal in article.signals"
                  :key="signal.target_id"
                  :color="getSignalColor(signal.disposition)"
                  size="small"
                >
                  <span class="signal-symbol">{{ signal.symbol }}</span>
                </ion-chip>
              </div>
            </div>
          </div>
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
          <p>Loading sources...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" />
          <p>{{ error }}</p>
          <ion-button @click="loadSources">Retry</ion-button>
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
                <ion-chip
                  color="primary"
                  size="small"
                  class="clickable-chip"
                  @click="openArticlesModal(source)"
                >
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
                <span v-if="source.consecutive_errors > 0" class="error-count">
                  <ion-icon :icon="warningOutline" />
                  {{ source.consecutive_errors }} errors
                </span>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>

      <!-- Articles Modal -->
      <ion-modal :is-open="showArticlesModal" @didDismiss="closeArticlesModal" class="articles-modal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ articlesSource?.name }} - Articles</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeArticlesModal">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <!-- Time Filter Buttons -->
          <div class="time-filter-section">
            <ion-segment v-model="articleTimeFilter" @ionChange="loadArticles">
              <ion-segment-button value="today">
                <ion-label>Today</ion-label>
              </ion-segment-button>
              <ion-segment-button value="3days">
                <ion-label>3 Days</ion-label>
              </ion-segment-button>
              <ion-segment-button value="week">
                <ion-label>Week</ion-label>
              </ion-segment-button>
              <ion-segment-button value="month">
                <ion-label>Month</ion-label>
              </ion-segment-button>
              <ion-segment-button value="all">
                <ion-label>All</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>

          <!-- Articles Count -->
          <div class="articles-count">
            <span v-if="!loadingArticles">{{ filteredArticles.length }} articles</span>
            <ion-spinner v-else name="dots" />
          </div>

          <!-- Loading State -->
          <div v-if="loadingArticles" class="loading-state">
            <ion-spinner name="crescent" />
            <p>Loading articles...</p>
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredArticles.length === 0" class="empty-state">
            <ion-icon :icon="documentOutline" />
            <p>No articles found for this time period</p>
          </div>

          <!-- Articles List -->
          <div v-else class="articles-list">
            <div
              v-for="article in filteredArticles"
              :key="article.id"
              class="article-card"
            >
              <div class="article-header-row">
                <div class="article-title-section">
                  <h3 class="article-title">{{ article.title || 'Untitled' }}</h3>
                  <p class="article-meta">
                    {{ formatArticleDate(article.first_seen_at) }}
                    <span v-if="article.author"> • {{ article.author }}</span>
                  </p>
                </div>
                <a
                  :href="article.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="view-link"
                >
                  <ion-icon :icon="openOutline" />
                  View
                </a>
              </div>
              <p v-if="article.summary" class="article-summary">
                {{ article.summary }}
              </p>
              <p v-else class="no-summary">No summary available</p>

              <!-- Signals for this article -->
              <div v-if="article.signals && article.signals.length > 0" class="article-signals">
                <div class="signals-header">Signals:</div>
                <div class="signals-list">
                  <ion-chip
                    v-for="signal in article.signals"
                    :key="signal.target_id"
                    :color="getSignalColor(signal.disposition)"
                    size="small"
                  >
                    <span class="signal-symbol">{{ signal.symbol }}</span>
                    <span class="signal-disposition">{{ formatDisposition(signal.disposition) }}</span>
                    <span v-if="signal.confidence" class="signal-confidence">
                      {{ (signal.confidence * 100).toFixed(0) }}%
                    </span>
                  </ion-chip>
                </div>
              </div>
              <div v-else-if="article.signals" class="no-signals">
                No signals generated
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

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
  IonSegment,
  IonSegmentButton,
  alertController,
} from '@ionic/vue';
import {
  addOutline,
  refreshOutline,
  alertCircleOutline,
  cloudOutline,
  createOutline,
  trashOutline,
  documentOutline,
  timerOutline,
  timeOutline,
  warningOutline,
  openOutline,
} from 'ionicons/icons';
import {
  crawlerService,
  type SourceWithStats,
  type DashboardStats,
  type CreateSourceData,
  type UpdateSourceData,
  type SourceType,
  type CrawlFrequency,
  type Article,
} from '@/services/crawlerService';
import { useAuthStore } from '@/stores/rbacStore';

const authStore = useAuthStore();

function getOrgSlug(): string {
  return authStore.currentOrganization || 'demo-org';
}

// State
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);
const showInactive = ref(false);
const showSourceModal = ref(false);
const editingSource = ref<SourceWithStats | null>(null);

// Articles modal state
const showArticlesModal = ref(false);
const articlesSource = ref<SourceWithStats | null>(null);
const articles = ref<Article[]>([]);
const loadingArticles = ref(false);
const articleTimeFilter = ref<'today' | '3days' | 'week' | 'month' | 'all'>('3days');

// Activity feed state
const recentActivity = ref<Article[]>([]);
const loadingActivity = ref(false);

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
const isFormValid = computed(() => {
  return sourceForm.value.name.trim() !== '' && sourceForm.value.url.trim() !== '';
});

// Filter articles based on time selection
const filteredArticles = computed(() => {
  if (articleTimeFilter.value === 'all') {
    return articles.value;
  }

  const now = new Date();
  let cutoffDate: Date;

  switch (articleTimeFilter.value) {
    case 'today':
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '3days':
      cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      break;
    case 'week':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return articles.value;
  }

  return articles.value.filter((article) => {
    const articleDate = new Date(article.first_seen_at);
    return articleDate >= cutoffDate;
  });
});

// Methods
async function loadSources() {
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
    error.value = e instanceof Error ? e.message : 'Failed to load sources';
    console.error('Failed to load sources:', e);
  } finally {
    loading.value = false;
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
    await loadSources();
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
            await loadSources();
          } catch (e) {
            console.error('Failed to delete source:', e);
          }
        },
      },
    ],
  });
  await alert.present();
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Articles modal methods
async function openArticlesModal(source: SourceWithStats) {
  articlesSource.value = source;
  showArticlesModal.value = true;
  await loadArticles();
}

function closeArticlesModal() {
  showArticlesModal.value = false;
  articlesSource.value = null;
  articles.value = [];
}

async function loadArticles() {
  if (!articlesSource.value) return;

  loadingArticles.value = true;
  try {
    const orgSlug = getOrgSlug();
    // Calculate since date based on filter (fetch more than needed, filter client-side)
    let since: string | undefined;
    if (articleTimeFilter.value !== 'all') {
      const now = new Date();
      let cutoffDate: Date;
      switch (articleTimeFilter.value) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '3days':
          cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      since = cutoffDate!.toISOString();
    }

    const result = await crawlerService.getSourceArticles(
      orgSlug,
      articlesSource.value.id,
      { limit: 500, since, includeSignals: true },
    );
    articles.value = result;
  } catch (e) {
    console.error('Failed to load articles:', e);
    articles.value = [];
  } finally {
    loadingArticles.value = false;
  }
}

function formatArticleDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Signal display helpers
function getSignalColor(disposition: string): string {
  switch (disposition) {
    case 'predictor_created':
      return 'success';
    case 'processing':
      return 'primary';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'medium';
    case 'expired':
      return 'dark';
    case 'error':
      return 'danger';
    default:
      return 'medium';
  }
}

function formatDisposition(disposition: string): string {
  switch (disposition) {
    case 'predictor_created':
      return 'Predictor';
    case 'processing':
      return 'Processing';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'error':
      return 'Error';
    default:
      return disposition;
  }
}

async function loadRecentActivity() {
  loadingActivity.value = true;
  try {
    const orgSlug = getOrgSlug();
    // Get recent articles with signals from all sources
    const allArticles: Article[] = [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours

    for (const source of sources.value.slice(0, 5)) { // Limit to first 5 sources for performance
      const sourceArticles = await crawlerService.getSourceArticles(
        orgSlug,
        source.id,
        { limit: 10, since, includeSignals: true },
      );
      allArticles.push(...sourceArticles);
    }

    // Filter to only articles with signals, sort by date, take top 10
    recentActivity.value = allArticles
      .filter((a) => a.signals && a.signals.length > 0)
      .sort((a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime())
      .slice(0, 10);
  } catch (e) {
    console.error('Failed to load recent activity:', e);
    recentActivity.value = [];
  } finally {
    loadingActivity.value = false;
  }
}

onMounted(async () => {
  await loadSources();
  // Load activity after sources are loaded
  if (sources.value.length > 0) {
    loadRecentActivity();
  }
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
  padding: 1rem;
}

.crawler-sources-container {
  max-width: 1200px;
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
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  padding: 1rem;
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.modal-actions {
  padding: 1rem;
}

/* Clickable chip */
.clickable-chip {
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.clickable-chip:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(var(--ion-color-primary-rgb), 0.3);
}

/* Articles modal styles */
.time-filter-section {
  margin-bottom: 1rem;
}

.articles-count {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* Articles list styles */
.articles-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.article-card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  padding: 0.875rem;
}

.article-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.article-title-section {
  flex: 1;
  min-width: 0;
}

.article-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  color: var(--ion-text-color);
}

.article-meta {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin: 0;
}

.view-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: white;
  text-decoration: none;
  font-size: 0.8rem;
  white-space: nowrap;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--ion-color-primary);
}

.view-link:hover {
  background: var(--ion-color-primary-shade);
  color: white;
}

.article-summary {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--ion-color-medium-shade);
}

.no-summary {
  margin: 0;
  color: var(--ion-color-medium);
  font-style: italic;
  font-size: 0.85rem;
}

/* Make the modal larger */
.articles-modal {
  --width: 90%;
  --max-width: 800px;
  --height: 85%;
}

/* Signal display styles */
.article-signals {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-border-color);
}

.signals-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.signals-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.signals-list ion-chip {
  margin: 0;
  height: auto;
  padding: 0.25rem 0.5rem;
}

.signal-symbol {
  font-weight: 600;
  margin-right: 0.25rem;
}

.signal-disposition {
  font-size: 0.7rem;
  opacity: 0.9;
}

.signal-confidence {
  font-size: 0.65rem;
  margin-left: 0.25rem;
  opacity: 0.8;
}

.no-signals {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  font-style: italic;
}

/* Activity Feed Section */
.activity-feed-section {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.loading-state.small {
  padding: 1rem;
}

.empty-activity {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
  padding: 1rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--ion-background-color);
  border-radius: 6px;
  border: 1px solid var(--ion-border-color);
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-meta {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.activity-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-left: 0.5rem;
}

.activity-signals ion-chip {
  margin: 0;
  height: auto;
  padding: 0.125rem 0.375rem;
}

.activity-signals .signal-symbol {
  font-weight: 600;
  font-size: 0.7rem;
}
</style>
