<template>
  <div class="detail-view">
    <div class="detail-header">
      <h2>Human Approvals</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="load" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>
    <div class="detail-body ion-padding">
      <div class="filters">
        <ion-select v-model="status" label="Status" interface="popover" label-placement="stacked" fill="outline">
          <ion-select-option value="pending">Pending</ion-select-option>
          <ion-select-option value="approved">Approved</ion-select-option>
          <ion-select-option value="rejected">Rejected</ion-select-option>
        </ion-select>
        <ion-input v-model="agentFilter" label="Agent" placeholder="agent slug" label-placement="stacked" fill="outline"></ion-input>
        <ion-input v-model="conversationFilter" label="Conversation" placeholder="conversation id" label-placement="stacked" fill="outline"></ion-input>
      </div>

      <ion-list>
        <ion-item v-for="rec in records" :key="rec.id">
          <ion-label class="ion-text-wrap">
            <h2>{{ rec.agent_slug }} <ion-chip size="small" :color="chipColor(rec.status)" outline>{{ rec.status }}</ion-chip></h2>
            <p>
              <strong>Org:</strong> {{ rec.organization_slug ?? 'global' }} ·
              <strong>Mode:</strong> {{ rec.mode }} ·
              <strong>Conversation:</strong> {{ rec.conversation_id ?? 'n/a' }} ·
              <strong>Created:</strong> {{ formatTime(rec.created_at) }}
            </p>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button color="success" @click="approve(rec)" :disabled="rec.status !== 'pending' || loading">Approve</ion-button>
            <ion-button color="warning" @click="approveContinue(rec)" :disabled="rec.status !== 'pending' || loading">Approve & Continue</ion-button>
            <ion-button color="danger" @click="reject(rec)" :disabled="rec.status !== 'pending' || loading">Reject</ion-button>
          </ion-buttons>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll threshold="100px" @ionInfinite="doInfinite">
        <ion-infinite-scroll-content loading-text="Loading more..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IonList, IonItem, IonLabel, IonButton, IonButtons, IonSelect, IonSelectOption, IonInput, IonChip, IonInfiniteScroll, IonInfiniteScrollContent, IonIcon } from '@ionic/vue';
import { refreshOutline } from 'ionicons/icons';
import approvalsService, { type HumanApprovalRecord } from '@/services/approvalsService';
import { useAuthStore } from '@/stores/rbacStore';

const status = ref<'pending' | 'approved' | 'rejected'>('pending');
const agentFilter = ref('');
const conversationFilter = ref('');
const records = ref<HumanApprovalRecord[]>([]);
const loading = ref(false);

const formatTime = (iso?: string) => {
  try {
    return iso ? new Date(iso).toLocaleString() : '';
  } catch { return iso ?? ''; }
};

const chipColor = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning');

async function load() {
  loading.value = true;
  try {
    const res = await approvalsService.list({ status: status.value, agentSlug: agentFilter.value || undefined, conversationId: conversationFilter.value || undefined });
    // The API returns HumanApprovalRecord[] directly
    records.value = res;
  } catch (e) {
    console.error('Failed to load approvals', e);
  } finally {
    loading.value = false;
  }
}

async function approve(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    await approvalsService.approve(rec.id);
    await load();
  } catch (e) {
    console.error('Approve failed', e);
  } finally {
    loading.value = false;
  }
}

async function reject(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    await approvalsService.reject(rec.id);
    await load();
  } catch (e) {
    console.error('Reject failed', e);
  } finally {
    loading.value = false;
  }
}

async function approveContinue(rec: HumanApprovalRecord) {
  loading.value = true;
  try {
    const auth = useAuthStore();
    const orgSlug = rec.organization_slug ?? auth.currentOrganization ?? 'global';
    const streamId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    await approvalsService.approveAndContinue(orgSlug, rec.agent_slug, rec.id, { options: { stream: true }, payload: { stream: true, streamId } });
    await load();
  } catch (e) {
    console.error('Approve & Continue failed', e);
  } finally {
    loading.value = false;
  }
}

async function doInfinite(ev: CustomEvent) {
  await load();
  (ev.target as unknown as { complete: () => void }).complete();
}

onMounted(load);
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
}

.filters {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filters > ion-select,
.filters > ion-input {
  min-width: 200px;
}
</style>
