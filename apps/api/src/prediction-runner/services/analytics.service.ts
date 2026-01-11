import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  AccuracyComparisonDto,
  LearningVelocityDto,
  ScenarioEffectivenessDto,
  PromotionFunnelDto,
  AnalyticsSummaryDto,
} from '../dto/analytics.dto';

// Database row types for analytics views
interface AccuracyComparisonRow {
  period_date: string;
  is_test: boolean;
  total_predictions: number;
  resolved_predictions: number;
  correct_predictions: number;
  accuracy_pct: number | null;
  avg_confidence: number | null;
  avg_overall_score: number | null;
}

interface LearningVelocityRow {
  period_date: string;
  test_learnings_created: number;
  production_learnings_created: number;
  learnings_promoted: number;
  avg_days_to_promotion: number | null;
}

interface ScenarioEffectivenessRow {
  scenario_type: string;
  total_scenarios: number;
  total_runs: number;
  successful_runs: number;
  success_rate_pct: number | null;
  learnings_generated: number;
  avg_run_duration_minutes: number | null;
}

interface PromotionFunnelRow {
  stage: string;
  count: number;
  pct_of_total: number | null;
}

/**
 * Analytics Service
 * Handles querying Phase 6.1 Analytics Views for dashboard consumption
 *
 * Phase 6.2 - Analytics API Endpoints
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get accuracy comparison analytics
   * Compares test vs production prediction accuracy over time
   *
   * @param orgSlug - Organization slug (for future org-scoped filtering)
   * @param startDate - Optional start date for filtering
   * @param endDate - Optional end date for filtering
   * @returns Array of accuracy comparison records
   */
  async getAccuracyComparison(
    orgSlug: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AccuracyComparisonDto[]> {
    this.logger.debug(
      `Fetching accuracy comparison for org: ${orgSlug}, dateRange: ${startDate ?? 'all'} to ${endDate ?? 'now'}`,
    );

    const supabase = this.supabaseService.getServiceClient();

    let query = supabase
      .schema('prediction')
      .from('v_analytics_accuracy_comparison')
      .select('*')
      .order('period_date', { ascending: false });

    // Apply date range filters if provided
    if (startDate) {
      query = query.gte('period_date', startDate);
    }
    if (endDate) {
      query = query.lte('period_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(
        `Failed to fetch accuracy comparison: ${error.message}`,
      );
      throw new Error(`Failed to fetch accuracy comparison: ${error.message}`);
    }

    // Transform to DTO
    return ((data as AccuracyComparisonRow[] | null) ?? []).map((row) => ({
      period_date: row.period_date,
      is_test: row.is_test,
      total_predictions: Number(row.total_predictions ?? 0),
      resolved_predictions: Number(row.resolved_predictions ?? 0),
      correct_predictions: Number(row.correct_predictions ?? 0),
      accuracy_pct: row.accuracy_pct !== null ? Number(row.accuracy_pct) : null,
      avg_confidence:
        row.avg_confidence !== null ? Number(row.avg_confidence) : null,
      avg_overall_score:
        row.avg_overall_score !== null ? Number(row.avg_overall_score) : null,
    }));
  }

  /**
   * Get learning velocity analytics
   * Tracks test learning creation, promotion, and time to promotion
   *
   * @param orgSlug - Organization slug (for future org-scoped filtering)
   * @param startDate - Optional start date for filtering
   * @param endDate - Optional end date for filtering
   * @returns Array of learning velocity records
   */
  async getLearningVelocity(
    orgSlug: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningVelocityDto[]> {
    this.logger.debug(
      `Fetching learning velocity for org: ${orgSlug}, dateRange: ${startDate ?? 'all'} to ${endDate ?? 'now'}`,
    );

    const supabase = this.supabaseService.getServiceClient();

    let query = supabase
      .schema('prediction')
      .from('v_analytics_learning_velocity')
      .select('*')
      .order('period_date', { ascending: false });

    // Apply date range filters if provided
    if (startDate) {
      query = query.gte('period_date', startDate);
    }
    if (endDate) {
      query = query.lte('period_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch learning velocity: ${error.message}`);
      throw new Error(`Failed to fetch learning velocity: ${error.message}`);
    }

    // Transform to DTO
    return ((data as LearningVelocityRow[] | null) ?? []).map((row) => ({
      period_date: row.period_date,
      test_learnings_created: Number(row.test_learnings_created ?? 0),
      production_learnings_created: Number(
        row.production_learnings_created ?? 0,
      ),
      learnings_promoted: Number(row.learnings_promoted ?? 0),
      avg_days_to_promotion:
        row.avg_days_to_promotion !== null
          ? Number(row.avg_days_to_promotion)
          : null,
    }));
  }

  /**
   * Get scenario effectiveness analytics
   * Analyzes test scenario success rates and learning generation
   *
   * @param orgSlug - Organization slug (for future org-scoped filtering)
   * @returns Array of scenario effectiveness records
   */
  async getScenarioEffectiveness(
    orgSlug: string,
  ): Promise<ScenarioEffectivenessDto[]> {
    this.logger.debug(`Fetching scenario effectiveness for org: ${orgSlug}`);

    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .schema('prediction')
      .from('v_analytics_scenario_effectiveness')
      .select('*')
      .order('total_runs', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch scenario effectiveness: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch scenario effectiveness: ${error.message}`,
      );
    }

    // Transform to DTO
    return ((data as ScenarioEffectivenessRow[] | null) ?? []).map((row) => ({
      scenario_type: row.scenario_type ?? 'unknown',
      total_scenarios: Number(row.total_scenarios ?? 0),
      total_runs: Number(row.total_runs ?? 0),
      successful_runs: Number(row.successful_runs ?? 0),
      success_rate_pct:
        row.success_rate_pct !== null ? Number(row.success_rate_pct) : null,
      learnings_generated: Number(row.learnings_generated ?? 0),
      avg_run_duration_minutes:
        row.avg_run_duration_minutes !== null
          ? Number(row.avg_run_duration_minutes)
          : null,
    }));
  }

  /**
   * Get promotion funnel analytics
   * Shows conversion rates through learning promotion stages
   *
   * @param orgSlug - Organization slug (for future org-scoped filtering)
   * @returns Array of promotion funnel records
   */
  async getPromotionFunnel(orgSlug: string): Promise<PromotionFunnelDto[]> {
    this.logger.debug(`Fetching promotion funnel for org: ${orgSlug}`);

    const supabase = this.supabaseService.getServiceClient();

    const { data, error } = await supabase
      .schema('prediction')
      .from('v_analytics_promotion_funnel')
      .select('*')
      .order('stage', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch promotion funnel: ${error.message}`);
      throw new Error(`Failed to fetch promotion funnel: ${error.message}`);
    }

    // Transform to DTO
    return ((data as PromotionFunnelRow[] | null) ?? []).map((row) => ({
      stage: row.stage ?? 'unknown',
      count: Number(row.count ?? 0),
      pct_of_total: row.pct_of_total !== null ? Number(row.pct_of_total) : null,
    }));
  }

  /**
   * Get analytics summary
   * Aggregates key metrics from all analytics views
   *
   * @param orgSlug - Organization slug (for future org-scoped filtering)
   * @returns Analytics summary with key metrics
   */
  async getSummary(orgSlug: string): Promise<AnalyticsSummaryDto> {
    this.logger.debug(`Fetching analytics summary for org: ${orgSlug}`);

    // Fetch all analytics in parallel
    const [accuracy, velocity, effectiveness, funnel] = await Promise.all([
      this.getAccuracyComparison(orgSlug),
      this.getLearningVelocity(orgSlug),
      this.getScenarioEffectiveness(orgSlug),
      this.getPromotionFunnel(orgSlug),
    ]);

    // Extract latest accuracy metrics (most recent period)
    const latestTest = accuracy.find((a) => a.is_test) ?? null;
    const latestProduction = accuracy.find((a) => !a.is_test) ?? null;

    // Calculate learning velocity for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentVelocity = velocity.filter(
      (v) => new Date(v.period_date) >= sevenDaysAgo,
    );
    const velocitySummary = recentVelocity.reduce(
      (acc, v) => ({
        test_learnings_created:
          acc.test_learnings_created + v.test_learnings_created,
        production_learnings_created:
          acc.production_learnings_created + v.production_learnings_created,
        learnings_promoted: acc.learnings_promoted + v.learnings_promoted,
        avg_days_to_promotion:
          v.avg_days_to_promotion !== null
            ? (acc.avg_days_to_promotion ?? 0) + v.avg_days_to_promotion
            : acc.avg_days_to_promotion,
      }),
      {
        test_learnings_created: 0,
        production_learnings_created: 0,
        learnings_promoted: 0,
        avg_days_to_promotion: null as number | null,
      },
    );

    // Calculate average days to promotion
    const velocityWithDays = recentVelocity.filter(
      (v) => v.avg_days_to_promotion !== null,
    );
    if (
      velocityWithDays.length > 0 &&
      velocitySummary.avg_days_to_promotion !== null
    ) {
      velocitySummary.avg_days_to_promotion =
        velocitySummary.avg_days_to_promotion / velocityWithDays.length;
    }

    // Aggregate scenario effectiveness
    const effectivenessSummary = effectiveness.reduce(
      (acc, s) => ({
        total_scenarios: acc.total_scenarios + s.total_scenarios,
        total_runs: acc.total_runs + s.total_runs,
        successful_runs: acc.successful_runs + s.successful_runs,
        total_learnings_generated:
          acc.total_learnings_generated + s.learnings_generated,
      }),
      {
        total_scenarios: 0,
        total_runs: 0,
        successful_runs: 0,
        total_learnings_generated: 0,
      },
    );

    const overallSuccessRate =
      effectivenessSummary.total_runs > 0
        ? (effectivenessSummary.successful_runs /
            effectivenessSummary.total_runs) *
          100
        : null;

    // Extract promotion funnel stages
    const funnelMap = funnel.reduce(
      (acc, f) => {
        acc[f.stage] = f.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      accuracy: {
        test: {
          total_predictions: latestTest?.total_predictions ?? 0,
          accuracy_pct: latestTest?.accuracy_pct ?? null,
          avg_confidence: latestTest?.avg_confidence ?? null,
        },
        production: {
          total_predictions: latestProduction?.total_predictions ?? 0,
          accuracy_pct: latestProduction?.accuracy_pct ?? null,
          avg_confidence: latestProduction?.avg_confidence ?? null,
        },
      },
      learning_velocity: velocitySummary,
      scenario_effectiveness: {
        total_scenarios: effectivenessSummary.total_scenarios,
        total_runs: effectivenessSummary.total_runs,
        overall_success_rate_pct: overallSuccessRate,
        total_learnings_generated:
          effectivenessSummary.total_learnings_generated,
      },
      promotion_funnel: {
        test_created: funnelMap['test_created'] ?? 0,
        validated: funnelMap['validated'] ?? 0,
        backtested: funnelMap['backtested'] ?? 0,
        promoted: funnelMap['promoted'] ?? 0,
      },
    };
  }
}
