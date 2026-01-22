<template>
  <div class="config-component">
    <div class="config-header">
      <h3>Configuration</h3>
      <button
        v-if="hasChanges"
        class="save-btn"
        :disabled="isSaving"
        @click="handleSaveConfig"
      >
        {{ isSaving ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>

    <div v-if="!config" class="empty-state">
      No configuration available.
    </div>

    <div v-else class="config-content">
      <!-- Risk Profile -->
      <div class="config-section">
        <h4>Risk Profile</h4>
        <div class="form-group">
          <label for="risk-profile">Profile:</label>
          <select
            id="risk-profile"
            v-model="localConfig.riskProfile"
            class="form-select"
          >
            <optgroup label="Stock Profiles">
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </optgroup>
            <optgroup label="Crypto Profiles">
              <option value="hodler">Hodler</option>
              <option value="trader">Trader</option>
              <option value="degen">Degen</option>
            </optgroup>
            <optgroup label="Polymarket Profiles">
              <option value="researcher">Researcher</option>
              <option value="speculator">Speculator</option>
            </optgroup>
          </select>
        </div>
        <p class="help-text">
          Risk profile determines position sizing and recommendation aggressiveness.
        </p>
      </div>

      <!-- Pre-Filter Thresholds -->
      <div class="config-section">
        <h4>Pre-Filter Thresholds</h4>
        <div class="form-group">
          <label for="price-change">Min Price Change (%):</label>
          <input
            id="price-change"
            v-model.number="localConfig.preFilterThresholds.minPriceChangePercent"
            type="number"
            step="0.1"
            min="0"
            class="form-input"
          />
          <div class="slider-container">
            <input
              v-model.number="localConfig.preFilterThresholds.minPriceChangePercent"
              type="range"
              min="0"
              max="20"
              step="0.5"
              class="slider"
            />
            <span class="slider-value">
              {{ localConfig.preFilterThresholds.minPriceChangePercent.toFixed(1) }}%
            </span>
          </div>
        </div>

        <div class="form-group">
          <label for="sentiment-shift">Min Sentiment Shift:</label>
          <input
            id="sentiment-shift"
            v-model.number="localConfig.preFilterThresholds.minSentimentShift"
            type="number"
            step="0.01"
            min="0"
            max="1"
            class="form-input"
          />
          <div class="slider-container">
            <input
              v-model.number="localConfig.preFilterThresholds.minSentimentShift"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="slider"
            />
            <span class="slider-value">
              {{ localConfig.preFilterThresholds.minSentimentShift.toFixed(2) }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label for="significance">Min Significance Score:</label>
          <input
            id="significance"
            v-model.number="localConfig.preFilterThresholds.minSignificanceScore"
            type="number"
            step="0.01"
            min="0"
            max="1"
            class="form-input"
          />
          <div class="slider-container">
            <input
              v-model.number="localConfig.preFilterThresholds.minSignificanceScore"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="slider"
            />
            <span class="slider-value">
              {{ localConfig.preFilterThresholds.minSignificanceScore.toFixed(2) }}
            </span>
          </div>
        </div>

        <p class="help-text">
          Thresholds determine when claims are significant enough to warrant specialist analysis.
        </p>
      </div>

      <!-- Poll Interval -->
      <div class="config-section">
        <h4>Poll Interval</h4>
        <div class="form-group">
          <label for="poll-interval">Interval (minutes):</label>
          <input
            id="poll-interval"
            v-model.number="pollIntervalMinutes"
            type="number"
            step="1"
            min="1"
            class="form-input"
          />
          <div class="slider-container">
            <input
              v-model.number="pollIntervalMinutes"
              type="range"
              min="1"
              max="60"
              step="1"
              class="slider"
            />
            <span class="slider-value">{{ pollIntervalMinutes }} min</span>
          </div>
        </div>
        <p class="help-text">
          How often the agent polls data sources for new information.
        </p>
      </div>

      <!-- Model Configuration (Admin Only) -->
      <div v-if="isAdmin" class="config-section admin-section">
        <h4>Model Configuration (Admin)</h4>
        <div class="admin-notice">
          Advanced settings. Changes affect LLM model usage and costs.
        </div>

        <div class="model-config-grid">
          <!-- Triage Model -->
          <div class="model-config-item">
            <h5>Triage Model</h5>
            <div class="form-group compact">
              <label>Provider:</label>
              <input
                v-model="localConfig.modelConfig.triage.provider"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Model:</label>
              <input
                v-model="localConfig.modelConfig.triage.model"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Temperature:</label>
              <input
                v-model.number="localConfig.modelConfig.triage.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="form-input"
              />
            </div>
          </div>

          <!-- Specialists Model -->
          <div class="model-config-item">
            <h5>Specialists Model</h5>
            <div class="form-group compact">
              <label>Provider:</label>
              <input
                v-model="localConfig.modelConfig.specialists.provider"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Model:</label>
              <input
                v-model="localConfig.modelConfig.specialists.model"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Temperature:</label>
              <input
                v-model.number="localConfig.modelConfig.specialists.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="form-input"
              />
            </div>
          </div>

          <!-- Evaluators Model -->
          <div class="model-config-item">
            <h5>Evaluators Model</h5>
            <div class="form-group compact">
              <label>Provider:</label>
              <input
                v-model="localConfig.modelConfig.evaluators.provider"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Model:</label>
              <input
                v-model="localConfig.modelConfig.evaluators.model"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-group compact">
              <label>Temperature:</label>
              <input
                v-model.number="localConfig.modelConfig.evaluators.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                class="form-input"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import { useRbacStore } from '@/stores/rbacStore';
import type { PredictionRunnerConfig } from '@/types/prediction-agent';

const store = usePredictionAgentStore();
const rbacStore = useRbacStore();

const config = computed(() => store.config);
const isSaving = ref(false);
const hasChanges = ref(false);

const isAdmin = computed(() => {
  const role = rbacStore.currentRole;
  return role === 'super_admin' || role === 'org_admin';
});

const localConfig = ref<PredictionRunnerConfig>({
  runner: 'stock-predictor',
  instruments: [],
  riskProfile: 'moderate',
  pollIntervalMs: 60000,
  preFilterThresholds: {
    minPriceChangePercent: 2,
    minSentimentShift: 0.2,
    minSignificanceScore: 0.5,
  },
  modelConfig: {
    triage: {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      temperature: 0.3,
    },
    specialists: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
    },
    evaluators: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      temperature: 0.5,
    },
  },
});

const pollIntervalMinutes = computed({
  get: () => Math.round(localConfig.value.pollIntervalMs / 60000),
  set: (value: number) => {
    localConfig.value.pollIntervalMs = value * 60000;
  },
});

// Initialize local config from store
watch(
  config,
  (newConfig) => {
    if (newConfig) {
      localConfig.value = JSON.parse(JSON.stringify(newConfig));
      hasChanges.value = false;
    }
  },
  { immediate: true, deep: true }
);

// Detect changes
watch(
  localConfig,
  () => {
    if (config.value) {
      hasChanges.value =
        JSON.stringify(localConfig.value) !== JSON.stringify(config.value);
    }
  },
  { deep: true }
);

async function handleSaveConfig() {
  if (!hasChanges.value || isSaving.value) return;

  isSaving.value = true;

  try {
    // Update store (service layer will handle API call)
    store.updateConfig(localConfig.value);
    hasChanges.value = false;
  } catch (err) {
    console.error('Failed to save configuration:', err);
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.config-component {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.config-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.save-btn {
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

.save-btn:hover:not(:disabled) {
  background-color: #059669;
}

.save-btn:disabled {
  background-color: #d1d5db;
  cursor: not-allowed;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  color: #6b7280;
}

.config-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.config-section {
  padding: 1.5rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.config-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group.compact {
  margin-bottom: 0.75rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.form-select,
.form-input {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider {
  flex: 1;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  outline: none;
  appearance: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 1.25rem;
  height: 1.25rem;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.slider-value {
  min-width: 4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  text-align: right;
}

.help-text {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: #6b7280;
  font-style: italic;
}

.admin-section {
  border: 2px solid #f59e0b;
  background-color: #fffbeb;
}

.admin-notice {
  padding: 0.75rem;
  margin-bottom: 1.5rem;
  background-color: #fef3c7;
  border-left: 3px solid #f59e0b;
  font-size: 0.875rem;
  color: #78350f;
  font-weight: 500;
}

.model-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.model-config-item {
  padding: 1rem;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
}

.model-config-item h5 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}
</style>
