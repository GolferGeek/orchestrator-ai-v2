/**
 * Base Prediction Runner Types
 *
 * Core type definitions for the generic prediction engine.
 * These types are shared across all prediction domains (stocks, crypto, polymarket).
 *
 * Design Philosophy:
 * - Claims-based data model: All data flows as structured claims
 * - Source attribution: Every claim links back to its data source
 * - Domain agnostic: Types work for any prediction domain
 *
 * @module base-prediction.types
 */

// =============================================================================
// CLAIM & SOURCE TYPES
// =============================================================================

/**
 * A single claim extracted from a data source.
 * Claims are the atomic unit of data in the prediction system.
 *
 * @example Stock price claim
 * ```typescript
 * {
 *   type: 'price',
 *   instrument: 'AAPL',
 *   value: 178.50,
 *   unit: 'USD',
 *   confidence: 1.0,
 *   timestamp: '2026-01-07T14:30:00Z'
 * }
 * ```
 *
 * @example News sentiment claim
 * ```typescript
 * {
 *   type: 'sentiment',
 *   instrument: 'NVDA',
 *   value: 0.85,
 *   unit: 'score',
 *   confidence: 0.72,
 *   timestamp: '2026-01-07T10:00:00Z',
 *   metadata: { headline: 'NVIDIA beats earnings...' }
 * }
 * ```
 */
export interface Claim {
  /** Claim type: price, volume, sentiment, event, technical, fundamental */
  type: ClaimType;

  /** Instrument identifier (e.g., AAPL, BTC-USD, polymarket-market-id) */
  instrument: string;

  /** Numeric or string value of the claim */
  value: number | string | boolean;

  /** Unit of measurement (USD, percent, score, etc.) */
  unit?: string;

  /** Confidence score 0-1 (1 = factual, <1 = extracted/inferred) */
  confidence: number;

  /** When this claim was observed/valid */
  timestamp: string;

  /** Additional claim-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Supported claim types across all prediction domains
 */
export type ClaimType =
  // Market data claims
  | 'price'
  | 'volume'
  | 'open'
  | 'high'
  | 'low'
  | 'close'
  | 'bid'
  | 'ask'
  | 'spread'
  // Derived claims
  | 'change'
  | 'change_percent'
  | 'volatility'
  | 'momentum'
  // Sentiment claims
  | 'sentiment'
  | 'sentiment_score'
  | 'sentiment_label'
  // Event claims
  | 'event'
  | 'news'
  | 'filing'
  | 'earnings'
  | 'dividend'
  // Technical claims
  | 'technical_indicator'
  | 'support'
  | 'resistance'
  | 'trend'
  // Fundamental claims
  | 'pe_ratio'
  | 'market_cap'
  | 'eps'
  | 'revenue'
  // Prediction market claims
  | 'odds'
  | 'probability'
  | 'resolution'
  // On-chain claims (crypto)
  | 'whale_transaction'
  | 'gas_price'
  | 'tvl'
  | 'protocol_revenue'
  // Generic
  | 'custom';

/**
 * A data source that produces claims.
 * Maps to a single tool execution or API call.
 */
export interface Source {
  /** Tool name that produced this source (e.g., 'yahoo-finance', 'coingecko') */
  tool: string;

  /** Optional article/page URL for news sources */
  articleUrl?: string;

  /** Optional article title */
  articleTitle?: string;

  /** When the source data was published/retrieved */
  publishedAt?: string;

  /** When we fetched this data */
  fetchedAt: string;

  /** Claims extracted from this source */
  claims: Claim[];

  /** Source-specific metadata (API response details, etc.) */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// DATAPOINT TYPES
// =============================================================================

/**
 * A complete datapoint from a single poll cycle.
 * Contains all sources and claims aggregated during one execution.
 *
 * One datapoint = one poll cycle = all tools run once
 */
export interface Datapoint {
  /** Unique datapoint identifier */
  id: string;

  /** Agent that produced this datapoint */
  agentId: string;

  /** Timestamp of the poll cycle */
  timestamp: string;

  /** All sources collected during this poll */
  sources: Source[];

  /** Flattened list of all claims (for easier querying) */
  allClaims: Claim[];

  /** Instruments covered in this datapoint */
  instruments: string[];

  /** Poll cycle metadata */
  metadata: DatapointMetadata;
}

/**
 * Metadata about a datapoint collection
 */
export interface DatapointMetadata {
  /** Duration of poll cycle in ms */
  durationMs: number;

  /** Number of tools that succeeded */
  toolsSucceeded: number;

  /** Number of tools that failed */
  toolsFailed: number;

  /** Tool-level status */
  toolStatus: Record<string, 'success' | 'failed' | 'skipped'>;

  /** Any errors encountered */
  errors?: string[];
}

// =============================================================================
// CLAIM BUNDLE TYPES
// =============================================================================

/**
 * Claims grouped by instrument for processing.
 * Created by the ClaimProcessor after data collection.
 */
export interface ClaimBundle {
  /** Instrument identifier */
  instrument: string;

  /** All claims for this instrument from current poll */
  currentClaims: Claim[];

  /** Sources that contributed to these claims */
  sources: string[];
}

/**
 * ClaimBundle enriched with historical context.
 * Ready for triage and specialist processing.
 */
export interface EnrichedClaimBundle extends ClaimBundle {
  /** Historical claims for comparison (from DB) */
  historicalClaims: Claim[];

  /** Diff between current and historical */
  claimsDiff: ClaimsDiff;

  /** Should this bundle proceed to specialists? */
  shouldProceed: boolean;

  /** Reason for proceed/skip decision */
  proceedReason?: string;
}

/**
 * Difference between current and historical claims
 */
export interface ClaimsDiff {
  /** New claims not seen before */
  newClaims: Claim[];

  /** Claims with changed values */
  changedClaims: Array<{
    claim: Claim;
    previousValue: number | string | boolean;
    changePercent?: number;
  }>;

  /** Claims that disappeared */
  removedClaims: Claim[];

  /** Overall significance score 0-1 */
  significanceScore: number;
}

// =============================================================================
// RUNNER CONFIGURATION TYPES
// =============================================================================

/**
 * Configuration for a prediction runner instance.
 * Stored in agents.metadata for prediction agents.
 *
 * The entire PredictionRunnerConfig is stored as metadata.runnerConfig
 * This keeps all runner configuration in the existing metadata column.
 *
 * @example Agent metadata structure:
 * ```json
 * {
 *   "description": "Stock prediction agent for tech sector",
 *   "capabilities": ["stocks", "technical-analysis"],
 *   "runnerConfig": {
 *     "runner": "stock-predictor",
 *     "instruments": ["AAPL", "MSFT", "NVDA"],
 *     "riskProfile": "moderate",
 *     "pollIntervalMs": 60000,
 *     "modelConfig": {
 *       "triage": { "provider": "anthropic", "model": "claude-3-5-haiku-20241022" },
 *       "specialists": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" }
 *     }
 *   }
 * }
 * ```
 */
export interface PredictionRunnerConfig {
  /** Runner type: stock-predictor, crypto-predictor, market-predictor */
  runner: PredictionRunnerType;

  /** Instruments to track */
  instruments: string[];

  /** Risk profile for recommendation packaging */
  riskProfile: RiskProfile;

  /** Poll interval in milliseconds */
  pollIntervalMs: number;

  /** Pre-filter thresholds (domain-specific) */
  preFilterThresholds: PreFilterThresholds;

  /** Model configuration per stage (admin-configurable) */
  modelConfig?: StageModelConfig;

  /** Learning loop settings */
  learningConfig?: LearningConfig;

  /** Tool-specific overrides */
  toolOverrides?: Record<string, unknown>;
}

/**
 * Supported prediction runner types
 */
export type PredictionRunnerType =
  | 'financial-asset-predictor'
  | 'stock-predictor' // @deprecated - use 'financial-asset-predictor'
  | 'crypto-predictor' // @deprecated - use 'financial-asset-predictor'
  | 'market-predictor'
  | 'election-predictor';

/**
 * Target types supported by prediction runners.
 * Each domain runner can use a subset of these.
 *
 * "Target" is the generic term for what a prediction runner analyzes:
 * - Financial assets: stock, etf, crypto, forex
 * - Betting markets: prediction-market, sports, politics
 */
export type TargetType =
  // Financial asset types
  | 'stock'
  | 'etf'
  | 'crypto'
  | 'forex'
  // Betting market types
  | 'prediction-market'
  | 'sports'
  | 'politics';

/**
 * Risk profiles for recommendation packaging
 */
export type RiskProfile =
  // Stock profiles
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  // Crypto profiles
  | 'hodler'
  | 'trader'
  | 'degen'
  // Polymarket profiles
  | 'researcher'
  | 'speculator';

/**
 * Pre-filter thresholds to determine if claims warrant specialist analysis
 */
export interface PreFilterThresholds {
  /** Minimum price change % to trigger (e.g., 2 for stocks, 5 for crypto) */
  minPriceChangePercent: number;

  /** Minimum sentiment shift to trigger */
  minSentimentShift: number;

  /** Minimum significance score to proceed */
  minSignificanceScore: number;

  /** Domain-specific thresholds */
  custom?: Record<string, number>;
}

/**
 * LLM model configuration per pipeline stage.
 *
 * Each prediction pipeline stage (triage, specialists, evaluators, learning) can use
 * a different model. This allows:
 * - Fast/cheap models for triage (high volume, simple decisions)
 * - Powerful models for specialists (complex analysis)
 * - Reasoning models for evaluators (red-teaming, challenges)
 * - Balanced models for learning loop conversations
 *
 * HOW IT WORKS:
 * 1. Agent's default llm_config provides fallback provider/model (in ExecutionContext)
 * 2. StageModelConfig in config_json provides per-stage overrides
 * 3. ExecutionContext stays IMMUTABLE (for observability tracking)
 * 4. Stage-specific provider/model passed in LLMRequestOptions.provider/.model
 *
 * The prediction runner uses:
 * - LLMGenerationService.generateResponse(context, prompt, message, { provider, model, ... })
 * - ObservabilityEventsService for observability events
 * - ExecutionContext flows through unchanged; options.provider/model override per-call
 *
 * @example
 * ```typescript
 * // ExecutionContext has default provider/model from agent config
 * // But for triage, we use a faster/cheaper model via options:
 * const triageConfig = config.modelConfig?.triage;
 * const response = await llmService.generateResponse(
 *   executionContext,           // Stays immutable
 *   triageSystemPrompt,
 *   triageUserMessage,
 *   {
 *     executionContext,         // Required in options too
 *     provider: triageConfig?.provider,  // Override for this call
 *     model: triageConfig?.model,        // Override for this call
 *     temperature: triageConfig?.temperature,
 *   }
 * );
 * ```
 */
export interface StageModelConfig {
  /** Model for triage agents (fast decisions, high volume) */
  triage?: StageModelSpec;

  /** Model for specialist agents (deep analysis) */
  specialists?: StageModelSpec;

  /** Model for evaluator agents (red-teaming, challenges) */
  evaluators?: StageModelSpec;

  /** Model for learning loop conversations */
  learning?: StageModelSpec;
}

/**
 * Model specification for a pipeline stage.
 * Provider and model are REQUIRED when specified - no silent fallbacks.
 * If not specified for a stage, uses agent's default from ExecutionContext.
 */
export interface StageModelSpec {
  /** Provider: anthropic, openai, google, ollama */
  provider: string;

  /** Model name (e.g., claude-3-5-sonnet-20241022, gpt-4o-mini) */
  model: string;

  /** Temperature (0.0 - 1.0, default varies by provider) */
  temperature?: number;

  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Learning loop configuration
 */
export interface LearningConfig {
  /** Enable automatic postmortem generation */
  autoPostmortem: boolean;

  /** Enable missed opportunity detection */
  detectMissedOpportunities: boolean;

  /** Lookback period for learning context (hours) */
  contextLookbackHours: number;

  /** Max postmortems to include in context */
  maxPostmortemsInContext: number;

  /** Max specialist stats to include */
  maxSpecialistStats: number;
}

// =============================================================================
// RUNNER INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input to a prediction runner execution
 */
export interface RunnerInput {
  /** Agent ID (from agents table) */
  agentId: string;

  /** Agent slug for lookups */
  agentSlug: string;

  /** Organization slug */
  orgSlug: string;

  /** Runner configuration (from agents.metadata.runnerConfig) */
  config: PredictionRunnerConfig;

  /** Execution context for observability */
  executionContext: {
    taskId: string;
    userId?: string;
    conversationId?: string;
  };

  /** Optional: force specific instruments (overrides config) */
  instrumentsOverride?: string[];

  /** Optional: timestamp to use for run (default: now) */
  runTimestamp?: string;
}

/**
 * Output from a prediction runner execution
 */
export interface RunnerOutput {
  /** Run identifier */
  runId: string;

  /** Agent that produced this output */
  agentId: string;

  /** Execution status */
  status: 'completed' | 'failed' | 'partial';

  /** Recommendations produced */
  recommendations: Recommendation[];

  /** The datapoint collected during this run */
  datapoint: Datapoint;

  /** Execution metrics */
  metrics: RunnerMetrics;

  /** Error message if failed */
  error?: string;
}

/**
 * A trading/prediction recommendation
 */
export interface Recommendation {
  /** Recommendation ID */
  id: string;

  /** Instrument this applies to */
  instrument: string;

  /** Recommended action */
  action: RecommendationAction;

  /** Confidence score 0-1 */
  confidence: number;

  /** Risk-adjusted sizing (based on risk profile) */
  sizing?: RecommendationSizing;

  /** Human-readable rationale */
  rationale: string;

  /** Timing window for execution */
  timingWindow?: {
    validFrom: string;
    validUntil: string;
  };

  /** Entry style recommendation */
  entryStyle?: 'market' | 'limit' | 'stop' | 'scaled';

  /** Target price for limit orders */
  targetPrice?: number;

  /** Supporting evidence from specialists */
  evidence: RecommendationEvidence[];
}

/**
 * Recommendation actions (domain-aware)
 */
export type RecommendationAction =
  // Stock/Crypto actions
  | 'buy'
  | 'sell'
  | 'hold'
  | 'accumulate'
  | 'reduce'
  // Polymarket actions
  | 'bet_yes'
  | 'bet_no'
  | 'wait';

/**
 * Position sizing recommendation
 */
export interface RecommendationSizing {
  /** Suggested position size (% of portfolio or fixed amount) */
  size: number;

  /** Size unit */
  unit: 'percent' | 'shares' | 'contracts' | 'usd';

  /** Risk-adjusted size (after risk profile) */
  riskAdjustedSize: number;

  /** Max loss threshold */
  maxLoss?: number;
}

/**
 * Evidence supporting a recommendation
 */
export interface RecommendationEvidence {
  /** Specialist that provided this evidence */
  specialist: string;

  /** Evidence summary */
  summary: string;

  /** Supporting claims */
  supportingClaims: Claim[];

  /** Confidence in this evidence */
  confidence: number;
}

/**
 * Metrics from a runner execution
 */
export interface RunnerMetrics {
  /** Total execution time in ms */
  totalDurationMs: number;

  /** Time spent in each stage */
  stageDurations: Record<string, number>;

  /** Number of claims processed */
  claimsProcessed: number;

  /** Number of bundles that proceeded to specialists */
  bundlesProceeded: number;

  /** Number of recommendations generated */
  recommendationsGenerated: number;

  /** LLM tokens used */
  tokensUsed?: {
    triage: number;
    specialists: number;
    evaluators: number;
  };
}

// =============================================================================
// PIPELINE STAGE TYPES
// =============================================================================

/**
 * Triage result for a claim bundle
 */
export interface TriageResult {
  /** Instrument being triaged */
  instrument: string;

  /** Should proceed to specialists */
  proceed: boolean;

  /** Urgency level */
  urgency: 'low' | 'medium' | 'high' | 'critical';

  /** Which specialist teams to engage */
  specialistTeams: string[];

  /** Triage rationale */
  rationale: string;

  /** Individual triage agent votes */
  votes: Array<{
    agent: string;
    proceed: boolean;
    confidence: number;
    reason: string;
  }>;
}

/**
 * Specialist analysis result
 */
export interface SpecialistAnalysis {
  /** Specialist identifier */
  specialist: string;

  /** Instrument analyzed */
  instrument: string;

  /** Analysis conclusion */
  conclusion: 'bullish' | 'bearish' | 'neutral' | 'uncertain';

  /** Confidence in conclusion */
  confidence: number;

  /** Detailed analysis */
  analysis: string;

  /** Key claims that drove this analysis */
  keyClaims: Claim[];

  /** Suggested action */
  suggestedAction?: RecommendationAction;

  /** Risk factors identified */
  riskFactors: string[];
}

/**
 * Evaluator challenge result
 */
export interface EvaluatorChallenge {
  /** Evaluator identifier */
  evaluator: string;

  /** Recommendation being challenged */
  recommendationId: string;

  /** Challenge passed? */
  passed: boolean;

  /** Challenge type */
  challengeType:
    | 'contrarian'
    | 'risk_assessment'
    | 'historical_pattern'
    | 'correlation'
    | 'timing';

  /** Challenge reasoning */
  challenge: string;

  /** Confidence in challenge */
  confidence: number;

  /** Suggested modification if any */
  suggestedModification?: string;
}

// =============================================================================
// AMBIENT AGENT TYPES
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
 * Agent status for dashboard display
 */
export interface AgentStatus {
  /** Agent ID */
  agentId: string;

  /** Current lifecycle state */
  state: AgentLifecycleState;

  /** Last poll timestamp */
  lastPollAt?: string;

  /** Next scheduled poll */
  nextPollAt?: string;

  /** Current poll interval */
  pollIntervalMs: number;

  /** Error message if in error state */
  error?: string;

  /** Stats since last start */
  stats: {
    pollCount: number;
    recommendationCount: number;
    errorCount: number;
    avgPollDurationMs: number;
  };
}
