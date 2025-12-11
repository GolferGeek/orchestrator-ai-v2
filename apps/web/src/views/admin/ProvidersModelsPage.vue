<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>LLM Providers & Models</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="refreshData" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="providers-container">
        <!-- Default Model Banner -->
        <div class="default-model-banner" v-if="defaultModel">
          <ion-icon :icon="starOutline" />
          <div class="default-info">
            <span class="default-label">Default Model</span>
            <span class="default-value">{{ defaultModel.provider }} / {{ defaultModel.model }}</span>
          </div>
        </div>

        <!-- Master-Detail Layout -->
        <div class="master-detail-layout">
          <!-- Providers Table (Master) -->
          <div class="master-panel">
            <div class="panel-header">
              <h3>Providers</h3>
              <span class="count">{{ providers.length }} total</span>
            </div>

            <div class="providers-table">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Type</th>
                    <th>Models</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="provider in providers"
                    :key="provider.name"
                    @click="selectProvider(provider)"
                    :class="{ selected: selectedProvider?.name === provider.name, inactive: !provider.is_active }"
                  >
                    <td class="provider-cell">
                      <div class="provider-name">{{ provider.display_name || provider.name }}</div>
                      <div class="provider-slug">{{ provider.name }}</div>
                    </td>
                    <td>
                      <ion-chip size="small" :color="provider.is_local ? 'tertiary' : 'primary'">
                        <ion-label>{{ provider.is_local ? 'Local' : 'Cloud' }}</ion-label>
                      </ion-chip>
                    </td>
                    <td class="models-count">{{ provider.models?.length || 0 }}</td>
                    <td>
                      <ion-toggle
                        :checked="provider.is_active"
                        @click.stop
                        @ionChange="toggleProvider(provider, $event)"
                        size="small"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Models Table (Detail) -->
          <div class="detail-panel" :class="{ empty: !selectedProvider }">
            <template v-if="selectedProvider">
              <div class="panel-header">
                <div class="header-info">
                  <h3>{{ selectedProvider.display_name || selectedProvider.name }} Models</h3>
                  <span class="count">{{ selectedProvider.models?.length || 0 }} models</span>
                </div>
                <ion-button fill="clear" size="small" @click="selectedProvider = null">
                  <ion-icon :icon="closeOutline" slot="icon-only" />
                </ion-button>
              </div>

              <!-- Ollama Special Section -->
              <div class="ollama-status" v-if="selectedProvider.name === 'ollama'">
                <div class="ollama-info">
                  <ion-chip size="small" :color="ollamaStatus.connected ? 'success' : 'warning'">
                    <ion-label>{{ ollamaStatus.connected ? 'Connected' : 'Not Running' }}</ion-label>
                  </ion-chip>
                  <span v-if="ollamaStatus.version">Version: {{ ollamaStatus.version }}</span>
                </div>
              </div>

              <div class="models-table">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Tier</th>
                      <th>Context</th>
                      <th>Default</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="model in selectedProviderModels"
                      :key="getModelName(model)"
                      :class="{ inactive: !model.is_active, 'is-default': isDefaultModel(selectedProvider.name, getModelName(model)) }"
                    >
                      <td class="model-cell">
                        <div class="model-name">{{ model.displayName || model.display_name || getModelName(model) }}</div>
                        <div class="model-slug">{{ getModelName(model) }}</div>
                      </td>
                      <td>
                        <ion-chip size="small" v-if="model.model_tier" :color="getTierColor(model.model_tier)">
                          <ion-label>{{ model.model_tier }}</ion-label>
                        </ion-chip>
                        <span v-else class="na">-</span>
                      </td>
                      <td class="context-cell">
                        {{ model.context_window ? formatContextWindow(model.context_window) : '-' }}
                      </td>
                      <td>
                        <ion-button
                          v-if="isDefaultModel(selectedProvider.name, getModelName(model))"
                          fill="solid"
                          size="small"
                          color="warning"
                          disabled
                        >
                          <ion-icon :icon="starOutline" slot="start" />
                          Default
                        </ion-button>
                        <ion-button
                          v-else
                          fill="outline"
                          size="small"
                          @click="setAsDefault(selectedProvider.name, getModelName(model))"
                        >
                          Set Default
                        </ion-button>
                      </td>
                      <td>
                        <ion-toggle
                          :checked="model.is_active !== false"
                          @ionChange="toggleModel(selectedProvider.name, model, $event)"
                          size="small"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="empty-models" v-if="!selectedProviderModels.length">
                <p>No models configured for this provider</p>
              </div>
            </template>

            <template v-else>
              <div class="no-selection">
                <ion-icon :icon="arrowBackOutline" />
                <p>Select a provider to view its models</p>
              </div>
            </template>
          </div>
        </div>

        <ion-loading :is-open="loading" message="Loading providers..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonToggle,
  IonLoading,
  toastController,
} from '@ionic/vue';
import {
  refreshOutline,
  starOutline,
  closeOutline,
  arrowBackOutline,
} from 'ionicons/icons';
import { fetchProvidersWithModels, type ProviderWithModels } from '@/services/modelCatalogService';
import { fetchGlobalModelConfig, updateGlobalModelConfig } from '@/services/systemSettingsService';
import { apiService } from '@/services/apiService';

// State
const loading = ref(false);
const providers = ref<ProviderWithModels[]>([]);
const selectedProvider = ref<ProviderWithModels | null>(null);
const ollamaStatus = ref<{ connected: boolean; version?: string }>({ connected: false });
const defaultModel = ref<{ provider: string; model: string } | null>(null);

// Computed
const selectedProviderModels = computed(() => {
  if (!selectedProvider.value) return [];

  // For Ollama, merge catalog models with live models
  if (selectedProvider.value.name === 'ollama' && ollamaStatus.value.connected) {
    return selectedProvider.value.models || [];
  }

  return selectedProvider.value.models || [];
});

// Data fetching
const fetchProviders = async () => {
  try {
    // Don't pass status to get all providers (active, inactive, deprecated)
    providers.value = await fetchProvidersWithModels({});

    // Auto-select first provider if none selected
    if (!selectedProvider.value && providers.value.length > 0) {
      selectedProvider.value = providers.value[0];
    }
  } catch (error) {
    console.error('Failed to fetch providers:', error);
  }
};

const fetchOllamaStatus = async () => {
  try {
    const response = await apiService.get('/llm/local-models/status');
    ollamaStatus.value = {
      connected: response?.connected ?? false,
      version: response?.version,
    };
  } catch (error) {
    console.error('Failed to fetch Ollama status:', error);
    ollamaStatus.value = { connected: false };
  }
};

const fetchDefaultModel = async () => {
  try {
    const config = await fetchGlobalModelConfig();
    if (config?.dbConfig) {
      const cfg = config.dbConfig;
      if (cfg.default) {
        defaultModel.value = { provider: cfg.default.provider, model: cfg.default.model };
      } else if (cfg.provider && cfg.model) {
        defaultModel.value = { provider: cfg.provider, model: cfg.model };
      }
    }
  } catch (error) {
    console.error('Failed to fetch default model:', error);
  }
};

const refreshData = async () => {
  loading.value = true;
  try {
    await Promise.all([
      fetchProviders(),
      fetchOllamaStatus(),
      fetchDefaultModel(),
    ]);
  } finally {
    loading.value = false;
  }
};

// Actions
const selectProvider = (provider: ProviderWithModels) => {
  selectedProvider.value = provider;
};

const setAsDefault = async (providerName: string, modelName: string) => {
  try {
    await updateGlobalModelConfig({ provider: providerName, model: modelName });
    defaultModel.value = { provider: providerName, model: modelName };

    const toast = await toastController.create({
      message: `Default model set to ${providerName}/${modelName}`,
      duration: 2000,
      color: 'success',
    });
    await toast.present();
  } catch {
    const toast = await toastController.create({
      message: 'Failed to set default model',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
};

const toggleProvider = async (provider: ProviderWithModels, event: CustomEvent) => {
  const newValue = event.detail.checked;
  // TODO: Implement provider toggle via API
  console.log('Toggle provider:', provider.name, newValue);

  // Optimistic update
  provider.is_active = newValue;

  const toast = await toastController.create({
    message: `Provider ${provider.name} ${newValue ? 'enabled' : 'disabled'}`,
    duration: 2000,
    color: 'success',
  });
  await toast.present();
};

interface ModelWithActive {
  modelName?: string;
  model_name?: string;
  name?: string;
  is_active?: boolean;
}

const toggleModel = async (providerName: string, model: ModelWithActive, event: CustomEvent) => {
  const newValue = event.detail.checked;
  // TODO: Implement model toggle via API
  console.log('Toggle model:', providerName, model.model_name, newValue);

  // Optimistic update
  model.is_active = newValue;

  const toast = await toastController.create({
    message: `Model ${model.model_name} ${newValue ? 'enabled' : 'disabled'}`,
    duration: 2000,
    color: 'success',
  });
  await toast.present();
};

// Helpers
const getModelName = (model: ModelWithActive) => {
  return model.modelName || model.model_name || model.name || '';
};

const isDefaultModel = (provider: string, model: string) => {
  return defaultModel.value?.provider === provider && defaultModel.value?.model === model;
};

const formatContextWindow = (tokens: number) => {
  if (!tokens) return '-';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
};

const getTierColor = (tier: string) => {
  const colors: Record<string, string> = {
    'flagship': 'danger',
    'premium': 'warning',
    'standard': 'primary',
    'economy': 'success',
    'free': 'medium',
  };
  return colors[tier?.toLowerCase()] || 'medium';
};

onMounted(() => {
  refreshData();
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
  padding: 1rem;
}

.providers-container {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Default Model Banner */
.default-model-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  margin-bottom: 1rem;
  color: white;
}

.default-model-banner ion-icon {
  font-size: 1.25rem;
}

.default-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.default-label {
  font-size: 0.8rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.default-value {
  font-weight: 600;
  font-size: 1rem;
}

/* Master-Detail Layout */
.master-detail-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 1rem;
  flex: 1;
  min-height: 0;
}

/* Panel Styles */
.master-panel,
.detail-panel {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.panel-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.count {
  font-size: 0.8rem;
  color: #888;
}

/* Tables */
.providers-table,
.models-table {
  flex: 1;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

th {
  background: #f1f3f4;
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  vertical-align: middle;
}

tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

tbody tr:hover {
  background: #f8f9fa;
}

tbody tr.selected {
  background: var(--ion-color-primary-tint);
}

tbody tr.inactive {
  opacity: 0.5;
}

tbody tr.is-default {
  background: #fffde7;
}

/* Cell Styles */
.provider-cell,
.model-cell {
  min-width: 150px;
}

.provider-name,
.model-name {
  font-weight: 500;
  color: #333;
}

.provider-slug,
.model-slug {
  font-size: 0.75rem;
  color: #888;
  font-family: monospace;
}

.models-count {
  text-align: center;
  font-weight: 600;
  color: #555;
}

.context-cell {
  font-family: monospace;
  font-size: 0.85rem;
  color: #555;
}

.na {
  color: #ccc;
}

/* Ollama Status */
.ollama-status {
  padding: 0.75rem 1rem;
  background: #e8f5e9;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.ollama-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.85rem;
  color: #555;
}

/* Empty States */
.detail-panel.empty {
  background: #fafafa;
}

.no-selection {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  gap: 0.75rem;
}

.no-selection ion-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}

.no-selection p {
  margin: 0;
  font-size: 0.95rem;
}

.empty-models {
  padding: 2rem;
  text-align: center;
  color: #888;
}

/* Responsive */
@media (max-width: 900px) {
  .master-detail-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .master-panel {
    max-height: 300px;
  }
}

/* Ion Chip in tables */
table ion-chip {
  height: 22px;
  font-size: 0.7rem;
}

/* Buttons in tables */
table ion-button {
  --padding-start: 8px;
  --padding-end: 8px;
  height: 28px;
  font-size: 0.75rem;
}
</style>
