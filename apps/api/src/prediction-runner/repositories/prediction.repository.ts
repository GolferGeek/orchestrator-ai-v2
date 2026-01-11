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
