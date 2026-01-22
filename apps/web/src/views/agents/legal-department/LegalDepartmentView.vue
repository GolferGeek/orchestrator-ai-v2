<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Legal Department AI</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleHelp">
            <ion-icon :icon="helpCircleOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <LegalDepartmentConversation :conversation-id="conversationId" />
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonContent,
  IonIcon,
  alertController,
} from '@ionic/vue';
import { helpCircleOutline } from 'ionicons/icons';
import LegalDepartmentConversation from './LegalDepartmentConversation.vue';

const route = useRoute();

// Get conversationId from route query (if provided by parent)
const conversationId = computed(() => {
  return (route.query.conversationId as string) || undefined;
});

// Show help dialog
async function handleHelp() {
  const alert = await alertController.create({
    header: 'Legal Department AI',
    message: `
      <p><strong>Upload a legal document</strong> (PDF, DOCX, or image) for AI-powered analysis.</p>
      <br/>
      <p><strong>What we analyze:</strong></p>
      <ul>
        <li>Key legal terms and clauses</li>
        <li>Potential risks and liabilities</li>
        <li>Compliance issues</li>
        <li>Actionable recommendations</li>
      </ul>
      <br/>
      <p><strong>Supported formats:</strong> PDF, DOCX, PNG, JPG (max 10MB)</p>
      <br/>
      <p><em>Note: This tool provides AI-assisted analysis and should not replace consultation with a licensed attorney.</em></p>
    `,
    buttons: ['Close'],
  });

  await alert.present();
}
</script>

<style scoped>
ion-content {
  --background: var(--ion-background-color);
}
</style>
