/**
 * Learning Context Builder Service
 *
 * Builds consolidated learning context from postmortems, missed opportunities,
 * specialist stats, and user insights. Used to enhance LLM prompts with
 * historical learning data.
 *
 * @module learning-context.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';

/**
 * Learning context for LLM prompts
 */
export interface LearningContext {
  agentId: string;
  instrument: string | null;
  lookbackDays: number;
  generatedAt: string;
  postmortems: PostmortemSummary[];
  missedOpportunities: MissedOpportunitySummary[];
  userInsights: UserInsightSummary[];
  specialistStats: SpecialistStatSummary[];
}

/**
 * Postmortem summary for context
 */
export interface PostmortemSummary {
  instrument: string;
  action: string;
  outcome: string;
  returnPercent: number | null;
  whatWorked: string[];
  whatFailed: string[];
  rootCause: string | null;
  keyLearnings: string[];
  missingContext: string[];
  createdAt: string;
}

/**
 * Missed opportunity summary for context
 */
export interface MissedOpportunitySummary {
  instrument: string;
  type: string;
  description: string;
  movePercent: number;
  failureReason: string;
  whatWouldHaveHelped: string[];
  suggestedThresholds: Record<string, number>;
  createdAt: string;
}

/**
 * User insight summary for context
 */
export interface UserInsightSummary {
  type: string;
  instrument: string | null;
  insight: string;
  structured: Record<string, unknown> | null;
  effectivenessScore: number | null;
  createdAt: string;
}

/**
 * Specialist stat summary for context
 */
export interface SpecialistStatSummary {
  specialist: string;
  instrument: string | null;
  accuracyPercent: number | null;
  avgConfidence: number | null;
  totalAnalyses: number;
  confidenceWhenCorrect: number | null;
  confidenceWhenIncorrect: number | null;
}

/**
 * Agent learning summary
 */
export interface AgentLearningSummary {
  totalRecommendations: number;
  totalOutcomes: number;
  overallAccuracyPercent: number | null;
  totalPostmortems: number;
  unappliedPostmortems: number;
  totalMissedOpportunities: number;
  unappliedMissedOpportunities: number;
  totalUserInsights: number;
  validatedInsights: number;
  unappliedInsights: number;
  activeConversations: number;
  lastLearningUpdate: string | null;
}

@Injectable()
export class LearningContextBuilderService {
  private readonly logger = new Logger(LearningContextBuilderService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Build a consolidated learning context for LLM prompts.
   *
   * @param predictionAgentId - Agent to build context for
   * @param instrument - Optional instrument filter
   * @param options - Build options
   * @returns Learning context
   */
  async buildContext(
    predictionAgentId: string,
    instrument: string | null = null,
    options: {
      maxPostmortems?: number;
      maxMissed?: number;
      maxInsights?: number;
      lookbackDays?: number;
    } = {},
  ): Promise<LearningContext> {
    const {
      maxPostmortems = 5,
      maxMissed = 3,
      maxInsights = 5,
      lookbackDays = 30,
    } = options;

    this.logger.debug(
      `Building learning context for agent ${predictionAgentId}` +
        (instrument ? ` (instrument: ${instrument})` : ''),
    );

    const client = this.supabaseService.getServiceClient();

    // Use the database function to build context
    const { data, error } = await client.rpc('build_learning_context', {
      p_prediction_agent_id: predictionAgentId,
      p_instrument: instrument,
      p_max_postmortems: maxPostmortems,
      p_max_missed: maxMissed,
      p_max_insights: maxInsights,
      p_lookback_days: lookbackDays,
    });

    if (error) {
      this.logger.error(`Failed to build learning context: ${error.message}`);
      throw new Error(`Failed to build learning context: ${error.message}`);
    }

    // Parse the JSONB result
    const context: LearningContext = {
      agentId: data.agentId,
      instrument: data.instrument,
      lookbackDays: data.lookbackDays,
      generatedAt: data.generatedAt,
      postmortems: data.postmortems || [],
      missedOpportunities: data.missedOpportunities || [],
      userInsights: data.userInsights || [],
      specialistStats: data.specialistStats || [],
    };

    this.logger.debug(
      `Built learning context: ${context.postmortems.length} postmortems, ` +
        `${context.missedOpportunities.length} missed, ${context.userInsights.length} insights`,
    );

    return context;
  }

  /**
   * Get postmortems for context.
   */
  async getPostmortems(
    predictionAgentId: string,
    instrument: string | null = null,
    limit: number = 10,
  ): Promise<PostmortemSummary[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc(
      'get_postmortems_with_instrument',
      {
        p_prediction_agent_id: predictionAgentId,
        p_instrument: instrument || '',
        p_outcome: null,
        p_limit: limit,
      },
    );

    if (error) {
      this.logger.error(`Failed to get postmortems: ${error.message}`);
      throw new Error(`Failed to get postmortems: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      instrument: row.instrument as string,
      action: row.action as string,
      outcome: row.outcome as string,
      returnPercent: row.actual_return_percent as number | null,
      whatWorked: (row.what_worked || []) as string[],
      whatFailed: (row.what_failed || []) as string[],
      rootCause: row.root_cause as string | null,
      keyLearnings: (row.key_learnings || []) as string[],
      missingContext: (row.missing_context || []) as string[],
      createdAt: row.created_at as string,
    }));
  }

  /**
   * Get missed opportunities for context.
   */
  async getMissedOpportunities(
    predictionAgentId: string,
    instrument: string | null = null,
    minMovePercent: number = 5.0,
    limit: number = 10,
  ): Promise<MissedOpportunitySummary[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_missed_opportunities', {
      p_prediction_agent_id: predictionAgentId,
      p_instrument: instrument,
      p_min_move_percent: minMovePercent,
      p_limit: limit,
    });

    if (error) {
      this.logger.error(`Failed to get missed opportunities: ${error.message}`);
      throw new Error(`Failed to get missed opportunities: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      instrument: row.instrument as string,
      type: row.missed_type as string,
      description: row.description as string,
      movePercent: row.move_percent as number,
      failureReason: row.detection_failure_reason as string,
      whatWouldHaveHelped: (row.what_would_have_helped || []) as string[],
      suggestedThresholds: (row.suggested_threshold_changes || {}) as Record<
        string,
        number
      >,
      createdAt: row.created_at as string,
    }));
  }

  /**
   * Get specialist stats for context.
   */
  async getSpecialistStats(
    predictionAgentId: string,
    specialist: string | null = null,
    instrument: string | null = null,
    lookbackDays: number = 30,
  ): Promise<SpecialistStatSummary[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_specialist_accuracy', {
      p_prediction_agent_id: predictionAgentId,
      p_specialist: specialist || '',
      p_instrument: instrument,
      p_lookback_days: lookbackDays,
    });

    if (error) {
      this.logger.error(`Failed to get specialist stats: ${error.message}`);
      throw new Error(`Failed to get specialist stats: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      specialist: row.specialist as string,
      instrument: row.instrument as string | null,
      accuracyPercent: row.accuracy_percent as number | null,
      avgConfidence: row.avg_confidence as number | null,
      totalAnalyses: row.total_analyses as number,
      confidenceWhenCorrect: row.confidence_when_correct as number | null,
      confidenceWhenIncorrect: row.confidence_when_incorrect as number | null,
    }));
  }

  /**
   * Get user insights for context.
   */
  async getUserInsights(
    predictionAgentId: string,
    instrument: string | null = null,
    validatedOnly: boolean = true,
    limit: number = 20,
  ): Promise<UserInsightSummary[]> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_user_insights', {
      p_prediction_agent_id: predictionAgentId,
      p_instrument: instrument,
      p_validated_only: validatedOnly,
      p_limit: limit,
    });

    if (error) {
      this.logger.error(`Failed to get user insights: ${error.message}`);
      throw new Error(`Failed to get user insights: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      type: row.insight_type as string,
      instrument: row.instrument as string | null,
      insight: row.insight_text as string,
      structured: row.structured_insight as Record<string, unknown> | null,
      effectivenessScore: row.effectiveness_score as number | null,
      createdAt: row.created_at as string,
    }));
  }

  /**
   * Get agent learning summary.
   */
  async getAgentLearningSummary(
    predictionAgentId: string,
  ): Promise<AgentLearningSummary> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client.rpc('get_agent_learning_summary', {
      p_prediction_agent_id: predictionAgentId,
    });

    if (error) {
      this.logger.error(`Failed to get learning summary: ${error.message}`);
      throw new Error(`Failed to get learning summary: ${error.message}`);
    }

    const row = data?.[0] || {};
    return {
      totalRecommendations: row.total_recommendations || 0,
      totalOutcomes: row.total_outcomes || 0,
      overallAccuracyPercent: row.overall_accuracy_percent,
      totalPostmortems: row.total_postmortems || 0,
      unappliedPostmortems: row.unapplied_postmortems || 0,
      totalMissedOpportunities: row.total_missed_opportunities || 0,
      unappliedMissedOpportunities: row.unapplied_missed_opportunities || 0,
      totalUserInsights: row.total_user_insights || 0,
      validatedInsights: row.validated_insights || 0,
      unappliedInsights: row.unapplied_insights || 0,
      activeConversations: row.active_conversations || 0,
      lastLearningUpdate: row.last_learning_update,
    };
  }

  /**
   * Format learning context as a prompt section for LLM.
   */
  formatContextForPrompt(context: LearningContext): string {
    const sections: string[] = [];

    // Postmortems section
    if (context.postmortems.length > 0) {
      sections.push('## Recent Learnings from Past Predictions');
      for (const pm of context.postmortems) {
        sections.push(`\n### ${pm.instrument} - ${pm.action} (${pm.outcome})`);
        if (pm.returnPercent !== null) {
          sections.push(`Return: ${pm.returnPercent.toFixed(2)}%`);
        }
        if (pm.keyLearnings.length > 0) {
          sections.push('Key learnings:');
          for (const learning of pm.keyLearnings) {
            sections.push(`- ${learning}`);
          }
        }
        if (pm.rootCause) {
          sections.push(`Root cause: ${pm.rootCause}`);
        }
      }
    }

    // Missed opportunities section
    if (context.missedOpportunities.length > 0) {
      sections.push('\n## Missed Opportunities to Learn From');
      for (const mo of context.missedOpportunities) {
        sections.push(
          `\n### ${mo.instrument} - ${mo.movePercent.toFixed(2)}% move`,
        );
        sections.push(`Reason missed: ${mo.failureReason}`);
        if (mo.whatWouldHaveHelped.length > 0) {
          sections.push('What would have helped:');
          for (const help of mo.whatWouldHaveHelped) {
            sections.push(`- ${help}`);
          }
        }
      }
    }

    // User insights section
    if (context.userInsights.length > 0) {
      sections.push('\n## User Insights');
      for (const insight of context.userInsights) {
        sections.push(`\n[${insight.type}] ${insight.insight}`);
        if (insight.effectivenessScore !== null) {
          sections.push(
            `Effectiveness: ${(insight.effectivenessScore * 100).toFixed(0)}%`,
          );
        }
      }
    }

    // Specialist stats section
    if (context.specialistStats.length > 0) {
      sections.push('\n## Specialist Performance');
      for (const stat of context.specialistStats) {
        sections.push(
          `\n${stat.specialist}: ${stat.accuracyPercent?.toFixed(1) || 'N/A'}% accuracy ` +
            `(${stat.totalAnalyses} analyses)`,
        );
        if (stat.confidenceWhenCorrect && stat.confidenceWhenIncorrect) {
          sections.push(
            `  Confidence when correct: ${(stat.confidenceWhenCorrect * 100).toFixed(0)}%, ` +
              `when incorrect: ${(stat.confidenceWhenIncorrect * 100).toFixed(0)}%`,
          );
        }
      }
    }

    return sections.join('\n');
  }
}
