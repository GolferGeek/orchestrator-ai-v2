/**
 * RAG Service
 *
 * Handles all RAG-related API calls for collections, documents, and queries.
 * Components/stores should use this service for RAG data operations.
 */

import { apiService } from './apiService';

// Types
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
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface RagDocument {
  id: string;
  collectionId: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage: string | null;
  chunkCount: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
}

export interface RagChunk {
  id: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  content: string;
  score: number;
  pageNumber: number | null;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface QueryResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchDurationMs: number;
}

export interface CreateCollectionDto {
  name: string;
  slug?: string;
  description?: string;
  embeddingModel?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
  requiredRole?: string | null;
}

export interface QueryCollectionDto {
  query: string;
  topK?: number;
  similarityThreshold?: number;
  strategy?: 'basic' | 'mmr' | 'reranking';
  includeMetadata?: boolean;
}

export interface UploadResponse {
  id: string;
  filename: string;
  status: string;
  message: string;
}

class RagService {
  private getOrgHeader(organizationSlug: string): Record<string, string> {
    return { 'x-organization-slug': organizationSlug };
  }

  // ==================== Collections ====================

  /**
   * Get all collections for an organization
   */
  async getCollections(organizationSlug: string): Promise<RagCollection[]> {
    const response = await apiService.get<RagCollection[]>(
      '/api/rag/collections',
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Get a single collection by ID
   */
  async getCollection(
    collectionId: string,
    organizationSlug: string,
  ): Promise<RagCollection> {
    const response = await apiService.get<RagCollection>(
      `/api/rag/collections/${collectionId}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Create a new collection
   */
  async createCollection(
    organizationSlug: string,
    data: CreateCollectionDto,
  ): Promise<RagCollection> {
    const response = await apiService.post<RagCollection>(
      '/api/rag/collections',
      data,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Update a collection
   */
  async updateCollection(
    collectionId: string,
    organizationSlug: string,
    data: UpdateCollectionDto,
  ): Promise<RagCollection> {
    const response = await apiService.patch<RagCollection>(
      `/api/rag/collections/${collectionId}`,
      data,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(
    collectionId: string,
    organizationSlug: string,
  ): Promise<void> {
    await apiService.delete(
      `/api/rag/collections/${collectionId}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
  }

  // ==================== Documents ====================

  /**
   * Get all documents in a collection
   */
  async getDocuments(
    collectionId: string,
    organizationSlug: string,
  ): Promise<RagDocument[]> {
    const response = await apiService.get<RagDocument[]>(
      `/api/rag/collections/${collectionId}/documents`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Get a single document
   */
  async getDocument(
    collectionId: string,
    documentId: string,
    organizationSlug: string,
  ): Promise<RagDocument> {
    const response = await apiService.get<RagDocument>(
      `/api/rag/collections/${collectionId}/documents/${documentId}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  /**
   * Upload a document to a collection
   */
  async uploadDocument(
    collectionId: string,
    organizationSlug: string,
    file: File,
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiService.post<UploadResponse>(
      `/api/rag/collections/${collectionId}/documents`,
      formData,
      {
        headers: {
          ...this.getOrgHeader(organizationSlug),
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response;
  }

  /**
   * Delete a document
   */
  async deleteDocument(
    collectionId: string,
    documentId: string,
    organizationSlug: string,
  ): Promise<void> {
    await apiService.delete(
      `/api/rag/collections/${collectionId}/documents/${documentId}`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
  }

  /**
   * Get chunks for a document
   */
  async getDocumentChunks(
    collectionId: string,
    documentId: string,
    organizationSlug: string,
  ): Promise<RagChunk[]> {
    const response = await apiService.get<RagChunk[]>(
      `/api/rag/collections/${collectionId}/documents/${documentId}/chunks`,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }

  // ==================== Query ====================

  /**
   * Query a collection for relevant chunks
   */
  async queryCollection(
    collectionId: string,
    organizationSlug: string,
    query: QueryCollectionDto,
  ): Promise<QueryResponse> {
    const response = await apiService.post<QueryResponse>(
      `/api/rag/collections/${collectionId}/query`,
      query,
      { headers: this.getOrgHeader(organizationSlug) },
    );
    return response;
  }
}

export const ragService = new RagService();
export default ragService;
