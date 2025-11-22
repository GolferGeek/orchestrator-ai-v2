<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/admin/settings"></ion-back-button>
        </ion-buttons>
        <ion-title>User Management</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshUsers">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Organization Selector -->
      <ion-card v-if="organizations.length > 1">
        <ion-card-content>
          <ion-item>
            <ion-label>Organization</ion-label>
            <ion-select v-model="selectedOrg" @ionChange="onOrgChange">
              <ion-select-option
                v-for="org in organizations"
                :key="org.slug"
                :value="org.slug"
              >
                {{ org.name }}
              </ion-select-option>
            </ion-select>
          </ion-item>
        </ion-card-content>
      </ion-card>

      <!-- Loading State -->
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner></ion-spinner>
        <p>Loading users...</p>
      </div>

      <!-- Users List -->
      <ion-card v-else>
        <ion-card-header>
          <ion-card-title>Users in {{ selectedOrgName }}</ion-card-title>
          <ion-card-subtitle>{{ users.length }} users</ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item v-for="user in users" :key="user.id" @click="openUserModal(user)">
              <ion-avatar slot="start">
                <div class="avatar-placeholder">{{ getInitials(user.email) }}</div>
              </ion-avatar>
              <ion-label>
                <h2>{{ user.displayName || user.email }}</h2>
                <p>{{ user.email }}</p>
                <p class="roles-list">
                  <ion-badge
                    v-for="role in user.roles"
                    :key="role.name"
                    :color="getRoleBadgeColor(role.name)"
                    class="role-badge"
                  >
                    {{ role.displayName }}
                  </ion-badge>
                </p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
            </ion-item>
          </ion-list>

          <div v-if="users.length === 0" class="ion-text-center ion-padding">
            <ion-icon :icon="peopleOutline" size="large" color="medium"></ion-icon>
            <p>No users found in this organization</p>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- User Edit Modal -->
      <ion-modal :is-open="showUserModal" @didDismiss="closeUserModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Edit User Roles</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeUserModal">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedUser">
          <ion-card>
            <ion-card-header>
              <ion-card-title>{{ selectedUser.displayName || selectedUser.email }}</ion-card-title>
              <ion-card-subtitle>{{ selectedUser.email }}</ion-card-subtitle>
            </ion-card-header>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Current Roles</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-chip
                v-for="role in selectedUser.roles"
                :key="role.name"
                :color="getRoleBadgeColor(role.name)"
                @click="confirmRemoveRole(role)"
              >
                <ion-label>{{ role.displayName }}</ion-label>
                <ion-icon :icon="closeCircleOutline"></ion-icon>
              </ion-chip>
              <p v-if="selectedUser.roles.length === 0" class="ion-text-center">
                No roles assigned
              </p>
            </ion-card-content>
          </ion-card>

          <ion-card>
            <ion-card-header>
              <ion-card-title>Add Role</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                <ion-item
                  v-for="role in availableRolesToAdd"
                  :key="role.name"
                  button
                  @click="addRole(role)"
                >
                  <ion-label>
                    <h3>{{ role.displayName }}</h3>
                    <p>{{ role.description }}</p>
                  </ion-label>
                  <ion-icon :icon="addCircleOutline" slot="end" color="primary"></ion-icon>
                </ion-item>
              </ion-list>
              <p v-if="availableRolesToAdd.length === 0" class="ion-text-center">
                User has all available roles
              </p>
            </ion-card-content>
          </ion-card>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonButtons,
  IonBackButton, IonSpinner, IonSelect, IonSelectOption, IonBadge,
  IonModal, IonChip, IonAvatar, alertController, toastController
} from '@ionic/vue';
import {
  refreshOutline, chevronForwardOutline, peopleOutline,
  closeCircleOutline, addCircleOutline
} from 'ionicons/icons';
import { useRbacStore } from '@/stores/rbacStore';
import rbacService, { type UserRole, type RbacRole } from '@/services/rbacService';

interface UserWithRoles {
  id: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
}

const rbacStore = useRbacStore();

const loading = ref(false);
const users = ref<UserWithRoles[]>([]);
const selectedOrg = ref<string>('');
const showUserModal = ref(false);
const selectedUser = ref<UserWithRoles | null>(null);

const organizations = computed(() => rbacStore.userOrganizations.map(org => ({
  slug: org.organizationSlug,
  name: org.organizationName
})));

const selectedOrgName = computed(() => {
  const org = organizations.value.find(o => o.slug === selectedOrg.value);
  return org?.name || selectedOrg.value;
});

const availableRolesToAdd = computed(() => {
  if (!selectedUser.value) return [];
  const userRoleNames = selectedUser.value.roles.map(r => r.name);
  return rbacStore.allRoles.filter(r => !userRoleNames.includes(r.name) && !r.isSystem);
});

onMounted(async () => {
  if (!rbacStore.isInitialized) {
    await rbacStore.initialize();
  }
  if (rbacStore.currentOrganization) {
    selectedOrg.value = rbacStore.currentOrganization;
  } else if (organizations.value.length > 0) {
    selectedOrg.value = organizations.value[0].slug;
  }
  await refreshUsers();
});

async function refreshUsers() {
  if (!selectedOrg.value) return;
  loading.value = true;
  try {
    // For now, we'll show a placeholder - in a real implementation,
    // you'd have an endpoint to list all users in an organization
    users.value = [];
    const toast = await toastController.create({
      message: 'User listing requires additional backend endpoint',
      duration: 2000,
      color: 'warning'
    });
    await toast.present();
  } catch (error) {
    console.error('Failed to load users:', error);
  } finally {
    loading.value = false;
  }
}

async function onOrgChange() {
  await rbacStore.setOrganization(selectedOrg.value);
  await refreshUsers();
}

function openUserModal(user: UserWithRoles) {
  selectedUser.value = user;
  showUserModal.value = true;
}

function closeUserModal() {
  showUserModal.value = false;
  selectedUser.value = null;
}

async function addRole(role: RbacRole) {
  if (!selectedUser.value) return;
  try {
    await rbacService.assignRole(
      selectedUser.value.id,
      selectedOrg.value,
      role.name
    );
    selectedUser.value.roles.push({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      isGlobal: false,
      assignedAt: new Date().toISOString()
    });
    const toast = await toastController.create({
      message: `Role "${role.displayName}" added`,
      duration: 2000,
      color: 'success'
    });
    await toast.present();
  } catch (error) {
    console.error('Failed to add role:', error);
    const toast = await toastController.create({
      message: 'Failed to add role',
      duration: 2000,
      color: 'danger'
    });
    await toast.present();
  }
}

async function confirmRemoveRole(role: UserRole) {
  const alert = await alertController.create({
    header: 'Remove Role',
    message: `Remove "${role.displayName}" role from this user?`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Remove',
        role: 'destructive',
        handler: () => removeRole(role)
      }
    ]
  });
  await alert.present();
}

async function removeRole(role: UserRole) {
  if (!selectedUser.value) return;
  try {
    await rbacService.revokeRole(
      selectedUser.value.id,
      selectedOrg.value,
      role.name
    );
    selectedUser.value.roles = selectedUser.value.roles.filter(r => r.name !== role.name);
    const toast = await toastController.create({
      message: `Role "${role.displayName}" removed`,
      duration: 2000,
      color: 'success'
    });
    await toast.present();
  } catch (error) {
    console.error('Failed to remove role:', error);
    const toast = await toastController.create({
      message: 'Failed to remove role',
      duration: 2000,
      color: 'danger'
    });
    await toast.present();
  }
}

function getInitials(email: string): string {
  return email.substring(0, 2).toUpperCase();
}

function getRoleBadgeColor(roleName: string): string {
  const colors: Record<string, string> = {
    'super-admin': 'danger',
    'admin': 'warning',
    'manager': 'tertiary',
    'member': 'primary',
    'viewer': 'medium'
  };
  return colors[roleName] || 'medium';
}
</script>

<style scoped>
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-primary);
  color: white;
  font-weight: bold;
  border-radius: 50%;
}

.roles-list {
  margin-top: 4px;
}

.role-badge {
  margin-right: 4px;
  font-size: 0.75rem;
}

ion-chip {
  margin: 4px;
}
</style>
