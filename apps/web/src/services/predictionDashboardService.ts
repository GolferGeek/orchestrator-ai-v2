/**
 * Prediction Dashboard A2A Service
 *
 * Handles A2A dashboard mode calls for the prediction system.
 * Uses dashboard mode to fetch and manage prediction entities.
 *
 * IMPORTANT: This service uses A2A dashboard mode, NOT REST endpoints.
 * All data access is through POST /agent-to-agent/:orgSlug/prediction-runner/tasks
 */

import { useAuthStore } from '@/stores/rbacStore';
import { useExecutionContextStore } from '@/stores/executionContextStore';
import type {
  ExecutionContext,
  DashboardRequestPayload,
  DashboardResponsePayload,
  UniverseListParams,
  UniverseGetParams,
  UniverseCreateParams,
  UniverseUpdateParams,
  UniverseDeleteParams,
  TargetListParams,
  TargetGetParams,
  TargetCreateParams,
  TargetUpdateParams,
  TargetDeleteParams,
  PredictionListParams,
  PredictionGetParams,
  PredictionGetSnapshotParams,
  SourceListParams,
  SourceGetParams,
  SourceCreateParams,
  SourceUpdateParams,
  SourceDeleteParams,
  SourceTestCrawlParams,
  StrategyListParams,
} from '@orchestrator-ai/transport-types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  'http://localhost:6100';

// ============================================================================
// TYPES - Entity Responses
// ============================================================================

export interface PredictionUniverse {
  id: string;
  name: string;
  domain: 'stocks' | 'crypto' | 'elections' | 'polymarket';
  description?: string;
  organizationSlug: string;
  agentSlug: string;
  strategyId?: string;
  llmConfig?: {
    provider?: string;
    model?: string;
    tiers?: {
      gold?: { provider: string; model: string };
      silver?: { provider: string; model: string };
      bronze?: { provider: string; model: string };
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface PredictionTarget {
  id: string;
  universeId: string;
  name: string;
  symbol: string;
  targetType: string;
  context?: string;
  llmConfigOverride?: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Prediction {
  id: string;
  targetId: string;
  universeId: string;
  taskId?: string;
  status: 'active' | 'resolved' | 'expired' | 'cancelled';
  direction: 'up' | 'down' | 'flat';
  confidence: number;
  magnitude?: number;
  timeframe?: string;
  entryValue?: number;
  exitValue?: number;
  generatedAt: string;
  resolvedAt?: string;
  expiresAt?: string;
  llmEnsembleResults?: {
    gold?: TierResult;
    silver?: TierResult;
    bronze?: TierResult;
  };
  analystCount?: number;
  predictorCount?: number;
  targetName?: string;
  targetSymbol?: string;
  universeName?: string;
  domain?: string;
}

export interface TierResult {
  provider: string;
  model: string;
  direction: 'up' | 'down' | 'flat';
  confidence: number;
  reasoning: string;
}

export interface PredictionSnapshot {
  id: string;
  predictionId: string;
  predictors: Array<{
    id: string;
    direction: string;
    strength: number;
    reasoning: string;
    signalId: string;
  }>;
  rejectedSignals: Array<{
    id: string;
    reason: string;
    content: string;
  }>;
  analystAssessments: Array<{
    analystSlug: string;
    analystName: string;
    tier: 'gold' | 'silver' | 'bronze';
    direction: string;
    confidence: number;
    reasoning: string;
  }>;
  llmEnsembleResults: {
    gold?: TierResult;
    silver?: TierResult;
    bronze?: TierResult;
  };
  appliedLearnings: Array<{
    id: string;
    title: string;
    learningType: string;
    content: string;
  }>;
  thresholdEvaluation: {
    minPredictors: number;
    actualPredictors: number;
    minStrength: number;
    actualStrength: number;
    minConsensus: number;
    actualConsensus: number;
    passed: boolean;
  };
  timeline: Array<{
    timestamp: string;
    event: string;
    details?: string;
  }>;
  createdAt: string;
}

export interface PredictionSource {
  id: string;
  name: string;
  sourceType: 'web' | 'rss' | 'twitter_search' | 'api';
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  crawlConfig: Record<string, unknown>;
  authConfig?: Record<string, unknown>;
  active: boolean;
  lastCrawledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionStrategy {
  id: string;
  slug: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  parameters: {
    minPredictors?: number;
    minCombinedStrength?: number;
    minDirectionConsensus?: number;
    [key: string]: unknown;
  };
  isSystem: boolean;
}

export interface TestCrawlResult {
  success: boolean;
  itemsFound: number;
  sampleItems: Array<{
    title: string;
    content: string;
    url?: string;
    extractedAt: string;
  }>;
  errors?: string[];
}

// ============================================================================
// PHASE 11 TYPES - Analyst Operations
// ============================================================================

export interface PredictionAnalyst {
  id: string;
  slug: string;
  name: string;
  perspective: string;
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  defaultWeight: number;
  tierInstructions?: {
    gold?: string;
    silver?: string;
    bronze?: string;
  };
  learnedPatterns?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalystListParams {
  scopeLevel?: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  active?: boolean;
}

export interface AnalystCreateParams {
  slug: string;
  name: string;
  perspective: string;
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  defaultWeight?: number;
  tierInstructions?: {
    gold?: string;
    silver?: string;
    bronze?: string;
  };
}

export interface AnalystUpdateParams {
  id: string;
  name?: string;
  perspective?: string;
  defaultWeight?: number;
  tierInstructions?: {
    gold?: string;
    silver?: string;
    bronze?: string;
  };
  active?: boolean;
}

// ============================================================================
// PHASE 11 TYPES - Learning Operations
// ============================================================================

export interface PredictionLearning {
  id: string;
  title: string;
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  analystId?: string;
  learningType: 'rule' | 'pattern' | 'weight_adjustment' | 'threshold' | 'avoid';
  content: string;
  sourceType: 'human' | 'ai_suggested' | 'ai_approved';
  status: 'active' | 'superseded' | 'inactive';
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningQueueItem {
  id: string;
  suggestedTitle: string;
  suggestedContent: string;
  suggestedLearningType: string;
  suggestedScopeLevel: string;
  suggestedDomain?: string;
  suggestedUniverseId?: string;
  suggestedTargetId?: string;
  suggestedAnalystId?: string;
  sourceEvaluationId?: string;
  sourceMissedOpportunityId?: string;
  confidence: number;
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  finalLearningId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface LearningListParams {
  scopeLevel?: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  analystId?: string;
  learningType?: 'rule' | 'pattern' | 'weight_adjustment' | 'threshold' | 'avoid';
  status?: 'active' | 'superseded' | 'inactive';
}

export interface LearningCreateParams {
  title: string;
  scopeLevel: 'runner' | 'domain' | 'universe' | 'target';
  domain?: string;
  universeId?: string;
  targetId?: string;
  analystId?: string;
  learningType: 'rule' | 'pattern' | 'weight_adjustment' | 'threshold' | 'avoid';
  content: string;
  sourceType: 'human' | 'ai_suggested' | 'ai_approved';
}

export interface LearningUpdateParams {
  id: string;
  title?: string;
  content?: string;
  status?: 'active' | 'superseded' | 'inactive';
}

export interface LearningQueueListParams {
  status?: 'pending' | 'approved' | 'rejected' | 'modified';
  universeId?: string;
  targetId?: string;
}

export interface LearningQueueRespondParams {
  id: string;
  decision: 'approve' | 'reject' | 'modify';
  modifiedTitle?: string;
  modifiedContent?: string;
  modifiedLearningType?: string;
  modifiedScopeLevel?: string;
  reviewNotes?: string;
}

// ============================================================================
// PHASE 11 TYPES - Review Queue Operations
// ============================================================================

export interface ReviewQueueItem {
  id: string;
  signalId: string;
  targetId: string;
  targetName: string;
  targetSymbol: string;
  signalContent: string;
  sourceName: string;
  sourceType: string;
  receivedAt: string;
  aiDisposition: 'bullish' | 'bearish' | 'neutral';
  aiStrength: number;
  aiReasoning: string;
  aiConfidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  modifiedDisposition?: 'bullish' | 'bearish' | 'neutral';
  modifiedStrength?: number;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface ReviewQueueListParams {
  status?: 'pending' | 'approved' | 'rejected' | 'modified';
  targetId?: string;
  universeId?: string;
}

export interface ReviewQueueRespondParams {
  id: string;
  decision: 'approve' | 'reject' | 'modify';
  modifiedDisposition?: 'bullish' | 'bearish' | 'neutral';
  modifiedStrength?: number;
  reviewerNotes?: string;
  learningNote?: string;
}

// ============================================================================
// PHASE 11 TYPES - Missed Opportunity Operations
// ============================================================================

export interface MissedOpportunity {
  id: string;
  targetId: string;
  targetName: string;
  targetSymbol: string;
  moveStartAt: string;
  moveEndAt: string;
  startValue: number;
  endValue: number;
  movePercent: number;
  direction: 'up' | 'down';
  discoveredDrivers?: string[];
  signalsWeHad?: Array<{ id: string; content: string; reason: string }>;
  sourceGaps?: string[];
  suggestedLearnings?: string[];
  analysisStatus: 'pending' | 'analyzed' | 'actioned';
  createdAt: string;
}

export interface MissedOpportunityAnalysis {
  id: string;
  missedOpportunityId: string;
  drivers: Array<{ driver: string; confidence: number; sources: string[] }>;
  signalAnalysis: Array<{
    signalId: string;
    reason: string;
    shouldHaveActed: boolean;
  }>;
  sourceRecommendations: Array<{
    sourceType: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  learningRecommendations: Array<{
    title: string;
    content: string;
    learningType: string;
  }>;
  summary: string;
  createdAt: string;
}

export interface MissedOpportunityListParams {
  targetId?: string;
  universeId?: string;
  analysisStatus?: 'pending' | 'analyzed' | 'actioned';
  direction?: 'up' | 'down';
  minMovePercent?: number;
}

// ============================================================================
// PHASE 11 TYPES - Tool Request Operations
// ============================================================================

export interface ToolRequest {
  id: string;
  universeId: string;
  universeName: string;
  targetId?: string;
  targetName?: string;
  requestType: 'source' | 'integration' | 'feature';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'wishlist' | 'planned' | 'in_progress' | 'done' | 'rejected';
  sourceType?: string;
  sourceMissedOpportunityId?: string;
  statusNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolRequestListParams {
  universeId?: string;
  targetId?: string;
  requestType?: 'source' | 'integration' | 'feature';
  status?: 'wishlist' | 'planned' | 'in_progress' | 'done' | 'rejected';
  priority?: 'low' | 'medium' | 'high';
}

export interface ToolRequestCreateParams {
  universeId: string;
  targetId?: string;
  requestType: 'source' | 'integration' | 'feature';
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  sourceType?: string;
  sourceMissedOpportunityId?: string;
}

export interface ToolRequestUpdateStatusParams {
  id: string;
  status: 'wishlist' | 'planned' | 'in_progress' | 'done' | 'rejected';
  statusNotes?: string;
}

// ============================================================================
// PHASE 11 TYPES - LLM Cost Operations
// ============================================================================

export interface LLMCostSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costByTier: {
    gold: number;
    silver: number;
    bronze: number;
  };
  costByUniverse: Array<{ universeId: string; universeName: string; cost: number }>;
  dailyCosts: Array<{ date: string; cost: number }>;
}

export interface LLMCostSummaryParams {
  universeId?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
}

// ============================================================================
// SERVICE
// ============================================================================

class PredictionDashboardService {
  private agentSlug = 'prediction-runner';
  private authStore: ReturnType<typeof useAuthStore> | null = null;

  private getAuthStore(): ReturnType<typeof useAuthStore> {
    if (!this.authStore) {
      this.authStore = useAuthStore();
    }
    return this.authStore;
  }

  private getOrgSlug(): string {
    const org = this.getAuthStore().currentOrganization;
    if (!org) {
      throw new Error('No organization context available');
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
    const store = useExecutionContextStore();
    return store.current;
  }

  private async executeDashboardRequest<T>(
    action: string,
    params?: Record<string, unknown>,
    filters?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardResponsePayload<T>> {
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.agentSlug)}/tasks`;

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

    return data.result?.payload || data.result || { content: null };
  }

  // ==========================================================================
  // UNIVERSE OPERATIONS
  // ==========================================================================

  async listUniverses(
    params?: UniverseListParams
  ): Promise<DashboardResponsePayload<PredictionUniverse[]>> {
    return this.executeDashboardRequest<PredictionUniverse[]>(
      'universes.list',
      undefined,
      params
    );
  }

  async getUniverse(
    params: UniverseGetParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    return this.executeDashboardRequest<PredictionUniverse>(
      'universes.get',
      params
    );
  }

  async createUniverse(
    params: UniverseCreateParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    return this.executeDashboardRequest<PredictionUniverse>(
      'universes.create',
      params
    );
  }

  async updateUniverse(
    params: UniverseUpdateParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    return this.executeDashboardRequest<PredictionUniverse>(
      'universes.update',
      params
    );
  }

  async deleteUniverse(
    params: UniverseDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'universes.delete',
      params
    );
  }

  // ==========================================================================
  // TARGET OPERATIONS
  // ==========================================================================

  async listTargets(
    params?: TargetListParams
  ): Promise<DashboardResponsePayload<PredictionTarget[]>> {
    return this.executeDashboardRequest<PredictionTarget[]>(
      'targets.list',
      undefined,
      params
    );
  }

  async getTarget(
    params: TargetGetParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    return this.executeDashboardRequest<PredictionTarget>(
      'targets.get',
      params
    );
  }

  async createTarget(
    params: TargetCreateParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    return this.executeDashboardRequest<PredictionTarget>(
      'targets.create',
      params
    );
  }

  async updateTarget(
    params: TargetUpdateParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    return this.executeDashboardRequest<PredictionTarget>(
      'targets.update',
      params
    );
  }

  async deleteTarget(
    params: TargetDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'targets.delete',
      params
    );
  }

  // ==========================================================================
  // PREDICTION OPERATIONS
  // ==========================================================================

  async listPredictions(
    params?: PredictionListParams,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardResponsePayload<Prediction[]>> {
    return this.executeDashboardRequest<Prediction[]>(
      'predictions.list',
      undefined,
      params,
      pagination
    );
  }

  async getPrediction(
    params: PredictionGetParams
  ): Promise<DashboardResponsePayload<Prediction>> {
    return this.executeDashboardRequest<Prediction>(
      'predictions.get',
      params
    );
  }

  async getPredictionSnapshot(
    params: PredictionGetSnapshotParams
  ): Promise<DashboardResponsePayload<PredictionSnapshot>> {
    return this.executeDashboardRequest<PredictionSnapshot>(
      'predictions.getSnapshot',
      params
    );
  }

  // ==========================================================================
  // SOURCE OPERATIONS
  // ==========================================================================

  async listSources(
    params?: SourceListParams
  ): Promise<DashboardResponsePayload<PredictionSource[]>> {
    return this.executeDashboardRequest<PredictionSource[]>(
      'sources.list',
      undefined,
      params
    );
  }

  async getSource(
    params: SourceGetParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    return this.executeDashboardRequest<PredictionSource>(
      'sources.get',
      params
    );
  }

  async createSource(
    params: SourceCreateParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    return this.executeDashboardRequest<PredictionSource>(
      'sources.create',
      params
    );
  }

  async updateSource(
    params: SourceUpdateParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    return this.executeDashboardRequest<PredictionSource>(
      'sources.update',
      params
    );
  }

  async deleteSource(
    params: SourceDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'sources.delete',
      params
    );
  }

  async testCrawl(
    params: SourceTestCrawlParams
  ): Promise<DashboardResponsePayload<TestCrawlResult>> {
    return this.executeDashboardRequest<TestCrawlResult>(
      'sources.testCrawl',
      params
    );
  }

  // ==========================================================================
  // STRATEGY OPERATIONS
  // ==========================================================================

  async listStrategies(
    params?: StrategyListParams
  ): Promise<DashboardResponsePayload<PredictionStrategy[]>> {
    return this.executeDashboardRequest<PredictionStrategy[]>(
      'strategies.list',
      undefined,
      params
    );
  }

  // ==========================================================================
  // PHASE 11: ANALYST OPERATIONS
  // ==========================================================================

  async listAnalysts(
    params?: AnalystListParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst[]>> {
    return this.executeDashboardRequest<PredictionAnalyst[]>(
      'analysts.list',
      undefined,
      params
    );
  }

  async getAnalyst(params: {
    id: string;
  }): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    return this.executeDashboardRequest<PredictionAnalyst>(
      'analysts.get',
      params
    );
  }

  async createAnalyst(
    params: AnalystCreateParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    return this.executeDashboardRequest<PredictionAnalyst>(
      'analysts.create',
      params
    );
  }

  async updateAnalyst(
    params: AnalystUpdateParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    return this.executeDashboardRequest<PredictionAnalyst>(
      'analysts.update',
      params
    );
  }

  async deleteAnalyst(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'analysts.delete',
      params
    );
  }

  // ==========================================================================
  // PHASE 11: LEARNING OPERATIONS
  // ==========================================================================

  async listLearnings(
    params?: LearningListParams
  ): Promise<DashboardResponsePayload<PredictionLearning[]>> {
    return this.executeDashboardRequest<PredictionLearning[]>(
      'learnings.list',
      undefined,
      params
    );
  }

  async getLearning(params: {
    id: string;
  }): Promise<DashboardResponsePayload<PredictionLearning>> {
    return this.executeDashboardRequest<PredictionLearning>(
      'learnings.get',
      params
    );
  }

  async createLearning(
    params: LearningCreateParams
  ): Promise<DashboardResponsePayload<PredictionLearning>> {
    return this.executeDashboardRequest<PredictionLearning>(
      'learnings.create',
      params
    );
  }

  async updateLearning(
    params: LearningUpdateParams
  ): Promise<DashboardResponsePayload<PredictionLearning>> {
    return this.executeDashboardRequest<PredictionLearning>(
      'learnings.update',
      params
    );
  }

  async deleteLearning(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'learnings.delete',
      params
    );
  }

  async listLearningQueue(
    params?: LearningQueueListParams
  ): Promise<DashboardResponsePayload<LearningQueueItem[]>> {
    return this.executeDashboardRequest<LearningQueueItem[]>(
      'learnings.listQueue',
      undefined,
      params
    );
  }

  async respondToLearningQueue(
    params: LearningQueueRespondParams
  ): Promise<DashboardResponsePayload<{ success: boolean; learningId?: string }>> {
    return this.executeDashboardRequest<{ success: boolean; learningId?: string }>(
      'learnings.respondQueue',
      params
    );
  }

  // ==========================================================================
  // PHASE 11: REVIEW QUEUE OPERATIONS
  // ==========================================================================

  async listReviewQueue(
    params?: ReviewQueueListParams
  ): Promise<DashboardResponsePayload<ReviewQueueItem[]>> {
    return this.executeDashboardRequest<ReviewQueueItem[]>(
      'reviewQueue.list',
      undefined,
      params
    );
  }

  async getReviewQueueItem(params: {
    id: string;
  }): Promise<DashboardResponsePayload<ReviewQueueItem>> {
    return this.executeDashboardRequest<ReviewQueueItem>(
      'reviewQueue.get',
      params
    );
  }

  async respondToReviewQueue(
    params: ReviewQueueRespondParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'reviewQueue.respond',
      params
    );
  }

  // ==========================================================================
  // PHASE 11: MISSED OPPORTUNITY OPERATIONS
  // ==========================================================================

  async listMissedOpportunities(
    params?: MissedOpportunityListParams
  ): Promise<DashboardResponsePayload<MissedOpportunity[]>> {
    return this.executeDashboardRequest<MissedOpportunity[]>(
      'missedOpportunities.list',
      undefined,
      params
    );
  }

  async getMissedOpportunity(params: {
    id: string;
  }): Promise<DashboardResponsePayload<MissedOpportunity>> {
    return this.executeDashboardRequest<MissedOpportunity>(
      'missedOpportunities.get',
      params
    );
  }

  async getMissedOpportunityAnalysis(params: {
    id: string;
  }): Promise<DashboardResponsePayload<MissedOpportunityAnalysis>> {
    return this.executeDashboardRequest<MissedOpportunityAnalysis>(
      'missedOpportunities.getAnalysis',
      params
    );
  }

  async triggerMissedOpportunityAnalysis(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ success: boolean; analysisId?: string }>> {
    return this.executeDashboardRequest<{ success: boolean; analysisId?: string }>(
      'missedOpportunities.triggerAnalysis',
      params
    );
  }

  // ==========================================================================
  // PHASE 11: TOOL REQUEST OPERATIONS
  // ==========================================================================

  async listToolRequests(
    params?: ToolRequestListParams
  ): Promise<DashboardResponsePayload<ToolRequest[]>> {
    return this.executeDashboardRequest<ToolRequest[]>(
      'toolRequests.list',
      undefined,
      params
    );
  }

  async getToolRequest(params: {
    id: string;
  }): Promise<DashboardResponsePayload<ToolRequest>> {
    return this.executeDashboardRequest<ToolRequest>(
      'toolRequests.get',
      params
    );
  }

  async createToolRequest(
    params: ToolRequestCreateParams
  ): Promise<DashboardResponsePayload<ToolRequest>> {
    return this.executeDashboardRequest<ToolRequest>(
      'toolRequests.create',
      params
    );
  }

  async updateToolRequestStatus(
    params: ToolRequestUpdateStatusParams
  ): Promise<DashboardResponsePayload<ToolRequest>> {
    return this.executeDashboardRequest<ToolRequest>(
      'toolRequests.updateStatus',
      params
    );
  }

  async deleteToolRequest(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'toolRequests.delete',
      params
    );
  }

  // ==========================================================================
  // PHASE 11: LLM COST OPERATIONS
  // ==========================================================================

  async getLLMCostSummary(
    params?: LLMCostSummaryParams
  ): Promise<DashboardResponsePayload<LLMCostSummary>> {
    return this.executeDashboardRequest<LLMCostSummary>(
      'llmCosts.summary',
      params
    );
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  async loadDashboardData(universeId?: string): Promise<{
    universes: PredictionUniverse[];
    predictions: Prediction[];
    strategies: PredictionStrategy[];
  }> {
    const filters = universeId ? { universeId } : undefined;

    const [universesRes, predictionsRes, strategiesRes] = await Promise.all([
      this.listUniverses(),
      this.listPredictions(filters, { pageSize: 50 }),
      this.listStrategies(),
    ]);

    return {
      universes: universesRes.content || [],
      predictions: predictionsRes.content || [],
      strategies: strategiesRes.content || [],
    };
  }
}

export const predictionDashboardService = new PredictionDashboardService();
