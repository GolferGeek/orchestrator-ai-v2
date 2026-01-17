/**
 * Risk Dashboard A2A Service
 *
 * Handles A2A dashboard mode calls for the risk analysis system.
 * Uses dashboard mode to fetch and manage risk entities.
 *
 * IMPORTANT: This service uses A2A dashboard mode, NOT REST endpoints.
 * All data access is through POST /agent-to-agent/:orgSlug/investment-risk-agent/tasks
 */

import { useAuthStore } from '@/stores/rbacStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type {
  RiskScope,
  RiskSubject,
  RiskDimension,
  RiskDimensionContext,
  RiskAssessment,
  RiskCompositeScore,
  ActiveCompositeScoreView,
  RiskDebate,
  RiskDebateContext,
  RiskAlert,
  UnacknowledgedAlertView,
  RiskLearning,
  PendingLearningView,
  RiskEvaluation,
  DashboardStats,
  DashboardActionResponse,
  AnalyzeSubjectResponse,
  CreateSubjectRequest,
  UpdateSubjectRequest,
} from '@/types/risk-agent';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  'http://localhost:6100';

// Default agent slug for risk analysis
const DEFAULT_AGENT_SLUG = 'investment-risk-agent';

// ============================================================================
// DASHBOARD REQUEST/RESPONSE PAYLOAD TYPES
// ============================================================================

interface DashboardRequestPayload {
  action: string;
  params?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  pagination?: { page?: number; pageSize?: number };
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

class RiskDashboardService {
  private currentAgentSlug: string = DEFAULT_AGENT_SLUG;
  private currentOrgSlug: string | null = null;
  private authStore: ReturnType<typeof useAuthStore> | null = null;

  /**
   * Set the agent slug for dashboard requests
   * Call this before making dashboard requests when switching agents
   */
  setAgentSlug(agentSlug: string): void {
    this.currentAgentSlug = agentSlug;
  }

  /**
   * Set the organization slug for dashboard requests
   * Call this to override the organization from URL query params
   */
  setOrgSlug(orgSlug: string | null): void {
    this.currentOrgSlug = orgSlug;
  }

  /**
   * Get the current agent slug, falling back to default
   */
  private getAgentSlug(): string {
    return this.currentAgentSlug || DEFAULT_AGENT_SLUG;
  }

  private getAuthStore(): ReturnType<typeof useAuthStore> {
    if (!this.authStore) {
      this.authStore = useAuthStore();
    }
    return this.authStore;
  }

  private getOrgSlug(): string {
    // Use explicit org slug if set, otherwise fall back to auth store
    const org = this.currentOrgSlug || this.getAuthStore().currentOrganization;
    if (!org) {
      throw new Error('No organization context available');
    }
    // Reject global org slug '*' - need a specific organization for risk API
    if (org === '*') {
      throw new Error('Please select a specific organization to view risk analysis. Global (*) organization is not supported.');
    }
    return org;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.getAuthStore().token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private getContext(): ExecutionContext {
    const contextStore = useExecutionContextStore();
    const authStore = this.getAuthStore();

    // For dashboard mode, we don't require a conversation context
    // Create a minimal context with required fields
    if (contextStore.isInitialized) {
      return contextStore.current;
    }

    // Create minimal dashboard context when no conversation is active
    const orgSlug = this.getOrgSlug();
    const userId = authStore.user?.id || '';

    return {
      orgSlug,
      userId,
      conversationId: '00000000-0000-0000-0000-000000000000', // NIL UUID for dashboard mode
      taskId: crypto.randomUUID(),
      planId: '00000000-0000-0000-0000-000000000000',
      deliverableId: '00000000-0000-0000-0000-000000000000',
      agentSlug: this.getAgentSlug(),
      agentType: 'risk',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };
  }

  private async executeDashboardRequest<T>(
    action: string,
    params?: Record<string, unknown>,
    filters?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardActionResponse<T>> {
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.getAgentSlug())}/tasks`;

    const payload: DashboardRequestPayload = {
      action,
      params,
      filters,
      pagination,
    };

    const request = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: `dashboard.${action}`,
      params: {
        mode: 'dashboard',
        payload,
        context: this.getContext(),
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData?.error?.message || errorData?.message || response.statusText;
      throw new Error(message);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Dashboard request failed');
    }

    // API returns { success, payload: { content, metadata }, context }
    // We need to extract payload and add success flag
    const responsePayload = data.payload || data.result?.payload || data.result || {};
    return {
      success: data.success ?? true,
      content: responsePayload.content ?? null,
      metadata: responsePayload.metadata ?? null,
    };
  }

  // ==========================================================================
  // SCOPE OPERATIONS
  // ==========================================================================

  async listScopes(filters?: { isActive?: boolean }): Promise<DashboardActionResponse<RiskScope[]>> {
    return this.executeDashboardRequest<RiskScope[]>('scopes.list', undefined, filters);
  }

  async getScope(id: string): Promise<DashboardActionResponse<RiskScope>> {
    return this.executeDashboardRequest<RiskScope>('scopes.get', { id });
  }

  async createScope(params: {
    name: string;
    domain: string;
    description?: string;
    llmConfig?: Record<string, unknown>;
    thresholdConfig?: Record<string, unknown>;
    analysisConfig?: Record<string, unknown>;
  }): Promise<DashboardActionResponse<RiskScope>> {
    return this.executeDashboardRequest<RiskScope>('scopes.create', params);
  }

  async updateScope(
    id: string,
    params: Partial<{
      name: string;
      description: string;
      llmConfig: Record<string, unknown>;
      thresholdConfig: Record<string, unknown>;
      analysisConfig: Record<string, unknown>;
      isActive: boolean;
    }>
  ): Promise<DashboardActionResponse<RiskScope>> {
    return this.executeDashboardRequest<RiskScope>('scopes.update', { id, ...params });
  }

  async deleteScope(id: string): Promise<DashboardActionResponse<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>('scopes.delete', { id });
  }

  // ==========================================================================
  // SUBJECT OPERATIONS
  // ==========================================================================

  async listSubjects(filters?: {
    scopeId?: string;
    subjectType?: string;
    isActive?: boolean;
  }): Promise<DashboardActionResponse<RiskSubject[]>> {
    return this.executeDashboardRequest<RiskSubject[]>('subjects.list', undefined, filters);
  }

  async getSubject(id: string): Promise<DashboardActionResponse<RiskSubject>> {
    return this.executeDashboardRequest<RiskSubject>('subjects.get', { id });
  }

  async createSubject(params: CreateSubjectRequest): Promise<DashboardActionResponse<RiskSubject>> {
    return this.executeDashboardRequest<RiskSubject>('subjects.create', params as unknown as Record<string, unknown>);
  }

  async updateSubject(
    id: string,
    params: UpdateSubjectRequest
  ): Promise<DashboardActionResponse<RiskSubject>> {
    return this.executeDashboardRequest<RiskSubject>('subjects.update', { id, ...params });
  }

  async deleteSubject(id: string): Promise<DashboardActionResponse<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>('subjects.delete', { id });
  }

  // ==========================================================================
  // DIMENSION OPERATIONS
  // ==========================================================================

  async listDimensions(scopeId: string): Promise<DashboardActionResponse<RiskDimension[]>> {
    return this.executeDashboardRequest<RiskDimension[]>('dimensions.list', { scopeId });
  }

  async getDimension(id: string): Promise<DashboardActionResponse<RiskDimension>> {
    return this.executeDashboardRequest<RiskDimension>('dimensions.get', { id });
  }

  async createDimension(params: {
    scopeId: string;
    slug: string;
    name: string;
    description?: string;
    weight: number;
  }): Promise<DashboardActionResponse<RiskDimension>> {
    return this.executeDashboardRequest<RiskDimension>('dimensions.create', params);
  }

  async updateDimension(
    id: string,
    params: Partial<{
      name: string;
      description: string;
      weight: number;
      isActive: boolean;
    }>
  ): Promise<DashboardActionResponse<RiskDimension>> {
    return this.executeDashboardRequest<RiskDimension>('dimensions.update', { id, ...params });
  }

  async deleteDimension(id: string): Promise<DashboardActionResponse<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>('dimensions.delete', { id });
  }

  // ==========================================================================
  // DIMENSION CONTEXT OPERATIONS
  // ==========================================================================

  async listDimensionContexts(dimensionId: string): Promise<DashboardActionResponse<RiskDimensionContext[]>> {
    return this.executeDashboardRequest<RiskDimensionContext[]>('dimension-contexts.list', { dimensionId });
  }

  async getActiveDimensionContext(dimensionId: string): Promise<DashboardActionResponse<RiskDimensionContext>> {
    return this.executeDashboardRequest<RiskDimensionContext>('dimension-contexts.get-active', { dimensionId });
  }

  async createDimensionContext(params: {
    dimensionId: string;
    analysisPrompt: string;
    outputSchema?: Record<string, unknown>;
    examples?: Array<{ input: Record<string, unknown>; output: Record<string, unknown> }>;
  }): Promise<DashboardActionResponse<RiskDimensionContext>> {
    return this.executeDashboardRequest<RiskDimensionContext>('dimension-contexts.create', params);
  }

  // ==========================================================================
  // COMPOSITE SCORE OPERATIONS
  // ==========================================================================

  async listCompositeScores(filters?: {
    scopeId?: string;
    minScore?: number;
    maxScore?: number;
  }): Promise<DashboardActionResponse<ActiveCompositeScoreView[]>> {
    return this.executeDashboardRequest<ActiveCompositeScoreView[]>('composite-scores.list', undefined, filters);
  }

  async getCompositeScore(id: string): Promise<DashboardActionResponse<RiskCompositeScore>> {
    return this.executeDashboardRequest<RiskCompositeScore>('composite-scores.get', { id });
  }

  async getCompositeScoreBySubject(subjectId: string): Promise<DashboardActionResponse<RiskCompositeScore>> {
    return this.executeDashboardRequest<RiskCompositeScore>('composite-scores.get-by-subject', { subjectId });
  }

  async getCompositeScoreHistory(
    subjectId: string,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardActionResponse<RiskCompositeScore[]>> {
    return this.executeDashboardRequest<RiskCompositeScore[]>(
      'composite-scores.history',
      { subjectId },
      undefined,
      pagination
    );
  }

  // ==========================================================================
  // ASSESSMENT OPERATIONS
  // ==========================================================================

  async listAssessments(filters?: {
    subjectId?: string;
    dimensionId?: string;
  }): Promise<DashboardActionResponse<RiskAssessment[]>> {
    return this.executeDashboardRequest<RiskAssessment[]>('assessments.list', undefined, filters);
  }

  async getAssessment(id: string): Promise<DashboardActionResponse<RiskAssessment>> {
    return this.executeDashboardRequest<RiskAssessment>('assessments.get', { id });
  }

  async getAssessmentsBySubject(subjectId: string): Promise<DashboardActionResponse<RiskAssessment[]>> {
    return this.executeDashboardRequest<RiskAssessment[]>('assessments.get-by-subject', { subjectId });
  }

  async getAssessmentsByTask(taskId: string): Promise<DashboardActionResponse<RiskAssessment[]>> {
    return this.executeDashboardRequest<RiskAssessment[]>('assessments.get-by-task', { taskId });
  }

  // ==========================================================================
  // DEBATE OPERATIONS
  // ==========================================================================

  async listDebates(subjectId: string): Promise<DashboardActionResponse<RiskDebate[]>> {
    return this.executeDashboardRequest<RiskDebate[]>('debates.list', { subjectId });
  }

  async getDebate(id: string): Promise<DashboardActionResponse<RiskDebate>> {
    return this.executeDashboardRequest<RiskDebate>('debates.get', { id });
  }

  async getLatestDebate(subjectId: string): Promise<DashboardActionResponse<RiskDebate>> {
    return this.executeDashboardRequest<RiskDebate>('debates.get-latest', { subjectId });
  }

  async triggerDebate(compositeScoreId: string): Promise<DashboardActionResponse<RiskDebate>> {
    return this.executeDashboardRequest<RiskDebate>('debates.trigger', { compositeScoreId });
  }

  // ==========================================================================
  // DEBATE CONTEXT OPERATIONS
  // ==========================================================================

  async listDebateContexts(scopeId: string): Promise<DashboardActionResponse<RiskDebateContext[]>> {
    return this.executeDashboardRequest<RiskDebateContext[]>('debate-contexts.list', { scopeId });
  }

  async updateDebateContext(
    id: string,
    params: { analysisPrompt?: string; isActive?: boolean }
  ): Promise<DashboardActionResponse<RiskDebateContext>> {
    return this.executeDashboardRequest<RiskDebateContext>('debate-contexts.update', { id, ...params });
  }

  // ==========================================================================
  // ALERT OPERATIONS
  // ==========================================================================

  async listAlerts(filters?: {
    scopeId?: string;
    subjectId?: string;
    severity?: 'info' | 'warning' | 'critical';
    unacknowledgedOnly?: boolean;
  }): Promise<DashboardActionResponse<UnacknowledgedAlertView[]>> {
    return this.executeDashboardRequest<UnacknowledgedAlertView[]>('alerts.list', undefined, filters);
  }

  async getAlert(id: string): Promise<DashboardActionResponse<RiskAlert>> {
    return this.executeDashboardRequest<RiskAlert>('alerts.get', { id });
  }

  async acknowledgeAlert(id: string, notes?: string): Promise<DashboardActionResponse<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>('alerts.acknowledge', { id, notes });
  }

  async getAlertCounts(): Promise<DashboardActionResponse<{ critical: number; warning: number; info: number }>> {
    return this.executeDashboardRequest<{ critical: number; warning: number; info: number }>('alerts.counts');
  }

  // ==========================================================================
  // LEARNING OPERATIONS
  // ==========================================================================

  async listLearnings(filters?: {
    scopeId?: string;
    dimensionId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'applied';
  }): Promise<DashboardActionResponse<PendingLearningView[]>> {
    return this.executeDashboardRequest<PendingLearningView[]>('learnings.list', undefined, filters);
  }

  async getLearning(id: string): Promise<DashboardActionResponse<RiskLearning>> {
    return this.executeDashboardRequest<RiskLearning>('learnings.get', { id });
  }

  async approveLearning(id: string, notes?: string): Promise<DashboardActionResponse<RiskLearning>> {
    return this.executeDashboardRequest<RiskLearning>('learnings.approve', { id, notes });
  }

  async rejectLearning(id: string, notes?: string): Promise<DashboardActionResponse<RiskLearning>> {
    return this.executeDashboardRequest<RiskLearning>('learnings.reject', { id, notes });
  }

  async applyLearning(id: string): Promise<DashboardActionResponse<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>('learnings.apply', { id });
  }

  // ==========================================================================
  // EVALUATION OPERATIONS
  // ==========================================================================

  async listEvaluations(subjectId: string): Promise<DashboardActionResponse<RiskEvaluation[]>> {
    return this.executeDashboardRequest<RiskEvaluation[]>('evaluations.list', { subjectId });
  }

  async getEvaluation(id: string): Promise<DashboardActionResponse<RiskEvaluation>> {
    return this.executeDashboardRequest<RiskEvaluation>('evaluations.get', { id });
  }

  async createEvaluation(params: {
    subjectId: string;
    compositeScoreId: string;
    evaluationWindow: string;
    actualOutcome: {
      timestamp: string;
      value: number | string;
      source?: string;
      notes?: string;
    };
  }): Promise<DashboardActionResponse<RiskEvaluation>> {
    return this.executeDashboardRequest<RiskEvaluation>('evaluations.create', params);
  }

  // ==========================================================================
  // ANALYSIS OPERATIONS
  // ==========================================================================

  async analyzeSubject(
    subjectId: string,
    options?: { forceRefresh?: boolean; includeDebate?: boolean }
  ): Promise<DashboardActionResponse<AnalyzeSubjectResponse>> {
    return this.executeDashboardRequest<AnalyzeSubjectResponse>('analysis.analyze-subject', {
      subjectId,
      ...options,
    });
  }

  async analyzeScope(
    scopeId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<DashboardActionResponse<{ analyzed: number; successful: number; failed: number }>> {
    return this.executeDashboardRequest<{ analyzed: number; successful: number; failed: number }>(
      'analysis.analyze-scope',
      { scopeId, ...options }
    );
  }

  async triggerBatchAnalysis(): Promise<DashboardActionResponse<{
    analyzed: number;
    successful: number;
    failed: number;
    scopesProcessed: number;
    duration: number;
  }>> {
    return this.executeDashboardRequest('analysis.batch');
  }

  async getAnalysisStatus(): Promise<DashboardActionResponse<{ isProcessing: boolean; lastRun?: string }>> {
    return this.executeDashboardRequest('analysis.status');
  }

  // ==========================================================================
  // DASHBOARD STATISTICS
  // ==========================================================================

  async getDashboardStats(scopeId?: string): Promise<DashboardActionResponse<DashboardStats>> {
    return this.executeDashboardRequest<DashboardStats>('dashboard.stats', scopeId ? { scopeId } : undefined);
  }

  async getSubjectDetail(subjectId: string): Promise<DashboardActionResponse<{
    subject: RiskSubject;
    compositeScore: RiskCompositeScore | null;
    assessments: RiskAssessment[];
    debate: RiskDebate | null;
    alerts: RiskAlert[];
    evaluations: RiskEvaluation[];
  }>> {
    return this.executeDashboardRequest('dashboard.subject-detail', { subjectId });
  }
}

// Export singleton instance
export const riskDashboardService = new RiskDashboardService();
