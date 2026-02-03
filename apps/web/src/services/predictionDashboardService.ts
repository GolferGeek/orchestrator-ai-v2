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
import { useAgentsStore } from '@/stores/agentsStore';
import type { JsonValue } from '@/types';
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

const API_PORT = import.meta.env.VITE_API_PORT || '6100';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_NESTJS_BASE_URL ||
  `http://localhost:${API_PORT}`;

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
  // Outcome and reasoning fields (populated when prediction is resolved)
  outcomeValue?: number;
  rationale?: string;
  notes?: string;
  // Per-analyst prediction fields
  analystSlug?: string;
  isArbitrator?: boolean;
  reasoning?: string;
  // Analyst opinions embedded in arbitrator prediction
  analystAssessments?: Array<{
    analystSlug: string;
    analystName?: string;
    direction: string;
    confidence: number;
    reasoning?: string;
    // Three-way fork assessments
    userFork?: {
      direction: string;
      confidence: number;
      reasoning?: string;
    };
    aiFork?: {
      direction: string;
      confidence: number;
      reasoning?: string;
    };
    arbitratorFork?: {
      direction: string;
      confidence: number;
      reasoning?: string;
    };
  }>;
  // Fork comparison metadata
  forkMetadata?: {
    totalAnalysts: number;
    userVsAiAgreement: number;
    arbitratorAgreesWithUser: number;
    arbitratorAgreesWithAi: number;
  };
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

/**
 * Full prediction lineage data from deep-dive endpoint
 * Includes complete chain: Prediction -> Predictors -> Signals -> Articles
 */
export interface PredictionDeepDive {
  prediction: {
    id: string;
    targetId: string;
    direction: string;
    magnitude?: string;
    confidence: number;
    timeframeHours?: number;
    status: string;
    predictedAt: string;
    expiresAt?: string;
    outcomeValue?: number;
    resolutionNotes?: string;
    reasoning?: string;
  };
  lineage: {
    predictors: Array<{
      id: string;
      direction: string;
      strength: number;
      confidence: number;
      reasoning?: string;
      analystSlug?: string;
      createdAt: string;
      signal: {
        id: string;
        content: string;
        direction: string;
        urgency?: string;
        sourceId: string;
        detectedAt: string;
        url?: string;
      } | null;
      fingerprint: {
        titleNormalized?: string;
        keyPhrases?: string[];
        fingerprintHash?: string;
      } | null;
      sourceArticle: {
        url?: string;
        title?: string;
        firstSeenAt?: string;
        contentHash?: string;
      } | null;
    }>;
    analystAssessments: Array<{
      analystSlug: string;
      tier: string;
      direction: string;
      confidence: number;
      reasoning?: string;
      keyFactors?: string[];
      risks?: string[];
      learningsApplied?: string[];
    }>;
    llmEnsemble: {
      tiers_used?: string[];
      tier_results?: Record<string, {
        direction: string;
        confidence: number;
        model: string;
        provider: string;
      }>;
      agreement_level?: number;
    } | null;
    thresholdEvaluation: {
      min_predictors?: number;
      actual_predictors?: number;
      min_combined_strength?: number;
      actual_combined_strength?: number;
      min_consensus?: number;
      actual_consensus?: number;
      passed?: boolean;
    } | null;
    timeline: Array<{
      timestamp: string;
      event_type: string;
      details?: Record<string, unknown>;
    }>;
  };
  stats: {
    predictorCount: number;
    signalCount: number;
    analystCount: number;
    averageConfidence: number;
  };
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
// PHASE 7 TYPES - Agent Activity (Self-Modification Notifications)
// ============================================================================

export type AgentModificationType =
  | 'rule_added'
  | 'rule_removed'
  | 'weight_changed'
  | 'journal_entry'
  | 'status_change';

export interface AgentActivityItem {
  id: string;
  analystId: string;
  analystName?: string;
  modificationType: AgentModificationType;
  summary: string;
  details: Record<string, unknown>;
  triggerReason: string;
  performanceContext: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

// ============================================================================
// PHASE 7 TYPES - Learning Session (Bidirectional Learning)
// ============================================================================

export type ExchangeOutcome = 'adopted' | 'rejected' | 'noted' | 'pending';
export type ExchangeInitiator = 'user' | 'agent';

export interface LearningExchange {
  id: string;
  analystId: string;
  analystName?: string;
  initiatedBy: ExchangeInitiator;
  question: string;
  response: string | null;
  contextDiff: Record<string, unknown>;
  performanceEvidence: Record<string, unknown>;
  outcome: ExchangeOutcome;
  adoptionDetails: Record<string, unknown> | null;
  createdAt: string;
}

export interface ForkComparisonReport {
  analystId: string;
  analystName: string;
  period: string;
  userFork: {
    currentBalance: number;
    totalPnl: number;
    winRate: number;
    winCount: number;
    lossCount: number;
  };
  agentFork: {
    currentBalance: number;
    totalPnl: number;
    winRate: number;
    winCount: number;
    lossCount: number;
  };
  contextDiffs: Array<{
    field: string;
    userValue: string;
    agentValue: string;
  }>;
  divergentPredictions: Array<{
    predictionId: string;
    targetSymbol: string;
    userDirection: string;
    agentDirection: string;
    userConfidence: number;
    agentConfidence: number;
    actualOutcome: string;
  }>;
}

export interface LearningSessionResponse {
  analystId: string;
  analystName: string;
  comparisonReport: ForkComparisonReport;
  exchanges: LearningExchange[];
}

export interface AnalystContextVersion {
  id: string;
  analystId: string;
  forkType: 'user' | 'agent';
  versionNumber: number;
  perspective: string;
  tierInstructions: Record<string, string>;
  defaultWeight: number;
  agentJournal: string | null;
  changeReason: string;
  changedBy: string;
  isCurrent: boolean;
  createdAt: string;
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
// PHASE 8 TYPES - Historical Replay Tests
// ============================================================================

export type ReplayTestStatus = 'pending' | 'snapshot_created' | 'running' | 'completed' | 'failed' | 'restored';
export type RollbackDepth = 'predictions' | 'predictors' | 'signals';

export interface ReplayTestResults {
  total_comparisons: number;
  direction_matches: number;
  original_correct_count: number;
  replay_correct_count: number;
  improvements: number;
  original_accuracy_pct: number | null;
  replay_accuracy_pct: number | null;
  accuracy_delta: number | null;
  total_pnl_original: number | null;
  total_pnl_replay: number | null;
  pnl_delta: number | null;
  avg_confidence_diff: number | null;
}

export interface ReplayTest {
  id: string;
  organization_slug: string;
  name: string;
  description: string | null;
  status: ReplayTestStatus;
  rollback_depth: RollbackDepth;
  rollback_to: string;
  universe_id: string | null;
  target_ids: string[] | null;
  config: Record<string, unknown>;
  results: ReplayTestResults | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ReplayTestSummary extends ReplayTest {
  total_comparisons: number;
  direction_matches: number;
  original_correct_count: number;
  replay_correct_count: number;
  improvements: number;
  original_accuracy_pct: number | null;
  replay_accuracy_pct: number | null;
  total_pnl_original: number | null;
  total_pnl_replay: number | null;
  total_pnl_improvement: number | null;
  avg_confidence_diff: number | null;
}

export interface ReplayAffectedRecords {
  table_name: string;
  record_ids: string[];
  row_count: number;
}

export interface ReplayTestResult {
  id: string;
  replay_test_id: string;
  target_id: string | null;
  original_prediction_id: string | null;
  original_direction: string | null;
  original_confidence: number | null;
  replay_prediction_id: string | null;
  replay_direction: string | null;
  replay_confidence: number | null;
  direction_match: boolean | null;
  confidence_diff: number | null;
  original_correct: boolean | null;
  replay_correct: boolean | null;
  improvement: boolean | null;
  pnl_original: number | null;
  pnl_replay: number | null;
  pnl_diff: number | null;
  created_at: string;
}

export interface ReplayTestCreateParams {
  name: string;
  description?: string;
  rollbackDepth: RollbackDepth;
  rollbackTo: string;
  universeId: string;
  targetIds?: string[];
  config?: Record<string, unknown>;
}

export interface ReplayTestPreviewParams {
  rollbackDepth: RollbackDepth;
  rollbackTo: string;
  universeId: string;
  targetIds?: string[];
}

export interface ReplayTestPreviewResult {
  rollback_depth: RollbackDepth;
  rollback_to: string;
  universe_id: string;
  target_ids: string[] | undefined;
  total_records: number;
  by_table: ReplayAffectedRecords[];
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
// TRANSFORMERS - Convert snake_case API responses to camelCase frontend types
// ============================================================================

interface ApiUniverse {
  id: string;
  name: string;
  domain: 'stocks' | 'crypto' | 'elections' | 'polymarket';
  description?: string | null;
  organization_slug: string;
  agent_slug: string;
  strategy_id?: string | null;
  llm_config?: Record<string, unknown> | null;
  thresholds?: Record<string, unknown> | null;
  notification_config?: Record<string, unknown>;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

function transformUniverse(api: ApiUniverse): PredictionUniverse {
  const llmConfig = api.llm_config as Record<string, unknown> | null;
  return {
    id: api.id,
    name: api.name,
    domain: api.domain,
    description: api.description ?? undefined,
    organizationSlug: api.organization_slug,
    agentSlug: api.agent_slug,
    strategyId: api.strategy_id ?? undefined,
    llmConfig: llmConfig ? {
      provider: llmConfig.provider as string | undefined,
      model: llmConfig.model as string | undefined,
      tiers: llmConfig.tiers as {
        gold?: { provider: string; model: string };
        silver?: { provider: string; model: string };
        bronze?: { provider: string; model: string };
      } | undefined,
    } : undefined,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformUniverses(apis: ApiUniverse[]): PredictionUniverse[] {
  if (!Array.isArray(apis)) {
    console.warn('transformUniverses received non-array:', apis);
    return [];
  }
  return apis.map(transformUniverse);
}

// Target transformer (snake_case API -> camelCase frontend)
interface ApiTarget {
  id: string;
  universe_id: string;
  name: string;
  symbol: string;
  target_type: string;
  context?: string | null;
  llm_config_override?: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function transformTarget(api: ApiTarget): PredictionTarget {
  return {
    id: api.id,
    universeId: api.universe_id,
    name: api.name,
    symbol: api.symbol,
    targetType: api.target_type,
    context: api.context ?? undefined,
    llmConfigOverride: api.llm_config_override ?? undefined,
    active: api.is_active,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformTargets(apis: ApiTarget[]): PredictionTarget[] {
  if (!Array.isArray(apis)) {
    console.warn('transformTargets received non-array:', apis);
    return [];
  }
  return apis.map(transformTarget);
}

// Source transformer (snake_case API -> camelCase frontend)
interface ApiSource {
  id: string;
  name: string;
  description?: string | null;
  source_type: string;
  url: string;
  scope_level: string;
  domain?: string | null;
  universe_id?: string | null;
  target_id?: string | null;
  crawl_config: Record<string, unknown>;
  auth_config?: Record<string, unknown> | null;
  crawl_frequency_minutes: number;
  is_active: boolean;
  is_test?: boolean;
  last_crawl_at?: string | null;
  last_crawl_status?: string | null;
  last_error?: string | null;
  consecutive_errors?: number;
  created_at: string;
  updated_at: string;
}

function transformSource(api: ApiSource): PredictionSource {
  return {
    id: api.id,
    name: api.name,
    sourceType: api.source_type as 'web' | 'rss' | 'twitter_search' | 'api',
    scopeLevel: api.scope_level as 'runner' | 'domain' | 'universe' | 'target',
    domain: api.domain ?? undefined,
    universeId: api.universe_id ?? undefined,
    targetId: api.target_id ?? undefined,
    crawlConfig: {
      ...api.crawl_config,
      url: api.url, // Include url in crawlConfig for frontend convenience
    },
    authConfig: api.auth_config ?? undefined,
    active: api.is_active,
    lastCrawledAt: api.last_crawl_at ?? undefined,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformSources(apis: ApiSource[]): PredictionSource[] {
  if (!Array.isArray(apis)) {
    console.warn('transformSources received non-array:', apis);
    return [];
  }
  return apis.map(transformSource);
}

// Analyst transformer (snake_case API -> camelCase frontend)
interface ApiAnalyst {
  id: string;
  slug: string;
  name: string;
  perspective: string;
  scope_level: string;
  domain?: string | null;
  universe_id?: string | null;
  target_id?: string | null;
  default_weight: number;
  tier_instructions?: {
    gold?: string;
    silver?: string;
    bronze?: string;
  } | null;
  learned_patterns?: string[] | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

function transformAnalyst(api: ApiAnalyst): PredictionAnalyst {
  return {
    id: api.id,
    slug: api.slug,
    name: api.name,
    perspective: api.perspective,
    scopeLevel: api.scope_level as 'runner' | 'domain' | 'universe' | 'target',
    domain: api.domain ?? undefined,
    universeId: api.universe_id ?? undefined,
    targetId: api.target_id ?? undefined,
    defaultWeight: api.default_weight,
    tierInstructions: api.tier_instructions ?? undefined,
    learnedPatterns: api.learned_patterns ?? undefined,
    active: api.is_enabled,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

function transformAnalysts(apis: ApiAnalyst[]): PredictionAnalyst[] {
  if (!Array.isArray(apis)) {
    console.warn('transformAnalysts received non-array:', apis);
    return [];
  }
  return apis.map(transformAnalyst);
}

// ============================================================================
// SERVICE
// ============================================================================

class PredictionDashboardService {
  private defaultAgentSlug = 'us-tech-stocks'; // Default prediction agent
  private currentAgentSlug: string | null = null;
  private currentOrgSlug: string | null = null;
  private authStore: ReturnType<typeof useAuthStore> | null = null;
  // Dashboard conversation ID - set once per session to avoid creating multiple conversations
  private dashboardConversationId: string | null = null;

  /**
   * Set the current agent slug for API calls
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
   * Set the dashboard conversation ID for this session
   * This prevents creating multiple conversations for parallel dashboard calls
   * Call this once when the dashboard mounts
   */
  setDashboardConversationId(conversationId: string): void {
    this.dashboardConversationId = conversationId;
  }

  /**
   * Get or generate a dashboard conversation ID
   * Returns existing ID if set, otherwise generates a new one
   */
  getDashboardConversationId(): string {
    if (!this.dashboardConversationId) {
      this.dashboardConversationId = crypto.randomUUID();
    }
    return this.dashboardConversationId;
  }

  /**
   * Reset the dashboard conversation ID (e.g., when switching agents)
   */
  resetDashboardConversationId(): void {
    this.dashboardConversationId = null;
  }

  /**
   * Get the current agent slug, falling back to default
   */
  private getAgentSlug(): string {
    return this.currentAgentSlug || this.defaultAgentSlug;
  }

  private getAuthStore(): ReturnType<typeof useAuthStore> {
    if (!this.authStore) {
      this.authStore = useAuthStore();
    }
    return this.authStore;
  }

  private getOrgSlug(): string {
    // Priority: explicit org slug > auth store current org > agent's org from store
    // Explicit org slug is set when viewing an agent from a specific org (e.g., super-user)
    if (this.currentOrgSlug && this.currentOrgSlug !== '*') {
      return this.currentOrgSlug;
    }

    const authOrg = this.getAuthStore().currentOrganization;
    if (authOrg && authOrg !== '*') {
      return authOrg;
    }

    // If we have a current agent slug, look up its org from the agents store
    // This handles the case where user is in "all orgs" mode but has selected a specific agent
    if (this.currentAgentSlug) {
      const agentsStore = useAgentsStore();
      const agent = agentsStore.availableAgents?.find(
        (a) => a.slug === this.currentAgentSlug || a.name === this.currentAgentSlug
      );
      if (agent?.organizationSlug && agent.organizationSlug !== '*') {
        const orgSlug = Array.isArray(agent.organizationSlug)
          ? agent.organizationSlug[0]
          : agent.organizationSlug;
        if (orgSlug && orgSlug !== '*') {
          return orgSlug;
        }
      }
    }

    // If we have global org (*), provide helpful error
    if (authOrg === '*' || this.currentOrgSlug === '*') {
      throw new Error('Global organization (*) is not supported for prediction analysis. The organization should be set from the selected agent.');
    }

    throw new Error('No organization context available. Please select an agent to view predictions.');
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

    // Use the dashboard conversation ID to avoid creating multiple conversations per session
    return {
      orgSlug,
      userId,
      conversationId: this.getDashboardConversationId(),
      taskId: crypto.randomUUID(),
      planId: '00000000-0000-0000-0000-000000000000',
      deliverableId: '00000000-0000-0000-0000-000000000000',
      agentSlug: this.getAgentSlug(),
      agentType: 'prediction',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };
  }

  private async executeDashboardRequest<T>(
    action: string,
    params?: Record<string, unknown>,
    filters?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number }
  ): Promise<DashboardResponsePayload<T>> {
    const org = this.getOrgSlug();
    const endpoint = `${API_BASE_URL}/agent-to-agent/${encodeURIComponent(org)}/${encodeURIComponent(this.getAgentSlug())}/tasks`;

    const payload: DashboardRequestPayload = {
      action,
      params: params as unknown as JsonValue | undefined,
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
    const response = await this.executeDashboardRequest<ApiUniverse[]>(
      'universes.list',
      undefined,
      params as unknown as Record<string, unknown> | undefined
    );
    // Transform snake_case API response to camelCase frontend type
    return {
      ...response,
      content: response.content ? transformUniverses(response.content) : ([] as PredictionUniverse[]),
    };
  }

  async getUniverse(
    params: UniverseGetParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    const response = await this.executeDashboardRequest<ApiUniverse>(
      'universes.get',
      params as unknown as Record<string, unknown>
    );
    // Transform snake_case API response to camelCase frontend type
    return {
      ...response,
      content: response.content ? transformUniverse(response.content) : null!,
    };
  }

  async createUniverse(
    params: UniverseCreateParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    const response = await this.executeDashboardRequest<ApiUniverse>(
      'universes.create',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformUniverse(response.content) : null!,
    };
  }

  async updateUniverse(
    params: UniverseUpdateParams
  ): Promise<DashboardResponsePayload<PredictionUniverse>> {
    const response = await this.executeDashboardRequest<ApiUniverse>(
      'universes.update',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformUniverse(response.content) : null!,
    };
  }

  async deleteUniverse(
    params: UniverseDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'universes.delete',
      params as unknown as Record<string, unknown>
    );
  }

  // ==========================================================================
  // TARGET OPERATIONS
  // ==========================================================================

  async listTargets(
    params?: TargetListParams
  ): Promise<DashboardResponsePayload<PredictionTarget[]>> {
    // Pass universeId in params (first position) as backend expects it there
    const response = await this.executeDashboardRequest<ApiTarget[]>(
      'targets.list',
      params as unknown as Record<string, unknown> | undefined, // universeId goes in params, not filters
      undefined
    );
    // Transform snake_case API response to camelCase frontend type
    return {
      ...response,
      content: response.content ? transformTargets(response.content) : ([] as PredictionTarget[]),
    };
  }

  async getTarget(
    params: TargetGetParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    const response = await this.executeDashboardRequest<ApiTarget>(
      'targets.get',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformTarget(response.content) : null!,
    };
  }

  async createTarget(
    params: TargetCreateParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    const response = await this.executeDashboardRequest<ApiTarget>(
      'targets.create',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformTarget(response.content) : null!,
    };
  }

  async updateTarget(
    params: TargetUpdateParams
  ): Promise<DashboardResponsePayload<PredictionTarget>> {
    const response = await this.executeDashboardRequest<ApiTarget>(
      'targets.update',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformTarget(response.content) : null!,
    };
  }

  async deleteTarget(
    params: TargetDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'targets.delete',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined,
      pagination
    );
  }

  async getPrediction(
    params: PredictionGetParams
  ): Promise<DashboardResponsePayload<Prediction>> {
    return this.executeDashboardRequest<Prediction>(
      'predictions.get',
      params as unknown as Record<string, unknown>
    );
  }

  async getPredictionSnapshot(
    params: PredictionGetSnapshotParams
  ): Promise<DashboardResponsePayload<PredictionSnapshot>> {
    return this.executeDashboardRequest<PredictionSnapshot>(
      'predictions.getSnapshot',
      params as unknown as Record<string, unknown>
    );
  }

  /**
   * Get full prediction deep-dive with complete lineage
   * Prediction -> Predictors -> Signals -> Articles
   */
  async getPredictionDeepDive(
    params: { id: string }
  ): Promise<DashboardResponsePayload<PredictionDeepDive>> {
    return this.executeDashboardRequest<PredictionDeepDive>(
      'predictions.deepDive',
      params
    );
  }

  // ==========================================================================
  // SOURCE OPERATIONS
  // ==========================================================================

  async listSources(
    params?: SourceListParams
  ): Promise<DashboardResponsePayload<PredictionSource[]>> {
    const response = await this.executeDashboardRequest<ApiSource[]>(
      'sources.list',
      undefined,
      params as unknown as Record<string, unknown> | undefined
    );
    return {
      ...response,
      content: response.content ? transformSources(response.content) : ([] as PredictionSource[]),
    };
  }

  async getSource(
    params: SourceGetParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    const response = await this.executeDashboardRequest<ApiSource>(
      'sources.get',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformSource(response.content) : null!,
    };
  }

  async createSource(
    params: SourceCreateParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    const response = await this.executeDashboardRequest<ApiSource>(
      'sources.create',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformSource(response.content) : null!,
    };
  }

  async updateSource(
    params: SourceUpdateParams
  ): Promise<DashboardResponsePayload<PredictionSource>> {
    const response = await this.executeDashboardRequest<ApiSource>(
      'sources.update',
      params as unknown as Record<string, unknown>
    );
    return {
      ...response,
      content: response.content ? transformSource(response.content) : null!,
    };
  }

  async deleteSource(
    params: SourceDeleteParams
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'sources.delete',
      params as unknown as Record<string, unknown>
    );
  }

  async testCrawl(
    params: SourceTestCrawlParams
  ): Promise<DashboardResponsePayload<TestCrawlResult>> {
    return this.executeDashboardRequest<TestCrawlResult>(
      'sources.testCrawl',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined
    );
  }

  // ==========================================================================
  // PHASE 11: ANALYST OPERATIONS
  // ==========================================================================

  async listAnalysts(
    params?: AnalystListParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst[]>> {
    const response = await this.executeDashboardRequest<ApiAnalyst[]>(
      'analysts.list',
      undefined,
      params as unknown as Record<string, unknown> | undefined
    );
    // Transform snake_case API response to camelCase frontend format
    return {
      ...response,
      content: response.content ? transformAnalysts(response.content) : ([] as PredictionAnalyst[]),
    };
  }

  async getAnalyst(params: {
    id: string;
  }): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    const response = await this.executeDashboardRequest<ApiAnalyst>(
      'analysts.get',
      params
    );
    // Transform snake_case API response to camelCase frontend format
    return {
      ...response,
      content: response.content ? transformAnalyst(response.content) : null!,
    };
  }

  async createAnalyst(
    params: AnalystCreateParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    // Transform camelCase to snake_case for API compatibility
    const transformedParams = {
      slug: params.slug,
      name: params.name,
      perspective: params.perspective,
      scope_level: params.scopeLevel,
      domain: params.domain,
      universe_id: params.universeId,
      target_id: params.targetId,
      default_weight: params.defaultWeight,
      tier_instructions: params.tierInstructions,
    };
    const response = await this.executeDashboardRequest<ApiAnalyst>(
      'analysts.create',
      transformedParams
    );
    // Transform snake_case API response to camelCase frontend format
    return {
      ...response,
      content: response.content ? transformAnalyst(response.content) : null!,
    };
  }

  async updateAnalyst(
    params: AnalystUpdateParams
  ): Promise<DashboardResponsePayload<PredictionAnalyst>> {
    // Transform camelCase to snake_case for API compatibility
    const transformedParams = {
      id: params.id,
      name: params.name,
      perspective: params.perspective,
      default_weight: params.defaultWeight,
      tier_instructions: params.tierInstructions,
      is_enabled: params.active, // Use is_enabled for backend
    };
    const response = await this.executeDashboardRequest<ApiAnalyst>(
      'analysts.update',
      transformedParams as unknown as Record<string, unknown>
    );
    // Transform snake_case API response to camelCase frontend format
    return {
      ...response,
      content: response.content ? transformAnalyst(response.content) : null!,
    };
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

  /**
   * Transform learning response from snake_case (API) to camelCase (frontend)
   */
  private transformLearningResponse(learning: Record<string, unknown>): PredictionLearning {
    return {
      id: learning.id as string,
      title: learning.title as string,
      scopeLevel: (learning.scope_level as string) || (learning.scopeLevel as string),
      domain: (learning.domain as string | null) || null,
      universeId: (learning.universe_id as string | null) || (learning.universeId as string | null) || null,
      targetId: (learning.target_id as string | null) || (learning.targetId as string | null) || null,
      analystId: (learning.analyst_id as string | null) || (learning.analystId as string | null) || null,
      learningType: (learning.learning_type as string) || (learning.learningType as string),
      content: (learning.description as string) || (learning.content as string) || '',
      sourceType: (learning.source_type as string) || (learning.sourceType as string),
      status: learning.status as string,
      supersededBy: (learning.superseded_by as string | null) || (learning.supersededBy as string | null) || null,
      createdAt: (learning.created_at as string) || (learning.createdAt as string),
      updatedAt: (learning.updated_at as string) || (learning.updatedAt as string),
    } as PredictionLearning;
  }

  async listLearnings(
    params?: LearningListParams
  ): Promise<DashboardResponsePayload<PredictionLearning[]>> {
    const response = await this.executeDashboardRequest<Record<string, unknown>[]>(
      'learnings.list',
      undefined,
      params as unknown as Record<string, unknown> | undefined
    );
    // Transform snake_case response to camelCase
    if (response.content && Array.isArray(response.content)) {
      response.content = response.content.map((l) => this.transformLearningResponse(l)) as unknown as Record<string, unknown>[];
    }
    return response as unknown as DashboardResponsePayload<PredictionLearning[]>;
  }

  async getLearning(params: {
    id: string;
  }): Promise<DashboardResponsePayload<PredictionLearning>> {
    const response = await this.executeDashboardRequest<Record<string, unknown>>(
      'learnings.get',
      params
    );
    // Transform snake_case response to camelCase
    if (response.content) {
      response.content = this.transformLearningResponse(response.content) as unknown as Record<string, unknown>;
    }
    return response as unknown as DashboardResponsePayload<PredictionLearning>;
  }

  async createLearning(
    params: LearningCreateParams
  ): Promise<DashboardResponsePayload<PredictionLearning>> {
    // Transform camelCase to snake_case for API compatibility
    // Note: API expects 'description' but frontend uses 'content'
    const transformedParams = {
      title: params.title,
      scope_level: params.scopeLevel,
      domain: params.domain,
      universe_id: params.universeId,
      target_id: params.targetId,
      analyst_id: params.analystId,
      learning_type: params.learningType,
      description: params.content, // API field name differs from frontend
      source_type: params.sourceType,
    };
    const response = await this.executeDashboardRequest<Record<string, unknown>>(
      'learnings.create',
      transformedParams
    );
    // Transform snake_case response to camelCase
    if (response.content) {
      response.content = this.transformLearningResponse(response.content) as unknown as Record<string, unknown>;
    }
    return response as unknown as DashboardResponsePayload<PredictionLearning>;
  }

  async updateLearning(
    params: LearningUpdateParams
  ): Promise<DashboardResponsePayload<PredictionLearning>> {
    return this.executeDashboardRequest<PredictionLearning>(
      'learnings.update',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined
    );
  }

  async respondToLearningQueue(
    params: LearningQueueRespondParams
  ): Promise<DashboardResponsePayload<{ success: boolean; learningId?: string }>> {
    return this.executeDashboardRequest<{ success: boolean; learningId?: string }>(
      'learnings.respondQueue',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined
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
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined
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
      params as unknown as Record<string, unknown> | undefined
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
      params as unknown as Record<string, unknown>
    );
  }

  async updateToolRequestStatus(
    params: ToolRequestUpdateStatusParams
  ): Promise<DashboardResponsePayload<ToolRequest>> {
    return this.executeDashboardRequest<ToolRequest>(
      'toolRequests.updateStatus',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined
    );
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  async loadDashboardData(universeId?: string, agentSlug?: string, includeTestData = true): Promise<{
    universes: PredictionUniverse[];
    predictions: Prediction[];
    strategies: PredictionStrategy[];
  }> {
    const universeFilters: UniverseListParams | undefined = agentSlug ? { agentSlug } as UniverseListParams : undefined;
    // Include test data by default since seed data uses is_test_data=true
    const predictionFilters = universeId
      ? { universeId, includeTestData }
      : { includeTestData };

    const [universesRes, predictionsRes, strategiesRes] = await Promise.all([
      this.listUniverses(universeFilters),
      this.listPredictions(predictionFilters, { pageSize: 50 }),
      this.listStrategies(),
    ]);

    // If agentSlug provided, filter universes and predictions to only those for this agent
    let universes: PredictionUniverse[] = universesRes.content || [];
    let predictions: Prediction[] = predictionsRes.content || [];

    if (agentSlug) {
      universes = universes.filter((u: PredictionUniverse) => u.agentSlug === agentSlug);
      const universeIds = new Set(universes.map((u: PredictionUniverse) => u.id));
      predictions = predictions.filter((p: Prediction) => universeIds.has(p.universeId));
    }

    return {
      universes,
      predictions,
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
      params as unknown as Record<string, unknown>
    );
  }

  async updateTestScenario(
    params: TestScenarioUpdateParams
  ): Promise<DashboardResponsePayload<TestScenario>> {
    return this.executeDashboardRequest<TestScenario>(
      'test-scenarios.update',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown>
    );
  }

  async generateTestData(
    params: TestScenarioGenerateParams
  ): Promise<DashboardResponsePayload<GenerateResult>> {
    return this.executeDashboardRequest<GenerateResult>(
      'test-scenarios.generate',
      params as unknown as Record<string, unknown>
    );
  }

  async runTestTier(
    params: TestScenarioRunTierParams
  ): Promise<DashboardResponsePayload<TierRunResult>> {
    return this.executeDashboardRequest<TierRunResult>(
      'test-scenarios.run-tier',
      params as unknown as Record<string, unknown>
    );
  }

  async cleanupTestData(
    params: TestScenarioCleanupParams
  ): Promise<DashboardResponsePayload<CleanupResult>> {
    return this.executeDashboardRequest<CleanupResult>(
      'test-scenarios.cleanup',
      params as unknown as Record<string, unknown>
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
  // PHASE 8: HISTORICAL REPLAY TEST OPERATIONS
  // ==========================================================================

  /**
   * List all replay tests for the organization
   */
  async listReplayTests(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DashboardResponsePayload<ReplayTestSummary[]>> {
    return this.executeDashboardRequest<ReplayTestSummary[]>(
      'replay-tests.list',
      params,
      undefined,
      params ? { page: params.page, pageSize: params.pageSize } : undefined
    );
  }

  /**
   * Get a single replay test by ID
   */
  async getReplayTest(params: { id: string }): Promise<DashboardResponsePayload<ReplayTestSummary>> {
    return this.executeDashboardRequest<ReplayTestSummary>(
      'replay-tests.get',
      params
    );
  }

  /**
   * Create a new replay test
   */
  async createReplayTest(
    params: ReplayTestCreateParams
  ): Promise<DashboardResponsePayload<ReplayTest>> {
    return this.executeDashboardRequest<ReplayTest>(
      'replay-tests.create',
      params as unknown as Record<string, unknown>
    );
  }

  /**
   * Delete a replay test
   */
  async deleteReplayTest(params: { id: string }): Promise<DashboardResponsePayload<{ deleted: boolean; id: string }>> {
    return this.executeDashboardRequest<{ deleted: boolean; id: string }>(
      'replay-tests.delete',
      params
    );
  }

  /**
   * Preview what records would be affected by a replay test
   */
  async previewReplayTest(
    params: ReplayTestPreviewParams
  ): Promise<DashboardResponsePayload<ReplayTestPreviewResult>> {
    return this.executeDashboardRequest<ReplayTestPreviewResult>(
      'replay-tests.preview',
      params as unknown as Record<string, unknown>
    );
  }

  /**
   * Run a replay test
   */
  async runReplayTest(params: { id: string }): Promise<DashboardResponsePayload<ReplayTestSummary>> {
    return this.executeDashboardRequest<ReplayTestSummary>(
      'replay-tests.run',
      params
    );
  }

  /**
   * Get detailed results for a replay test
   */
  async getReplayTestResults(params: { id: string }): Promise<DashboardResponsePayload<{
    replay_test_id: string;
    count: number;
    results: ReplayTestResult[];
  }>> {
    return this.executeDashboardRequest<{
      replay_test_id: string;
      count: number;
      results: ReplayTestResult[];
    }>(
      'replay-tests.results',
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
      params as unknown as Record<string, unknown> | undefined,
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
      params as unknown as Record<string, unknown>
    );
  }

  async updateTestArticle(
    params: TestArticleUpdateParams
  ): Promise<DashboardResponsePayload<TestArticle>> {
    return this.executeDashboardRequest<TestArticle>(
      'test-articles.update',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown>
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
    }>('test-articles.generate', params as unknown as Record<string, unknown>);
  }

  // ==========================================================================
  // PHASE 3: TEST PRICE DATA OPERATIONS
  // ==========================================================================

  async listTestPriceData(
    params?: TestPriceDataListParams
  ): Promise<DashboardResponsePayload<TestPriceData[]>> {
    return this.executeDashboardRequest<TestPriceData[]>(
      'test-price-data.list',
      params as unknown as Record<string, unknown> | undefined,
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
      params as unknown as Record<string, unknown>
    );
  }

  async updateTestPriceData(
    params: TestPriceDataUpdateParams
  ): Promise<DashboardResponsePayload<TestPriceData>> {
    return this.executeDashboardRequest<TestPriceData>(
      'test-price-data.update',
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown>
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
      params as unknown as Record<string, unknown> | undefined,
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
      params as unknown as Record<string, unknown>
    );
  }

  async ensureTestTargetMirror(
    params: TestTargetMirrorEnsureParams
  ): Promise<DashboardResponsePayload<{ mirror: TestTargetMirror; created: boolean }>> {
    return this.executeDashboardRequest<{ mirror: TestTargetMirror; created: boolean }>(
      'test-target-mirrors.ensure',
      params as unknown as Record<string, unknown>
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

  // ==========================================================================
  // MANUAL PROCESSING OPERATIONS
  // ==========================================================================
  // These actions allow manual triggering of pipeline steps:
  // 1. crawlSources: Source crawl → Article creation (in crawler schema)
  // 2. processArticles: Article → Predictor creation (new unified flow)
  // 3. generatePredictions: Predictor → Prediction generation
  //
  // NOTE: processSignals is DEPRECATED - use processArticles instead.
  // The signals intermediate layer has been removed; predictors are now
  // created directly from articles via the ArticleProcessorService.

  /**
   * Process crawler articles to create predictors directly
   * This is the new unified flow that replaces signals.
   *
   * Articles are analyzed for instrument relevance, then run through
   * the analyst ensemble to create predictors.
   *
   * @param params.targetId - Target to process articles for (single target)
   * @param params.universeId - Process articles for all active targets in universe
   * @param params.batchSize - Max articles to process (default: 20)
   */
  async processArticles(params: {
    targetId?: string;
    universeId?: string;
    batchSize?: number;
  }): Promise<DashboardResponsePayload<{
    articlesProcessed: number;
    predictorsCreated: number;
    targetsAnalyzed: number;
    errors: number;
    message: string;
  }>> {
    return this.executeDashboardRequest<{
      articlesProcessed: number;
      predictorsCreated: number;
      targetsAnalyzed: number;
      errors: number;
      message: string;
    }>('articles.process', params);
  }

  /**
   * @deprecated Use processArticles instead. Signals have been removed;
   * predictors are now created directly from articles.
   *
   * This method is kept for backward compatibility but may not work
   * as the backend signal processing has been removed.
   */
  async processSignals(params: {
    targetId?: string;
    universeId?: string;
    batchSize?: number;
    includeTest?: boolean;
  }): Promise<DashboardResponsePayload<{
    // Single target response
    processed?: number;
    predictorsCreated?: number;
    rejected?: number;
    errors?: number;
    results?: Array<{
      signalId: string;
      status: 'predictor_created' | 'rejected' | 'error';
      confidence?: number;
      direction?: string;
      error?: string;
    }>;
    // Universe-level response
    targetsProcessed?: number;
    totalProcessed?: number;
    totalPredictorsCreated?: number;
    totalRejected?: number;
    totalErrors?: number;
    targetResults?: Array<{
      targetId: string;
      targetSymbol: string;
      processed: number;
      predictorsCreated: number;
      rejected: number;
      errors: number;
    }>;
    message: string;
  }>> {
    return this.executeDashboardRequest<{
      processed?: number;
      predictorsCreated?: number;
      rejected?: number;
      errors?: number;
      results?: Array<{
        signalId: string;
        status: 'predictor_created' | 'rejected' | 'error';
        confidence?: number;
        direction?: string;
        error?: string;
      }>;
      targetsProcessed?: number;
      totalProcessed?: number;
      totalPredictorsCreated?: number;
      totalRejected?: number;
      totalErrors?: number;
      targetResults?: Array<{
        targetId: string;
        targetSymbol: string;
        processed: number;
        predictorsCreated: number;
        rejected: number;
        errors: number;
      }>;
      message: string;
    }>('signals.process', params);
  }

  /**
   * Manually generate predictions from active predictors
   * Evaluates thresholds and creates predictions for targets
   *
   * @param params.targetId - Single target to generate for
   * @param params.universeId - Generate for all active targets in universe
   * @param params.forceGenerate - Force generation even if thresholds not met (future use)
   */
  async generatePredictions(params: {
    targetId?: string;
    universeId?: string;
    forceGenerate?: boolean;
    filters?: {
      includeTestData?: boolean;
    };
  }): Promise<DashboardResponsePayload<{
    generated: number;
    skipped: number;
    errors: number;
    results: Array<{
      targetId: string;
      targetSymbol?: string;
      status: 'prediction_generated' | 'threshold_not_met' | 'no_predictors' | 'error';
      predictionId?: string;
      direction?: string;
      confidence?: number;
      predictorCount?: number;
      error?: string;
    }>;
    message: string;
  }>> {
    return this.executeDashboardRequest<{
      generated: number;
      skipped: number;
      errors: number;
      results: Array<{
        targetId: string;
        targetSymbol?: string;
        status: 'prediction_generated' | 'threshold_not_met' | 'no_predictors' | 'error';
        predictionId?: string;
        direction?: string;
        confidence?: number;
        predictorCount?: number;
        error?: string;
      }>;
      message: string;
    }>('predictions.generate', params);
  }

  /**
   * Manually crawl sources and create signals
   * Triggers source crawling and persists resulting signals
   *
   * @param params.id - Single source to crawl
   * @param params.targetId - Crawl all sources for a target
   * @param params.universeId - Crawl all sources for a universe
   */
  async crawlSources(params: {
    id?: string;
    targetId?: string;
    universeId?: string;
  }): Promise<DashboardResponsePayload<{
    sourcesProcessed: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    totalSignalsCreated: number;
    results: Array<{
      sourceId: string;
      sourceName: string;
      sourceUrl: string;
      status: 'success' | 'error' | 'skipped';
      signalsCreated?: number;
      error?: string;
    }>;
    message: string;
  }>> {
    return this.executeDashboardRequest<{
      sourcesProcessed: number;
      successCount: number;
      errorCount: number;
      skippedCount: number;
      totalSignalsCreated: number;
      results: Array<{
        sourceId: string;
        sourceName: string;
        sourceUrl: string;
        status: 'success' | 'error' | 'skipped';
        signalsCreated?: number;
        error?: string;
      }>;
      message: string;
    }>('sources.crawl', params);
  }

  /**
   * Run the full prediction pipeline for a universe
   * Executes all steps in sequence:
   * 1. Crawl sources -> Create articles in crawler schema
   * 2. Process articles -> Create predictors directly (unified flow)
   * 3. Generate predictions -> Create predictions from predictors
   *
   * NOTE: The signals intermediate layer has been removed. Articles
   * are now processed directly into predictors via ArticleProcessorService.
   *
   * @param params.universeId - Universe to run the pipeline for
   * @param params.batchSize - Max articles to process per target (default: 50)
   * @param params.includeTest - Include test data (default: false)
   */
  async runFullPipeline(params: {
    universeId: string;
    batchSize?: number;
    includeTest?: boolean;
  }): Promise<{
    success: boolean;
    crawlResult: {
      sourcesProcessed: number;
      signalsCreated: number;
      errors: number;
      message: string;
    };
    processResult: {
      targetsProcessed: number;
      signalsProcessed: number;
      predictorsCreated: number;
      errors: number;
      message: string;
    };
    generateResult: {
      predictionsGenerated: number;
      skipped: number;
      errors: number;
      message: string;
    };
    summary: string;
  }> {
    const batchSize = params.batchSize ?? 50;
    const includeTest = params.includeTest ?? false;

    // Step 1: Crawl sources
    let crawlResult = {
      sourcesProcessed: 0,
      signalsCreated: 0,
      errors: 0,
      message: 'Not started',
    };

    try {
      const crawlResponse = await this.crawlSources({
        universeId: params.universeId,
      });
      if (crawlResponse.content) {
        crawlResult = {
          sourcesProcessed: crawlResponse.content.sourcesProcessed,
          signalsCreated: crawlResponse.content.totalSignalsCreated,
          errors: crawlResponse.content.errorCount,
          message: crawlResponse.content.message,
        };
      }
    } catch (error) {
      crawlResult = {
        sourcesProcessed: 0,
        signalsCreated: 0,
        errors: 1,
        message: error instanceof Error ? error.message : 'Crawl failed',
      };
    }

    // Step 2: Process articles directly into predictors (unified flow)
    let processResult = {
      targetsProcessed: 0,
      signalsProcessed: 0, // Kept for compatibility, now represents articles processed
      predictorsCreated: 0,
      errors: 0,
      message: 'Not started',
    };

    try {
      const processResponse = await this.processArticles({
        universeId: params.universeId,
        batchSize,
      });
      if (processResponse.content) {
        processResult = {
          targetsProcessed: processResponse.content.targetsAnalyzed ?? 0,
          signalsProcessed: processResponse.content.articlesProcessed ?? 0,
          predictorsCreated: processResponse.content.predictorsCreated ?? 0,
          errors: processResponse.content.errors ?? 0,
          message: processResponse.content.message,
        };
      }
    } catch (error) {
      processResult = {
        targetsProcessed: 0,
        signalsProcessed: 0,
        predictorsCreated: 0,
        errors: 1,
        message: error instanceof Error ? error.message : 'Article processing failed',
      };
    }

    // Step 3: Generate predictions
    let generateResult = {
      predictionsGenerated: 0,
      skipped: 0,
      errors: 0,
      message: 'Not started',
    };

    try {
      const generateResponse = await this.generatePredictions({
        universeId: params.universeId,
        filters: { includeTestData: includeTest },
      });
      if (generateResponse.content) {
        generateResult = {
          predictionsGenerated: generateResponse.content.generated,
          skipped: generateResponse.content.skipped,
          errors: generateResponse.content.errors,
          message: generateResponse.content.message,
        };
      }
    } catch (error) {
      generateResult = {
        predictionsGenerated: 0,
        skipped: 0,
        errors: 1,
        message: error instanceof Error ? error.message : 'Prediction generation failed',
      };
    }

    // Build summary
    const totalErrors = crawlResult.errors + processResult.errors + generateResult.errors;
    const success = totalErrors === 0;
    const summary = `Pipeline complete: ${crawlResult.signalsCreated} articles crawled, ${processResult.predictorsCreated} predictors created, ${generateResult.predictionsGenerated} predictions generated${totalErrors > 0 ? ` (${totalErrors} errors)` : ''}`;

    return {
      success,
      crawlResult,
      processResult,
      generateResult,
      summary,
    };
  }

  // ============================================================================
  // AGENT ACTIVITY (Phase 7 - Self-Modification Notifications)
  // ============================================================================

  /**
   * List agent self-modification activity
   */
  async listAgentActivity(
    params?: { analystId?: string; acknowledged?: boolean; limit?: number },
  ): Promise<DashboardResponsePayload<AgentActivityItem[]>> {
    return this.executeDashboardRequest<AgentActivityItem[]>(
      'agent_activity.list',
      params,
    );
  }

  /**
   * Acknowledge a single agent activity item
   */
  async acknowledgeAgentActivity(
    activityId: string,
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'agent_activity.acknowledge',
      { id: activityId },
    );
  }

  /**
   * Acknowledge all unacknowledged agent activity
   */
  async acknowledgeAllAgentActivity(): Promise<
    DashboardResponsePayload<{ success: boolean; count: number }>
  > {
    return this.executeDashboardRequest<{ success: boolean; count: number }>(
      'agent_activity.acknowledge_all',
    );
  }

  // ============================================================================
  // LEARNING SESSION (Phase 7 - Bidirectional Learning)
  // ============================================================================

  /**
   * Start a learning session with an analyst
   */
  async startLearningSession(
    analystId: string,
  ): Promise<DashboardResponsePayload<LearningSessionResponse>> {
    return this.executeDashboardRequest<LearningSessionResponse>(
      'learning_session.start',
      { analystId },
    );
  }

  /**
   * Get fork comparison report for an analyst
   */
  async getForkComparison(
    analystId: string,
    period?: string,
  ): Promise<DashboardResponsePayload<ForkComparisonReport>> {
    return this.executeDashboardRequest<ForkComparisonReport>(
      'learning_session.compare',
      { analystId, period },
    );
  }

  /**
   * Create a learning exchange (ask a question)
   */
  async createLearningExchange(params: {
    analystId: string;
    initiatedBy: 'user' | 'agent';
    question: string;
    contextDiff?: Record<string, unknown>;
  }): Promise<DashboardResponsePayload<LearningExchange>> {
    return this.executeDashboardRequest<LearningExchange>(
      'learning_session.ask',
      params,
    );
  }

  /**
   * Respond to a learning exchange
   */
  async respondToExchange(params: {
    exchangeId: string;
    response: string;
  }): Promise<DashboardResponsePayload<LearningExchange>> {
    return this.executeDashboardRequest<LearningExchange>(
      'learning_session.respond',
      params,
    );
  }

  /**
   * Update exchange outcome (adopt, reject, note)
   */
  async updateExchangeOutcome(params: {
    exchangeId: string;
    outcome: 'adopted' | 'rejected' | 'noted';
    adoptionDetails?: Record<string, unknown>;
  }): Promise<DashboardResponsePayload<LearningExchange>> {
    return this.executeDashboardRequest<LearningExchange>(
      'learning_session.outcome',
      params,
    );
  }

  /**
   * End a learning session
   */
  async endLearningSession(
    analystId: string,
  ): Promise<DashboardResponsePayload<{ success: boolean }>> {
    return this.executeDashboardRequest<{ success: boolean }>(
      'learning_session.end',
      { analystId },
    );
  }

  // ============================================================================
  // ANALYST VERSION HISTORY (Phase 7 - Context Versioning)
  // ============================================================================

  /**
   * Get analyst context version history
   */
  async getAnalystVersionHistory(
    analystId: string,
    forkType?: 'user' | 'agent',
  ): Promise<DashboardResponsePayload<AnalystContextVersion[]>> {
    return this.executeDashboardRequest<AnalystContextVersion[]>(
      'analyst.version_history',
      { analystId, forkType },
    );
  }

  /**
   * Rollback analyst context to a specific version
   */
  async rollbackAnalystVersion(params: {
    analystId: string;
    targetVersionId: string;
    forkType: 'user' | 'agent';
    reason: string;
  }): Promise<DashboardResponsePayload<{ success: boolean; newVersion: AnalystContextVersion }>> {
    return this.executeDashboardRequest<{ success: boolean; newVersion: AnalystContextVersion }>(
      'analyst.rollback',
      params,
    );
  }

  // ============================================================================
  // USER PORTFOLIO & TRADING (Phase 4)
  // ============================================================================

  /**
   * Get user's portfolio with open positions and P&L
   */
  async getUserPortfolio(): Promise<DashboardResponsePayload<UserPortfolioSummary>> {
    return this.executeDashboardRequest<UserPortfolioSummary>('prediction.portfolio', {});
  }

  /**
   * Create a position from a prediction (take the trade)
   */
  async usePrediction(params: {
    id: string;
    quantity: number;
    entryPrice?: number;
  }): Promise<DashboardResponsePayload<PositionCreationResult>> {
    return this.executeDashboardRequest<PositionCreationResult>('prediction.use', params);
  }

  /**
   * Calculate recommended position size for a prediction
   */
  async calculatePositionSize(
    predictionId: string,
  ): Promise<DashboardResponsePayload<PositionSizeRecommendation>> {
    return this.executeDashboardRequest<PositionSizeRecommendation>(
      'prediction.calculateSize',
      { id: predictionId },
    );
  }

  /**
   * Get closed positions history with statistics
   */
  async getClosedPositions(filters?: {
    startDate?: string;
    endDate?: string;
    symbol?: string;
    limit?: number;
  }): Promise<DashboardResponsePayload<ClosedPositionsResult>> {
    return this.executeDashboardRequest<ClosedPositionsResult>('prediction.closedPositions', {
      filters,
    });
  }

  /**
   * Close an open position at the specified exit price
   */
  async closePosition(
    positionId: string,
    exitPrice: number,
  ): Promise<DashboardResponsePayload<ClosePositionResult>> {
    return this.executeDashboardRequest<ClosePositionResult>('prediction.closePosition', {
      id: positionId,
      exitPrice,
    });
  }

  // ============================================================================
  // ANALYST LEADERBOARD (Fork Comparison)
  // ============================================================================

  /**
   * Get all analysts with user vs agent fork comparison
   * Returns portfolio performance for both forks
   */
  async getAnalystForksSummary(): Promise<DashboardResponsePayload<AnalystForksSummary>> {
    return this.executeDashboardRequest<AnalystForksSummary>('analyst.forksSummary', {});
  }

  /**
   * Compare user vs agent fork for a specific analyst
   */
  async compareAnalystForks(
    analystId: string,
  ): Promise<DashboardResponsePayload<AnalystForkComparison>> {
    return this.executeDashboardRequest<AnalystForkComparison>('analyst.compareForks', {
      id: analystId,
    });
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserPortfolioSummary {
  portfolio: {
    id: string;
    initialBalance: number;
    currentBalance: number;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
  };
  openPositions: UserPosition[];
  summary: {
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    winRate: number;
    openPositionCount: number;
  };
}

export interface UserPosition {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface PositionCreationResult {
  position: {
    id: string;
    symbol: string;
    direction: 'long' | 'short';
    quantity: number;
    entryPrice: number;
    portfolioId: string;
  };
  portfolioUpdate: {
    previousBalance: number;
    newBalance: number;
  };
}

export interface PositionSizeRecommendation {
  predictionId: string;
  symbol: string;
  direction: 'bullish' | 'bearish';
  currentPrice: number;
  recommendedQuantity: number;
  riskAmount: number;
  riskRewardRatio: number;
  reasoning: string;
}

export interface ClosedPosition {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnl: number;
  pnlPercent: number;
  openedAt: string;
  closedAt: string | null;
  predictionId: string;
  targetId: string;
}

export interface ClosedPositionsResult {
  positions: ClosedPosition[];
  statistics: {
    totalClosed: number;
    wins: number;
    losses: number;
    totalPnl: number;
    avgPnl: number;
    winRate: number;
  };
}

export interface ClosePositionResult {
  positionId: string;
  realizedPnl: number;
  isWin: boolean;
  message: string;
}

export interface AnalystForksSummary {
  comparisons: AnalystForkComparisonRow[];
  summary: {
    totalAnalysts: number;
    agentOutperforming: number;
    userOutperforming: number;
    statusBreakdown: Record<string, number>;
  };
}

export interface AnalystForkComparisonRow {
  analyst_id: string;
  slug: string;
  name: string;
  perspective: string;
  user_pnl: number;
  user_win_count: number;
  user_loss_count: number;
  agent_pnl: number;
  agent_win_count: number;
  agent_loss_count: number;
  pnl_difference: number;
  comparison_status: 'agent_winning' | 'user_winning' | 'tied' | 'warning';
}

export interface AnalystForkComparison {
  analyst: {
    id: string;
    slug: string;
    name: string;
    perspective: string;
  };
  userFork: {
    balance: number;
    pnl: number;
    winRate: number;
    winCount: number;
    lossCount: number;
  };
  agentFork: {
    balance: number;
    pnl: number;
    winRate: number;
    winCount: number;
    lossCount: number;
  };
  comparison: {
    pnlDiff: { absolute: number; percent: number };
    contextDiff: {
      perspectiveChanged: boolean;
      signalPreferencesChanged: boolean;
      riskToleranceChanged: boolean;
    };
    suggestion: string;
  };
}

export const predictionDashboardService = new PredictionDashboardService();
