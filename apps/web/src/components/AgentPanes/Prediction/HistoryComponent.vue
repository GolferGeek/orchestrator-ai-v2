<template>
  <div class="history-component">
    <div class="history-header">
      <h3>Prediction History</h3>
      <div class="history-stats">
        <span class="stat">Total: {{ historyTotal }}</span>
        <span class="stat success">Correct: {{ correctCount }}</span>
        <span class="stat danger">Incorrect: {{ incorrectCount }}</span>
        <span class="stat">Accuracy: {{ accuracyRate.toFixed(1) }}%</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-row">
        <select v-model="localFilters.instrument" class="filter-select">
          <option :value="null">All Instruments</option>
          <option v-for="inst in instruments" :key="inst" :value="inst">
            {{ inst }}
          </option>
        </select>

        <select v-model="localFilters.outcome" class="filter-select">
          <option value="all">All Outcomes</option>
          <option value="pending">Pending</option>
          <option value="correct">Correct</option>
          <option value="incorrect">Incorrect</option>
          <option value="expired">Expired</option>
        </select>

        <input
          v-model="localFilters.startDate"
          type="date"
          class="filter-input"
          placeholder="Start Date"
        />

        <input
          v-model="localFilters.endDate"
          type="date"
          class="filter-input"
          placeholder="End Date"
        />

        <button class="filter-btn" @click="applyFilters">
          Apply Filters
        </button>

        <button class="clear-btn" @click="clearFilters">
          Clear
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading history...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredHistory.length === 0" class="empty-state">
      No predictions found matching the selected filters.
    </div>

    <!-- History List -->
    <div v-else class="history-list">
      <div
        v-for="prediction in paginatedHistory"
        :key="prediction.id"
        class="history-item"
      >
        <div class="history-item-header">
          <div class="item-title">
            <span class="instrument">{{ prediction.instrument }}</span>
            <span class="action-badge" :class="getActionClass(prediction.recommendation.action)">
              {{ prediction.recommendation.action.toUpperCase() }}
            </span>
            <OutcomeBadge
              v-if="prediction.outcome"
              :status="prediction.outcome.status"
            />
          </div>
          <div class="item-date">
            {{ formatDate(prediction.timestamp) }}
          </div>
        </div>

        <div class="history-item-content">
          <div class="item-rationale">
            {{ prediction.recommendation.rationale }}
          </div>

          <div class="item-details">
            <div class="detail">
              <span class="detail-label">Confidence:</span>
              <ConfidenceBar :confidence="prediction.recommendation.confidence * 100" />
            </div>

            <div v-if="prediction.recommendation.targetPrice" class="detail">
              <span class="detail-label">Target:</span>
              <span class="detail-value">${{ prediction.recommendation.targetPrice.toFixed(2) }}</span>
            </div>

            <div v-if="prediction.outcome?.actualPrice" class="detail">
              <span class="detail-label">Actual:</span>
              <span class="detail-value">${{ prediction.outcome.actualPrice.toFixed(2) }}</span>
            </div>

            <div v-if="prediction.outcome?.actualChange !== undefined" class="detail">
              <span class="detail-label">Change:</span>
              <span
                class="detail-value"
                :class="prediction.outcome.actualChange >= 0 ? 'positive' : 'negative'"
              >
                {{ prediction.outcome.actualChange >= 0 ? '+' : '' }}{{ prediction.outcome.actualChange.toFixed(2) }}%
              </span>
            </div>
          </div>

          <div v-if="prediction.outcome?.notes" class="item-notes">
            <strong>Notes:</strong> {{ prediction.outcome.notes }}
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="historyPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        Previous
      </button>

      <div class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-number"
          :class="{ active: page === currentPage }"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
      </div>

      <button
        class="page-btn"
        :disabled="currentPage === historyPages"
        @click="goToPage(currentPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import OutcomeBadge from './shared/OutcomeBadge.vue';
import ConfidenceBar from './shared/ConfidenceBar.vue';

const store = usePredictionAgentStore();

const localFilters = ref({
  instrument: null as string | null,
  outcome: 'all' as 'all' | 'pending' | 'correct' | 'incorrect' | 'expired',
  startDate: null as string | null,
  endDate: null as string | null,
});

const currentPage = ref(1);

const instruments = computed(() => store.instruments);
const filteredHistory = computed(() => store.filteredHistory);
const historyTotal = computed(() => store.historyTotal);
const historyPages = computed(() => store.historyPages);
const isLoading = computed(() => store.isLoading);
const accuracyRate = computed(() => store.accuracyRate);
const correctCount = computed(() => store.correctPredictions.length);
const incorrectCount = computed(() => store.incorrectPredictions.length);

const pageSize = 10;

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return filteredHistory.value.slice(start, end);
});

const visiblePages = computed(() => {
  const total = historyPages.value;
  const current = currentPage.value;
  const pages: number[] = [];

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1); // ellipsis
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push(-1);
      pages.push(total);
    }
  }

  return pages;
});

watch(localFilters, () => {
  currentPage.value = 1;
}, { deep: true });

function applyFilters() {
  store.setHistoryFilters(localFilters.value);
}

function clearFilters() {
  localFilters.value = {
    instrument: null,
    outcome: 'all',
    startDate: null,
    endDate: null,
  };
  store.clearHistoryFilters();
}

function goToPage(page: number) {
  if (page < 1 || page > historyPages.value) return;
  currentPage.value = page;
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getActionClass(action: string): string {
  const a = action.toLowerCase();
  if (a === 'buy' || a === 'accumulate' || a === 'bet_yes') return 'action-buy';
  if (a === 'sell' || a === 'reduce' || a === 'bet_no') return 'action-sell';
  return 'action-hold';
}
</script>

<style scoped>
.history-component {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.history-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.history-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.stat {
  color: #6b7280;
}

.stat.success {
  color: #10b981;
}

.stat.danger {
  color: #ef4444;
}

.filters-section {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-select,
.filter-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: white;
}

.filter-select {
  min-width: 150px;
}

.filter-input {
  min-width: 140px;
}

.filter-btn,
.clear-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.filter-btn {
  background-color: #3b82f6;
  color: white;
}

.filter-btn:hover {
  background-color: #2563eb;
}

.clear-btn {
  background-color: #e5e7eb;
  color: #374151;
}

.clear-btn:hover {
  background-color: #d1d5db;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #6b7280;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1.25rem;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.instrument {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.action-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.action-buy {
  background-color: #d1fae5;
  color: #065f46;
}

.action-sell {
  background-color: #fee2e2;
  color: #991b1b;
}

.action-hold {
  background-color: #fef3c7;
  color: #92400e;
}

.item-date {
  font-size: 0.875rem;
  color: #6b7280;
}

.history-item-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-rationale {
  color: #374151;
  line-height: 1.6;
}

.item-details {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.75rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 600;
}

.detail-value.positive {
  color: #10b981;
}

.detail-value.negative {
  color: #ef4444;
}

.item-notes {
  padding: 0.75rem;
  background-color: #fffbeb;
  border-left: 3px solid #f59e0b;
  font-size: 0.875rem;
  color: #78350f;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.page-btn,
.page-number {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  background-color: white;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.page-btn:hover:not(:disabled),
.page-number:hover {
  background-color: #f3f4f6;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-number.active {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}
</style>
