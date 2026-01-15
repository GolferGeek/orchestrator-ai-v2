import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Strategy,
  CreateStrategyData,
  UpdateStrategyData,
} from '../interfaces/strategy.interface';

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
export class StrategyRepository {
  private readonly logger = new Logger(StrategyRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'strategies';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async findAll(): Promise<Strategy[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('name', {
        ascending: true,
      })) as SupabaseSelectListResponse<Strategy>;

    if (error) {
      this.logger.error(`Failed to fetch strategies: ${error.message}`);
      throw new Error(`Failed to fetch strategies: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Strategy | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Strategy>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch strategy: ${error.message}`);
      throw new Error(`Failed to fetch strategy: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<Strategy> {
    const strategy = await this.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy not found: ${id}`);
    }
    return strategy;
  }

  async findBySlug(slug: string): Promise<Strategy | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('slug', slug)
      .single()) as SupabaseSelectResponse<Strategy>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch strategy by slug: ${error.message}`);
      throw new Error(`Failed to fetch strategy by slug: ${error.message}`);
    }

    return data;
  }

  async findBySlugOrThrow(slug: string): Promise<Strategy> {
    const strategy = await this.findBySlug(slug);
    if (!strategy) {
      throw new NotFoundException(`Strategy not found: ${slug}`);
    }
    return strategy;
  }

  async findSystemStrategies(): Promise<Strategy[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('is_system', true)
      .eq('is_active', true)
      .order('name', {
        ascending: true,
      })) as SupabaseSelectListResponse<Strategy>;

    if (error) {
      this.logger.error(`Failed to fetch system strategies: ${error.message}`);
      throw new Error(`Failed to fetch system strategies: ${error.message}`);
    }

    return data ?? [];
  }

  async create(strategyData: CreateStrategyData): Promise<Strategy> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(strategyData)
      .select()
      .single()) as SupabaseSelectResponse<Strategy>;

    if (error) {
      this.logger.error(`Failed to create strategy: ${error.message}`);
      throw new Error(`Failed to create strategy: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no strategy returned');
    }

    return data;
  }

  async update(id: string, updateData: UpdateStrategyData): Promise<Strategy> {
    // Don't allow updating system strategies' core properties
    const existing = await this.findByIdOrThrow(id);
    if (existing.is_system) {
      // Only allow updating is_active for system strategies
      const allowedUpdates: UpdateStrategyData = {};
      if (updateData.is_active !== undefined) {
        allowedUpdates.is_active = updateData.is_active;
      }
      updateData = allowedUpdates;
    }

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Strategy>;

    if (error) {
      this.logger.error(`Failed to update strategy: ${error.message}`);
      throw new Error(`Failed to update strategy: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no strategy returned');
    }

    return data;
  }

  async delete(id: string): Promise<void> {
    // Don't allow deleting system strategies
    const existing = await this.findByIdOrThrow(id);
    if (existing.is_system) {
      throw new Error('Cannot delete system strategies');
    }

    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete strategy: ${error.message}`);
      throw new Error(`Failed to delete strategy: ${error.message}`);
    }
  }
}
