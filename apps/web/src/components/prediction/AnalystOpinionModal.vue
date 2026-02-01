<template>
  <ion-modal :is-open="isOpen" @willDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>Analyst Opinion</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding" v-if="analyst">
      <!-- Analyst Header Card -->
      <ion-card class="analyst-header-card">
        <ion-card-header>
          <ion-row class="ion-align-items-center">
            <ion-col size="8">
              <ion-card-title class="analyst-name">{{ analyst.analystName || analyst.analystSlug }}</ion-card-title>
              <ion-chip v-if="analyst.tier" outline :color="getTierColor(analyst.tier)" class="tier-badge">
                <ion-label>{{ formatTier(analyst.tier) }}</ion-label>
              </ion-chip>
            </ion-col>
            <ion-col size="4" class="ion-text-right">
              <div class="direction-badge" :class="getDirectionClass(analyst.direction)">
                <span class="direction-icon">{{ getDirectionIcon(analyst.direction) }}</span>
                <span class="direction-text">{{ formatDirection(analyst.direction) }}</span>
              </div>
            </ion-col>
          </ion-row>
        </ion-card-header>
      </ion-card>

      <!-- Confidence Section -->
      <ion-card class="confidence-card">
        <ion-card-header>
          <ion-card-subtitle>Confidence Level</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="confidence-display">
            <div class="confidence-bar-container">
              <div
                class="confidence-bar-fill"
                :class="getConfidenceClass(analyst.confidence)"
                :style="{ width: `${Math.round(analyst.confidence * 100)}%` }"
              ></div>
            </div>
            <span class="confidence-value">{{ Math.round(analyst.confidence * 100) }}%</span>
          </div>
          <div class="confidence-label">
            {{ getConfidenceLabel(analyst.confidence) }}
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Reasoning Section -->
      <ion-card class="reasoning-card">
        <ion-card-header>
          <ion-card-subtitle>
            <ion-icon :icon="chatbubbleOutline" class="section-icon"></ion-icon>
            Analysis & Reasoning
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <p class="reasoning-text">{{ analyst.reasoning || 'No detailed reasoning provided.' }}</p>
        </ion-card-content>
      </ion-card>

      <!-- Key Factors Section (if available) -->
      <ion-card v-if="analyst.keyFactors?.length" class="factors-card">
        <ion-card-header>
          <ion-card-subtitle>
            <ion-icon :icon="checkmarkCircleOutline" class="section-icon"></ion-icon>
            Key Factors
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ul class="factors-list">
            <li v-for="(factor, idx) in analyst.keyFactors" :key="idx">{{ factor }}</li>
          </ul>
        </ion-card-content>
      </ion-card>

      <!-- Risks Section (if available) -->
      <ion-card v-if="analyst.risks?.length" class="risks-card">
        <ion-card-header>
          <ion-card-subtitle>
            <ion-icon :icon="warningOutline" class="section-icon"></ion-icon>
            Identified Risks
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ul class="risks-list">
            <li v-for="(risk, idx) in analyst.risks" :key="idx">{{ risk }}</li>
          </ul>
        </ion-card-content>
      </ion-card>

      <!-- Learnings Applied Section (if available) -->
      <ion-card v-if="analyst.learningsApplied?.length" class="learnings-card">
        <ion-card-header>
          <ion-card-subtitle>
            <ion-icon :icon="schoolOutline" class="section-icon"></ion-icon>
            Learnings Applied
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <div class="learnings-list">
            <ion-chip v-for="(learning, idx) in analyst.learningsApplied" :key="idx" outline color="tertiary">
              <ion-label>{{ learning }}</ion-label>
            </ion-chip>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>

    <!-- Loading State -->
    <ion-content v-else class="ion-padding ion-text-center">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading analyst details...</p>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonRow,
  IonCol,
  IonChip,
  IonLabel,
  IonSpinner,
} from '@ionic/vue';
import {
  closeOutline,
  chatbubbleOutline,
  checkmarkCircleOutline,
  warningOutline,
  schoolOutline,
} from 'ionicons/icons';

interface AnalystAssessment {
  analystSlug: string;
  analystName?: string;
  tier?: string;
  direction: string;
  confidence: number;
  reasoning?: string;
  keyFactors?: string[];
  risks?: string[];
  learningsApplied?: string[];
}

interface Props {
  isOpen: boolean;
  analyst: AnalystAssessment | null;
}

defineProps<Props>();

const emit = defineEmits<{
  dismiss: [];
}>();

function onDismiss() {
  emit('dismiss');
}

function getDirectionClass(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return 'direction-up';
  if (dir === 'bearish' || dir === 'down') return 'direction-down';
  return 'direction-neutral';
}

function getDirectionIcon(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return '\u2191'; // ↑
  if (dir === 'bearish' || dir === 'down') return '\u2193'; // ↓
  return '\u2194'; // ↔
}

function formatDirection(direction: string): string {
  const dir = direction.toLowerCase();
  if (dir === 'bullish' || dir === 'up') return 'BULLISH';
  if (dir === 'bearish' || dir === 'down') return 'BEARISH';
  return 'NEUTRAL';
}

function getTierColor(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'technical': return 'primary';
    case 'fundamental': return 'success';
    case 'macro': return 'warning';
    case 'sentiment': return 'tertiary';
    default: return 'medium';
  }
}

function formatTier(tier: string): string {
  if (!tier) return '';
  return tier.charAt(0).toUpperCase() + tier.slice(1) + ' Analysis';
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'confidence-high';
  if (confidence >= 0.6) return 'confidence-medium';
  return 'confidence-low';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High Confidence';
  if (confidence >= 0.6) return 'Moderate Confidence';
  if (confidence >= 0.4) return 'Low Confidence';
  return 'Very Low Confidence';
}
</script>

<style scoped>
.analyst-header-card {
  margin-bottom: 1rem;
}

.analyst-name {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}

.tier-badge {
  margin-top: 0.5rem;
}

.direction-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
}

.direction-badge.direction-up {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.direction-badge.direction-down {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.direction-badge.direction-neutral {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.direction-icon {
  font-size: 1.4rem;
}

.direction-text {
  font-size: 0.9rem;
}

.confidence-card {
  margin-bottom: 1rem;
}

.confidence-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.confidence-bar-container {
  flex: 1;
  height: 12px;
  background: var(--ion-color-light-shade);
  border-radius: 6px;
  overflow: hidden;
}

.confidence-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.confidence-bar-fill.confidence-high {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}

.confidence-bar-fill.confidence-medium {
  background: linear-gradient(90deg, #eab308, #ca8a04);
}

.confidence-bar-fill.confidence-low {
  background: linear-gradient(90deg, #f97316, #ea580c);
}

.confidence-value {
  font-size: 1.5rem;
  font-weight: 700;
  min-width: 60px;
  text-align: right;
}

.confidence-label {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.reasoning-card {
  margin-bottom: 1rem;
}

.section-icon {
  margin-right: 0.5rem;
  vertical-align: middle;
}

.reasoning-text {
  line-height: 1.7;
  font-size: 1rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
  margin: 0;
}

.factors-card,
.risks-card,
.learnings-card {
  margin-bottom: 1rem;
}

.factors-list,
.risks-list {
  margin: 0;
  padding-left: 1.5rem;
}

.factors-list li,
.risks-list li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.risks-list li {
  color: var(--ion-color-danger);
}

.learnings-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
