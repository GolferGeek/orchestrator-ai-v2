<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div v-if="isOpen" class="modal-backdrop" @click="$emit('close')"></div>
    </Transition>

    <!-- Modal -->
    <Transition name="scale">
      <div v-if="isOpen" class="modal-container">
        <div class="modal">
          <header class="modal-header">
            <h2>Create New Risk Scope</h2>
            <button class="close-btn" @click="$emit('close')">&times;</button>
          </header>

          <form @submit.prevent="handleSubmit" class="modal-body">
            <!-- Basic Info -->
            <section class="form-section">
              <h3>Basic Information</h3>

              <div class="form-group">
                <label for="name">Scope Name *</label>
                <input
                  id="name"
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="e.g., Crypto Risk Analysis"
                />
              </div>

              <div class="form-group">
                <label for="domain">Domain *</label>
                <input
                  id="domain"
                  v-model="form.domain"
                  type="text"
                  required
                  placeholder="e.g., crypto, realestate, fixedincome"
                />
                <span class="help-text">Short identifier for this risk domain</span>
              </div>

              <div class="form-group">
                <label for="description">Description</label>
                <textarea
                  id="description"
                  v-model="form.description"
                  rows="3"
                  placeholder="Describe what this scope analyzes..."
                ></textarea>
              </div>
            </section>

            <!-- Thresholds -->
            <section class="form-section">
              <h3>Alert Thresholds</h3>

              <div class="form-row">
                <div class="form-group">
                  <label for="alertThreshold">Alert Threshold (%)</label>
                  <input
                    id="alertThreshold"
                    v-model.number="form.alertThreshold"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="60"
                  />
                  <span class="help-text">Trigger alerts above this score</span>
                </div>

                <div class="form-group">
                  <label for="debateThreshold">Debate Threshold (%)</label>
                  <input
                    id="debateThreshold"
                    v-model.number="form.debateThreshold"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="70"
                  />
                  <span class="help-text">Trigger Red/Blue debate above this</span>
                </div>

                <div class="form-group">
                  <label for="staleDays">Stale Days</label>
                  <input
                    id="staleDays"
                    v-model.number="form.staleDays"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="7"
                  />
                  <span class="help-text">Days until assessment is stale</span>
                </div>
              </div>
            </section>

            <!-- Features -->
            <section class="form-section">
              <h3>Features</h3>

              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input v-model="form.enableRiskRadar" type="checkbox" />
                  <span>Enable Risk Radar (dimension analysis)</span>
                </label>

                <label class="checkbox-label">
                  <input v-model="form.enableDebate" type="checkbox" />
                  <span>Enable Red/Blue Team Debate</span>
                </label>

                <label class="checkbox-label">
                  <input v-model="form.enableLearning" type="checkbox" />
                  <span>Enable Learning System</span>
                </label>
              </div>
            </section>

            <!-- Error -->
            <div v-if="error" class="error-message">
              {{ error }}
            </div>
          </form>

          <footer class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting || !isValid"
              @click="handleSubmit"
            >
              <span v-if="isSubmitting" class="spinner-small"></span>
              {{ isSubmitting ? 'Creating...' : 'Create Scope' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  create: [params: {
    name: string;
    domain: string;
    description?: string;
    thresholdConfig?: { alertThreshold: number; debateThreshold: number; staleDays: number };
    analysisConfig?: { riskRadar: { enabled: boolean }; debate: { enabled: boolean }; learning: { enabled: boolean } };
  }];
}>();

// Form state
const form = ref({
  name: '',
  domain: '',
  description: '',
  alertThreshold: 60,
  debateThreshold: 70,
  staleDays: 7,
  enableRiskRadar: true,
  enableDebate: true,
  enableLearning: true,
});

const isSubmitting = ref(false);
const error = ref<string | null>(null);

const isValid = computed(() => {
  return form.value.name.trim() !== '' && form.value.domain.trim() !== '';
});

// Reset form when modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    form.value = {
      name: '',
      domain: '',
      description: '',
      alertThreshold: 60,
      debateThreshold: 70,
      staleDays: 7,
      enableRiskRadar: true,
      enableDebate: true,
      enableLearning: true,
    };
    error.value = null;
  }
});

function handleSubmit() {
  if (!isValid.value || isSubmitting.value) return;

  error.value = null;
  isSubmitting.value = true;

  const params = {
    name: form.value.name.trim(),
    domain: form.value.domain.trim().toLowerCase().replace(/\s+/g, '-'),
    description: form.value.description.trim() || undefined,
    thresholdConfig: {
      alertThreshold: form.value.alertThreshold / 100,
      debateThreshold: form.value.debateThreshold / 100,
      staleDays: form.value.staleDays,
    },
    analysisConfig: {
      riskRadar: { enabled: form.value.enableRiskRadar },
      debate: { enabled: form.value.enableDebate },
      learning: { enabled: form.value.enableLearning },
    },
  };

  emit('create', params);
  isSubmitting.value = false;
}

// Expose method to set error from parent
defineExpose({
  setError: (msg: string) => {
    error.value = msg;
    isSubmitting.value = false;
  },
  setSubmitting: (val: boolean) => {
    isSubmitting.value = val;
  },
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.modal-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: 1rem;
}

.modal {
  background: var(--modal-bg, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary, #111827);
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #111827);
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  background: var(--input-bg, #ffffff);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color, #a87c4f);
  box-shadow: 0 0 0 3px rgba(168, 124, 79, 0.1);
}

.form-group textarea {
  resize: vertical;
}

.help-text {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin-top: 0.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

@media (max-width: 560px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-top: 1rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover, #e5e7eb);
}

.btn-primary {
  background: var(--primary-color, #a87c4f);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-color-dark, #8f693f);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .modal {
    --modal-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --input-bg: #374151;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
  }

  .error-message {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
  }
}
</style>
