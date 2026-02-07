import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Prediction,
  CreatePredictionData,
  UpdatePredictionData,
  PredictionStatus,
} from '../interfaces/prediction.interface';
import { TestDataFilter } from '../interfaces/test-data.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

/**
 * Default filter that excludes test data from production queries
 */
const DEFAULT_FILTER: TestDataFilter = { includeTestData: false };

@Injectable()
export class PredictionRepository {
  private readonly logger = new Logger(PredictionRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'predictions';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Apply test data filter to a query builder
   * By default, excludes test data from production queries
   */
  private applyTestDataFilter<
    T extends { eq: (col: string, val: unknown) => T; or: (cond: string) => T },
  >(query: T, filter: TestDataFilter = DEFAULT_FILTER): T {
    if (filter.testDataOnly) {
      query = query.eq('is_test_data', true);
      if (filter.testScenarioId) {
        query = query.eq('test_scenario_id', filter.testScenarioId);
      }
    } else if (filter.testScenarioId) {
      query = query.eq('test_scenario_id', filter.testScenarioId);
    } else if (!filter.includeTestData) {
      query = query.or('is_test_data.is.null,is_test_data.eq.false');
    }
    return query;
  }

  async findById(id: string): Promise<Prediction | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Prediction>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch prediction: ${error.message}`);
      throw new Error(`Failed to fetch prediction: ${error.message}`);
    }

    return data;
  }

  async findByTarget(
    targetId: string,
    status?: PredictionStatus,
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId);

    if (status) {
      query = query.eq('status', status);
    }

    query = this.applyTestDataFilter(query, filter);
    query = query.order('predicted_at', { ascending: false });

    const { data, error } =
      (await query) as SupabaseSelectListResponse<Prediction>;

    if (error) {
      this.logger.error(`Failed to fetch predictions: ${error.message}`);
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Find an active prediction for a specific target and analyst.
   * Returns the most recent active prediction for this analyst+target pair.
   * Used by the upsert logic to decide whether to update or create.
   */
  async findByTargetAndAnalyst(
    targetId: string,
    analystSlug: string,
    status?: PredictionStatus,
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction | null> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId)
      .eq('analyst_slug', analystSlug);

    if (status) {
      query = query.eq('status', status);
    }

    query = this.applyTestDataFilter(query, filter);

    const { data, error } = (await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as SupabaseSelectResponse<Prediction>;

    if (error) {
      this.logger.error(
        `Failed to find prediction for target=${targetId} analyst=${analystSlug}: ${error.message}`,
      );
      throw new Error(
        `Failed to find prediction by target+analyst: ${error.message}`,
      );
    }

    return data;
  }

  /**
   * Find predictions by universe ID
   * Since predictions link to targets which link to universes,
   * we need to join through the targets table
   */
  async findByUniverse(
    universeId: string,
    status?: PredictionStatus,
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction[]> {
    this.logger.debug(
      `[findByUniverse] Starting - universeId: ${universeId}, status: ${status}, filter: ${JSON.stringify(filter)}`,
    );

    // First get all target IDs for this universe
    const { data: targets, error: targetError } = await this.getClient()
      .schema(this.schema)
      .from('targets')
      .select('id')
      .eq('universe_id', universeId);

    if (targetError) {
      this.logger.error(`Failed to fetch targets: ${targetError.message}`);
      throw new Error(`Failed to fetch targets: ${targetError.message}`);
    }

    this.logger.debug(
      `[findByUniverse] Found ${targets?.length ?? 0} targets for universe`,
    );

    if (!targets || targets.length === 0) {
      return [];
    }

    const targetIds = targets.map((t: { id: string }) => t.id);
    this.logger.debug(`[findByUniverse] Target IDs: ${targetIds.join(', ')}`);

    // Query ALL predictions for these targets first (without filters) to debug
    const { data: allPredictions } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('id, status, is_test_data')
      .in('target_id', targetIds);

    this.logger.debug(
      `[findByUniverse] All predictions for targets (no filters): ${allPredictions?.length ?? 0}`,
    );
    if (allPredictions && allPredictions.length > 0) {
      this.logger.debug(
        `[findByUniverse] Sample predictions: ${JSON.stringify(allPredictions.slice(0, 3))}`,
      );
    }

    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .in('target_id', targetIds);

    if (status) {
      query = query.eq('status', status);
    }

    query = this.applyTestDataFilter(query, filter);
    query = query.order('predicted_at', { ascending: false });

    const { data, error } =
      (await query) as SupabaseSelectListResponse<Prediction>;

    if (error) {
      this.logger.error(
        `Failed to fetch predictions by universe: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch predictions by universe: ${error.message}`,
      );
    }

    this.logger.debug(
      `[findByUniverse] Final result after filters: ${data?.length ?? 0} predictions`,
    );

    return data ?? [];
  }

  async create(predictionData: CreatePredictionData): Promise<Prediction> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(predictionData)
      .select()
      .single()) as SupabaseSelectResponse<Prediction>;

    if (error) {
      this.logger.error(`Failed to create prediction: ${error.message}`);
      throw new Error(`Failed to create prediction: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no prediction returned');
    }

    return data;
  }

  async update(
    id: string,
    updateData: UpdatePredictionData,
  ): Promise<Prediction> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Prediction>;

    if (error) {
      this.logger.error(`Failed to update prediction: ${error.message}`);
      throw new Error(`Failed to update prediction: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no prediction returned');
    }

    return data;
  }

  /**
   * Update the analyst_ensemble JSONB field specifically
   * Used for adding version history without affecting other fields
   */
  async updateAnalystEnsemble(
    id: string,
    ensemble: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({ analyst_ensemble: ensemble })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to update analyst_ensemble: ${error.message}`);
      throw new Error(`Failed to update analyst_ensemble: ${error.message}`);
    }
  }

  /**
   * Find predictions that are past their timeframe and need resolution
   * Returns active predictions where expires_at is in the past
   * @param filter - Test data filter (defaults to excluding test data)
   */
  async findPendingResolution(
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    query = this.applyTestDataFilter(query, filter);

    const { data, error } = (await query.order('expires_at', {
      ascending: true,
    })) as SupabaseSelectListResponse<Prediction>;

    if (error) {
      this.logger.error(
        `Failed to fetch pending resolution predictions: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch pending resolution predictions: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Resolve a prediction with the actual outcome value
   * Sets outcome_value, outcome_captured_at, and status to 'resolved'
   */
  async resolve(id: string, outcomeValue: number): Promise<Prediction> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({
        status: 'resolved',
        outcome_value: outcomeValue,
        outcome_captured_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()) as SupabaseSelectResponse<Prediction>;

    if (error) {
      this.logger.error(`Failed to resolve prediction: ${error.message}`);
      throw new Error(`Failed to resolve prediction: ${error.message}`);
    }

    if (!data) {
      throw new Error('Resolve succeeded but no prediction returned');
    }

    return data;
  }

  /**
   * Find all active predictions (not expired, not resolved)
   * @param filter - Test data filter (defaults to excluding test data)
   */
  async findActivePredictions(
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('status', 'active');

    query = this.applyTestDataFilter(query, filter);

    const { data, error } = (await query.order('predicted_at', {
      ascending: false,
    })) as SupabaseSelectListResponse<Prediction>;

    if (error) {
      this.logger.error(`Failed to fetch active predictions: ${error.message}`);
      throw new Error(`Failed to fetch active predictions: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Find resolved predictions that haven't been evaluated yet
   * @param filter - Test data filter (defaults to excluding test data)
   */
  async findResolvedWithoutEvaluation(
    filter: TestDataFilter = DEFAULT_FILTER,
  ): Promise<Prediction[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('status', 'resolved')
      .not('outcome_value', 'is', null)
      .is('resolution_notes', null);

    query = this.applyTestDataFilter(query, filter);

    const { data, error } = (await query.order('outcome_captured_at', {
      ascending: true,
    })) as SupabaseSelectListResponse<Prediction>;

    if (error) {
      this.logger.error(
        `Failed to fetch predictions for evaluation: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch predictions for evaluation: ${error.message}`,
      );
    }

    return data ?? [];
  }
}
