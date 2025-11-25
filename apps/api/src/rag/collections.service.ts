import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RagDatabaseService } from './rag-database.service';
import { CreateCollectionDto, UpdateCollectionDto } from './dto';

export interface RagCollection {
  id: string;
  organizationSlug: string;
  name: string;
  slug: string;
  description: string | null;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  status: 'active' | 'processing' | 'error';
  requiredRole: string | null;
  allowedUsers: string[] | null;
  createdBy: string | null;
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DbCollection {
  id: string;
  organization_slug: string;
  name: string;
  slug: string;
  description: string | null;
  embedding_model: string;
  embedding_dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  status: string;
  required_role: string | null;
  allowed_users: string[] | null;
  document_count: number;
  chunk_count: number;
  total_tokens: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(private ragDb: RagDatabaseService) {}

  /**
   * Convert database row to API response format
   */
  private toCollection(row: DbCollection): RagCollection {
    return {
      id: row.id,
      organizationSlug: row.organization_slug,
      name: row.name,
      slug: row.slug,
      description: row.description,
      embeddingModel: row.embedding_model,
      embeddingDimensions: row.embedding_dimensions,
      chunkSize: row.chunk_size,
      chunkOverlap: row.chunk_overlap,
      status: row.status as 'active' | 'processing' | 'error',
      requiredRole: row.required_role,
      allowedUsers: row.allowed_users,
      createdBy: row.created_by,
      documentCount: row.document_count,
      chunkCount: row.chunk_count,
      totalTokens: row.total_tokens,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get embedding dimensions for a model
   */
  private getEmbeddingDimensions(model: string): number {
    const dimensions: Record<string, number> = {
      'nomic-embed-text': 768,
      'mxbai-embed-large': 1024,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
    };
    return dimensions[model] || 768;
  }

  /**
   * List all collections for an organization
   * If userId is provided, filters to collections the user can access
   */
  async getCollections(
    organizationSlug: string,
    userId?: string,
  ): Promise<RagCollection[]> {
    const rows = await this.ragDb.queryAll<DbCollection>(
      'SELECT * FROM rag_get_collections($1, $2)',
      [organizationSlug, userId || null],
    );

    return rows.map((row) => this.toCollection(row));
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(
    collectionId: string,
    organizationSlug: string,
  ): Promise<RagCollection> {
    const row = await this.ragDb.queryOne<DbCollection>(
      'SELECT * FROM rag_get_collection($1, $2)',
      [collectionId, organizationSlug],
    );

    if (!row) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    return this.toCollection(row);
  }

  /**
   * Create a new collection
   */
  async createCollection(
    organizationSlug: string,
    dto: CreateCollectionDto,
    userId?: string,
  ): Promise<RagCollection> {
    const slug = dto.slug || this.generateSlug(dto.name);
    const embeddingModel = dto.embeddingModel || 'nomic-embed-text';
    const embeddingDimensions = this.getEmbeddingDimensions(embeddingModel);

    // Handle privateToCreator flag - sets allowed_users to just the creator
    let allowedUsers = dto.allowedUsers || null;
    if (dto.privateToCreator && userId) {
      allowedUsers = [userId];
    }

    const row = await this.ragDb.queryOne<DbCollection>(
      `SELECT * FROM rag_create_collection($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        organizationSlug,
        dto.name,
        slug,
        dto.description || null,
        embeddingModel,
        embeddingDimensions,
        dto.chunkSize || 1000,
        dto.chunkOverlap || 200,
        userId || null,
        dto.requiredRole || null,
        allowedUsers,
      ],
    );

    if (!row) {
      throw new Error('Failed to create collection');
    }

    return this.toCollection(row);
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    organizationSlug: string,
    dto: UpdateCollectionDto,
  ): Promise<RagCollection> {
    const row = await this.ragDb.queryOne<DbCollection>(
      `SELECT * FROM rag_update_collection($1, $2, $3, $4, $5, $6, $7)`,
      [
        collectionId,
        organizationSlug,
        dto.name || null,
        dto.description || null,
        dto.requiredRole !== undefined ? dto.requiredRole : null,
        dto.allowedUsers || null,
        dto.clearAllowedUsers || false,
      ],
    );

    if (!row) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    return this.toCollection(row);
  }

  /**
   * Delete a collection
   */
  async deleteCollection(
    collectionId: string,
    organizationSlug: string,
  ): Promise<boolean> {
    const result = await this.ragDb.queryOne<{
      rag_delete_collection: boolean;
    }>('SELECT rag_delete_collection($1, $2)', [
      collectionId,
      organizationSlug,
    ]);

    if (!result?.rag_delete_collection) {
      throw new NotFoundException(`Collection ${collectionId} not found`);
    }

    return true;
  }
}
