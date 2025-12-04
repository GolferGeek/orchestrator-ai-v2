<template>
  <!-- Always show something for visibility -->
  <div v-if="availableOrgs.length > 1" class="org-switcher-app">
    <ion-select
      :value="currentOrg"
      interface="popover"
      :interface-options="{ cssClass: 'org-popover' }"
      aria-label="Select active organization"
      placeholder="Organization"
      @ionChange="onOrgChange"
    >
      <ion-select-option
        v-for="org in availableOrgs"
        :key="org.organizationSlug"
        :value="org.organizationSlug"
      >
        {{ org.organizationName || formatOrgName(org.organizationSlug) }}
      </ion-select-option>
    </ion-select>
  </div>
  <div v-else class="org-pill-app">
    {{ currentOrg ? formatOrgName(currentOrg) : 'No Org' }}
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { IonSelect, IonSelectOption } from '@ionic/vue';
import type { SelectCustomEvent } from '@ionic/vue';
import { useRbacStore } from '@/stores/rbacStore';
import { useEvaluationsStore } from '@/stores/evaluationsStore';
import { useAdminEvaluationStore } from '@/stores/adminEvaluationStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';

const rbacStore = useRbacStore();
const evaluationsStore = useEvaluationsStore();
const adminEvaluationStore = useAdminEvaluationStore();
const deliverablesStore = useDeliverablesStore();

const availableOrgs = computed(() => rbacStore.userOrganizations || []);
const currentOrg = computed(() => rbacStore.currentOrganization || 'demo-org');
const hasMultipleOrgs = computed(() => availableOrgs.value.length > 1);

// Debug logging
onMounted(() => {
  console.log('🔍 OrganizationSwitcherApp mounted');
  console.log('Available orgs:', availableOrgs.value);
  console.log('Current org:', currentOrg.value);
  console.log('isSuperAdmin:', rbacStore.isSuperAdmin);
  console.log('User:', rbacStore.user);
});

watch([availableOrgs, currentOrg], ([orgs, current]) => {
  console.log('🔍 Org data changed:', { orgs, current });
}, { deep: true });

async function onOrgChange(event: SelectCustomEvent) {
  const value = event.detail.value as string | null;
  if (value && value !== currentOrg.value) {
    console.log('🔄 Organization changing from', currentOrg.value, 'to', value);

    // Set new organization in rbacStore - this will trigger watchers
    await rbacStore.setOrganization(value);

    // Refresh other org-dependent stores
    // Note: Agents are refreshed by AgentTreeView watcher
    try {
      const refreshPromises = [];

      // Evaluations
      if (evaluationsStore.refresh) {
        refreshPromises.push(evaluationsStore.refresh());
      }

      // Admin evaluations
      if (adminEvaluationStore.refresh) {
        refreshPromises.push(adminEvaluationStore.refresh());
      }

      // Deliverables
      if (deliverablesStore.refresh) {
        refreshPromises.push(deliverablesStore.refresh());
      }

      await Promise.all(refreshPromises);
      console.log('✅ Organization changed and stores refreshed');
    } catch (error) {
      console.error('Error refreshing stores after org change:', error);
    }
  }
}

function formatOrgName(slug: string): string {
  return slug
    .split(/[\-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
</script>

<style scoped>
.org-switcher-app {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.org-pill-app {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  background: var(--ion-color-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid var(--ion-color-primary-shade);
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

ion-select {
  min-width: 160px;
  max-width: 200px;
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
  --padding-top: 0.5rem;
  --padding-bottom: 0.5rem;
  --min-height: 40px;
  --background: var(--ion-color-primary);
  --color: white;
  --placeholder-color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--ion-color-primary-shade);
}

ion-select::part(text) {
  color: white;
}

ion-select::part(icon) {
  color: white;
  opacity: 0.9;
}

ion-select::part(container) {
  border-radius: 6px;
}
</style>
