import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '@/supabase/supabase.service';
import { getTableName } from '@/supabase/supabase.config';
import type { ExecutionContext } from '@orchestrator-ai/transport-types';
import { randomUUID } from 'crypto';

/**
 * Result of storing generated media
 */
export interface StoredMediaResult {
  /** Our internal asset UUID */
  assetId: string;
  /** Public URL to access the media */
  url: string;
  /** Storage path within bucket */
  storagePath: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Metadata for stored media
 */
export interface MediaStorageMetadata {
  /** Original prompt used to generate */
  prompt: string;
  /** Provider-revised prompt (if applicable) */
  revisedPrompt?: string;
  /** Provider name (openai, google) */
  provider: string;
  /** Model used (gpt-image-1.5, imagen-4.0-generate-001) */
  model: string;
  /** MIME type */
  mime: string;
  /** Image/video width in pixels */
  width?: number;
  /** Image/video height in pixels */
  height?: number;
  /** Video duration in seconds */
  durationSeconds?: number;
  /** Parent asset ID if this is an edit/variation */
  parentAssetId?: string;
}

/**
 * Media Storage Helper
 *
 * Handles storage of generated media (images, videos) to Supabase Storage
 * and creates corresponding asset records in the assets table.
 *
 * Storage Structure:
 * ```
 * media/
 *   {orgSlug}/
 *     {conversationId}/
 *       {taskId}/
 *         {uuid}.{ext}
 * ```
 *
 * ExecutionContext Flow:
 * - Uses context.orgSlug for organization path
 * - Uses context.conversationId for conversation path
 * - Uses context.taskId for task path and request correlation
 * - Uses context.userId for asset ownership
 *
 * @example
 * ```typescript
 * const result = await mediaStorage.storeGeneratedMedia(
 *   imageBuffer,
 *   executionContext,
 *   {
 *     prompt: 'A sunset over mountains',
 *     provider: 'openai',
 *     model: 'gpt-image-1.5',
 *     mime: 'image/png',
 *   }
 * );
 * // result: { assetId: '...', url: 'https://...', storagePath: '...', mimeType: '...', sizeBytes: 12345 }
 * ```
 */
@Injectable()
export class MediaStorageHelper {
  private readonly logger = new Logger(MediaStorageHelper.name);
  private readonly bucketName = process.env.MEDIA_STORAGE_BUCKET || 'media';
  /**
   * When PUBLIC_API_URL is set, generates API-proxied storage URLs
   * instead of direct Supabase URLs (which may not be browser-reachable).
   */
  private readonly publicApiUrl = process.env.PUBLIC_API_URL;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Store generated media bytes to Supabase storage and create asset record
   *
   * @param data - Raw media bytes (Buffer)
   * @param context - ExecutionContext for ownership and path construction
   * @param metadata - Media metadata (prompt, provider, model, etc.)
   * @returns StoredMediaResult with assetId, url, storagePath
   */
  async storeGeneratedMedia(
    data: Buffer,
    context: ExecutionContext,
    metadata: MediaStorageMetadata,
  ): Promise<StoredMediaResult> {
    const client = this.supabaseService.getServiceClient();

    // Generate unique filename
    const assetId = randomUUID();
    const extension = this.getExtensionFromMime(metadata.mime);
    const filename = `${assetId}.${extension}`;

    // Build storage path using ExecutionContext
    // Structure: {orgSlug}/{conversationId}/{taskId}/{filename}
    const storagePath = this.buildStoragePath(context, filename);

    this.logger.log(
      `📦 [MEDIA-STORAGE] Storing media: ${storagePath} (${data.length} bytes)`,
    );

    // Upload to Supabase storage
    const { error: uploadError } = await client.storage
      .from(this.bucketName)
      .upload(storagePath, data, {
        contentType: metadata.mime,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(
        `📦 [MEDIA-STORAGE] Upload failed: ${uploadError.message}`,
      );
      throw new Error(`Failed to upload media: ${uploadError.message}`);
    }

    // Get public URL (API-proxied if PUBLIC_API_URL is set)
    const publicUrl = this.buildPublicUrl(storagePath, this.bucketName);

    this.logger.log(`📦 [MEDIA-STORAGE] Uploaded successfully: ${publicUrl}`);

    // Create asset record in database
    const insertResult = await client
      .from(getTableName('assets'))
      .insert({
        id: assetId,
        storage: 'supabase',
        bucket: this.bucketName,
        object_key: storagePath,
        mime: metadata.mime,
        size: data.length,
        width: metadata.width || null,
        height: metadata.height || null,
        // Link to ExecutionContext
        user_id: context.userId,
        conversation_id: context.conversationId,
        // Metadata
        metadata: {
          prompt: metadata.prompt,
          revisedPrompt: metadata.revisedPrompt,
          provider: metadata.provider,
          model: metadata.model,
          taskId: context.taskId,
          orgSlug: context.orgSlug,
          durationSeconds: metadata.durationSeconds,
          parentAssetId: metadata.parentAssetId,
        },
      })
      .select()
      .single();

    const assetError = insertResult.error;
    if (assetError) {
      this.logger.error(
        `📦 [MEDIA-STORAGE] Asset record creation failed: ${assetError.message}`,
      );
      // Try to clean up uploaded file
      await client.storage.from(this.bucketName).remove([storagePath]);
      throw new Error(`Failed to create asset record: ${assetError.message}`);
    }

    const assetRecord = insertResult.data as { id: string } | null;
    if (!assetRecord) {
      throw new Error('Failed to create asset record: no data returned');
    }

    this.logger.log(
      `📦 [MEDIA-STORAGE] Asset record created: ${assetRecord.id}`,
    );

    return {
      assetId: assetRecord.id,
      url: publicUrl,
      storagePath,
      mimeType: metadata.mime,
      sizeBytes: data.length,
    };
  }

  /**
   * Download media from a provider URL and store in Supabase
   *
   * @param url - Source URL to download from
   * @param context - ExecutionContext for ownership
   * @param metadata - Media metadata
   * @returns StoredMediaResult
   */
  async downloadAndStore(
    url: string,
    context: ExecutionContext,
    metadata: MediaStorageMetadata,
  ): Promise<StoredMediaResult> {
    this.logger.log(`📦 [MEDIA-STORAGE] Downloading from: ${url}`);

    // Download the media
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    // Store using the normal method
    return this.storeGeneratedMedia(data, context, metadata);
  }

  /**
   * Get an existing asset by ID
   *
   * @param assetId - Asset UUID
   * @param context - ExecutionContext for authorization
   * @returns Asset record or null
   */
  async getAsset(
    assetId: string,
    context: ExecutionContext,
  ): Promise<{
    id: string;
    url: string;
    mime: string;
    width?: number;
    height?: number;
    metadata?: Record<string, unknown>;
  } | null> {
    const client = this.supabaseService.getServiceClient();

    const queryResult = await client
      .from(getTableName('assets'))
      .select('*')
      .eq('id', assetId)
      .single();

    if (queryResult.error || !queryResult.data) {
      return null;
    }

    // Verify ownership - asset should belong to same conversation or user
    const record = queryResult.data as {
      id: string;
      conversation_id: string | null;
      user_id: string | null;
      bucket: string;
      object_key: string;
      mime: string;
      width?: number;
      height?: number;
      metadata?: Record<string, unknown>;
    };

    if (
      record.conversation_id &&
      record.conversation_id !== context.conversationId
    ) {
      this.logger.warn(
        `📦 [MEDIA-STORAGE] Asset ${assetId} not in conversation ${context.conversationId}`,
      );
      return null;
    }

    // Build URL (API-proxied if PUBLIC_API_URL is set)
    const assetUrl = this.buildPublicUrl(record.object_key, record.bucket || this.bucketName);

    return {
      id: record.id,
      url: assetUrl,
      mime: record.mime,
      width: record.width,
      height: record.height,
      metadata: record.metadata,
    };
  }

  /**
   * Link an asset to a deliverable version
   *
   * @param assetId - Asset UUID
   * @param deliverableVersionId - Deliverable version UUID
   * @param context - ExecutionContext
   */
  async linkToDeliverableVersion(
    assetId: string,
    deliverableVersionId: string,
    _context: ExecutionContext,
  ): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    const { error } = await client
      .from(getTableName('assets'))
      .update({
        deliverable_version_id: deliverableVersionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    if (error) {
      this.logger.error(
        `📦 [MEDIA-STORAGE] Failed to link asset ${assetId} to version ${deliverableVersionId}: ${error.message}`,
      );
      throw new Error(`Failed to link asset to deliverable: ${error.message}`);
    }

    this.logger.log(
      `📦 [MEDIA-STORAGE] Linked asset ${assetId} to version ${deliverableVersionId}`,
    );
  }

  /**
   * Delete an asset (soft delete or hard delete based on config)
   *
   * @param assetId - Asset UUID
   * @param context - ExecutionContext for authorization
   */
  async deleteAsset(assetId: string, context: ExecutionContext): Promise<void> {
    const client = this.supabaseService.getServiceClient();

    // Get asset to verify ownership and get storage path
    const asset = await this.getAsset(assetId, context);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found or not accessible`);
    }

    // Get full asset record for storage path
    const { data: record } = await client
      .from(getTableName('assets'))
      .select('bucket, object_key')
      .eq('id', assetId)
      .single();

    if (record) {
      const typedRecord = record as { bucket: string; object_key: string };

      // Delete from storage
      const { error: storageError } = await client.storage
        .from(typedRecord.bucket || this.bucketName)
        .remove([typedRecord.object_key]);

      if (storageError) {
        this.logger.warn(
          `📦 [MEDIA-STORAGE] Storage deletion warning: ${storageError.message}`,
        );
      }
    }

    // Delete record
    const { error: dbError } = await client
      .from(getTableName('assets'))
      .delete()
      .eq('id', assetId);

    if (dbError) {
      throw new Error(`Failed to delete asset record: ${dbError.message}`);
    }

    this.logger.log(`📦 [MEDIA-STORAGE] Deleted asset ${assetId}`);
  }

  /**
   * Build storage path from ExecutionContext
   */
  private buildStoragePath(
    context: ExecutionContext,
    filename: string,
  ): string {
    const orgSlug = context.orgSlug || 'global';
    const conversationId = context.conversationId || 'unknown';
    const taskId = context.taskId || 'unknown';

    return `${orgSlug}/${conversationId}/${taskId}/${filename}`;
  }

  /**
   * Build a browser-reachable URL for a storage path.
   * If PUBLIC_API_URL is set, generates: {PUBLIC_API_URL}/assets/storage/{bucket}/{path}
   * Otherwise falls back to Supabase's getPublicUrl.
   */
  private buildPublicUrl(storagePath: string, bucket: string): string {
    if (this.publicApiUrl) {
      const base = this.publicApiUrl.replace(/\/$/, '');
      return `${base}/assets/storage/${bucket}/${storagePath}`;
    }
    const client = this.supabaseService.getServiceClient();
    const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMime(mime: string): string {
    const mimeMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/mpeg': 'mp3',
    };

    return mimeMap[mime] || 'bin';
  }
}
