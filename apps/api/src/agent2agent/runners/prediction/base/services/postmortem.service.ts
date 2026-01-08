/**
 * Postmortem Service
 *
 * Creates and manages postmortems for recommendation outcomes.
 * Analyzes what worked, what failed, and extracts learnings.
 *
 * @module postmortem.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';
import { LLMGenerationService } from '../../../../../llms/services/llm-generation.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import {
  Recommendation,
  SpecialistAnalysis,
  PredictionRunnerType,
} from '../base-prediction.types';
import { OutcomeEvaluationResult } from './outcome-evaluation.service';

/**
 * Postmortem analysis result
 */
export interface PostmortemAnalysis {
  id?: string;
  predictionAgentId: string;
  recommendationId: string;
  outcomeId: string;
  instrument: string;
  analysisType: 'auto' | 'manual' | 'llm_assisted';
  whatWorked: string[];
  whatFailed: string[];
  rootCause: string | null;
  specialistPerformance: Record<
    string,
    {
      conclusion: string;
      wasCorrect: boolean;
      confidenceWasCalibrated: boolean;
    }
  >;
  keyLearnings: string[];
  missingContext: string[];
  suggestedImprovements: Array<{
    area: string;
    suggestion: string;
  }>;
  predictedConfidence: number;
  actualAccuracy: number;
  calibrationError: number;
  appliedToContext: boolean;
  appliedAt: string | null;
}

/**
 * Specialist performance for postmortem
 * Note: Reserved for future typed usage of specialist entries
 */
interface _SpecialistPerformanceEntry {
  specialist: string;
  conclusion: string;
  confidence: number;
  wasCorrect: boolean;
}

@Injectable()
export class PostmortemService {
  private readonly logger = new Logger(PostmortemService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly llmService: LLMGenerationService,
  ) {}

  /**
   * Create a postmortem analysis for a recommendation outcome.
   *
   * @param recommendation - The recommendation that was evaluated
   * @param outcome - The outcome evaluation
   * @param specialistAnalyses - Specialist analyses that contributed
   * @param predictionAgentId - The prediction agent ID
   * @param runnerType - Type of runner for context
   * @param executionContext - For LLM calls
   * @returns Postmortem analysis
   */
  async createPostmortem(
    recommendation: Recommendation,
    outcome: OutcomeEvaluationResult,
    specialistAnalyses: SpecialistAnalysis[],
    predictionAgentId: string,
    runnerType: PredictionRunnerType,
    executionContext: ExecutionContext,
  ): Promise<PostmortemAnalysis> {
    this.logger.debug(
      `Creating postmortem for recommendation ${recommendation.id} (outcome: ${outcome.outcome})`,
    );

    // Analyze specialist performance
    const specialistPerformance = this.analyzeSpecialistPerformance(
      specialistAnalyses,
      recommendation,
      outcome,
    );

    // Determine what worked and failed
    const { whatWorked, whatFailed } = this.categorizeFactors(
      specialistAnalyses,
      outcome,
    );

    // Calculate confidence calibration
    const actualAccuracy = outcome.outcome === 'correct' ? 1.0 : 0.0;
    const calibrationError = Math.abs(
      recommendation.confidence - actualAccuracy,
    );

    // Generate LLM-assisted analysis for root cause and learnings
    const llmAnalysis = await this.generateLLMAnalysis(
      recommendation,
      outcome,
      specialistAnalyses,
      specialistPerformance,
      runnerType,
      executionContext,
    );

    const postmortem: PostmortemAnalysis = {
      predictionAgentId,
      recommendationId: recommendation.id,
      outcomeId: outcome.recommendationId, // This should be outcomeId
      instrument: recommendation.instrument,
      analysisType: 'llm_assisted',
      whatWorked,
      whatFailed,
      rootCause: llmAnalysis.rootCause,
      specialistPerformance,
      keyLearnings: llmAnalysis.keyLearnings,
      missingContext: llmAnalysis.missingContext,
      suggestedImprovements: llmAnalysis.suggestedImprovements,
      predictedConfidence: recommendation.confidence,
      actualAccuracy,
      calibrationError,
      appliedToContext: false,
      appliedAt: null,
    };

    // Store the postmortem
    const id = await this.storePostmortem(postmortem);
    postmortem.id = id;

    this.logger.debug(`Created postmortem ${id} for ${recommendation.id}`);
    return postmortem;
  }

  /**
   * Analyze how each specialist performed.
   */
  private analyzeSpecialistPerformance(
    analyses: SpecialistAnalysis[],
    recommendation: Recommendation,
    outcome: OutcomeEvaluationResult,
  ): Record<
    string,
    {
      conclusion: string;
      wasCorrect: boolean;
      confidenceWasCalibrated: boolean;
    }
  > {
    const result: Record<
      string,
      {
        conclusion: string;
        wasCorrect: boolean;
        confidenceWasCalibrated: boolean;
      }
    > = {};

    for (const analysis of analyses) {
      // Determine if specialist was correct based on outcome
      const wasCorrect = this.wasSpecialistCorrect(analysis, outcome);

      // Check confidence calibration (within 20%)
      const confidenceWasCalibrated =
        Math.abs(analysis.confidence - (wasCorrect ? 1.0 : 0.0)) < 0.2;

      result[analysis.specialist] = {
        conclusion: analysis.conclusion,
        wasCorrect,
        confidenceWasCalibrated,
      };
    }

    return result;
  }

  /**
   * Determine if a specialist's analysis was correct.
   */
  private wasSpecialistCorrect(
    analysis: SpecialistAnalysis,
    outcome: OutcomeEvaluationResult,
  ): boolean {
    // Map specialist conclusion to expected outcome
    // Note: These arrays document the full action mapping for future use
    // const bullishActions = ['buy', 'accumulate', 'bet_yes'];
    // const bearishActions = ['sell', 'reduce', 'bet_no'];

    const returnPositive =
      outcome.actualReturnPercent !== null && outcome.actualReturnPercent > 0;

    if (analysis.conclusion === 'bullish') {
      return returnPositive;
    } else if (analysis.conclusion === 'bearish') {
      return !returnPositive;
    } else if (analysis.conclusion === 'neutral') {
      return (
        outcome.actualReturnPercent !== null &&
        Math.abs(outcome.actualReturnPercent) < 2
      );
    }

    return false;
  }

  /**
   * Categorize factors into what worked and what failed.
   */
  private categorizeFactors(
    analyses: SpecialistAnalysis[],
    outcome: OutcomeEvaluationResult,
  ): { whatWorked: string[]; whatFailed: string[] } {
    const whatWorked: string[] = [];
    const whatFailed: string[] = [];

    for (const analysis of analyses) {
      const wasCorrect = this.wasSpecialistCorrect(analysis, outcome);

      if (wasCorrect) {
        whatWorked.push(
          `${analysis.specialist}: ${analysis.conclusion} conclusion was correct`,
        );
        if (analysis.keyClaims.length > 0) {
          whatWorked.push(`Key signals from ${analysis.specialist} were valid`);
        }
      } else {
        whatFailed.push(
          `${analysis.specialist}: ${analysis.conclusion} conclusion was incorrect`,
        );
        for (const risk of analysis.riskFactors) {
          whatFailed.push(`Underweighted risk: ${risk}`);
        }
      }
    }

    // Add outcome-specific factors
    if (outcome.outcome === 'correct') {
      whatWorked.push(
        `Final recommendation aligned with market movement (+${outcome.actualReturnPercent?.toFixed(2)}%)`,
      );
    } else if (outcome.outcome === 'incorrect') {
      whatFailed.push(
        `Final recommendation contradicted market movement (${outcome.actualReturnPercent?.toFixed(2)}%)`,
      );
    }

    return { whatWorked, whatFailed };
  }

  /**
   * Generate LLM-assisted analysis for deeper insights.
   */
  private async generateLLMAnalysis(
    recommendation: Recommendation,
    outcome: OutcomeEvaluationResult,
    analyses: SpecialistAnalysis[],
    specialistPerformance: Record<
      string,
      { conclusion: string; wasCorrect: boolean }
    >,
    runnerType: PredictionRunnerType,
    executionContext: ExecutionContext,
  ): Promise<{
    rootCause: string | null;
    keyLearnings: string[];
    missingContext: string[];
    suggestedImprovements: Array<{ area: string; suggestion: string }>;
  }> {
    const systemPrompt = `You are a trading postmortem analyst. Analyze the following recommendation outcome and provide insights.

RECOMMENDATION:
- Instrument: ${recommendation.instrument}
- Action: ${recommendation.action}
- Confidence: ${(recommendation.confidence * 100).toFixed(0)}%
- Rationale: ${recommendation.rationale}

OUTCOME:
- Result: ${outcome.outcome}
- Actual Return: ${outcome.actualReturnPercent?.toFixed(2)}%
- Benchmark Return: ${outcome.benchmarkReturnPercent?.toFixed(2)}%

SPECIALIST ANALYSES:
${analyses.map((a) => `- ${a.specialist}: ${a.conclusion} (${(a.confidence * 100).toFixed(0)}% confidence) - ${specialistPerformance[a.specialist]?.wasCorrect ? 'CORRECT' : 'INCORRECT'}`).join('\n')}

Respond in JSON format:
{
  "rootCause": "Primary reason for the outcome (null if inconclusive)",
  "keyLearnings": ["Learning 1", "Learning 2"],
  "missingContext": ["What information would have helped"],
  "suggestedImprovements": [
    {"area": "pre-filter|triage|specialists|evaluators", "suggestion": "Specific improvement"}
  ]
}`;

    try {
      const llmResult = await this.llmService.generateResponse(
        executionContext,
        systemPrompt,
        'Analyze this recommendation outcome and provide postmortem insights.',
        { executionContext },
      );

      // Extract content string from response
      const responseText =
        typeof llmResult === 'string' ? llmResult : llmResult.content;

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rootCause: parsed.rootCause || null,
          keyLearnings: parsed.keyLearnings || [],
          missingContext: parsed.missingContext || [],
          suggestedImprovements: parsed.suggestedImprovements || [],
        };
      }
    } catch (error) {
      this.logger.warn(
        `LLM analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Return basic analysis if LLM fails
    return {
      rootCause: null,
      keyLearnings: [],
      missingContext: [],
      suggestedImprovements: [],
    };
  }

  /**
   * Store a postmortem in the database.
   */
  private async storePostmortem(
    postmortem: PostmortemAnalysis,
  ): Promise<string> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.postmortems')
      .insert({
        prediction_agent_id: postmortem.predictionAgentId,
        recommendation_id: postmortem.recommendationId,
        outcome_id: postmortem.outcomeId,
        instrument: postmortem.instrument,
        analysis_type: postmortem.analysisType,
        what_worked: postmortem.whatWorked,
        what_failed: postmortem.whatFailed,
        root_cause: postmortem.rootCause,
        specialist_performance: postmortem.specialistPerformance,
        key_learnings: postmortem.keyLearnings,
        missing_context: postmortem.missingContext,
        suggested_improvements: postmortem.suggestedImprovements,
        predicted_confidence: postmortem.predictedConfidence,
        actual_accuracy: postmortem.actualAccuracy,
        calibration_error: postmortem.calibrationError,
        applied_to_context: false,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`Failed to store postmortem: ${error.message}`);
      throw new Error(`Failed to store postmortem: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get postmortems for an agent and instrument.
   */
  async getPostmortems(
    predictionAgentId: string,
    instrument: string | null = null,
    limit: number = 10,
  ): Promise<PostmortemAnalysis[]> {
    const client = this.supabaseService.getServiceClient();

    let query = client
      .from('predictions.postmortems')
      .select('*')
      .eq('prediction_agent_id', predictionAgentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (instrument) {
      query = query.eq('instrument', instrument);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get postmortems: ${error.message}`);
      throw new Error(`Failed to get postmortems: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      predictionAgentId: row.prediction_agent_id,
      recommendationId: row.recommendation_id,
      outcomeId: row.outcome_id,
      instrument: row.instrument,
      analysisType: row.analysis_type,
      whatWorked: row.what_worked || [],
      whatFailed: row.what_failed || [],
      rootCause: row.root_cause,
      specialistPerformance: row.specialist_performance || {},
      keyLearnings: row.key_learnings || [],
      missingContext: row.missing_context || [],
      suggestedImprovements: row.suggested_improvements || [],
      predictedConfidence: row.predicted_confidence,
      actualAccuracy: row.actual_accuracy,
      calibrationError: row.calibration_error,
      appliedToContext: row.applied_to_context,
      appliedAt: row.applied_at,
    }));
  }

  /**
   * Mark a postmortem as applied to context.
   */
  async markAsApplied(postmortemId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('predictions.postmortems')
      .update({
        applied_to_context: true,
        applied_at: new Date().toISOString(),
      })
      .eq('id', postmortemId);

    if (error) {
      this.logger.error(
        `Failed to mark postmortem as applied: ${error.message}`,
      );
      throw new Error(`Failed to mark postmortem as applied: ${error.message}`);
    }

    this.logger.debug(`Marked postmortem ${postmortemId} as applied`);
  }

  /**
   * Analyze specialist accuracy across all postmortems.
   */
  async analyzeSpecialistAccuracy(
    predictionAgentId: string,
    lookbackDays: number = 30,
  ): Promise<
    Array<{
      specialist: string;
      totalAnalyses: number;
      correctCount: number;
      accuracyPercent: number;
    }>
  > {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_specialist_accuracy', {
      p_prediction_agent_id: predictionAgentId,
      p_specialist: null, // All specialists
      p_instrument: null, // All instruments
      p_lookback_days: lookbackDays,
    });

    if (error) {
      this.logger.error(
        `Failed to analyze specialist accuracy: ${error.message}`,
      );
      throw new Error(
        `Failed to analyze specialist accuracy: ${error.message}`,
      );
    }

    return data || [];
  }
}
