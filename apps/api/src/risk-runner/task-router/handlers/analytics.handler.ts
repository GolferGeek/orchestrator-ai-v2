/**
 * Analytics Handler
 *
 * Dashboard handler for advanced risk analytics features:
 * - Score history (Feature 1)
 * - Subject comparison (Feature 2)
 * - Heatmap data (Feature 4)
 * - Portfolio aggregate (Feature 6)
 * - Correlation analysis (Feature 7)
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import type { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  IDashboardHandler,
  DashboardActionResult,
  buildDashboardSuccess,
  buildDashboardError,
} from '../dashboard-handler.interface';
import { SupabaseService } from '@/supabase/supabase.service';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { DimensionRepository } from '../../repositories/dimension.repository';
import { SubjectRepository } from '../../repositories/subject.repository';

@Injectable()
export class AnalyticsHandler implements IDashboardHandler {
  private readonly logger = new Logger(AnalyticsHandler.name);
  private readonly schema = 'risk';
  private readonly supportedActions = [
    'score-history',
    'score-trends',
    'scope-score-history',
    'heatmap',
    'portfolio-aggregate',
    'risk-distribution',
    'dimension-contributions',
    'correlations',
    'compare-subjects',
    'save-comparison',
    'list-comparisons',
    'delete-comparison',
  ];

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly compositeScoreRepository: CompositeScoreRepository,
    private readonly dimensionRepository: DimensionRepository,
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async execute(
    action: string,
    payload: DashboardRequestPayload,
    _context: ExecutionContext,
  ): Promise<DashboardActionResult> {
    this.logger.debug(`Executing analytics action: ${action}`);

    switch (action.toLowerCase()) {
      case 'score-history':
        return this.handleScoreHistory(payload);
      case 'score-trends':
        return this.handleScoreTrends(payload);
      case 'scope-score-history':
        return this.handleScopeScoreHistory(payload);
      case 'heatmap':
        return this.handleHeatmap(payload);
      case 'portfolio-aggregate':
        return this.handlePortfolioAggregate(payload);
      case 'risk-distribution':
        return this.handleRiskDistribution(payload);
      case 'dimension-contributions':
        return this.handleDimensionContributions(payload);
      case 'correlations':
        return this.handleCorrelations(payload);
      case 'compare-subjects':
        return this.handleCompareSubjects(payload);
      case 'save-comparison':
        return this.handleSaveComparison(payload);
      case 'list-comparisons':
        return this.handleListComparisons(payload);
      case 'delete-comparison':
        return this.handleDeleteComparison(payload);
      default:
        return buildDashboardError(
          'UNSUPPORTED_ACTION',
          `Unsupported analytics action: ${action}`,
          { supportedActions: this.supportedActions },
        );
    }
  }

  getSupportedActions(): string[] {
    return this.supportedActions;
  }

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Get score history for a subject
   * Action: analytics.score-history
   * Params: { subjectId: string, days?: number, limit?: number }
   */
  private async handleScoreHistory(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectId = params?.subjectId as string | undefined;
    const days = (params?.days as number) ?? 30;
    const limit = (params?.limit as number) ?? 100;

    if (!subjectId) {
      return buildDashboardError(
        'MISSING_SUBJECT_ID',
        'Subject ID is required for score history',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .rpc('get_score_history', {
          p_subject_id: subjectId,
          p_days: days,
          p_limit: limit,
        });

      if (error) {
        this.logger.error(`Failed to get score history: ${error.message}`);
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform to frontend format
      const history = (data || []).map((row: any) => ({
        id: row.id,
        overallScore: row.overall_score,
        dimensionScores: row.dimension_scores,
        confidence: row.confidence,
        previousScore: row.previous_score,
        scoreChange: row.score_change,
        scoreChangePercent: row.score_change_percent,
        debateAdjustment: row.debate_adjustment,
        createdAt: row.created_at,
      }));

      return buildDashboardSuccess(history, {
        subjectId,
        days,
        count: history.length,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get score history: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SCORE_HISTORY_FAILED',
        error instanceof Error ? error.message : 'Failed to get score history',
      );
    }
  }

  /**
   * Get score trends for all subjects in a scope
   * Action: analytics.score-trends
   * Params: { scopeId: string }
   */
  private async handleScoreTrends(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for score trends',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('score_trends')
        .select(
          `
          subject_id,
          current_score,
          change_7d,
          change_30d,
          total_assessments,
          avg_score,
          max_score,
          min_score,
          score_stddev,
          first_assessment,
          latest_assessment
        `,
        )
        .eq('subject_id', scopeId);

      if (error) {
        this.logger.error(`Failed to get score trends: ${error.message}`);
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform to frontend format
      const trends = (data || []).map((row: any) => ({
        subjectId: row.subject_id,
        currentScore: row.current_score,
        change7d: row.change_7d,
        change30d: row.change_30d,
        totalAssessments: row.total_assessments,
        avgScore: row.avg_score,
        maxScore: row.max_score,
        minScore: row.min_score,
        scoreStddev: row.score_stddev,
        firstAssessment: row.first_assessment,
        latestAssessment: row.latest_assessment,
      }));

      return buildDashboardSuccess(trends, { scopeId, count: trends.length });
    } catch (error) {
      this.logger.error(
        `Failed to get score trends: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SCORE_TRENDS_FAILED',
        error instanceof Error ? error.message : 'Failed to get score trends',
      );
    }
  }

  /**
   * Get score history for all subjects in a scope
   * Action: analytics.scope-score-history
   * Params: { scopeId: string, days?: number }
   */
  private async handleScopeScoreHistory(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;
    const days = (params?.days as number) ?? 30;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for scope score history',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .rpc('get_scope_score_history', {
          p_scope_id: scopeId,
          p_days: days,
        });

      if (error) {
        this.logger.error(
          `Failed to get scope score history: ${error.message}`,
        );
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform to frontend format
      const history = (data || []).map((row: any) => ({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        subjectIdentifier: row.subject_identifier,
        scores: row.scores || [],
      }));

      return buildDashboardSuccess(history, { scopeId, days });
    } catch (error) {
      this.logger.error(
        `Failed to get scope score history: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SCOPE_HISTORY_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get scope score history',
      );
    }
  }

  /**
   * Get heatmap data for a scope
   * Action: analytics.heatmap
   * Params: { scopeId: string, riskLevel?: string }
   */
  private async handleHeatmap(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;
    const riskLevel = params?.riskLevel as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for heatmap',
      );
    }

    try {
      // Get dimensions for the scope
      const dimensions = await this.dimensionRepository.findByScope(scopeId);

      // Get heatmap data
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .rpc('get_heatmap_data', {
          p_scope_id: scopeId,
          p_risk_level: riskLevel || null,
        });

      if (error) {
        this.logger.error(`Failed to get heatmap data: ${error.message}`);
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Get scope info
      const { data: scopeData } = await this.getClient()
        .schema(this.schema)
        .from('scopes')
        .select('id, name')
        .eq('id', scopeId)
        .single();

      // Transform to frontend format
      const rows = (data || []).map((row: any) => ({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        subjectIdentifier: row.subject_identifier,
        subjectType: row.subject_type,
        dimensions: row.dimensions || [],
      }));

      return buildDashboardSuccess(
        {
          rows,
          dimensions: dimensions.map((d) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
            displayName: d.display_name,
            icon: d.icon,
            color: d.color,
            displayOrder: d.display_order,
          })),
          scopeId,
          scopeName: scopeData?.name || '',
        },
        {
          subjectCount: rows.length,
          dimensionCount: dimensions.length,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get heatmap: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'HEATMAP_FAILED',
        error instanceof Error ? error.message : 'Failed to get heatmap',
      );
    }
  }

  /**
   * Get portfolio aggregate statistics
   * Action: analytics.portfolio-aggregate
   * Params: { scopeId: string }
   */
  private async handlePortfolioAggregate(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for portfolio aggregate',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('portfolio_aggregate')
        .select('*')
        .eq('scope_id', scopeId)
        .single();

      if (error && error.code !== 'PGRST116') {
        this.logger.error(
          `Failed to get portfolio aggregate: ${error.message}`,
        );
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      if (!data) {
        return buildDashboardSuccess({
          scopeId,
          scopeName: '',
          domain: '',
          subjectCount: 0,
          avgScore: 0,
          maxScore: 0,
          minScore: 0,
          scoreStddev: 0,
          avgConfidence: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          latestAssessment: null,
          oldestAssessment: null,
        });
      }

      // Transform to frontend format
      return buildDashboardSuccess({
        scopeId: data.scope_id,
        scopeName: data.scope_name,
        domain: data.domain,
        subjectCount: data.subject_count,
        avgScore: data.avg_score,
        maxScore: data.max_score,
        minScore: data.min_score,
        scoreStddev: data.score_stddev,
        avgConfidence: data.avg_confidence,
        criticalCount: data.critical_count,
        highCount: data.high_count,
        mediumCount: data.medium_count,
        lowCount: data.low_count,
        latestAssessment: data.latest_assessment,
        oldestAssessment: data.oldest_assessment,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get portfolio aggregate: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'AGGREGATE_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get portfolio aggregate',
      );
    }
  }

  /**
   * Get risk distribution for a scope
   * Action: analytics.risk-distribution
   * Params: { scopeId: string }
   */
  private async handleRiskDistribution(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for risk distribution',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('risk_distribution')
        .select('*')
        .eq('scope_id', scopeId);

      if (error) {
        this.logger.error(`Failed to get risk distribution: ${error.message}`);
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform to frontend format with proper order
      const orderMap = { critical: 0, high: 1, medium: 2, low: 3 };
      const distribution = (data || [])
        .map((row: any) => ({
          riskLevel: row.risk_level,
          color: row.color,
          count: row.count,
          percentage: row.percentage,
        }))
        .sort(
          (a: any, b: any) =>
            (orderMap[a.riskLevel as keyof typeof orderMap] || 0) -
            (orderMap[b.riskLevel as keyof typeof orderMap] || 0),
        );

      return buildDashboardSuccess(distribution, { scopeId });
    } catch (error) {
      this.logger.error(
        `Failed to get risk distribution: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DISTRIBUTION_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get risk distribution',
      );
    }
  }

  /**
   * Get dimension contributions to overall risk
   * Action: analytics.dimension-contributions
   * Params: { scopeId: string }
   */
  private async handleDimensionContributions(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for dimension contributions',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('dimension_contribution')
        .select('*')
        .eq('scope_id', scopeId);

      if (error) {
        this.logger.error(
          `Failed to get dimension contributions: ${error.message}`,
        );
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform to frontend format
      const contributions = (data || []).map((row: any) => ({
        dimensionId: row.dimension_id,
        dimensionSlug: row.dimension_slug,
        dimensionName: row.dimension_name,
        icon: row.dimension_icon,
        color: row.dimension_color,
        weight: row.weight,
        assessmentCount: row.assessment_count,
        avgScore: row.avg_score,
        avgConfidence: row.avg_confidence,
        maxScore: row.max_score,
        minScore: row.min_score,
        weightedContribution: row.weighted_contribution,
      }));

      return buildDashboardSuccess(contributions, {
        scopeId,
        count: contributions.length,
      });
    } catch (error) {
      this.logger.error(
        `Failed to get dimension contributions: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CONTRIBUTIONS_FAILED',
        error instanceof Error
          ? error.message
          : 'Failed to get dimension contributions',
      );
    }
  }

  /**
   * Get correlation matrix for dimensions
   * Action: analytics.correlations
   * Params: { scopeId: string }
   */
  private async handleCorrelations(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required for correlations',
      );
    }

    try {
      // Get dimensions
      const dimensions = await this.dimensionRepository.findByScope(scopeId);

      // Calculate correlations
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .rpc('calculate_correlations', { p_scope_id: scopeId });

      if (error) {
        this.logger.error(`Failed to calculate correlations: ${error.message}`);
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      // Transform correlations
      const correlations = (data || []).map((row: any) => ({
        dimension1Id: row.dimension1_id,
        dimension1Slug: row.dimension1_slug,
        dimension1Name: row.dimension1_name,
        dimension2Id: row.dimension2_id,
        dimension2Slug: row.dimension2_slug,
        dimension2Name: row.dimension2_name,
        correlation: row.correlation,
        sampleSize: row.sample_size,
      }));

      // Build 2D matrix
      const dimSlugs = dimensions.map((d) => d.slug);
      const matrix: number[][] = dimSlugs.map(() =>
        dimSlugs.map(() => 0),
      );

      // Fill diagonal with 1s
      for (let i = 0; i < dimSlugs.length; i++) {
        const row = matrix[i];
        if (row) {
          row[i] = 1;
        }
      }

      // Fill in correlation values
      for (const corr of correlations) {
        const i = dimSlugs.indexOf(corr.dimension1Slug);
        const j = dimSlugs.indexOf(corr.dimension2Slug);
        if (i >= 0 && j >= 0) {
          const rowI = matrix[i];
          const rowJ = matrix[j];
          if (rowI) rowI[j] = corr.correlation;
          if (rowJ) rowJ[i] = corr.correlation;
        }
      }

      return buildDashboardSuccess(
        {
          dimensions: dimensions.map((d) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
            displayName: d.display_name,
            icon: d.icon,
            color: d.color,
          })),
          correlations,
          matrix,
        },
        { scopeId, dimensionCount: dimensions.length },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get correlations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'CORRELATIONS_FAILED',
        error instanceof Error ? error.message : 'Failed to get correlations',
      );
    }
  }

  /**
   * Compare multiple subjects
   * Action: analytics.compare-subjects
   * Params: { subjectIds: string[] }
   */
  private async handleCompareSubjects(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const subjectIds = params?.subjectIds as string[] | undefined;

    if (!subjectIds || subjectIds.length < 2) {
      return buildDashboardError(
        'INSUFFICIENT_SUBJECTS',
        'At least 2 subject IDs are required for comparison',
      );
    }

    if (subjectIds.length > 6) {
      return buildDashboardError(
        'TOO_MANY_SUBJECTS',
        'Maximum 6 subjects can be compared at once',
      );
    }

    try {
      // Get subjects
      const subjects = await Promise.all(
        subjectIds.map((id) => this.subjectRepository.findById(id)),
      );
      const validSubjects = subjects.filter((s) => s !== null);

      if (validSubjects.length < 2) {
        return buildDashboardError(
          'SUBJECTS_NOT_FOUND',
          'Could not find enough valid subjects',
        );
      }

      // Get composite scores
      const { data: scoreData, error: scoreError } = await this.getClient()
        .schema(this.schema)
        .from('composite_scores')
        .select('*')
        .in('subject_id', subjectIds)
        .eq('status', 'active')
        .eq('is_test', false)
        .order('created_at', { ascending: false });

      if (scoreError) {
        return buildDashboardError('QUERY_FAILED', scoreError.message);
      }

      // Get latest score per subject
      const latestScores = new Map<string, any>();
      for (const score of scoreData || []) {
        if (!latestScores.has(score.subject_id)) {
          latestScores.set(score.subject_id, score);
        }
      }

      // Build dimension comparisons
      const allDimensions = new Set<string>();
      for (const score of latestScores.values()) {
        const dimScores = score.dimension_scores || {};
        Object.keys(dimScores).forEach((key) => allDimensions.add(key));
      }

      // Get dimension info from first subject's scope
      const firstSubject = validSubjects[0];
      const dimensions = await this.dimensionRepository.findByScope(
        firstSubject!.scope_id,
      );
      const dimMap = new Map(dimensions.map((d) => [d.slug, d]));

      // Build comparison data
      const dimensionComparisons = Array.from(allDimensions).map((dimSlug) => {
        const dim = dimMap.get(dimSlug);
        const scores = subjectIds
          .map((subjectId) => {
            const cs = latestScores.get(subjectId);
            const dimScores = cs?.dimension_scores || {};
            const scoreData = dimScores[dimSlug];
            const score =
              typeof scoreData === 'object' ? scoreData?.score : scoreData;
            return {
              subjectId,
              score: score ?? 0,
              rank: 0,
            };
          })
          .sort((a, b) => a.score - b.score); // Sort by score ascending (lower = better for risk)

        // Assign ranks
        scores.forEach((s, idx) => {
          s.rank = idx + 1;
        });

        return {
          dimensionSlug: dimSlug,
          dimensionName:
            dim?.display_name || dim?.name || dimSlug,
          icon: dim?.icon,
          color: dim?.color,
          scores,
        };
      });

      // Calculate overall rankings
      const rankings = subjectIds.map((subjectId) => {
        const subject = validSubjects.find((s) => s?.id === subjectId);
        const cs = latestScores.get(subjectId);
        const overallScore = cs?.overall_score ?? 0;
        const dimRanks: Record<string, number> = {};

        dimensionComparisons.forEach((dc) => {
          const scoreData = dc.scores.find((s) => s.subjectId === subjectId);
          dimRanks[dc.dimensionSlug] = scoreData?.rank ?? 0;
        });

        return {
          subjectId,
          subjectName: subject?.name || 'Unknown',
          overallScore,
          overallRank: 0,
          dimensionRanks: dimRanks,
        };
      });

      // Sort and assign overall ranks
      rankings.sort((a, b) => a.overallScore - b.overallScore);
      rankings.forEach((r, idx) => {
        r.overallRank = idx + 1;
      });

      return buildDashboardSuccess({
        subjects: validSubjects.map((s) => ({
          id: s!.id,
          scopeId: s!.scope_id,
          identifier: s!.identifier,
          name: s!.name,
          subjectType: s!.subject_type,
        })),
        compositeScores: Array.from(latestScores.values()).map((cs) => ({
          id: cs.id,
          subjectId: cs.subject_id,
          overallScore: cs.overall_score,
          dimensionScores: cs.dimension_scores,
          confidence: cs.confidence,
          createdAt: cs.created_at,
        })),
        dimensionComparisons,
        rankings,
      });
    } catch (error) {
      this.logger.error(
        `Failed to compare subjects: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'COMPARISON_FAILED',
        error instanceof Error ? error.message : 'Failed to compare subjects',
      );
    }
  }

  /**
   * Save a comparison set
   * Action: analytics.save-comparison
   * Params: { scopeId: string, name: string, subjectIds: string[] }
   */
  private async handleSaveComparison(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;
    const name = params?.name as string | undefined;
    const subjectIds = params?.subjectIds as string[] | undefined;

    if (!scopeId || !name || !subjectIds || subjectIds.length < 2) {
      return buildDashboardError(
        'INVALID_PARAMS',
        'scopeId, name, and at least 2 subjectIds are required',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('comparisons')
        .insert({
          scope_id: scopeId,
          name,
          subject_ids: subjectIds,
        })
        .select()
        .single();

      if (error) {
        return buildDashboardError('INSERT_FAILED', error.message);
      }

      return buildDashboardSuccess({
        id: data.id,
        scopeId: data.scope_id,
        name: data.name,
        subjectIds: data.subject_ids,
        createdAt: data.created_at,
      });
    } catch (error) {
      this.logger.error(
        `Failed to save comparison: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'SAVE_FAILED',
        error instanceof Error ? error.message : 'Failed to save comparison',
      );
    }
  }

  /**
   * List saved comparisons
   * Action: analytics.list-comparisons
   * Params: { scopeId: string }
   */
  private async handleListComparisons(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const scopeId = params?.scopeId as string | undefined;

    if (!scopeId) {
      return buildDashboardError(
        'MISSING_SCOPE_ID',
        'Scope ID is required to list comparisons',
      );
    }

    try {
      const { data, error } = await this.getClient()
        .schema(this.schema)
        .from('comparisons')
        .select('*')
        .eq('scope_id', scopeId)
        .order('created_at', { ascending: false });

      if (error) {
        return buildDashboardError('QUERY_FAILED', error.message);
      }

      const comparisons = (data || []).map((row: any) => ({
        id: row.id,
        scopeId: row.scope_id,
        name: row.name,
        subjectIds: row.subject_ids,
        createdAt: row.created_at,
      }));

      return buildDashboardSuccess(comparisons, { count: comparisons.length });
    } catch (error) {
      this.logger.error(
        `Failed to list comparisons: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'LIST_FAILED',
        error instanceof Error ? error.message : 'Failed to list comparisons',
      );
    }
  }

  /**
   * Delete a comparison
   * Action: analytics.delete-comparison
   * Params: { id: string }
   */
  private async handleDeleteComparison(
    payload: DashboardRequestPayload,
  ): Promise<DashboardActionResult> {
    const params = payload.params as Record<string, unknown> | undefined;
    const id = params?.id as string | undefined;

    if (!id) {
      return buildDashboardError('MISSING_ID', 'Comparison ID is required');
    }

    try {
      const { error } = await this.getClient()
        .schema(this.schema)
        .from('comparisons')
        .delete()
        .eq('id', id);

      if (error) {
        return buildDashboardError('DELETE_FAILED', error.message);
      }

      return buildDashboardSuccess({ success: true });
    } catch (error) {
      this.logger.error(
        `Failed to delete comparison: ${error instanceof Error ? error.message : String(error)}`,
      );
      return buildDashboardError(
        'DELETE_FAILED',
        error instanceof Error ? error.message : 'Failed to delete comparison',
      );
    }
  }
}
