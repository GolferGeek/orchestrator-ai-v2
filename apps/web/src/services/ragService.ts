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
  allowedUsers: string[] | null;
  createdBy: string | null;
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
  requiredRole?: string | null;
  allowedUsers?: string[] | null;
  privateToCreator?: boolean;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
  requiredRole?: string | null;
  allowedUsers?: string[] | null;
  clearAllowedUsers?: boolean;
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
    // Clean up the data - remove empty slug to allow auto-generation
    const cleanData = { ...data };
    if (!cleanData.slug || cleanData.slug.trim() === '') {
      delete cleanData.slug;
    }
    
    const response = await apiService.post<RagCollection>(
      '/api/rag/collections',
      cleanData,
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

    // For files from folder selection, we need to use the filename (not the full path)
    // and ensure the MIME type is correct
    const filename = file.name;
    const mimeType = this.getMimeType(filename);

    // Create a new File with correct MIME type if needed
    const uploadFile = mimeType !== file.type
      ? new File([file], filename, { type: mimeType })
      : file;

    formData.append('file', uploadFile, filename);

    // Use postFormData which handles multipart correctly
    const response = await apiService.postFormData<UploadResponse>(
      `/api/rag/collections/${collectionId}/documents`,
      formData,
      this.getOrgHeader(organizationSlug),
    );
    return response;
  }

  /**
   * Get correct MIME type for file based on extension
   */
  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
      markdown: 'text/markdown',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
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

  // ==================== Batch Upload ====================

  /**
   * Upload multiple files from a folder selection
   * Updates ragStore with progress and results
   */
  async uploadFolderFiles(
    collectionId: string,
    organizationSlug: string,
    files: File[],
  ): Promise<{ success: number; failed: number }> {
    // Import store lazily to avoid circular dependencies
    const { useRagStore } = await import('@/stores/ragStore');
    const ragStore = useRagStore();

    // Initialize batch upload in store
    const items = files.map(file => ({
      path: file.webkitRelativePath || file.name,
      name: file.name,
    }));
    ragStore.initBatchUpload(items);

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      // Check if cancelled
      if (ragStore.batchUploadCancelled) {
        break;
      }

      const file = files[i];
      const path = file.webkitRelativePath || file.name;

      // Update progress
      ragStore.updateBatchUploadProgress(i + 1, file.name);
      ragStore.updateBatchUploadItem(path, 'processing');

      try {
        const response = await this.uploadDocument(collectionId, organizationSlug, file);

        // Check response status
        if (response.status === 'completed') {
          ragStore.updateBatchUploadItem(path, 'success');
          ragStore.incrementBatchUploadResult(true);
        } else if (response.status === 'error') {
          ragStore.updateBatchUploadItem(path, 'error', response.message);
          ragStore.incrementBatchUploadResult(false);
        } else {
          // Legacy pending status - treat as success
          ragStore.updateBatchUploadItem(path, 'success');
          ragStore.incrementBatchUploadResult(true);
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        ragStore.updateBatchUploadItem(path, 'error', errorMsg);
        ragStore.incrementBatchUploadResult(false);
      }
    }

    // Mark batch upload as finished
    ragStore.finishBatchUpload();

    // Refresh documents list
    try {
      const docs = await this.getDocuments(collectionId, organizationSlug);
      ragStore.setDocuments(docs);
    } catch {
      // Ignore refresh errors
    }

    return {
      success: ragStore.batchUploadResults.success,
      failed: ragStore.batchUploadResults.failed,
    };
  }
}

export const ragService = new RagService();
export default ragService;
