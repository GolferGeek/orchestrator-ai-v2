<template>
  <div class="hitl-controls">
    <div class="controls-header">
      <ion-icon :icon="personCircleOutline" />
      <span>Attorney Review Required</span>
    </div>

    <div class="controls-description">
      Review the analysis above and take action. Your decision will be recorded for audit purposes.
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
      <ion-button
        color="success"
        :disabled="disabled"
        @click="handleAction('approve')"
      >
        <ion-icon :icon="checkmarkCircle" slot="start" />
        Approve
      </ion-button>

      <ion-button
        color="warning"
        fill="outline"
        :disabled="disabled"
        @click="showChangesModal = true"
      >
        <ion-icon :icon="createOutline" slot="start" />
        Request Changes
      </ion-button>

      <ion-button
        color="danger"
        fill="outline"
        :disabled="disabled"
        @click="showEscalateModal = true"
      >
        <ion-icon :icon="arrowUpCircleOutline" slot="start" />
        Escalate
      </ion-button>
    </div>

    <!-- Export Button (only show for document analysis, not text queries) -->
    <div v-if="showExport !== false" class="export-actions">
      <ion-button
        fill="clear"
        size="small"
        @click="$emit('export', 'json')"
      >
        <ion-icon :icon="downloadOutline" slot="start" />
        Export JSON
      </ion-button>
      <ion-button
        fill="clear"
        size="small"
        @click="$emit('export', 'pdf')"
      >
        <ion-icon :icon="documentOutline" slot="start" />
        Export PDF
      </ion-button>
    </div>

    <!-- Request Changes Modal -->
    <ion-modal :is-open="showChangesModal" @did-dismiss="showChangesModal = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Request Changes</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showChangesModal = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <p>Describe the changes needed:</p>
        <ion-textarea
          v-model="changesComment"
          placeholder="Enter your feedback..."
          :rows="5"
          fill="outline"
        />
        <ion-button
          expand="block"
          color="warning"
          :disabled="!changesComment.trim()"
          @click="submitChanges"
        >
          Submit Request
        </ion-button>
      </ion-content>
    </ion-modal>

    <!-- Escalate Modal -->
    <ion-modal :is-open="showEscalateModal" @did-dismiss="showEscalateModal = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Escalate to Senior Attorney</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showEscalateModal = false">Close</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <p>Explain why this needs escalation:</p>
        <ion-textarea
          v-model="escalateComment"
          placeholder="Reason for escalation..."
          :rows="5"
          fill="outline"
        />
        <ion-button
          expand="block"
          color="danger"
          :disabled="!escalateComment.trim()"
          @click="submitEscalate"
        >
          Escalate Now
        </ion-button>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import {
  IonButton,
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonTextarea,
} from '@ionic/vue';
import {
  personCircleOutline,
  checkmarkCircle,
  createOutline,
  arrowUpCircleOutline,
  downloadOutline,
  documentOutline,
} from 'ionicons/icons';
import type { HITLAction } from '../legalDepartmentTypes';

// Props
defineProps<{
  disabled?: boolean;
  showExport?: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'action', action: HITLAction, comment?: string): void;
  (e: 'export', format: 'json' | 'pdf'): void;
}>();

// State
const showChangesModal = ref(false);
const showEscalateModal = ref(false);
const changesComment = ref('');
const escalateComment = ref('');

// Methods
function handleAction(action: HITLAction) {
  emit('action', action);
}

function submitChanges() {
  emit('action', 'request_changes', changesComment.value);
  showChangesModal.value = false;
  changesComment.value = '';
}

function submitEscalate() {
  emit('action', 'escalate', escalateComment.value);
  showEscalateModal.value = false;
  escalateComment.value = '';
}
</script>

<style scoped>
.hitl-controls {
  background: var(--ion-color-light);
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid var(--ion-color-primary);
}

.controls-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 16px;
}

.controls-header ion-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.controls-description {
  color: var(--ion-color-medium);
  font-size: 14px;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.action-buttons ion-button {
  flex: 1;
  min-width: 140px;
}

.export-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 12px;
}

@media (max-width: 600px) {
  .action-buttons {
    flex-direction: column;
  }

  .action-buttons ion-button {
    width: 100%;
  }
}
</style>
