<template>
  <div class="deliverable-action-buttons">
    <ion-button
      fill="outline"
      color="medium"
      @click="handleExport"
      :disabled="isLoading"
    >
      <ion-icon :icon="downloadOutline" slot="start" />
      Export
    </ion-button>

    <ion-button
      fill="outline"
      color="secondary"
      @click="emit('edit')"
      :disabled="isLoading"
    >
      <ion-icon :icon="createOutline" slot="start" />
      Edit
    </ion-button>

    <ion-button
      fill="outline"
      color="primary"
      @click="emit('rerun')"
      :disabled="isLoading"
    >
      <ion-icon :icon="refreshOutline" slot="start" />
      Rerun with AI
    </ion-button>
  </div>

  <!-- Export Format Popover -->
  <ion-popover
    :is-open="showExportPopover"
    @did-dismiss="showExportPopover = false"
    :event="popoverEvent"
  >
    <ion-content class="ion-padding">
      <ion-list lines="none">
        <ion-item button @click="doExport('markdown')">
          <ion-icon :icon="documentTextOutline" slot="start" />
          <ion-label>Markdown (.md)</ion-label>
        </ion-item>
        <ion-item button @click="doExport('html')">
          <ion-icon :icon="codeOutline" slot="start" />
          <ion-label>HTML (.html)</ion-label>
        </ion-item>
        <ion-item button @click="doExport('json')">
          <ion-icon :icon="codeSlashOutline" slot="start" />
          <ion-label>JSON (.json)</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import {
  downloadOutline,
  createOutline,
  refreshOutline,
  documentTextOutline,
  codeOutline,
  codeSlashOutline,
} from 'ionicons/icons';

interface Props {
  deliverableId?: string;
  currentVersionId?: string;
  isLoading?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  edit: [];
  rerun: [];
  export: [format: 'markdown' | 'html' | 'json'];
}>();

const showExportPopover = ref(false);
const popoverEvent = ref<Event | null>(null);

function handleExport(event: Event) {
  popoverEvent.value = event;
  showExportPopover.value = true;
}

function doExport(format: 'markdown' | 'html' | 'json') {
  showExportPopover.value = false;
  emit('export', format);
}
</script>

<style scoped>
.deliverable-action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.5rem;
}

@media (max-width: 600px) {
  .deliverable-action-buttons {
    flex-wrap: wrap;
  }

  .deliverable-action-buttons ion-button {
    flex: 1 1 45%;
  }
}
</style>
