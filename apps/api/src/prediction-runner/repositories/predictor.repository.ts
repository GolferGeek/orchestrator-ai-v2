import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Predictor,
  CreatePredictorData,
  UpdatePredictorData,
} from '../interfaces/predictor.interface';

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
export class PredictorRepository {
  private readonly logger = new Logger(PredictorRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'predictors';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async findActiveByTarget(targetId: string): Promise<Predictor[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Predictor>;

    if (error) {
      this.logger.error(`Failed to fetch active predictors: ${error.message}`);
      throw new Error(`Failed to fetch active predictors: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Predictor | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Predictor>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch predictor: ${error.message}`);
      throw new Error(`Failed to fetch predictor: ${error.message}`);
    }

    return data;
  }

  async create(predictorData: CreatePredictorData): Promise<Predictor> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(predictorData)
      .select()
      .single()) as SupabaseSelectResponse<Predictor>;

    if (error) {
      this.logger.error(`Failed to create predictor: ${error.message}`);
      throw new Error(`Failed to create predictor: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no predictor returned');
    }

    return data;
  }

  async update(
    id: string,
    updateData: UpdatePredictorData,
  ): Promise<Predictor> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Predictor>;

    if (error) {
      this.logger.error(`Failed to update predictor: ${error.message}`);
      throw new Error(`Failed to update predictor: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no predictor returned');
    }

    return data;
  }

  /**
   * Expire old predictors for a target
   * Sets status to 'expired' for predictors past their TTL
   */
  async expireOldPredictors(targetId: string): Promise<number> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({ status: 'expired' })
      .eq('target_id', targetId)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('id')) as SupabaseSelectListResponse<{ id: string }>;

    if (error) {
      this.logger.error(`Failed to expire old predictors: ${error.message}`);
      throw new Error(`Failed to expire old predictors: ${error.message}`);
    }

    const expiredCount = (data ?? []).length;
    if (expiredCount > 0) {
      this.logger.debug(
        `Expired ${expiredCount} predictors for target ${targetId}`,
      );
    }

    return expiredCount;
  }

  /**
   * Mark a predictor as consumed by a prediction
   * Sets status to 'consumed' and records the prediction ID and timestamp
   */
  async consumePredictor(id: string, predictionId: string): Promise<Predictor> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({
        status: 'consumed',
        consumed_at: new Date().toISOString(),
        consumed_by_prediction_id: predictionId,
      })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()) as SupabaseSelectResponse<Predictor>;

    if (error) {
      this.logger.error(`Failed to consume predictor: ${error.message}`);
      throw new Error(`Failed to consume predictor: ${error.message}`);
    }

    if (!data) {
      throw new Error('Consume succeeded but no predictor returned');
    }

    return data;
  }
}
