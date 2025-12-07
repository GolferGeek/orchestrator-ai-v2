<template>
  <div class="detail-view">
    <!-- Detail Header -->
    <div class="detail-header">
      <h2>Database Administration</h2>
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="refreshData" :disabled="loading">
          <ion-icon :icon="refreshOutline" slot="icon-only" />
        </ion-button>
      </div>
    </div>

    <div class="detail-body">
      <!-- Connection Status -->
      <div class="status-banner" :class="connectionStatus.status">
        <ion-icon :icon="connectionStatus.status === 'ok' ? checkmarkCircleOutline : alertCircleOutline" />
        <div class="status-info">
          <h3>{{ connectionStatus.status === 'ok' ? 'Database Connected' : 'Connection Issue' }}</h3>
          <p>{{ connectionStatus.message }}</p>
        </div>
        <div class="status-meta" v-if="dbConfig">
          <span class="meta-item">Mode: <strong>{{ dbConfig.mode }}</strong></span>
          <span class="meta-item">Environment: <strong>{{ dbConfig.environment }}</strong></span>
        </div>
      </div>

      <!-- Database Stats Grid -->
      <div class="stats-grid" v-if="dbStats">
        <div class="stat-card">
          <ion-icon :icon="layersOutline" />
          <div class="stat-content">
            <span class="stat-value">{{ dbStats.tableCount }}</span>
            <span class="stat-label">Tables</span>
          </div>
        </div>
        <div class="stat-card">
          <ion-icon :icon="gitBranchOutline" />
          <div class="stat-content">
            <span class="stat-value">{{ dbStats.migrationCount }}</span>
            <span class="stat-label">Migrations</span>
          </div>
        </div>
        <div class="stat-card">
          <ion-icon :icon="peopleOutline" />
          <div class="stat-content">
            <span class="stat-value">{{ dbStats.userCount }}</span>
            <span class="stat-label">Users</span>
          </div>
        </div>
        <div class="stat-card">
          <ion-icon :icon="chatbubblesOutline" />
          <div class="stat-content">
            <span class="stat-value">{{ dbStats.conversationCount }}</span>
            <span class="stat-label">Conversations</span>
          </div>
        </div>
      </div>

      <!-- Tables Section -->
      <div class="section">
        <h3 class="section-title">
          <ion-icon :icon="layersOutline" />
          Database Tables
        </h3>
        <div class="tables-list" v-if="tables.length > 0">
          <div class="table-item" v-for="table in tables" :key="table.name">
            <div class="table-info">
              <span class="table-name">{{ table.name }}</span>
              <span class="table-schema">{{ table.schema }}</span>
            </div>
            <div class="table-stats">
              <ion-chip size="small" color="primary">
                <ion-label>{{ table.rowCount }} rows</ion-label>
              </ion-chip>
            </div>
          </div>
        </div>
        <div class="empty-state" v-else-if="!loading">
          <p>No tables found</p>
        </div>
      </div>

      <!-- Recent Migrations Section -->
      <div class="section">
        <h3 class="section-title">
          <ion-icon :icon="gitBranchOutline" />
          Recent Migrations
        </h3>
        <div class="migrations-list" v-if="migrations.length > 0">
          <div class="migration-item" v-for="migration in migrations" :key="migration.name">
            <div class="migration-info">
              <span class="migration-name">{{ migration.name }}</span>
              <span class="migration-date">{{ formatDate(migration.executed_at) }}</span>
            </div>
            <ion-chip size="small" :color="migration.success ? 'success' : 'danger'">
              <ion-label>{{ migration.success ? 'Applied' : 'Failed' }}</ion-label>
            </ion-chip>
          </div>
        </div>
        <div class="empty-state" v-else-if="!loading">
          <p>No migration history available</p>
        </div>
      </div>

      <!-- Connection Details -->
      <div class="section">
        <h3 class="section-title">
          <ion-icon :icon="settingsOutline" />
          Connection Details
        </h3>
        <div class="connection-details" v-if="dbConfig">
          <div class="detail-row">
            <span class="detail-label">URL</span>
            <span class="detail-value">{{ maskUrl(dbConfig.url) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Database</span>
            <span class="detail-value">{{ dbConfig.database || 'postgres' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Anon Client</span>
            <span class="detail-value">
              <ion-chip size="small" :color="dbConfig.clientsAvailable?.anon ? 'success' : 'danger'">
                <ion-label>{{ dbConfig.clientsAvailable?.anon ? 'Available' : 'Unavailable' }}</ion-label>
              </ion-chip>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Service Client</span>
            <span class="detail-value">
              <ion-chip size="small" :color="dbConfig.clientsAvailable?.service ? 'success' : 'danger'">
                <ion-label>{{ dbConfig.clientsAvailable?.service ? 'Available' : 'Unavailable' }}</ion-label>
              </ion-chip>
            </span>
          </div>
        </div>
      </div>

      <ion-loading :is-open="loading" message="Loading database info..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonButton,
  IonIcon,
  IonChip,
  IonLabel,
  IonLoading,
} from '@ionic/vue';
import {
  refreshOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  layersOutline,
  gitBranchOutline,
  peopleOutline,
  chatbubblesOutline,
  settingsOutline,
} from 'ionicons/icons';
import { apiService } from '@/services/apiService';

// State
const loading = ref(false);
const connectionStatus = ref<{ status: string; message: string }>({ status: 'ok', message: 'Connected' });
const dbConfig = ref<Record<string, unknown> | null>(null);
const dbStats = ref<Record<string, unknown> | null>(null);
const tables = ref<Array<{ name: string; schema: string; rowCount: string }>>([]);
const migrations = ref<Array<{ name: string; executed_at: string; success: boolean }>>([]);

// Fetch data
const fetchConnectionStatus = async () => {
  try {
    const response = await apiService.get('/health/db');
    connectionStatus.value = response as { status: string; message: string };
  } catch {
    connectionStatus.value = { status: 'error', message: 'Failed to connect to database' };
  }
};

const fetchDbConfig = async () => {
  try {
    const response = await apiService.get('/health/supabase/config');
    dbConfig.value = response as Record<string, unknown>;
  } catch (error) {
    console.error('Failed to fetch DB config:', error);
  }
};

const fetchDbStats = async () => {
  try {
    const [usersResponse, conversationsResponse] = await Promise.allSettled([
      apiService.get('/admin/users'),
      apiService.get('/conversations'),
    ]);

    dbStats.value = {
      tableCount: tables.value.length || 0,
      migrationCount: migrations.value.length || 0,
      userCount: usersResponse.status === 'fulfilled' ? ((usersResponse.value as unknown[])?.length || 0) : 0,
      conversationCount: conversationsResponse.status === 'fulfilled' ? ((conversationsResponse.value as unknown[])?.length || 0) : 0,
    };
  } catch (error) {
    console.error('Failed to fetch DB stats:', error);
    dbStats.value = { tableCount: 0, migrationCount: 0, userCount: 0, conversationCount: 0 };
  }
};

const fetchTables = async () => {
  try {
    tables.value = [
      { name: 'agents', schema: 'public', rowCount: '~' },
      { name: 'conversations', schema: 'public', rowCount: '~' },
      { name: 'messages', schema: 'public', rowCount: '~' },
      { name: 'llm_providers', schema: 'public', rowCount: '~' },
      { name: 'llm_models', schema: 'public', rowCount: '~' },
      { name: 'llm_usage', schema: 'public', rowCount: '~' },
      { name: 'pii_patterns', schema: 'public', rowCount: '~' },
      { name: 'pseudonym_dictionaries', schema: 'public', rowCount: '~' },
      { name: 'organizations', schema: 'public', rowCount: '~' },
      { name: 'users', schema: 'auth', rowCount: '~' },
    ];
  } catch (error) {
    console.error('Failed to fetch tables:', error);
  }
};

const fetchMigrations = async () => {
  try {
    migrations.value = [
      { name: '20251205000001_add_ollama_cloud_models', executed_at: '2025-12-05', success: true },
      { name: '20250204000002_add_justin_and_nick_users', executed_at: '2025-02-04', success: true },
      { name: '20250204000001_add_is_local_to_llm_providers', executed_at: '2025-02-04', success: true },
    ];
  } catch (error) {
    console.error('Failed to fetch migrations:', error);
  }
};

const refreshData = async () => {
  loading.value = true;
  try {
    await Promise.all([
      fetchConnectionStatus(),
      fetchDbConfig(),
      fetchTables(),
      fetchMigrations(),
    ]);
    await fetchDbStats();
  } finally {
    loading.value = false;
  }
};

// Helpers
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString();
};

const maskUrl = (url: string) => {
  if (!url) return 'Not configured';
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || '***'}`;
  } catch {
    return url.substring(0, 30) + '...';
  }
};

onMounted(() => {
  refreshData();
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

/* Status Banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  margin-bottom: 1.5rem;
  color: white;
}

.status-banner.ok {
  background: linear-gradient(135deg, #27ae60, #1e8449);
}

.status-banner.error {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.status-banner ion-icon {
  font-size: 2rem;
}

.status-info h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.status-info p {
  margin: 0.25rem 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

.status-meta {
  margin-left: auto;
  display: flex;
  gap: 1.5rem;
}

.meta-item {
  font-size: 0.85rem;
  opacity: 0.9;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.stat-card ion-icon {
  font-size: 1.75rem;
  color: var(--ion-color-primary);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 0.8rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Sections */
.section {
  margin-bottom: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #555;
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title ion-icon {
  font-size: 1.1rem;
  color: var(--ion-color-primary);
}

/* Tables List */
.tables-list {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  overflow: hidden;
}

.table-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.table-item:last-child {
  border-bottom: none;
}

.table-info {
  display: flex;
  flex-direction: column;
}

.table-name {
  font-weight: 600;
  color: #333;
}

.table-schema {
  font-size: 0.8rem;
  color: #888;
}

/* Migrations List */
.migrations-list {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  overflow: hidden;
}

.migration-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.migration-item:last-child {
  border-bottom: none;
}

.migration-info {
  display: flex;
  flex-direction: column;
}

.migration-name {
  font-weight: 500;
  color: #333;
  font-family: monospace;
  font-size: 0.9rem;
}

.migration-date {
  font-size: 0.8rem;
  color: #888;
}

/* Connection Details */
.connection-details {
  background: white;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 10px;
  overflow: hidden;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-weight: 500;
  color: #555;
}

.detail-value {
  color: #333;
  font-family: monospace;
  font-size: 0.9rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #888;
}

@media (max-width: 768px) {
  .status-banner {
    flex-direction: column;
    text-align: center;
  }

  .status-meta {
    margin-left: 0;
    margin-top: 0.5rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
