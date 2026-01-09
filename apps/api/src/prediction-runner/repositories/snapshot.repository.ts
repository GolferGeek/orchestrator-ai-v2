import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  PredictionSnapshot,
  CreateSnapshotData,
} from '../interfaces/snapshot.interface';

type SupabaseError = { message: string; code?: string } | null;

type SupabaseSelectResponse<T> = {
  data: T | null;
  error: SupabaseError;
};

@Injectable()
export class SnapshotRepository {
  private readonly logger = new Logger(SnapshotRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'snapshots';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async create(snapshotData: CreateSnapshotData): Promise<PredictionSnapshot> {
    const now = new Date().toISOString();

    const insertData = {
      prediction_id: snapshotData.prediction_id,
      captured_at: now,
      predictors: snapshotData.predictors,
      rejected_signals: snapshotData.rejected_signals,
      analyst_assessments: snapshotData.analyst_assessments,
      llm_ensemble: snapshotData.llm_ensemble,
      learnings_applied: snapshotData.learnings_applied,
      threshold_evaluation: snapshotData.threshold_evaluation,
      timeline: snapshotData.timeline,
    };

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(insertData)
      .select()
      .single()) as SupabaseSelectResponse<PredictionSnapshot>;

    if (error) {
      this.logger.error(`Failed to create snapshot: ${error.message}`);
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no snapshot returned');
    }

    return data;
  }

  async findByPredictionId(
    predictionId: string,
  ): Promise<PredictionSnapshot | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('prediction_id', predictionId)
      .single()) as SupabaseSelectResponse<PredictionSnapshot>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch snapshot: ${error.message}`);
      throw new Error(`Failed to fetch snapshot: ${error.message}`);
    }

    return data;
  }
}
