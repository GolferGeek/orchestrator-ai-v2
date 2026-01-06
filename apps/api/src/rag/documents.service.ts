import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RagDatabaseService } from './rag-database.service';

export interface RagDocument {
  id: string;
  collectionId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  fileHash: string | null;
  storagePath: string | null;
  content: string | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage: string | null;
  chunkCount: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}

interface DbDocument {
  id: string;
  collection_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  file_hash: string | null;
  storage_path: string | null;
  content: string | null;
  status: string;
  error_message: string | null;
  chunk_count: number;
  token_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  processed_at: Date | null;
}

export interface RagChunk {
  id: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
}

interface DbChunk {
  id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  page_number: number | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private ragDb: RagDatabaseService) {}

  /**
   * Convert database row to API response format
   */
  private toDocument(row: DbDocument): RagDocument {
    return {
      id: row.id,
      collectionId: row.collection_id,
      filename: row.filename,
      fileType: row.file_type,
      fileSize: row.file_size,
      fileHash: row.file_hash,
      storagePath: row.storage_path,
      content: row.content,
      status: row.status as RagDocument['status'],
      errorMessage: row.error_message,
      chunkCount: row.chunk_count,
      tokenCount: row.token_count,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at,
    };
  }

  /**
   * Convert chunk row to API format
   */
  private toChunk(row: DbChunk): RagChunk {
    return {
      id: row.id,
      content: row.content,
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count,
      pageNumber: row.page_number,
      metadata: row.metadata || {},
    };
  }

  /**
   * List documents for a collection
   */
  async getDocuments(
    collectionId: string,
    organizationSlug: string,
  ): Promise<RagDocument[]> {
    const rows = await this.ragDb.queryAll<DbDocument>(
      'SELECT * FROM rag_get_documents($1, $2)',
      [collectionId, organizationSlug],
    );

    return rows.map((row) => this.toDocument(row));
  }

  /**
   * Get a single document
   */
  async getDocument(
    documentId: string,
    organizationSlug: string,
  ): Promise<RagDocument> {
    const row = await this.ragDb.queryOne<DbDocument>(
      'SELECT * FROM rag_get_document($1, $2)',
      [documentId, organizationSlug],
    );

    if (!row) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return this.toDocument(row);
  }

  /**
   * Create a document record (before processing)
   */
  async createDocument(
    collectionId: string,
    organizationSlug: string,
    filename: string,
    fileType: string,
    fileSize: number,
    fileHash?: string,
    storagePath?: string,
    userId?: string,
    content?: string,
  ): Promise<RagDocument> {
    const row = await this.ragDb.queryOne<DbDocument>(
      'SELECT * FROM rag_insert_document($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        collectionId,
        organizationSlug,
        filename,
        fileType,
        fileSize,
        fileHash || null,
        storagePath || null,
        userId || null,
        content || null,
      ],
    );

    if (!row) {
      throw new NotFoundException(
        `Collection ${collectionId} not found or not accessible`,
      );
    }

    this.logger.log(
      `Created document ${filename} (${row.id}) in collection ${collectionId}`,
    );

    return this.toDocument(row);
  }

  /**
   * Update document content (after text extraction)
   */
  async updateDocumentContent(
    documentId: string,
    organizationSlug: string,
    content: string,
  ): Promise<void> {
    await this.ragDb.execute(
      `UPDATE rag_data.rag_documents
       SET content = $1, updated_at = NOW()
       WHERE id = $2 AND organization_slug = $3`,
      [content, documentId, organizationSlug],
    );

    this.logger.log(`Updated content for document ${documentId}`);
  }

  /**
   * Get document content only (for document viewer)
   */
  async getDocumentContent(
    documentId: string,
    organizationSlug: string,
  ): Promise<{
    id: string;
    filename: string;
    fileType: string;
    content: string | null;
    chunkCount: number;
  } | null> {
    const row = await this.ragDb.queryOne<{
      id: string;
      filename: string;
      file_type: string;
      content: string | null;
      chunk_count: number;
    }>('SELECT * FROM rag_get_document_content($1, $2)', [
      documentId,
      organizationSlug,
    ]);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      filename: row.filename,
      fileType: row.file_type,
      content: row.content,
      chunkCount: row.chunk_count,
    };
  }

  /**
   * Update document status
   */
  async updateDocumentStatus(
    documentId: string,
    organizationSlug: string,
    status: RagDocument['status'],
    errorMessage?: string,
    chunkCount?: number,
    tokenCount?: number,
  ): Promise<RagDocument> {
    const row = await this.ragDb.queryOne<DbDocument>(
      'SELECT * FROM rag_update_document_status($1, $2, $3, $4, $5, $6)',
      [
        documentId,
        organizationSlug,
        status,
        errorMessage || null,
        chunkCount || null,
        tokenCount || null,
      ],
    );

    if (!row) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return this.toDocument(row);
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    documentId: string,
    organizationSlug: string,
  ): Promise<boolean> {
    const result = await this.ragDb.queryOne<{ rag_delete_document: boolean }>(
      'SELECT rag_delete_document($1, $2)',
      [documentId, organizationSlug],
    );

    if (!result?.rag_delete_document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    this.logger.log(`Deleted document ${documentId}`);

    return true;
  }

  /**
   * Get chunks for a document
   */
  async getDocumentChunks(
    documentId: string,
    organizationSlug: string,
  ): Promise<RagChunk[]> {
    const rows = await this.ragDb.queryAll<DbChunk>(
      'SELECT * FROM rag_get_document_chunks($1, $2)',
      [documentId, organizationSlug],
    );

    return rows.map((row) => this.toChunk(row));
  }

  /**
   * Insert chunks for a document
   */
  async insertChunks(
    documentId: string,
    organizationSlug: string,
    chunks: Array<{
      content: string;
      chunkIndex: number;
      embedding?: number[];
      tokenCount: number;
      pageNumber?: number;
      charOffset?: number;
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<number> {
    // Convert to JSONB format expected by the function
    const chunksJsonb = chunks.map((chunk) => ({
      content: chunk.content,
      chunk_index: chunk.chunkIndex,
      embedding: chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
      token_count: chunk.tokenCount,
      page_number: chunk.pageNumber || null,
      char_offset: chunk.charOffset || null,
      metadata: chunk.metadata || {},
    }));

    const result = await this.ragDb.queryOne<{ rag_insert_chunks: number }>(
      'SELECT rag_insert_chunks($1, $2, $3::jsonb)',
      [documentId, organizationSlug, JSON.stringify(chunksJsonb)],
    );

    const insertedCount = result?.rag_insert_chunks || 0;
    this.logger.log(
      `Inserted ${insertedCount} chunks for document ${documentId}`,
    );

    return insertedCount;
  }
}
