import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Prediction,
  CreatePredictionData,
  UpdatePredictionData,
  PredictionStatus,
} from '../interfaces/prediction.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

type SupabaseSelectListResponse<T> = {
  data: T[] | null;
  error: SupabaseError;
};

@Injectable()
export class PredictionRepository {
  private readonly logger = new Logger(PredictionRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'predictions';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
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
  ): Promise<Prediction[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId);

    if (status) {
      query = query.eq('status', status);
    }

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
   */
  async findPendingResolution(): Promise<Prediction[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .order('expires_at', {
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
}
