import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Analyst,
  ActiveAnalyst,
  LlmTier,
} from '../interfaces/analyst.interface';

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
export class AnalystRepository {
  private readonly logger = new Logger(AnalystRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'analysts';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Get active analysts for a target using database function
   * Respects scope hierarchy and overrides
   */
  async getActiveAnalysts(
    targetId: string,
    tier?: LlmTier,
  ): Promise<ActiveAnalyst[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .rpc('get_active_analysts', {
        p_target_id: targetId,
        p_tier: tier || null,
      })) as SupabaseSelectListResponse<ActiveAnalyst>;

    if (error) {
      this.logger.error(`Failed to get active analysts: ${error.message}`);
      throw new Error(`Failed to get active analysts: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Analyst | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Analyst>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch analyst: ${error.message}`);
      throw new Error(`Failed to fetch analyst: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<Analyst> {
    const analyst = await this.findById(id);
    if (!analyst) {
      throw new NotFoundException(`Analyst not found: ${id}`);
    }
    return analyst;
  }

  async findBySlug(
    slug: string,
    scopeLevel?: string,
    domain?: string,
  ): Promise<Analyst[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('slug', slug);

    if (scopeLevel) {
      query = query.eq('scope_level', scopeLevel);
    }
    if (domain) {
      query = query.eq('domain', domain);
    }

    const { data, error } =
      (await query) as SupabaseSelectListResponse<Analyst>;

    if (error) {
      this.logger.error(`Failed to find analysts by slug: ${error.message}`);
      throw new Error(`Failed to find analysts by slug: ${error.message}`);
    }

    return data ?? [];
  }

  async create(analystData: Partial<Analyst>): Promise<Analyst> {
    const { data: created, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(analystData)
      .select()
      .single()) as SupabaseSelectResponse<Analyst>;

    if (error) {
      this.logger.error(`Failed to create analyst: ${error.message}`);
      throw new Error(`Failed to create analyst: ${error.message}`);
    }

    if (!created) {
      throw new Error('Create succeeded but no analyst returned');
    }

    return created;
  }

  async update(id: string, analystData: Partial<Analyst>): Promise<Analyst> {
    const { data: updated, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(analystData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Analyst>;

    if (error) {
      this.logger.error(`Failed to update analyst: ${error.message}`);
      throw new Error(`Failed to update analyst: ${error.message}`);
    }

    if (!updated) {
      throw new Error('Update succeeded but no analyst returned');
    }

    return updated;
  }

  async findByDomain(domain: string): Promise<Analyst[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('domain', domain)
      .eq('is_enabled', true)) as SupabaseSelectListResponse<Analyst>;

    if (error) {
      this.logger.error(`Failed to find analysts by domain: ${error.message}`);
      throw new Error(`Failed to find analysts by domain: ${error.message}`);
    }

    return data ?? [];
  }

  async findRunnerLevel(): Promise<Analyst[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('scope_level', 'runner')
      .eq('is_enabled', true)) as SupabaseSelectListResponse<Analyst>;

    if (error) {
      this.logger.error(
        `Failed to find runner-level analysts: ${error.message}`,
      );
      throw new Error(`Failed to find runner-level analysts: ${error.message}`);
    }

    return data ?? [];
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete analyst: ${error.message}`);
      throw new Error(`Failed to delete analyst: ${error.message}`);
    }
  }
}
