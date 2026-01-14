<template>
  <div class="analyst-management">
    <header class="management-header">
      <div class="header-left">
        <button class="back-button" @click="goBackToDashboard">
          <span class="back-icon">&larr;</span>
          Back to Dashboard
        </button>
        <h1>Analyst Management</h1>
      </div>
      <button class="btn btn-primary" @click="openCreateModal">
        <span class="icon">+</span>
        New Analyst
      </button>
    </header>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <div class="filter-group">
        <label>Scope Level:</label>
        <button
          class="filter-tab"
          :class="{ active: selectedScopeLevel === null }"
          @click="selectedScopeLevel = null"
        >
          All
        </button>
        <button
          v-for="level in scopeLevels"
          :key="level"
          class="filter-tab"
          :class="{ active: selectedScopeLevel === level }"
          @click="selectedScopeLevel = level"
        >
          {{ level }}
        </button>
      </div>

      <div class="filter-group">
        <label>Domain:</label>
        <button
          class="filter-tab"
          :class="{ active: selectedDomain === null }"
          @click="selectedDomain = null"
        >
          All
        </button>
        <button
          v-for="domain in domains"
          :key="domain"
          class="filter-tab"
          :class="{ active: selectedDomain === domain }"
          @click="selectedDomain = domain"
        >
          {{ domain }}
        </button>
      </div>

      <div class="filter-group">
        <label>Status:</label>
        <button
          class="filter-tab"
          :class="{ active: selectedActive === null }"
          @click="selectedActive = null"
        >
          All
        </button>
        <button
          class="filter-tab"
          :class="{ active: selectedActive === true }"
          @click="selectedActive = true"
        >
          Active
        </button>
        <button
          class="filter-tab"
          :class="{ active: selectedActive === false }"
          @click="selectedActive = false"
        >
          Inactive
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading analysts...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
      <button class="btn btn-secondary" @click="loadAnalysts">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="displayedAnalysts.length === 0" class="empty-state">
      <span class="empty-icon">&#128373;</span>
      <h3>No Analysts Found</h3>
      <p>{{ getEmptyStateMessage() }}</p>
      <button class="btn btn-primary" @click="openCreateModal">Create Analyst</button>
    </div>

    <!-- Analysts Grid -->
    <div v-else class="analysts-grid">
      <AnalystCard
        v-for="analyst in displayedAnalysts"
        :key="analyst.id"
        :analyst="analyst"
        :is-selected="analyst.id === selectedAnalystId"
        @select="onAnalystSelect"
        @edit="openEditModal"
        @delete="confirmDelete"
      />
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <header class="modal-header">
          <h2>{{ editingAnalyst ? 'Edit Analyst' : 'Create Analyst' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </header>

        <form @submit.prevent="saveAnalyst" class="analyst-form">
          <div class="form-group">
            <label for="slug">Slug *</label>
            <input
              id="slug"
              v-model="formData.slug"
              type="text"
              required
              placeholder="e.g., technical-analyst"
              :readonly="editingAnalyst !== null"
              :class="{ readonly: editingAnalyst !== null }"
            />
            <span class="help-text">Unique identifier (lowercase, hyphens only)</span>
          </div>

          <div class="form-group">
            <label for="name">Name *</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              required
              placeholder="e.g., Technical Analyst"
            />
          </div>

          <div class="form-group">
            <label for="perspective">Perspective *</label>
            <textarea
              id="perspective"
              v-model="formData.perspective"
              rows="2"
              required
              placeholder="Brief description of this analyst's perspective and approach"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="scopeLevel">Scope Level *</label>
            <select id="scopeLevel" v-model="formData.scopeLevel" required>
              <option value="">Select scope level</option>
              <option value="runner">Runner (Global)</option>
              <option value="domain">Domain</option>
              <option value="universe">Universe</option>
              <option value="target">Target</option>
            </select>
          </div>

          <!-- Conditional scope fields -->
          <div v-if="formData.scopeLevel === 'domain'" class="form-group">
            <label for="domain">Domain *</label>
            <select id="domain" v-model="formData.domain" required>
              <option value="">Select domain</option>
              <option value="stocks">Stocks</option>
              <option value="crypto">Crypto</option>
              <option value="elections">Elections</option>
              <option value="polymarket">Polymarket</option>
            </select>
          </div>

          <div v-if="formData.scopeLevel === 'universe'" class="form-group">
            <label for="universeId">Universe *</label>
            <select id="universeId" v-model="formData.universeId" required>
              <option value="">Select universe</option>
              <option
                v-for="universe in universes"
                :key="universe.id"
                :value="universe.id"
              >
                {{ universe.name }} ({{ universe.domain }})
              </option>
            </select>
          </div>

          <div v-if="formData.scopeLevel === 'target'" class="form-group">
            <label for="targetId">Target *</label>
            <select id="targetId" v-model="formData.targetId" required>
              <option value="">Select target</option>
              <option
                v-for="target in targets"
                :key="target.id"
                :value="target.id"
              >
                {{ target.name }} ({{ target.symbol }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="defaultWeight">Default Weight *</label>
            <input
              id="defaultWeight"
              v-model.number="formData.defaultWeight"
              type="number"
              step="0.01"
              min="0"
              max="1"
              required
              placeholder="0.0 - 1.0"
            />
            <span class="help-text">Weight in ensemble (0.0 to 1.0)</span>
          </div>

          <!-- Tier Instructions -->
          <fieldset class="tier-instructions-fieldset">
            <legend>Tier Instructions</legend>

            <div class="tier-config">
              <h4 class="tier-label gold">Gold Tier</h4>
              <textarea
                v-model="formData.tierInstructions.gold"
                rows="3"
                placeholder="Specific instructions for gold tier LLM"
              ></textarea>
            </div>

            <div class="tier-config">
              <h4 class="tier-label silver">Silver Tier</h4>
              <textarea
                v-model="formData.tierInstructions.silver"
                rows="3"
                placeholder="Specific instructions for silver tier LLM"
              ></textarea>
            </div>

            <div class="tier-config">
              <h4 class="tier-label bronze">Bronze Tier</h4>
              <textarea
                v-model="formData.tierInstructions.bronze"
                rows="3"
                placeholder="Specific instructions for bronze tier LLM"
              ></textarea>
            </div>
          </fieldset>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : (editingAnalyst ? 'Update' : 'Create') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
      <div class="modal-content delete-modal">
        <header class="modal-header">
          <h2>Delete Analyst</h2>
          <button class="close-btn" @click="cancelDelete">&times;</button>
        </header>
        <div class="modal-body">
          <p>Are you sure you want to delete <strong>{{ analystToDelete?.name }}</strong>?</p>
          <p class="warning">This will remove this analyst from all predictions. This action cannot be undone.</p>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" @click="cancelDelete">Cancel</button>
          <button class="btn btn-danger" :disabled="isDeleting" @click="executeDelete">
            {{ isDeleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAnalystStore } from '@/stores/analystStore';
import { usePredictionStore } from '@/stores/predictionStore';
import {
  predictionDashboardService,
  type PredictionAnalyst,
} from '@/services/predictionDashboardService';
import AnalystCard from '@/components/prediction/AnalystCard.vue';

const router = useRouter();
const analystStore = useAnalystStore();
const predictionStore = usePredictionStore();

function goBackToDashboard() {
  router.push({ name: 'PredictionDashboard' });
}

const isLoading = ref(false);
const error = ref<string | null>(null);
const selectedScopeLevel = ref<'runner' | 'domain' | 'universe' | 'target' | null>(null);
const selectedDomain = ref<string | null>(null);
const selectedActive = ref<boolean | null>(null);
const selectedAnalystId = ref<string | null>(null);
const showModal = ref(false);
const showDeleteModal = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const editingAnalyst = ref<PredictionAnalyst | null>(null);
const analystToDelete = ref<PredictionAnalyst | null>(null);

const scopeLevels = ['runner', 'domain', 'universe', 'target'];
const domains = ['stocks', 'crypto', 'elections', 'polymarket'];

const universes = computed(() => predictionStore.universes);
const targets = computed(() => predictionStore.targets);

const formData = reactive({
  slug: '',
  name: '',
  perspective: '',
  scopeLevel: '' as 'runner' | 'domain' | 'universe' | 'target' | '',
  domain: '',
  universeId: '',
  targetId: '',
  defaultWeight: 0.5,
  tierInstructions: {
    gold: '',
    silver: '',
    bronze: '',
  },
});

const displayedAnalysts = computed(() => {
  let result = analystStore.analysts;

  if (selectedScopeLevel.value) {
    result = result.filter((a) => a.scopeLevel === selectedScopeLevel.value);
  }

  if (selectedDomain.value) {
    result = result.filter((a) => a.domain === selectedDomain.value);
  }

  if (selectedActive.value !== null) {
    result = result.filter((a) => a.active === selectedActive.value);
  }

  return result;
});

function getEmptyStateMessage(): string {
  if (selectedScopeLevel.value) {
    return `No ${selectedScopeLevel.value} analysts found`;
  }
  if (selectedDomain.value) {
    return `No analysts in the ${selectedDomain.value} domain`;
  }
  if (selectedActive.value !== null) {
    return `No ${selectedActive.value ? 'active' : 'inactive'} analysts found`;
  }
  return 'Create your first prediction analyst to get started';
}

async function loadAnalysts() {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await predictionDashboardService.listAnalysts();
    if (response.content) {
      analystStore.setAnalysts(response.content);
    }

    // Load universes and targets for dropdowns
    const dashboardData = await predictionDashboardService.loadDashboardData();
    predictionStore.setUniverses(dashboardData.universes);

    const targetsRes = await predictionDashboardService.listTargets();
    if (targetsRes.content) {
      predictionStore.setTargets(targetsRes.content);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load analysts';
  } finally {
    isLoading.value = false;
  }
}

function onAnalystSelect(id: string) {
  selectedAnalystId.value = id;
  analystStore.selectAnalyst(id);
}

function openCreateModal() {
  editingAnalyst.value = null;
  resetForm();
  showModal.value = true;
}

function openEditModal(analyst: PredictionAnalyst) {
  editingAnalyst.value = analyst;
  formData.slug = analyst.slug;
  formData.name = analyst.name;
  formData.perspective = analyst.perspective;
  formData.scopeLevel = analyst.scopeLevel;
  formData.domain = analyst.domain || '';
  formData.universeId = analyst.universeId || '';
  formData.targetId = analyst.targetId || '';
  formData.defaultWeight = analyst.defaultWeight;
  formData.tierInstructions.gold = analyst.tierInstructions?.gold || '';
  formData.tierInstructions.silver = analyst.tierInstructions?.silver || '';
  formData.tierInstructions.bronze = analyst.tierInstructions?.bronze || '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingAnalyst.value = null;
  resetForm();
}

function resetForm() {
  formData.slug = '';
  formData.name = '';
  formData.perspective = '';
  formData.scopeLevel = '';
  formData.domain = '';
  formData.universeId = '';
  formData.targetId = '';
  formData.defaultWeight = 0.5;
  formData.tierInstructions.gold = '';
  formData.tierInstructions.silver = '';
  formData.tierInstructions.bronze = '';
}

async function saveAnalyst() {
  if (!formData.name || !formData.slug || !formData.perspective || !formData.scopeLevel) return;

  isSaving.value = true;

  try {
    const tierInstructions = {
      gold: formData.tierInstructions.gold || undefined,
      silver: formData.tierInstructions.silver || undefined,
      bronze: formData.tierInstructions.bronze || undefined,
    };

    if (editingAnalyst.value) {
      const response = await predictionDashboardService.updateAnalyst({
        id: editingAnalyst.value.id,
        name: formData.name,
        perspective: formData.perspective,
        defaultWeight: formData.defaultWeight,
        tierInstructions,
      });
      if (response.content) {
        analystStore.updateAnalyst(editingAnalyst.value.id, response.content);
      }
    } else {
      const response = await predictionDashboardService.createAnalyst({
        slug: formData.slug,
        name: formData.name,
        perspective: formData.perspective,
        scopeLevel: formData.scopeLevel as 'runner' | 'domain' | 'universe' | 'target',
        domain: formData.domain || undefined,
        universeId: formData.universeId || undefined,
        targetId: formData.targetId || undefined,
        defaultWeight: formData.defaultWeight,
        tierInstructions,
      });
      if (response.content) {
        analystStore.addAnalyst(response.content);
      }
    }

    closeModal();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save analyst';
  } finally {
    isSaving.value = false;
  }
}

function confirmDelete(id: string) {
  analystToDelete.value = analystStore.getAnalystById(id) || null;
  showDeleteModal.value = true;
}

function cancelDelete() {
  showDeleteModal.value = false;
  analystToDelete.value = null;
}

async function executeDelete() {
  if (!analystToDelete.value) return;

  isDeleting.value = true;

  try {
    await predictionDashboardService.deleteAnalyst({ id: analystToDelete.value.id });
    analystStore.removeAnalyst(analystToDelete.value.id);
    cancelDelete();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete analyst';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  loadAnalysts();
});
</script>

<style scoped>
.analyst-management {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: color 0.2s;
}

.back-button:hover {
  color: var(--primary-color, #3b82f6);
}

.back-icon {
  font-size: 1rem;
}

.management-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: var(--primary-color, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-hover, #2563eb);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background-color: var(--btn-secondary-hover, #e5e7eb);
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon {
  font-size: 1.125rem;
  font-weight: 600;
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
  min-width: 100px;
}

.filter-tab {
  padding: 0.375rem 0.75rem;
  background: none;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.2s;
}

.filter-tab:hover {
  color: var(--text-primary, #111827);
  border-color: var(--primary-color, #3b82f6);
}

.filter-tab.active {
  color: white;
  background: var(--primary-color, #3b82f6);
  border-color: var(--primary-color, #3b82f6);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 3rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0;
  text-align: center;
}

/* Analysts Grid */
.analysts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  width: 90%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #111827);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary, #111827);
}

/* Form */
.analyst-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--input-bg, #ffffff);
  color: var(--text-primary, #111827);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input.readonly {
  background: var(--readonly-bg, #f9fafb);
  color: var(--text-secondary, #6b7280);
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.help-text {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

/* Tier Instructions */
.tier-instructions-fieldset {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.tier-instructions-fieldset legend {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  padding: 0 0.5rem;
}

.tier-config {
  margin-bottom: 1rem;
}

.tier-config:last-child {
  margin-bottom: 0;
}

.tier-label {
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
}

.tier-label.gold {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(184, 134, 11, 0.2));
  color: #b8860b;
}

.tier-label.silver {
  background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(128, 128, 128, 0.2));
  color: #666;
}

.tier-label.bronze {
  background: linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(139, 69, 19, 0.2));
  color: #8b4513;
}

.tier-config textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 4px;
  font-size: 0.8125rem;
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

/* Delete Modal */
.delete-modal {
  max-width: 400px;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary, #111827);
}

.modal-body .warning {
  font-size: 0.875rem;
  color: #ef4444;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .analyst-management {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --input-bg: #374151;
    --hover-bg: #374151;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
    --readonly-bg: #1f2937;
  }
}
</style>
