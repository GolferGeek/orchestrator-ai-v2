import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Source,
  CreateSourceData,
  UpdateSourceData,
  SourceScopeLevel,
  CrawlFrequency,
} from '../interfaces/source.interface';

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
export class SourceRepository {
  private readonly logger = new Logger(SourceRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'sources';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async findAll(): Promise<Source[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('is_active', true)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(`Failed to fetch sources: ${error.message}`);
      throw new Error(`Failed to fetch sources: ${error.message}`);
    }

    return data ?? [];
  }

  async findById(id: string): Promise<Source | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<Source>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch source: ${error.message}`);
      throw new Error(`Failed to fetch source: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<Source> {
    const source = await this.findById(id);
    if (!source) {
      throw new NotFoundException(`Source not found: ${id}`);
    }
    return source;
  }

  async findByScope(
    scopeLevel: SourceScopeLevel,
    scopeId?: string,
  ): Promise<Source[]> {
    let query = this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('scope_level', scopeLevel)
      .eq('is_active', true);

    // Add scope-specific filter
    switch (scopeLevel) {
      case 'universe':
        if (scopeId) {
          query = query.eq('universe_id', scopeId);
        }
        break;
      case 'target':
        if (scopeId) {
          query = query.eq('target_id', scopeId);
        }
        break;
      case 'domain':
        if (scopeId) {
          query = query.eq('domain', scopeId);
        }
        break;
    }

    const { data, error } = (await query) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(`Failed to fetch sources by scope: ${error.message}`);
      throw new Error(`Failed to fetch sources by scope: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Find sources that are due for crawling based on their frequency
   */
  async findDueForCrawl(frequency: CrawlFrequency): Promise<Source[]> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - frequency * 60 * 1000);

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('is_active', true)
      .eq('crawl_frequency_minutes', frequency)
      .or(`last_crawl_at.is.null,last_crawl_at.lt.${cutoffTime.toISOString()}`)
      .lt('consecutive_errors', 5) // Don't crawl sources with too many errors
      .order('last_crawl_at', {
        ascending: true,
        nullsFirst: true,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(
        `Failed to fetch sources due for crawl: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch sources due for crawl: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Find all sources for a universe (dashboard listing - includes inactive)
   * Unlike findByScope, this does NOT filter by is_active
   */
  async findByUniverseForDashboard(universeId: string): Promise<Source[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('universe_id', universeId)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(
        `Failed to fetch sources for universe dashboard: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch sources for universe dashboard: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Find all sources for a target (dashboard listing - includes inactive)
   */
  async findByTargetForDashboard(targetId: string): Promise<Source[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('target_id', targetId)
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(
        `Failed to fetch sources for target dashboard: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch sources for target dashboard: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Find all sources (dashboard listing - includes inactive)
   */
  async findAllForDashboard(): Promise<Source[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .order('created_at', {
        ascending: false,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(
        `Failed to fetch all sources for dashboard: ${error.message}`,
      );
      throw new Error(
        `Failed to fetch all sources for dashboard: ${error.message}`,
      );
    }

    return data ?? [];
  }

  /**
   * Find all active sources for a target (including inherited from universe/domain/runner)
   */
  async findForTarget(
    targetId: string,
    universeId: string,
    domain: string,
  ): Promise<Source[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('is_active', true)
      .or(
        `scope_level.eq.runner,` +
          `and(scope_level.eq.domain,domain.eq.${domain}),` +
          `and(scope_level.eq.universe,universe_id.eq.${universeId}),` +
          `and(scope_level.eq.target,target_id.eq.${targetId})`,
      )
      .order('scope_level', {
        ascending: true,
      })) as SupabaseSelectListResponse<Source>;

    if (error) {
      this.logger.error(`Failed to fetch sources for target: ${error.message}`);
      throw new Error(`Failed to fetch sources for target: ${error.message}`);
    }

    return data ?? [];
  }

  async create(sourceData: CreateSourceData): Promise<Source> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert(sourceData)
      .select()
      .single()) as SupabaseSelectResponse<Source>;

    if (error) {
      this.logger.error(`Failed to create source: ${error.message}`);
      throw new Error(`Failed to create source: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no source returned');
    }

    return data;
  }

  async update(id: string, updateData: UpdateSourceData): Promise<Source> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<Source>;

    if (error) {
      this.logger.error(`Failed to update source: ${error.message}`);
      throw new Error(`Failed to update source: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no source returned');
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
      this.logger.error(`Failed to delete source: ${error.message}`);
      throw new Error(`Failed to delete source: ${error.message}`);
    }
  }

  /**
   * Update source after successful crawl
   */
  async markCrawlSuccess(id: string): Promise<void> {
    await this.update(id, {
      last_crawl_at: new Date().toISOString(),
      last_crawl_status: 'success',
      last_error: null,
      consecutive_errors: 0,
    });
  }

  /**
   * Update source after failed crawl
   */
  async markCrawlError(id: string, error: string): Promise<void> {
    const source = await this.findByIdOrThrow(id);
    await this.update(id, {
      last_crawl_at: new Date().toISOString(),
      last_crawl_status: 'error',
      last_error: error,
      consecutive_errors: source.consecutive_errors + 1,
    });
  }
}
