/**
 * Agent Context Update Service
 *
 * Manages updates to agent context (metadata) based on learnings.
 * Handles appending, replacing, and removing context sections while
 * preserving the overall structure.
 *
 * @module agent-context-update.service
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../../../supabase/supabase.service';

/**
 * Context section types
 */
export type ContextSection =
  | 'learned_patterns'
  | 'risk_guidelines'
  | 'specialist_calibration'
  | 'threshold_adjustments'
  | 'user_preferences'
  | 'domain_knowledge'
  | 'custom';

/**
 * Context update operation
 */
export interface ContextUpdateOperation {
  section: ContextSection;
  updateType: 'append' | 'replace' | 'remove';
  content: string;
  reason: string;
  sourceType:
    | 'postmortem'
    | 'missed_opportunity'
    | 'user_insight'
    | 'conversation';
  sourceId: string | null;
}

/**
 * Agent context structure
 */
export interface AgentContext {
  description?: string;
  capabilities?: string[];
  learned_patterns?: string[];
  risk_guidelines?: string[];
  specialist_calibration?: Record<string, unknown>;
  threshold_adjustments?: Record<string, number>;
  user_preferences?: Record<string, unknown>;
  domain_knowledge?: string[];
  custom?: Record<string, unknown>;
  runnerConfig?: unknown;
  [key: string]: unknown;
}

/**
 * Context update result
 */
export interface ContextUpdateResult {
  success: boolean;
  previousValue: unknown;
  newValue: unknown;
  appliedAt: string;
  error?: string;
}

@Injectable()
export class AgentContextUpdateService {
  private readonly logger = new Logger(AgentContextUpdateService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Apply a context update to an agent.
   *
   * @param predictionAgentId - Prediction agent ID
   * @param operation - Update operation
   * @returns Update result
   */
  async appendToContext(
    predictionAgentId: string,
    operation: ContextUpdateOperation,
  ): Promise<ContextUpdateResult> {
    this.logger.debug(
      `Applying context update to agent ${predictionAgentId}: ${operation.updateType} ${operation.section}`,
    );

    try {
      // Get the linked agent slug
      const agentSlug = await this.getAgentSlug(predictionAgentId);
      if (!agentSlug) {
        throw new Error('Agent slug not found');
      }

      // Get current context
      const currentContext = await this.getAgentContext(agentSlug);
      const previousValue = currentContext[operation.section];

      // Apply the update
      const updatedContext = this.applyUpdate(currentContext, operation);

      // Save updated context
      await this.saveAgentContext(agentSlug, updatedContext);

      const result: ContextUpdateResult = {
        success: true,
        previousValue,
        newValue: updatedContext[operation.section],
        appliedAt: new Date().toISOString(),
      };

      this.logger.debug(
        `Successfully applied context update to section "${operation.section}"`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to apply context update: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        success: false,
        previousValue: null,
        newValue: null,
        appliedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse context into sections.
   */
  parseContextSections(context: AgentContext): Map<string, unknown> {
    const sections = new Map<string, unknown>();

    for (const [key, value] of Object.entries(context)) {
      if (key !== 'runnerConfig') {
        sections.set(key, value);
      }
    }

    return sections;
  }

  /**
   * Reconstruct context from sections.
   */
  reconstructContext(
    sections: Map<string, unknown>,
    runnerConfig: unknown,
  ): AgentContext {
    const context: AgentContext = {};

    for (const [key, value] of sections) {
      context[key] = value;
    }

    if (runnerConfig) {
      context.runnerConfig = runnerConfig;
    }

    return context;
  }

  /**
   * Get agent context by slug.
   */
  private async getAgentContext(agentSlug: string): Promise<AgentContext> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('agents')
      .select('metadata')
      .eq('slug', agentSlug)
      .single();

    if (error) {
      throw new Error(`Failed to get agent context: ${error.message}`);
    }

    return (data?.metadata || {}) as AgentContext;
  }

  /**
   * Save agent context.
   */
  private async saveAgentContext(
    agentSlug: string,
    context: AgentContext,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from('agents')
      .update({ metadata: context })
      .eq('slug', agentSlug);

    if (error) {
      throw new Error(`Failed to save agent context: ${error.message}`);
    }
  }

  /**
   * Get agent slug from prediction agent ID.
   */
  private async getAgentSlug(
    predictionAgentId: string,
  ): Promise<string | null> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = await client
      .from('predictions.prediction_agents')
      .select('agent_slug')
      .eq('id', predictionAgentId)
      .single();

    if (error) {
      this.logger.error(`Failed to get agent slug: ${error.message}`);
      return null;
    }

    return data?.agent_slug || null;
  }

  /**
   * Apply an update operation to the context.
   */
  private applyUpdate(
    context: AgentContext,
    operation: ContextUpdateOperation,
  ): AgentContext {
    const updated = { ...context };
    const section = operation.section as keyof AgentContext;

    switch (operation.updateType) {
      case 'append':
        updated[section] = this.appendToSection(
          context[section],
          operation.content,
        );
        break;

      case 'replace':
        updated[section] = this.parseContent(operation.content);
        break;

      case 'remove':
        if (Array.isArray(context[section])) {
          updated[section] = (context[section] as unknown[]).filter(
            (item) => String(item) !== operation.content,
          );
        } else {
          delete updated[section];
        }
        break;
    }

    return updated;
  }

  /**
   * Append content to a section.
   */
  private appendToSection(current: unknown, content: string): unknown {
    // If section is an array, append to it
    if (Array.isArray(current)) {
      return [...current, content];
    }

    // If section is a string, concatenate
    if (typeof current === 'string') {
      return current + '\n' + content;
    }

    // If section doesn't exist, create it as an array with single item
    if (current === undefined || current === null) {
      return [content];
    }

    // If section is an object, try to parse content as object and merge
    if (typeof current === 'object') {
      try {
        const parsed = JSON.parse(content);
        return { ...current, ...parsed };
      } catch {
        // If content isn't valid JSON, convert section to array
        return [content];
      }
    }

    // Default: create array
    return [content];
  }

  /**
   * Parse content string into appropriate type.
   */
  private parseContent(content: string): unknown {
    // Try to parse as JSON
    try {
      return JSON.parse(content);
    } catch {
      // If not JSON, return as string
      return content;
    }
  }

  /**
   * Apply a batch of updates from postmortems.
   *
   * @param predictionAgentId - Prediction agent ID
   * @param postmortemIds - IDs of postmortems to apply
   * @returns Results of each update
   */
  async applyPostmortemLearnings(
    predictionAgentId: string,
    postmortemIds: string[],
  ): Promise<ContextUpdateResult[]> {
    const client = this.supabaseService.getServiceClient();
    const results: ContextUpdateResult[] = [];

    for (const postmortemId of postmortemIds) {
      // Get postmortem
      const { data: postmortem } = await client
        .from('predictions.postmortems')
        .select('*')
        .eq('id', postmortemId)
        .single();

      if (!postmortem) continue;

      // Apply key learnings to learned_patterns section
      if (postmortem.key_learnings && postmortem.key_learnings.length > 0) {
        for (const learning of postmortem.key_learnings) {
          const result = await this.appendToContext(predictionAgentId, {
            section: 'learned_patterns',
            updateType: 'append',
            content: `[${postmortem.instrument}] ${learning}`,
            reason: `From postmortem of ${postmortem.instrument} recommendation`,
            sourceType: 'postmortem',
            sourceId: postmortemId,
          });
          results.push(result);
        }
      }

      // Mark postmortem as applied
      await client
        .from('predictions.postmortems')
        .update({
          applied_to_context: true,
          applied_at: new Date().toISOString(),
        })
        .eq('id', postmortemId);
    }

    return results;
  }

  /**
   * Apply threshold adjustments from missed opportunities.
   *
   * @param predictionAgentId - Prediction agent ID
   * @param missedOpportunityIds - IDs of missed opportunities
   * @returns Results of each update
   */
  async applyMissedOpportunityThresholds(
    predictionAgentId: string,
    missedOpportunityIds: string[],
  ): Promise<ContextUpdateResult[]> {
    const client = this.supabaseService.getServiceClient();
    const results: ContextUpdateResult[] = [];

    for (const opportunityId of missedOpportunityIds) {
      // Get missed opportunity
      const { data: missed } = await client
        .from('predictions.missed_opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

      if (!missed || !missed.suggested_threshold_changes) continue;

      // Apply threshold adjustments
      const thresholdUpdates = missed.suggested_threshold_changes as Record<
        string,
        number
      >;

      if (Object.keys(thresholdUpdates).length > 0) {
        const result = await this.appendToContext(predictionAgentId, {
          section: 'threshold_adjustments',
          updateType: 'append',
          content: JSON.stringify(thresholdUpdates),
          reason: `From missed ${missed.move_percent?.toFixed(1)}% move on ${missed.instrument}`,
          sourceType: 'missed_opportunity',
          sourceId: opportunityId,
        });
        results.push(result);
      }

      // Mark as applied
      await client
        .from('predictions.missed_opportunities')
        .update({
          applied_to_context: true,
          applied_at: new Date().toISOString(),
        })
        .eq('id', opportunityId);
    }

    return results;
  }

  /**
   * Apply user insights to context.
   *
   * @param predictionAgentId - Prediction agent ID
   * @param insightIds - IDs of insights to apply
   * @returns Results of each update
   */
  async applyUserInsights(
    predictionAgentId: string,
    insightIds: string[],
  ): Promise<ContextUpdateResult[]> {
    const client = this.supabaseService.getServiceClient();
    const results: ContextUpdateResult[] = [];

    for (const insightId of insightIds) {
      // Get insight
      const { data: insight } = await client
        .from('predictions.user_insights')
        .select('*')
        .eq('id', insightId)
        .single();

      if (!insight) continue;

      // Determine target section based on insight type
      let section: ContextSection = 'custom';
      switch (insight.insight_type) {
        case 'domain_knowledge':
          section = 'domain_knowledge';
          break;
        case 'threshold_suggestion':
          section = 'threshold_adjustments';
          break;
        case 'specialist_feedback':
          section = 'specialist_calibration';
          break;
        default:
          section = 'user_preferences';
      }

      const content = insight.structured_insight
        ? JSON.stringify(insight.structured_insight)
        : insight.insight_text;

      const result = await this.appendToContext(predictionAgentId, {
        section,
        updateType: 'append',
        content,
        reason: `User insight: ${insight.insight_type}`,
        sourceType: 'user_insight',
        sourceId: insightId,
      });
      results.push(result);

      // Mark as applied
      await client
        .from('predictions.user_insights')
        .update({
          applied_to_context: true,
          applied_at: new Date().toISOString(),
          applied_context_section: section,
        })
        .eq('id', insightId);
    }

    return results;
  }

  /**
   * Get all unapplied learnings for an agent.
   */
  async getUnappliedLearnings(predictionAgentId: string): Promise<{
    postmortems: string[];
    missedOpportunities: string[];
    userInsights: string[];
  }> {
    const client = this.supabaseService.getServiceClient();

    // Get unapplied postmortems
    const { data: postmortems } = await client
      .from('predictions.postmortems')
      .select('id')
      .eq('prediction_agent_id', predictionAgentId)
      .eq('applied_to_context', false);

    // Get unapplied missed opportunities
    const { data: missed } = await client
      .from('predictions.missed_opportunities')
      .select('id')
      .eq('prediction_agent_id', predictionAgentId)
      .eq('applied_to_context', false);

    // Get unapplied user insights (validated only)
    const { data: insights } = await client
      .from('predictions.user_insights')
      .select('id')
      .eq('prediction_agent_id', predictionAgentId)
      .eq('validated', true)
      .eq('applied_to_context', false);

    return {
      postmortems: (postmortems || []).map((p) => p.id),
      missedOpportunities: (missed || []).map((m) => m.id),
      userInsights: (insights || []).map((i) => i.id),
    };
  }

  /**
   * Apply all unapplied learnings for an agent.
   */
  async applyAllUnappliedLearnings(predictionAgentId: string): Promise<{
    postmortemResults: ContextUpdateResult[];
    missedOpportunityResults: ContextUpdateResult[];
    userInsightResults: ContextUpdateResult[];
  }> {
    const unapplied = await this.getUnappliedLearnings(predictionAgentId);

    const postmortemResults = await this.applyPostmortemLearnings(
      predictionAgentId,
      unapplied.postmortems,
    );

    const missedOpportunityResults =
      await this.applyMissedOpportunityThresholds(
        predictionAgentId,
        unapplied.missedOpportunities,
      );

    const userInsightResults = await this.applyUserInsights(
      predictionAgentId,
      unapplied.userInsights,
    );

    this.logger.debug(
      `Applied ${postmortemResults.length} postmortem learnings, ` +
        `${missedOpportunityResults.length} threshold adjustments, ` +
        `${userInsightResults.length} user insights`,
    );

    return {
      postmortemResults,
      missedOpportunityResults,
      userInsightResults,
    };
  }
}
