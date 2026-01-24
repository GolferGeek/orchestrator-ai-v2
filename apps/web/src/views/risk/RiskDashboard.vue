<template>
  <ion-page>
    <ion-content ref="contentRef" :fullscreen="true">
      <div class="risk-dashboard">
        <header class="dashboard-header">
          <h1>Investment Risk Dashboard</h1>
          <div class="header-actions">
            <button class="btn btn-secondary" @click="refreshData">
              <span class="icon">&#8635;</span>
              Refresh
            </button>
          </div>
        </header>

        <!-- Scope Selection -->
        <section class="scope-section">
          <div class="scope-controls">
            <div class="filter-group">
              <label for="scope-filter">Scope</label>
              <select
                id="scope-filter"
                v-model="selectedScopeId"
                @change="onScopeChange"
              >
                <option :value="null" disabled>Select a scope</option>
                <option
                  v-for="scope in store.scopes"
                  :key="scope.id"
                  :value="scope.id"
                >
                  {{ scope.name }} ({{ scope.domain }})
                </option>
              </select>
            </div>
            <button class="btn btn-primary btn-create-scope" @click="showCreateScopeModal = true">
              + New Scope
            </button>
          </div>
        </section>

        <!-- Dashboard Tabs -->
        <nav class="dashboard-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
          </button>
        </nav>

        <!-- Loading State -->
        <div v-if="store.isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>Loading risk data...</span>
        </div>

        <!-- Error State -->
        <div v-else-if="store.error" class="error-state">
          <span class="error-icon">!</span>
          <span>{{ store.error }}</span>
          <button class="btn btn-secondary" @click="refreshData">Try Again</button>
        </div>

        <!-- No Scope Selected -->
        <div v-else-if="!selectedScopeId" class="empty-state">
          <span class="empty-icon">🔍</span>
          <h3>Select a Scope</h3>
          <p>Please select a scope to view risk analysis data.</p>
        </div>

        <!-- Tab Content -->
        <div v-else class="tab-content">
          <!-- Overview Tab -->
          <OverviewTab
            v-if="activeTab === 'overview'"
            :scope="store.currentScope"
            :subjects="store.subjects"
            :composite-scores="store.compositeScores"
            :stats="store.stats"
            @select-subject="(id, score) => onSelectSubject(id, score)"
            @analyze="onAnalyzeSubject"
            @add-subject="showCreateSubjectModal = true"
          />

          <!-- Analytics Tab -->
          <AnalyticsTab
            v-if="activeTab === 'analytics'"
            :scope-id="selectedScopeId"
            :scope-name="store.currentScope?.name"
            :subjects="store.subjects"
            :dimensions="store.dimensions"
            @select-subject="(id) => onSelectSubject(id)"
            @error="(err) => store.setError(err)"
          />

          <!-- Alerts Tab -->
          <AlertsTab
            v-if="activeTab === 'alerts'"
            :alerts="store.alerts"
            @acknowledge="onAcknowledgeAlert"
          />

          <!-- Dimensions Tab -->
          <DimensionsTab
            v-if="activeTab === 'dimensions'"
            :dimensions="store.dimensions"
            :scope-id="selectedScopeId"
            @create="onCreateDimension"
            @update="onUpdateDimension"
            @delete="onDeleteDimension"
          />

          <!-- Learnings Tab -->
          <LearningsTab
            v-if="activeTab === 'learnings'"
            :learnings="store.pendingLearnings"
            @approve="onApproveLearning"
            @reject="onRejectLearning"
          />

          <!-- Settings Tab -->
          <SettingsTab
            v-if="activeTab === 'settings'"
            :scope="store.currentScope"
            @update="onUpdateScope"
          />
        </div>
      </div>

      <!-- Subject Detail Panel -->
      <SubjectDetailPanel
        :is-open="showDetailPanel"
        :subject="store.selectedSubject"
        :is-loading="isLoadingDetail"
        :is-analyzing="store.isAnalyzing"
        :error="detailError"
        @close="onCloseDetailPanel"
        @analyze="onAnalyzeSubject"
      />

      <!-- Create Scope Modal -->
      <CreateScopeModal
        ref="createScopeModalRef"
        :is-open="showCreateScopeModal"
        @close="showCreateScopeModal = false"
        @create="onCreateScope"
      />

      <!-- Create Subject Modal -->
      <CreateSubjectModal
        ref="createSubjectModalRef"
        :is-open="showCreateSubjectModal"
        :scope-id="selectedScopeId"
        @close="showCreateSubjectModal = false"
        @create="onCreateSubject"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonContent } from '@ionic/vue';
import { useRiskDashboardStore } from '@/stores/riskDashboardStore';
import { useAuthStore } from '@/stores/rbacStore';
import { riskDashboardService } from '@/services/riskDashboardService';
import type { RiskAssessment, RiskSubject, ActiveCompositeScoreView } from '@/types/risk-agent';
import OverviewTab from './tabs/OverviewTab.vue';
import AlertsTab from './tabs/AlertsTab.vue';
import DimensionsTab from './tabs/DimensionsTab.vue';
import LearningsTab from './tabs/LearningsTab.vue';
import SettingsTab from './tabs/SettingsTab.vue';
import AnalyticsTab from './tabs/AnalyticsTab.vue';
import SubjectDetailPanel from './components/SubjectDetailPanel.vue';
import CreateScopeModal from './components/CreateScopeModal.vue';
import CreateSubjectModal from './components/CreateSubjectModal.vue';
import type { CreateSubjectRequest } from '@/types/risk-agent';

const route = useRoute();
const store = useRiskDashboardStore();
const authStore = useAuthStore();
const contentRef = ref<InstanceType<typeof IonContent> | null>(null);

// Get agentSlug and orgSlug from query parameters
const agentSlug = computed(() => (route.query.agentSlug as string) || 'investment-risk-agent');
const orgSlug = computed(() => (route.query.orgSlug as string) || null);

// Tab state
const activeTab = ref<'overview' | 'analytics' | 'alerts' | 'dimensions' | 'learnings' | 'settings'>('overview');
const selectedScopeId = ref<string | null>(null);

// Detail panel state
const showDetailPanel = ref(false);
const selectedSubjectId = ref<string | null>(null);
const isLoadingDetail = ref(false);
const detailError = ref<string | null>(null);

// Create scope modal state
const showCreateScopeModal = ref(false);
const createScopeModalRef = ref<InstanceType<typeof CreateScopeModal> | null>(null);

// Create subject modal state
const showCreateSubjectModal = ref(false);
const createSubjectModalRef = ref<InstanceType<typeof CreateSubjectModal> | null>(null);

// Tabs configuration
const tabs = computed(() => [
  { id: 'overview' as const, label: 'Overview', icon: '📈', badge: null },
  { id: 'analytics' as const, label: 'Analytics', icon: '🔬', badge: null },
  { id: 'alerts' as const, label: 'Alerts', icon: '🔔', badge: store.alerts.length || null },
  { id: 'dimensions' as const, label: 'Dimensions', icon: '📊', badge: null },
  { id: 'learnings' as const, label: 'Learnings', icon: '💡', badge: store.pendingLearnings.length || null },
  { id: 'settings' as const, label: 'Settings', icon: '⚙️', badge: null },
]);

// Load initial data
async function loadData() {
  // Use orgSlug from query params if provided, otherwise use auth store
  const org = orgSlug.value || authStore.currentOrganization;
  if (!org || org === '*') {
    store.setError('Please select a specific organization to view risk analysis.');
    return;
  }

  // Set both agent slug and org slug on the service
  riskDashboardService.setAgentSlug(agentSlug.value);
  riskDashboardService.setOrgSlug(orgSlug.value);
  store.setLoading(true);
  store.clearError();

  try {
    // Load scopes
    const scopesResponse = await riskDashboardService.listScopes({ isActive: true });
    if (scopesResponse.success && scopesResponse.content) {
      store.setScopes(scopesResponse.content);

      // Auto-select first scope if none selected
      if (!selectedScopeId.value && scopesResponse.content.length > 0) {
        selectedScopeId.value = scopesResponse.content[0].id;
        await loadScopeData(selectedScopeId.value);
      }
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to load data');
  } finally {
    store.setLoading(false);
  }
}

// Load data for selected scope
async function loadScopeData(scopeId: string) {
  store.setLoading(true);

  try {
    const scope = store.getScopeById(scopeId);
    if (scope) {
      store.setCurrentScope(scope);
    }

    // Load dimensions, subjects, composite scores, alerts, and learnings in parallel
    const [dimensionsRes, subjectsRes, scoresRes, alertsRes, learningsRes] = await Promise.all([
      riskDashboardService.listDimensions(scopeId),
      riskDashboardService.listSubjects({ scopeId }),
      riskDashboardService.listCompositeScores({ scopeId }),
      riskDashboardService.listAlerts({ scopeId, unacknowledgedOnly: true }),
      riskDashboardService.listLearnings({ scopeId, status: 'pending' }),
    ]);

    if (dimensionsRes.success && Array.isArray(dimensionsRes.content)) {
      store.setDimensions(dimensionsRes.content);
    }
    if (subjectsRes.success && Array.isArray(subjectsRes.content)) {
      store.setSubjects(subjectsRes.content);
    }
    if (scoresRes.success && Array.isArray(scoresRes.content)) {
      store.setCompositeScores(scoresRes.content);
    }
    if (alertsRes.success && Array.isArray(alertsRes.content)) {
      store.setAlerts(alertsRes.content);
    }
    if (learningsRes.success && Array.isArray(learningsRes.content)) {
      store.setPendingLearnings(learningsRes.content);
    }

    // Calculate average score from composite scores
    // Note: setCompositeScores already transforms overall_score (0-100) to score (0-1)
    let avgScore = 0;
    if (store.compositeScores.length > 0) {
      const total = store.compositeScores.reduce((sum, s) => {
        // After transformation, score is already 0-1 scale
        return sum + (s.score || 0);
      }, 0);
      avgScore = total / store.compositeScores.length;
    }

    // Update stats - use compositeScores.length for total subjects since subjects API may return empty
    store.setStats({
      totalSubjects: store.subjects.length > 0 ? store.subjects.length : store.compositeScores.length,
      analyzedSubjects: store.compositeScores.length,
      averageScore: avgScore,
      criticalAlerts: store.criticalAlerts.length,
      warningAlerts: store.warningAlerts.length,
      pendingLearnings: store.pendingLearnings.length,
      staleAssessments: store.staleAssessments.length,
    });
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to load scope data');
  } finally {
    store.setLoading(false);
  }
}

function refreshData() {
  if (selectedScopeId.value) {
    loadScopeData(selectedScopeId.value);
  } else {
    loadData();
  }
}

function onScopeChange() {
  if (selectedScopeId.value) {
    loadScopeData(selectedScopeId.value);
  }
}

async function onSelectSubject(subjectId: string, compositeScore?: unknown) {
  // Validate subjectId is not empty
  if (!subjectId || subjectId.trim() === '') {
    console.error('Invalid subjectId passed to onSelectSubject:', subjectId);
    detailError.value = 'Invalid subject ID';
    return;
  }
  
  console.log('Selecting subject:', subjectId, 'with compositeScore:', compositeScore);
  selectedSubjectId.value = subjectId;
  showDetailPanel.value = true;
  await loadSubjectDetails(subjectId, compositeScore);
}

function pickFirstStringField(
  value: unknown,
  keys: string[],
  fallback: string,
): string {
  if (!value || typeof value !== 'object') return fallback;
  const rec = value as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === 'string' && v.length > 0) {
      return v;
    }
  }
  return fallback;
}

// Transform assessment from snake_case to camelCase
function transformAssessment(assessment: unknown): RiskAssessment {
  const a = assessment as unknown as Record<string, unknown>;
  return {
    id: (a.id as string) || '',
    subjectId: (a.subject_id as string) || (a.subjectId as string) || '',
    dimensionId: (a.dimension_id as string) || (a.dimensionId as string) || '',
    dimensionContextId: (a.dimension_context_id as string) || (a.dimensionContextId as string) || '',
    taskId: (a.task_id as string) || (a.taskId as string) || '',
    score: typeof a.score === 'number' ? (a.score > 1 ? a.score / 100 : a.score) : 0,
    confidence: typeof a.confidence === 'number' ? a.confidence : 0,
    signals: (a.signals as RiskAssessment['signals']) || [],
    analystResponse: (a.analyst_response as RiskAssessment['analystResponse']) || (a.analystResponse as RiskAssessment['analystResponse']) || {},
    createdAt: (a.created_at as string) || (a.createdAt as string) || '',
    dimensionSlug: (a.dimension_slug as string) || (a.dimensionSlug as string) || undefined,
    dimensionName: (a.dimension_name as string) || (a.dimensionName as string) || undefined,
    dimensionWeight: typeof a.dimension_weight === 'number' ? a.dimension_weight : (typeof a.dimensionWeight === 'number' ? a.dimensionWeight : undefined),
  };
}

async function loadSubjectDetails(subjectId: string, passedCompositeScore?: unknown) {
  isLoadingDetail.value = true;
  detailError.value = null;

  console.log('Loading subject details for:', subjectId);
  console.log('Available composite scores:', store.compositeScores.map(s => ({ id: s.id, subjectId: (s as unknown as Record<string, unknown>).subjectId || (s as unknown as Record<string, unknown>).subject_id })));

  try {
    // Fetch subject details and additional data in parallel
    const [subjectRes, existingScore, assessmentsRes, debateRes, alertsRes] = await Promise.all([
      riskDashboardService.getSubject(subjectId).catch((err) => {
        console.error('Error fetching subject:', err);
        return { success: false, content: null };
      }),
      Promise.resolve(
        passedCompositeScore ||
        store.compositeScores.find(
          (s) => {
            const sRecord = s as unknown as Record<string, unknown>;
            const sSubjectId = sRecord.subjectId as string || sRecord.subject_id as string || '';
            const match = sSubjectId === subjectId;
            console.log('Checking score:', s.id, 'subjectId:', sSubjectId, 'matches:', match);
            return match;
          },
        ),
      ),
      riskDashboardService.getAssessmentsBySubject(subjectId).catch(() => ({ success: false, content: [] })),
      riskDashboardService.getLatestDebate(subjectId).catch(() => ({ success: true, content: null })),
      riskDashboardService.listAlerts({ subjectId }).catch(() => ({ success: false, content: [] })),
    ]);

    console.log('Subject fetch result:', subjectRes.success, subjectRes.content);
    console.log('Existing score found:', !!existingScore);

    // Use subject from API if available, otherwise build from composite score
    let subject: RiskSubject;
    if (subjectRes.success && subjectRes.content) {
      // Subject from API - transform snake_case to camelCase
      const s = subjectRes.content as unknown as Record<string, unknown>;
      subject = {
        ...subjectRes.content,
        scopeId: (s.scope_id as string) || (s.scopeId as string) || '',
        subjectType: ((s.subject_type as string) || (s.subjectType as string) || 'custom') as RiskSubject['subjectType'],
        isActive: s.is_active === true || s.isActive === true,
        createdAt: (s.created_at as string) || (s.createdAt as string) || '',
        updatedAt: (s.updated_at as string) || (s.updatedAt as string) || '',
        name: (s.name as string) || '',
      } as RiskSubject;
    } else if (existingScore) {
      // Build subject from composite score data (handles snake_case)
      const _s = existingScore as unknown as Record<string, unknown>;
      subject = {
        id: subjectId,
        identifier: pickFirstStringField(
          existingScore,
          ['subject_identifier', 'subjectIdentifier'],
          '',
        ),
        name: pickFirstStringField(
          existingScore,
          ['subject_name', 'subjectName'],
          'Unknown',
        ),
        subjectType: (pickFirstStringField(
          existingScore,
          ['subject_type', 'subjectType'],
          'custom',
        ) as RiskSubject['subjectType']) || 'custom',
        scopeId: pickFirstStringField(existingScore, ['scopeId', 'scope_id'], ''),
        isActive: true,
        createdAt: pickFirstStringField(existingScore, ['createdAt', 'created_at'], ''),
        updatedAt: pickFirstStringField(existingScore, ['updatedAt', 'updated_at'], ''),
      };
    } else {
      console.error('No subject or composite score found for subject:', subjectId);
      console.error('Available composite scores:', store.compositeScores.map(s => {
        const sRecord = s as unknown as Record<string, unknown>;
        return {
          id: s.id,
          subjectId: sRecord.subjectId || sRecord.subject_id,
          subjectIdentifier: sRecord.subjectIdentifier || sRecord.subject_identifier
        };
      }));
      detailError.value = 'Failed to load subject details - no matching composite score found';
      isLoadingDetail.value = false;
      return;
    }

    // Transform assessments
    const assessments = assessmentsRes.success && Array.isArray(assessmentsRes.content)
      ? assessmentsRes.content.map(transformAssessment)
      : [];

    console.log('Setting selected subject:', { 
      subject: { id: subject.id, name: subject.name, identifier: subject.identifier },
      existingScore: existingScore ? { id: (existingScore as unknown as Record<string, unknown>).id } : null,
      assessmentsCount: assessments.length 
    });
    
    if (!subject || !subject.id) {
      console.error('Invalid subject object:', subject);
      detailError.value = 'Invalid subject data';
      isLoadingDetail.value = false;
      return;
    }
    
    store.setSelectedSubject({
      subject,
      compositeScore: existingScore as ActiveCompositeScoreView | undefined,
      assessments,
      debate: debateRes.success && debateRes.content ? debateRes.content : null,
      alerts: alertsRes.success && Array.isArray(alertsRes.content) ? alertsRes.content : [],
      evaluations: [],
    });
    console.log('Selected subject set in store:', store.selectedSubject);
    console.log('showDetailPanel:', showDetailPanel.value);
    console.log('Panel should show:', showDetailPanel.value && !!store.selectedSubject?.subject);
  } catch (error) {
    console.error('Error loading subject details:', error);
    detailError.value = error instanceof Error ? error.message : 'Failed to load subject details';
  } finally {
    isLoadingDetail.value = false;
    console.log('Loading complete. showDetailPanel:', showDetailPanel.value, 'selectedSubject:', !!store.selectedSubject);
  }
}

function onCloseDetailPanel() {
  showDetailPanel.value = false;
  selectedSubjectId.value = null;
  store.setSelectedSubject(null);
}

async function onCreateScope(params: {
  name: string;
  domain: string;
  description?: string;
  thresholdConfig?: { alertThreshold: number; debateThreshold: number; staleDays: number };
  analysisConfig?: { riskRadar: { enabled: boolean }; debate: { enabled: boolean }; learning: { enabled: boolean } };
}) {
  createScopeModalRef.value?.setSubmitting(true);

  try {
    const response = await riskDashboardService.createScope(params);

    if (response.success && response.content) {
      store.addScope(response.content);
      // Auto-select the new scope
      selectedScopeId.value = response.content.id;
      await loadScopeData(response.content.id);
      showCreateScopeModal.value = false;
    } else {
      createScopeModalRef.value?.setError('Failed to create scope');
    }
  } catch (error) {
    createScopeModalRef.value?.setError(error instanceof Error ? error.message : 'Failed to create scope');
  }
}

async function onCreateSubject(params: CreateSubjectRequest) {
  createSubjectModalRef.value?.setSubmitting(true);

  try {
    const response = await riskDashboardService.createSubject(params);

    if (response.success && response.content) {
      store.addSubject(response.content);
      showCreateSubjectModal.value = false;
      // Reload scope data to get updated stats
      if (selectedScopeId.value) {
        await loadScopeData(selectedScopeId.value);
      }
    } else {
      createSubjectModalRef.value?.setError('Failed to create subject');
    }
  } catch (error) {
    createSubjectModalRef.value?.setError(error instanceof Error ? error.message : 'Failed to create subject');
  }
}

async function onAnalyzeSubject(subjectId: string) {
  store.setAnalyzing(true);
  try {
    await riskDashboardService.analyzeSubject(subjectId);
    if (selectedScopeId.value) {
      await loadScopeData(selectedScopeId.value);
    }
    // Reload subject details if the panel is open for this subject
    if (showDetailPanel.value && selectedSubjectId.value === subjectId) {
      await loadSubjectDetails(subjectId);
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Analysis failed');
  } finally {
    store.setAnalyzing(false);
  }
}

async function onAcknowledgeAlert(alertId: string) {
  try {
    await riskDashboardService.acknowledgeAlert(alertId);
    store.removeAlert(alertId);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to acknowledge alert');
  }
}

async function onCreateDimension(params: { slug: string; name: string; description?: string; weight: number }) {
  if (!selectedScopeId.value) return;

  try {
    const response = await riskDashboardService.createDimension({
      scopeId: selectedScopeId.value,
      ...params,
    });
    if (response.success && response.content) {
      store.addDimension(response.content);
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to create dimension');
  }
}

async function onUpdateDimension(id: string, params: { name?: string; description?: string; weight?: number; isActive?: boolean }) {
  try {
    const response = await riskDashboardService.updateDimension(id, params);
    if (response.success && response.content) {
      store.updateDimension(id, response.content);
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to update dimension');
  }
}

async function onDeleteDimension(id: string) {
  try {
    await riskDashboardService.deleteDimension(id);
    store.removeDimension(id);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to delete dimension');
  }
}

async function onApproveLearning(learningId: string) {
  try {
    await riskDashboardService.approveLearning(learningId);
    store.removePendingLearning(learningId);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to approve learning');
  }
}

async function onRejectLearning(learningId: string) {
  try {
    await riskDashboardService.rejectLearning(learningId);
    store.removePendingLearning(learningId);
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to reject learning');
  }
}

async function onUpdateScope(params: Record<string, unknown>) {
  if (!store.currentScope) return;

  try {
    const response = await riskDashboardService.updateScope(store.currentScope.id, params);
    if (response.success && response.content) {
      store.updateScope(store.currentScope.id, response.content);
    }
  } catch (error) {
    store.setError(error instanceof Error ? error.message : 'Failed to update scope');
  }
}

// Watch for organization context changes (from auth store or query params)
watch(
  [() => authStore.currentOrganization, orgSlug],
  ([newOrg, newOrgSlug]) => {
    const effectiveOrg = newOrgSlug || newOrg;
    if (effectiveOrg && effectiveOrg !== '*') {
      loadData();
    }
  },
  { immediate: true }
);

onMounted(async () => {
  if (contentRef.value) {
    await contentRef.value.$el.scrollToTop(0);
  }

  const effectiveOrg = orgSlug.value || authStore.currentOrganization;
  if (effectiveOrg && effectiveOrg !== '*') {
    loadData();
  }
});
</script>

<style scoped>
.risk-dashboard {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-right: 200px;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background-color: var(--btn-secondary-bg, #f3f4f6);
  color: var(--btn-secondary-text, #374151);
}

.btn-secondary:hover {
  background-color: var(--btn-secondary-hover, #e5e7eb);
}

.icon {
  font-size: 1rem;
}

/* Scope Section */
.scope-section {
  margin-bottom: 1.5rem;
}

.scope-controls {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 300px;
}

.btn-primary {
  background-color: var(--primary-color, #a87c4f);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-color-dark, #8f693f);
}

.btn-create-scope {
  white-space: nowrap;
  height: fit-content;
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  text-transform: uppercase;
}

.filter-group select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 0.875rem;
  background-color: var(--input-bg, #ffffff);
  color: var(--text-primary, #111827);
}

/* Tabs */
.dashboard-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  margin-bottom: 1.5rem;
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  color: var(--text-secondary, #6b7280);
}

.tab-btn:hover {
  color: var(--text-primary, #111827);
  background-color: var(--hover-bg, #f9fafb);
}

.tab-btn.active {
  color: var(--primary-color, #a87c4f);
  border-bottom-color: var(--primary-color, #a87c4f);
}

.tab-icon {
  font-size: 1rem;
}

.tab-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.tab-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background-color: var(--badge-bg, #fef3c7);
  color: var(--badge-text, #92400e);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
  color: var(--text-secondary, #6b7280);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #a87c4f);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 50%;
  font-weight: bold;
}

.empty-icon {
  font-size: 3rem;
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #111827);
}

.empty-state p {
  margin: 0;
  text-align: center;
}

.tab-content {
  min-height: 400px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .risk-dashboard {
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
    --card-bg: #1f2937;
    --input-bg: #374151;
    --btn-secondary-bg: #374151;
    --btn-secondary-text: #f9fafb;
    --btn-secondary-hover: #4b5563;
    --hover-bg: #374151;
    --badge-bg: #78350f;
    --badge-text: #fef3c7;
  }
}
</style>
