import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  SourceSeenItem,
  CreateSourceSeenItemData,
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
export class SourceSeenItemRepository {
  private readonly logger = new Logger(SourceSeenItemRepository.name);
  private readonly schema = 'prediction';
  private readonly table = 'source_seen_items';

  constructor(private readonly supabaseService: SupabaseService) {}

  private getClient() {
    return this.supabaseService.getServiceClient();
  }

  /**
   * Check if a content hash has been seen for a source
   */
  async hasBeenSeen(sourceId: string, contentHash: string): Promise<boolean> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('id')
      .eq('source_id', sourceId)
      .eq('content_hash', contentHash)
      .limit(1)
      .single()) as SupabaseSelectResponse<{ id: string }>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to check seen item: ${error.message}`);
      throw new Error(`Failed to check seen item: ${error.message}`);
    }

    return data !== null;
  }

  /**
   * Check if content hash exists across any source for a target
   * Used for cross-source deduplication
   */
  async hasBeenSeenForTarget(
    contentHash: string,
    targetId: string,
  ): Promise<boolean> {
    // This requires a join with sources table to filter by target
    // For simplicity, we query the database directly
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .rpc('check_content_hash_for_target', {
        p_content_hash: contentHash,
        p_target_id: targetId,
      })) as SupabaseSelectResponse<boolean>;

    if (error) {
      // If the function doesn't exist, fall back to simple check
      if (error.code === 'PGRST202') {
        this.logger.debug(
          'check_content_hash_for_target function not found, skipping cross-source check',
        );
        return false;
      }
      this.logger.error(
        `Failed to check seen item for target: ${error.message}`,
      );
      throw new Error(`Failed to check seen item for target: ${error.message}`);
    }

    return data ?? false;
  }

  /**
   * Find a seen item by content hash
   */
  async findByContentHash(
    sourceId: string,
    contentHash: string,
  ): Promise<SourceSeenItem | null> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('source_id', sourceId)
      .eq('content_hash', contentHash)
      .single()) as SupabaseSelectResponse<SourceSeenItem>;

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to find seen item: ${error.message}`);
      throw new Error(`Failed to find seen item: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a seen item record
   */
  async create(itemData: CreateSourceSeenItemData): Promise<SourceSeenItem> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .insert({
        ...itemData,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single()) as SupabaseSelectResponse<SourceSeenItem>;

    if (error) {
      this.logger.error(`Failed to create seen item: ${error.message}`);
      throw new Error(`Failed to create seen item: ${error.message}`);
    }

    if (!data) {
      throw new Error('Create succeeded but no seen item returned');
    }

    return data;
  }

  /**
   * Update last_seen_at for an existing seen item
   */
  async updateLastSeen(id: string): Promise<void> {
    const { error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to update seen item: ${error.message}`);
      throw new Error(`Failed to update seen item: ${error.message}`);
    }
  }

  /**
   * Mark content as seen, creating or updating as needed
   * Returns true if this was a new item, false if duplicate
   */
  async markSeen(
    sourceId: string,
    contentHash: string,
    url?: string,
    signalId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ isNew: boolean; seenItem: SourceSeenItem }> {
    const existing = await this.findByContentHash(sourceId, contentHash);

    if (existing) {
      await this.updateLastSeen(existing.id);
      return { isNew: false, seenItem: existing };
    }

    const seenItem = await this.create({
      source_id: sourceId,
      content_hash: contentHash,
      original_url: url,
      signal_id: signalId,
      metadata,
    });

    return { isNew: true, seenItem };
  }

  /**
   * Get recent seen items for a source
   */
  async findRecentBySourceId(
    sourceId: string,
    limit = 100,
  ): Promise<SourceSeenItem[]> {
    const { data, error } = (await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .select('*')
      .eq('source_id', sourceId)
      .order('last_seen_at', { ascending: false })
      .limit(limit)) as SupabaseSelectListResponse<SourceSeenItem>;

    if (error) {
      this.logger.error(`Failed to fetch seen items: ${error.message}`);
      throw new Error(`Failed to fetch seen items: ${error.message}`);
    }

    return data ?? [];
  }

  /**
   * Delete old seen items to prevent unbounded growth
   * Keeps items seen within the retention period
   */
  async cleanupOldItems(sourceId: string, retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await this.getClient()
      .schema(this.schema)
      .from(this.table)
      .delete()
      .eq('source_id', sourceId)
      .lt('last_seen_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      this.logger.error(`Failed to cleanup seen items: ${error.message}`);
      throw new Error(`Failed to cleanup seen items: ${error.message}`);
    }

    const deletedCount = data?.length ?? 0;
    if (deletedCount > 0) {
      this.logger.debug(
        `Cleaned up ${deletedCount} old seen items for source ${sourceId}`,
      );
    }

    return deletedCount;
  }
}
