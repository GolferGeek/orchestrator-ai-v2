<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Evaluations</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            fill="clear" 
            @click="refreshEvaluations"
            :disabled="evaluationsStore.isLoading"
          >
            <ion-icon :icon="refreshOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="evaluations-container">
      <!-- Controls Bar -->
      <div class="controls-bar">
        <ion-searchbar
          v-model="localFilters.agentName"
          placeholder="Search agents..."
          :debounce="300"
          @ionInput="debounceFilter"
          class="search-bar"
        ></ion-searchbar>
        
        <div class="filter-controls">
          <ion-select 
            v-model="localFilters.minRating" 
            placeholder="Minimum Rating"
            interface="popover"
            @ionChange="applyFilters"
          >
            <ion-select-option :value="undefined">All Ratings</ion-select-option>
            <ion-select-option :value="1">1+ Stars</ion-select-option>
            <ion-select-option :value="2">2+ Stars</ion-select-option>
            <ion-select-option :value="3">3+ Stars</ion-select-option>
            <ion-select-option :value="4">4+ Stars</ion-select-option>
            <ion-select-option :value="5">5 Stars</ion-select-option>
          </ion-select>
          
          <div class="checkbox-wrapper">
            <ion-checkbox 
              v-model="localFilters.hasNotes" 
              @ionChange="applyFilters"
            ></ion-checkbox>
            <span class="checkbox-label">Has Notes Only</span>
          </div>
          
          <ion-button 
            fill="solid"
            @click="clearAllFilters"
            :disabled="evaluationsStore.isLoading"
          >
            Clear Filters
          </ion-button>
        </div>
      </div>
      <!-- Loading State -->
      <div v-if="evaluationsStore.isLoading && !evaluationsStore.hasEvaluations" class="ion-text-center ion-padding">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading evaluations...</p>
      </div>
      <!-- Error State -->
      <ion-card v-else-if="evaluationsStore.error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <h3>Error Loading Evaluations</h3>
            <p>{{ evaluationsStore.error }}</p>
          </ion-text>
          <ion-button 
            fill="clear" 
            color="light" 
            @click="refreshEvaluations"
          >
            Try Again
          </ion-button>
        </ion-card-content>
      </ion-card>
      <!-- Empty State -->
      <ion-card v-else-if="(!evaluationsStore.hasEvaluations || filteredEvaluations.length === 0) && !evaluationsStore.isLoading">
        <ion-card-content class="ion-text-center">
          <ion-icon :icon="starOutline" size="large" color="medium"></ion-icon>
          <h3>No Task Evaluations Found</h3>
          <p v-if="!evaluationsStore.hasEvaluations">You haven't rated any tasks yet.</p>
          <p v-else>No evaluations match your current filters.</p>
          <ion-button fill="clear" @click="clearAllFilters">
            Clear Filters
          </ion-button>
        </ion-card-content>
      </ion-card>
      <!-- Evaluations List -->
      <div v-else>
        <!-- Pagination Info -->
        <ion-item lines="none" class="pagination-info">
          <ion-label>
            <p>
              Showing {{ filteredEvaluations.length }} task evaluations
              of {{ evaluationsStore.pagination.total }} total
              (Page {{ evaluationsStore.currentPageInfo }})
            </p>
          </ion-label>
        </ion-item>
        <!-- Evaluation Cards -->
        <ion-card 
          v-for="evaluation in filteredEvaluations" 
          :key="evaluation.id"
          button
          @click="openEvaluationDetails(evaluation)"
          class="evaluation-card"
        >
          <ion-card-header>
            <ion-row>
              <ion-col size="8">
                <ion-card-subtitle>
                  {{ evaluation.metadata?.agentName || 'Task Agent' }}
                </ion-card-subtitle>
                <ion-card-title class="evaluation-title">
                  {{ truncateContent(evaluation.content) }}
                </ion-card-title>
              </ion-col>
              <ion-col size="4" class="ion-text-right">
                <div class="rating-display">
                  <ion-icon 
                    v-for="starIndex in 5" 
                    :key="starIndex"
                    :icon="starIndex <= (evaluation.userRating || 0) ? starIcon : starOutline"
                    :color="starIndex <= (evaluation.userRating || 0) ? 'warning' : 'medium'"
                    size="small"
                  ></ion-icon>
                </div>
                <ion-text color="medium">
                  <small>{{ formatDate(evaluation.timestamp) }}</small>
                </ion-text>
              </ion-col>
            </ion-row>
          </ion-card-header>
          <ion-card-content>
            <ion-row v-if="evaluation.userNotes">
              <ion-col>
                <ion-text color="medium">
                  <p class="notes-preview">{{ truncateNotes(evaluation.userNotes) }}</p>
                </ion-text>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6" v-if="evaluation.speedRating">
                <ion-chip outline color="primary">
                  <ion-icon :icon="timerOutline"></ion-icon>
                  <ion-label>Speed: {{ evaluation.speedRating }}/5</ion-label>
                </ion-chip>
              </ion-col>
              <ion-col size="6" v-if="evaluation.accuracyRating">
                <ion-chip outline color="success">
                  <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
                  <ion-label>Accuracy: {{ evaluation.accuracyRating }}/5</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
          </ion-card-content>
        </ion-card>
        <!-- Pagination Controls -->
        <ion-card class="pagination-controls">
          <ion-card-content>
            <ion-row class="ion-align-items-center">
              <ion-col size="auto">
                <ion-button 
                  fill="clear" 
                  @click="evaluationsStore.loadPreviousPage()"
                  :disabled="evaluationsStore.pagination.page <= 1 || evaluationsStore.isLoading"
                >
                  <ion-icon :icon="chevronBackOutline" slot="start"></ion-icon>
                  Previous
                </ion-button>
              </ion-col>
              <ion-col class="ion-text-center">
                <ion-text>
                  <strong>Page {{ evaluationsStore.pagination.page }} of {{ evaluationsStore.pagination.totalPages }}</strong>
                </ion-text>
              </ion-col>
              <ion-col size="auto">
                <ion-button 
                  fill="clear" 
                  @click="evaluationsStore.loadNextPage()"
                  :disabled="!evaluationsStore.hasMorePages || evaluationsStore.isLoading"
                >
                  Next
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-card-content>
        </ion-card>
      </div>
      <!-- Loading overlay for pagination -->
      <div v-if="evaluationsStore.isLoading && evaluationsStore.hasEvaluations" class="loading-overlay">
        <ion-spinner name="crescent"></ion-spinner>
      </div>
      </div>
    </ion-content>
    <!-- Evaluation Details Modal -->
    <EvaluationDetailsModal 
      :is-open="showDetailsModal"
      :evaluation="selectedEvaluation"
      @dismiss="closeEvaluationDetails"
    />
  </ion-page>
</template>
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonSearchbar,
  IonCheckbox,
  IonLabel,
  IonSpinner,
  IonText,
  IonChip
} from '@ionic/vue';
import {
  refreshOutline,
  starOutline,
  star,
  timerOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { useEvaluationsStore } from '@/stores/evaluationsStore';
import type { EvaluationWithMessage, AllEvaluationsFilters } from '@/types/evaluation';
import EvaluationDetailsModal from '@/components/EvaluationDetailsModal.vue';
const evaluationsStore = useEvaluationsStore();
const showDetailsModal = ref(false);
const selectedEvaluation = ref<EvaluationWithMessage | null>(null);
const localFilters = ref<AllEvaluationsFilters>({
  page: 1,
  limit: 20
});
let filterTimeout: NodeJS.Timeout | null = null;
// Computed property for star icon
const starIcon = computed(() => star);
// Computed property to get all evaluations
const filteredEvaluations = computed(() => {
  return evaluationsStore.evaluations;
});
onMounted(() => {
  evaluationsStore.fetchEvaluations();
});
function refreshEvaluations() {
  evaluationsStore.refreshEvaluations();
}
function applyFilters() {
  evaluationsStore.applyFilters(localFilters.value);
}
function debounceFilter() {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
  filterTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
}
function clearAllFilters() {
  localFilters.value = {
    page: 1,
    limit: 20
  };
  evaluationsStore.clearFilters();
}
function openEvaluationDetails(evaluation: EvaluationWithMessage) {
  selectedEvaluation.value = evaluation;
  showDetailsModal.value = true;
}
function closeEvaluationDetails() {
  showDetailsModal.value = false;
  selectedEvaluation.value = null;
}
function truncateContent(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
function truncateNotes(notes: string, maxLength: number = 150): string {
  if (notes.length <= maxLength) return notes;
  return notes.substring(0, maxLength) + '...';
}
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
<style scoped>
.evaluations-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.controls-bar {
  margin-bottom: 1.5rem;
}

.search-bar {
  margin-bottom: 1rem;
}

.filter-controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-controls ion-select {
  min-width: 140px;
  max-width: 160px;
  flex: 0 0 auto;
}

.filter-controls ion-button {
  flex: 0 0 auto;
  white-space: nowrap;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 0 auto;
  white-space: nowrap;
}

.checkbox-label {
  font-size: 14px;
}

.evaluation-card {
  margin-bottom: 1rem;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.evaluation-card:hover {
  transform: translateY(-2px);
}

.evaluation-title {
  font-size: 1rem;
  line-height: 1.4;
}

.rating-display {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.notes-preview {
  font-style: italic;
  margin: 0;
}

.pagination-info {
  margin-bottom: 1rem;
}

.pagination-controls {
  margin-top: 1rem;
  position: sticky;
  bottom: 1rem;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Responsive design */
@media (max-width: 768px) {
  .evaluations-container {
    padding: 0.5rem;
  }
}
</style>