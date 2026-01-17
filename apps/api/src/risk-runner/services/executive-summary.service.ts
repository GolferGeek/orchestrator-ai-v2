/**
 * Executive Summary Service
 *
 * Generates AI-powered executive summaries for portfolio risk reporting.
 * Uses portfolio aggregate data and key risk indicators to produce
 * concise, actionable insights for stakeholders.
 */

import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '@/llms/llm.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

export interface ExecutiveSummaryContent {
  headline: string;
  status: 'critical' | 'high' | 'medium' | 'low' | 'stable';
  keyFindings: string[];
  recommendations: string[];
  riskHighlights: {
    topRisks: Array<{ subject: string; score: number; dimension: string }>;
    recentChanges: Array<{ subject: string; change: number; direction: 'up' | 'down' }>;
  };
}

export interface ExecutiveSummary {
  id: string;
  scope_id: string;
  summary_type: string;
  content: ExecutiveSummaryContent;
  risk_snapshot: Record<string, unknown>;
  generated_by: string;
  generated_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateSummaryInput {
  scopeId: string;
  summaryType?: 'daily' | 'weekly' | 'ad-hoc';
  context: ExecutionContext;
}

export interface GenerateSummaryResult {
  summary: ExecutiveSummary;
  cached: boolean;
}

@Injectable()
export class ExecutiveSummaryService {
  private readonly logger = new Logger(ExecutiveSummaryService.name);
  private readonly schema = 'risk';

  constructor(
    private readonly llmService: LLMService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Generate an executive summary for a scope
   *
   * If a recent summary exists (less than 1 hour old), returns cached version.
   * Otherwise generates a new summary using LLM.
   */
  async generateSummary(input: GenerateSummaryInput): Promise<GenerateSummaryResult> {
    const { scopeId, summaryType = 'ad-hoc', context } = input;

    this.logger.log(`Generating executive summary for scope ${scopeId}, type: ${summaryType}`);

    // Check for cached summary (less than 1 hour old for ad-hoc, or matching type for scheduled)
    const cached = await this.findCachedSummary(scopeId, summaryType);
    if (cached) {
      this.logger.debug('Returning cached executive summary');
      return { summary: cached, cached: true };
    }

    // Gather risk data for the summary
    const riskData = await this.gatherRiskData(scopeId);

    // Generate summary using LLM
    const content = await this.generateSummaryContent(riskData, context);

    // Save to database
    const summary = await this.saveSummary({
      scopeId,
      summaryType,
      content,
      riskSnapshot: riskData,
      generatedBy: context.model,
    });

    return { summary, cached: false };
  }

  /**
   * Get the latest summary for a scope
   */
  async getLatestSummary(scopeId: string): Promise<ExecutiveSummary | null> {
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('executive_summaries')
      .select('*')
      .eq('scope_id', scopeId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to get latest summary: ${error.message}`);
      throw error;
    }

    return data as ExecutiveSummary | null;
  }

  /**
   * List summaries for a scope
   */
  async listSummaries(
    scopeId: string,
    options?: { limit?: number; summaryType?: string },
  ): Promise<ExecutiveSummary[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from('executive_summaries')
      .select('*')
      .eq('scope_id', scopeId)
      .order('generated_at', { ascending: false });

    if (options?.summaryType) {
      query = query.eq('summary_type', options.summaryType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to list summaries: ${error.message}`);
      throw error;
    }

    return (data || []) as ExecutiveSummary[];
  }

  /**
   * Find a cached summary if available
   */
  private async findCachedSummary(
    scopeId: string,
    summaryType: string,
  ): Promise<ExecutiveSummary | null> {
    // For ad-hoc summaries, check if there's one less than 1 hour old
    // For scheduled summaries, check for the same type from today
    const cacheWindow = summaryType === 'ad-hoc'
      ? new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour
      : new Date(new Date().setHours(0, 0, 0, 0)).toISOString(); // Today

    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('executive_summaries')
      .select('*')
      .eq('scope_id', scopeId)
      .eq('summary_type', summaryType)
      .gte('generated_at', cacheWindow)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to find cached summary: ${error.message}`);
    }

    return data as ExecutiveSummary | null;
  }

  /**
   * Gather all risk data needed for summary generation
   */
  private async gatherRiskData(scopeId: string): Promise<Record<string, unknown>> {
    const [portfolioAggregate, topRisks, recentChanges, riskDistribution] = await Promise.all([
      this.getPortfolioAggregate(scopeId),
      this.getTopRisks(scopeId),
      this.getRecentChanges(scopeId),
      this.getRiskDistribution(scopeId),
    ]);

    return {
      portfolioAggregate,
      topRisks,
      recentChanges,
      riskDistribution,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get portfolio aggregate stats
   */
  private async getPortfolioAggregate(scopeId: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('portfolio_aggregate')
      .select('*')
      .eq('scope_id', scopeId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.warn(`Failed to get portfolio aggregate: ${error.message}`);
    }

    return data || {};
  }

  /**
   * Get top risk subjects
   */
  private async getTopRisks(scopeId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('composite_scores')
      .select(`
        id,
        subject_id,
        overall_score,
        dimension_scores,
        subjects!inner(id, name, identifier)
      `)
      .eq('subjects.scope_id', scopeId)
      .eq('status', 'active')
      .eq('is_test', false)
      .order('overall_score', { ascending: false })
      .limit(5);

    if (error) {
      this.logger.warn(`Failed to get top risks: ${error.message}`);
      return [];
    }

    return (data || []).map((row: any) => ({
      subjectId: row.subject_id,
      subjectName: row.subjects?.name || 'Unknown',
      overallScore: row.overall_score,
      dimensionScores: row.dimension_scores,
    }));
  }

  /**
   * Get recent score changes
   */
  private async getRecentChanges(scopeId: string): Promise<Array<Record<string, unknown>>> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('score_history')
      .select(`
        subject_id,
        overall_score,
        previous_score,
        score_change,
        created_at
      `)
      .gte('created_at', sevenDaysAgo)
      .not('score_change', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      this.logger.warn(`Failed to get recent changes: ${error.message}`);
      return [];
    }

    return (data || []).map((row: any) => ({
      subjectId: row.subject_id,
      currentScore: row.overall_score,
      previousScore: row.previous_score,
      change: row.score_change,
      direction: row.score_change > 0 ? 'up' : 'down',
      changedAt: row.created_at,
    }));
  }

  /**
   * Get risk distribution
   */
  private async getRiskDistribution(scopeId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('risk_distribution')
      .select('*')
      .eq('scope_id', scopeId);

    if (error) {
      this.logger.warn(`Failed to get risk distribution: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Generate summary content using LLM
   */
  private async generateSummaryContent(
    riskData: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<ExecutiveSummaryContent> {
    const systemPrompt = `You are a senior risk analyst generating executive summaries for portfolio risk reports.
Your summaries should be:
- Concise and actionable
- Free of jargon (explain technical terms)
- Focused on key findings and recommendations
- Balanced between highlighting concerns and providing context

Always respond with valid JSON in the exact format specified.`;

    const aggregate = riskData.portfolioAggregate as any || {};
    const topRisks = riskData.topRisks as any[] || [];
    const recentChanges = riskData.recentChanges as any[] || [];
    const distribution = riskData.riskDistribution as any[] || [];

    const avgScore = aggregate.avg_score ?? 0;
    const criticalCount = aggregate.critical_count ?? 0;
    const highCount = aggregate.high_count ?? 0;
    const subjectCount = aggregate.subject_count ?? 0;

    const userPrompt = `Based on the following portfolio risk data, generate an executive summary:

## Portfolio Overview
- Total Subjects: ${subjectCount}
- Average Risk Score: ${(avgScore * 100).toFixed(1)}%
- Critical Risk Count: ${criticalCount}
- High Risk Count: ${highCount}
- Score Standard Deviation: ${((aggregate.score_stddev ?? 0) * 100).toFixed(1)}%

## Risk Distribution
${distribution.map((d: any) => `- ${d.risk_level}: ${d.count} (${d.percentage?.toFixed(1) || 0}%)`).join('\n') || 'No distribution data available'}

## Top Risks (Highest Scores)
${topRisks.slice(0, 5).map((r: any, i: number) => `${i + 1}. ${r.subjectName}: ${(r.overallScore * 100).toFixed(1)}%`).join('\n') || 'No top risk data available'}

## Recent Changes (Past 7 Days)
${recentChanges.slice(0, 5).map((c: any) => `- Subject ${c.subjectId}: ${c.direction === 'up' ? '↑' : '↓'} ${Math.abs(c.change * 100).toFixed(1)}%`).join('\n') || 'No recent changes'}

Please generate a JSON response with exactly this structure:
{
  "headline": "A single sentence (max 100 chars) summarizing the overall risk status",
  "status": "critical|high|medium|low|stable",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3", "Finding 4", "Finding 5"],
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "riskHighlights": {
    "topRisks": [{"subject": "Name", "score": 0.75, "dimension": "Primary Risk Dimension"}],
    "recentChanges": [{"subject": "Name", "change": 0.05, "direction": "up|down"}]
  }
}

Guidelines:
- headline: Must be under 100 characters, capture the essence of current risk state
- status: Choose based on avgScore: >=70%=critical, >=50%=high, >=30%=medium, >=10%=low, <10%=stable
- keyFindings: 3-5 bullet points highlighting the most important observations
- recommendations: 2-3 actionable next steps prioritized by impact
- riskHighlights: Include top 3 risks and up to 3 recent significant changes`;

    const response = await this.llmService.generateResponse(
      systemPrompt,
      userPrompt,
      {
        executionContext: context,
        callerType: 'api',
        callerName: 'executive-summary-generator',
      },
    );

    const responseText = typeof response === 'string' ? response : response.content;
    return this.parseSummaryResponse(responseText, avgScore, topRisks, recentChanges);
  }

  /**
   * Parse LLM response into structured content
   */
  private parseSummaryResponse(
    response: string,
    avgScore: number,
    topRisks: any[],
    recentChanges: any[],
  ): ExecutiveSummaryContent {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and fill defaults
      return {
        headline: parsed.headline?.slice(0, 100) || 'Risk summary unavailable',
        status: this.validateStatus(parsed.status, avgScore),
        keyFindings: Array.isArray(parsed.keyFindings)
          ? parsed.keyFindings.slice(0, 5)
          : ['Summary generation encountered issues'],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.slice(0, 3)
          : ['Review risk data manually'],
        riskHighlights: {
          topRisks: Array.isArray(parsed.riskHighlights?.topRisks)
            ? parsed.riskHighlights.topRisks.slice(0, 3)
            : topRisks.slice(0, 3).map((r: any) => ({
                subject: r.subjectName,
                score: r.overallScore,
                dimension: 'Overall',
              })),
          recentChanges: Array.isArray(parsed.riskHighlights?.recentChanges)
            ? parsed.riskHighlights.recentChanges.slice(0, 3)
            : recentChanges.slice(0, 3).map((c: any) => ({
                subject: c.subjectId,
                change: c.change,
                direction: c.direction,
              })),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse LLM response, using fallback: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Return fallback content
      return this.buildFallbackContent(avgScore, topRisks, recentChanges);
    }
  }

  /**
   * Validate status or derive from score
   */
  private validateStatus(
    status: string | undefined,
    avgScore: number,
  ): ExecutiveSummaryContent['status'] {
    const validStatuses = ['critical', 'high', 'medium', 'low', 'stable'];
    if (status && validStatuses.includes(status)) {
      return status as ExecutiveSummaryContent['status'];
    }

    // Derive from average score
    if (avgScore >= 0.7) return 'critical';
    if (avgScore >= 0.5) return 'high';
    if (avgScore >= 0.3) return 'medium';
    if (avgScore >= 0.1) return 'low';
    return 'stable';
  }

  /**
   * Build fallback content when LLM parsing fails
   */
  private buildFallbackContent(
    avgScore: number,
    topRisks: any[],
    recentChanges: any[],
  ): ExecutiveSummaryContent {
    const status = this.validateStatus(undefined, avgScore);

    return {
      headline: `Portfolio risk at ${(avgScore * 100).toFixed(0)}% - ${status.toUpperCase()} status`,
      status,
      keyFindings: [
        `Average portfolio risk score: ${(avgScore * 100).toFixed(1)}%`,
        topRisks.length > 0
          ? `Highest risk: ${topRisks[0]?.subjectName} at ${(topRisks[0]?.overallScore * 100).toFixed(1)}%`
          : 'No high-risk subjects identified',
        recentChanges.length > 0
          ? `${recentChanges.length} score changes in the past 7 days`
          : 'No recent score changes detected',
      ],
      recommendations: [
        'Review detailed risk breakdown for actionable insights',
        'Monitor high-risk subjects closely',
      ],
      riskHighlights: {
        topRisks: topRisks.slice(0, 3).map((r: any) => ({
          subject: r.subjectName,
          score: r.overallScore,
          dimension: 'Overall',
        })),
        recentChanges: recentChanges.slice(0, 3).map((c: any) => ({
          subject: c.subjectId,
          change: c.change,
          direction: c.direction as 'up' | 'down',
        })),
      },
    };
  }

  /**
   * Save summary to database
   */
  private async saveSummary(params: {
    scopeId: string;
    summaryType: string;
    content: ExecutiveSummaryContent;
    riskSnapshot: Record<string, unknown>;
    generatedBy: string;
  }): Promise<ExecutiveSummary> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from('executive_summaries')
      .insert({
        scope_id: params.scopeId,
        summary_type: params.summaryType,
        content: params.content,
        risk_snapshot: params.riskSnapshot,
        generated_by: params.generatedBy,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to save summary: ${error.message}`);
      throw error;
    }

    return data as ExecutiveSummary;
  }
}
