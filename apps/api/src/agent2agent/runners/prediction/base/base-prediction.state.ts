/**
 * Base Prediction State Annotation
 *
 * LangGraph state definition for the prediction pipeline.
 * This state flows through all nodes in the graph:
 * 1. Poll data sources -> collect claims
 * 2. Group claims by instrument -> create bundles
 * 3. Triage bundles -> determine which proceed
 * 4. Specialist analysis -> deep analysis per bundle
 * 5. Evaluator challenges -> red-team recommendations
 * 6. Package recommendations -> final output
 *
 * The state uses LangGraph's Annotation pattern for type safety
 * and reducer functions.
 *
 * @module base-prediction.state
 */

import { Annotation } from '@langchain/langgraph';
import {
  Datapoint,
  EnrichedClaimBundle,
  TriageResult,
  SpecialistAnalysis,
  EvaluatorChallenge,
  Recommendation,
  PredictionRunnerConfig,
  RunnerMetrics,
} from './base-prediction.types';

/**
 * PredictionState - Full state that flows through the graph.
 *
 * State Management:
 * - LangGraph uses reducers to merge state updates
 * - Default reducer: replace (new value overwrites old)
 * - Array reducer: append (new items added to existing array)
 * - Object reducer: spread (merge properties)
 *
 * The Annotation.Root<typeof PredictionStateAnnotation>() pattern
 * provides full type inference for state access.
 */
export const PredictionStateAnnotation = Annotation.Root({
  // =============================================================================
  // RUN IDENTITY
  // =============================================================================

  /** Run identifier (generated at start) */
  runId: Annotation<string>(),

  /** Agent ID from RunnerInput */
  agentId: Annotation<string>(),

  /** Agent slug from RunnerInput */
  agentSlug: Annotation<string>(),

  /** Organization slug */
  orgSlug: Annotation<string>(),

  /** Execution timestamp */
  timestamp: Annotation<string>(),

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  /** Runner configuration from agent metadata */
  config: Annotation<PredictionRunnerConfig>(),

  /** Instruments to track (from config or override) */
  instruments: Annotation<string[]>({
    reducer: (current: string[], update: string[]) => update ?? current,
  }),

  /** Risk profile for recommendation packaging */
  riskProfile: Annotation<string>(),

  // =============================================================================
  // EXECUTION CONTEXT
  // =============================================================================

  /** Execution context for observability and LLM calls */
  executionContext: Annotation<{
    taskId: string;
    userId?: string;
    conversationId?: string;
  }>(),

  // =============================================================================
  // DATA COLLECTION
  // =============================================================================

  /** Current datapoint (collected during poll node) */
  datapoint: Annotation<Datapoint | null>({
    reducer: (current: Datapoint | null, update: Datapoint | null) =>
      update ?? current,
    default: () => null,
  }),

  /** Claim bundles grouped by instrument */
  instrumentBundles: Annotation<EnrichedClaimBundle[]>({
    reducer: (current: EnrichedClaimBundle[], update: EnrichedClaimBundle[]) =>
      update ?? current,
    default: () => [],
  }),

  // =============================================================================
  // PIPELINE OUTPUTS
  // =============================================================================

  /** Triage results (which bundles proceed to specialists) */
  triageResults: Annotation<TriageResult[]>({
    reducer: (current: TriageResult[], update: TriageResult[]) => [
      ...(current ?? []),
      ...update,
    ],
    default: () => [],
  }),

  /** Specialist analyses */
  specialistAnalyses: Annotation<SpecialistAnalysis[]>({
    reducer: (current: SpecialistAnalysis[], update: SpecialistAnalysis[]) => [
      ...(current ?? []),
      ...update,
    ],
    default: () => [],
  }),

  /** Evaluator challenges */
  evaluatorChallenges: Annotation<EvaluatorChallenge[]>({
    reducer: (current: EvaluatorChallenge[], update: EvaluatorChallenge[]) => [
      ...(current ?? []),
      ...update,
    ],
    default: () => [],
  }),

  /** Final recommendations */
  recommendations: Annotation<Recommendation[]>({
    reducer: (current: Recommendation[], update: Recommendation[]) => [
      ...(current ?? []),
      ...update,
    ],
    default: () => [],
  }),

  // =============================================================================
  // EXECUTION METADATA
  // =============================================================================

  /** Current pipeline stage */
  currentStage: Annotation<
    | 'init'
    | 'poll'
    | 'group'
    | 'triage'
    | 'specialists'
    | 'evaluators'
    | 'package'
    | 'store'
    | 'complete'
    | 'failed'
  >({
    value: (left, right) => right ?? left,
    default: () => 'init',
  }),

  /** Stage start times for duration tracking */
  stageTimes: Annotation<Record<string, number>>({
    reducer: (
      current: Record<string, number>,
      update: Record<string, number>,
    ) => ({ ...(current ?? {}), ...update }),
    default: () => ({}),
  }),

  /** Execution metrics */
  metrics: Annotation<Partial<RunnerMetrics>>({
    reducer: (
      current: Partial<RunnerMetrics>,
      update: Partial<RunnerMetrics>,
    ) => ({ ...(current ?? {}), ...update }),
    default: () => ({}),
  }),

  /** Errors encountered during execution */
  errors: Annotation<string[]>({
    reducer: (current: string[], update: string[]) => [
      ...(current ?? []),
      ...update,
    ],
    default: () => [],
  }),

  /** Execution status */
  status: Annotation<'running' | 'completed' | 'failed' | 'partial'>({
    value: (left, right) => right ?? left,
    default: () => 'running',
  }),
});

/**
 * Type-safe state type derived from annotation.
 * Use this type for node function signatures.
 *
 * @example
 * ```typescript
 * async function pollDataNode(state: PredictionState): Promise<Partial<PredictionState>> {
 *   const { agentId, instruments, config } = state;
 *   // ... collect data
 *   return {
 *     datapoint: newDatapoint,
 *     currentStage: 'poll',
 *   };
 * }
 * ```
 */
export type PredictionState = typeof PredictionStateAnnotation.State;

/**
 * Type for partial state updates returned from nodes.
 * LangGraph merges these updates into the full state using reducers.
 */
export type PredictionStateUpdate = Partial<PredictionState>;

/**
 * Helper to create initial state from RunnerInput.
 * Used by the runner's execute() method.
 *
 * @example
 * ```typescript
 * const initialState = createInitialState(input);
 * const result = await graph.invoke(initialState, { configurable: { thread_id: runId } });
 * ```
 */
export function createInitialState(input: {
  agentId: string;
  agentSlug: string;
  orgSlug: string;
  config: PredictionRunnerConfig;
  executionContext: {
    taskId: string;
    userId?: string;
    conversationId?: string;
  };
  instrumentsOverride?: string[];
  runTimestamp?: string;
}): PredictionState {
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = input.runTimestamp || new Date().toISOString();

  return {
    // Run identity
    runId,
    agentId: input.agentId,
    agentSlug: input.agentSlug,
    orgSlug: input.orgSlug,
    timestamp,

    // Configuration
    config: input.config,
    instruments: input.instrumentsOverride || input.config.instruments,
    riskProfile: input.config.riskProfile,

    // Execution context
    executionContext: input.executionContext,

    // Data (initialized empty)
    datapoint: null,
    instrumentBundles: [],

    // Pipeline outputs (initialized empty)
    triageResults: [],
    specialistAnalyses: [],
    evaluatorChallenges: [],
    recommendations: [],

    // Execution metadata
    currentStage: 'init',
    stageTimes: {
      init: Date.now(),
    },
    metrics: {},
    errors: [],
    status: 'running',
  };
}

/**
 * Helper to mark stage completion and track duration.
 * Call this at the end of each node to update stage tracking.
 *
 * @example
 * ```typescript
 * async function pollDataNode(state: PredictionState): Promise<PredictionStateUpdate> {
 *   // ... do work
 *   return markStageComplete(state, 'poll', {
 *     datapoint: newDatapoint,
 *   });
 * }
 * ```
 */
export function markStageComplete(
  state: PredictionState,
  stage: PredictionState['currentStage'],
  update: PredictionStateUpdate,
): PredictionStateUpdate {
  const now = Date.now();
  const stageStartTime = state.stageTimes[state.currentStage] || now;
  const stageDuration = now - stageStartTime;

  return {
    ...update,
    currentStage: stage,
    stageTimes: {
      [stage]: now,
    },
    metrics: {
      stageDurations: {
        ...(state.metrics?.stageDurations || {}),
        [state.currentStage]: stageDuration,
      },
    },
  };
}
