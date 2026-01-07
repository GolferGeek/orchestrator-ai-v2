<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Personally Identifiable Information Pattern Management</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="handleCreatePattern">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <div class="pii-management-container">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonButton,
  IonIcon,
  toastController
} from '@ionic/vue';
import { addOutline } from 'ionicons/icons';
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
/* Detail View Container */
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
}

.pii-management-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
