<template>
  <div class="dimensions-tab">
    <div class="tab-header">
      <h3>Risk Dimensions</h3>
      <button class="btn btn-primary" @click="showCreateModal = true">
        + Add Dimension
      </button>
    </div>

    <div v-if="dimensions.length === 0" class="empty-state">
      <span class="empty-icon">📋</span>
      <h3>No Dimensions Configured</h3>
      <p>Add risk dimensions to enable multi-dimensional analysis.</p>
    </div>

    <div v-else class="dimensions-list">
      <div
        v-for="dimension in dimensions"
        :key="dimension.id"
        class="dimension-card"
      >
        <div class="dimension-header">
          <div class="dimension-info">
            <h4>{{ dimension.name }}</h4>
            <span class="dimension-slug">{{ dimension.slug }}</span>
          </div>
          <span :class="['status-badge', (dimension.isActive || (dimension as any).is_active) ? 'active' : 'inactive']">
            {{ (dimension.isActive || (dimension as any).is_active) ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <p v-if="dimension.description" class="dimension-description">
          {{ dimension.description }}
        </p>

        <div class="dimension-meta">
          <span class="weight">
            <strong>Weight:</strong> {{ dimension.weight.toFixed(2) }}
          </span>
          <span class="created">
            Created: {{ formatDate(dimension.createdAt || (dimension as any).created_at) }}
          </span>
        </div>

        <div class="dimension-actions">
          <button class="btn btn-small" @click="editDimension(dimension)">
            Edit
          </button>
          <button
            class="btn btn-small"
            @click="toggleActive(dimension)"
          >
            {{ (dimension.isActive || (dimension as any).is_active) ? 'Deactivate' : 'Activate' }}
          </button>
          <button
            class="btn btn-small btn-danger"
            @click="confirmDelete(dimension)"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal || editingDimension" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingDimension ? 'Edit Dimension' : 'Create Dimension' }}</h3>

        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label for="dim-slug">Slug</label>
            <input
              id="dim-slug"
              v-model="formData.slug"
              type="text"
              required
              :disabled="!!editingDimension"
              placeholder="e.g., market-risk"
            />
          </div>

          <div class="form-group">
            <label for="dim-name">Name</label>
            <input
              id="dim-name"
              v-model="formData.name"
              type="text"
              required
              placeholder="e.g., Market Risk"
            />
          </div>

          <div class="form-group">
            <label for="dim-description">Description</label>
            <textarea
              id="dim-description"
              v-model="formData.description"
              rows="3"
              placeholder="Describe what this dimension analyzes..."
            ></textarea>
          </div>

          <div class="form-group">
            <label for="dim-weight">Weight</label>
            <input
              id="dim-weight"
              v-model.number="formData.weight"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              required
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {{ editingDimension ? 'Save Changes' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deletingDimension" class="modal-overlay" @click.self="deletingDimension = null">
      <div class="modal modal-small">
        <h3>Delete Dimension</h3>
        <p>Are you sure you want to delete "{{ deletingDimension.name }}"? This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="deletingDimension = null">
            Cancel
          </button>
          <button class="btn btn-danger" @click="confirmDeleteAction">
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import type { RiskDimension } from '@/types/risk-agent';

const props = defineProps<{
  dimensions: RiskDimension[];
  scopeId: string | null;
}>();

const emit = defineEmits<{
  create: [params: { slug: string; name: string; description?: string; weight: number }];
  update: [id: string, params: { name?: string; description?: string; weight?: number; isActive?: boolean }];
  delete: [id: string];
}>();

const showCreateModal = ref(false);
const editingDimension = ref<RiskDimension | null>(null);
const deletingDimension = ref<RiskDimension | null>(null);

const formData = reactive({
  slug: '',
  name: '',
  description: '',
  weight: 1.0,
});

function resetForm() {
  formData.slug = '';
  formData.name = '';
  formData.description = '';
  formData.weight = 1.0;
}

function editDimension(dimension: RiskDimension) {
  editingDimension.value = dimension;
  formData.slug = dimension.slug;
  formData.name = dimension.name;
  formData.description = dimension.description || '';
  formData.weight = dimension.weight;
}

function closeModal() {
  showCreateModal.value = false;
  editingDimension.value = null;
  resetForm();
}

function submitForm() {
  if (editingDimension.value) {
    emit('update', editingDimension.value.id, {
      name: formData.name,
      description: formData.description || undefined,
      weight: formData.weight,
    });
  } else {
    emit('create', {
      slug: formData.slug,
      name: formData.name,
      description: formData.description || undefined,
      weight: formData.weight,
    });
  }
  closeModal();
}

function toggleActive(dimension: RiskDimension) {
  const currentActive = dimension.isActive || (dimension as any).is_active;
  emit('update', dimension.id, { isActive: !currentActive });
}

function confirmDelete(dimension: RiskDimension) {
  deletingDimension.value = dimension;
}

function confirmDeleteAction() {
  if (deletingDimension.value) {
    emit('delete', deletingDimension.value.id);
    deletingDimension.value = null;
  }
}

function formatDate(isoString: string | undefined | null): string {
  if (!isoString) {
    return 'Not available';
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return 'Not available';
  }
  return date.toLocaleDateString();
}
</script>

<style scoped>
.dimensions-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tab-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem;
  color: var(--text-secondary, #6b7280);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0.5rem 0 0 0;
}

.dimensions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.dimension-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.dimension-info h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.dimension-slug {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-family: monospace;
}

.status-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.dimension-description {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 0.75rem 0;
  line-height: 1.5;
}

.dimension-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.75rem;
}

.dimension-actions {
  display: flex;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-color, #a87c4f);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover, #8b6740);
}

.btn-secondary {
  background: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover, #e5e7eb);
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fee2e2;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card-bg, #ffffff);
  border-radius: 8px;
  padding: 1.5rem;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small {
  max-width: 400px;
}

.modal h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
}

.modal p {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 1rem 0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  margin-bottom: 0.25rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--input-bg, #ffffff);
  color: var(--text-primary, #111827);
}

.form-group input:disabled {
  background: var(--disabled-bg, #f3f4f6);
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}
</style>
