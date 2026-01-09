import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Target,
  CreateTargetData,
  UpdateTargetData,
} from '../interfaces/target.interface';

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
export class TargetRepository {
  private readonly logger = new Logger(TargetRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'targets';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async findAll(universeId: string): Promise<Target[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('universe_id', universeId)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Target>;

    if (error) {
      this.logger.error(`Failed to fetch targets: ${error.message}`);
      throw new Error(`Failed to fetch targets: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Target | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Target>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch target: ${error.message}`);
      throw new Error(`Failed to fetch target: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<Target> {
    const target = await this.findById(id);
    if (!target) {
      throw new NotFoundException(`Target not found: ${id}`);
    }
    return target;
  }

  async findBySymbol(
    universeId: string,
    symbol: string,
  ): Promise<Target | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('universe_id', universeId)
      .eq('symbol', symbol)
      .single()) as SupabaseSelectResponse<Target>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch target by symbol: ${error.message}`);
      throw new Error(`Failed to fetch target by symbol: ${error.message}`);
    }

    return data;
  }

  async create(targetData: CreateTargetData): Promise<Target> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(targetData)
      .select()
      .single()) as SupabaseSelectResponse<Target>;

    if (error) {
      this.logger.error(`Failed to create target: ${error.message}`);
      throw new Error(`Failed to create target: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no target returned');
    }

    return data;
  }

  async update(id: string, updateData: UpdateTargetData): Promise<Target> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Target>;

    if (error) {
      this.logger.error(`Failed to update target: ${error.message}`);
      throw new Error(`Failed to update target: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no target returned');
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete target: ${error.message}`);
      throw new Error(`Failed to delete target: ${error.message}`);
    }
  }

  async findActiveByUniverse(universeId: string): Promise<Target[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('universe_id', universeId)
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Target>;

    if (error) {
      this.logger.error(`Failed to fetch active targets: ${error.message}`);
      throw new Error(`Failed to fetch active targets: ${error.message}`);
    }

    return data ?? [];
  }
}
