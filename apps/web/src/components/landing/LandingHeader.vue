<template>
  <header class="landing-header" :class="{ 'white-bg': isWhiteHeaderPage }">
    <div class="header-content">
      <router-link to="/" class="logo">
        <h1>Orchestrator AI</h1>
        <span class="tagline">AI for Small Business</span>
      </router-link>



      <!-- Main Navigation -->
      <nav class="header-nav">
        <OrganizationSwitcher v-if="authStore.isAuthenticated" />
        <!-- View Toggle - only show in demo organization -->
        <ViewToggle v-if="isDemoOrg" />
        <ion-button
          v-if="!authStore.isAuthenticated"
          fill="clear"
          size="small"
          class="agent-ideas-button"
          @click="openAgentIdeasModal"
        >
          <ion-icon slot="start" :icon="sparklesOutline"></ion-icon>
          <span class="button-text">How can agents help you?</span>
        </ion-button>
        <ion-button
          fill="outline"
          size="small"
          class="login-button"
          :class="{ 'active-button': isVideosPage }"
          @click="navigateToVideos"
        >
          <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
          All Videos
        </ion-button>
        <ion-button
          fill="outline"
          size="small"
          class="login-button"
          @click="navigateToApp"
        >
          <ion-icon slot="start" :icon="appsOutline"></ion-icon>
          {{ authStore.isAuthenticated ? 'Enter App' : 'Login' }}
        </ion-button>
      </nav>
    </div>

    <!-- Agent Ideas Modal -->
    <AgentIdeasModal />
  </header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import {
  playCircleOutline,
  appsOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/rbacStore';
import { useAgentIdeasStore } from '@/stores/agentIdeasStore';
import { storeToRefs } from 'pinia';
import OrganizationSwitcher from '@/components/common/OrganizationSwitcher.vue';
import ViewToggle from '@/components/landing/ViewToggle.vue';
import AgentIdeasModal from '@/components/landing/AgentIdeasModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const agentIdeasStore = useAgentIdeasStore();
const { currentOrganization } = storeToRefs(authStore);

// Check if we're in the demo organization
const isDemoOrg = computed(() => {
  return (currentOrganization?.value || 'demo-org') === 'demo-org';
});

// Check if we are on the videos page
const isVideosPage = computed(() => {
  return route.path === '/videos';
});

// Check if we show white header (videos or technical page)
const isWhiteHeaderPage = computed(() => {
  return ['/videos', '/technical'].includes(route.path);
});

function navigateToVideos() {
  router.push('/videos');
}

function navigateToApp() {
  if (authStore.isAuthenticated) {
    router.push('/app');
  } else {
    router.push('/login?redirect=/app');
  }
}

function openAgentIdeasModal() {
  agentIdeasStore.openModal();
}
</script>
<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(253, 248, 246, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(139, 90, 60, 0.1);
  z-index: 1000;
  padding: var(--space-3) 0;
  box-shadow: var(--shadow-brown);
}

.white-bg {
  background: white !important;
}
.header-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.logo h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0;
  line-height: 1;
  letter-spacing: -0.025em;
}

.logo {
  cursor: pointer;
  transition: var(--transition-smooth);
  text-decoration: none;
  display: block;
}
.logo:hover {
  opacity: 0.8;
}
.logo .tagline {
  font-size: var(--text-xs);
  color: var(--landing-secondary);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.075em;
}
.header-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.agent-ideas-button {
  --color: var(--landing-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-sm);
  --border-radius: var(--radius-lg);
  transition: var(--transition-smooth);
}

.agent-ideas-button:hover {
  --background: var(--landing-primary-50);
  transform: translateY(-1px);
}

.agent-ideas-button ion-icon {
  font-size: 1.1rem;
}

.login-button {
  --border-color: var(--landing-primary);
  --color: var(--landing-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-sm);
  --border-radius: var(--radius-lg);
  --box-shadow: var(--shadow-sm);
  transition: var(--transition-smooth);
}
.login-button:hover,
.active-button {
  --background: var(--landing-primary);
  --color: var(--landing-white);
  --border-color: var(--landing-primary);
  --box-shadow: var(--shadow-forest);
  transform: translateY(-1px);
}
/* Mobile responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
  }
  .header-nav {
    gap: 0.75rem;
  }
  .agent-ideas-button .button-text {
    display: none;
  }
  .login-button {
    font-size: 0.75rem;
  }
}

/* Add top padding to body content to account for fixed header */
:global(body) {
  padding-top: 60px;
}
</style>
