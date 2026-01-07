<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Teams</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="openCreateModal">
          <ion-icon :icon="addOutline" slot="icon-only" />
        </ion-button>
        <ion-button fill="clear" size="small" @click="refreshData" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <!-- Stats Banner -->
      <div class="stats-banner">
        <div class="stat">
          <span class="stat-value">{{ teams.length }}</span>
          <span class="stat-label">Total Teams</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ globalTeams.length }}</span>
          <span class="stat-label">Global Teams</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ orgTeams.length }}</span>
          <span class="stat-label">Org Teams</span>
        </div>
      </div>

      <!-- Search Bar and Actions -->
      <div class="filter-bar">
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search teams..."
          @ionInput="applyFilters"
          debounce="300"
        />
        <ion-button @click="openCreateModal">
          <ion-icon :icon="addOutline" slot="start" />
          New Team
        </ion-button>
      </div>

      <!-- Teams Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Organization</th>
              <th>Members</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="team in filteredTeams"
              :key="team.id"
              @click="openDetailModal(team)"
              class="clickable-row"
            >
              <td class="team-name">{{ team.name }}</td>
              <td>
                <ion-badge :color="team.orgSlug ? 'primary' : 'tertiary'">
                  {{ team.orgSlug ? 'Org' : 'Global' }}
                </ion-badge>
              </td>
              <td>
                <span v-if="team.orgSlug" class="mono">{{ team.orgSlug }}</span>
                <span v-else class="muted">-</span>
              </td>
              <td>{{ team.memberCount }}</td>
              <td>{{ formatDateTime(team.createdAt) }}</td>
              <td class="actions-cell" @click.stop>
                <ion-button fill="clear" size="small" @click="openEditModal(team)">
                  <ion-icon :icon="createOutline" slot="icon-only" />
                </ion-button>
                <ion-button fill="clear" size="small" @click="openMembersModal(team)">
                  <ion-icon :icon="peopleOutline" slot="icon-only" />
                </ion-button>
                <ion-button fill="clear" size="small" color="danger" @click="confirmDelete(team)">
                  <ion-icon :icon="trashOutline" slot="icon-only" />
                </ion-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-state" v-if="!loading && filteredTeams.length === 0">
        <ion-icon :icon="peopleOutline" />
        <h3>No Teams Found</h3>
        <p v-if="searchQuery">Try adjusting your search</p>
        <p v-else>Click the + button to create your first team</p>
      </div>

      <!-- Create/Edit Modal -->
      <ion-modal :is-open="showFormModal" @didDismiss="closeFormModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ editingTeam ? 'Edit Team' : 'Create Team' }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeFormModal">Cancel</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="form-container">
            <ion-item>
              <ion-label position="stacked">Name *</ion-label>
              <ion-input v-model="formData.name" placeholder="Team name" />
            </ion-item>

            <ion-item>
              <ion-label position="stacked">Description</ion-label>
              <ion-textarea
                v-model="formData.description"
                placeholder="Optional description..."
                auto-grow
              />
            </ion-item>

            <ion-item v-if="!editingTeam">
              <ion-label position="stacked">Team Type</ion-label>
              <ion-select v-model="formData.teamType" interface="popover">
                <ion-select-option value="global">Global (No Organization)</ion-select-option>
                <ion-select-option value="org">Organization-Scoped</ion-select-option>
              </ion-select>
            </ion-item>

            <ion-item v-if="!editingTeam && formData.teamType === 'org'">
              <ion-label position="stacked">Organization *</ion-label>
              <ion-select v-model="formData.orgSlug" interface="popover">
                <ion-select-option
                  v-for="org in organizations"
                  :key="org.slug"
                  :value="org.slug"
                >
                  {{ org.name }}
                </ion-select-option>
              </ion-select>
            </ion-item>

            <p class="hint" v-if="!editingTeam">
              {{ formData.teamType === 'global'
                ? 'Global teams are for cross-org collaboration (e.g., dev teams)'
                : 'Org teams are scoped to a specific organization' }}
            </p>

            <div class="form-actions">
              <ion-button expand="block" :disabled="!isFormValid || saving" @click="saveTeam">
                {{ saving ? 'Saving...' : (editingTeam ? 'Update' : 'Create') }}
              </ion-button>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Detail Modal -->
      <ion-modal :is-open="showDetailModal" @didDismiss="closeDetailModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ selectedTeam?.name }}</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeDetailModal">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="selectedTeam">
          <div class="team-detail">
            <div class="detail-section">
              <h4>Basic Information</h4>
              <div class="detail-row">
                <span class="detail-label">ID</span>
                <span class="detail-value mono">{{ selectedTeam.id }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Name</span>
                <span class="detail-value">{{ selectedTeam.name }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Type</span>
                <ion-badge :color="selectedTeam.orgSlug ? 'primary' : 'tertiary'">
                  {{ selectedTeam.orgSlug ? 'Organization' : 'Global' }}
                </ion-badge>
              </div>
              <div class="detail-row" v-if="selectedTeam.orgSlug">
                <span class="detail-label">Organization</span>
                <span class="detail-value mono">{{ selectedTeam.orgSlug }}</span>
              </div>
              <div class="detail-row" v-if="selectedTeam.description">
                <span class="detail-label">Description</span>
                <span class="detail-value">{{ selectedTeam.description }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Members</span>
                <span class="detail-value">{{ selectedTeam.memberCount }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h4>Timestamps</h4>
              <div class="detail-row">
                <span class="detail-label">Created</span>
                <span class="detail-value">{{ formatDateTime(selectedTeam.createdAt) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Updated</span>
                <span class="detail-value">{{ formatDateTime(selectedTeam.updatedAt) }}</span>
              </div>
            </div>

            <div class="detail-actions">
              <ion-button expand="block" @click="openEditFromDetail">Edit Team</ion-button>
              <ion-button expand="block" fill="outline" @click="openMembersFromDetail">
                Manage Members
              </ion-button>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Members Modal -->
      <ion-modal :is-open="showMembersModal" @didDismiss="closeMembersModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ membersTeam?.name }} - Members</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeMembersModal">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="members-container">
            <div class="members-header">
              <h4>Team Members ({{ teamMembers.length }})</h4>
              <ion-button size="small" @click="showAddMemberForm = !showAddMemberForm">
                <ion-icon :icon="addOutline" slot="start" />
                Add Member
              </ion-button>
            </div>

            <!-- Add Member Form -->
            <div v-if="showAddMemberForm" class="add-member-form">
              <ion-item>
                <ion-label position="stacked">User Email</ion-label>
                <ion-input v-model="newMemberEmail" placeholder="user@example.com" type="email" />
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Role</ion-label>
                <ion-select v-model="newMemberRole" interface="popover">
                  <ion-select-option value="member">Member</ion-select-option>
                  <ion-select-option value="lead">Lead</ion-select-option>
                  <ion-select-option value="admin">Admin</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-button
                expand="block"
                size="small"
                :disabled="!newMemberEmail || addingMember"
                @click="addMember"
              >
                {{ addingMember ? 'Adding...' : 'Add Member' }}
              </ion-button>
            </div>

            <!-- Members List -->
            <div class="members-list">
              <div v-for="member in teamMembers" :key="member.id" class="member-row">
                <div class="member-info">
                  <span class="member-email">{{ member.email }}</span>
                  <span class="member-name" v-if="member.displayName">
                    {{ member.displayName }}
                  </span>
                </div>
                <div class="member-actions">
                  <ion-select
                    :value="member.role"
                    @ionChange="updateMemberRole(member, $event.detail.value)"
                    interface="popover"
                    class="role-select"
                  >
                    <ion-select-option value="member">Member</ion-select-option>
                    <ion-select-option value="lead">Lead</ion-select-option>
                    <ion-select-option value="admin">Admin</ion-select-option>
                  </ion-select>
                  <ion-button
                    fill="clear"
                    size="small"
                    color="danger"
                    @click="removeMember(member)"
                  >
                    <ion-icon :icon="trashOutline" slot="icon-only" />
                  </ion-button>
                </div>
              </div>

              <div v-if="teamMembers.length === 0" class="empty-members">
                No members in this team yet.
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Delete Confirmation -->
      <ion-alert
        :is-open="showDeleteAlert"
        header="Delete Team"
        :message="`Are you sure you want to delete '${teamToDelete?.name}'? This action cannot be undone.`"
        :buttons="deleteAlertButtons"
        @didDismiss="showDeleteAlert = false"
      />

      <ion-loading :is-open="loading" message="Loading teams..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonLoading,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonAlert,
  IonBadge,
  toastController,
} from '@ionic/vue';
import {
  refreshOutline,
  addOutline,
  createOutline,
  trashOutline,
  peopleOutline,
} from 'ionicons/icons';
import { apiService } from '@/services/apiService';

interface Team {
  id: string;
  orgSlug?: string | null;
  name: string;
  description?: string;
  memberCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  role: string;
  joinedAt: string;
}

interface Organization {
  slug: string;
  name: string;
}

// State
const loading = ref(false);
const saving = ref(false);
const teams = ref<Team[]>([]);
const organizations = ref<Organization[]>([]);
const searchQuery = ref('');
const filterType = ref('all');
const showFormModal = ref(false);
const showDetailModal = ref(false);
const showMembersModal = ref(false);
const showDeleteAlert = ref(false);
const selectedTeam = ref<Team | null>(null);
const editingTeam = ref<Team | null>(null);
const teamToDelete = ref<Team | null>(null);
const membersTeam = ref<Team | null>(null);
const teamMembers = ref<TeamMember[]>([]);
const showAddMemberForm = ref(false);
const newMemberEmail = ref('');
const newMemberRole = ref('member');
const addingMember = ref(false);

const formData = ref({
  name: '',
  description: '',
  teamType: 'global' as 'global' | 'org',
  orgSlug: '',
});

// Computed
const globalTeams = computed(() => teams.value.filter(t => !t.orgSlug));
const orgTeams = computed(() => teams.value.filter(t => t.orgSlug));

const filteredTeams = computed(() => {
  let result = teams.value;

  // Apply type filter
  if (filterType.value === 'global') {
    result = result.filter(t => !t.orgSlug);
  } else if (filterType.value === 'org') {
    result = result.filter(t => t.orgSlug);
  }

  // Apply search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.orgSlug?.toLowerCase().includes(query)
    );
  }

  return result;
});

const isFormValid = computed(() => {
  if (!formData.value.name.trim()) return false;
  if (!editingTeam.value && formData.value.teamType === 'org' && !formData.value.orgSlug) {
    return false;
  }
  return true;
});

const deleteAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete', role: 'destructive', handler: () => performDelete() },
];

// Data fetching
const fetchTeams = async () => {
  loading.value = true;
  try {
    // Fetch global teams
    const globalData = await apiService.get('/teams');

    // Fetch org teams (for each org the user has access to)
    const orgsData = await apiService.get('/admin/organizations');
    organizations.value = (orgsData as Organization[]) || [];

    const orgTeamsPromises = organizations.value.map(org =>
      apiService.get(`/orgs/${org.slug}/teams`)
    );
    const orgTeamsResults = await Promise.all(orgTeamsPromises);

    // Combine all teams
    const allTeams: Team[] = [
      ...((globalData as Team[]) || []),
      ...orgTeamsResults.flatMap(r => (r as Team[]) || [])
    ];

    teams.value = allTeams;
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    teams.value = [];
    const toast = await toastController.create({
      message: 'Failed to load teams',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    loading.value = false;
  }
};

const fetchTeamMembers = async (teamId: string) => {
  try {
    const data = await apiService.get(`/teams/${teamId}/members`);
    teamMembers.value = (data as TeamMember[]) || [];
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    teamMembers.value = [];
  }
};

const refreshData = () => {
  fetchTeams();
};

const applyFilters = () => {
  // Filters are applied via computed property
};

// Modal actions
const openCreateModal = () => {
  editingTeam.value = null;
  formData.value = {
    name: '',
    description: '',
    teamType: 'global',
    orgSlug: '',
  };
  showFormModal.value = true;
};

const openEditModal = (team: Team) => {
  editingTeam.value = team;
  formData.value = {
    name: team.name,
    description: team.description || '',
    teamType: team.orgSlug ? 'org' : 'global',
    orgSlug: team.orgSlug || '',
  };
  showFormModal.value = true;
};

const openDetailModal = (team: Team) => {
  selectedTeam.value = team;
  showDetailModal.value = true;
};

const openMembersModal = async (team: Team) => {
  membersTeam.value = team;
  showAddMemberForm.value = false;
  newMemberEmail.value = '';
  newMemberRole.value = 'member';
  await fetchTeamMembers(team.id);
  showMembersModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingTeam.value = null;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedTeam.value = null;
};

const closeMembersModal = () => {
  showMembersModal.value = false;
  membersTeam.value = null;
  teamMembers.value = [];
};

const openEditFromDetail = () => {
  if (selectedTeam.value) {
    closeDetailModal();
    openEditModal(selectedTeam.value);
  }
};

const openMembersFromDetail = () => {
  if (selectedTeam.value) {
    closeDetailModal();
    openMembersModal(selectedTeam.value);
  }
};

// CRUD operations
const saveTeam = async () => {
  if (!isFormValid.value) return;

  saving.value = true;
  try {
    if (editingTeam.value) {
      // Update
      await apiService.put(`/teams/${editingTeam.value.id}`, {
        name: formData.value.name,
        description: formData.value.description || null,
      });
      const toast = await toastController.create({
        message: 'Team updated successfully',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } else {
      // Create
      if (formData.value.teamType === 'org') {
        await apiService.post(`/orgs/${formData.value.orgSlug}/teams`, {
          name: formData.value.name,
          description: formData.value.description || null,
        });
      } else {
        await apiService.post('/teams', {
          name: formData.value.name,
          description: formData.value.description || null,
        });
      }
      const toast = await toastController.create({
        message: 'Team created successfully',
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    }
    closeFormModal();
    await fetchTeams();
  } catch (error: unknown) {
    console.error('Failed to save team:', error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const message = err?.response?.data?.message || err?.message || 'Failed to save team';
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    saving.value = false;
  }
};

const confirmDelete = (team: Team) => {
  teamToDelete.value = team;
  showDeleteAlert.value = true;
};

const performDelete = async () => {
  if (!teamToDelete.value) return;

  loading.value = true;
  try {
    await apiService.delete(`/teams/${teamToDelete.value.id}`);
    const toast = await toastController.create({
      message: 'Team deleted successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();
    await fetchTeams();
  } catch (error: unknown) {
    console.error('Failed to delete team:', error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const message = err?.response?.data?.message || err?.message || 'Failed to delete team';
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    loading.value = false;
    teamToDelete.value = null;
  }
};

// Member operations
const addMember = async () => {
  if (!membersTeam.value || !newMemberEmail.value) return;

  addingMember.value = true;
  try {
    // First, find user by email
    const usersData = await apiService.get(`/admin/users?email=${encodeURIComponent(newMemberEmail.value)}`);
    const users = usersData as { id: string; email: string }[];

    if (!users || users.length === 0) {
      throw new Error('User not found with that email');
    }

    await apiService.post(`/teams/${membersTeam.value.id}/members`, {
      userId: users[0].id,
      role: newMemberRole.value,
    });

    const toast = await toastController.create({
      message: 'Member added successfully',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    newMemberEmail.value = '';
    newMemberRole.value = 'member';
    showAddMemberForm.value = false;
    await fetchTeamMembers(membersTeam.value.id);
    await fetchTeams(); // Refresh to update member count
  } catch (error: unknown) {
    console.error('Failed to add member:', error);
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    const message = err?.response?.data?.message || err?.message || 'Failed to add member';
    const toast = await toastController.create({
      message,
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  } finally {
    addingMember.value = false;
  }
};

const updateMemberRole = async (member: TeamMember, newRole: string) => {
  if (!membersTeam.value) return;

  try {
    await apiService.put(`/teams/${membersTeam.value.id}/members/${member.userId}`, {
      role: newRole,
    });

    const toast = await toastController.create({
      message: 'Member role updated',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    await fetchTeamMembers(membersTeam.value.id);
  } catch (error: unknown) {
    console.error('Failed to update member role:', error);
    const toast = await toastController.create({
      message: 'Failed to update member role',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
};

const removeMember = async (member: TeamMember) => {
  if (!membersTeam.value) return;

  try {
    await apiService.delete(`/teams/${membersTeam.value.id}/members/${member.userId}`);

    const toast = await toastController.create({
      message: 'Member removed',
      duration: 2000,
      color: 'success',
    });
    await toast.present();

    await fetchTeamMembers(membersTeam.value.id);
    await fetchTeams(); // Refresh to update member count
  } catch (error: unknown) {
    console.error('Failed to remove member:', error);
    const toast = await toastController.create({
      message: 'Failed to remove member',
      duration: 3000,
      color: 'danger',
    });
    await toast.present();
  }
};

// Helpers
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleString();
};

onMounted(() => {
  fetchTeams();
});
</script>

<style scoped>
/* Detail View Container */
.detail-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-light);
}

.detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Stats Banner */
.stats-banner {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #a16c4a 0%, #6d4428 100%);
  border-radius: 10px;
  margin-bottom: 1.5rem;
  color: white;
}

.stats-banner .stat {
  text-align: center;
}

.stats-banner .stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
}

.stats-banner .stat-label {
  font-size: 0.8rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.filter-bar ion-searchbar {
  flex: 1;
  --background: white;
  --border-radius: 8px;
}

.filter-bar ion-button {
  --border-radius: 8px;
  height: 44px;
}

/* Table Styles */
.table-container {
  background: white;
  border-radius: 10px;
  border: 1px solid var(--ion-color-light-shade);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: var(--ion-color-light);
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.85rem;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.data-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  font-size: 0.9rem;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.clickable-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.clickable-row:hover {
  background: var(--ion-color-light-tint);
}

.team-name {
  font-weight: 500;
}

.mono {
  font-family: monospace;
  font-size: 0.85rem;
}

.muted {
  color: #999;
}

.actions-cell {
  display: flex;
  gap: 0.25rem;
}

.actions-cell ion-button {
  --padding-start: 0.25rem;
  --padding-end: 0.25rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #888;
}

.empty-state ion-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--ion-color-medium);
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  color: #555;
}

/* Form Styles */
.form-container {
  padding: 0.5rem;
}

.form-container ion-item {
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 0.8rem;
  color: #888;
  margin: 0.25rem 0 1rem 1rem;
}

.form-actions {
  margin-top: 1.5rem;
}

/* Detail Modal Styles */
.team-detail {
  padding: 0.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h4 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #666;
}

.detail-value {
  color: #333;
}

.detail-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Members Modal Styles */
.members-container {
  padding: 0.5rem;
}

.members-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.members-header h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.add-member-form {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.add-member-form ion-item {
  margin-bottom: 0.5rem;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
}

.member-info {
  display: flex;
  flex-direction: column;
}

.member-email {
  font-weight: 500;
}

.member-name {
  font-size: 0.85rem;
  color: #666;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.role-select {
  min-width: 100px;
}

.empty-members {
  text-align: center;
  padding: 2rem;
  color: #888;
}

@media (max-width: 768px) {
  .table-container {
    overflow-x: auto;
  }

  .data-table {
    min-width: 600px;
  }

  .stats-banner {
    flex-wrap: wrap;
    justify-content: center;
  }

  .filter-bar {
    flex-wrap: wrap;
  }
}
</style>
