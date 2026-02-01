import { Injectable, Logger } from '@nestjs/common';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { LLMService } from '@/llms/llm.service';
import { AnalystService } from './analyst.service';
import { LearningService } from './learning.service';
import { AnalystPromptBuilderService } from './analyst-prompt-builder.service';
import {
  LlmTierResolverService,
  TierResolutionContext,
} from './llm-tier-resolver.service';
import { LlmUsageLimiterService } from './llm-usage-limiter.service';
import { AnalystMotivationService } from './analyst-motivation.service';
import { AnalystRepository } from '../repositories/analyst.repository';
import { ActiveAnalyst } from '../interfaces/analyst.interface';
import { Target } from '../interfaces/target.interface';
import { LlmTier } from '../interfaces/llm-tier.interface';
import {
  EnsembleInput,
  EnsembleResult,
  AnalystAssessmentResult,
  AggregationMethod,
} from '../interfaces/ensemble.interface';
import { LlmConfig } from '../interfaces/universe.interface';
import {
  ForkType,
  AnalystContextVersion,
} from '../interfaces/portfolio.interface';

export interface EnsembleOptions {
  // Which tiers to run (default: all enabled)
  tiers?: LlmTier[];
  // How to aggregate results
  aggregationMethod?: AggregationMethod;
  // LLM config context for tier resolution
  llmConfigContext?: {
    targetConfig?: LlmConfig | null;
    universeConfig?: LlmConfig | null;
    agentConfig?: LlmConfig | null;
  };
  // Which fork(s) to run assessments for (default: both)
  forkTypes?: ForkType[];
  // Whether to run both forks (default: true for full dual-fork mode)
  enableDualFork?: boolean;
}

/**
 * Result from running dual-fork ensemble (deprecated - use ThreeWayForkEnsembleResult)
 */
export interface DualForkEnsembleResult {
  // Assessments organized by fork type
  userForkAssessments: AnalystAssessmentResult[];
  aiForkAssessments: AnalystAssessmentResult[];
  // Aggregated results per fork
  userForkAggregated: {
    direction: string;
    confidence: number;
    consensus_strength: number;
    reasoning: string;
  };
  aiForkAggregated: {
    direction: string;
    confidence: number;
    consensus_strength: number;
    reasoning: string;
  };
  // Combined result (defaults to user fork for backward compatibility)
  combined: EnsembleResult;
}

/**
 * Aggregated result for a single fork
 */
export interface ForkAggregatedResult {
  direction: string;
  confidence: number;
  consensus_strength: number;
  reasoning: string;
}

/**
 * Result from running three-way fork ensemble
 * Each analyst runs 3 times with different context modes:
 * - user: User-maintained context section only
 * - ai: AI-maintained context section only
 * - arbitrator: Combines both sections for final call
 */
export interface ThreeWayForkEnsembleResult {
  // Assessments organized by fork type
  userForkAssessments: AnalystAssessmentResult[];
  aiForkAssessments: AnalystAssessmentResult[];
  arbitratorForkAssessments: AnalystAssessmentResult[];
  // Aggregated results per fork
  userForkAggregated: ForkAggregatedResult;
  aiForkAggregated: ForkAggregatedResult;
  arbitratorForkAggregated: ForkAggregatedResult;
  // Final result uses arbitrator for the prediction
  final: EnsembleResult;
  // Metadata for comparison
  metadata: {
    totalAnalysts: number;
    userVsAiAgreement: number; // Percentage of analysts where user and ai agree
    arbitratorAgreesWithUser: number; // Percentage of arbitrator decisions that match user
    arbitratorAgreesWithAi: number; // Percentage of arbitrator decisions that match ai
  };
}

@Injectable()
export class AnalystEnsembleService {
  private readonly logger = new Logger(AnalystEnsembleService.name);

  constructor(
    private readonly analystService: AnalystService,
    private readonly analystRepository: AnalystRepository,
    private readonly learningService: LearningService,
    private readonly promptBuilderService: AnalystPromptBuilderService,
    private readonly llmTierResolverService: LlmTierResolverService,
    private readonly llmService: LLMService,
    private readonly llmUsageLimiterService: LlmUsageLimiterService,
    private readonly analystMotivationService: AnalystMotivationService,
  ) {}

  /**
   * Run ensemble evaluation with all active analysts
   */
  async runEnsemble(
    baseContext: ExecutionContext,
    target: Target,
    input: EnsembleInput,
    options?: EnsembleOptions,
  ): Promise<EnsembleResult> {
    this.logger.log(`Running ensemble for target: ${target.symbol}`);

    // Get active analysts for this target
    const analysts = await this.analystService.getActiveAnalysts(target.id);
    if (analysts.length === 0) {
      this.logger.warn(`No active analysts for target: ${target.id}`);
      throw new Error('No active analysts available for evaluation');
    }
    this.logger.log(`Found ${analysts.length} active analysts`);

    // Build resolution context
    const resolutionContext: TierResolutionContext = {
      targetLlmConfig: options?.llmConfigContext?.targetConfig,
      universeLlmConfig: options?.llmConfigContext?.universeConfig,
      agentLlmConfig: options?.llmConfigContext?.agentConfig,
    };

    // Run each analyst on their configured tier
    const assessments: AnalystAssessmentResult[] = [];

    for (const analyst of analysts) {
      try {
        const assessment = await this.runAnalystAssessment(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
        );
        assessments.push(assessment);
      } catch (error) {
        this.logger.error(
          `Failed to run analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Continue with other analysts
      }
    }

    if (assessments.length === 0) {
      throw new Error('All analyst assessments failed');
    }

    // Aggregate results
    const aggregationMethod = options?.aggregationMethod || 'weighted_ensemble';
    const aggregated = this.aggregateAssessments(
      assessments,
      aggregationMethod,
    );

    return {
      assessments,
      aggregated,
    };
  }

  /**
   * Run dual-fork ensemble - generates assessments for both user and ai forks
   * This is the main entry point for the dual-fork system
   */
  async runDualForkEnsemble(
    baseContext: ExecutionContext,
    target: Target,
    input: EnsembleInput,
    options?: EnsembleOptions,
  ): Promise<DualForkEnsembleResult> {
    this.logger.log(`Running dual-fork ensemble for target: ${target.symbol}`);

    // Get active analysts for this target
    const analysts = await this.analystService.getActiveAnalysts(target.id);
    if (analysts.length === 0) {
      this.logger.warn(`No active analysts for target: ${target.id}`);
      throw new Error('No active analysts available for evaluation');
    }
    this.logger.log(
      `Found ${analysts.length} active analysts, running dual-fork assessments`,
    );

    // Build resolution context
    const resolutionContext: TierResolutionContext = {
      targetLlmConfig: options?.llmConfigContext?.targetConfig,
      universeLlmConfig: options?.llmConfigContext?.universeConfig,
      agentLlmConfig: options?.llmConfigContext?.agentConfig,
    };

    // Get context versions for all analysts (both forks)
    const userContextVersions =
      await this.analystRepository.getAllCurrentContextVersions('user');
    const aiContextVersions =
      await this.analystRepository.getAllCurrentContextVersions('ai');

    // Run assessments for both forks
    const userForkAssessments: AnalystAssessmentResult[] = [];
    const aiForkAssessments: AnalystAssessmentResult[] = [];

    for (const analyst of analysts) {
      // User fork assessment
      try {
        const userContextVersion = userContextVersions.get(analyst.analyst_id);
        const userAssessment = await this.runAnalystAssessmentWithFork(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
          'user',
          userContextVersion,
        );
        userForkAssessments.push(userAssessment);
      } catch (error) {
        this.logger.error(
          `Failed to run user fork for analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // AI fork assessment
      try {
        const aiContextVersion = aiContextVersions.get(analyst.analyst_id);
        const aiAssessment = await this.runAnalystAssessmentWithFork(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
          'ai',
          aiContextVersion,
        );
        aiForkAssessments.push(aiAssessment);
      } catch (error) {
        this.logger.error(
          `Failed to run ai fork for analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Aggregate results per fork
    const aggregationMethod = options?.aggregationMethod || 'weighted_ensemble';

    const userForkAggregated =
      userForkAssessments.length > 0
        ? this.aggregateAssessments(userForkAssessments, aggregationMethod)
        : {
            direction: 'neutral',
            confidence: 0,
            consensus_strength: 0,
            reasoning: 'No user fork assessments available',
          };

    const aiForkAggregated =
      aiForkAssessments.length > 0
        ? this.aggregateAssessments(aiForkAssessments, aggregationMethod)
        : {
            direction: 'neutral',
            confidence: 0,
            consensus_strength: 0,
            reasoning: 'No ai fork assessments available',
          };

    // Combined result uses user fork for backward compatibility
    const combined: EnsembleResult = {
      assessments: [...userForkAssessments, ...aiForkAssessments],
      aggregated: userForkAggregated,
    };

    this.logger.log(
      `Dual-fork ensemble complete: user=${userForkAssessments.length}, ai=${aiForkAssessments.length} assessments`,
    );

    return {
      userForkAssessments,
      aiForkAssessments,
      userForkAggregated,
      aiForkAggregated,
      combined,
    };
  }

  /**
   * Run three-way fork ensemble - generates assessments for user, ai, and arbitrator forks
   * Each analyst runs 3 times with different context modes:
   * - user: Uses only user-maintained context section
   * - ai: Uses only AI-maintained context section
   * - arbitrator: Combines both user and ai context sections for the final call
   *
   * The arbitrator fork is used for the final prediction, while user and ai forks
   * are tracked separately for performance comparison.
   */
  async runThreeWayForkEnsemble(
    baseContext: ExecutionContext,
    target: Target,
    input: EnsembleInput,
    options?: EnsembleOptions,
  ): Promise<ThreeWayForkEnsembleResult> {
    this.logger.log(
      `Running three-way fork ensemble for target: ${target.symbol}`,
    );

    // Get active analysts for this target
    const analysts = await this.analystService.getActiveAnalysts(target.id);
    if (analysts.length === 0) {
      this.logger.warn(`No active analysts for target: ${target.id}`);
      throw new Error('No active analysts available for evaluation');
    }
    this.logger.log(
      `Found ${analysts.length} active analysts, running three-way fork assessments`,
    );

    // Build resolution context
    const resolutionContext: TierResolutionContext = {
      targetLlmConfig: options?.llmConfigContext?.targetConfig,
      universeLlmConfig: options?.llmConfigContext?.universeConfig,
      agentLlmConfig: options?.llmConfigContext?.agentConfig,
    };

    // Get context versions for all three forks
    const userContextVersions =
      await this.analystRepository.getAllCurrentContextVersions('user');
    const aiContextVersions =
      await this.analystRepository.getAllCurrentContextVersions('ai');
    // Arbitrator uses both - we'll combine them in the assessment method

    // Run assessments for all three forks
    const userForkAssessments: AnalystAssessmentResult[] = [];
    const aiForkAssessments: AnalystAssessmentResult[] = [];
    const arbitratorForkAssessments: AnalystAssessmentResult[] = [];

    for (const analyst of analysts) {
      // User fork assessment
      try {
        const userContextVersion = userContextVersions.get(analyst.analyst_id);
        const userAssessment = await this.runAnalystAssessmentWithFork(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
          'user',
          userContextVersion,
        );
        userForkAssessments.push(userAssessment);
      } catch (error) {
        this.logger.error(
          `Failed to run user fork for analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // AI fork assessment
      try {
        const aiContextVersion = aiContextVersions.get(analyst.analyst_id);
        const aiAssessment = await this.runAnalystAssessmentWithFork(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
          'ai',
          aiContextVersion,
        );
        aiForkAssessments.push(aiAssessment);
      } catch (error) {
        this.logger.error(
          `Failed to run ai fork for analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Arbitrator fork assessment - combines both contexts
      try {
        const userContextVersion = userContextVersions.get(analyst.analyst_id);
        const aiContextVersion = aiContextVersions.get(analyst.analyst_id);

        // Combine contexts for arbitrator
        const arbitratorContextVersion = this.combineContextVersions(
          userContextVersion,
          aiContextVersion,
        );

        const arbitratorAssessment = await this.runAnalystAssessmentWithFork(
          baseContext,
          analyst,
          target,
          input,
          resolutionContext,
          'arbitrator',
          arbitratorContextVersion,
        );
        arbitratorForkAssessments.push(arbitratorAssessment);
      } catch (error) {
        this.logger.error(
          `Failed to run arbitrator fork for analyst ${analyst.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Aggregate results per fork
    const aggregationMethod = options?.aggregationMethod || 'weighted_ensemble';

    const userForkAggregated =
      userForkAssessments.length > 0
        ? this.aggregateAssessments(userForkAssessments, aggregationMethod)
        : {
            direction: 'neutral',
            confidence: 0,
            consensus_strength: 0,
            reasoning: 'No user fork assessments available',
          };

    const aiForkAggregated =
      aiForkAssessments.length > 0
        ? this.aggregateAssessments(aiForkAssessments, aggregationMethod)
        : {
            direction: 'neutral',
            confidence: 0,
            consensus_strength: 0,
            reasoning: 'No ai fork assessments available',
          };

    const arbitratorForkAggregated =
      arbitratorForkAssessments.length > 0
        ? this.aggregateAssessments(
            arbitratorForkAssessments,
            aggregationMethod,
          )
        : {
            direction: 'neutral',
            confidence: 0,
            consensus_strength: 0,
            reasoning: 'No arbitrator fork assessments available',
          };

    // Final result uses arbitrator fork (it has the full context)
    const final: EnsembleResult = {
      assessments: [
        ...userForkAssessments,
        ...aiForkAssessments,
        ...arbitratorForkAssessments,
      ],
      aggregated: arbitratorForkAggregated,
    };

    // Calculate metadata for comparison
    const metadata = this.calculateThreeWayMetadata(
      userForkAssessments,
      aiForkAssessments,
      arbitratorForkAssessments,
    );

    this.logger.log(
      `Three-way fork ensemble complete: user=${userForkAssessments.length}, ai=${aiForkAssessments.length}, arbitrator=${arbitratorForkAssessments.length} assessments`,
    );
    this.logger.log(
      `User vs AI agreement: ${(metadata.userVsAiAgreement * 100).toFixed(1)}%, Arbitrator agrees with user: ${(metadata.arbitratorAgreesWithUser * 100).toFixed(1)}%, with AI: ${(metadata.arbitratorAgreesWithAi * 100).toFixed(1)}%`,
    );

    return {
      userForkAssessments,
      aiForkAssessments,
      arbitratorForkAssessments,
      userForkAggregated,
      aiForkAggregated,
      arbitratorForkAggregated,
      final,
      metadata,
    };
  }

  /**
   * Combine user and AI context versions for the arbitrator fork
   * Merges both perspectives and tier instructions
   */
  private combineContextVersions(
    userVersion?: AnalystContextVersion,
    aiVersion?: AnalystContextVersion,
  ): AnalystContextVersion | undefined {
    if (!userVersion && !aiVersion) {
      return undefined;
    }

    // If only one exists, use it
    if (!userVersion) return aiVersion;
    if (!aiVersion) return userVersion;

    // Combine tier instructions from both versions
    const combinedTierInstructions: Record<string, string | undefined> = {};

    // Add user tier instructions with prefix
    for (const [tier, instructions] of Object.entries(
      userVersion.tier_instructions,
    )) {
      if (instructions) {
        combinedTierInstructions[tier] =
          `## User Instructions\n${instructions}`;
      }
    }

    // Add AI tier instructions (merge with existing if same tier)
    for (const [tier, instructions] of Object.entries(
      aiVersion.tier_instructions,
    )) {
      if (instructions) {
        if (combinedTierInstructions[tier]) {
          combinedTierInstructions[tier] =
            `${combinedTierInstructions[tier]}\n\n## AI Instructions\n${instructions}`;
        } else {
          combinedTierInstructions[tier] =
            `## AI Instructions\n${instructions}`;
        }
      }
    }

    // Combine both contexts
    return {
      id: `arbitrator-${userVersion.analyst_id}`,
      analyst_id: userVersion.analyst_id,
      fork_type: 'arbitrator',
      version_number: Math.max(
        userVersion.version_number,
        aiVersion.version_number,
      ),
      // Combine perspectives with clear section markers
      perspective: `## User-Maintained Context\n${userVersion.perspective}\n\n## AI-Maintained Context\n${aiVersion.perspective}`,
      // Combine tier instructions
      tier_instructions: combinedTierInstructions,
      default_weight: Math.max(
        userVersion.default_weight,
        aiVersion.default_weight,
      ),
      agent_journal: aiVersion.agent_journal, // Use AI's journal if present
      changed_by: 'system', // Arbitrator is system-generated
      is_current: true,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Calculate metadata comparing the three forks
   */
  private calculateThreeWayMetadata(
    userAssessments: AnalystAssessmentResult[],
    aiAssessments: AnalystAssessmentResult[],
    arbitratorAssessments: AnalystAssessmentResult[],
  ): ThreeWayForkEnsembleResult['metadata'] {
    const totalAnalysts = Math.max(
      userAssessments.length,
      aiAssessments.length,
      arbitratorAssessments.length,
    );

    if (totalAnalysts === 0) {
      return {
        totalAnalysts: 0,
        userVsAiAgreement: 0,
        arbitratorAgreesWithUser: 0,
        arbitratorAgreesWithAi: 0,
      };
    }

    // Build lookup maps by analyst ID
    const userByAnalyst = new Map(
      userAssessments.map((a) => [a.analyst.analyst_id, a]),
    );
    const aiByAnalyst = new Map(
      aiAssessments.map((a) => [a.analyst.analyst_id, a]),
    );
    const arbitratorByAnalyst = new Map(
      arbitratorAssessments.map((a) => [a.analyst.analyst_id, a]),
    );

    let userAiAgreements = 0;
    let arbitratorUserAgreements = 0;
    let arbitratorAiAgreements = 0;
    let comparisons = 0;

    // Compare directions across forks for each analyst
    for (const [analystId, userAssessment] of userByAnalyst) {
      const aiAssessment = aiByAnalyst.get(analystId);
      const arbitratorAssessment = arbitratorByAnalyst.get(analystId);

      if (aiAssessment) {
        comparisons++;
        // Normalize directions for comparison
        const userDir = this.normalizeDirection(userAssessment.direction);
        const aiDir = this.normalizeDirection(aiAssessment.direction);

        if (userDir === aiDir) {
          userAiAgreements++;
        }

        if (arbitratorAssessment) {
          const arbDir = this.normalizeDirection(
            arbitratorAssessment.direction,
          );
          if (arbDir === userDir) {
            arbitratorUserAgreements++;
          }
          if (arbDir === aiDir) {
            arbitratorAiAgreements++;
          }
        }
      }
    }

    return {
      totalAnalysts,
      userVsAiAgreement: comparisons > 0 ? userAiAgreements / comparisons : 0,
      arbitratorAgreesWithUser:
        comparisons > 0 ? arbitratorUserAgreements / comparisons : 0,
      arbitratorAgreesWithAi:
        comparisons > 0 ? arbitratorAiAgreements / comparisons : 0,
    };
  }

  /**
   * Normalize direction strings for comparison
   */
  private normalizeDirection(direction: string): string {
    const normalized = direction.toLowerCase();
    if (['bullish', 'up', 'buy', 'long'].includes(normalized)) {
      return 'bullish';
    }
    if (['bearish', 'down', 'sell', 'short'].includes(normalized)) {
      return 'bearish';
    }
    return 'neutral';
  }

  /**
   * Run a single analyst assessment with fork context
   */
  private async runAnalystAssessmentWithFork(
    baseContext: ExecutionContext,
    analyst: ActiveAnalyst,
    target: Target,
    input: EnsembleInput,
    resolutionContext: TierResolutionContext,
    forkType: ForkType,
    contextVersion?: AnalystContextVersion,
  ): Promise<AnalystAssessmentResult> {
    const tier = analyst.effective_tier;

    // Get learnings for this analyst
    // User fork: uses learnings (user-maintained context)
    // AI fork: no learnings (self-adapts)
    // Arbitrator fork: uses learnings (has full context including user-maintained learnings)
    const learnings =
      forkType === 'user' || forkType === 'arbitrator'
        ? await this.learningService.getActiveLearnings(
            target.id,
            tier,
            analyst.analyst_id,
          )
        : []; // AI fork doesn't use learnings - it self-adapts

    // For ai and arbitrator forks, check status and get effective weight
    let effectiveWeight = analyst.effective_weight;
    let shouldInclude = true;
    let performanceContextMarkdown: string | undefined;

    if (forkType === 'ai' || forkType === 'arbitrator') {
      // Get performance context for ai/arbitrator forks
      // For arbitrator, we use 'ai' fork type to look up performance since
      // arbitrator combines both and we track its performance via the ai metrics
      const performanceForkType = forkType === 'arbitrator' ? 'ai' : forkType;
      const performanceContext =
        await this.analystMotivationService.buildPerformanceContext(
          analyst.analyst_id,
          performanceForkType,
        );

      if (performanceContext) {
        // Check if analyst should be included in ensemble
        shouldInclude = this.analystMotivationService.shouldIncludeInEnsemble(
          performanceContext.status,
        );

        // Get effective weight (reduced for probation)
        effectiveWeight = this.analystMotivationService.getEffectiveWeight(
          analyst.effective_weight,
          performanceContext.status,
        );

        // Generate performance context markdown for prompt injection
        performanceContextMarkdown =
          this.analystMotivationService.formatPerformanceContextForPrompt(
            performanceContext,
          );

        if (!shouldInclude) {
          this.logger.log(
            `Analyst ${analyst.slug} is suspended - running in paper-only mode`,
          );
        }
      }
    }

    // Override analyst context if we have a fork-specific version
    const effectiveAnalyst = contextVersion
      ? {
          ...analyst,
          perspective: contextVersion.perspective,
          tier_instructions: contextVersion.tier_instructions,
          effective_weight: effectiveWeight,
        }
      : {
          ...analyst,
          effective_weight: effectiveWeight,
        };

    // Build prompt with fork context
    const prompt = this.promptBuilderService.buildPrompt({
      analyst: effectiveAnalyst,
      tier,
      target,
      learnings,
      input: {
        content: input.content,
        direction: input.direction,
        metadata: input.metadata,
      },
      // Inject performance context for agent fork
      performanceContext: performanceContextMarkdown,
    });

    // Resolve LLM tier and create context
    const { context } = await this.llmTierResolverService.createTierContext(
      baseContext,
      tier,
      `${analyst.slug}:${forkType}`,
      resolutionContext,
    );

    // Check LLM usage limits before calling (skip for local providers)
    const estimatedTokens = this.estimateTokens(
      prompt.systemPrompt,
      prompt.userPrompt,
    );

    let effectiveContext = context;
    const isLocalProvider = this.llmUsageLimiterService.isLocalProvider(
      context.provider || '',
    );

    if (!isLocalProvider) {
      const usageCheck = this.llmUsageLimiterService.canUseTokens(
        target.universe_id,
        estimatedTokens,
        context.provider,
      );

      if (!usageCheck.allowed) {
        // Fallback to local provider (ollama) instead of throwing error
        this.logger.warn(
          `LLM usage limit reached for universe ${target.universe_id}: ${usageCheck.reason}. Falling back to local provider.`,
        );
        effectiveContext = {
          ...context,
          provider: 'ollama',
          model: process.env.DEFAULT_LLM_MODEL || 'llama3.2:1b',
        };
      }
    }

    // Call LLM
    const response = await this.llmService.generateResponse(
      prompt.systemPrompt,
      prompt.userPrompt,
      { executionContext: effectiveContext },
    );

    // Record actual usage (estimate output tokens as ~50% of input)
    // Skip recording for local providers
    const actualTokens = estimatedTokens + Math.floor(estimatedTokens * 0.5);
    this.llmUsageLimiterService.recordUsage(
      target.universe_id,
      actualTokens,
      `analyst_assessment:${analyst.slug}:${forkType}`,
      effectiveContext.provider,
    );

    // Check and emit usage warnings (only for non-local providers)
    if (
      !this.llmUsageLimiterService.isLocalProvider(
        effectiveContext.provider || '',
      )
    ) {
      await this.llmUsageLimiterService.checkAndEmitWarnings(
        effectiveContext,
        target.universe_id,
      );
    }

    // Parse response
    const responseText =
      typeof response === 'string' ? response : response.content;
    const parsed = this.parseAnalystResponse(responseText);

    return {
      analyst: effectiveAnalyst,
      tier,
      direction: parsed.direction,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      key_factors: parsed.key_factors || [],
      risks: parsed.risks || [],
      learnings_applied: prompt.learningIds,
      fork_type: forkType,
      context_version_id: contextVersion?.id,
      is_paper_only: !shouldInclude, // Mark as paper-only if suspended
    };
  }

  /**
   * Run a single analyst assessment (backward compatible - uses user fork)
   */
  private async runAnalystAssessment(
    baseContext: ExecutionContext,
    analyst: ActiveAnalyst,
    target: Target,
    input: EnsembleInput,
    resolutionContext: TierResolutionContext,
  ): Promise<AnalystAssessmentResult> {
    // Delegate to fork-aware version with user fork for backward compatibility
    return this.runAnalystAssessmentWithFork(
      baseContext,
      analyst,
      target,
      input,
      resolutionContext,
      'user',
      undefined, // No explicit context version = use analyst's current values
    );
  }

  /**
   * Parse analyst response from JSON
   */
  private parseAnalystResponse(response: string): {
    direction: string;
    confidence: number;
    reasoning: string;
    key_factors?: string[];
    risks?: string[];
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: unknown = JSON.parse(jsonMatch[0]);

        // Type guard for parsed object
        if (this.isAnalystResponseObject(parsed)) {
          return {
            direction: parsed.direction || 'neutral',
            confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
            reasoning: parsed.reasoning || 'No reasoning provided',
            key_factors: parsed.key_factors,
            risks: parsed.risks,
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to parse analyst response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Default response if parsing fails
    return {
      direction: 'neutral',
      confidence: 0.5,
      reasoning: response,
    };
  }

  /**
   * Type guard for analyst response object
   */
  private isAnalystResponseObject(obj: unknown): obj is {
    direction?: string;
    confidence?: number;
    reasoning?: string;
    key_factors?: string[];
    risks?: string[];
  } {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      ('direction' in obj || 'confidence' in obj || 'reasoning' in obj)
    );
  }

  /**
   * Estimate token count for prompts
   * Uses rough approximation of ~4 characters per token
   */
  private estimateTokens(systemPrompt: string, userPrompt: string): number {
    const totalChars = systemPrompt.length + userPrompt.length;
    return Math.ceil(totalChars / 4);
  }

  /**
   * Aggregate multiple analyst assessments
   */
  aggregateAssessments(
    assessments: AnalystAssessmentResult[],
    method: AggregationMethod,
  ): {
    direction: string;
    confidence: number;
    consensus_strength: number;
    reasoning: string;
  } {
    if (assessments.length === 0) {
      return {
        direction: 'neutral',
        confidence: 0,
        consensus_strength: 0,
        reasoning: 'No assessments to aggregate',
      };
    }

    switch (method) {
      case 'weighted_majority':
        return this.weightedMajorityVote(assessments);
      case 'weighted_average':
        return this.weightedAverage(assessments);
      case 'weighted_ensemble':
      default:
        return this.weightedEnsemble(assessments);
    }
  }

  private weightedMajorityVote(assessments: AnalystAssessmentResult[]) {
    // Count weighted votes for each direction
    const votes: Record<string, number> = {};
    let totalWeight = 0;

    for (const a of assessments) {
      const weight = a.analyst.effective_weight;
      votes[a.direction] = (votes[a.direction] || 0) + weight;
      totalWeight += weight;
    }

    // Find winning direction
    let maxVotes = 0;
    let winningDirection = 'neutral';
    for (const [direction, voteCount] of Object.entries(votes)) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningDirection = direction;
      }
    }

    // Calculate consensus strength (how much agreement)
    const consensus_strength = totalWeight > 0 ? maxVotes / totalWeight : 0;

    // Average confidence of winning direction assessments
    const winningAssessments = assessments.filter(
      (a) => a.direction === winningDirection,
    );
    const avgConfidence =
      winningAssessments.reduce((sum, a) => sum + a.confidence, 0) /
      winningAssessments.length;

    return {
      direction: winningDirection,
      confidence: avgConfidence,
      consensus_strength,
      reasoning: `${winningAssessments.length}/${assessments.length} analysts agree on ${winningDirection}`,
    };
  }

  private weightedAverage(assessments: AnalystAssessmentResult[]) {
    // Convert directions to numeric values
    const directionValues: Record<string, number> = {
      bullish: 1,
      up: 1,
      neutral: 0,
      flat: 0,
      bearish: -1,
      down: -1,
    };

    let weightedSum = 0;
    let confidenceSum = 0;
    let totalWeight = 0;

    for (const a of assessments) {
      const weight = a.analyst.effective_weight * a.confidence;
      const value = directionValues[a.direction] || 0;
      weightedSum += value * weight;
      confidenceSum += a.confidence * a.analyst.effective_weight;
      totalWeight += a.analyst.effective_weight;
    }

    const avgValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const avgConfidence = totalWeight > 0 ? confidenceSum / totalWeight : 0;

    // Convert back to direction
    // Lowered thresholds from 0.3 to 0.15 for more decisive predictions
    let direction: string;
    if (avgValue > 0.15) direction = 'bullish';
    else if (avgValue < -0.15) direction = 'bearish';
    else direction = 'neutral';

    // Consensus = how close values are to each other
    const variance =
      assessments.reduce((sum, a) => {
        const value = directionValues[a.direction] || 0;
        return sum + Math.pow(value - avgValue, 2);
      }, 0) / assessments.length;
    const consensus_strength = Math.max(0, 1 - Math.sqrt(variance));

    return {
      direction,
      confidence: avgConfidence,
      consensus_strength,
      reasoning: `Weighted average: ${avgValue.toFixed(2)} (${direction})`,
    };
  }

  private weightedEnsemble(assessments: AnalystAssessmentResult[]) {
    // Combine majority vote and weighted average
    const majority = this.weightedMajorityVote(assessments);
    const average = this.weightedAverage(assessments);

    // Use majority direction if consensus is strong, otherwise use average
    const direction =
      majority.consensus_strength > 0.6
        ? majority.direction
        : average.direction;

    // Blend confidences
    const confidence = (majority.confidence + average.confidence) / 2;
    const consensus_strength =
      (majority.consensus_strength + average.consensus_strength) / 2;

    return {
      direction,
      confidence,
      consensus_strength,
      reasoning: `Ensemble: majority=${majority.direction}, avg=${average.direction}, consensus=${consensus_strength.toFixed(2)}`,
    };
  }
}
