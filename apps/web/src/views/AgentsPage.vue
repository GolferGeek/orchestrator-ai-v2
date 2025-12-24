<template>
  <ion-page>
    <ion-split-pane content-id="agents-main-content" when="(min-width: 2000px)">
      <ion-menu content-id="agents-main-content" type="overlay" :disabled="!auth.isAuthenticated" @ionWillOpen="handleMenuOpen" @ionWillClose="handleMenuClose">
        <ion-header>
          <ion-toolbar>
            <ion-title
              class="clickable-title"
              @click="navigateToLanding"
            >
              {{ menuTitle }}
            </ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div v-if="auth.isAuthenticated">
            <div class="user-header">
              <ion-note v-if="auth.user" class="user-email">{{ auth.user.displayName || auth.user.email }}</ion-note>
              <a
                v-if="auth.hasAdminAccess || auth.hasEvaluationAccess"
                class="admin-link"
                :class="{ 'active': $route.path.startsWith('/app/admin') }"
                @click="$router.push('/app/admin/settings')"
              >Admin</a>
            </div>
            <ion-item lines="none" :detail="false" :button="true" @click="handleLogout">
              <ion-icon aria-hidden="true" :icon="logOutOutline" slot="start"></ion-icon>
              <ion-label>Logout</ion-label>
            </ion-item>
            <hr/>

            <!-- Deliverables & Evaluations Accordion -->
            <ion-accordion-group>
              <ion-accordion value="main-nav">
                <ion-item slot="header" color="none" class="accordion-header-custom">
                  <ion-icon aria-hidden="true" :icon="documentTextOutline" slot="start"></ion-icon>
                  <ion-label>Deliverables & Evaluations</ion-label>
                </ion-item>
                <div slot="content" class="main-nav-content">
                  <ion-list>
                    <ion-item
                      :button="true"
                      lines="none"
                      :detail="false"
                      @click="$router.push('/app/deliverables')"
                      :class="{ 'selected': $route.path.startsWith('/app/deliverables') }"
                    >
                      <ion-icon aria-hidden="true" :icon="documentTextOutline" slot="start"></ion-icon>
                      <ion-label>Deliverables</ion-label>
                    </ion-item>
                    <ion-item
                      :button="true"
                      lines="none"
                      :detail="false"
                      @click="$router.push('/app/evaluations')"
                      :class="{ 'selected': $route.path.startsWith('/app/evaluations') }"
                    >
                      <ion-icon aria-hidden="true" :icon="starOutline" slot="start"></ion-icon>
                      <ion-label>Evaluations</ion-label>
                    </ion-item>
                  </ion-list>
                </div>
              </ion-accordion>
            </ion-accordion-group>
              
              <!-- Agents & Conversations Accordion - Takes remaining space -->
              <ion-accordion-group :value="agentsExpanded ? 'agents' : undefined">
                <ion-accordion value="agents">
                  <ion-item slot="header" color="none" class="accordion-header-custom">
                    <ion-icon aria-hidden="true" :icon="chatbubblesOutline" slot="start"></ion-icon>
                    <ion-label>Agents & Conversations</ion-label>
                  </ion-item>
                  <div slot="content" class="agents-content">
                    <!-- Agent Tree -->
                    <AgentTreeView 
                      @conversation-selected="handleConversationSelected"
                      @agent-selected="handleAgentSelected"
                      :compact-mode="true"
                    />
                  </div>
                </ion-accordion>
              </ion-accordion-group>
          </div>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="agents-main-content"></ion-router-outlet>

      <!-- Fixed floating toolbar - org switcher and theme toggle -->
      <div class="fixed-toolbar" v-if="auth.isAuthenticated">
        <OrganizationSwitcherApp />
        <button class="theme-toggle" @click="toggleTheme" :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'">
          <ion-icon :icon="isDarkMode ? sunnyOutline : moonOutline"></ion-icon>
        </button>
        <SuperAdminCommandButton @open="showCommandPanel = true" />
      </div>
    </ion-split-pane>

    <!-- Super Admin Claude Code Panel -->
    <SuperAdminCommandPanel
      v-if="showCommandPanel"
      @close="showCommandPanel = false"
    />
  </ion-page>
</template>
<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue';
import {
  IonPage, IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonNote, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle, IonAccordion, IonAccordionGroup
} from '@ionic/vue';
import { logOutOutline, starOutline, chatbubblesOutline, documentTextOutline, sunnyOutline, moonOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/rbacStore';
import { conversation } from '@/services/conversationHelpers';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import { useRouter } from 'vue-router';
import AgentTreeView from '@/components/AgentTreeView.vue';
import OrganizationSwitcherApp from '@/components/common/OrganizationSwitcherApp.vue';
import SuperAdminCommandButton from '@/components/super-admin/SuperAdminCommandButton.vue';
import SuperAdminCommandPanel from '@/components/super-admin/SuperAdminCommandPanel.vue';

const auth = useAuthStore();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const userPreferencesStore = useUserPreferencesStore();
const router = useRouter();
// State for accordion and search
const _mainNavExpanded = ref(true); // Main navigation accordion starts expanded
const agentsExpanded = ref(true);

// State for super admin command panel
const showCommandPanel = ref(false);

// Theme - use the preferences store
const isDarkMode = computed(() => userPreferencesStore.effectiveTheme === 'dark');

function toggleTheme() {
  const newTheme = isDarkMode.value ? 'light' : 'dark';
  userPreferencesStore.setTheme(newTheme);
}

// Initialize preferences on mount
onMounted(() => {
  userPreferencesStore.initializePreferences();
});

// Dynamic titles based on current route
const menuTitle = computed(() => {
  return 'Orchestrator AI';
});
const handleMenuOpen = () => {
  // Blur active element to prevent aria-hidden accessibility warning
  // when Ionic sets aria-hidden on the main content behind the menu
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const handleMenuClose = () => {
  // Blur any focused element inside the menu before it closes
  // This prevents the aria-hidden warning when focus is trapped in the menu
  // as the main content regains visibility
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};
const navigateToLanding = () => {
  router.push('/');
};
const handleConversationSelected = async (conversation: Record<string, unknown>) => {
  try {

    // Set the active conversation in the store
    chatUiStore.setActiveConversation(conversation.id);

    // Set flag in sessionStorage to indicate active conversation
    sessionStorage.setItem('activeConversation', 'true');

    // Navigate to home page to show the conversation
    await router.push({ path: '/app/home', query: { forceHome: 'true', conversationId: conversation.id } });
  } catch (error) {
    console.error('Error selecting conversation:', error);
  }
};
const handleAgentSelected = async (agent: Record<string, unknown>) => {
  try {
    // Always create a conversation first - this shows up in the sidebar under the agent
    const conversationId = await conversation.createConversation(agent);

    // Refresh conversations list to show the new conversation in sidebar
    await conversationsStore.fetchConversations(true);

    // Set flag in sessionStorage to indicate active conversation for admin users
    sessionStorage.setItem('activeConversation', 'true');

    // All conversations (including custom UI agents) go through the tab system
    // The ConversationView will detect hasCustomUI and render the appropriate custom component
    router.push({ path: '/app/home', query: { forceHome: 'true', conversationId } });
  } catch (error) {
    console.error('Failed to handle agent selection:', error);
  }
};
</script>
<style scoped>
/* Fixed floating toolbar - org switcher and theme toggle */
.fixed-toolbar {
  position: fixed;
  top: 8px;
  right: 60px;
  z-index: 9999;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--ion-border-color, #d0d0d0);
  border-radius: 4px;
  background: #ffffff;
  color: #333333;
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-toggle:hover {
  background: #f0f0f0;
}

.theme-toggle ion-icon {
  font-size: 18px;
  color: #333333;
}

/* Dark mode overrides for theme toggle */
:global(html.ion-palette-dark) .theme-toggle,
:global(html[data-theme="dark"]) .theme-toggle {
  background: var(--ion-background-color, #1a1a1a);
  color: var(--ion-text-color, #ffffff);
  border-color: var(--ion-border-color, #444444);
}

:global(html.ion-palette-dark) .theme-toggle:hover,
:global(html[data-theme="dark"]) .theme-toggle:hover {
  background: var(--ion-color-step-100, #2a2a2a);
}

:global(html.ion-palette-dark) .theme-toggle ion-icon,
:global(html[data-theme="dark"]) .theme-toggle ion-icon {
  color: var(--ion-text-color, #ffffff);
}

/* Organization switcher in toolbar */
.org-switcher-container {
  padding-right: 12px;
  display: flex;
  align-items: center;
}

/* Clickable title styling */
.clickable-title {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.clickable-title:hover {
  opacity: 0.8;
  transform: scale(1.02);
}
/* Basic styling for user info in menu */
ion-note {
  display: block;
  padding-left: 16px;
  padding-bottom: 8px;
  font-size: 0.9em;
  color: var(--ion-color-medium-shade);
}
hr {
  border: none;
  border-top: 1px solid var(--ion-color-step-150, #e0e0e0);
  margin: 8px 0;
}
/* Accordion header styling - burnt orange theme with opacity */
.accordion-header-custom {
  /* Subtle primary-tinted background using theme color */
  background-color: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  background: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  --background: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  --ion-background-color: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  border-radius: 6px !important;
  margin: 2px 0 !important;
  font-weight: 500 !important;
  --color: var(--ion-color-dark) !important;
  color: var(--ion-color-dark) !important;
}

/* Try targeting the actual Ionic CSS variables */
ion-accordion {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
}

ion-accordion ion-item {
  --background: var(--ion-color-primary) !important;
  --color: var(--ion-color-primary-contrast) !important;
}

/* Main navigation accordion content */
.main-nav-content {
  padding: 0;
  background: white !important;
  display: block !important;
  visibility: visible !important;
}

.main-nav-content ion-list {
  padding: 0;
  background: white !important;
}

.main-nav-content ion-item {
  --padding-start: 32px;
  --padding-end: 16px;
  font-size: 0.9rem;
  display: block !important;
  --background: white !important;
  background: white !important;
  --color: #333 !important;
  color: #333 !important;
}

/* Navigation item selected state */
ion-item.selected {
  --background: var(--ion-color-primary-tint, #e3f2fd);
  --color: var(--ion-color-primary, #1976d2);
  font-weight: 500;
  border-left: 3px solid var(--ion-color-primary, #1976d2);
}
/* Consistent compact sidebar width for all screen sizes */
ion-menu {
  --width: var(--app-sidebar-width);
}
/* Ensure split-pane (static) sidebar width matches hamburger menu width */
ion-split-pane {
  --side-min-width: var(--app-sidebar-width);
  --side-max-width: var(--app-sidebar-width);
}
/* User header with admin link */
.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 4px 16px;
}

.user-email {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  padding: 0;
}

.admin-link {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ion-color-primary);
  cursor: pointer;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.admin-link:hover {
  background: var(--ion-color-primary-tint);
}

.admin-link.active {
  background: var(--ion-color-primary);
  color: white;
}


/* Agents & Conversations accordion content */
.agents-content {
  padding: 0;
  flex: 1;
  min-height: 0; /* Allow flex child to shrink */
  overflow-y: auto;
}
/* Controls at top of agents accordion */
.agents-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--ion-color-step-50);
  border-bottom: 1px solid var(--ion-color-step-150);
}
.compact-searchbar {
  flex: 1;
  --border-radius: 8px;
  --box-shadow: none;
  --background: var(--ion-color-step-100);
}
.refresh-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  min-width: 40px;
}
/* Compact styles for tree view in menu - Updated selectors */
.agents-content :deep(.agent-tree-view) {
  padding-left: 32px; /* Indent entire agent tree */
}

.agents-content :deep(.organization-header) {
  margin-left: 16px; /* Indent organization headers */
}

.agents-content :deep(.agent-section) {
  margin-left: 32px; /* Indent agent sections */
}

.agents-content :deep(.agent-header-button) {
  margin-left: 16px; /* Indent agent headers */
}

.agents-content :deep(.agent-type-content) {
  padding-left: 24px; /* Indent agent type content */
}

/* Legacy selectors for backward compatibility */
.agents-content :deep(.department-section) {
  margin-left: 48px;
}

.agents-content :deep(.department-header) {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  margin-left: 32px;
}

.agents-content :deep(.agent-item) {
  padding: 0.5rem 1.5rem;
  font-size: 0.85rem;
  margin-left: 64px;
}
/* Dark theme support for navigation - class-based */
:global(html.ion-palette-dark) ion-item.selected,
:global(html[data-theme="dark"]) ion-item.selected {
  --background: #1e3a8a;
  --color: #3b82f6;
  border-left-color: #3b82f6;
}

/* Dark theme accordion headers */
:global(html.ion-palette-dark) ion-accordion-group ion-accordion ion-item[slot="header"],
:global(html[data-theme="dark"]) ion-accordion-group ion-accordion ion-item[slot="header"] {
  --background: var(--ion-color-primary-shade) !important;
  --color: var(--ion-color-primary-contrast) !important;
}

:global(html.ion-palette-dark) .accordion-header-custom,
:global(html[data-theme="dark"]) .accordion-header-custom {
  background-color: rgba(var(--ion-color-primary-rgb), 0.45) !important;
  background: rgba(var(--ion-color-primary-rgb), 0.45) !important;
}

:global(html.ion-palette-dark) .main-nav-content,
:global(html[data-theme="dark"]) .main-nav-content {
  background: var(--ion-color-step-50);
}

:global(html.ion-palette-dark) .agents-content,
:global(html[data-theme="dark"]) .agents-content {
  background: var(--ion-color-step-50);
}

:global(html.ion-palette-dark) .agents-controls,
:global(html[data-theme="dark"]) .agents-controls {
  background: var(--ion-color-step-100);
  border-bottom-color: var(--ion-color-step-200);
}
</style>
