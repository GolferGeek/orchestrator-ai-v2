<script setup lang="ts">
/**
 * TestPriceTimelineView (SCR-004)
 *
 * Test Price Timeline - manage OHLCV price data for test scenarios.
 */

import { ref, onMounted, computed, watch } from 'vue';
import TestModeIndicator from '@/components/test/TestModeIndicator.vue';
import TestSymbolBadge from '@/components/test/TestSymbolBadge.vue';
import OHLCVInput from '@/components/test/OHLCVInput.vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import type { TestPriceData, TestScenario } from '@/services/predictionDashboardService';
import { useTestPriceDataStore } from '@/stores/testPriceDataStore';
import { useTestTargetMirrorStore } from '@/stores/testTargetMirrorStore';

const priceStore = useTestPriceDataStore();
const mirrorStore = useTestTargetMirrorStore();

// Loading states
const isLoading = ref(true);
const isSaving = ref(false);
const error = ref<string | null>(null);

// Scenarios
const scenarios = ref<TestScenario[]>([]);

// Modal states
const showCreateModal = ref(false);
const showBulkModal = ref(false);

// Form data
const selectedScenarioId = ref('');
const selectedSymbol = ref('');
const priceDate = ref('');
const ohlcvData = ref({
  open: null as number | null,
  high: null as number | null,
  low: null as number | null,
  close: null as number | null,
  volume: null as number | null,
});
const ohlcvValid = ref(false);

// Bulk generate form
const bulkForm = ref({
  startDate: '',
  endDate: '',
  basePrice: 100,
  volatility: 5, // percentage
  trend: 'neutral' as 'up' | 'down' | 'neutral',
});

// Available symbols from mirrors
const availableSymbols = computed(() => mirrorStore.testSymbols);

// Chart data (simple line representation)
const chartData = computed(() => {
  const data = priceStore.selectedSymbolPriceData;
  if (data.length === 0) return [];

  return data.map((p) => ({
    date: p.price_date,
    close: p.close,
    high: p.high,
    low: p.low,
  }));
});

// Load data
async function loadData() {
  isLoading.value = true;
  error.value = null;
  priceStore.setLoading(true);

  try {
    // Load price data
    const pricesRes = await predictionDashboardService.listTestPriceData();
    if (pricesRes.content) {
      priceStore.setPriceData(pricesRes.content);
    }

    // Load scenarios
    const scenariosRes = await predictionDashboardService.listTestScenarios();
    if (scenariosRes.content) {
      scenarios.value = scenariosRes.content;
    }

    // Load mirrors
    if (mirrorStore.mirrors.length === 0) {
      const mirrorsRes = await predictionDashboardService.listTestTargetMirrors();
      if (mirrorsRes.content) {
        mirrorStore.setMirrors(mirrorsRes.content as any);
      }
    }

    // Select first symbol if available
    if (availableSymbols.value.length > 0 && !priceStore.selectedSymbol) {
      priceStore.selectSymbol(availableSymbols.value[0]);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
    priceStore.setError(error.value);
  } finally {
    isLoading.value = false;
    priceStore.setLoading(false);
  }
}

// Create price point
async function createPricePoint() {
  if (!selectedScenarioId.value || !selectedSymbol.value || !priceDate.value || !ohlcvValid.value) return;

  isSaving.value = true;
  priceStore.setSaving(true);

  try {
    const result = await predictionDashboardService.createTestPriceData({
      scenario_id: selectedScenarioId.value,
      symbol: selectedSymbol.value,
      price_date: priceDate.value,
      open: ohlcvData.value.open!,
      high: ohlcvData.value.high!,
      low: ohlcvData.value.low!,
      close: ohlcvData.value.close!,
      volume: ohlcvData.value.volume ?? undefined,
    });

    if (result.content) {
      priceStore.addPriceData(result.content);
    }

    showCreateModal.value = false;
    resetForm();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create price point';
  } finally {
    isSaving.value = false;
    priceStore.setSaving(false);
  }
}

// Delete price point
async function deletePricePoint(price: TestPriceData) {
  if (!confirm(`Delete price point for ${price.price_date}?`)) return;

  isSaving.value = true;

  try {
    await predictionDashboardService.deleteTestPriceData({ id: price.id });
    priceStore.removePriceData(price.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete price point';
  } finally {
    isSaving.value = false;
  }
}

// Generate random timeline
async function generateTimeline() {
  if (!selectedScenarioId.value || !selectedSymbol.value) return;
  if (!bulkForm.value.startDate || !bulkForm.value.endDate) return;

  isSaving.value = true;

  try {
    const prices: Array<{
      price_date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }> = [];

    let currentPrice = bulkForm.value.basePrice;
    const startDate = new Date(bulkForm.value.startDate);
    const endDate = new Date(bulkForm.value.endDate);
    const volatility = bulkForm.value.volatility / 100;
    const trendBias = bulkForm.value.trend === 'up' ? 0.002 : bulkForm.value.trend === 'down' ? -0.002 : 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      // Skip weekends
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const open = currentPrice;
      const change = (Math.random() - 0.5) * 2 * volatility + trendBias;
      const close = open * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
      const volume = Math.floor(Math.random() * 10000000) + 1000000;

      prices.push({
        price_date: d.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });

      currentPrice = close;
    }

    const result = await predictionDashboardService.bulkCreateTestPriceData({
      scenario_id: selectedScenarioId.value,
      symbol: selectedSymbol.value,
      prices,
    });

    if (result.content?.prices) {
      priceStore.addPriceDataBulk(result.content.prices);
    }

    showBulkModal.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to generate timeline';
  } finally {
    isSaving.value = false;
  }
}

function resetForm() {
  priceDate.value = '';
  ohlcvData.value = {
    open: null,
    high: null,
    low: null,
    close: null,
    volume: null,
  };
  ohlcvValid.value = false;
}

function openCreateModal() {
  resetForm();
  if (priceStore.selectedSymbol) {
    selectedSymbol.value = priceStore.selectedSymbol;
  }
  showCreateModal.value = true;
}

function openBulkModal() {
  if (priceStore.selectedSymbol) {
    selectedSymbol.value = priceStore.selectedSymbol;
  }
  bulkForm.value = {
    startDate: '',
    endDate: '',
    basePrice: 100,
    volatility: 5,
    trend: 'neutral',
  };
  showBulkModal.value = true;
}

// Format price
function formatPrice(value: number): string {
  return value.toFixed(2);
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="test-prices-view">
    <TestModeIndicator message="Test Price Timeline" />

    <div class="test-prices-view__content">
      <!-- Header -->
      <header class="test-prices-view__header">
        <div>
          <h1 class="test-prices-view__title">Price Timeline</h1>
          <p class="test-prices-view__subtitle">
            Manage OHLCV price data for test scenarios
          </p>
        </div>
        <div class="test-prices-view__actions">
          <button class="btn btn--secondary" @click="openBulkModal">
            Generate Timeline
          </button>
          <button class="btn btn--primary" @click="openCreateModal">
            Add Price Point
          </button>
        </div>
      </header>

      <!-- Error -->
      <div v-if="error" class="test-prices-view__error">
        <p>{{ error }}</p>
        <button @click="error = null">Dismiss</button>
      </div>

      <!-- Symbol Selector -->
      <div class="symbol-selector">
        <label>Select Symbol:</label>
        <div class="symbol-chips">
          <button
            v-for="symbol in availableSymbols"
            :key="symbol"
            :class="['symbol-chip', { 'symbol-chip--active': priceStore.selectedSymbol === symbol }]"
            @click="priceStore.selectSymbol(symbol)"
          >
            <TestSymbolBadge :test-symbol="symbol" size="sm" />
            <span class="symbol-chip__count">
              {{ priceStore.priceDataBySymbol[symbol]?.length || 0 }}
            </span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="test-prices-view__loading">
        <div class="spinner" />
        <p>Loading price data...</p>
      </div>

      <!-- Main Content -->
      <template v-else>
        <!-- Stats -->
        <div class="stats-bar">
          <span>{{ priceStore.stats.totalPrices }} total price points</span>
          <span class="stat-divider">|</span>
          <span>{{ priceStore.stats.uniqueSymbols }} symbols</span>
          <template v-if="priceStore.stats.dateRange.earliest">
            <span class="stat-divider">|</span>
            <span>
              {{ formatDate(priceStore.stats.dateRange.earliest) }} -
              {{ formatDate(priceStore.stats.dateRange.latest!) }}
            </span>
          </template>
        </div>

        <!-- Simple Chart (visual representation) -->
        <div v-if="chartData.length > 0" class="price-chart">
          <div class="price-chart__header">
            <h3>{{ priceStore.selectedSymbol }} Price History</h3>
          </div>
          <div class="price-chart__visualization">
            <div
              v-for="(point, idx) in chartData"
              :key="point.date"
              class="price-bar"
              :style="{
                height: `${((point.close - Math.min(...chartData.map(p => p.low))) / (Math.max(...chartData.map(p => p.high)) - Math.min(...chartData.map(p => p.low)))) * 100}%`,
              }"
              :title="`${point.date}: $${point.close.toFixed(2)}`"
            />
          </div>
        </div>

        <!-- Price Data Table -->
        <div class="price-table-container">
          <table class="price-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Volume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="priceStore.selectedSymbolPriceData.length === 0">
                <td colspan="7" class="price-table__empty">
                  No price data for this symbol. Add some to start testing.
                </td>
              </tr>
              <tr v-for="price in priceStore.selectedSymbolPriceData" :key="price.id">
                <td>{{ formatDate(price.price_date) }}</td>
                <td class="price-cell">${{ formatPrice(price.open) }}</td>
                <td class="price-cell price-cell--high">${{ formatPrice(price.high) }}</td>
                <td class="price-cell price-cell--low">${{ formatPrice(price.low) }}</td>
                <td class="price-cell">${{ formatPrice(price.close) }}</td>
                <td>{{ price.volume?.toLocaleString() || '—' }}</td>
                <td>
                  <button
                    class="btn btn--icon btn--danger"
                    title="Delete"
                    @click="deletePricePoint(price)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h2>Add Price Point</h2>

        <div class="form-group">
          <label>Scenario *</label>
          <select v-model="selectedScenarioId" required>
            <option value="">Select a scenario...</option>
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Symbol *</label>
          <select v-model="selectedSymbol" required>
            <option value="">Select a symbol...</option>
            <option v-for="symbol in availableSymbols" :key="symbol" :value="symbol">
              {{ symbol }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Date *</label>
          <input v-model="priceDate" type="date" required />
        </div>

        <OHLCVInput v-model="ohlcvData" label="OHLCV Data" @valid="ohlcvValid = $event" />

        <div class="modal__actions">
          <button class="btn btn--secondary" @click="showCreateModal = false">Cancel</button>
          <button
            class="btn btn--primary"
            :disabled="isSaving || !ohlcvValid || !selectedScenarioId || !selectedSymbol || !priceDate"
            @click="createPricePoint"
          >
            {{ isSaving ? 'Adding...' : 'Add' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Generate Modal -->
    <div v-if="showBulkModal" class="modal-overlay" @click.self="showBulkModal = false">
      <div class="modal">
        <h2>Generate Price Timeline</h2>

        <div class="form-group">
          <label>Scenario *</label>
          <select v-model="selectedScenarioId" required>
            <option value="">Select a scenario...</option>
            <option v-for="s in scenarios" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Symbol *</label>
          <select v-model="selectedSymbol" required>
            <option value="">Select a symbol...</option>
            <option v-for="symbol in availableSymbols" :key="symbol" :value="symbol">
              {{ symbol }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Start Date *</label>
            <input v-model="bulkForm.startDate" type="date" required />
          </div>
          <div class="form-group">
            <label>End Date *</label>
            <input v-model="bulkForm.endDate" type="date" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Base Price ($)</label>
            <input v-model.number="bulkForm.basePrice" type="number" min="0.01" step="0.01" />
          </div>
          <div class="form-group">
            <label>Volatility (%)</label>
            <input v-model.number="bulkForm.volatility" type="number" min="0" max="50" />
          </div>
        </div>

        <div class="form-group">
          <label>Trend</label>
          <select v-model="bulkForm.trend">
            <option value="neutral">Neutral (Random Walk)</option>
            <option value="up">Upward Bias</option>
            <option value="down">Downward Bias</option>
          </select>
        </div>

        <div class="modal__actions">
          <button class="btn btn--secondary" @click="showBulkModal = false">Cancel</button>
          <button
            class="btn btn--primary"
            :disabled="isSaving || !selectedScenarioId || !selectedSymbol || !bulkForm.startDate || !bulkForm.endDate"
            @click="generateTimeline"
          >
            {{ isSaving ? 'Generating...' : 'Generate' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-prices-view {
  min-height: 100vh;
  background: #f9fafb;
}

.test-prices-view__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.test-prices-view__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.test-prices-view__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.test-prices-view__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.test-prices-view__actions {
  display: flex;
  gap: 0.75rem;
}

.test-prices-view__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.test-prices-view__loading {
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

/* Symbol Selector */
.symbol-selector {
  margin-bottom: 1.5rem;
}

.symbol-selector label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.symbol-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.symbol-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.symbol-chip:hover {
  border-color: #d1d5db;
}

.symbol-chip--active {
  border-color: #2563eb;
  background: #eff6ff;
}

.symbol-chip__count {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
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

/* Price Chart */
.price-chart {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.price-chart__header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem;
}

.price-chart__visualization {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 100px;
  padding: 0.5rem 0;
}

.price-bar {
  flex: 1;
  min-width: 4px;
  max-width: 20px;
  background: linear-gradient(to top, #2563eb, #60a5fa);
  border-radius: 2px 2px 0 0;
  transition: opacity 0.15s ease;
}

.price-bar:hover {
  opacity: 0.8;
}

/* Price Table */
.price-table-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.price-table {
  width: 100%;
  border-collapse: collapse;
}

.price-table th,
.price-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.price-table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
}

.price-table__empty {
  text-align: center;
  color: #9ca3af;
  padding: 2rem !important;
}

.price-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}

.price-cell--high {
  color: #059669;
}

.price-cell--low {
  color: #dc2626;
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

.btn--icon {
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn--icon svg {
  width: 1rem;
  height: 1rem;
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

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.form-row .form-group {
  flex: 1;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .test-prices-view {
    background: #111827;
  }

  .test-prices-view__title {
    color: #f9fafb;
  }

  .price-table-container,
  .price-chart,
  .symbol-chip,
  .modal {
    background: #1f2937;
  }

  .price-table th {
    background: #374151;
  }

  .symbol-chip--active {
    background: rgba(37, 99, 235, 0.2);
  }

  .btn--secondary {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #4b5563;
  }
}
</style>
