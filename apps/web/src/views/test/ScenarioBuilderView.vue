<script setup lang="ts">
/**
 * ScenarioBuilderView (SCR-005)
 *
 * Wizard-style scenario builder for creating new test scenarios.
 * Steps: Basic Info → Select Targets → Add Articles → Add Prices → Review
 */

import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import TestModeIndicator from '@/components/test/TestModeIndicator.vue';
import TestSymbolBadge from '@/components/test/TestSymbolBadge.vue';
import CreateScenarioFromSourceModal from '@/components/test/CreateScenarioFromSourceModal.vue';
import { predictionDashboardService } from '@/services/predictionDashboardService';
import type { PredictionTarget, InjectionPoint } from '@/services/predictionDashboardService';
import { useTestTargetMirrorStore } from '@/stores/testTargetMirrorStore';

const router = useRouter();
const mirrorStore = useTestTargetMirrorStore();

// Modal state
const showCreateFromSourceModal = ref(false);

// Wizard state
const currentStep = ref(1);
const totalSteps = 5;

// Loading/saving
const isLoading = ref(true);
const isSaving = ref(false);
const error = ref<string | null>(null);

// Available targets
const availableTargets = ref<PredictionTarget[]>([]);

// Form data
const scenarioData = ref({
  name: '',
  description: '',
  injectionPoints: ['signals', 'predictors', 'predictions'] as InjectionPoint[],
  targetIds: [] as string[],
  config: {
    auto_run_tiers: false,
    tiers_to_run: [] as string[],
  },
});

// Step validation
const stepValid = computed(() => {
  switch (currentStep.value) {
    case 1: // Basic Info
      return scenarioData.value.name.trim().length >= 3;
    case 2: // Select Targets
      return scenarioData.value.targetIds.length > 0;
    case 3: // Articles (optional, always valid)
    case 4: // Prices (optional, always valid)
      return true;
    case 5: // Review
      return true;
    default:
      return false;
  }
});

// Available injection points
const injectionPointOptions: { value: InjectionPoint; label: string }[] = [
  { value: 'signals', label: 'Signals' },
  { value: 'predictors', label: 'Predictors' },
  { value: 'predictions', label: 'Predictions' },
  { value: 'source_crawls', label: 'Source Crawls' },
  { value: 'analysts', label: 'Analysts' },
  { value: 'learnings', label: 'Learnings' },
];

// Selected targets with details
const selectedTargets = computed(() =>
  availableTargets.value.filter((t) => scenarioData.value.targetIds.includes(t.id))
);

// Load data
async function loadData() {
  isLoading.value = true;
  error.value = null;

  try {
    // Load targets
    const targetsRes = await predictionDashboardService.listTargets();
    if (targetsRes.content) {
      availableTargets.value = targetsRes.content;
    }

    // Load mirrors
    if (mirrorStore.mirrors.length === 0) {
      const mirrorsRes = await predictionDashboardService.listTestTargetMirrors({
        includeTargetDetails: true,
      });
      if (mirrorsRes.content) {
        mirrorStore.setMirrors(mirrorsRes.content);
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
  } finally {
    isLoading.value = false;
  }
}

// Navigation
function nextStep() {
  if (stepValid.value && currentStep.value < totalSteps) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function goToStep(step: number) {
  if (step >= 1 && step <= totalSteps) {
    currentStep.value = step;
  }
}

// Target selection
function toggleTarget(targetId: string) {
  const idx = scenarioData.value.targetIds.indexOf(targetId);
  if (idx >= 0) {
    scenarioData.value.targetIds.splice(idx, 1);
  } else {
    scenarioData.value.targetIds.push(targetId);
  }
}

function isTargetSelected(targetId: string): boolean {
  return scenarioData.value.targetIds.includes(targetId);
}

// Get test symbol for target
function getTestSymbol(targetId: string): string | undefined {
  return mirrorStore.getTestSymbolForTarget(targetId);
}

// Injection point toggle
function toggleInjectionPoint(point: InjectionPoint) {
  const idx = scenarioData.value.injectionPoints.indexOf(point);
  if (idx >= 0) {
    scenarioData.value.injectionPoints.splice(idx, 1);
  } else {
    scenarioData.value.injectionPoints.push(point);
  }
}

// Create scenario
async function createScenario() {
  if (!stepValid.value) return;

  isSaving.value = true;
  error.value = null;

  try {
    // Create the scenario
    const result = await predictionDashboardService.createTestScenario({
      name: scenarioData.value.name,
      description: scenarioData.value.description || undefined,
      injection_points: scenarioData.value.injectionPoints,
      target_id: scenarioData.value.targetIds[0], // Primary target
      config: scenarioData.value.config,
    });

    if (result.content) {
      // Ensure mirrors exist for selected targets
      for (const targetId of scenarioData.value.targetIds) {
        if (!mirrorStore.hasProductionTargetMirror(targetId)) {
          await predictionDashboardService.ensureTestTargetMirror({
            productionTargetId: targetId,
          });
        }
      }

      // Navigate to test lab with new scenario
      router.push(`/app/prediction/test-lab?scenario=${result.content.id}`);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create scenario';
  } finally {
    isSaving.value = false;
  }
}

// Skip to existing tools
function goToArticles() {
  router.push('/app/test/articles');
}

function goToPrices() {
  router.push('/app/test/prices');
}

// Handle scenario created from source
function onScenarioCreated(scenarioId: string) {
  router.push(`/app/prediction/test-lab?scenario=${scenarioId}`);
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="scenario-builder">
    <TestModeIndicator message="Scenario Builder" />

    <div class="scenario-builder__content">
      <!-- Header -->
      <header class="scenario-builder__header">
        <div>
          <h1 class="scenario-builder__title">Create Test Scenario</h1>
          <p class="scenario-builder__subtitle">
            Build a test scenario with guided workflow
          </p>
        </div>
        <button
          class="btn btn--secondary btn--with-icon"
          @click="showCreateFromSourceModal = true"
        >
          <span class="btn-icon">⚡</span>
          Create from Real Event
        </button>
      </header>

      <!-- Error -->
      <div v-if="error" class="scenario-builder__error">
        <p>{{ error }}</p>
        <button @click="error = null">Dismiss</button>
      </div>

      <!-- Progress -->
      <div class="progress-bar">
        <div
          v-for="step in totalSteps"
          :key="step"
          :class="[
            'progress-step',
            { 'progress-step--active': currentStep === step },
            { 'progress-step--completed': currentStep > step },
          ]"
          @click="goToStep(step)"
        >
          <div class="progress-step__number">{{ step }}</div>
          <div class="progress-step__label">
            {{ ['Basic Info', 'Targets', 'Articles', 'Prices', 'Review'][step - 1] }}
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="scenario-builder__loading">
        <div class="spinner" />
        <p>Loading...</p>
      </div>

      <!-- Steps -->
      <div v-else class="step-content">
        <!-- Step 1: Basic Info -->
        <div v-if="currentStep === 1" class="step">
          <h2>Basic Information</h2>
          <p class="step__description">Give your test scenario a name and description.</p>

          <div class="form-group">
            <label>Scenario Name *</label>
            <input
              v-model="scenarioData.name"
              type="text"
              placeholder="e.g., AAPL Bullish Signal Test"
              maxlength="100"
            />
            <span class="form-hint">Minimum 3 characters</span>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="scenarioData.description"
              placeholder="Describe what this scenario tests..."
              rows="3"
            />
          </div>

          <div class="form-group">
            <label>Injection Points</label>
            <p class="form-hint">Select which data types this scenario will test</p>
            <div class="checkbox-grid">
              <label
                v-for="option in injectionPointOptions"
                :key="option.value"
                class="checkbox-item"
              >
                <input
                  type="checkbox"
                  :checked="scenarioData.injectionPoints.includes(option.value)"
                  @change="toggleInjectionPoint(option.value)"
                />
                {{ option.label }}
              </label>
            </div>
          </div>
        </div>

        <!-- Step 2: Select Targets -->
        <div v-if="currentStep === 2" class="step">
          <h2>Select Targets</h2>
          <p class="step__description">Choose which targets to include in this test scenario.</p>

          <div class="targets-grid">
            <div
              v-for="target in availableTargets"
              :key="target.id"
              :class="['target-card', { 'target-card--selected': isTargetSelected(target.id) }]"
              @click="toggleTarget(target.id)"
            >
              <div class="target-card__header">
                <span class="target-card__name">{{ target.name }}</span>
                <code class="target-card__symbol">{{ target.symbol }}</code>
              </div>
              <div class="target-card__meta">
                <span>{{ target.targetType }}</span>
              </div>
              <div v-if="getTestSymbol(target.id)" class="target-card__mirror">
                <TestSymbolBadge :test-symbol="getTestSymbol(target.id)!" size="sm" />
              </div>
              <div v-else class="target-card__no-mirror">
                No mirror (will be created)
              </div>
            </div>
          </div>

          <div v-if="availableTargets.length === 0" class="empty-state">
            No targets available. Create targets in the Prediction dashboard first.
          </div>
        </div>

        <!-- Step 3: Articles (optional) -->
        <div v-if="currentStep === 3" class="step">
          <h2>Test Articles</h2>
          <p class="step__description">
            Optionally, add synthetic articles now or later from the Articles Library.
          </p>

          <div class="optional-step">
            <div class="optional-step__info">
              <h3>You can add articles later</h3>
              <p>
                After creating the scenario, you can add synthetic articles from the
                Synthetic Articles Library. Each article will be associated with your
                scenario and processed during test runs.
              </p>
            </div>

            <button class="btn btn--secondary" @click="goToArticles">
              Go to Articles Library
            </button>
          </div>

          <div class="selected-summary">
            <h4>Selected Targets ({{ selectedTargets.length }})</h4>
            <div class="selected-targets">
              <div v-for="target in selectedTargets" :key="target.id" class="selected-target">
                <span>{{ target.name }}</span>
                <code>{{ target.symbol }}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Prices (optional) -->
        <div v-if="currentStep === 4" class="step">
          <h2>Test Price Data</h2>
          <p class="step__description">
            Optionally, add price data now or later from the Price Timeline.
          </p>

          <div class="optional-step">
            <div class="optional-step__info">
              <h3>You can add price data later</h3>
              <p>
                After creating the scenario, you can add OHLCV price data from the
                Price Timeline view. You can generate random timelines or enter
                specific prices for outcome evaluation.
              </p>
            </div>

            <button class="btn btn--secondary" @click="goToPrices">
              Go to Price Timeline
            </button>
          </div>
        </div>

        <!-- Step 5: Review -->
        <div v-if="currentStep === 5" class="step">
          <h2>Review & Create</h2>
          <p class="step__description">Review your scenario configuration before creating.</p>

          <div class="review-section">
            <h3>Basic Info</h3>
            <dl class="review-list">
              <dt>Name</dt>
              <dd>{{ scenarioData.name }}</dd>
              <dt>Description</dt>
              <dd>{{ scenarioData.description || '(none)' }}</dd>
              <dt>Injection Points</dt>
              <dd>{{ scenarioData.injectionPoints.join(', ') }}</dd>
            </dl>
          </div>

          <div class="review-section">
            <h3>Targets ({{ selectedTargets.length }})</h3>
            <div class="review-targets">
              <div v-for="target in selectedTargets" :key="target.id" class="review-target">
                <span class="review-target__name">{{ target.name }}</span>
                <code class="review-target__symbol">{{ target.symbol }}</code>
                <span class="review-target__arrow">→</span>
                <TestSymbolBadge
                  v-if="getTestSymbol(target.id)"
                  :test-symbol="getTestSymbol(target.id)!"
                  size="sm"
                />
                <span v-else class="review-target__new">T_{{ target.symbol }} (new)</span>
              </div>
            </div>
          </div>

          <div class="review-note">
            <strong>Note:</strong> After creating the scenario, you can add test articles
            and price data from the respective management screens.
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="step-navigation">
        <button
          v-if="currentStep > 1"
          class="btn btn--secondary"
          @click="prevStep"
        >
          Previous
        </button>
        <div class="step-navigation__spacer" />
        <button
          v-if="currentStep < totalSteps"
          class="btn btn--primary"
          :disabled="!stepValid"
          @click="nextStep"
        >
          Next
        </button>
        <button
          v-if="currentStep === totalSteps"
          class="btn btn--primary"
          :disabled="!stepValid || isSaving"
          @click="createScenario"
        >
          {{ isSaving ? 'Creating...' : 'Create Scenario' }}
        </button>
      </div>
    </div>

    <!-- Create from Source Modal -->
    <CreateScenarioFromSourceModal
      v-model="showCreateFromSourceModal"
      @created="onScenarioCreated"
    />
  </div>
</template>

<style scoped>
.scenario-builder {
  min-height: 100vh;
  background: #f9fafb;
}

.scenario-builder__content {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.scenario-builder__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 2rem;
}

.scenario-builder__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.scenario-builder__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}

.scenario-builder__error {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scenario-builder__loading {
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

/* Progress Bar */
.progress-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.progress-step--active,
.progress-step--completed {
  opacity: 1;
}

.progress-step__number {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;
  background: #e5e7eb;
  color: #6b7280;
}

.progress-step--active .progress-step__number {
  background: #2563eb;
  color: white;
}

.progress-step--completed .progress-step__number {
  background: #059669;
  color: white;
}

.progress-step__label {
  font-size: 0.75rem;
  color: #6b7280;
}

/* Step Content */
.step-content {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.step h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem;
}

.step__description {
  color: #6b7280;
  margin: 0 0 1.5rem;
}

/* Form */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.form-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

/* Targets Grid */
.targets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.target-card {
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.target-card:hover {
  border-color: #d1d5db;
}

.target-card--selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.target-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.target-card__name {
  font-weight: 600;
  color: #111827;
}

.target-card__symbol {
  font-size: 0.75rem;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.target-card__meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.target-card__no-mirror {
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

/* Optional Step */
.optional-step {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  text-align: center;
}

.optional-step__info h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.optional-step__info p {
  color: #6b7280;
  margin: 0 0 1rem;
}

.selected-summary {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.selected-summary h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
}

.selected-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.selected-target {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #f3f4f6;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

/* Review */
.review-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.review-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.review-list {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 0.5rem;
}

.review-list dt {
  font-weight: 500;
  color: #6b7280;
}

.review-list dd {
  margin: 0;
  color: #111827;
}

.review-targets {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.review-target {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.review-target__name {
  font-weight: 500;
}

.review-target__symbol {
  font-size: 0.75rem;
  background: #e5e7eb;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.review-target__arrow {
  color: #9ca3af;
}

.review-target__new {
  font-size: 0.75rem;
  color: #059669;
  font-style: italic;
}

.review-note {
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #92400e;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
}

/* Navigation */
.step-navigation {
  display: flex;
  align-items: center;
}

.step-navigation__spacer {
  flex: 1;
}

/* Buttons */
.btn {
  padding: 0.625rem 1.25rem;
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--with-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.btn-icon {
  font-size: 1rem;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .scenario-builder {
    background: #111827;
  }

  .scenario-builder__title,
  .step h2 {
    color: #f9fafb;
  }

  .step-content {
    background: #1f2937;
  }

  .target-card {
    border-color: #4b5563;
  }

  .target-card--selected {
    background: rgba(37, 99, 235, 0.2);
  }

  .target-card__name,
  .review-list dd {
    color: #f9fafb;
  }

  .optional-step {
    background: #374151;
  }

  .btn--secondary {
    background: #1f2937;
    color: #e5e7eb;
    border-color: #4b5563;
  }
}
</style>
