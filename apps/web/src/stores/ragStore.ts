/**
 * RAG Store - State + Synchronous Mutations Only
 *
 * Use ragService for API calls.
 * This store holds state for collections, documents, and search results.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  RagCollection,
  RagDocument,
  RagChunk,
  SearchResult,
} from '@/services/ragService';

export const useRagStore = defineStore('rag', () => {
  // ==================== State ====================

  // Collections
  const collections = ref<RagCollection[]>([]);
  const currentCollection = ref<RagCollection | null>(null);
  const collectionsLoading = ref(false);
  const collectionsError = ref<string | null>(null);

  // Documents
  const documents = ref<RagDocument[]>([]);
  const currentDocument = ref<RagDocument | null>(null);
  const documentsLoading = ref(false);
  const documentsError = ref<string | null>(null);

  // Chunks
  const chunks = ref<RagChunk[]>([]);
  const chunksLoading = ref(false);

  // Search
  const searchResults = ref<SearchResult[]>([]);
  const searchQuery = ref('');
  const searchLoading = ref(false);
  const searchError = ref<string | null>(null);
  const lastSearchDuration = ref<number | null>(null);

  // ==================== Computed ====================

  const hasCollections = computed(() => collections.value.length > 0);

  const totalDocuments = computed(() =>
    collections.value.reduce((sum, c) => sum + c.documentCount, 0),
  );

  const totalChunks = computed(() =>
    collections.value.reduce((sum, c) => sum + c.chunkCount, 0),
  );

  const processingDocuments = computed(() =>
    documents.value.filter(
      (d) => d.status === 'pending' || d.status === 'processing',
    ),
  );

  const completedDocuments = computed(() =>
    documents.value.filter((d) => d.status === 'completed'),
  );

  const errorDocuments = computed(() =>
    documents.value.filter((d) => d.status === 'error'),
  );

  // ==================== Mutations ====================

  // Collections
  const setCollections = (data: RagCollection[]) => {
    collections.value = data;
  };

  const setCurrentCollection = (collection: RagCollection | null) => {
    currentCollection.value = collection;
  };

  const addCollection = (collection: RagCollection) => {
    collections.value.push(collection);
  };

  const updateCollectionInList = (updated: RagCollection) => {
    const index = collections.value.findIndex((c) => c.id === updated.id);
    if (index !== -1) {
      collections.value[index] = updated;
    }
    if (currentCollection.value?.id === updated.id) {
      currentCollection.value = updated;
    }
  };

  const removeCollection = (collectionId: string) => {
    collections.value = collections.value.filter((c) => c.id !== collectionId);
    if (currentCollection.value?.id === collectionId) {
      currentCollection.value = null;
    }
  };

  const setCollectionsLoading = (loading: boolean) => {
    collectionsLoading.value = loading;
  };

  const setCollectionsError = (error: string | null) => {
    collectionsError.value = error;
  };

  // Documents
  const setDocuments = (data: RagDocument[]) => {
    documents.value = data;
  };

  const setCurrentDocument = (document: RagDocument | null) => {
    currentDocument.value = document;
  };

  const addDocument = (document: RagDocument) => {
    documents.value.push(document);
  };

  const updateDocumentInList = (updated: RagDocument) => {
    const index = documents.value.findIndex((d) => d.id === updated.id);
    if (index !== -1) {
      documents.value[index] = updated;
    }
    if (currentDocument.value?.id === updated.id) {
      currentDocument.value = updated;
    }
  };

  const removeDocument = (documentId: string) => {
    documents.value = documents.value.filter((d) => d.id !== documentId);
    if (currentDocument.value?.id === documentId) {
      currentDocument.value = null;
    }
  };

  const setDocumentsLoading = (loading: boolean) => {
    documentsLoading.value = loading;
  };

  const setDocumentsError = (error: string | null) => {
    documentsError.value = error;
  };

  // Chunks
  const setChunks = (data: RagChunk[]) => {
    chunks.value = data;
  };

  const setChunksLoading = (loading: boolean) => {
    chunksLoading.value = loading;
  };

  // Search
  const setSearchResults = (results: SearchResult[]) => {
    searchResults.value = results;
  };

  const setSearchQuery = (query: string) => {
    searchQuery.value = query;
  };

  const setSearchLoading = (loading: boolean) => {
    searchLoading.value = loading;
  };

  const setSearchError = (error: string | null) => {
    searchError.value = error;
  };

  const setLastSearchDuration = (duration: number | null) => {
    lastSearchDuration.value = duration;
  };

  const clearSearch = () => {
    searchResults.value = [];
    searchQuery.value = '';
    searchError.value = null;
    lastSearchDuration.value = null;
  };

  // Reset
  const reset = () => {
    collections.value = [];
    currentCollection.value = null;
    collectionsLoading.value = false;
    collectionsError.value = null;

    documents.value = [];
    currentDocument.value = null;
    documentsLoading.value = false;
    documentsError.value = null;

    chunks.value = [];
    chunksLoading.value = false;

    searchResults.value = [];
    searchQuery.value = '';
    searchLoading.value = false;
    searchError.value = null;
    lastSearchDuration.value = null;
  };

  return {
    // State
    collections,
    currentCollection,
    collectionsLoading,
    collectionsError,
    documents,
    currentDocument,
    documentsLoading,
    documentsError,
    chunks,
    chunksLoading,
    searchResults,
    searchQuery,
    searchLoading,
    searchError,
    lastSearchDuration,

    // Computed
    hasCollections,
    totalDocuments,
    totalChunks,
    processingDocuments,
    completedDocuments,
    errorDocuments,

    // Mutations
    setCollections,
    setCurrentCollection,
    addCollection,
    updateCollectionInList,
    removeCollection,
    setCollectionsLoading,
    setCollectionsError,
    setDocuments,
    setCurrentDocument,
    addDocument,
    updateDocumentInList,
    removeDocument,
    setDocumentsLoading,
    setDocumentsError,
    setChunks,
    setChunksLoading,
    setSearchResults,
    setSearchQuery,
    setSearchLoading,
    setSearchError,
    setLastSearchDuration,
    clearSearch,
    reset,
  };
});
