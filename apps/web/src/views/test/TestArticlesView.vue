<script setup lang="ts">
/**
 * TestArticlesView (SCR-003)
 *
 * Synthetic Articles Library - manages test articles for signal detection testing.
 */

import { ref, onMounted, computed } from 'vue';
import TestModeIndicator from '@/components/test/TestModeIndicator.vue';
import TestSymbolBadge from '@/components/test/TestSymbolBadge.vue';
import ArticleEditor from '@/components/test/ArticleEditor.vue';
import ArticleGeneratorModal from '@/components/test/ArticleGeneratorModal.vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import type { TestArticle, TestScenario } from '@/services/predictionDashboardService';
import { useTestArticleStore } from '@/stores/testArticleStore';
import { useTestTargetMirrorStore } from '@/stores/testTargetMirrorStore';

const articleStore = useTestArticleStore();
const mirrorStore = useTestTargetMirrorStore();

// Loading states
const isLoading = ref(true);
const isSaving = ref(false);
const error = ref<string | null>(null);

// Scenarios for filtering
const scenarios = ref<TestScenario[]>([]);

// Modal states
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showGeneratorModal = ref(false);
const editingArticle = ref<TestArticle | null>(null);

// Form data
const defaultFormData = () => ({
  title: '',
  content: '',
  target_symbols: [] as string[],
  sentiment: null as 'bullish' | 'bearish' | 'neutral' | 'mixed' | null,
  expected_signal_count: null as number | null,
  source_name: 'Synthetic',
  source_type: 'synthetic',
  published_at: null as string | null,
});

const formData = ref(defaultFormData());
const selectedScenarioId = ref<string>('');
const formValid = ref(false);

// Available symbols from mirrors
const availableSymbols = computed(() => mirrorStore.testSymbols);

// Load data
async function loadData() {
  isLoading.value = true;
  error.value = null;
  articleStore.setLoading(true);

  try {
    // Load articles
    const articlesRes = await predictionDashboardService.listTestArticles();
    if (articlesRes.content) {
      articleStore.setArticles(articlesRes.content);
    }

    // Load scenarios for filtering/association
    const scenariosRes = await predictionDashboardService.listTestScenarios();
    if (scenariosRes.content) {
      scenarios.value = scenariosRes.content;
    }

    // Load mirrors for available symbols
    if (mirrorStore.mirrors.length === 0) {
      const mirrorsRes = await predictionDashboardService.listTestTargetMirrors();
      if (mirrorsRes.content) {
        mirrorStore.setMirrors(mirrorsRes.content as any);
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
    articleStore.setError(error.value);
  } finally {
    isLoading.value = false;
    articleStore.setLoading(false);
  }
}

// Create article
async function createArticle() {
  if (!selectedScenarioId.value || !formValid.value) return;

  isSaving.value = true;
  articleStore.setSaving(true);

  try {
    const result = await predictionDashboardService.createTestArticle({
      scenario_id: selectedScenarioId.value,
      ...formData.value,
    });

    if (result.content) {
      articleStore.addArticle(result.content);
    }

    showCreateModal.value = false;
    resetForm();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create article';
  } finally {
    isSaving.value = false;
    articleStore.setSaving(false);
  }
}

// Update article
async function updateArticle() {
  if (!editingArticle.value || !formValid.value) return;

  isSaving.value = true;

  try {
    const result = await predictionDashboardService.updateTestArticle({
      id: editingArticle.value.id,
      ...formData.value,
    });

    if (result.content) {
      articleStore.updateArticle(editingArticle.value.id, result.content);
    }

    showEditModal.value = false;
    editingArticle.value = null;
    resetForm();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update article';
  } finally {
    isSaving.value = false;
  }
}

// Delete article
async function deleteArticle(article: TestArticle) {
  if (!confirm(`Delete article "${article.title}"?`)) return;

  isSaving.value = true;

  try {
    await predictionDashboardService.deleteTestArticle({ id: article.id });
    articleStore.removeArticle(article.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete article';
  } finally {
    isSaving.value = false;
  }
}

// Mark as processed
async function toggleProcessed(article: TestArticle) {
  try {
    const result = await predictionDashboardService.markTestArticleProcessed({
      id: article.id,
      isProcessed: !article.is_processed,
    });

    if (result.content) {
      articleStore.markProcessed(article.id, !article.is_processed);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update article';
  }
}

// Open edit modal
function openEditModal(article: TestArticle) {
  editingArticle.value = article;
  formData.value = {
    title: article.title,
    content: article.content,
    target_symbols: [...article.target_symbols],
    sentiment: article.sentiment,
    expected_signal_count: article.expected_signal_count,
    source_name: article.source_name,
    source_type: article.source_type,
    published_at: article.published_at,
  };
  showEditModal.value = true;
}

function resetForm() {
  formData.value = defaultFormData();
  selectedScenarioId.value = '';
  formValid.value = false;
}

function openCreateModal() {
  resetForm();
  showCreateModal.value = true;
}

function openGeneratorModal() {
  showGeneratorModal.value = true;
}

function handleGenerated(articles: TestArticle[]) {
  // Add generated articles to store
  articles.forEach(article => {
    articleStore.addArticle(article);
  });

  // Close modal after a short delay to show success
  setTimeout(() => {
    showGeneratorModal.value = false;
  }, 1000);
}

// Filter handlers
function setScenarioFilter(scenarioId: string | null) {
  articleStore.setScenarioFilter(scenarioId);
}

function setSentimentFilter(sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed' | 'all') {
  articleStore.setSentimentFilter(sentiment);
}

function setProcessedFilter(value: string) {
  if (value === 'all') {
    articleStore.setProcessedFilter(null);
  } else {
    articleStore.setProcessedFilter(value === 'processed');
  }
}

// Sentiment badge color
function getSentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case 'bullish':
      return '#10b981';
    case 'bearish':
      return '#ef4444';
    case 'neutral':
      return '#6b7280';
    case 'mixed':
      return '#8b5cf6';
    default:
      return '#9ca3af';
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="test-articles-view">
    <TestModeIndicator message="Synthetic Articles Library" />

    <div class="test-articles-view__content">
      <!-- Header -->
      <header class="test-articles-view__header">
        <div>
          <h1 class="test-articles-view__title">Synthetic Articles</h1>
          <p class="test-articles-view__subtitle">
            Create and manage test articles for signal detection
          </p>
        </div>
        <div class="test-articles-view__actions">
          <button class="btn btn--secondary" @click="openGeneratorModal">
            Generate with AI
          </button>
          <button class="btn btn--primary" @click="openCreateModal">
            Create Article
          </button>
        </div>
      </header>

      <!-- Error -->
      <div v-if="error" class="test-articles-view__error">
        <p>{{ error }}</p>
        <button @click="error = null">Dismiss</button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <label>Scenario</label>
          <select @change="setScenarioFilter(($event.target as HTMLSelectElement).value || null)">
            <option value="">All Scenarios</option>
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Sentiment</label>
          <select @change="setSentimentFilter(($event.target as HTMLSelectElement).value as any)">
            <option value="all">All</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Status</label>
          <select @change="setProcessedFilter(($event.target as HTMLSelectElement).value)">
            <option value="all">All</option>
            <option value="unprocessed">Unprocessed</option>
            <option value="processed">Processed</option>
          </select>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-bar">
        <span>{{ articleStore.stats.total }} articles</span>
        <span class="stat-divider">|</span>
        <span>{{ articleStore.stats.unprocessed }} unprocessed</span>
        <span class="stat-divider">|</span>
        <span>{{ articleStore.stats.bullish }} bullish</span>
        <span>{{ articleStore.stats.bearish }} bearish</span>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="test-articles-view__loading">
        <div class="spinner" />
        <p>Loading articles...</p>
      </div>

      <!-- Articles List -->
      <div v-else class="articles-list">
        <div
          v-if="articleStore.filteredArticles.length === 0"
          class="articles-list__empty"
        >
          No articles found. Create one to start testing.
        </div>

        <div
          v-for="article in articleStore.filteredArticles"
          :key="article.id"
          class="article-card"
          :class="{ 'article-card--processed': article.is_processed }"
        >
          <div class="article-card__header">
            <h3 class="article-card__title">{{ article.title }}</h3>
            <div class="article-card__badges">
              <span
                class="sentiment-badge"
                :style="{ backgroundColor: getSentimentColor(article.sentiment) }"
              >
                {{ article.sentiment || 'N/A' }}
              </span>
              <span v-if="article.is_processed" class="processed-badge">
                Processed
              </span>
            </div>
          </div>

          <p class="article-card__content">
            {{ article.content.slice(0, 200) }}{{ article.content.length > 200 ? '...' : '' }}
          </p>

          <div class="article-card__symbols">
            <TestSymbolBadge
              v-for="symbol in article.target_symbols"
              :key="symbol"
              :test-symbol="symbol"
              size="sm"
            />
          </div>

          <div class="article-card__meta">
            <span>{{ article.source_name }} ({{ article.source_type }})</span>
            <span v-if="article.expected_signal_count">
              Expected: {{ article.expected_signal_count }} signals
            </span>
          </div>

          <div class="article-card__actions">
            <button
              class="btn btn--sm btn--secondary"
              @click="toggleProcessed(article)"
            >
              {{ article.is_processed ? 'Mark Unprocessed' : 'Mark Processed' }}
            </button>
            <button
              class="btn btn--sm btn--secondary"
              @click="openEditModal(article)"
            >
              Edit
            </button>
            <button
              class="btn btn--sm btn--danger"
              @click="deleteArticle(article)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal modal--wide">
        <h2>Create Test Article</h2>

        <div class="form-group">
          <label>Scenario *</label>
          <select v-model="selectedScenarioId" required>
            <option value="">Select a scenario...</option>
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </div>

        <ArticleEditor
          v-model="formData"
          :available-symbols="availableSymbols"
          @valid="formValid = $event"
        />

        <div class="modal__actions">
          <button class="btn btn--secondary" @click="showCreateModal = false">Cancel</button>
          <button
            class="btn btn--primary"
            :disabled="isSaving || !formValid || !selectedScenarioId"
            @click="createArticle"
          >
            {{ isSaving ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal modal--wide">
        <h2>Edit Article</h2>

        <ArticleEditor
          v-model="formData"
          :available-symbols="availableSymbols"
          is-edit
          @valid="formValid = $event"
        />

        <div class="modal__actions">
          <button class="btn btn--secondary" @click="showEditModal = false">Cancel</button>
          <button
            class="btn btn--primary"
            :disabled="isSaving || !formValid"
            @click="updateArticle"
          >
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>

    <!-- AI Generator Modal -->
    <ArticleGeneratorModal
      v-model="showGeneratorModal"
      :available-symbols="availableSymbols"
      :scenarios="scenarios"
      @generated="handleGenerated"
    />
  </div>
</template>

<style scoped>
.test-articles-view {
  min-height: 100vh;
  background: #f9fafb;
}

.test-articles-view__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.test-articles-view__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.test-articles-view__actions {
  display: flex;
  gap: 0.75rem;
}

.test-articles-view__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.test-articles-view__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.test-articles-view__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.test-articles-view__error p {
  margin: 0;
  color: #dc2626;
}

.test-articles-view__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem;
  color: #6b7280;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Filters */
.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
}

.filter-group select {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

/* Stats */
.stats-bar {
  display: flex;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.stat-divider {
  color: #d1d5db;
}

/* Articles List */
.articles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.articles-list__empty {
  text-align: center;
  padding: 3rem;
  color: #9ca3af;
  background: white;
  border-radius: 0.5rem;
}

/* Article Card */
.article-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.article-card--processed {
  opacity: 0.7;
}

.article-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.article-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.article-card__badges {
  display: flex;
  gap: 0.5rem;
}

.sentiment-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
}

.processed-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #059669;
  background: #d1fae5;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
}

.article-card__content {
  font-size: 0.875rem;
  color: #4b5563;
  line-height: 1.5;
  margin: 0 0 0.75rem;
}

.article-card__symbols {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.article-card__meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #9ca3af;
  margin-bottom: 0.75rem;
}

.article-card__actions {
  display: flex;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn--primary {
  background: #2563eb;
  color: white;
}

.btn--primary:hover {
  background: #1d4ed8;
}

.btn--secondary {
  background: white;
  color: #374151;
  border: 1px solid #e5e7eb;
}

.btn--secondary:hover {
  background: #f9fafb;
}

.btn--danger {
  background: #dc2626;
  color: white;
}

.btn--danger:hover {
  background: #b91c1c;
}

.btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 2rem;
}

.modal {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal--wide {
  max-width: 700px;
}

.modal h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-group select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .test-articles-view {
    background: #111827;
  }

  .test-articles-view__title,
  .article-card__title {
    color: #f9fafb;
  }

  .article-card,
  .modal {
    background: #1f2937;
  }

  .article-card__content {
    color: #d1d5db;
  }

  .btn--secondary {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #4b5563;
  }
}
</style>
