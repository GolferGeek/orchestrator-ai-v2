<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/app/admin/settings"></ion-back-button>
        </ion-buttons>
        <ion-title>Roles & Permissions</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshData">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Loading State -->
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-spinner></ion-spinner>
        <p>Loading roles and permissions...</p>
      </div>

      <template v-else>
        <!-- Roles Section -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon :icon="shieldCheckmarkOutline" class="section-icon"></ion-icon>
              System Roles
            </ion-card-title>
            <ion-card-subtitle>{{ roles.length }} roles defined</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item
                v-for="role in roles"
                :key="role.id"
                @click="selectRole(role)"
                :class="{ 'selected-role': selectedRole?.id === role.id }"
                button
              >
                <ion-icon
                  :icon="role.isSystem ? lockClosedOutline : createOutline"
                  slot="start"
                  :color="role.isSystem ? 'medium' : 'primary'"
                ></ion-icon>
                <ion-label>
                  <h2>{{ role.displayName }}</h2>
                  <p>{{ role.description || 'No description' }}</p>
                </ion-label>
                <ion-badge slot="end" :color="getRoleBadgeColor(role.name)">
                  {{ role.name }}
                </ion-badge>
              </ion-item>
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Permissions by Category -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon :icon="keyOutline" class="section-icon"></ion-icon>
              Permissions
            </ion-card-title>
            <ion-card-subtitle>
              {{ selectedRole ? `Permissions for ${selectedRole.displayName}` : 'Select a role to view permissions' }}
            </ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div v-if="!selectedRole" class="ion-text-center ion-padding">
              <ion-icon :icon="handLeftOutline" size="large" color="medium"></ion-icon>
              <p>Select a role above to view its permissions</p>
            </div>

            <template v-else>
              <ion-accordion-group>
                <ion-accordion
                  v-for="(perms, category) in permissionsByCategory"
                  :key="category"
                  :value="category"
                >
                  <ion-item slot="header" color="light">
                    <ion-icon :icon="getCategoryIcon(category)" slot="start"></ion-icon>
                    <ion-label>
                      <h3>{{ formatCategory(category) }}</h3>
                      <p>{{ perms.length }} permissions</p>
                    </ion-label>
                  </ion-item>
                  <div class="ion-padding" slot="content">
                    <ion-list>
                      <ion-item v-for="perm in perms" :key="perm.id">
                        <ion-checkbox
                          slot="start"
                          :checked="roleHasPermission(perm.name)"
                          :disabled="selectedRole?.isSystem"
                          @ionChange="togglePermission(perm, $event)"
                        ></ion-checkbox>
                        <ion-label>
                          <h3>{{ perm.displayName }}</h3>
                          <p>{{ perm.name }}</p>
                          <p class="permission-desc">{{ perm.description }}</p>
                        </ion-label>
                      </ion-item>
                    </ion-list>
                  </div>
                </ion-accordion>
              </ion-accordion-group>
            </template>
          </ion-card-content>
        </ion-card>

        <!-- Audit Log -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon :icon="timeOutline" class="section-icon"></ion-icon>
              Recent Activity
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="auditLog.length > 0">
              <ion-item v-for="entry in auditLog" :key="entry.id">
                <ion-icon
                  :icon="getAuditIcon(entry.action)"
                  slot="start"
                  :color="getAuditColor(entry.action)"
                ></ion-icon>
                <ion-label>
                  <h3>{{ formatAuditAction(entry.action) }}</h3>
                  <p>{{ formatDate(entry.createdAt) }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div v-else class="ion-text-center ion-padding">
              <p>No recent activity</p>
            </div>
          </ion-card-content>
        </ion-card>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard,
  IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonButtons,
  IonBackButton, IonSpinner, IonBadge, IonAccordionGroup, IonAccordion,
  IonCheckbox, toastController
} from '@ionic/vue';
import {
  refreshOutline, shieldCheckmarkOutline, lockClosedOutline, createOutline,
  keyOutline, handLeftOutline, timeOutline, cloudOutline,
  settingsOutline, chatbubblesOutline, documentOutline, addCircleOutline,
  removeCircleOutline, swapHorizontalOutline
} from 'ionicons/icons';
import { useRbacStore } from '@/stores/rbacStore';
import rbacService, { type RbacRole, type RbacPermission, type AuditLogEntry } from '@/services/rbacService';

const rbacStore = useRbacStore();

const loading = ref(false);
const roles = ref<RbacRole[]>([]);
const selectedRole = ref<RbacRole | null>(null);
const rolePermissions = ref<string[]>([]);
const auditLog = ref<AuditLogEntry[]>([]);

const permissionsByCategory = computed(() => rbacStore.permissionsByCategory);

onMounted(async () => {
  await refreshData();
});

async function refreshData() {
  loading.value = true;
  try {
    if (!rbacStore.isInitialized) {
      await rbacStore.initialize();
    }
    await rbacStore.loadRolesAndPermissions();
    roles.value = rbacStore.allRoles;

    // Load audit log
    try {
      auditLog.value = await rbacService.getAuditLog(rbacStore.currentOrganization || undefined, 10);
    } catch {
      auditLog.value = [];
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
}

async function selectRole(role: RbacRole) {
  selectedRole.value = role;
  // Load permissions for this role
  try {
    rolePermissions.value = await rbacService.getRolePermissions(role.id);
  } catch (error) {
    console.error('Failed to load role permissions:', error);
    rolePermissions.value = [];
  }
}

function roleHasPermission(permName: string): boolean {
  return rolePermissions.value.includes(permName);
}

async function togglePermission(_perm: RbacPermission, _event: CustomEvent) {
  if (!selectedRole.value || selectedRole.value.isSystem) return;

  const toast = await toastController.create({
    message: `Permission changes require backend implementation`,
    duration: 2000,
    color: 'warning'
  });
  await toast.present();
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

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'rag': cloudOutline,
    'agents': chatbubblesOutline,
    'admin': settingsOutline,
    'llm': documentOutline,
    'deliverables': documentOutline,
    'system': shieldCheckmarkOutline
  };
  return icons[category] || keyOutline;
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

function getAuditIcon(action: string): string {
  if (action.includes('grant')) return addCircleOutline;
  if (action.includes('revoke')) return removeCircleOutline;
  return swapHorizontalOutline;
}

function getAuditColor(action: string): string {
  if (action.includes('grant')) return 'success';
  if (action.includes('revoke')) return 'danger';
  return 'primary';
}

function formatAuditAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}
</script>

<style scoped>
.section-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.selected-role {
  --background: var(--ion-color-primary-tint);
}

.permission-desc {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

ion-accordion-group {
  margin-top: 8px;
}
</style>
