<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Central Crawler</h2>
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
          <h1>Crawler Sources &amp; Articles</h1>
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
          <div class="stat-card">
            <div class="stat-value">{{ totalDedup }}</div>
            <div class="stat-label">Deduplicated</div>
          </div>
        </div>

        <!-- Source Summary Section -->
        <div v-if="sources.length > 0" class="summary-section">
          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Source Summary</ion-card-title>
              <ion-card-subtitle>Overview of articles and predictors</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div v-if="loadingSummary" class="loading-inline">
                <ion-spinner name="dots" />
                <span>Loading summary...</span>
              </div>
              <div v-else-if="sourceSummary" class="summary-stats">
                <div class="summary-grid">
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.total_articles }}</div>
                    <div class="summary-label">Total Articles</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.total_predictors }}</div>
                    <div class="summary-label">Total Predictors</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.articles_with_predictors }}</div>
                    <div class="summary-label">Articles with Predictors</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.avg_predictors_per_article }}</div>
                    <div class="summary-label">Avg Predictors/Article</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.recent_articles_24h }}</div>
                    <div class="summary-label">Articles (24h)</div>
                  </div>
                  <div class="summary-stat">
                    <div class="summary-value">{{ sourceSummary.recent_predictors_24h }}</div>
                    <div class="summary-label">Predictors (24h)</div>
                  </div>
                </div>
                <ion-button size="small" fill="clear" @click="loadSourceSummary">
                  <ion-icon :icon="refreshOutline" slot="start" />
                  Refresh Summary
                </ion-button>
              </div>
              <div v-else class="empty-summary">
                <p>No summary data available</p>
                <ion-button size="small" @click="loadSourceSummary">Load Summary</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Deduplication Breakdown -->
        <div class="dedup-stats-section" v-if="stats.deduplication_stats">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Deduplication Breakdown</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="dedup-grid">
                <div class="dedup-stat">
                  <span class="dedup-value">{{ stats.deduplication_stats.exact }}</span>
                  <span class="dedup-label">Exact Match</span>
                </div>
                <div class="dedup-stat">
                  <span class="dedup-value">{{ stats.deduplication_stats.cross_source }}</span>
                  <span class="dedup-label">Cross-Source</span>
                </div>
                <div class="dedup-stat">
                  <span class="dedup-value">{{ stats.deduplication_stats.fuzzy_title }}</span>
                  <span class="dedup-label">Fuzzy Title</span>
                </div>
                <div class="dedup-stat">
                  <span class="dedup-value">{{ stats.deduplication_stats.phrase_overlap }}</span>
                  <span class="dedup-label">Phrase Overlap</span>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
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
            No recent articles with predictors
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
              <div class="activity-predictors">
                <ion-chip
                  v-for="predictor in getUniquePredictors(article.predictors)"
                  :key="`${article.id}-${predictor.id}`"
                  :color="getPredictorColor(predictor.direction)"
                  size="small"
                >
                  <span class="predictor-symbol">{{ predictor.symbol }}</span>
                </ion-chip>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Toggle -->
        <div class="filter-section">
          <ion-item lines="none">
            <ion-checkbox v-model="showInactive" @ionChange="loadSourcesOnly">
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
                    <span v-if="article.author"> &bull; {{ article.author }}</span>
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

              <!-- Predictors for this article -->
              <div v-if="article.predictors && article.predictors.length > 0" class="article-predictors">
                <div class="predictors-header">Predictors:</div>
                <div class="predictors-list">
                  <ion-chip
                    v-for="predictor in article.predictors"
                    :key="predictor.id"
                    :color="getPredictorColor(predictor.direction)"
                    size="small"
                  >
                    <span class="predictor-symbol">{{ predictor.symbol }}</span>
                    <span class="predictor-direction">{{ predictor.direction }}</span>
                    <span class="predictor-strength">Strength: {{ predictor.strength }}/10</span>
                    <span class="predictor-confidence">
                      {{ (predictor.confidence * 100).toFixed(0) }}%
                    </span>
                  </ion-chip>
                </div>
              </div>
              <div v-else-if="article.predictors" class="no-predictors">
                No predictors generated
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
import { ref, computed, onMounted, watch } from 'vue';
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
  analyticsOutline,
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
  type Article,
  type PredictorSummary,
  type SourceSummary,
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

// Crawl history state
const expandedSourceId = ref<string | null>(null);
const sourceCrawls = ref<SourceCrawl[]>([]);
const loadingCrawls = ref(false);

// Sample data for predictor analysis (deprecated - using summary instead)
const loadingSampleData = ref(false);
const sampleArticles = ref<Article[]>([]);

// Articles modal state
const showArticlesModal = ref(false);
const articlesSource = ref<SourceWithStats | null>(null);
const articles = ref<Article[]>([]);
const loadingArticles = ref(false);
const articleTimeFilter = ref<'today' | '3days' | 'week' | 'month' | 'all'>('3days');

// Source summary state
const sourceSummary = ref<SourceSummary | null>(null);
const loadingSummary = ref(false);

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
const totalDedup = computed(() => {
  const d = stats.value.deduplication_stats;
  return d.exact + d.cross_source + d.fuzzy_title + d.phrase_overlap;
});


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

    // Load sample data after sources are loaded
    await loadSampleData();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load sources';
    console.error('Failed to load sources:', e);
  } finally {
    loading.value = false;
  }
}

async function loadSourcesOnly() {
  try {
    sources.value = await crawlerService.getSources(getOrgSlug(), showInactive.value);
  } catch (e) {
    console.error('Failed to load sources:', e);
  }
}

async function loadSampleData() {
  loadingSampleData.value = true;
  try {
    const orgSlug = getOrgSlug();
    const activeSource = sources.value.find(s => s.is_active && s.article_count > 0);
    if (!activeSource) {
      sampleArticles.value = [];
      return;
    }

    const result = await crawlerService.getSourceArticles(orgSlug, activeSource.id, {
      limit: 100,
      includePredictors: true,
    });

    sampleArticles.value = result;
  } catch (e) {
    console.error('Failed to load sample data:', e);
  } finally {
    loadingSampleData.value = false;
  }
}

async function loadSourceSummary() {
  if (!sources.value.length) return;
  
  loadingSummary.value = true;
  try {
    const orgSlug = getOrgSlug();
    const activeSource = sources.value.find(s => s.is_active && s.article_count > 0);
    if (!activeSource) {
      sourceSummary.value = null;
      return;
    }

    sourceSummary.value = await crawlerService.getSourceSummary(orgSlug, activeSource.id);
  } catch (e) {
    console.error('Failed to load source summary:', e);
    sourceSummary.value = null;
  } finally {
    loadingSummary.value = false;
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
      { limit: 500, since, includePredictors: true },
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

// Predictor display helpers
function getUniquePredictors(predictors: PredictorSummary[] | undefined): PredictorSummary[] {
  if (!predictors || predictors.length === 0) return [];
  const seen = new Set<string>();
  return predictors.filter((predictor) => {
    if (seen.has(predictor.id)) return false;
    seen.add(predictor.id);
    return true;
  });
}

function getPredictorColor(direction: 'bullish' | 'bearish' | 'neutral'): string {
  switch (direction) {
    case 'bullish':
      return 'success';
    case 'bearish':
      return 'danger';
    case 'neutral':
      return 'medium';
    default:
      return 'medium';
  }
}

async function loadRecentActivity() {
  loadingActivity.value = true;
  try {
    const orgSlug = getOrgSlug();
    const allArticles: Article[] = [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    for (const source of sources.value.slice(0, 5)) {
      const sourceArticles = await crawlerService.getSourceArticles(
        orgSlug,
        source.id,
        { limit: 10, since, includePredictors: true },
      );
      allArticles.push(...sourceArticles);
    }

    recentActivity.value = allArticles
      .filter((a) => a.predictors && a.predictors.length > 0)
      .sort((a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime())
      .slice(0, 10);
  } catch (e) {
    console.error('Failed to load recent activity:', e);
    recentActivity.value = [];
  } finally {
    loadingActivity.value = false;
  }
}

// Watch for organization changes
watch(() => authStore.currentOrganization, () => {
  loadSources();
});

onMounted(async () => {
  await loadSources();
  if (sources.value.length > 0) {
    loadRecentActivity();
    loadSourceSummary();
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

/* Diagnostic section */
.diagnostic-section {
  margin-bottom: 1.5rem;
}

.diagnostic-card {
  margin: 0;
}

.sample-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sample-summary h3 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0;
}

.sample-summary p {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.875rem;
}

.sample-summary .ratio {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.empty-sample {
  text-align: center;
  padding: 0.5rem;
}

.empty-sample p {
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
}

.loading-inline {
  padding: 1rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* Dedup stats */
.dedup-stats-section {
  margin-bottom: 1.5rem;
}

.dedup-stats-section ion-card {
  margin: 0;
}

.dedup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
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

/* Subscriptions */
.subscriptions {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-color-light);
}

.subscriptions strong {
  margin-right: 0.5rem;
}

/* Source details / crawl history */
.source-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.source-details h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
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

/* Predictor display styles */
.article-predictors {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ion-border-color);
}

.predictors-header {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.predictors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.predictors-list ion-chip {
  margin: 0;
  height: auto;
  padding: 0.25rem 0.5rem;
}

.predictor-symbol {
  font-weight: 600;
  margin-right: 0.25rem;
}

.predictor-direction {
  font-size: 0.7rem;
  opacity: 0.9;
  margin-right: 0.25rem;
  text-transform: capitalize;
}

.predictor-strength {
  font-size: 0.65rem;
  margin-right: 0.25rem;
  opacity: 0.8;
}

.predictor-confidence {
  font-size: 0.65rem;
  opacity: 0.8;
}

.no-predictors {
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

.activity-predictors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-left: 0.5rem;
}

.activity-predictors ion-chip {
  margin: 0;
  height: auto;
  padding: 0.125rem 0.375rem;
}

.activity-predictors .predictor-symbol {
  font-weight: 600;
  font-size: 0.7rem;
}

/* Summary section styles */
.summary-section {
  margin-bottom: 1.5rem;
}

.summary-card {
  margin: 0;
}

.summary-stats {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.summary-stat {
  text-align: center;
  padding: 0.75rem;
  background: var(--ion-background-color);
  border-radius: 6px;
  border: 1px solid var(--ion-border-color);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ion-color-primary);
  margin-bottom: 0.25rem;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.empty-summary {
  text-align: center;
  padding: 0.5rem;
}

.empty-summary p {
  color: var(--ion-color-medium);
  margin-bottom: 0.5rem;
}
</style>
