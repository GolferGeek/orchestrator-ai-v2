<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>PII Pattern Management</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="pii-management-container">
        <!-- Page Header -->
        <div class="page-header">
          <h1>PII Pattern Management</h1>
          <p>Manage patterns for detecting and handling personally identifiable information (PII)</p>
        </div>

        <!-- PIIPatternTable Component -->
        <PIIPatternTable
          @edit-pattern="handleEditPattern"
          @create-pattern="handleCreatePattern"
        />

        <!-- PIIPatternEditor Modal -->
        <PIIPatternEditor
          :is-open="isEditorOpen"
          :pattern="selectedPattern"
          @close="handleCloseEditor"
          @saved="handlePatternSaved"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  toastController
} from '@ionic/vue';
import PIIPatternTable from '@/components/PII/PIIPatternTable.vue';
import PIIPatternEditor from '@/components/PII/PIIPatternEditor.vue';
import type { PIIPattern } from '@/types/pii';
import * as privacyService from '@/services/privacyService';

// Modal state
const isEditorOpen = ref(false);
const selectedPattern = ref<PIIPattern | null>(null);

// Load patterns on mount
onMounted(async () => {
  try {
    await privacyService.loadPatterns();
  } catch (error) {
    console.error('Failed to load PII patterns:', error);
    const toast = await toastController.create({
      message: 'Failed to load PII patterns',
      duration: 3000,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }
});

// Event handlers
const handleEditPattern = (pattern: PIIPattern) => {
  selectedPattern.value = pattern;
  isEditorOpen.value = true;
};

const handleCreatePattern = () => {
  selectedPattern.value = null;
  isEditorOpen.value = true;
};

const handleCloseEditor = () => {
  isEditorOpen.value = false;
  selectedPattern.value = null;
};

const handlePatternSaved = async (pattern: PIIPattern) => {
  // Reload patterns to ensure the list is fresh
  try {
    await privacyService.loadPatterns(true); // Force reload
  } catch (error) {
    console.error('Failed to reload patterns after save:', error);
  }

  const toast = await toastController.create({
    message: `Pattern "${pattern.name}" ${selectedPattern.value ? 'updated' : 'created'} successfully!`,
    duration: 3000,
    color: 'success',
    position: 'bottom'
  });
  await toast.present();
};
</script>

<style scoped>
.pii-management-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  text-align: center;
}

.page-header h1 {
  font-size: 2rem;
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.page-header p {
  color: var(--ion-color-medium);
  font-size: 1rem;
}
</style>
