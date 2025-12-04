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
            <ion-select
              :value="selectedOrg"
              @ionChange="onOrgChange($event)"
              interface="popover"
            >
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
              <ion-card-title>Effective Permissions</ion-card-title>
              <ion-card-subtitle>Permissions granted through assigned roles</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div v-if="userPermissions.length > 0" class="permissions-grid">
                <ion-chip
                  v-for="permission in userPermissions"
                  :key="permission.name"
                  color="primary"
                  outline
                >
                  <ion-label>{{ permission.displayName }}</ion-label>
                </ion-chip>
              </div>
              <p v-else class="ion-text-center">
                No permissions assigned
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
import rbacService, { type UserRole, type RbacRole, type RbacPermission } from '@/services/rbacService';

interface UserWithRoles {
  id: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
}

const rbacStore = useRbacStore();

const loading = ref(false);
const showUserModal = ref(false);
const selectedUser = ref<UserWithRoles | null>(null);
const selectedUserPermissions = ref<RbacPermission[]>([]);

const organizations = computed(() => rbacStore.userOrganizations.map(org => ({
  slug: org.organizationSlug,
  name: org.organizationName
})));

const selectedOrg = computed(() => rbacStore.currentOrganization || '');

const selectedOrgName = computed(() => {
  const org = organizations.value.find(o => o.slug === selectedOrg.value);
  return org?.name || selectedOrg.value;
});

// Users come from the store - reactive to org changes
const users = computed(() => {
  return rbacStore.currentOrgUsers.map(user => ({
    id: user.userId,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles
  }));
});

const availableRolesToAdd = computed(() => {
  if (!selectedUser.value) return [];
  const userRoleNames = selectedUser.value.roles.map(r => r.name);
  return rbacStore.allRoles.filter(r => !userRoleNames.includes(r.name) && !r.isSystem);
});

const userPermissions = computed(() => selectedUserPermissions.value);

onMounted(async () => {
  if (!rbacStore.isInitialized) {
    await rbacStore.initialize();
  }

  // Set initial organization if not already set
  if (!rbacStore.currentOrganization && organizations.value.length > 0) {
    await rbacStore.setOrganization(organizations.value[0].slug);
  }
});

async function refreshUsers() {
  // Reload users for current organization
  if (rbacStore.currentOrganization) {
    loading.value = true;
    try {
      await rbacStore.loadOrganizationUsers(rbacStore.currentOrganization);
    } catch (error) {
      console.error('Failed to load users:', error);
      const toast = await toastController.create({
        message: 'Failed to load users. Please try again.',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      loading.value = false;
    }
  }
}

async function onOrgChange(event: CustomEvent) {
  const newOrg = event.detail.value;
  if (newOrg === rbacStore.currentOrganization) return; // No change

  loading.value = true;
  try {
    // Store handles loading users automatically
    await rbacStore.setOrganization(newOrg);
  } catch (error) {
    console.error('Failed to change organization:', error);
    const toast = await toastController.create({
      message: 'Failed to load organization data',
      duration: 2000,
      color: 'danger'
    });
    await toast.present();
  } finally {
    loading.value = false;
  }
}

async function refreshUserPermissions() {
  if (!selectedUser.value) return;

  try {
    const userPerms = await rbacService.getUserPermissions(selectedUser.value.id, selectedOrg.value);

    // Map permission names to full permission objects with display names
    const permNames = userPerms.map(p => p.permission);

    // If user has wildcard permission, show all permissions
    if (permNames.includes('*:*')) {
      selectedUserPermissions.value = rbacStore.allPermissions;
    } else {
      // Map permission names to permission objects
      selectedUserPermissions.value = rbacStore.allPermissions.filter(p =>
        permNames.includes(p.name)
      );
    }
  } catch (error) {
    console.error('Failed to load user permissions:', error);
    selectedUserPermissions.value = [];
  }
}

async function openUserModal(user: UserWithRoles) {
  selectedUser.value = user;
  selectedUserPermissions.value = [];
  showUserModal.value = true;

  // Fetch user's permissions
  await refreshUserPermissions();
}

function closeUserModal() {
  showUserModal.value = false;
  selectedUser.value = null;
  selectedUserPermissions.value = [];
}

async function addRole(role: RbacRole) {
  if (!selectedUser.value || !rbacStore.currentOrganization) return;
  try {
    await rbacService.assignRole(
      selectedUser.value.id,
      rbacStore.currentOrganization,
      role.name
    );

    // Reload users from store to get updated data
    await rbacStore.loadOrganizationUsers(rbacStore.currentOrganization);

    // Update the selected user reference to the newly loaded data
    const updatedUser = rbacStore.currentOrgUsers.find(u => u.userId === selectedUser.value!.id);
    if (updatedUser) {
      selectedUser.value = {
        id: updatedUser.userId,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        roles: updatedUser.roles
      };
    }

    // Refresh permissions to reflect the new role
    await refreshUserPermissions();

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
  if (!selectedUser.value || !rbacStore.currentOrganization) return;
  try {
    await rbacService.revokeRole(
      selectedUser.value.id,
      rbacStore.currentOrganization,
      role.name
    );

    // Reload users from store to get updated data
    await rbacStore.loadOrganizationUsers(rbacStore.currentOrganization);

    // Update the selected user reference to the newly loaded data
    const updatedUser = rbacStore.currentOrgUsers.find(u => u.userId === selectedUser.value!.id);
    if (updatedUser) {
      selectedUser.value = {
        id: updatedUser.userId,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        roles: updatedUser.roles
      };
    }

    // Refresh permissions to reflect the role removal
    await refreshUserPermissions();

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

.permissions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
