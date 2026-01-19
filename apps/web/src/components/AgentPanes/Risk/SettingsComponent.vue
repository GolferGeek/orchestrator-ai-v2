<template>
  <div class="settings-component">
    <!-- Scope Selector -->
    <div class="settings-section">
      <h4>Select Scope</h4>
      <select v-model="selectedScopeId" class="scope-select" @change="handleScopeChange">
        <option v-for="s in scopes" :key="s.id" :value="s.id">
          {{ s.name }} ({{ s.domain }})
        </option>
      </select>
    </div>

    <!-- Current Scope Settings -->
    <div v-if="scope" class="settings-section">
      <h4>Scope Configuration</h4>

      <div class="config-group">
        <label>Name</label>
        <input
          type="text"
          :value="scope.name"
          @change="handleUpdate('name', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="config-group">
        <label>Domain</label>
        <input type="text" :value="scope.domain" disabled />
      </div>

      <div class="config-group">
        <label>Description</label>
        <textarea
          :value="scope.description"
          rows="3"
          @change="handleUpdate('description', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
    </div>

    <!-- Threshold Configuration -->
    <div v-if="scope?.thresholdConfig" class="settings-section">
      <h4>Threshold Configuration</h4>

      <div class="config-row">
        <label>Alert Threshold</label>
        <span>{{ formatPercent(scope.thresholdConfig.alertThreshold) }}</span>
      </div>

      <div class="config-row">
        <label>Debate Threshold</label>
        <span>{{ formatPercent(scope.thresholdConfig.debateThreshold) }}</span>
      </div>

      <div class="config-row">
        <label>Stale Days</label>
        <span>{{ scope.thresholdConfig.staleDays }} days</span>
      </div>
    </div>

    <!-- Analysis Configuration -->
    <div v-if="scope?.analysisConfig" class="settings-section">
      <h4>Analysis Configuration</h4>

      <div class="config-row">
        <label>Risk Radar</label>
        <span :class="scope.analysisConfig.riskRadar?.enabled ? 'enabled' : 'disabled'">
          {{ scope.analysisConfig.riskRadar?.enabled ? 'Enabled' : 'Disabled' }}
        </span>
      </div>

      <div class="config-row">
        <label>Debate System</label>
        <span :class="scope.analysisConfig.debate?.enabled ? 'enabled' : 'disabled'">
          {{ scope.analysisConfig.debate?.enabled ? 'Enabled' : 'Disabled' }}
        </span>
      </div>

      <div class="config-row">
        <label>Learning Loop</label>
        <span :class="scope.analysisConfig.learning?.enabled ? 'enabled' : 'disabled'">
          {{ scope.analysisConfig.learning?.enabled ? 'Enabled' : 'Disabled' }}
        </span>
      </div>
    </div>

    <!-- LLM Configuration -->
    <div v-if="scope?.llmConfig" class="settings-section">
      <h4>LLM Configuration</h4>

      <div class="config-row">
        <label>Provider</label>
        <span>{{ scope.llmConfig.provider }}</span>
      </div>

      <div class="config-row">
        <label>Model</label>
        <span>{{ scope.llmConfig.model }}</span>
      </div>

      <div v-if="scope.llmConfig.temperature" class="config-row">
        <label>Temperature</label>
        <span>{{ scope.llmConfig.temperature }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RiskScope } from '@/types/risk-agent';

interface Props {
  scope: RiskScope | null;
  scopes: RiskScope[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'select-scope', scopeId: string): void;
  (e: 'update-scope', updates: Record<string, unknown>): void;
}>();

const selectedScopeId = ref(props.scope?.id || '');

watch(() => props.scope, (newScope) => {
  if (newScope) {
    selectedScopeId.value = newScope.id;
  }
});

function handleScopeChange() {
  if (selectedScopeId.value) {
    emit('select-scope', selectedScopeId.value);
  }
}

function handleUpdate(field: string, value: unknown) {
  emit('update-scope', { [field]: value });
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}
</script>

<style scoped>
.settings-component {
  max-width: 600px;
}

.settings-section {
  background: var(--ion-card-background, #fff);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h4 {
  margin: 0 0 1rem;
  font-size: 1rem;
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
  padding-bottom: 0.5rem;
}

.scope-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ion-border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-group {
  margin-bottom: 1rem;
}

.config-group label {
  display: block;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #666);
  margin-bottom: 0.25rem;
}

.config-group input,
.config-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ion-border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 0.875rem;
}

.config-group input:disabled {
  background: var(--ion-color-light, #f4f5f8);
}

.config-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ion-border-color, #e0e0e0);
}

.config-row:last-child {
  border-bottom: none;
}

.config-row label {
  font-size: 0.875rem;
  color: var(--ion-color-medium, #666);
}

.config-row span {
  font-size: 0.875rem;
  font-weight: 500;
}

.config-row span.enabled {
  color: var(--ion-color-success, #2dd36f);
}

.config-row span.disabled {
  color: var(--ion-color-medium, #666);
}
</style>
