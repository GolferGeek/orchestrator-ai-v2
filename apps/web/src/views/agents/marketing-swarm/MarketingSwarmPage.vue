<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Marketing Swarm</ion-title>
        <ion-buttons slot="end" v-if="uiState.currentView !== 'config'">
          <ion-button @click="handleRestart">
            <ion-icon :icon="arrowBackOutline" slot="icon-only" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent" />
        <p>Loading configuration...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !isExecuting" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger" />
        <p>{{ error }}</p>
        <ion-button @click="loadConfiguration">Retry</ion-button>
      </div>

      <!-- Config Form -->
      <SwarmConfigForm
        v-else-if="uiState.currentView === 'config'"
        @execute="handleExecute"
      />

      <!-- Progress View -->
      <SwarmProgress
        v-else-if="uiState.currentView === 'progress'"
      />

      <!-- Results View -->
      <SwarmResults
        v-else-if="uiState.currentView === 'results'"
        @restart="handleRestart"
      />
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
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
  IonSpinner,
  IonIcon,
} from '@ionic/vue';
import { arrowBackOutline, alertCircleOutline } from 'ionicons/icons';
import { v4 as uuidv4 } from 'uuid';
import { useMarketingSwarmStore } from '@/stores/marketingSwarmStore';
import { marketingSwarmService } from '@/services/marketingSwarmService';
import { useRbacStore } from '@/stores/rbacStore';
import SwarmConfigForm from './components/SwarmConfigForm.vue';
import SwarmProgress from './components/SwarmProgress.vue';
import SwarmResults from './components/SwarmResults.vue';
import type { PromptData, SwarmConfig } from '@/types/marketing-swarm';

const route = useRoute();
const store = useMarketingSwarmStore();
const rbacStore = useRbacStore();

const isLoading = computed(() => store.isLoading);
const isExecuting = computed(() => store.isExecuting);
const error = computed(() => store.error);
const uiState = computed(() => store.uiState);

// Get org slug from route or context
const orgSlug = computed(() => {
  return (route.params.orgSlug as string) || rbacStore.currentOrganization || 'demo-org';
});

const userId = computed(() => {
  return rbacStore.user?.id || 'demo-user';
});

// Load configuration data on mount
async function loadConfiguration() {
  try {
    await marketingSwarmService.fetchAllConfiguration(orgSlug.value);
  } catch (err) {
    console.error('Failed to load configuration:', err);
  }
}

onMounted(() => {
  loadConfiguration();
});

// Handle execute from config form
async function handleExecute(data: {
  contentTypeSlug: string;
  contentTypeContext: string;
  promptData: PromptData;
  config: SwarmConfig;
}) {
  const taskId = uuidv4();
  const conversationId = uuidv4();

  try {
    // Initialize agent card states
    for (const writer of data.config.writers) {
      store.setAgentCardState(writer.agentSlug, writer.llmConfigId, {
        agentSlug: writer.agentSlug,
        llmConfigId: writer.llmConfigId,
        status: 'idle',
      });
    }
    for (const editor of data.config.editors) {
      store.setAgentCardState(editor.agentSlug, editor.llmConfigId, {
        agentSlug: editor.agentSlug,
        llmConfigId: editor.llmConfigId,
        status: 'idle',
      });
    }
    for (const evaluator of data.config.evaluators) {
      store.setAgentCardState(evaluator.agentSlug, evaluator.llmConfigId, {
        agentSlug: evaluator.agentSlug,
        llmConfigId: evaluator.llmConfigId,
        status: 'idle',
      });
    }

    // Start execution
    const response = await marketingSwarmService.startSwarmExecution(
      orgSlug.value,
      userId.value,
      conversationId,
      taskId,
      data.contentTypeSlug,
      data.contentTypeContext,
      data.promptData,
      data.config
    );

    console.log('Swarm execution completed:', response);
  } catch (err) {
    console.error('Swarm execution failed:', err);
  }
}

// Handle restart - go back to config
function handleRestart() {
  store.resetTaskState();
  store.setUIView('config');
}
</script>

<style scoped>
.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.error-container ion-icon {
  font-size: 48px;
}

.error-container p {
  color: var(--ion-color-medium);
  text-align: center;
  max-width: 300px;
}
</style>
