<template>
  <div class="current-state">
    <div class="state-header">
      <h3>Current State</h3>
      <div v-if="latestDatapoint" class="last-updated">
        Last updated: {{ formattedTimestamp }}
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading current state...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠</span>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="!latestDatapoint" class="empty-state">
      <span>No data available yet. Start the agent to begin collecting data.</span>
    </div>

    <div v-else class="state-content">
      <!-- Active Recommendations -->
      <div class="section">
        <h4>Active Recommendations ({{ activeRecommendations.length }})</h4>
        <div v-if="activeRecommendations.length === 0" class="empty-message">
          No active recommendations
        </div>
        <div v-else class="recommendations-list">
          <RecommendationRow
            v-for="rec in activeRecommendations"
            :key="rec.id"
            :recommendation="rec"
            :show-evidence="showDetailedEvidence"
          />
        </div>
        <div v-if="activeRecommendations.length > 0" class="section-footer">
          <button class="toggle-evidence-btn" @click="toggleEvidence">
            {{ showDetailedEvidence ? 'Hide' : 'Show' }} Evidence
          </button>
        </div>
      </div>

      <!-- Supporting Claims -->
      <div class="section">
        <h4>
          Recent Claims ({{ displayedClaims.length }} of {{ totalClaims }})
        </h4>
        <div v-if="displayedClaims.length === 0" class="empty-message">
          No claims collected yet
        </div>
        <div v-else class="claims-grid">
          <ClaimCard
            v-for="(claim, idx) in displayedClaims"
            :key="idx"
            :claim="claim"
            :source="getClaimSource(claim)"
          />
        </div>
        <div v-if="totalClaims > maxDisplayedClaims" class="section-footer">
          <button class="show-more-btn" @click="showMoreClaims">
            Show More Claims
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePredictionAgentStore } from '@/stores/predictionAgentStore';
import type { Claim } from '@/types/prediction-agent';
import RecommendationRow from './shared/RecommendationRow.vue';
import ClaimCard from './shared/ClaimCard.vue';

const store = usePredictionAgentStore();

const showDetailedEvidence = ref(false);
const maxDisplayedClaims = ref(12);

const latestDatapoint = computed(() => store.latestDatapoint);
const activeRecommendations = computed(() => store.activeRecommendations);
const isLoading = computed(() => store.isLoading);
const error = computed(() => store.error);

const formattedTimestamp = computed(() => {
  if (!latestDatapoint.value) return '';
  const date = new Date(latestDatapoint.value.timestamp);
  return date.toLocaleString();
});

const totalClaims = computed(() => latestDatapoint.value?.allClaims.length || 0);

const displayedClaims = computed(() => {
  if (!latestDatapoint.value) return [];
  return latestDatapoint.value.allClaims.slice(0, maxDisplayedClaims.value);
});

function getClaimSource(claim: Claim): string {
  if (!latestDatapoint.value) return 'Unknown';
  const source = latestDatapoint.value.sources.find((s) =>
    s.claims.some(
      (c) =>
        c.type === claim.type &&
        c.instrument === claim.instrument &&
        c.timestamp === claim.timestamp
    )
  );
  return source?.tool || 'Unknown';
}

function toggleEvidence() {
  showDetailedEvidence.value = !showDetailedEvidence.value;
}

function showMoreClaims() {
  maxDisplayedClaims.value += 12;
}
</script>

<style scoped>
.current-state {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.state-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.state-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.last-updated {
  font-size: 0.875rem;
  color: #6b7280;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  font-size: 1rem;
  color: #6b7280;
}

.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  background-color: #fef2f2;
  color: #991b1b;
}

.error-icon {
  font-size: 1.5rem;
}

.state-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
}

.empty-message {
  padding: 2rem;
  text-align: center;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  color: #6b7280;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.claims-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.section-footer {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.toggle-evidence-btn,
.show-more-btn {
  padding: 0.5rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-evidence-btn:hover,
.show-more-btn:hover {
  background-color: #2563eb;
}

.toggle-evidence-btn:active,
.show-more-btn:active {
  background-color: #1d4ed8;
}
</style>
