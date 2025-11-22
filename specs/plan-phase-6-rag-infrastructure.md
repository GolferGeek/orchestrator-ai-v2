# Implementation Plan: Phase 6 - RAG Infrastructure

**PRD Reference:** [prd-phase-6-rag-infrastructure.md](./prd-phase-6-rag-infrastructure.md)
**Status:** Ready for Implementation
**Estimated Duration:** 9-13 days total

---

## Phase 6a: Database & Core API (3-4 days)

**Important:** RAG uses a **separate database** (`rag_data`) from the main Orchestrator AI database (`postgres`). All database changes MUST be done through migrations in `apps/api/supabase/migrations-rag/` (new directory for RAG-specific migrations).

### Step 1: RAG Database Setup
- [ ] Create `rag_data` database in Supabase (if not already created)
- [ ] Create migrations directory: `apps/api/supabase/migrations-rag/`
- [ ] Create migration: `YYYYMMDDHHMMSS_enable_pgvector.sql`
  - Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`

### Step 2: Migration - RAG Tables (PRD §4.3)
- [ ] Create migration: `YYYYMMDDHHMMSS_create_rag_tables.sql`
  - `collections` table (id, org_slug, name, slug, description, embedding_model, chunk_size, chunk_overlap, document_count, chunk_count, status, created_at, updated_at)
  - `documents` table (id, collection_id, org_slug, filename, file_type, file_size, status, chunk_count, error_message, created_at, updated_at)
  - `document_chunks` table (id, document_id, collection_id, org_slug, content, embedding vector(768), chunk_index, page_number, char_offset, metadata, created_at)

### Step 3: Migration - RAG Indexes
- [ ] Create migration: `YYYYMMDDHHMMSS_create_rag_indexes.sql`
  - HNSW index on `document_chunks.embedding` for vector similarity search (PRD §4.3.3)
  - B-tree indexes: org_slug, collection_id, document_id for filtering

### Step 4: Migration - PostgreSQL Functions (PRD §4.4)
- [ ] Create migration: `YYYYMMDDHHMMSS_create_rag_functions.sql`
  - `get_collections(service_key, org_slug)` - list collections for org
  - `get_collection(service_key, collection_id, org_slug)` - get single collection
  - `create_collection(...)` - create new collection
  - `update_collection(...)` - update collection
  - `delete_collection(service_key, collection_id, org_slug)` - delete collection
  - `get_documents(service_key, collection_id, org_slug)` - list documents
  - `insert_document(...)` - insert document record
  - `update_document_status(...)` - update document processing status
  - `delete_document(...)` - delete document and its chunks
  - `insert_chunks(service_key, document_id, org_slug, chunks_jsonb)` - batch insert chunks
  - `search(service_key, collection_id, org_slug, query_embedding, top_k, threshold)` - vector search

### Step 5: NestJS RAG Module Structure
- [ ] Create `apps/api/src/rag/` module directory
- [ ] Create `rag.module.ts` with separate database connection to `rag_data` via `RAG_DATABASE_URL`
- [ ] Create DTOs (PRD §4.5):
  - `create-collection.dto.ts`
  - `update-collection.dto.ts`
  - `query-collection.dto.ts`
  - `upload-document.dto.ts`

### Step 6: Collections API (PRD §4.5.1)
- [ ] Create `collections.controller.ts`:
  - `GET /api/rag/collections` - list collections
  - `POST /api/rag/collections` - create collection
  - `GET /api/rag/collections/:id` - get collection details
  - `PATCH /api/rag/collections/:id` - update collection
  - `DELETE /api/rag/collections/:id` - delete collection
- [ ] Create `collections.service.ts` with service key validation

### Step 7: Documents API (PRD §4.5.2)
- [ ] Create `documents.controller.ts`:
  - `GET /api/rag/collections/:id/documents` - list documents
  - `POST /api/rag/collections/:id/documents` - upload document (multipart)
  - `GET /api/rag/collections/:id/documents/:docId` - get document
  - `DELETE /api/rag/collections/:id/documents/:docId` - delete document
  - `GET /api/rag/collections/:id/documents/:docId/chunks` - list chunks
- [ ] Create `documents.service.ts`

### Step 8: Query API (PRD §4.5.3)
- [ ] Create `query.controller.ts`:
  - `POST /api/rag/collections/:id/query` - search collection
- [ ] Create `query.service.ts` (basic search strategy first)

---

## Phase 6b: Document Processing Pipeline (2-3 days)

### Step 9: Text Extraction Services
- [ ] Install dependencies: `pdf-parse`, `mammoth`
- [ ] Create `extractors/` directory under `rag/`
- [ ] Create `pdf-extractor.service.ts` using pdf-parse
- [ ] Create `docx-extractor.service.ts` using mammoth
- [ ] Create `text-extractor.service.ts` for .txt/.md files
- [ ] Create `extractor-factory.service.ts` to route by file type

### Step 10: Chunking Service (PRD §4.4.2)
- [ ] Install `@langchain/textsplitters` (or implement custom recursive splitter)
- [ ] Create `chunking.service.ts`:
  - Implement recursive text splitting with configurable separators
  - Support chunk size and overlap from collection config
  - Track chunk indices and character offsets
  - Extract page numbers for PDFs

### Step 11: Embedding Service (PRD §4.5)
- [ ] Create `embedding.service.ts` interface
- [ ] Create `ollama-embedding.service.ts`:
  - Connect to Ollama at `OLLAMA_URL` (default: localhost:11434)
  - Use `nomic-embed-text` model (768 dimensions)
  - Implement `embed(text)` and `embedBatch(texts)` methods
- [ ] Add configuration via environment variables (PRD §4.5.4)

### Step 12: Async Processing Queue
- [ ] Create `document-processor.service.ts`:
  - Queue document for processing on upload
  - Extract text → chunk → embed → store flow (PRD §4.4.3)
  - Update document status: pending → processing → completed/error
  - Update collection stats on completion
- [ ] Implement retry logic (3x with backoff) for embedding failures
- [ ] Add error handling and status updates (PRD §8.1)

---

## Phase 6c: Front-End Implementation (3-4 days)

### Step 13: API Service & Pinia Store (PRD §5.5)
- [ ] Create `apps/web/src/services/rag.service.ts`:
  - Collections CRUD methods
  - Documents CRUD methods
  - Query method
- [ ] Create `apps/web/src/stores/rag.store.ts`:
  - State: collections, currentCollection, documents, queryResults
  - Loading states: isLoadingCollections, isUploading, isQuerying
  - Actions: fetchCollections, createCollection, uploadDocument, queryCollection

### Step 14: Collections List Page (PRD §5.2)
- [ ] Create `apps/web/src/pages/settings/RagCollectionsPage.vue`
- [ ] Route: `/settings/rag-collections`
- [ ] Components:
  - Page header with "Create Collection" button
  - Collection cards grid showing: name, description, doc count, chunk count, status
  - Delete confirmation modal
- [ ] Create `apps/web/src/components/rag/CollectionCard.vue`

### Step 15: Create Collection Modal (PRD §5.2)
- [ ] Create `apps/web/src/components/rag/CreateCollectionModal.vue`
- [ ] Form fields:
  - Name (required)
  - Slug (auto-generated, editable)
  - Description (optional)
  - Embedding model dropdown (nomic-embed-text, mxbai-embed-large)
  - Chunk size (default: 1000)
  - Chunk overlap (default: 200)

### Step 16: Collection Detail Page (PRD §5.3)
- [ ] Create `apps/web/src/pages/settings/RagCollectionDetailPage.vue`
- [ ] Route: `/settings/rag-collections/:id`
- [ ] Implement tab navigation:
  - Overview tab (stats, config)
  - Documents tab
  - Query Tester tab

### Step 17: Documents Tab (PRD §5.3.2)
- [ ] Create `apps/web/src/components/rag/DocumentList.vue`
- [ ] Display: filename, status (with progress), chunk count, upload date
- [ ] Status indicators: pending, processing (with progress), completed, error
- [ ] Delete button per document
- [ ] Create `apps/web/src/components/rag/DocumentUploadModal.vue`:
  - Drag-and-drop zone
  - File type restrictions (.pdf, .txt, .md, .docx)
  - Multiple file upload support
  - Progress indicators

### Step 18: Query Tester Tab (PRD §5.3.3)
- [ ] Create `apps/web/src/components/rag/QueryTester.vue`
- [ ] Query input with search button
- [ ] Settings: Top K, Similarity Threshold, Strategy dropdown
- [ ] Create `apps/web/src/components/rag/QueryResultCard.vue`:
  - Document filename + page number
  - Similarity score
  - Content snippet
  - Metadata (if enabled)

### Step 19: Navigation & Routing
- [ ] Add "RAG Collections" to Settings menu
- [ ] Configure Vue Router routes for RAG pages
- [ ] Add breadcrumb navigation

---

## Phase 6d: Security, Testing & Polish (1-2 days)

### Step 20: Security Implementation (PRD §6)
- [ ] Configure `RAG_SERVICE_KEY` environment variable
- [ ] Validate service key in all PostgreSQL functions
- [ ] Implement organization isolation in all API endpoints
- [ ] Add file upload security:
  - Max file size: 50MB
  - MIME type validation
- [ ] Test cross-organization access prevention (should return 404)

### Step 21: Observability Integration (PRD §4.2.4)

Uses existing `ObservabilityWebhookService` - no new tables needed, events go to observability database.

- [ ] Inject `ObservabilityWebhookService` into RAG services
- [ ] Emit `rag.query` event on each search:
  - collection_id, query_text, result_count, top_score, duration_ms
- [ ] Emit `rag.document.upload` event on document upload:
  - collection_id, filename, file_size, file_type
- [ ] Emit `rag.document.processed` event when chunking/embedding completes:
  - document_id, chunk_count, token_count, duration_ms
- [ ] Emit `rag.document.deleted` event on document deletion
- [ ] Emit `rag.collection.created` event on collection creation
- [ ] Emit `rag.collection.deleted` event on collection deletion

All events include `organizationSlug` and `userId` from authenticated user context.

### Step 22: Testing
- [ ] Unit tests:
  - ChunkingService: text splitting with various separators
  - EmbeddingService: batch processing, error handling
- [ ] Integration tests:
  - Full upload → process → query flow
  - Collection CRUD operations
  - Organization isolation validation
- [ ] Manual testing:
  - Various PDF formats (text-heavy, scanned, mixed)
  - Large documents (50+ pages)
  - Query accuracy verification

### Step 23: UI Polish
- [ ] Loading states for all async operations
- [ ] Error messages and toast notifications
- [ ] Empty states (no collections, no documents)
- [ ] Responsive design for collection cards
- [ ] Processing status polling/websocket updates

---

## Environment Configuration

Already configured in `.env` and `.env.example`:
```env
# RAG data (collections, documents, vector embeddings)
RAG_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6012/rag_data
```

Add to `.env`:
```env
# RAG Service Key (for PostgreSQL function authorization)
RAG_SERVICE_KEY=your-randomly-generated-secret-key

# Embedding Configuration (Ollama)
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
OLLAMA_URL=http://localhost:11434
```

---

## Dependencies to Install

### Backend (apps/api)
```bash
npm install pdf-parse mammoth @langchain/textsplitters
```

### Ollama Model (run once)
```bash
ollama pull nomic-embed-text
```

---

## Success Criteria (PRD §13)

- [ ] User can create a RAG collection via UI
- [ ] User can upload PDF/TXT/MD/DOCX documents
- [ ] Documents process (chunk + embed) without errors
- [ ] User can query collection and see relevant results with scores
- [ ] Query latency < 100ms for 95th percentile
- [ ] Cross-organization access returns 404
- [ ] Admin can complete full flow without documentation
