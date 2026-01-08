/**
 * BasePredictionRunnerService
 *
 * Abstract base class for all prediction runners.
 * Implements the core LangGraph pipeline and provides hooks for domain-specific logic.
 *
 * ARCHITECTURE:
 * - This is an abstract class that implements IPredictionRunner
 * - Domain-specific runners (StockPredictorRunner, CryptoPredictorRunner) extend this
 * - Abstract methods must be implemented by subclasses for domain-specific behavior
 * - Concrete methods implement the shared pipeline logic
 *
 * GRAPH PIPELINE:
 * 1. poll_data -> Collect claims from tools (subclass provides tools)
 * 2. group_claims -> Group claims by instrument (concrete implementation)
 * 3. triage -> Rule-based pre-filter (concrete implementation)
 * 4. process_bundles -> Parallel specialist analysis (subclass provides prompts)
 * 5. evaluate -> Red-team recommendations (subclass provides evaluator prompts)
 * 6. package -> Create final recommendations (concrete implementation)
 * 7. store_results -> Persist to database (concrete implementation)
 *
 * @module base-prediction-runner.service
 */

import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import { IPredictionRunner } from '../runner.registry';
import {
  RunnerInput,
  RunnerOutput,
  PredictionRunnerType,
  RiskProfile,
  Datapoint,
  EnrichedClaimBundle,
  TriageResult,
  SpecialistAnalysis,
  EvaluatorChallenge,
  Recommendation,
  Source,
  Claim,
  RunnerMetrics,
} from './base-prediction.types';
import {
  PredictionState,
  PredictionStateAnnotation,
  PredictionStateUpdate,
  createInitialState,
  markStageComplete,
} from './base-prediction.state';
import { PostgresCheckpointerService } from './postgres-checkpointer.service';
import { IClaimProcessor } from './claim-processor.interface';

/**
 * Tool definition for data collection.
 * Subclasses provide domain-specific tools.
 */
export interface PredictionTool {
  /** Tool name (e.g., 'yahoo-finance', 'coingecko') */
  name: string;

  /** Tool description */
  description: string;

  /** Tool execution function */
  execute: (instruments: string[]) => Promise<Source[]>;
}

/**
 * Specialist context for LLM prompts.
 * Subclasses provide domain-specific specialist prompts.
 */
export interface SpecialistContext {
  /** Specialist identifier (e.g., 'technical-analyst', 'sentiment-analyst') */
  specialist: string;

  /** System prompt for this specialist */
  systemPrompt: string;

  /** User prompt template (receives bundle data) */
  userPromptTemplate: (bundle: EnrichedClaimBundle) => string;
}

/**
 * Triage context for LLM prompts.
 * Subclasses provide domain-specific triage prompts.
 */
export interface TriageContext {
  /** Triage agent identifier */
  agent: string;

  /** System prompt for triage */
  systemPrompt: string;

  /** User prompt template (receives bundle data) */
  userPromptTemplate: (bundle: EnrichedClaimBundle) => string;
}

/**
 * Evaluator context for LLM prompts.
 * Subclasses provide domain-specific evaluator prompts.
 */
export interface EvaluatorContext {
  /** Evaluator identifier */
  evaluator: string;

  /** Challenge type */
  challengeType: EvaluatorChallenge['challengeType'];

  /** System prompt for evaluation */
  systemPrompt: string;

  /** User prompt template (receives recommendations) */
  userPromptTemplate: (
    recommendations: Recommendation[],
    analyses: SpecialistAnalysis[],
  ) => string;
}

/**
 * Abstract base class for prediction runners.
 * Domain-specific runners extend this and implement abstract methods.
 */
@Injectable()
export abstract class BasePredictionRunnerService implements IPredictionRunner {
  protected readonly logger = new Logger(this.constructor.name);

  // IPredictionRunner interface properties
  abstract readonly runnerType: PredictionRunnerType;
  abstract readonly runnerName: string;

  constructor(
    protected readonly checkpointerService: PostgresCheckpointerService,
    protected readonly claimProcessor: IClaimProcessor,
  ) {}

  // ===========================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ===========================================================================

  /**
   * Get domain-specific tools for data collection.
   * Called during poll_data node.
   *
   * @example Stock predictor returns: [YahooFinanceTool, AlphaVantageTool]
   * @example Crypto predictor returns: [CoinGeckoTool, DexScreenerTool]
   */
  protected abstract getTools(): PredictionTool[];

  /**
   * Get specialist contexts for analysis.
   * Called during process_bundles node.
   *
   * @example Stock predictor returns: [TechnicalAnalyst, FundamentalAnalyst, NewsAnalyst]
   * @example Crypto predictor returns: [OnChainAnalyst, SentimentAnalyst, DeFiAnalyst]
   */
  protected abstract getSpecialistContexts(): SpecialistContext[];

  /**
   * Get triage contexts for pre-filtering.
   * Called during triage node (if using LLM-based triage).
   *
   * @example Returns: [RiskTriageAgent, OpportunityTriageAgent]
   */
  protected abstract getTriageContexts(): TriageContext[];

  /**
   * Get evaluator contexts for red-teaming.
   * Called during evaluate node.
   *
   * @example Returns: [ContrarianEvaluator, RiskAssessmentEvaluator, HistoricalPatternEvaluator]
   */
  protected abstract getEvaluatorContexts(): EvaluatorContext[];

  /**
   * Get supported risk profiles for this runner.
   *
   * @example Stock predictor returns: ['conservative', 'moderate', 'aggressive']
   * @example Crypto predictor returns: ['hodler', 'trader', 'degen']
   */
  protected abstract getRiskProfiles(): RiskProfile[];

  // ===========================================================================
  // CONCRETE METHODS - Shared implementation
  // ===========================================================================

  /**
   * Main execution entry point.
   * Builds the graph and runs it with checkpointing.
   */
  async execute(input: RunnerInput): Promise<RunnerOutput> {
    const startTime = Date.now();

    try {
      // Validate configuration
      this.validateInput(input);

      // Create initial state
      const initialState = createInitialState(input);

      // Build the graph
      const graph = this.buildGraph();

      // Compile with checkpointer
      const checkpointer = this.checkpointerService.getSaver();
      const compiledGraph = graph.compile({ checkpointer });

      // Execute the graph
      this.logger.log(
        `Executing ${this.runnerName} for agent ${input.agentId}, run ${initialState.runId}`,
      );

      const result = await compiledGraph.invoke(initialState, {
        configurable: {
          thread_id: initialState.runId,
        },
      });

      // Build output from final state
      const output = this.buildOutput(result, startTime);

      this.logger.log(
        `Execution complete: ${output.status}, ${output.recommendations.length} recommendations`,
      );

      return output;
    } catch (error) {
      this.logger.error(
        `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        runId: `failed-${Date.now()}`,
        agentId: input.agentId,
        status: 'failed',
        recommendations: [],
        datapoint: this.createEmptyDatapoint(input.agentId),
        metrics: {
          totalDurationMs: Date.now() - startTime,
          stageDurations: {},
          claimsProcessed: 0,
          bundlesProceeded: 0,
          recommendationsGenerated: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build the LangGraph pipeline.
   * This is the core orchestration logic.
   */
  protected buildGraph() {
    const graph = new StateGraph(PredictionStateAnnotation)
      // Define nodes
      .addNode('poll_data', this.pollDataNode.bind(this))
      .addNode('group_claims', this.groupClaimsNode.bind(this))
      .addNode('triage', this.triageNode.bind(this))
      .addNode('process_bundles', this.processBundlesNode.bind(this))
      .addNode('evaluate', this.evaluateNode.bind(this))
      .addNode('package', this.packageNode.bind(this))
      .addNode('store_results', this.storeResultsNode.bind(this))

      // Define edges (linear flow for now, can add conditionals later)
      .addEdge('__start__', 'poll_data')
      .addEdge('poll_data', 'group_claims')
      .addEdge('group_claims', 'triage')
      .addEdge('triage', 'process_bundles')
      .addEdge('process_bundles', 'evaluate')
      .addEdge('evaluate', 'package')
      .addEdge('package', 'store_results')
      .addEdge('store_results', '__end__');

    return graph;
  }

  // ===========================================================================
  // GRAPH NODES - Pipeline stages
  // ===========================================================================

  /**
   * Node: Poll data sources and collect claims.
   * Uses tools provided by subclass.
   */
  protected async pollDataNode(
    state: PredictionState,
  ): Promise<PredictionStateUpdate> {
    this.logger.log(`[${state.runId}] Polling data sources...`);

    const startTime = Date.now();
    const tools = this.getTools();
    const sources: Source[] = [];
    const errors: string[] = [];

    // Execute all tools in parallel
    const toolResults = await Promise.allSettled(
      tools.map((tool) => tool.execute(state.instruments)),
    );

    // Collect results
    toolResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sources.push(...result.value);
      } else {
        const tool = tools[index];
        if (tool) {
          this.logger.warn(
            `[${state.runId}] Tool ${tool.name} failed: ${result.reason}`,
          );
          errors.push(`${tool.name}: ${result.reason}`);
        }
      }
    });

    // Flatten all claims
    const allClaims: Claim[] = sources.flatMap((source) => source.claims);

    // Extract unique instruments
    const instruments = Array.from(
      new Set(allClaims.map((claim) => claim.instrument)),
    );

    // Create datapoint
    const datapoint: Datapoint = {
      id: uuidv4(),
      agentId: state.agentId,
      timestamp: state.timestamp,
      sources,
      allClaims,
      instruments,
      metadata: {
        durationMs: Date.now() - startTime,
        toolsSucceeded: tools.length - errors.length,
        toolsFailed: errors.length,
        toolStatus: Object.fromEntries(
          tools.map((tool, i) => [
            tool.name,
            toolResults[i]?.status === 'fulfilled' ? 'success' : 'failed',
          ]),
        ),
        errors: errors.length > 0 ? errors : undefined,
      },
    };

    this.logger.log(
      `[${state.runId}] Collected ${allClaims.length} claims from ${sources.length} sources`,
    );

    return markStageComplete(state, 'poll', {
      datapoint,
      errors,
    });
  }

  /**
   * Node: Group claims by instrument.
   * Uses the claim processor service.
   */
  protected async groupClaimsNode(
    state: PredictionState,
  ): Promise<PredictionStateUpdate> {
    this.logger.log(`[${state.runId}] Grouping claims by instrument...`);

    if (!state.datapoint) {
      return markStageComplete(state, 'group', {
        errors: ['No datapoint available for grouping'],
      });
    }

    // Group claims
    const bundles = this.claimProcessor.groupClaims(state.datapoint);

    // Enrich with historical context
    const enrichedBundles = await this.claimProcessor.enrichWithHistory(
      bundles,
      state.agentId,
      state.config.learningConfig?.contextLookbackHours || 24,
    );

    this.logger.log(
      `[${state.runId}] Created ${enrichedBundles.length} instrument bundles`,
    );

    return markStageComplete(state, 'group', {
      instrumentBundles: enrichedBundles,
    });
  }

  /**
   * Node: Triage bundles to determine which proceed to specialists.
   * Uses rule-based pre-filtering from config.
   * Currently synchronous; will be async when LLM-based triage is added.
   */
  protected triageNode(state: PredictionState): PredictionStateUpdate {
    this.logger.log(`[${state.runId}] Triaging claim bundles...`);

    const triageResults: TriageResult[] = [];
    const thresholds = state.config.preFilterThresholds;

    // Apply pre-filter to each bundle
    for (const bundle of state.instrumentBundles) {
      const enrichedBundle = this.claimProcessor.shouldProceedToSpecialists(
        bundle,
        thresholds,
      );

      if (enrichedBundle.shouldProceed) {
        // Create triage result
        triageResults.push({
          instrument: bundle.instrument,
          proceed: true,
          urgency: this.calculateUrgency(enrichedBundle),
          specialistTeams: this.getSpecialistContexts().map(
            (s) => s.specialist,
          ),
          rationale:
            enrichedBundle.proceedReason || 'Passed pre-filter thresholds',
          votes: [], // Rule-based, no votes
        });
      }
    }

    this.logger.log(
      `[${state.runId}] Triage complete: ${triageResults.length}/${state.instrumentBundles.length} bundles proceed`,
    );

    return markStageComplete(state, 'triage', {
      triageResults,
    });
  }

  /**
   * Node: Process bundles through specialist analysis.
   * Placeholder for LLM-based specialist analysis.
   * TODO: Implement LLM-based specialist analysis in Phase 2
   */
  protected processBundlesNode(state: PredictionState): PredictionStateUpdate {
    this.logger.log(
      `[${state.runId}] Processing bundles through specialists...`,
    );

    // Get bundles that passed triage
    const bundlesToProcess = state.instrumentBundles.filter(
      (bundle: EnrichedClaimBundle) =>
        state.triageResults.some(
          (triage: TriageResult) =>
            triage.instrument === bundle.instrument && triage.proceed,
        ),
    );

    if (bundlesToProcess.length === 0) {
      this.logger.log(`[${state.runId}] No bundles to process`);
      return markStageComplete(state, 'specialists', {});
    }

    // TODO: Implement LLM-based specialist analysis
    // For now, create placeholder analyses
    const specialistAnalyses: SpecialistAnalysis[] = [];

    this.logger.log(
      `[${state.runId}] Specialist analysis complete: ${specialistAnalyses.length} analyses`,
    );

    return markStageComplete(state, 'specialists', {
      specialistAnalyses,
    });
  }

  /**
   * Node: Evaluate recommendations through red-teaming.
   * Placeholder for LLM-based evaluator challenges.
   * TODO: Implement LLM-based evaluator challenges in Phase 3
   */
  protected evaluateNode(state: PredictionState): PredictionStateUpdate {
    this.logger.log(`[${state.runId}] Evaluating recommendations...`);

    // TODO: Implement LLM-based evaluator challenges
    // For now, create empty challenges array
    const evaluatorChallenges: EvaluatorChallenge[] = [];

    this.logger.log(
      `[${state.runId}] Evaluation complete: ${evaluatorChallenges.length} challenges`,
    );

    return markStageComplete(state, 'evaluators', {
      evaluatorChallenges,
    });
  }

  /**
   * Node: Package final recommendations.
   * Combines specialist analyses and evaluator feedback.
   * TODO: Implement recommendation packaging logic in Phase 3
   */
  protected packageNode(state: PredictionState): PredictionStateUpdate {
    this.logger.log(`[${state.runId}] Packaging recommendations...`);

    // TODO: Implement recommendation packaging logic
    // For now, create empty recommendations array
    const recommendations: Recommendation[] = [];

    this.logger.log(
      `[${state.runId}] Packaging complete: ${recommendations.length} recommendations`,
    );

    return markStageComplete(state, 'package', {
      recommendations,
    });
  }

  /**
   * Node: Store results to database.
   * Persists datapoint, recommendations, and metrics.
   * TODO: Implement database persistence in Phase 4
   */
  protected storeResultsNode(state: PredictionState): PredictionStateUpdate {
    this.logger.log(`[${state.runId}] Storing results...`);

    // TODO: Implement database persistence
    // For now, just log
    this.logger.log(
      `[${state.runId}] Would store: ${state.recommendations.length} recommendations`,
    );

    return markStageComplete(state, 'store', {
      status: 'completed',
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Validate runner input.
   */
  protected validateInput(input: RunnerInput): void {
    if (!input.agentId) {
      throw new Error('agentId is required');
    }
    if (!input.agentSlug) {
      throw new Error('agentSlug is required');
    }
    if (!input.config) {
      throw new Error('config is required');
    }
    if (!input.config.instruments || input.config.instruments.length === 0) {
      throw new Error('At least one instrument must be configured');
    }
    if (!this.getRiskProfiles().includes(input.config.riskProfile)) {
      throw new Error(
        `Unsupported risk profile: ${input.config.riskProfile}. Supported: ${this.getRiskProfiles().join(', ')}`,
      );
    }
  }

  /**
   * Calculate urgency level from enriched bundle.
   */
  protected calculateUrgency(
    bundle: EnrichedClaimBundle,
  ): TriageResult['urgency'] {
    const significance = bundle.claimsDiff.significanceScore;

    if (significance >= 0.8) return 'critical';
    if (significance >= 0.6) return 'high';
    if (significance >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Build RunnerOutput from final state.
   * LangGraph returns a complex StateType that's hard to type precisely.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected buildOutput(state: any, startTime: number): RunnerOutput {
    const totalDurationMs = Date.now() - startTime;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const stageDurations: Record<string, number> =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      state.metrics?.stageDurations || {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const claimsProcessed: number = state.datapoint?.allClaims.length || 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const bundlesProceeded: number = state.triageResults.filter(
      (t: TriageResult) => t.proceed,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ).length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const recommendationsGenerated: number = state.recommendations.length;

    const metrics: RunnerMetrics = {
      totalDurationMs,
      stageDurations,
      claimsProcessed,
      bundlesProceeded,
      recommendationsGenerated,
    };

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      runId: state.runId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      agentId: state.agentId,

      status:
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        state.status === 'running'
          ? 'completed'
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (state.status as 'completed' | 'failed' | 'partial'),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      recommendations: state.recommendations,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      datapoint: state.datapoint || this.createEmptyDatapoint(state.agentId),
      metrics,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      error: state.errors.length > 0 ? state.errors.join('; ') : undefined,
    };
  }

  /**
   * Create an empty datapoint (for error cases).
   */
  protected createEmptyDatapoint(agentId: string): Datapoint {
    return {
      id: uuidv4(),
      agentId,
      timestamp: new Date().toISOString(),
      sources: [],
      allClaims: [],
      instruments: [],
      metadata: {
        durationMs: 0,
        toolsSucceeded: 0,
        toolsFailed: 0,
        toolStatus: {},
      },
    };
  }
}
