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
  isTest?: boolean;
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
// PHASE 4 TYPES - Test Scenario Operations
// ============================================================================

export type TestScenarioStatus = 'active' | 'running' | 'completed' | 'failed' | 'archived';

export type InjectionPoint =
  | 'strategies'
  | 'universes'
  | 'targets'
  | 'sources'
  | 'source_crawls'
  | 'source_seen_items'
  | 'signal_fingerprints'
  | 'signals'
  | 'predictors'
  | 'predictions'
  | 'snapshots'
  | 'evaluations'
  | 'target_snapshots'
  | 'missed_opportunities'
  | 'tool_requests'
  | 'analysts'
  | 'learnings'
  | 'learning_queue'
  | 'review_queue';

export interface TestScenario {
  id: string;
  name: string;
  description: string | null;
  injection_points: InjectionPoint[];
  target_id: string | null;
  organization_slug: string;
  config: TestScenarioConfig;
  created_by: string | null;
  status: TestScenarioStatus;
  results: TestScenarioResults | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TestScenarioConfig {
  auto_run_tiers?: boolean;
  tiers_to_run?: string[];
  tier_config?: Record<string, unknown>;
}

export interface TestScenarioResults {
  items_injected?: Record<string, number>;
  items_generated?: Record<string, number>;
  tier_results?: Record<
    string,
    {
      success: boolean;
      processed: number;
      created: number;
      errors: string[];
    }
  >;
  errors?: string[];
}

export interface TestScenarioSummary extends TestScenario {
  data_counts: Record<string, number>;
}

export interface TestScenarioListParams {
  status?: TestScenarioStatus;
  targetId?: string;
  page?: number;
  pageSize?: number;
}

export interface TestScenarioCreateParams {
  name: string;
  description?: string;
  injection_points: InjectionPoint[];
  target_id?: string;
  config?: TestScenarioConfig;
}

export interface TestScenarioUpdateParams {
  id: string;
  name?: string;
  description?: string;
  injection_points?: InjectionPoint[];
  target_id?: string | null;
  config?: TestScenarioConfig;
  status?: TestScenarioStatus;
}

export interface TestScenarioInjectParams {
  scenarioId: string;
  table: InjectionPoint;
  data: unknown[];
}

export interface TestScenarioGenerateParams {
  scenarioId: string;
  type: 'signals' | 'predictions' | 'articles';
  config: {
    count: number;
    target_id?: string;
    source_id?: string;
    topic?: string;
    sentiment?: 'bullish' | 'bearish' | 'mixed';
    distribution?: { bullish?: number; bearish?: number; neutral?: number };
    accuracy_rate?: number;
  };
}

export interface TestScenarioRunTierParams {
  scenarioId: string;
  tier: 'signal-detection' | 'prediction-generation' | 'evaluation';
}

export interface TestScenarioCleanupParams {
  scenarioId?: string;
  cleanupAll?: boolean;
}

export interface TierRunResult {
  tier: string;
  success: boolean;
  items_processed: number;
  items_created: number;
  duration_ms: number;
  errors: string[];
}

export interface CleanupResult {
  cleanup_type: 'scenario' | 'all';
  scenario_id?: string;
  tables_cleaned: Array<{
    table_name: string;
    rows_deleted: number;
  }>;
  total_deleted: number;
}

export interface InjectResult {
  table: string;
  injected_count: number;
  items: unknown[];
}

export interface GenerateResult {
  type: string;
  generated_count: number;
  injected_count?: number;
  items: unknown[];
  outcomes?: Array<{
    prediction_index: number;
    expected_outcome: string;
    actual_direction: string;
  }>;
}

export interface TestScenarioExport {
  version: string;
  exportedAt: string;
  scenario: {
    name: string;
    description: string | null;
    injection_points: InjectionPoint[];
    target_id: string | null;
    config: TestScenarioConfig;
  };
  data?: {
    signals?: unknown[];
    predictors?: unknown[];
    predictions?: unknown[];
    outcomes?: unknown[];
    learnings?: unknown[];
  };
}

// ============================================================================
// PHASE 3 TYPES - Test Article Operations
// ============================================================================

export interface TestArticle {
  id: string;
  scenario_id: string;
  title: string;
  content: string;
  target_symbols: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed' | null;
  expected_signal_count: number | null;
  source_name: string;
  source_type: string;
  published_at: string | null;
  metadata: Record<string, unknown> | null;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestArticleListParams {
  scenarioId?: string;
  targetSymbol?: string;
  isProcessed?: boolean;
  sentiment?: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  page?: number;
  pageSize?: number;
}

export interface TestArticleCreateParams {
  scenario_id: string;
  title: string;
  content: string;
  target_symbols: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  expected_signal_count?: number;
  source_name?: string;
  source_type?: string;
  published_at?: string;
  metadata?: Record<string, unknown>;
}

export interface TestArticleUpdateParams {
  id: string;
  title?: string;
  content?: string;
  target_symbols?: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  expected_signal_count?: number;
  source_name?: string;
  source_type?: string;
  published_at?: string;
  metadata?: Record<string, unknown>;
}

export interface TestArticleBulkCreateParams {
  scenario_id: string;
  articles: Array<Omit<TestArticleCreateParams, 'scenario_id'>>;
}

export interface GenerateTestArticleParams {
  target_symbols: string[];
  scenario_type: 'earnings_beat' | 'earnings_miss' | 'scandal' | 'regulatory' | 'acquisition' | 'macro_shock' | 'technical' | 'custom';
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  strength: 'strong' | 'moderate' | 'weak';
  custom_prompt?: string;
  article_count?: number;
  scenario_id?: string;
}

// ============================================================================
// PHASE 3 TYPES - Test Price Data Operations
// ============================================================================

export interface TestPriceData {
  id: string;
  scenario_id: string;
  symbol: string;
  price_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TestPriceDataListParams {
  scenarioId?: string;
  symbol?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TestPriceDataCreateParams {
  scenario_id: string;
  symbol: string;
  price_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  metadata?: Record<string, unknown>;
}

export interface TestPriceDataUpdateParams {
  id: string;
  price_date?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  metadata?: Record<string, unknown>;
}

export interface TestPriceDataBulkCreateParams {
  scenario_id: string;
  symbol: string;
  prices: Array<{
    price_date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
}

// ============================================================================
// PHASE 3 TYPES - Test Target Mirror Operations
// ============================================================================

export interface TestTargetMirror {
  id: string;
  organization_slug: string;
  production_target_id: string;
  test_symbol: string;
  created_at: string;
  updated_at: string;
}

export interface TestTargetMirrorWithTarget extends TestTargetMirror {
  production_target?: {
    id: string;
    name: string;
    symbol: string;
    universe_id: string;
    target_type: string;
  };
}

export interface TestTargetMirrorListParams {
  includeTargetDetails?: boolean;
  page?: number;
  pageSize?: number;
}

export interface TestTargetMirrorCreateParams {
  production_target_id: string;
  test_symbol: string;
}

export interface TestTargetMirrorEnsureParams {
  productionTargetId: string;
  baseSymbol?: string;
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

  // ==========================================================================
  // PHASE 4: TEST SCENARIO OPERATIONS
  // ==========================================================================

  async listTestScenarios(
    params?: TestScenarioListParams
  ): Promise<DashboardResponsePayload<TestScenario[]>> {
    return this.executeDashboardRequest<TestScenario[]>(
      'test-scenarios.list',
      { filters: params },
      undefined,
      params ? { page: params.page, pageSize: params.pageSize } : undefined
    );
  }

  async getTestScenario(params: {
    id: string;
  }): Promise<DashboardResponsePayload<TestScenario>> {
    return this.executeDashboardRequest<TestScenario>(
      'test-scenarios.get',
      params
    );
  }

  async getTestScenarioSummaries(): Promise<DashboardResponsePayload<TestScenarioSummary[]>> {
    return this.executeDashboardRequest<TestScenarioSummary[]>(
      'test-scenarios.get-summaries'
    );
  }

  async createTestScenario(
    params: TestScenarioCreateParams
  ): Promise<DashboardResponsePayload<TestScenario>> {
    return this.executeDashboardRequest<TestScenario>(
      'test-scenarios.create',
      params
    );
  }

  async updateTestScenario(
    params: TestScenarioUpdateParams
  ): Promise<DashboardResponsePayload<TestScenario>> {
    return this.executeDashboardRequest<TestScenario>(
      'test-scenarios.update',
      params
    );
  }

  async deleteTestScenario(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ deleted: boolean; id: string }>> {
    return this.executeDashboardRequest<{ deleted: boolean; id: string }>(
      'test-scenarios.delete',
      params
    );
  }

  async injectTestData(
    params: TestScenarioInjectParams
  ): Promise<DashboardResponsePayload<InjectResult>> {
    return this.executeDashboardRequest<InjectResult>(
      'test-scenarios.inject',
      params
    );
  }

  async generateTestData(
    params: TestScenarioGenerateParams
  ): Promise<DashboardResponsePayload<GenerateResult>> {
    return this.executeDashboardRequest<GenerateResult>(
      'test-scenarios.generate',
      params
    );
  }

  async runTestTier(
    params: TestScenarioRunTierParams
  ): Promise<DashboardResponsePayload<TierRunResult>> {
    return this.executeDashboardRequest<TierRunResult>(
      'test-scenarios.run-tier',
      params
    );
  }

  async cleanupTestData(
    params: TestScenarioCleanupParams
  ): Promise<DashboardResponsePayload<CleanupResult>> {
    return this.executeDashboardRequest<CleanupResult>(
      'test-scenarios.cleanup',
      params
    );
  }

  async getTestScenarioCounts(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ scenario_id: string; counts: Record<string, number> }>> {
    return this.executeDashboardRequest<{ scenario_id: string; counts: Record<string, number> }>(
      'test-scenarios.get-counts',
      params
    );
  }

  /**
   * Export a test scenario as JSON (for 4.6 Export/Import JSON feature)
   * Exports the scenario metadata and all associated test data
   */
  async exportTestScenario(params: {
    id: string;
    includeData?: boolean; // Include injected test data
  }): Promise<DashboardResponsePayload<TestScenarioExport>> {
    return this.executeDashboardRequest<TestScenarioExport>(
      'test-scenarios.export',
      params
    );
  }

  /**
   * Import a test scenario from JSON (for 4.6 Export/Import JSON feature)
   * Creates a new scenario with optional data injection
   */
  async importTestScenario(params: {
    data: TestScenarioExport;
    newName?: string; // Override name on import
  }): Promise<DashboardResponsePayload<TestScenario>> {
    return this.executeDashboardRequest<TestScenario>(
      'test-scenarios.import',
      params
    );
  }

  // ==========================================================================
  // PHASE 3: TEST ARTICLE OPERATIONS
  // ==========================================================================

  async listTestArticles(
    params?: TestArticleListParams
  ): Promise<DashboardResponsePayload<TestArticle[]>> {
    return this.executeDashboardRequest<TestArticle[]>(
      'test-articles.list',
      params,
      undefined,
      params ? { page: params.page, pageSize: params.pageSize } : undefined
    );
  }

  async getTestArticle(params: {
    id: string;
  }): Promise<DashboardResponsePayload<TestArticle>> {
    return this.executeDashboardRequest<TestArticle>(
      'test-articles.get',
      params
    );
  }

  async createTestArticle(
    params: TestArticleCreateParams
  ): Promise<DashboardResponsePayload<TestArticle>> {
    return this.executeDashboardRequest<TestArticle>(
      'test-articles.create',
      params
    );
  }

  async updateTestArticle(
    params: TestArticleUpdateParams
  ): Promise<DashboardResponsePayload<TestArticle>> {
    return this.executeDashboardRequest<TestArticle>(
      'test-articles.update',
      params
    );
  }

  async deleteTestArticle(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ deleted: boolean; id: string }>> {
    return this.executeDashboardRequest<{ deleted: boolean; id: string }>(
      'test-articles.delete',
      params
    );
  }

  async bulkCreateTestArticles(
    params: TestArticleBulkCreateParams
  ): Promise<DashboardResponsePayload<{ created: number; articles: TestArticle[] }>> {
    return this.executeDashboardRequest<{ created: number; articles: TestArticle[] }>(
      'test-articles.bulk-create',
      params
    );
  }

  async markTestArticleProcessed(params: {
    id: string;
    isProcessed?: boolean;
  }): Promise<DashboardResponsePayload<TestArticle>> {
    return this.executeDashboardRequest<TestArticle>(
      'test-articles.mark-processed',
      params
    );
  }

  async listUnprocessedTestArticles(params?: {
    scenarioId?: string;
    targetSymbol?: string;
  }): Promise<DashboardResponsePayload<TestArticle[]>> {
    return this.executeDashboardRequest<TestArticle[]>(
      'test-articles.list-unprocessed',
      params
    );
  }

  async generateTestArticle(
    params: GenerateTestArticleParams
  ): Promise<DashboardResponsePayload<{
    articles: TestArticle[];
    generation_metadata: {
      model_used: string;
      tokens_used: number;
      generation_time_ms: number;
    };
    created_count: number;
  }>> {
    return this.executeDashboardRequest<{
      articles: TestArticle[];
      generation_metadata: {
        model_used: string;
        tokens_used: number;
        generation_time_ms: number;
      };
      created_count: number;
    }>('test-articles.generate', params);
  }

  // ==========================================================================
  // PHASE 3: TEST PRICE DATA OPERATIONS
  // ==========================================================================

  async listTestPriceData(
    params?: TestPriceDataListParams
  ): Promise<DashboardResponsePayload<TestPriceData[]>> {
    return this.executeDashboardRequest<TestPriceData[]>(
      'test-price-data.list',
      params,
      undefined,
      params ? { page: params.page, pageSize: params.pageSize } : undefined
    );
  }

  async getTestPriceData(params: {
    id: string;
  }): Promise<DashboardResponsePayload<TestPriceData>> {
    return this.executeDashboardRequest<TestPriceData>(
      'test-price-data.get',
      params
    );
  }

  async createTestPriceData(
    params: TestPriceDataCreateParams
  ): Promise<DashboardResponsePayload<TestPriceData>> {
    return this.executeDashboardRequest<TestPriceData>(
      'test-price-data.create',
      params
    );
  }

  async updateTestPriceData(
    params: TestPriceDataUpdateParams
  ): Promise<DashboardResponsePayload<TestPriceData>> {
    return this.executeDashboardRequest<TestPriceData>(
      'test-price-data.update',
      params
    );
  }

  async deleteTestPriceData(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ deleted: boolean; id: string }>> {
    return this.executeDashboardRequest<{ deleted: boolean; id: string }>(
      'test-price-data.delete',
      params
    );
  }

  async bulkCreateTestPriceData(
    params: TestPriceDataBulkCreateParams
  ): Promise<DashboardResponsePayload<{ created: number; prices: TestPriceData[] }>> {
    return this.executeDashboardRequest<{ created: number; prices: TestPriceData[] }>(
      'test-price-data.bulk-create',
      params
    );
  }

  async getLatestTestPrice(params: {
    symbol: string;
    scenarioId?: string;
  }): Promise<DashboardResponsePayload<TestPriceData | null>> {
    return this.executeDashboardRequest<TestPriceData | null>(
      'test-price-data.get-latest',
      params
    );
  }

  async getTestPricesByDateRange(params: {
    symbol: string;
    scenarioId?: string;
    startDate: string;
    endDate: string;
  }): Promise<DashboardResponsePayload<TestPriceData[]>> {
    return this.executeDashboardRequest<TestPriceData[]>(
      'test-price-data.get-by-date-range',
      params
    );
  }

  async countTestPricesBySymbol(params: {
    symbol: string;
  }): Promise<DashboardResponsePayload<{ symbol: string; count: number }>> {
    return this.executeDashboardRequest<{ symbol: string; count: number }>(
      'test-price-data.count-by-symbol',
      params
    );
  }

  // ==========================================================================
  // PHASE 4.6: TEST SCENARIO GENERATION FROM LEARNINGS/MISSED OPPORTUNITIES
  // ==========================================================================

  /**
   * Generate test scenario from a missed opportunity
   * Creates a scenario that replicates the conditions of the missed opportunity
   */
  async generateScenarioFromMissed(params: {
    missedOpportunityId: string;
    options?: {
      includeVariations?: boolean;
      variationCount?: number;
      articleCount?: number;
      additionalContext?: string;
    };
  }): Promise<DashboardResponsePayload<{
    scenario: TestScenario;
    articles: TestArticle[];
    priceData: TestPriceData[];
    sourceType: string;
    sourceId: string;
    realTargetSymbol: string;
    testTargetSymbol: string;
  }>> {
    return this.executeDashboardRequest<{
      scenario: TestScenario;
      articles: TestArticle[];
      priceData: TestPriceData[];
      sourceType: string;
      sourceId: string;
      realTargetSymbol: string;
      testTargetSymbol: string;
    }>('test-scenarios.from-missed', params);
  }

  /**
   * Generate test scenario from a learning
   * Creates a scenario that tests the learning's effectiveness
   */
  async generateScenarioFromLearning(params: {
    learningId: string;
    options?: {
      includeVariations?: boolean;
      variationCount?: number;
      articleCount?: number;
      additionalContext?: string;
    };
  }): Promise<DashboardResponsePayload<{
    scenario: TestScenario;
    articles: TestArticle[];
    priceData: TestPriceData[];
    sourceType: string;
    sourceId: string;
    realTargetSymbol: string;
    testTargetSymbol: string;
  }>> {
    return this.executeDashboardRequest<{
      scenario: TestScenario;
      articles: TestArticle[];
      priceData: TestPriceData[];
      sourceType: string;
      sourceId: string;
      realTargetSymbol: string;
      testTargetSymbol: string;
    }>('test-scenarios.from-learning', params);
  }

  // ==========================================================================
  // PHASE 3: TEST TARGET MIRROR OPERATIONS
  // ==========================================================================

  async listTestTargetMirrors(
    params?: TestTargetMirrorListParams
  ): Promise<DashboardResponsePayload<TestTargetMirror[] | TestTargetMirrorWithTarget[]>> {
    const action = params?.includeTargetDetails
      ? 'test-target-mirrors.list-with-targets'
      : 'test-target-mirrors.list';
    return this.executeDashboardRequest<TestTargetMirror[] | TestTargetMirrorWithTarget[]>(
      action,
      params,
      undefined,
      params ? { page: params.page, pageSize: params.pageSize } : undefined
    );
  }

  async getTestTargetMirror(params: {
    id: string;
    includeTargetDetails?: boolean;
  }): Promise<DashboardResponsePayload<TestTargetMirror | TestTargetMirrorWithTarget>> {
    return this.executeDashboardRequest<TestTargetMirror | TestTargetMirrorWithTarget>(
      'test-target-mirrors.get',
      params
    );
  }

  async getTestTargetMirrorByProductionTarget(params: {
    productionTargetId: string;
  }): Promise<DashboardResponsePayload<TestTargetMirror>> {
    return this.executeDashboardRequest<TestTargetMirror>(
      'test-target-mirrors.get-by-production-target',
      params
    );
  }

  async getTestTargetMirrorByTestSymbol(params: {
    testSymbol: string;
  }): Promise<DashboardResponsePayload<TestTargetMirror>> {
    return this.executeDashboardRequest<TestTargetMirror>(
      'test-target-mirrors.get-by-test-symbol',
      params
    );
  }

  async createTestTargetMirror(
    params: TestTargetMirrorCreateParams
  ): Promise<DashboardResponsePayload<TestTargetMirror>> {
    return this.executeDashboardRequest<TestTargetMirror>(
      'test-target-mirrors.create',
      params
    );
  }

  async ensureTestTargetMirror(
    params: TestTargetMirrorEnsureParams
  ): Promise<DashboardResponsePayload<{ mirror: TestTargetMirror; created: boolean }>> {
    return this.executeDashboardRequest<{ mirror: TestTargetMirror; created: boolean }>(
      'test-target-mirrors.ensure',
      params
    );
  }

  async deleteTestTargetMirror(params: {
    id: string;
  }): Promise<DashboardResponsePayload<{ deleted: boolean; id: string; test_symbol: string }>> {
    return this.executeDashboardRequest<{ deleted: boolean; id: string; test_symbol: string }>(
      'test-target-mirrors.delete',
      params
    );
  }

  // ==========================================================================
  // PHASE 5: LEARNING PROMOTION OPERATIONS
  // ==========================================================================

  /**
   * Get promotion candidates - test learnings ready for promotion
   */
  async getPromotionCandidates(
    page?: number,
    pageSize?: number
  ): Promise<DashboardResponsePayload<unknown[]>> {
    return this.executeDashboardRequest<unknown[]>(
      'learning-promotion.list-candidates',
      undefined,
      undefined,
      { page, pageSize }
    );
  }

  /**
   * Validate a learning for promotion
   */
  async validateLearning(
    learningId: string
  ): Promise<DashboardResponsePayload<unknown>> {
    return this.executeDashboardRequest<unknown>(
      'learning-promotion.validate',
      { learningId }
    );
  }

  /**
   * Promote a learning to production
   */
  async promoteLearning(params: {
    learningId: string;
    reviewerNotes?: string;
    backtestResult?: Record<string, unknown>;
    scenarioRunIds?: string[];
  }): Promise<DashboardResponsePayload<{
    success: boolean;
    productionLearningId: string;
    promotionHistoryId: string;
  }>> {
    return this.executeDashboardRequest<{
      success: boolean;
      productionLearningId: string;
      promotionHistoryId: string;
    }>('learning-promotion.promote', params);
  }

  /**
   * Reject a learning with reason
   */
  async rejectLearning(params: {
    learningId: string;
    reason: string;
  }): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'learning-promotion.reject',
      params
    );
  }

  /**
   * Get promotion history
   */
  async getPromotionHistory(
    page?: number,
    pageSize?: number
  ): Promise<DashboardResponsePayload<unknown[]>> {
    return this.executeDashboardRequest<unknown[]>(
      'learning-promotion.history',
      undefined,
      undefined,
      { page, pageSize }
    );
  }

  /**
   * Get promotion statistics
   */
  async getPromotionStats(): Promise<DashboardResponsePayload<unknown>> {
    return this.executeDashboardRequest<unknown>(
      'learning-promotion.stats'
    );
  }

  /**
   * Run a backtest on a learning
   */
  async runBacktest(params: {
    learningId: string;
    windowDays?: number;
  }): Promise<DashboardResponsePayload<unknown>> {
    return this.executeDashboardRequest<unknown>(
      'learning-promotion.run-backtest',
      params
    );
  }
}

export const predictionDashboardService = new PredictionDashboardService();
