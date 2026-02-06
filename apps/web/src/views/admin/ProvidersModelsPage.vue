<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>LLM Providers & Models</h2>
      <div class="header-actions">
        <ion-button
          fill="clear"
          size="small"
          @click="refreshData"
          :disabled="loading"
        >
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
            <span class="default-value"
              >{{ defaultModel.provider }} / {{ defaultModel.model }}</span
            >
          </div>
        </div>

        <!-- Master-Detail Layout -->
        <div class="master-detail-layout">
          <!-- Providers Table (Master) -->
          <div class="master-panel">
            <div class="panel-header">
              <h3>Providers</h3>
              <div class="panel-header-actions">
                <span class="count">{{ providers.length }} total</span>
                <ion-button
                  fill="clear"
                  size="small"
                  @click="openProviderCreateModal"
                >
                  <ion-icon :icon="addOutline" slot="icon-only" />
                </ion-button>
              </div>
            </div>

            <div class="providers-table">
              <table>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Type</th>
                    <th>Models</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="provider in providers"
                    :key="provider.name"
                    @click="selectProvider(provider)"
                    :class="{
                      selected: selectedProvider?.name === provider.name,
                      inactive: !provider.is_active,
                    }"
                  >
                    <td class="provider-cell">
                      <div class="provider-name">
                        {{ provider.display_name || provider.name }}
                      </div>
                      <div class="provider-slug">{{ provider.name }}</div>
                    </td>
                    <td>
                      <ion-chip
                        size="small"
                        :color="provider.is_local ? 'tertiary' : 'primary'"
                      >
                        <ion-label>{{
                          provider.is_local ? "Local" : "Cloud"
                        }}</ion-label>
                      </ion-chip>
                    </td>
                    <td class="models-count">
                      {{ provider.models?.length || 0 }}
                    </td>
                    <td>
                      <ion-toggle
                        :checked="provider.is_active"
                        @click.stop
                        @ionChange="toggleProvider(provider, $event)"
                        size="small"
                      />
                    </td>
                    <td class="actions-cell" @click.stop>
                      <ion-button
                        fill="clear"
                        size="small"
                        @click="openProviderEditModal(provider)"
                      >
                        <ion-icon :icon="createOutline" slot="icon-only" />
                      </ion-button>
                      <ion-button
                        fill="clear"
                        size="small"
                        color="danger"
                        @click="confirmDeleteProvider(provider)"
                      >
                        <ion-icon :icon="trashOutline" slot="icon-only" />
                      </ion-button>
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
                  <h3>
                    {{
                      selectedProvider.display_name || selectedProvider.name
                    }}
                    Models
                  </h3>
                  <span class="count"
                    >{{ selectedProvider.models?.length || 0 }} models</span
                  >
                </div>
                <div class="panel-header-actions">
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="openModelCreateModal"
                  >
                    <ion-icon :icon="addOutline" slot="icon-only" />
                  </ion-button>
                  <ion-button
                    fill="clear"
                    size="small"
                    @click="selectedProvider = null"
                  >
                    <ion-icon :icon="closeOutline" slot="icon-only" />
                  </ion-button>
                </div>
              </div>

              <!-- Ollama Special Section -->
              <div
                class="ollama-status"
                v-if="selectedProvider.name === 'ollama'"
              >
                <div class="ollama-info">
                  <ion-chip
                    size="small"
                    :color="ollamaStatus.connected ? 'success' : 'warning'"
                  >
                    <ion-label>{{
                      ollamaStatus.connected ? "Connected" : "Not Running"
                    }}</ion-label>
                  </ion-chip>
                  <span v-if="ollamaStatus.version"
                    >Version: {{ ollamaStatus.version }}</span
                  >
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="model in selectedProviderModels"
                      :key="getModelName(model)"
                      :class="{
                        inactive: !model.is_active,
                        'is-default': isDefaultModel(
                          selectedProvider.name,
                          getModelName(model),
                        ),
                      }"
                    >
                      <td class="model-cell">
                        <div class="model-name">
                          {{
                            model.displayName ||
                            model.display_name ||
                            getModelName(model)
                          }}
                        </div>
                        <div class="model-slug">{{ getModelName(model) }}</div>
                      </td>
                      <td>
                        <ion-chip
                          size="small"
                          v-if="model.model_tier"
                          :color="getTierColor(model.model_tier)"
                        >
                          <ion-label>{{ model.model_tier }}</ion-label>
                        </ion-chip>
                        <span v-else class="na">-</span>
                      </td>
                      <td class="context-cell">
                        {{
                          model.context_window
                            ? formatContextWindow(model.context_window)
                            : "-"
                        }}
                      </td>
                      <td>
                        <ion-button
                          v-if="
                            isDefaultModel(
                              selectedProvider.name,
                              getModelName(model),
                            )
                          "
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
                          @click="
                            setAsDefault(
                              selectedProvider.name,
                              getModelName(model),
                            )
                          "
                        >
                          Set Default
                        </ion-button>
                      </td>
                      <td>
                        <ion-toggle
                          :checked="model.is_active !== false"
                          @ionChange="
                            toggleModel(selectedProvider.name, model, $event)
                          "
                          size="small"
                        />
                      </td>
                      <td class="actions-cell" @click.stop>
                        <ion-button
                          fill="clear"
                          size="small"
                          @click="openModelEditModal(model)"
                        >
                          <ion-icon :icon="createOutline" slot="icon-only" />
                        </ion-button>
                        <ion-button
                          fill="clear"
                          size="small"
                          color="danger"
                          @click="confirmDeleteModel(model)"
                        >
                          <ion-icon :icon="trashOutline" slot="icon-only" />
                        </ion-button>
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

        <!-- Provider Form Modal -->
        <ion-modal
          :is-open="showProviderModal"
          @didDismiss="closeProviderModal"
        >
          <ion-header>
            <ion-toolbar>
              <ion-title>{{
                editingProvider ? "Edit Provider" : "Create Provider"
              }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="closeProviderModal">Cancel</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <div class="form-container">
              <ion-item>
                <ion-label position="stacked">Name *</ion-label>
                <ion-input
                  v-model="providerForm.name"
                  placeholder="openai"
                  :disabled="!!editingProvider"
                />
              </ion-item>
              <p class="hint" v-if="!editingProvider">
                Unique identifier (e.g. openai, anthropic)
              </p>

              <ion-item>
                <ion-label position="stacked">Display Name</ion-label>
                <ion-input
                  v-model="providerForm.display_name"
                  placeholder="OpenAI"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">API Base URL</ion-label>
                <ion-input
                  v-model="providerForm.apiBaseUrl"
                  placeholder="https://api.openai.com/v1"
                  type="url"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Auth Type</ion-label>
                <ion-select v-model="providerForm.authType" interface="popover">
                  <ion-select-option value="api_key">API Key</ion-select-option>
                  <ion-select-option value="oauth">OAuth</ion-select-option>
                  <ion-select-option value="none">None</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label>Is Local</ion-label>
                <ion-toggle v-model="providerForm.isLocal" slot="end" />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Status</ion-label>
                <ion-select v-model="providerForm.status" interface="popover">
                  <ion-select-option value="active">Active</ion-select-option>
                  <ion-select-option value="inactive"
                    >Inactive</ion-select-option
                  >
                  <ion-select-option value="deprecated"
                    >Deprecated</ion-select-option
                  >
                </ion-select>
              </ion-item>

              <div class="form-actions">
                <ion-button
                  expand="block"
                  :disabled="!isProviderFormValid || saving"
                  @click="saveProvider"
                >
                  {{
                    saving ? "Saving..." : editingProvider ? "Update" : "Create"
                  }}
                </ion-button>
              </div>
            </div>
          </ion-content>
        </ion-modal>

        <!-- Model Form Modal -->
        <ion-modal :is-open="showModelModal" @didDismiss="closeModelModal">
          <ion-header>
            <ion-toolbar>
              <ion-title>{{
                editingModel ? "Edit Model" : "Create Model"
              }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="closeModelModal">Cancel</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content class="ion-padding">
            <div class="form-container">
              <ion-item>
                <ion-label position="stacked">Provider</ion-label>
                <ion-input
                  :value="
                    selectedProvider?.display_name || selectedProvider?.name
                  "
                  disabled
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Display Name *</ion-label>
                <ion-input v-model="modelForm.name" placeholder="GPT-4o" />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Model Name (API) *</ion-label>
                <ion-input
                  v-model="modelForm.modelName"
                  placeholder="gpt-4o"
                  :disabled="!!editingModel"
                />
              </ion-item>
              <p class="hint" v-if="!editingModel">
                The model identifier used in API calls
              </p>

              <ion-item>
                <ion-label position="stacked">Context Window</ion-label>
                <ion-input
                  v-model.number="modelForm.contextWindow"
                  type="number"
                  placeholder="128000"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Max Output Tokens</ion-label>
                <ion-input
                  v-model.number="modelForm.maxTokens"
                  type="number"
                  placeholder="4096"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Model Tier</ion-label>
                <ion-select v-model="modelForm.modelTier" interface="popover">
                  <ion-select-option value="flagship"
                    >Flagship</ion-select-option
                  >
                  <ion-select-option value="premium">Premium</ion-select-option>
                  <ion-select-option value="standard"
                    >Standard</ion-select-option
                  >
                  <ion-select-option value="economy">Economy</ion-select-option>
                  <ion-select-option value="free">Free</ion-select-option>
                </ion-select>
              </ion-item>

              <ion-item>
                <ion-label position="stacked"
                  >Pricing Input (per 1K tokens)</ion-label
                >
                <ion-input
                  v-model.number="modelForm.pricingInputPer1k"
                  type="number"
                  step="0.0001"
                  placeholder="0.005"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked"
                  >Pricing Output (per 1K tokens)</ion-label
                >
                <ion-input
                  v-model.number="modelForm.pricingOutputPer1k"
                  type="number"
                  step="0.0001"
                  placeholder="0.015"
                />
              </ion-item>

              <ion-item>
                <ion-label>Supports Thinking</ion-label>
                <ion-toggle v-model="modelForm.supportsThinking" slot="end" />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Status</ion-label>
                <ion-select v-model="modelForm.status" interface="popover">
                  <ion-select-option value="active">Active</ion-select-option>
                  <ion-select-option value="inactive"
                    >Inactive</ion-select-option
                  >
                  <ion-select-option value="deprecated"
                    >Deprecated</ion-select-option
                  >
                </ion-select>
              </ion-item>

              <div class="form-actions">
                <ion-button
                  expand="block"
                  :disabled="!isModelFormValid || saving"
                  @click="saveModel"
                >
                  {{
                    saving ? "Saving..." : editingModel ? "Update" : "Create"
                  }}
                </ion-button>
              </div>
            </div>
          </ion-content>
        </ion-modal>

        <!-- Delete Provider Confirmation -->
        <ion-alert
          :is-open="showDeleteProviderAlert"
          header="Delete Provider"
          :message="`Are you sure you want to delete '${providerToDelete?.display_name || providerToDelete?.name}'? This will also remove all associated models.`"
          :buttons="deleteProviderAlertButtons"
          @didDismiss="showDeleteProviderAlert = false"
        />

        <!-- Delete Model Confirmation -->
        <ion-alert
          :is-open="showDeleteModelAlert"
          header="Delete Model"
          :message="`Are you sure you want to delete model '${modelToDelete?.displayName || modelToDelete?.display_name || getModelName(modelToDelete)}'?`"
          :buttons="deleteModelAlertButtons"
          @didDismiss="showDeleteModelAlert = false"
        />

        <ion-loading :is-open="loading" message="Loading providers..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonToggle,
  IonLoading,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonAlert,
  toastController,
} from "@ionic/vue";
import {
  refreshOutline,
  starOutline,
  closeOutline,
  arrowBackOutline,
  addOutline,
  createOutline,
  trashOutline,
} from "ionicons/icons";
import {
  fetchProvidersWithModels,
  type ProviderWithModels,
} from "@/services/modelCatalogService";
import {
  fetchGlobalModelConfig,
  updateGlobalModelConfig,
  type GlobalModelConfig,
} from "@/services/systemSettingsService";
import { apiService } from "@/services/apiService";

// State
const loading = ref(false);
const saving = ref(false);
const providers = ref<ProviderWithModels[]>([]);
const selectedProvider = ref<ProviderWithModels | null>(null);
const ollamaStatus = ref<{ connected: boolean; version?: string }>({
  connected: false,
});
const defaultModel = ref<{ provider: string; model: string } | null>(null);

// Provider modal state
const showProviderModal = ref(false);
const editingProvider = ref<ProviderWithModels | null>(null);
const providerForm = ref({
  name: "",
  display_name: "",
  apiBaseUrl: "",
  authType: "api_key" as string,
  isLocal: false,
  status: "active" as string,
});

// Model modal state
const showModelModal = ref(false);
const editingModel = ref<ModelWithActive | null>(null);
const modelForm = ref({
  name: "",
  modelName: "",
  contextWindow: null as number | null,
  maxTokens: null as number | null,
  modelTier: "" as string,
  pricingInputPer1k: null as number | null,
  pricingOutputPer1k: null as number | null,
  supportsThinking: false,
  status: "active" as string,
});

// Delete state
const showDeleteProviderAlert = ref(false);
const providerToDelete = ref<ProviderWithModels | null>(null);
const showDeleteModelAlert = ref(false);
const modelToDelete = ref<ModelWithActive | null>(null);

// Computed
const selectedProviderModels = computed(() => {
  if (!selectedProvider.value) return [];

  // For Ollama, merge catalog models with live models
  if (
    selectedProvider.value.name === "ollama" &&
    ollamaStatus.value.connected
  ) {
    return selectedProvider.value.models || [];
  }

  return selectedProvider.value.models || [];
});

const isProviderFormValid = computed(() => {
  return Boolean(providerForm.value.name.trim());
});

const isModelFormValid = computed(() => {
  return Boolean(
    modelForm.value.name.trim() && modelForm.value.modelName.trim(),
  );
});

// Delete alert buttons
const deleteProviderAlertButtons = [
  { text: "Cancel", role: "cancel" },
  {
    text: "Delete",
    role: "destructive",
    handler: () => {
      performDeleteProvider();
    },
  },
];

const deleteModelAlertButtons = [
  { text: "Cancel", role: "cancel" },
  {
    text: "Delete",
    role: "destructive",
    handler: () => {
      performDeleteModel();
    },
  },
];

// Data fetching
const fetchProviders = async () => {
  try {
    // Don't pass status to get all providers (active, inactive, deprecated)
    providers.value = await fetchProvidersWithModels({});

    // Update selectedProvider reference if it still exists
    if (selectedProvider.value) {
      const updated = providers.value.find(
        (p) => p.name === selectedProvider.value!.name,
      );
      selectedProvider.value = updated || null;
    }

    // Auto-select first provider if none selected
    if (!selectedProvider.value && providers.value.length > 0) {
      selectedProvider.value = providers.value[0];
    }
  } catch (error) {
    console.error("Failed to fetch providers:", error);
  }
};

const fetchOllamaStatus = async () => {
  try {
    const response = (await apiService.get("/llm/local-models/status")) as {
      connected?: boolean;
      version?: string;
    };
    ollamaStatus.value = {
      connected: response?.connected ?? false,
      version: response?.version,
    };
  } catch (error) {
    console.error("Failed to fetch Ollama status:", error);
    ollamaStatus.value = { connected: false };
  }
};

const fetchDefaultModel = async () => {
  try {
    const response = (await fetchGlobalModelConfig()) as
      | { dbConfig?: GlobalModelConfig }
      | GlobalModelConfig;

    // Handle response that may be wrapped in dbConfig or direct config
    const config =
      response && typeof response === "object" && "dbConfig" in response
        ? response.dbConfig
        : (response as GlobalModelConfig);

    if (config) {
      if (config.default) {
        defaultModel.value = {
          provider: config.default.provider,
          model: config.default.model,
        };
      } else if (config.provider && config.model) {
        defaultModel.value = { provider: config.provider, model: config.model };
      }
    }
  } catch (error) {
    console.error("Failed to fetch default model:", error);
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

// Provider actions
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
      color: "success",
    });
    await toast.present();
  } catch {
    const toast = await toastController.create({
      message: "Failed to set default model",
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  }
};

const toggleProvider = async (
  provider: ProviderWithModels,
  event: CustomEvent,
) => {
  const newValue = event.detail.checked;
  const newStatus = newValue ? "active" : "inactive";

  // Optimistic update
  provider.is_active = newValue;

  try {
    await apiService.put(`/providers/${provider.id}`, { status: newStatus });
    const toast = await toastController.create({
      message: `Provider ${provider.display_name || provider.name} ${newValue ? "enabled" : "disabled"}`,
      duration: 2000,
      color: "success",
    });
    await toast.present();
  } catch (error: unknown) {
    // Revert on failure
    provider.is_active = !newValue;
    console.error("Failed to toggle provider:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const toast = await toastController.create({
      message:
        err?.response?.data?.message || "Failed to update provider status",
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  }
};

// Provider CRUD
const openProviderCreateModal = () => {
  editingProvider.value = null;
  providerForm.value = {
    name: "",
    display_name: "",
    apiBaseUrl: "",
    authType: "api_key",
    isLocal: false,
    status: "active",
  };
  showProviderModal.value = true;
};

const openProviderEditModal = (provider: ProviderWithModels) => {
  editingProvider.value = provider;
  providerForm.value = {
    name: provider.name,
    display_name: provider.display_name || "",
    apiBaseUrl:
      ((provider as unknown as Record<string, unknown>)
        .api_base_url as string) || "",
    authType:
      ((provider as unknown as Record<string, unknown>).auth_type as string) ||
      "api_key",
    isLocal: provider.is_local || false,
    status: provider.is_active ? "active" : "inactive",
  };
  showProviderModal.value = true;
};

const closeProviderModal = () => {
  showProviderModal.value = false;
  editingProvider.value = null;
};

const saveProvider = async () => {
  if (!isProviderFormValid.value) return;

  saving.value = true;
  try {
    const data: Record<string, unknown> = {
      name: providerForm.value.name,
      apiBaseUrl: providerForm.value.apiBaseUrl || undefined,
      authType: providerForm.value.authType,
      isLocal: providerForm.value.isLocal,
      status: providerForm.value.status,
    };

    // Include display_name if provided (the DTO may accept it as part of the provider name or separate field)
    if (providerForm.value.display_name) {
      data.displayName = providerForm.value.display_name;
    }

    if (editingProvider.value) {
      await apiService.put(`/providers/${editingProvider.value.id}`, data);
      const toast = await toastController.create({
        message: "Provider updated successfully",
        duration: 2000,
        color: "success",
      });
      await toast.present();
    } else {
      await apiService.post("/providers", data);
      const toast = await toastController.create({
        message: "Provider created successfully",
        duration: 2000,
        color: "success",
      });
      await toast.present();
    }
    closeProviderModal();
    await fetchProviders();
  } catch (error: unknown) {
    console.error("Failed to save provider:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const message =
      err?.response?.data?.message || err?.message || "Failed to save provider";
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  } finally {
    saving.value = false;
  }
};

const confirmDeleteProvider = (provider: ProviderWithModels) => {
  providerToDelete.value = provider;
  showDeleteProviderAlert.value = true;
};

const performDeleteProvider = async () => {
  if (!providerToDelete.value) return;

  loading.value = true;
  try {
    await apiService.delete(`/providers/${providerToDelete.value.id}`);
    const toast = await toastController.create({
      message: "Provider deleted successfully",
      duration: 2000,
      color: "success",
    });
    await toast.present();

    // Clear selection if we deleted the selected provider
    if (selectedProvider.value?.name === providerToDelete.value.name) {
      selectedProvider.value = null;
    }
    await fetchProviders();
  } catch (error: unknown) {
    console.error("Failed to delete provider:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const message =
      err?.response?.data?.message ||
      err?.message ||
      "Failed to delete provider";
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  } finally {
    loading.value = false;
    providerToDelete.value = null;
  }
};

// Model types & actions
interface ModelWithActive {
  id?: string;
  modelName?: string;
  model_name?: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  is_active?: boolean;
  model_tier?: string;
  context_window?: number;
  max_tokens?: number;
  maxTokens?: number;
  pricing_input_per_1k?: number;
  pricingInputPer1k?: number;
  pricing_output_per_1k?: number;
  pricingOutputPer1k?: number;
  supports_thinking?: boolean;
  supportsThinking?: boolean;
  status?: string;
  providerName?: string;
}

const toggleModel = async (
  providerName: string,
  model: ModelWithActive,
  event: CustomEvent,
) => {
  const newValue = event.detail.checked;
  const newStatus = newValue ? "active" : "inactive";
  const modelId = model.id || getModelName(model);

  // Optimistic update
  model.is_active = newValue;

  try {
    await apiService.put(`/models/${modelId}`, { status: newStatus });
    const toast = await toastController.create({
      message: `Model ${model.displayName || model.display_name || getModelName(model)} ${newValue ? "enabled" : "disabled"}`,
      duration: 2000,
      color: "success",
    });
    await toast.present();
  } catch (error: unknown) {
    // Revert on failure
    model.is_active = !newValue;
    console.error("Failed to toggle model:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const toast = await toastController.create({
      message: err?.response?.data?.message || "Failed to update model status",
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  }
};

// Model CRUD
const openModelCreateModal = () => {
  editingModel.value = null;
  modelForm.value = {
    name: "",
    modelName: "",
    contextWindow: null,
    maxTokens: null,
    modelTier: "",
    pricingInputPer1k: null,
    pricingOutputPer1k: null,
    supportsThinking: false,
    status: "active",
  };
  showModelModal.value = true;
};

const openModelEditModal = (model: ModelWithActive) => {
  editingModel.value = model;
  modelForm.value = {
    name: model.displayName || model.display_name || model.name || "",
    modelName: getModelName(model),
    contextWindow: model.context_window || null,
    maxTokens: model.max_tokens || model.maxTokens || null,
    modelTier: model.model_tier || "",
    pricingInputPer1k:
      model.pricing_input_per_1k || model.pricingInputPer1k || null,
    pricingOutputPer1k:
      model.pricing_output_per_1k || model.pricingOutputPer1k || null,
    supportsThinking:
      model.supports_thinking || model.supportsThinking || false,
    status: model.is_active === false ? "inactive" : model.status || "active",
  };
  showModelModal.value = true;
};

const closeModelModal = () => {
  showModelModal.value = false;
  editingModel.value = null;
};

const saveModel = async () => {
  if (!isModelFormValid.value || !selectedProvider.value) return;

  saving.value = true;
  try {
    const data: Record<string, unknown> = {
      name: modelForm.value.name,
      modelName: modelForm.value.modelName,
      status: modelForm.value.status,
      supportsThinking: modelForm.value.supportsThinking,
    };

    if (modelForm.value.contextWindow)
      data.contextWindow = modelForm.value.contextWindow;
    if (modelForm.value.maxTokens) data.maxTokens = modelForm.value.maxTokens;
    if (modelForm.value.modelTier) data.modelTier = modelForm.value.modelTier;
    if (modelForm.value.pricingInputPer1k != null)
      data.pricingInputPer1k = modelForm.value.pricingInputPer1k;
    if (modelForm.value.pricingOutputPer1k != null)
      data.pricingOutputPer1k = modelForm.value.pricingOutputPer1k;

    if (editingModel.value) {
      const modelId = editingModel.value.id || getModelName(editingModel.value);
      await apiService.put(`/models/${modelId}`, data);
      const toast = await toastController.create({
        message: "Model updated successfully",
        duration: 2000,
        color: "success",
      });
      await toast.present();
    } else {
      data.providerName = selectedProvider.value.name;
      await apiService.post("/models", data);
      const toast = await toastController.create({
        message: "Model created successfully",
        duration: 2000,
        color: "success",
      });
      await toast.present();
    }
    closeModelModal();
    await fetchProviders();
  } catch (error: unknown) {
    console.error("Failed to save model:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const message =
      err?.response?.data?.message || err?.message || "Failed to save model";
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  } finally {
    saving.value = false;
  }
};

const confirmDeleteModel = (model: ModelWithActive) => {
  modelToDelete.value = model;
  showDeleteModelAlert.value = true;
};

const performDeleteModel = async () => {
  if (!modelToDelete.value) return;

  loading.value = true;
  try {
    const modelId = modelToDelete.value.id || getModelName(modelToDelete.value);
    await apiService.delete(`/models/${modelId}`);
    const toast = await toastController.create({
      message: "Model deleted successfully",
      duration: 2000,
      color: "success",
    });
    await toast.present();
    await fetchProviders();
  } catch (error: unknown) {
    console.error("Failed to delete model:", error);
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const message =
      err?.response?.data?.message || err?.message || "Failed to delete model";
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: "danger",
    });
    await toast.present();
  } finally {
    loading.value = false;
    modelToDelete.value = null;
  }
};

// Helpers
const getModelName = (model: ModelWithActive | null | undefined) => {
  if (!model) return "";
  return model.modelName || model.model_name || model.name || "";
};

const isDefaultModel = (provider: string, model: string) => {
  return (
    defaultModel.value?.provider === provider &&
    defaultModel.value?.model === model
  );
};

const formatContextWindow = (tokens: number) => {
  if (!tokens) return "-";
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
};

const getTierColor = (tier: string) => {
  const colors: Record<string, string> = {
    flagship: "danger",
    premium: "warning",
    standard: "primary",
    economy: "success",
    free: "medium",
  };
  return colors[tier?.toLowerCase()] || "medium";
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
  background: linear-gradient(135deg, #a16c4a 0%, #6d4428 100%);
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

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

.actions-cell {
  white-space: nowrap;
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

/* Form Styles */
.form-container {
  max-width: 600px;
  margin: 0 auto;
}

.form-container ion-item {
  --padding-start: 0;
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 0.75rem;
  color: #888;
  margin: 0.25rem 0 0.75rem;
  padding-left: 0;
}

.form-actions {
  margin-top: 1.5rem;
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
