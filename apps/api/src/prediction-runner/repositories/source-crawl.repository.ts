import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  SourceCrawl,
  CreateSourceCrawlData,
  UpdateSourceCrawlData,
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
export class SourceCrawlRepository {
  private readonly logger = new Logger(SourceCrawlRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'source_crawls';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  async findById(id: string): Promise<SourceCrawl | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single()) as SupabaseSelectResponse<SourceCrawl>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to fetch source crawl: ${error.message}`);
      throw new Error(`Failed to fetch source crawl: ${error.message}`);
    }

    return data;
  }

  async findByIdOrThrow(id: string): Promise<SourceCrawl> {
    const crawl = await this.findById(id);
    if (!crawl) {
      throw new NotFoundException(`Source crawl not found: ${id}`);
    }
    return crawl;
  }

  async findBySourceId(sourceId: string, limit = 10): Promise<SourceCrawl[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('source_id', sourceId)
      .order('started_at', { ascending: false })
      .limit(limit)) as SupabaseSelectListResponse<SourceCrawl>;

    if (error) {
      this.logger.error(`Failed to fetch source crawls: ${error.message}`);
      throw new Error(`Failed to fetch source crawls: ${error.message}`);
    }

    return data ?? [];
  }

  async findRecentBySourceId(sourceId: string): Promise<SourceCrawl | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('source_id', sourceId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()) as SupabaseSelectResponse<SourceCrawl>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(
        `Failed to fetch recent source crawl: ${error.message}`,
      );
      throw new Error(`Failed to fetch recent source crawl: ${error.message}`);
    }

    return data;
  }

  async create(crawlData: CreateSourceCrawlData): Promise<SourceCrawl> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert({
        ...crawlData,
        started_at: crawlData.started_at || new Date().toISOString(),
        status: crawlData.status || 'running',
      })
      .select()
      .single()) as SupabaseSelectResponse<SourceCrawl>;

    if (error) {
      this.logger.error(`Failed to create source crawl: ${error.message}`);
      throw new Error(`Failed to create source crawl: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no source crawl returned');
    }

    return data;
  }

  async update(
    id: string,
    updateData: UpdateSourceCrawlData,
  ): Promise<SourceCrawl> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()) as SupabaseSelectResponse<SourceCrawl>;

    if (error) {
      this.logger.error(`Failed to update source crawl: ${error.message}`);
      throw new Error(`Failed to update source crawl: ${error.message}`);
    }

    if (!data) {
      throw new Error('Update succeeded but no source crawl returned');
    }

    return data;
  }

  /**
   * Mark a crawl as completed with success
   */
  async markSuccess(
    id: string,
    results: {
      items_found: number;
      signals_created: number;
      duplicates_skipped: number;
      crawl_duration_ms: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<SourceCrawl> {
    return this.update(id, {
      status: 'success',
      completed_at: new Date().toISOString(),
      ...results,
    });
  }

  /**
   * Mark a crawl as failed
   */
  async markError(
    id: string,
    error: string,
    duration_ms: number,
  ): Promise<SourceCrawl> {
    return this.update(id, {
      status: 'error',
      completed_at: new Date().toISOString(),
      error_message: error,
      crawl_duration_ms: duration_ms,
    });
  }

  /**
   * Get crawl statistics for a source
   */
  async getStats(
    sourceId: string,
    days = 7,
  ): Promise<{
    total_crawls: number;
    successful_crawls: number;
    failed_crawls: number;
    total_signals_created: number;
    total_duplicates_skipped: number;
    avg_duration_ms: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('status, signals_created, duplicates_skipped, crawl_duration_ms')
      .eq('source_id', sourceId)
      .gte(
        'started_at',
        cutoffDate.toISOString(),
      )) as SupabaseSelectListResponse<{
      status: string;
      signals_created: number;
      duplicates_skipped: number;
      crawl_duration_ms: number | null;
    }>;

    if (error) {
      this.logger.error(`Failed to fetch crawl stats: ${error.message}`);
      throw new Error(`Failed to fetch crawl stats: ${error.message}`);
    }

    const crawls = data ?? [];
    const successful = crawls.filter((c) => c.status === 'success');
    const failed = crawls.filter((c) => c.status === 'error');

    const totalDuration = successful.reduce(
      (sum, c) => sum + (c.crawl_duration_ms || 0),
      0,
    );

    return {
      total_crawls: crawls.length,
      successful_crawls: successful.length,
      failed_crawls: failed.length,
      total_signals_created: crawls.reduce(
        (sum, c) => sum + (c.signals_created || 0),
        0,
      ),
      total_duplicates_skipped: crawls.reduce(
        (sum, c) => sum + (c.duplicates_skipped || 0),
        0,
      ),
      avg_duration_ms:
        successful.length > 0 ? totalDuration / successful.length : 0,
    };
  }
}
