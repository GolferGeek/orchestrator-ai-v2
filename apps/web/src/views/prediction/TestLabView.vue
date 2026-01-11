<template>
  <div class="test-lab">
    <header class="management-header">
      <h1>Test Lab</h1>
      <div class="header-actions">
        <input
          ref="importInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleImportFile"
        />
        <button class="btn btn-secondary" @click="triggerImport">
          Import JSON
        </button>
        <button class="btn btn-primary" @click="openCreateModal">
          + New Scenario
        </button>
      </div>
    </header>

    <!-- Stats Banner -->
    <div class="stats-banner">
      <div class="stat-item">
        <span class="stat-value">{{ scenarios.length }}</span>
        <span class="stat-label">Total Scenarios</span>
      </div>
      <div class="stat-item active">
        <span class="stat-value">{{ activeScenarios.length }}</span>
        <span class="stat-label">Active</span>
      </div>
      <div class="stat-item running">
        <span class="stat-value">{{ runningScenarios.length }}</span>
        <span class="stat-label">Running</span>
      </div>
      <div class="stat-item completed">
        <span class="stat-value">{{ completedScenarios.length }}</span>
        <span class="stat-label">Completed</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{{ totalTestData }}</span>
        <span class="stat-label">Test Records</span>
      </div>
    </div>

    <!-- Guided Workflows Section (Phase 4.5) -->
    <div class="guided-workflows">
      <h3>Quick Start Templates</h3>
      <div class="workflow-cards">
        <div
          v-for="workflow in guidedWorkflows"
          :key="workflow.id"
          class="workflow-card"
          @click="applyWorkflow(workflow)"
        >
          <span class="workflow-icon">{{ workflow.icon }}</span>
          <h4>{{ workflow.name }}</h4>
          <p>{{ workflow.description }}</p>
          <span class="workflow-badge">{{ workflow.dataCount }} items</span>
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button
        class="filter-tab"
        :class="{ active: selectedStatus === 'all' }"
        @click="selectedStatus = 'all'"
      >
        All
      </button>
      <button
        v-for="status in statuses"
        :key="status"
        class="filter-tab"
        :class="{ active: selectedStatus === status }"
        @click="selectedStatus = status"
      >
        {{ formatStatus(status) }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading test scenarios...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
      <button class="btn btn-secondary" @click="loadScenarios">Try Again</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredScenarios.length === 0" class="empty-state">
      <span class="empty-icon">&#128300;</span>
      <h3>No Test Scenarios</h3>
      <p>Create a new test scenario to start injecting test data into the prediction pipeline.</p>
      <button class="btn btn-primary" @click="openCreateModal">Create First Scenario</button>
    </div>

    <!-- Scenarios Grid -->
    <div v-else class="scenarios-grid">
      <div
        v-for="scenario in filteredScenarios"
        :key="scenario.id"
        class="scenario-card"
        :class="{ selected: selectedScenarioId === scenario.id }"
        @click="selectScenario(scenario.id)"
      >
        <div class="scenario-header">
          <h3>{{ scenario.name }}</h3>
          <span class="status-badge" :class="scenario.status">
            {{ formatStatus(scenario.status) }}
          </span>
        </div>
        <p class="scenario-description">{{ scenario.description || 'No description' }}</p>
        <div class="scenario-meta">
          <span class="injection-points">
            {{ scenario.injection_points?.length || 0 }} injection points
          </span>
          <span class="data-count">
            {{ getTotalDataCount(scenario) }} records
          </span>
        </div>
        <div class="scenario-actions">
          <button class="btn btn-sm btn-secondary" @click.stop="viewScenario(scenario)">
            View
          </button>
          <button
            class="btn btn-sm btn-primary"
            @click.stop="openGenerateModal(scenario)"
            :disabled="scenario.status !== 'active'"
          >
            Generate
          </button>
          <button
            class="btn btn-sm btn-secondary"
            @click.stop="exportScenario(scenario)"
            title="Export as JSON"
          >
            Export
          </button>
          <button
            class="btn btn-sm btn-warning"
            @click.stop="confirmCleanup(scenario)"
          >
            Cleanup
          </button>
          <button class="btn btn-sm btn-danger" @click.stop="confirmDelete(scenario)">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Create Scenario Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <header class="modal-header">
          <h2>Create Test Scenario</h2>
          <button class="close-btn" @click="closeCreateModal">&times;</button>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label for="scenario-name">Name</label>
            <input
              id="scenario-name"
              v-model="newScenario.name"
              type="text"
              placeholder="e.g., Fed Rate Hike Test"
            />
          </div>

          <div class="form-group">
            <label for="scenario-description">Description</label>
            <textarea
              id="scenario-description"
              v-model="newScenario.description"
              placeholder="Describe what this test scenario is for..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Injection Points</label>
            <div class="checkbox-grid">
              <label
                v-for="point in injectionPoints"
                :key="point"
                class="checkbox-item"
              >
                <input
                  type="checkbox"
                  :value="point"
                  v-model="newScenario.injection_points"
                />
                <span>{{ formatInjectionPoint(point) }}</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="target-select">Target (Optional)</label>
            <select id="target-select" v-model="newScenario.target_id">
              <option value="">No specific target</option>
              <option v-for="target in targets" :key="target.id" :value="target.id">
                {{ target.name }} ({{ target.symbol }})
              </option>
            </select>
          </div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" @click="closeCreateModal">Cancel</button>
          <button
            class="btn btn-primary"
            @click="createScenario"
            :disabled="!canCreate"
          >
            Create Scenario
          </button>
        </footer>
      </div>
    </div>

    <!-- Generate Data Modal -->
    <div v-if="showGenerateModal" class="modal-overlay" @click.self="closeGenerateModal">
      <div class="modal-content">
        <header class="modal-header">
          <h2>Generate Test Data</h2>
          <button class="close-btn" @click="closeGenerateModal">&times;</button>
        </header>

        <div class="modal-body">
          <p class="scenario-context">
            Generating for: <strong>{{ generatingScenario?.name }}</strong>
          </p>

          <div class="form-group">
            <label>Data Type</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" value="signals" v-model="generateConfig.type" />
                <span>Signals</span>
              </label>
              <label class="radio-item">
                <input type="radio" value="predictions" v-model="generateConfig.type" />
                <span>Predictions</span>
              </label>
              <label class="radio-item">
                <input type="radio" value="articles" v-model="generateConfig.type" />
                <span>Articles</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label for="generate-count">Count</label>
            <input
              id="generate-count"
              type="number"
              v-model.number="generateConfig.count"
              min="1"
              max="100"
            />
          </div>

          <div v-if="generateConfig.type === 'signals'" class="form-group">
            <label>Sentiment Distribution</label>
            <div class="distribution-inputs">
              <div class="distribution-item">
                <label>Bullish</label>
                <input
                  type="number"
                  v-model.number="generateConfig.distribution.bullish"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>
              <div class="distribution-item">
                <label>Bearish</label>
                <input
                  type="number"
                  v-model.number="generateConfig.distribution.bearish"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>
              <div class="distribution-item">
                <label>Neutral</label>
                <input
                  type="number"
                  v-model.number="generateConfig.distribution.neutral"
                  min="0"
                  max="1"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div v-if="generateConfig.type === 'predictions'" class="form-group">
            <label for="accuracy-rate">Accuracy Rate (0-1)</label>
            <input
              id="accuracy-rate"
              type="number"
              v-model.number="generateConfig.accuracy_rate"
              min="0"
              max="1"
              step="0.05"
            />
          </div>

          <div v-if="generateConfig.type === 'articles'" class="form-group">
            <label for="topic">Topic</label>
            <input
              id="topic"
              type="text"
              v-model="generateConfig.topic"
              placeholder="e.g., Bitcoin, Apple earnings"
            />
          </div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn-secondary" @click="closeGenerateModal">Cancel</button>
          <button
            class="btn btn-primary"
            @click="generateData"
            :disabled="isExecuting"
          >
            {{ isExecuting ? 'Generating...' : 'Generate' }}
          </button>
        </footer>
      </div>
    </div>

    <!-- Tier Runner Panel (when scenario selected) -->
    <div v-if="selectedScenario" class="tier-runner-panel">
      <h3>Run Pipeline Tiers</h3>
      <p class="panel-description">
        Execute prediction pipeline tiers against test data in "{{ selectedScenario.name }}"
      </p>
      <div class="tier-buttons">
        <button
          class="btn btn-tier"
          @click="runTier('signal-detection')"
          :disabled="isRunningTier"
        >
          Signal Detection
        </button>
        <button
          class="btn btn-tier"
          @click="runTier('prediction-generation')"
          :disabled="isRunningTier"
        >
          Prediction Generation
        </button>
        <button
          class="btn btn-tier"
          @click="runTier('evaluation')"
          :disabled="isRunningTier"
        >
          Evaluation
        </button>
      </div>
      <div v-if="lastTierResult" class="tier-result" :class="{ success: lastTierResult.success, error: !lastTierResult.success }">
        <strong>{{ lastTierResult.tier }}</strong>:
        {{ lastTierResult.success ? 'Success' : 'Failed' }} -
        {{ lastTierResult.items_processed }} processed,
        {{ lastTierResult.items_created }} created
        <span v-if="lastTierResult.errors?.length">({{ lastTierResult.errors.length }} errors)</span>
      </div>
    </div>

    <!-- Live Monitor Panel (Phase 4.7) -->
    <div class="live-monitor-panel" :class="{ expanded: liveMonitorEnabled }">
      <div class="monitor-header" @click="toggleLiveMonitor">
        <h3>
          <span class="monitor-indicator" :class="{ active: liveMonitorEnabled }"></span>
          Live Monitor
        </h3>
        <span class="toggle-icon">{{ liveMonitorEnabled ? '▼' : '▲' }}</span>
      </div>
      <div v-if="liveMonitorEnabled" class="monitor-content">
        <div class="monitor-controls">
          <button class="btn btn-sm btn-secondary" @click="clearLiveMonitor">
            Clear
          </button>
          <span class="event-count">{{ liveMonitorEvents.length }} events</span>
        </div>
        <div class="monitor-events">
          <div
            v-for="event in liveMonitorEvents"
            :key="event.id"
            class="monitor-event"
            :class="event.type"
          >
            <span class="event-time">{{ formatEventTime(event.timestamp) }}</span>
            <span class="event-type-badge">{{ event.type }}</span>
            <span class="event-message">{{ event.message }}</span>
          </div>
          <div v-if="liveMonitorEvents.length === 0" class="no-events">
            No events recorded yet. Events will appear here when running tier operations.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTestScenarioStore } from '@/stores/testScenarioStore';
import { usePredictionStore } from '@/stores/predictionStore';
import {
  predictionDashboardService,
  type TestScenarioSummary,
  type InjectionPoint,
  type TestScenarioStatus,
  type TestScenarioExport,
} from '@/services/predictionDashboardService';

const store = useTestScenarioStore();
const predictionStore = usePredictionStore();

// State
const showCreateModal = ref(false);
const showGenerateModal = ref(false);
const selectedStatus = ref<TestScenarioStatus | 'all'>('all');
const generatingScenario = ref<TestScenarioSummary | null>(null);
const importInput = ref<HTMLInputElement | null>(null);

const newScenario = ref({
  name: '',
  description: '',
  injection_points: ['signals', 'predictors'] as InjectionPoint[],
  target_id: '',
});

const generateConfig = ref({
  type: 'signals' as 'signals' | 'predictions' | 'articles',
  count: 10,
  distribution: { bullish: 0.4, bearish: 0.4, neutral: 0.2 },
  accuracy_rate: 0.7,
  topic: '',
});

const statuses: TestScenarioStatus[] = ['active', 'running', 'completed', 'failed', 'archived'];

const injectionPoints: InjectionPoint[] = [
  'signals',
  'predictors',
  'predictions',
  'evaluations',
  'analysts',
  'learnings',
  'learning_queue',
  'sources',
];

// Guided Workflows (Phase 4.5)
interface GuidedWorkflow {
  id: string;
  name: string;
  description: string;
  icon: string;
  dataCount: number;
  injection_points: InjectionPoint[];
  config: {
    generateType?: 'signals' | 'predictions' | 'articles';
    count?: number;
    distribution?: { bullish: number; bearish: number; neutral: number };
    accuracy_rate?: number;
  };
}

const guidedWorkflows: GuidedWorkflow[] = [
  {
    id: 'bullish-signals',
    name: 'Bullish Signal Flood',
    description: 'Generate a batch of bullish signals to test positive prediction flow',
    icon: '📈',
    dataCount: 20,
    injection_points: ['signals', 'predictors', 'predictions'],
    config: {
      generateType: 'signals',
      count: 20,
      distribution: { bullish: 0.8, bearish: 0.1, neutral: 0.1 },
    },
  },
  {
    id: 'bearish-signals',
    name: 'Bearish Signal Test',
    description: 'Generate bearish signals to test negative prediction handling',
    icon: '📉',
    dataCount: 20,
    injection_points: ['signals', 'predictors', 'predictions'],
    config: {
      generateType: 'signals',
      count: 20,
      distribution: { bullish: 0.1, bearish: 0.8, neutral: 0.1 },
    },
  },
  {
    id: 'mixed-signals',
    name: 'Mixed Signal Chaos',
    description: 'Generate diverse signals to test consensus detection',
    icon: '🎲',
    dataCount: 30,
    injection_points: ['signals', 'predictors', 'predictions'],
    config: {
      generateType: 'signals',
      count: 30,
      distribution: { bullish: 0.33, bearish: 0.33, neutral: 0.34 },
    },
  },
  {
    id: 'accuracy-test',
    name: 'Accuracy Evaluation',
    description: 'Generate predictions with known outcomes for accuracy testing',
    icon: '🎯',
    dataCount: 15,
    injection_points: ['predictions', 'evaluations'],
    config: {
      generateType: 'predictions',
      count: 15,
      accuracy_rate: 0.7,
    },
  },
];

// Computed
const scenarios = computed(() => store.scenarios);
const selectedScenarioId = computed(() => store.selectedScenarioId);
const selectedScenario = computed(() => store.selectedScenario);
const activeScenarios = computed(() => store.activeScenarios);
const runningScenarios = computed(() => store.runningScenarios);
const completedScenarios = computed(() => store.completedScenarios);
const totalTestData = computed(() => store.totalTestData);
const isLoading = computed(() => store.isLoading);
const isExecuting = computed(() => store.isExecuting);
const isRunningTier = computed(() => store.isRunningTier);
const error = computed(() => store.error);
const lastTierResult = computed(() => store.lastTierResult);
const targets = computed(() => predictionStore.targets);

// Live Monitor (Phase 4.7)
const liveMonitorEvents = computed(() => store.liveMonitorEvents);
const liveMonitorEnabled = computed(() => store.liveMonitorEnabled);

const filteredScenarios = computed(() => {
  if (selectedStatus.value === 'all') {
    return scenarios.value;
  }
  return scenarios.value.filter((s) => s.status === selectedStatus.value);
});

const canCreate = computed(() => {
  return (
    newScenario.value.name.trim() !== '' &&
    newScenario.value.injection_points.length > 0
  );
});

// Methods
function formatStatus(status: TestScenarioStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatInjectionPoint(point: InjectionPoint): string {
  return point
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getTotalDataCount(scenario: TestScenarioSummary): number {
  if (!scenario.data_counts) return 0;
  return Object.values(scenario.data_counts).reduce((sum, count) => sum + (count || 0), 0);
}

function openCreateModal() {
  newScenario.value = {
    name: '',
    description: '',
    injection_points: ['signals', 'predictors'],
    target_id: '',
  };
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
}

function openGenerateModal(scenario: TestScenarioSummary) {
  generatingScenario.value = scenario;
  generateConfig.value = {
    type: 'signals',
    count: 10,
    distribution: { bullish: 0.4, bearish: 0.4, neutral: 0.2 },
    accuracy_rate: 0.7,
    topic: '',
  };
  showGenerateModal.value = true;
}

function closeGenerateModal() {
  showGenerateModal.value = false;
  generatingScenario.value = null;
}

function selectScenario(id: string) {
  store.selectScenario(store.selectedScenarioId === id ? null : id);
}

async function loadScenarios() {
  store.setLoading(true);
  store.clearError();
  try {
    const response = await predictionDashboardService.getTestScenarioSummaries();
    store.setScenarios(response.content || []);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to load scenarios');
  } finally {
    store.setLoading(false);
  }
}

async function createScenario() {
  store.setExecuting(true);
  try {
    const response = await predictionDashboardService.createTestScenario({
      name: newScenario.value.name,
      description: newScenario.value.description || undefined,
      injection_points: newScenario.value.injection_points,
      target_id: newScenario.value.target_id || undefined,
    });
    if (response.content) {
      store.addScenario({ ...response.content, data_counts: {} });
    }
    closeCreateModal();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to create scenario');
  } finally {
    store.setExecuting(false);
  }
}

function viewScenario(scenario: TestScenarioSummary) {
  store.selectScenario(scenario.id);
  store.setCurrentScenario(scenario);
}

async function generateData() {
  if (!generatingScenario.value) return;

  store.setExecuting(true);
  try {
    await predictionDashboardService.generateTestData({
      scenarioId: generatingScenario.value.id,
      type: generateConfig.value.type,
      config: {
        count: generateConfig.value.count,
        target_id: generatingScenario.value.target_id || undefined,
        distribution: generateConfig.value.type === 'signals' ? generateConfig.value.distribution : undefined,
        accuracy_rate: generateConfig.value.type === 'predictions' ? generateConfig.value.accuracy_rate : undefined,
        topic: generateConfig.value.type === 'articles' ? generateConfig.value.topic : undefined,
      },
    });
    closeGenerateModal();
    await loadScenarios(); // Refresh to get updated counts
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to generate test data');
  } finally {
    store.setExecuting(false);
  }
}

async function runTier(tier: 'signal-detection' | 'prediction-generation' | 'evaluation') {
  if (!selectedScenarioId.value) return;

  store.setRunningTier(true);
  store.clearLastTierResult();
  try {
    const response = await predictionDashboardService.runTestTier({
      scenarioId: selectedScenarioId.value,
      tier,
    });
    if (response.content) {
      store.setLastTierResult({
        tier: response.content.tier,
        success: response.content.success,
        itemsProcessed: response.content.items_processed,
        itemsCreated: response.content.items_created,
        errors: response.content.errors,
      });
    }
    await loadScenarios(); // Refresh counts
  } catch (err) {
    store.setLastTierResult({
      tier,
      success: false,
      itemsProcessed: 0,
      itemsCreated: 0,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    });
  } finally {
    store.setRunningTier(false);
  }
}

async function confirmCleanup(scenario: TestScenarioSummary) {
  if (!confirm(`Are you sure you want to clean up all test data for "${scenario.name}"?`)) {
    return;
  }

  store.setExecuting(true);
  try {
    await predictionDashboardService.cleanupTestData({ scenarioId: scenario.id });
    await loadScenarios();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to cleanup test data');
  } finally {
    store.setExecuting(false);
  }
}

async function confirmDelete(scenario: TestScenarioSummary) {
  if (!confirm(`Are you sure you want to delete "${scenario.name}"? This will also delete all associated test data.`)) {
    return;
  }

  store.setExecuting(true);
  try {
    await predictionDashboardService.deleteTestScenario({ id: scenario.id });
    store.removeScenario(scenario.id);
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to delete scenario');
  } finally {
    store.setExecuting(false);
  }
}

// Phase 4.5: Guided Workflows
async function applyWorkflow(workflow: GuidedWorkflow) {
  // Create a new scenario based on the workflow template
  store.setExecuting(true);
  try {
    const response = await predictionDashboardService.createTestScenario({
      name: `${workflow.name} - ${new Date().toLocaleDateString()}`,
      description: workflow.description,
      injection_points: workflow.injection_points,
    });

    if (response.content && workflow.config.generateType) {
      // Generate the test data
      await predictionDashboardService.generateTestData({
        scenarioId: response.content.id,
        type: workflow.config.generateType,
        config: {
          count: workflow.config.count || 10,
          distribution: workflow.config.distribution,
          accuracy_rate: workflow.config.accuracy_rate,
        },
      });

      // Log to live monitor
      store.addLiveMonitorEvent({
        type: 'signal',
        message: `Applied workflow "${workflow.name}" - created scenario with ${workflow.config.count} items`,
      });
    }

    await loadScenarios();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to apply workflow');
    store.addLiveMonitorEvent({
      type: 'error',
      message: `Failed to apply workflow "${workflow.name}": ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  } finally {
    store.setExecuting(false);
  }
}

// Phase 4.6: Export/Import JSON
async function exportScenario(scenario: TestScenarioSummary) {
  store.setExecuting(true);
  try {
    const response = await predictionDashboardService.exportTestScenario({
      id: scenario.id,
      includeData: true,
    });

    if (response.content) {
      const dataStr = JSON.stringify(response.content, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `test-scenario-${scenario.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      store.addLiveMonitorEvent({
        type: 'signal',
        message: `Exported scenario "${scenario.name}" as JSON`,
      });
    }
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to export scenario');
    store.addLiveMonitorEvent({
      type: 'error',
      message: `Failed to export scenario: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  } finally {
    store.setExecuting(false);
  }
}

function triggerImport() {
  importInput.value?.click();
}

async function handleImportFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  store.setExecuting(true);
  try {
    const text = await file.text();
    const data = JSON.parse(text) as TestScenarioExport;

    const response = await predictionDashboardService.importTestScenario({
      data,
      newName: `${data.scenario.name} (imported)`,
    });

    if (response.content) {
      store.addScenario({ ...response.content, data_counts: {} });
      store.addLiveMonitorEvent({
        type: 'signal',
        message: `Imported scenario "${response.content.name}" from JSON`,
      });
    }

    await loadScenarios();
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Failed to import scenario');
    store.addLiveMonitorEvent({
      type: 'error',
      message: `Failed to import scenario: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  } finally {
    store.setExecuting(false);
    // Reset the input
    if (target) target.value = '';
  }
}

// Phase 4.7: Live Monitor
function toggleLiveMonitor() {
  store.toggleLiveMonitor();
}

function clearLiveMonitor() {
  store.clearLiveMonitorEvents();
}

function formatEventTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Lifecycle
onMounted(async () => {
  await loadScenarios();
});
</script>

<style scoped>
.test-lab {
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

.management-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

/* Stats Banner */
.stats-banner {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--ion-card-background);
  border-radius: 8px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 1rem;
  min-width: 80px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
}

.stat-item.active .stat-value { color: var(--ion-color-primary); }
.stat-item.running .stat-value { color: var(--ion-color-warning); }
.stat-item.completed .stat-value { color: var(--ion-color-success); }

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 20px;
  background: transparent;
  color: var(--ion-text-color);
  cursor: pointer;
  transition: all 0.2s;
  text-transform: capitalize;
}

.filter-tab:hover {
  background: var(--ion-color-light);
}

.filter-tab.active {
  background: var(--ion-color-primary);
  color: white;
  border-color: var(--ion-color-primary);
}

/* Loading/Error/Empty States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--ion-color-light);
  border-top-color: var(--ion-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon,
.empty-icon {
  font-size: 3rem;
}

.error-state {
  color: var(--ion-color-danger);
}

/* Scenarios Grid */
.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.scenario-card {
  background: var(--ion-card-background);
  border-radius: 8px;
  padding: 1rem;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.scenario-card:hover {
  border-color: var(--ion-color-primary-tint);
}

.scenario-card.selected {
  border-color: var(--ion-color-primary);
  box-shadow: 0 0 0 3px rgba(var(--ion-color-primary-rgb), 0.2);
}

.scenario-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.scenario-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.active { background: var(--ion-color-primary-tint); color: var(--ion-color-primary); }
.status-badge.running { background: var(--ion-color-warning-tint); color: var(--ion-color-warning-shade); }
.status-badge.completed { background: var(--ion-color-success-tint); color: var(--ion-color-success-shade); }
.status-badge.failed { background: var(--ion-color-danger-tint); color: var(--ion-color-danger); }
.status-badge.archived { background: var(--ion-color-medium-tint); color: var(--ion-color-medium-shade); }

.scenario-description {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.scenario-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-bottom: 0.75rem;
}

.scenario-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: var(--ion-color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--ion-color-primary-shade);
}

.btn-secondary {
  background: var(--ion-color-light);
  color: var(--ion-text-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--ion-color-medium-tint);
}

.btn-warning {
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
}

.btn-danger {
  background: var(--ion-color-danger);
  color: white;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.modal-content {
  background: var(--ion-background-color);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--ion-border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--ion-color-medium);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--ion-border-color);
}

/* Form */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--ion-text-color);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ion-border-color);
  border-radius: 6px;
  background: var(--ion-background-color);
  color: var(--ion-text-color);
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.radio-group {
  display: flex;
  gap: 1rem;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.distribution-inputs {
  display: flex;
  gap: 1rem;
}

.distribution-item {
  flex: 1;
}

.distribution-item label {
  font-size: 0.75rem;
}

.distribution-item input {
  width: 100%;
}

/* Tier Runner Panel */
.tier-runner-panel {
  margin-top: 2rem;
  padding: 1.5rem;
  background: var(--ion-card-background);
  border-radius: 8px;
  border: 2px solid var(--ion-color-primary-tint);
}

.tier-runner-panel h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
}

.panel-description {
  color: var(--ion-color-medium);
  margin-bottom: 1rem;
}

.tier-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.btn-tier {
  background: var(--ion-color-secondary);
  color: var(--ion-color-secondary-contrast);
  padding: 0.75rem 1.5rem;
}

.btn-tier:hover:not(:disabled) {
  background: var(--ion-color-secondary-shade);
}

.tier-result {
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.tier-result.success {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
}

.tier-result.error {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger);
}

.scenario-context {
  background: var(--ion-color-light);
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

/* Header Actions */
.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Guided Workflows (Phase 4.5) */
.guided-workflows {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--ion-card-background);
  border-radius: 8px;
}

.guided-workflows h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.workflow-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.workflow-card {
  padding: 1rem;
  background: var(--ion-background-color);
  border: 1px solid var(--ion-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.workflow-card:hover {
  border-color: var(--ion-color-primary);
  box-shadow: 0 2px 8px rgba(var(--ion-color-primary-rgb), 0.15);
}

.workflow-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.5rem;
}

.workflow-card h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  font-weight: 600;
}

.workflow-card p {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  line-height: 1.3;
}

.workflow-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Live Monitor Panel (Phase 4.7) */
.live-monitor-panel {
  margin-top: 2rem;
  background: var(--ion-card-background);
  border-radius: 8px;
  border: 1px solid var(--ion-border-color);
  overflow: hidden;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--ion-color-dark);
  color: var(--ion-color-dark-contrast);
  cursor: pointer;
  user-select: none;
}

.monitor-header h3 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.monitor-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ion-color-medium);
}

.monitor-indicator.active {
  background: var(--ion-color-success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.toggle-icon {
  font-size: 0.75rem;
}

.monitor-content {
  padding: 1rem;
}

.monitor-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.event-count {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.monitor-events {
  max-height: 200px;
  overflow-y: auto;
  background: var(--ion-background-color);
  border-radius: 4px;
  padding: 0.5rem;
}

.monitor-event {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--ion-border-color);
}

.monitor-event:last-child {
  border-bottom: none;
}

.event-time {
  color: var(--ion-color-medium);
  font-family: monospace;
  flex-shrink: 0;
}

.event-type-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.monitor-event.signal .event-type-badge { background: var(--ion-color-primary-tint); color: var(--ion-color-primary); }
.monitor-event.predictor .event-type-badge { background: var(--ion-color-secondary-tint); color: var(--ion-color-secondary); }
.monitor-event.prediction .event-type-badge { background: var(--ion-color-tertiary-tint); color: var(--ion-color-tertiary); }
.monitor-event.outcome .event-type-badge { background: var(--ion-color-success-tint); color: var(--ion-color-success); }
.monitor-event.evaluation .event-type-badge { background: var(--ion-color-warning-tint); color: var(--ion-color-warning-shade); }
.monitor-event.learning .event-type-badge { background: #e8f4fc; color: #0077b6; }
.monitor-event.error .event-type-badge { background: var(--ion-color-danger-tint); color: var(--ion-color-danger); }

.event-message {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-events {
  text-align: center;
  padding: 1rem;
  color: var(--ion-color-medium);
  font-size: 0.75rem;
}
</style>
