<template>
  <div class="instruments-component">
    <div class="instruments-header">
      <h3>Tracked Instruments</h3>
      <div class="instruments-count">{{ instruments.length }} instruments</div>
    </div>

    <!-- Add Instrument -->
    <div class="add-instrument-section">
      <input
        v-model="newInstrument"
        type="text"
        placeholder="Add instrument (e.g., AAPL, BTC-USD)"
        class="instrument-input"
        @keyup.enter="handleAddInstrument"
      />
      <button
        class="add-btn"
        :disabled="!canAddInstrument"
        @click="handleAddInstrument"
      >
        Add
      </button>
    </div>

    <div v-if="addError" class="add-error">
      {{ addError }}
    </div>

    <!-- Instruments List -->
    <div v-if="instruments.length === 0" class="empty-state">
      No instruments tracked yet. Add one above to get started.
    </div>

    <div v-else class="instruments-list">
      <div
        v-for="instrument in instruments"
        :key="instrument"
        class="instrument-card"
      >
        <div class="instrument-info">
          <div class="instrument-symbol">{{ instrument }}</div>
          <div v-if="getLastPollTime(instrument)" class="last-poll">
            Last polled: {{ formatPollTime(getLastPollTime(instrument)!) }}
          </div>
          <div v-else class="last-poll">
            Not polled yet
          </div>
        </div>
        <div class="instrument-actions">
          <button
            class="remove-btn"
            :disabled="isRemoving"
            @click="handleRemoveInstrument(instrument)"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';

const store = usePredictionAgentStore();

const newInstrument = ref('');
const addError = ref<string | null>(null);
const isRemoving = ref(false);

const instruments = computed(() => store.instruments);
const latestDatapoint = computed(() => store.latestDatapoint);

const canAddInstrument = computed(() => {
  return newInstrument.value.trim().length > 0 && !isValidating.value;
});

const isValidating = ref(false);

function validateInstrument(symbol: string): boolean {
  // Basic validation: alphanumeric, hyphens, underscores
  const pattern = /^[A-Z0-9_-]+$/i;
  if (!pattern.test(symbol)) {
    addError.value = 'Invalid instrument symbol. Use letters, numbers, hyphens, or underscores.';
    return false;
  }

  if (instruments.value.includes(symbol.toUpperCase())) {
    addError.value = 'This instrument is already being tracked.';
    return false;
  }

  return true;
}

async function handleAddInstrument() {
  const symbol = newInstrument.value.trim().toUpperCase();
  if (!symbol) return;

  addError.value = null;

  if (!validateInstrument(symbol)) {
    return;
  }

  isValidating.value = true;

  try {
    // Add to store (service layer will handle API call)
    store.addInstrument(symbol);
    newInstrument.value = '';
    addError.value = null;
  } catch (err) {
    addError.value = err instanceof Error ? err.message : 'Failed to add instrument';
  } finally {
    isValidating.value = false;
  }
}

async function handleRemoveInstrument(instrument: string) {
  if (isRemoving.value) return;

  const confirmed = confirm(`Remove ${instrument} from tracked instruments?`);
  if (!confirmed) return;

  isRemoving.value = true;

  try {
    // Remove from store (service layer will handle API call)
    store.removeInstrument(instrument);
  } catch (err) {
    console.error('Failed to remove instrument:', err);
  } finally {
    isRemoving.value = false;
  }
}

function getLastPollTime(instrument: string): string | null {
  if (!latestDatapoint.value) return null;

  // Check if this instrument was in the latest datapoint
  if (latestDatapoint.value.instruments.includes(instrument)) {
    return latestDatapoint.value.timestamp;
  }

  return null;
}

function formatPollTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
</script>

<style scoped>
.instruments-component {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.instruments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.instruments-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.instruments-count {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 600;
}

.add-instrument-section {
  display: flex;
  gap: 0.75rem;
}

.instrument-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.instrument-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.add-btn {
  padding: 0.75rem 1.5rem;
  background-color: #10b981;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-btn:hover:not(:disabled) {
  background-color: #059669;
}

.add-btn:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
}

.add-error {
  padding: 0.75rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #991b1b;
  font-size: 0.875rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  color: #6b7280;
}

.instruments-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.instrument-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  transition: box-shadow 0.2s;
}

.instrument-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.instrument-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.instrument-symbol {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
}

.last-poll {
  font-size: 0.75rem;
  color: #6b7280;
}

.remove-btn {
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.remove-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.remove-btn:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
}
</style>
