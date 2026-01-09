import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Signal,
  CreateSignalData,
  UpdateSignalData,
  SignalDisposition,
} from '../interfaces/signal.interface';

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
export class SignalRepository {
  private readonly logger = new Logger(SignalRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'signals';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Find pending signals for processing
   * Uses FOR UPDATE SKIP LOCKED pattern to prevent race conditions
   * @param targetId - Target ID to filter by
   * @param limit - Maximum number of signals to return
   */
  async findPendingSignals(
    targetId: string,
    limit: number = 10,
  ): Promise<Signal[]> {
    // Note: Supabase client doesn't directly support FOR UPDATE SKIP LOCKED
    // This would need to be implemented via a stored procedure or direct SQL
    // For now, we'll use a simple query and handle locking in claimSignal
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId)
      .eq('disposition', 'pending')
      .is('processing_worker', null)
      .order('detected_at', { ascending: true })
      .limit(limit)) as SupabaseSelectListResponse<Signal>;

    if (error) {
      this.logger.error(`Failed to fetch pending signals: ${error.message}`);
      throw new Error(`Failed to fetch pending signals: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Signal | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Signal>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch signal: ${error.message}`);
      throw new Error(`Failed to fetch signal: ${error.message}`);
    }

    return data;
  }

  async create(signalData: CreateSignalData): Promise<Signal> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(signalData)
      .select()
      .single()) as SupabaseSelectResponse<Signal>;

    if (error) {
      this.logger.error(`Failed to create signal: ${error.message}`);
      throw new Error(`Failed to create signal: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no signal returned');
    }

    return data;
  }

  async update(id: string, updateData: UpdateSignalData): Promise<Signal> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Signal>;

    if (error) {
      this.logger.error(`Failed to update signal: ${error.message}`);
      throw new Error(`Failed to update signal: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no signal returned');
    }

    return data;
  }

  /**
   * Atomically claim a signal for processing
   * Sets processing_worker and disposition to 'processing'
   * Returns null if signal is already claimed
   */
  async claimSignal(id: string, workerId: string): Promise<Signal | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({
        disposition: 'processing' as SignalDisposition,
        processing_worker: workerId,
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('disposition', 'pending')
      .is('processing_worker', null)
      .select()
      .single()) as SupabaseSelectResponse<Signal>;

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - signal was already claimed
        return null;
      }
      this.logger.error(`Failed to claim signal: ${error.message}`);
      throw new Error(`Failed to claim signal: ${error.message}`);
    }

    return data;
  }

  async findByTargetAndDisposition(
    targetId: string,
    disposition: SignalDisposition,
  ): Promise<Signal[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId)
      .eq('disposition', disposition)
      .order('detected_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Signal>;

    if (error) {
      this.logger.error(
        `Failed to fetch signals by disposition: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch signals by disposition: ${error.message}`,
      );
    }

    return data ?? [];
  }
}
