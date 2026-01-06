import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

/**
 * Instrument in a trading universe
 */
export interface Instrument {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "crypto" | "forex" | "commodity";
  exchange?: string;
}

/**
 * Market bar (OHLCV data)
 */
export interface MarketBar {
  id: string;
  instrument: string;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vendor: string;
}

/**
 * News item
 */
export interface NewsItem {
  id: string;
  source: string;
  publishedAt: string;
  url?: string;
  title: string;
  snippet: string;
  vendorIds?: Record<string, string>;
}

/**
 * Extracted agenda/manipulation signal
 */
export interface AgendaEvent {
  id: string;
  asofTs: string;
  narrative: string;
  suspectedIncentive: string;
  targetInstruments: string[];
  confidence: number;
  evidence: Record<string, unknown>;
}

/**
 * Generated recommendation
 */
export interface Recommendation {
  id: string;
  instrument: string;
  action: "buy" | "sell" | "hold";
  timingWindow: "pre_close" | "post_close" | "pre_open" | "intraday";
  entryStyle: string;
  intendedPrice?: number;
  sizing?: Record<string, unknown>;
  rationale: string;
  marketContext?: unknown;
  agendaContext?: unknown;
  modelMetadata?: Record<string, unknown>;
}

/**
 * Recommendation outcome for learning loop
 */
export interface RecommendationOutcome {
  id: string;
  recommendationId: string;
  realizedReturnMetrics: Record<string, number>;
  winLoss: "win" | "loss" | "neutral";
  evaluationNotes: string;
  evaluatedAt: string;
}

/**
 * Postmortem analysis for learning loop
 */
export interface Postmortem {
  id: string;
  recommendationId: string;
  whatHappened: string;
  whyItHappened: string;
  linkedAgendaEvents: string[];
  lessons: string[];
}

/**
 * Finance workflow input
 */
export interface FinanceInput {
  context: ExecutionContext;
  universeVersionId: string;
  timingWindows?: ("pre_close" | "post_close" | "pre_open" | "intraday")[];
  lookbackDays?: number;
  includeAgendaAnalysis?: boolean;
}

/**
 * Finance workflow result
 */
export interface FinanceResult {
  taskId: string;
  runId: string;
  status: "completed" | "failed";
  recommendations: Recommendation[];
  agendaEvents: AgendaEvent[];
  marketSummary: {
    instrumentsAnalyzed: number;
    dataPointsProcessed: number;
    newsItemsAnalyzed: number;
  };
  error?: string;
  duration: number;
}

/**
 * Finance State Annotation
 */
export const FinanceStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,

  // ExecutionContext - the core context
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,
    default: () => ({
      orgSlug: "finance",
      userId: "",
      conversationId: "",
      taskId: "",
      planId: "",
      deliverableId: "",
      agentSlug: "finance-research",
      agentType: "api",
      provider: "",
      model: "",
    }),
  }),

  // Universe version to analyze
  universeVersionId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Recommendation run ID
  runId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),

  // Run timestamp
  runTs: Annotation<string>({
    reducer: (_, next) => next,
    default: () => new Date().toISOString(),
  }),

  // Instruments in universe
  instruments: Annotation<Instrument[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Timing windows to generate recommendations for
  timingWindows: Annotation<
    ("pre_close" | "post_close" | "pre_open" | "intraday")[]
  >({
    reducer: (_, next) => next,
    default: () => ["pre_close", "post_close", "pre_open"],
  }),

  // Lookback period in days
  lookbackDays: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 30,
  }),

  // Whether to include agenda analysis
  includeAgendaAnalysis: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => true,
  }),

  // Market data (accumulated via reducer)
  marketData: Annotation<MarketBar[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // News items (accumulated via reducer)
  newsItems: Annotation<NewsItem[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Extracted agenda events
  agendaEvents: Annotation<AgendaEvent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Derived market features
  marketFeatures: Annotation<Record<string, unknown>>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),

  // Derived agenda features
  agendaFeatures: Annotation<Record<string, unknown>>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),

  // Generated recommendations
  recommendations: Annotation<Recommendation[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // Workflow phase
  phase: Annotation<
    | "initializing"
    | "ingesting_market_data"
    | "ingesting_news"
    | "extracting_agenda"
    | "building_features"
    | "generating_recommendations"
    | "writing_recommendations"
    | "completed"
    | "failed"
  >({
    reducer: (_, next) => next,
    default: () => "initializing",
  }),

  // Error tracking
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),

  // Timestamps
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),

  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type FinanceState = typeof FinanceStateAnnotation.State;

/**
 * Finance workflow result (returned by service)
 */
export interface FinanceWorkflowResult {
  taskId: string;
  status: "completed" | "failed";
  runId: string;
  recommendations: Recommendation[];
  error?: string;
  duration: number;
}
