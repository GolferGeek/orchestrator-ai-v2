<template>
  <div class="agent-dashboard-view">
    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <ion-spinner />
      <p>Loading dashboard...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <ion-icon :icon="alertCircleOutline" color="danger" />
      <p>{{ error }}</p>
    </div>

    <!-- Dashboard Content -->
    <!-- Each dashboard component handles its own ExecutionContext creation when making API calls -->
    <!-- Note: MarketingSwarm is NOT a dashboard - it uses the conversation pane with custom UI -->
    <template v-else-if="agent">
      <PredictionAgentPane
        v-if="dashboardComponent === 'prediction-dashboard' || dashboardComponent === 'PredictionAgentPane'"
        :agent="agent"
      />
      <RiskAgentPane
        v-else-if="dashboardComponent === 'investment-risk-dashboard' || dashboardComponent === 'RiskAgentPane'"
        :agent="agent"
      />
      <!-- Fallback for unknown dashboard types -->
      <div v-else class="unknown-dashboard">
        <ion-icon :icon="analyticsOutline" size="large" color="medium" />
        <h3>Dashboard: {{ agent.name }}</h3>
        <p>Dashboard component "{{ dashboardComponent }}" not implemented.</p>
      </div>
    </template>

    <!-- No Agent Found -->
    <div v-else class="no-agent">
      <ion-icon :icon="alertCircleOutline" color="medium" />
      <p>Agent not found</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonSpinner, IonIcon } from '@ionic/vue';
import { alertCircleOutline, analyticsOutline } from 'ionicons/icons';
import { useAgentsStore } from '@/stores/agentsStore';
import { agentsService } from '@/services/agentsService';
import { getDashboardComponent } from '@/utils/agent-interaction-mode';
import type { AgentInfo } from '@/types/chat';

// Dashboard components (not conversation pane components like MarketingSwarmTab)
import PredictionAgentPane from './AgentPanes/Prediction/PredictionAgentPane.vue';
import RiskAgentPane from './AgentPanes/Risk/RiskAgentPane.vue';

interface Props {
  agentSlug: string;
}

const props = defineProps<Props>();

const agentsStore = useAgentsStore();
const isLoading = ref(true);
const error = ref<string | null>(null);

// Find the agent by slug or name
const agent = computed<AgentInfo | null>(() => {
  if (!props.agentSlug) return null;

  // Try to find agent by slug first, then by name
  const found = agentsStore.availableAgents?.find(
    a => a.slug === props.agentSlug || a.name === props.agentSlug || a.id === props.agentSlug
  );

  return found || null;
});

// Get the dashboard component name for this agent
const dashboardComponent = computed<string | null>(() => {
  if (!agent.value) return null;

  // Check explicit customUIComponent - but skip conversation pane components
  // (marketing-swarm, cad-agent are conversation pane components, not dashboard components)
  const customComponent = agent.value.customUIComponent;
  if (customComponent && !['finance', 'marketing-swarm', 'cad-agent'].includes(customComponent)) {
    return customComponent;
  }

  // For agents with type 'dashboard' or interaction_mode 'dashboard', use PredictionAgentPane
  // This is the default dashboard for dashboard-type agents
  const agentType = agent.value.type?.toLowerCase();
  const interactionMode = (agent.value.metadata?.interaction_mode as string)?.toLowerCase();

  if (agentType === 'dashboard' || interactionMode === 'dashboard') {
    return 'PredictionAgentPane';
  }

  // Fall back to getDashboardComponent utility for other cases
  return getDashboardComponent(agent.value as Parameters<typeof getDashboardComponent>[0]);
});

// Ensure agents are loaded
const loadAgent = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // Ensure agents are loaded in the store using agentsService
    if (!agentsStore.availableAgents || agentsStore.availableAgents.length === 0) {
      const agents = await agentsService.getAvailableAgents();
      agentsStore.setAvailableAgents(agents);
    }

    // Check if agent was found
    if (!agent.value) {
      error.value = `Agent "${props.agentSlug}" not found`;
    }
  } catch (err) {
    console.error('Failed to load agent:', err);
    error.value = 'Failed to load agent';
  } finally {
    isLoading.value = false;
  }
};

onMounted(loadAgent);

// Reload when agentSlug changes
watch(() => props.agentSlug, loadAgent);
</script>

<style scoped>
.agent-dashboard-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state,
.no-agent,
.unknown-dashboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.loading-state ion-spinner {
  margin-bottom: 1rem;
}

.error-state ion-icon,
.no-agent ion-icon,
.unknown-dashboard ion-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.unknown-dashboard h3 {
  color: var(--ion-color-dark);
  margin-bottom: 0.5rem;
}
</style>
