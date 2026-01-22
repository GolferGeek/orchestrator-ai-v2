/**
 * Prediction Agent UI Types
 *
 * Frontend types for the Prediction Agent dashboard.
 * Corresponds to the backend prediction runner types.
 */

// =============================================================================
// CLAIM & SOURCE TYPES
// =============================================================================

/**
 * Supported claim types
 */
export type ClaimType =
  | 'price'
  | 'volume'
  | 'open'
  | 'high'
  | 'low'
  | 'close'
  | 'bid'
  | 'ask'
  | 'spread'
  | 'change'
  | 'change_percent'
  | 'volatility'
  | 'momentum'
  | 'sentiment'
  | 'sentiment_score'
  | 'sentiment_label'
  | 'event'
  | 'news'
  | 'filing'
  | 'earnings'
  | 'dividend'
  | 'technical_indicator'
  | 'support'
  | 'resistance'
  | 'trend'
  | 'pe_ratio'
  | 'market_cap'
  | 'eps'
  | 'revenue'
  | 'odds'
  | 'probability'
  | 'resolution'
  | 'whale_transaction'
  | 'gas_price'
  | 'tvl'
  | 'protocol_revenue'
  | 'custom';

/**
 * A single claim from a data source
 */
export interface Claim {
  type: ClaimType;
  instrument: string;
  value: number | string | boolean;
  unit?: string;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * A data source that produces claims
 */
export interface Source {
  tool: string;
  articleUrl?: string;
  articleTitle?: string;
  publishedAt?: string;
  fetchedAt: string;
  claims: Claim[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// DATAPOINT TYPES
// =============================================================================

/**
 * Metadata about a datapoint collection
 */
export interface DatapointMetadata {
  durationMs: number;
  toolsSucceeded: number;
  toolsFailed: number;
  toolStatus: Record<string, 'success' | 'failed' | 'skipped'>;
  errors?: string[];
}

/**
 * A complete datapoint from a poll cycle
 */
export interface Datapoint {
  id: string;
  agentId: string;
  timestamp: string;
  sources: Source[];
  allClaims: Claim[];
  instruments: string[];
  metadata: DatapointMetadata;
}

// =============================================================================
// RECOMMENDATION TYPES
// =============================================================================

/**
 * Recommendation actions
 */
export type RecommendationAction =
  | 'buy'
  | 'sell'
  | 'hold'
  | 'accumulate'
  | 'reduce'
  | 'bet_yes'
  | 'bet_no'
  | 'wait';

/**
 * Position sizing recommendation
 */
export interface RecommendationSizing {
  size: number;
  unit: 'percent' | 'shares' | 'contracts' | 'usd';
  riskAdjustedSize: number;
  maxLoss?: number;
}

/**
 * Evidence supporting a recommendation
 */
export interface RecommendationEvidence {
  specialist: string;
  summary: string;
  supportingClaims: Claim[];
  confidence: number;
}

/**
 * A trading/prediction recommendation
 */
export interface Recommendation {
  id: string;
  instrument: string;
  action: RecommendationAction;
  confidence: number;
  sizing?: RecommendationSizing;
  rationale: string;
  timingWindow?: {
    validFrom: string;
    validUntil: string;
  };
  entryStyle?: 'market' | 'limit' | 'stop' | 'scaled';
  targetPrice?: number;
  evidence: RecommendationEvidence[];
}

// =============================================================================
// AGENT STATUS TYPES
// =============================================================================

/**
 * Agent lifecycle state
 */
export type AgentLifecycleState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'error';

/**
 * Agent status stats
 */
export interface AgentStats {
  pollCount: number;
  recommendationCount: number;
  errorCount: number;
  avgPollDurationMs: number;
}

/**
 * Agent status for dashboard
 */
export interface AgentStatus {
  agentId: string;
  state: AgentLifecycleState;
  lastPollAt?: string;
  nextPollAt?: string;
  pollIntervalMs: number;
  error?: string;
  stats: AgentStats;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Risk profiles
 */
export type RiskProfile =
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  | 'hodler'
  | 'trader'
  | 'degen'
  | 'researcher'
  | 'speculator';

/**
 * Pre-filter thresholds
 */
export interface PreFilterThresholds {
  minPriceChangePercent: number;
  minSentimentShift: number;
  minSignificanceScore: number;
  custom?: Record<string, number>;
}

/**
 * Model specification for a pipeline stage
 */
export interface StageModelSpec {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Model configuration per stage
 */
export interface StageModelConfig {
  triage?: StageModelSpec;
  specialists?: StageModelSpec;
  evaluators?: StageModelSpec;
  learning?: StageModelSpec;
}

/**
 * Runner configuration
 */
export interface PredictionRunnerConfig {
  runner: string;
  instruments: string[];
  riskProfile: RiskProfile;
  pollIntervalMs: number;
  preFilterThresholds: PreFilterThresholds;
  modelConfig?: StageModelConfig;
  toolOverrides?: Record<string, unknown>;
}

// =============================================================================
// HISTORY & OUTCOME TYPES
// =============================================================================

/**
 * Outcome status
 */
export type OutcomeStatus = 'pending' | 'correct' | 'incorrect' | 'expired';

/**
 * Historical prediction with outcome
 */
export interface PredictionHistory {
  id: string;
  timestamp: string;
  instrument: string;
  recommendation: Recommendation;
  outcome?: {
    status: OutcomeStatus;
    actualPrice?: number;
    actualChange?: number;
    evaluatedAt?: string;
    notes?: string;
  };
  datapoint: Datapoint;
}

// =============================================================================
// TOOL STATUS TYPES
// =============================================================================

/**
 * Tool/data source status
 */
export interface ToolStatus {
  name: string;
  displayName: string;
  status: 'active' | 'error' | 'disabled';
  claimsCount: number;
  lastSuccessfulPollAt?: string;
  lastError?: string;
  lastErrorAt?: string;
}

// =============================================================================
// CURRENT STATE TYPES
// =============================================================================

/**
 * Current agent state
 */
export interface CurrentAgentState {
  agentStatus: AgentStatus;
  latestDatapoint?: Datapoint;
  activeRecommendations: Recommendation[];
  instruments: string[];
  config: PredictionRunnerConfig;
  toolsStatus: ToolStatus[];
}
