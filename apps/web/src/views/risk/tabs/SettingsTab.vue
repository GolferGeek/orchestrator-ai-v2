<template>
  <div class="settings-tab">
    <div v-if="!scope" class="empty-state">
      <span class="empty-icon">&#9881;</span>
      <h3>No Scope Selected</h3>
      <p>Select a scope to view and edit settings.</p>
    </div>

    <div v-else class="settings-content">
      <section class="settings-section">
        <h3>Scope Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>Name</label>
            <span>{{ scope.name }}</span>
          </div>
          <div class="info-item">
            <label>Domain</label>
            <span>{{ scope.domain }}</span>
          </div>
          <div class="info-item">
            <label>Description</label>
            <span>{{ scope.description || 'No description' }}</span>
          </div>
          <div class="info-item">
            <label>Status</label>
            <span :class="['status', scope.isActive ? 'active' : 'inactive']">
              {{ scope.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="scope.thresholdConfig" class="settings-section">
        <h3>Alert Thresholds</h3>
        <div class="threshold-grid">
          <div class="threshold-item">
            <label>Alert Threshold</label>
            <span>{{ formatPercent(scope.thresholdConfig.alertThreshold) }}</span>
            <p class="help-text">Trigger alerts when risk score exceeds this value</p>
          </div>
          <div class="threshold-item">
            <label>Debate Threshold</label>
            <span>{{ formatPercent(scope.thresholdConfig.debateThreshold) }}</span>
            <p class="help-text">Automatically trigger Red/Blue team debate above this score</p>
          </div>
          <div class="threshold-item">
            <label>Stale Days</label>
            <span>{{ scope.thresholdConfig.staleDays }} days</span>
            <p class="help-text">Mark assessments as stale after this period</p>
          </div>
        </div>
      </section>

      <section v-if="scope.llmConfig" class="settings-section">
        <h3>LLM Configuration</h3>
        <div class="llm-config">
          <div class="config-item">
            <label>Provider</label>
            <span>{{ scope.llmConfig.provider }}</span>
          </div>
          <div class="config-item">
            <label>Model</label>
            <span>{{ scope.llmConfig.model }}</span>
          </div>
          <div v-if="scope.llmConfig.temperature" class="config-item">
            <label>Temperature</label>
            <span>{{ scope.llmConfig.temperature }}</span>
          </div>
          <div v-if="scope.llmConfig.maxTokens" class="config-item">
            <label>Max Tokens</label>
            <span>{{ scope.llmConfig.maxTokens }}</span>
          </div>
        </div>
      </section>

      <section v-if="scope.analysisConfig" class="settings-section">
        <h3>Analysis Features</h3>
        <div class="features-grid">
          <div class="feature-item">
            <span class="feature-name">Risk Radar</span>
            <span :class="['feature-status', scope.analysisConfig.riskRadar?.enabled ? 'enabled' : 'disabled']">
              {{ scope.analysisConfig.riskRadar?.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="feature-item">
            <span class="feature-name">Red/Blue Team Debate</span>
            <span :class="['feature-status', scope.analysisConfig.debate?.enabled ? 'enabled' : 'disabled']">
              {{ scope.analysisConfig.debate?.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="feature-item">
            <span class="feature-name">Learning System</span>
            <span :class="['feature-status', scope.analysisConfig.learning?.enabled ? 'enabled' : 'disabled']">
              {{ scope.analysisConfig.learning?.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3>Metadata</h3>
        <div class="meta-grid">
          <div class="meta-item">
            <label>Created</label>
            <span>{{ formatDate(scope.createdAt) }}</span>
          </div>
          <div class="meta-item">
            <label>Last Updated</label>
            <span>{{ formatDate(scope.updatedAt) }}</span>
          </div>
          <div class="meta-item">
            <label>Scope ID</label>
            <code>{{ scope.id }}</code>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RiskScope } from '@/types/risk-agent';

defineProps<{
  scope: RiskScope | null;
}>();

defineEmits<{
  update: [params: Record<string, unknown>];
}>();

function formatPercent(value: number): string {
  return (value * 100).toFixed(0) + '%';
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString();
}
</script>

<style scoped>
.settings-tab {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 1rem;
}

.settings-section h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.info-grid,
.threshold-grid,
.llm-config,
.features-grid,
.meta-grid {
  display: grid;
  gap: 1rem;
}

.info-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.threshold-grid {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}

.llm-config {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.features-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.meta-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.info-item,
.threshold-item,
.config-item,
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item label,
.threshold-item label,
.config-item label,
.meta-item label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.info-item span,
.threshold-item span,
.config-item span,
.meta-item span {
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
}

.help-text {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  margin: 0;
}

.status.active {
  color: #16a34a;
}

.status.inactive {
  color: #6b7280;
}

.feature-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.feature-name {
  font-size: 0.875rem;
  color: var(--text-primary, #111827);
}

.feature-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.feature-status.enabled {
  background: #dcfce7;
  color: #16a34a;
}

.feature-status.disabled {
  background: #f3f4f6;
  color: #6b7280;
}

code {
  font-family: monospace;
  font-size: 0.75rem;
  background: var(--code-bg, #f3f4f6);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
</style>
