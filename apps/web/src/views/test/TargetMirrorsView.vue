<script setup lang="ts">
/**
 * TargetMirrorsView (SCR-002)
 *
 * Manages test target mirrors - mappings between production targets
 * and their T_ prefixed test counterparts.
 */

import { ref, onMounted, computed } from 'vue';
import TestModeIndicator from '@/components/test/TestModeIndicator.vue';
import TestSymbolBadge from '@/components/test/TestSymbolBadge.vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import type { TestTargetMirrorWithTarget, PredictionTarget } from '@/services/predictionDashboardService';
import { useTestTargetMirrorStore } from '@/stores/testTargetMirrorStore';

const mirrorStore = useTestTargetMirrorStore();

// Loading states
const isLoading = ref(true);
const isSaving = ref(false);
const error = ref<string | null>(null);

// Available production targets (without mirrors)
const productionTargets = ref<PredictionTarget[]>([]);
const targetsWithoutMirrors = computed(() =>
  productionTargets.value.filter(
    (t) => !mirrorStore.hasProductionTargetMirror(t.id)
  )
);

// Create mirror modal
const showCreateModal = ref(false);
const createForm = ref({
  productionTargetId: '',
  customSymbol: '',
  useCustomSymbol: false,
});

// Delete confirmation
const mirrorToDelete = ref<TestTargetMirrorWithTarget | null>(null);

// Load data
async function loadData() {
  isLoading.value = true;
  error.value = null;
  mirrorStore.setLoading(true);

  try {
    // Load mirrors with target details
    const mirrorsRes = await predictionDashboardService.listTestTargetMirrors({
      includeTargetDetails: true,
    });
    if (mirrorsRes.content) {
      mirrorStore.setMirrors(mirrorsRes.content as TestTargetMirrorWithTarget[]);
    }

    // Load all production targets
    const targetsRes = await predictionDashboardService.listTargets();
    if (targetsRes.content) {
      productionTargets.value = targetsRes.content;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
    mirrorStore.setError(error.value);
  } finally {
    isLoading.value = false;
    mirrorStore.setLoading(false);
  }
}

// Create mirror
async function createMirror() {
  if (!createForm.value.productionTargetId) return;

  isSaving.value = true;
  mirrorStore.setSaving(true);

  try {
    const target = productionTargets.value.find(
      (t) => t.id === createForm.value.productionTargetId
    );
    if (!target) throw new Error('Target not found');

    const testSymbol = createForm.value.useCustomSymbol && createForm.value.customSymbol
      ? `T_${createForm.value.customSymbol.toUpperCase()}`
      : `T_${target.symbol}`;

    const result = await predictionDashboardService.createTestTargetMirror({
      production_target_id: createForm.value.productionTargetId,
      test_symbol: testSymbol,
    });

    if (result.content) {
      mirrorStore.addMirror({
        ...result.content,
        production_target: {
          id: target.id,
          name: target.name,
          symbol: target.symbol,
          universe_id: target.universeId,
          target_type: target.targetType,
        },
      });
    }

    showCreateModal.value = false;
    resetCreateForm();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create mirror';
  } finally {
    isSaving.value = false;
    mirrorStore.setSaving(false);
  }
}

// Ensure mirror exists (auto-create)
async function ensureMirror(targetId: string) {
  isSaving.value = true;

  try {
    const result = await predictionDashboardService.ensureTestTargetMirror({
      productionTargetId: targetId,
    });

    if (result.content?.mirror) {
      const target = productionTargets.value.find((t) => t.id === targetId);
      mirrorStore.addMirror({
        ...result.content.mirror,
        production_target: target
          ? {
              id: target.id,
              name: target.name,
              symbol: target.symbol,
              universe_id: target.universeId,
              target_type: target.targetType,
            }
          : undefined,
      });
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to ensure mirror';
  } finally {
    isSaving.value = false;
  }
}

// Auto-create all missing mirrors
async function autoCreateAllMirrors() {
  isSaving.value = true;

  try {
    for (const target of targetsWithoutMirrors.value) {
      await ensureMirror(target.id);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to auto-create mirrors';
  } finally {
    isSaving.value = false;
  }
}

// Delete mirror
async function deleteMirror() {
  if (!mirrorToDelete.value) return;

  isSaving.value = true;

  try {
    await predictionDashboardService.deleteTestTargetMirror({
      id: mirrorToDelete.value.id,
    });
    mirrorStore.removeMirror(mirrorToDelete.value.id);
    mirrorToDelete.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete mirror';
  } finally {
    isSaving.value = false;
  }
}

function resetCreateForm() {
  createForm.value = {
    productionTargetId: '',
    customSymbol: '',
    useCustomSymbol: false,
  };
}

function openCreateModal() {
  resetCreateForm();
  showCreateModal.value = true;
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="target-mirrors-view">
    <TestModeIndicator message="Target Mirror Management" />

    <div class="target-mirrors-view__content">
      <!-- Header -->
      <header class="target-mirrors-view__header">
        <div>
          <h1 class="target-mirrors-view__title">Targets & Mirrors</h1>
          <p class="target-mirrors-view__subtitle">
            Map production targets to T_ prefixed test symbols for isolated testing
          </p>
        </div>
        <div class="target-mirrors-view__actions">
          <button
            v-if="targetsWithoutMirrors.length > 0"
            class="btn btn--secondary"
            :disabled="isSaving"
            @click="autoCreateAllMirrors"
          >
            Auto-Create All ({{ targetsWithoutMirrors.length }})
          </button>
          <button class="btn btn--primary" @click="openCreateModal">
            Create Mirror
          </button>
        </div>
      </header>

      <!-- Error -->
      <div v-if="error" class="target-mirrors-view__error">
        <p>{{ error }}</p>
        <button @click="error = null">Dismiss</button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="target-mirrors-view__loading">
        <div class="spinner" />
        <p>Loading mirrors...</p>
      </div>

      <!-- Mirrors Table -->
      <div v-else class="target-mirrors-view__table-container">
        <table class="mirrors-table">
          <thead>
            <tr>
              <th>Production Target</th>
              <th>Symbol</th>
              <th>Test Mirror</th>
              <th>Universe</th>
              <th>Type</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="mirrorStore.mirrors.length === 0">
              <td colspan="7" class="mirrors-table__empty">
                No mirrors configured. Create one to start testing.
              </td>
            </tr>
            <tr v-for="mirror in mirrorStore.mirrors" :key="mirror.id">
              <td>
                <span class="target-name">
                  {{ mirror.production_target?.name || 'Unknown' }}
                </span>
              </td>
              <td>
                <code class="symbol-code">{{ mirror.production_target?.symbol || '—' }}</code>
              </td>
              <td>
                <TestSymbolBadge :test-symbol="mirror.test_symbol" size="sm" />
              </td>
              <td>
                <span class="universe-badge">
                  {{ mirror.production_target?.universe_id?.slice(0, 8) || '—' }}
                </span>
              </td>
              <td>
                <span class="type-badge">
                  {{ mirror.production_target?.target_type || '—' }}
                </span>
              </td>
              <td>
                <span class="date-text">
                  {{ new Date(mirror.created_at).toLocaleDateString() }}
                </span>
              </td>
              <td>
                <button
                  class="btn btn--icon btn--danger"
                  title="Delete mirror"
                  @click="mirrorToDelete = mirror"
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

      <!-- Targets Without Mirrors -->
      <div v-if="targetsWithoutMirrors.length > 0" class="unmapped-section">
        <h2>Targets Without Mirrors ({{ targetsWithoutMirrors.length }})</h2>
        <div class="unmapped-list">
          <div
            v-for="target in targetsWithoutMirrors"
            :key="target.id"
            class="unmapped-item"
          >
            <span class="unmapped-item__name">{{ target.name }}</span>
            <code class="unmapped-item__symbol">{{ target.symbol }}</code>
            <button
              class="btn btn--sm btn--secondary"
              :disabled="isSaving"
              @click="ensureMirror(target.id)"
            >
              Create Mirror
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h2>Create Target Mirror</h2>
        <form @submit.prevent="createMirror">
          <div class="form-group">
            <label>Production Target</label>
            <select v-model="createForm.productionTargetId" required>
              <option value="">Select a target...</option>
              <option
                v-for="target in targetsWithoutMirrors"
                :key="target.id"
                :value="target.id"
              >
                {{ target.name }} ({{ target.symbol }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="createForm.useCustomSymbol" type="checkbox" />
              Use custom test symbol
            </label>
          </div>

          <div v-if="createForm.useCustomSymbol" class="form-group">
            <label>Custom Symbol (without T_ prefix)</label>
            <input
              v-model="createForm.customSymbol"
              type="text"
              placeholder="e.g., AAPL_TEST"
            />
          </div>

          <div class="modal__actions">
            <button type="button" class="btn btn--secondary" @click="showCreateModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn--primary" :disabled="isSaving || !createForm.productionTargetId">
              {{ isSaving ? 'Creating...' : 'Create Mirror' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="mirrorToDelete" class="modal-overlay" @click.self="mirrorToDelete = null">
      <div class="modal modal--danger">
        <h2>Delete Mirror?</h2>
        <p>
          Are you sure you want to delete the mirror for
          <strong>{{ mirrorToDelete.production_target?.name }}</strong>
          ({{ mirrorToDelete.test_symbol }})?
        </p>
        <p class="warning">This will not delete any associated test data.</p>
        <div class="modal__actions">
          <button class="btn btn--secondary" @click="mirrorToDelete = null">Cancel</button>
          <button class="btn btn--danger" :disabled="isSaving" @click="deleteMirror">
            {{ isSaving ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.target-mirrors-view {
  min-height: 100vh;
  background: #f9fafb;
}

.target-mirrors-view__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.target-mirrors-view__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.target-mirrors-view__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.target-mirrors-view__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.target-mirrors-view__actions {
  display: flex;
  gap: 0.75rem;
}

.target-mirrors-view__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.target-mirrors-view__error p {
  margin: 0;
  color: #dc2626;
}

.target-mirrors-view__loading {
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

/* Table */
.target-mirrors-view__table-container {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 2rem;
}

.mirrors-table {
  width: 100%;
  border-collapse: collapse;
}

.mirrors-table th,
.mirrors-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

.mirrors-table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
}

.mirrors-table__empty {
  text-align: center;
  color: #9ca3af;
  padding: 2rem !important;
}

.target-name {
  font-weight: 500;
  color: #111827;
}

.symbol-code {
  font-size: 0.875rem;
  padding: 0.125rem 0.375rem;
  background: #f3f4f6;
  border-radius: 0.25rem;
}

.universe-badge,
.type-badge {
  font-size: 0.75rem;
  color: #6b7280;
}

.date-text {
  font-size: 0.875rem;
  color: #6b7280;
}

/* Unmapped Section */
.unmapped-section {
  margin-top: 2rem;
}

.unmapped-section h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem;
}

.unmapped-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.unmapped-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: white;
  border-radius: 0.375rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.unmapped-item__name {
  flex: 1;
  font-weight: 500;
}

.unmapped-item__symbol {
  font-size: 0.875rem;
  padding: 0.125rem 0.375rem;
  background: #f3f4f6;
  border-radius: 0.25rem;
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
}

.modal {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.modal p {
  color: #6b7280;
  margin: 0 0 1rem;
}

.modal--danger .warning {
  color: #dc2626;
  font-size: 0.875rem;
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

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-label input {
  width: auto !important;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .target-mirrors-view {
    background: #111827;
  }

  .target-mirrors-view__title,
  .target-name {
    color: #f9fafb;
  }

  .target-mirrors-view__table-container,
  .unmapped-item,
  .modal {
    background: #1f2937;
  }

  .mirrors-table th {
    background: #374151;
    color: #9ca3af;
  }

  .mirrors-table td {
    border-bottom-color: #374151;
  }

  .symbol-code {
    background: #374151;
    color: #e5e7eb;
  }

  .btn--secondary {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #4b5563;
  }
}
</style>
