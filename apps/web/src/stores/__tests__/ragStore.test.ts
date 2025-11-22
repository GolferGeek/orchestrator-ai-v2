/**
 * Unit Tests for RAG Store
 * Tests all state mutations and computed properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRagStore } from '../ragStore';
import type { RagCollection, RagDocument, SearchResult } from '@/services/ragService';

// Test fixtures
const mockCollection: RagCollection = {
  id: 'col-1',
  organizationSlug: 'demo-org',
  name: 'Test Collection',
  slug: 'test-collection',
  description: 'A test collection',
  embeddingModel: 'nomic-embed-text',
  embeddingDimension: 768,
  chunkSize: 1000,
  chunkOverlap: 200,
  documentCount: 5,
  chunkCount: 50,
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockDocument: RagDocument = {
  id: 'doc-1',
  collectionId: 'col-1',
  filename: 'test.pdf',
  fileType: 'application/pdf',
  fileSize: 1024,
  status: 'completed',
  chunkCount: 10,
  tokenCount: 500,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockSearchResult: SearchResult = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  documentFilename: 'test.pdf',
  content: 'This is test content',
  score: 0.95,
  pageNumber: 1,
};

describe('RagStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Store Initialization', () => {
    it('should initialize with default state', () => {
      const store = useRagStore();

      expect(store.collections).toEqual([]);
      expect(store.currentCollection).toBeNull();
      expect(store.collectionsLoading).toBe(false);
      expect(store.collectionsError).toBeNull();

      expect(store.documents).toEqual([]);
      expect(store.currentDocument).toBeNull();
      expect(store.documentsLoading).toBe(false);
      expect(store.documentsError).toBeNull();

      expect(store.chunks).toEqual([]);
      expect(store.chunksLoading).toBe(false);

      expect(store.searchResults).toEqual([]);
      expect(store.searchQuery).toBe('');
      expect(store.searchLoading).toBe(false);
      expect(store.searchError).toBeNull();
      expect(store.lastSearchDuration).toBeNull();
    });
  });

  describe('Collections', () => {
    it('should set collections', () => {
      const store = useRagStore();
      const collections = [mockCollection, { ...mockCollection, id: 'col-2', name: 'Second' }];

      store.setCollections(collections);

      expect(store.collections).toHaveLength(2);
      expect(store.hasCollections).toBe(true);
    });

    it('should set current collection', () => {
      const store = useRagStore();

      store.setCurrentCollection(mockCollection);

      expect(store.currentCollection).toEqual(mockCollection);
    });

    it('should add collection', () => {
      const store = useRagStore();
      store.setCollections([mockCollection]);

      const newCollection = { ...mockCollection, id: 'col-2', name: 'New Collection' };
      store.addCollection(newCollection);

      expect(store.collections).toHaveLength(2);
      expect(store.collections[1].name).toBe('New Collection');
    });

    it('should update collection in list', () => {
      const store = useRagStore();
      store.setCollections([mockCollection]);
      store.setCurrentCollection(mockCollection);

      const updated = { ...mockCollection, name: 'Updated Name' };
      store.updateCollectionInList(updated);

      expect(store.collections[0].name).toBe('Updated Name');
      expect(store.currentCollection?.name).toBe('Updated Name');
    });

    it('should remove collection', () => {
      const store = useRagStore();
      store.setCollections([mockCollection]);
      store.setCurrentCollection(mockCollection);

      store.removeCollection('col-1');

      expect(store.collections).toHaveLength(0);
      expect(store.currentCollection).toBeNull();
    });

    it('should set collections loading state', () => {
      const store = useRagStore();

      store.setCollectionsLoading(true);
      expect(store.collectionsLoading).toBe(true);

      store.setCollectionsLoading(false);
      expect(store.collectionsLoading).toBe(false);
    });

    it('should set collections error', () => {
      const store = useRagStore();

      store.setCollectionsError('Failed to load');
      expect(store.collectionsError).toBe('Failed to load');

      store.setCollectionsError(null);
      expect(store.collectionsError).toBeNull();
    });
  });

  describe('Documents', () => {
    it('should set documents', () => {
      const store = useRagStore();
      const documents = [mockDocument, { ...mockDocument, id: 'doc-2' }];

      store.setDocuments(documents);

      expect(store.documents).toHaveLength(2);
    });

    it('should set current document', () => {
      const store = useRagStore();

      store.setCurrentDocument(mockDocument);

      expect(store.currentDocument).toEqual(mockDocument);
    });

    it('should add document', () => {
      const store = useRagStore();
      store.setDocuments([mockDocument]);

      const newDoc = { ...mockDocument, id: 'doc-2', filename: 'new.pdf' };
      store.addDocument(newDoc);

      expect(store.documents).toHaveLength(2);
    });

    it('should update document in list', () => {
      const store = useRagStore();
      store.setDocuments([mockDocument]);
      store.setCurrentDocument(mockDocument);

      const updated = { ...mockDocument, status: 'processing' as const };
      store.updateDocumentInList(updated);

      expect(store.documents[0].status).toBe('processing');
      expect(store.currentDocument?.status).toBe('processing');
    });

    it('should remove document', () => {
      const store = useRagStore();
      store.setDocuments([mockDocument]);
      store.setCurrentDocument(mockDocument);

      store.removeDocument('doc-1');

      expect(store.documents).toHaveLength(0);
      expect(store.currentDocument).toBeNull();
    });

    it('should filter processing documents', () => {
      const store = useRagStore();
      store.setDocuments([
        mockDocument,
        { ...mockDocument, id: 'doc-2', status: 'processing' },
        { ...mockDocument, id: 'doc-3', status: 'pending' },
      ]);

      expect(store.processingDocuments).toHaveLength(2);
    });

    it('should filter completed documents', () => {
      const store = useRagStore();
      store.setDocuments([
        mockDocument,
        { ...mockDocument, id: 'doc-2', status: 'processing' },
      ]);

      expect(store.completedDocuments).toHaveLength(1);
    });

    it('should filter error documents', () => {
      const store = useRagStore();
      store.setDocuments([
        mockDocument,
        { ...mockDocument, id: 'doc-2', status: 'error' },
      ]);

      expect(store.errorDocuments).toHaveLength(1);
    });
  });

  describe('Computed Properties', () => {
    it('should calculate total documents from collections', () => {
      const store = useRagStore();
      store.setCollections([
        { ...mockCollection, documentCount: 5 },
        { ...mockCollection, id: 'col-2', documentCount: 10 },
      ]);

      expect(store.totalDocuments).toBe(15);
    });

    it('should calculate total chunks from collections', () => {
      const store = useRagStore();
      store.setCollections([
        { ...mockCollection, chunkCount: 50 },
        { ...mockCollection, id: 'col-2', chunkCount: 100 },
      ]);

      expect(store.totalChunks).toBe(150);
    });

    it('should return hasCollections as false when empty', () => {
      const store = useRagStore();

      expect(store.hasCollections).toBe(false);
    });
  });

  describe('Search', () => {
    it('should set search results', () => {
      const store = useRagStore();

      store.setSearchResults([mockSearchResult]);

      expect(store.searchResults).toHaveLength(1);
      expect(store.searchResults[0].score).toBe(0.95);
    });

    it('should set search query', () => {
      const store = useRagStore();

      store.setSearchQuery('test query');

      expect(store.searchQuery).toBe('test query');
    });

    it('should set search loading state', () => {
      const store = useRagStore();

      store.setSearchLoading(true);
      expect(store.searchLoading).toBe(true);
    });

    it('should set search error', () => {
      const store = useRagStore();

      store.setSearchError('Search failed');
      expect(store.searchError).toBe('Search failed');
    });

    it('should set last search duration', () => {
      const store = useRagStore();

      store.setLastSearchDuration(150);
      expect(store.lastSearchDuration).toBe(150);
    });

    it('should clear search state', () => {
      const store = useRagStore();
      store.setSearchResults([mockSearchResult]);
      store.setSearchQuery('test');
      store.setSearchError('error');
      store.setLastSearchDuration(100);

      store.clearSearch();

      expect(store.searchResults).toEqual([]);
      expect(store.searchQuery).toBe('');
      expect(store.searchError).toBeNull();
      expect(store.lastSearchDuration).toBeNull();
    });
  });

  describe('Chunks', () => {
    it('should set chunks', () => {
      const store = useRagStore();
      const chunks = [
        { id: 'chunk-1', documentId: 'doc-1', content: 'Test', chunkIndex: 0, tokenCount: 50 },
      ];

      store.setChunks(chunks);

      expect(store.chunks).toHaveLength(1);
    });

    it('should set chunks loading state', () => {
      const store = useRagStore();

      store.setChunksLoading(true);
      expect(store.chunksLoading).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset all state to defaults', () => {
      const store = useRagStore();

      // Set various state
      store.setCollections([mockCollection]);
      store.setCurrentCollection(mockCollection);
      store.setCollectionsLoading(true);
      store.setCollectionsError('error');
      store.setDocuments([mockDocument]);
      store.setSearchResults([mockSearchResult]);
      store.setSearchQuery('test');

      // Reset
      store.reset();

      // Verify all reset
      expect(store.collections).toEqual([]);
      expect(store.currentCollection).toBeNull();
      expect(store.collectionsLoading).toBe(false);
      expect(store.collectionsError).toBeNull();
      expect(store.documents).toEqual([]);
      expect(store.currentDocument).toBeNull();
      expect(store.searchResults).toEqual([]);
      expect(store.searchQuery).toBe('');
    });
  });
});
