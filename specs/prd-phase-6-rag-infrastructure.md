# PRD: Phase 6 - RAG Infrastructure & Front-End

## Document Information
- **Version**: 1.0
- **Status**: Draft
- **Author**: Claude Code
- **Date**: 2025-01-21
- **Dependencies**: Supabase (existing), pgvector extension

---

## 1. Executive Summary

This PRD defines the complete RAG (Retrieval-Augmented Generation) infrastructure for Orchestrator AI. RAG enables agents to answer questions using organization-specific knowledge by retrieving relevant context from document collections before generating responses.

**Key Deliverables:**
1. Database schema for RAG collections and documents
2. Document processing pipeline (chunking, embedding)
3. Vector search API with multiple retrieval strategies
4. Admin UI for managing collections and documents
5. Query testing interface

**Success Metric:** A user can upload a PDF, create a collection, and query it via UI - all without any LangGraph involvement.

---

## 2. Problem Statement

### Current State
- Agents have no access to organization-specific knowledge
- No way to upload and index documents
- No vector search capability
- HR Assistant cannot answer policy questions

### Desired State
- Organizations can create knowledge bases (collections)
- Documents are automatically chunked and embedded
- Agents can retrieve relevant context via RAG tool
- Admin UI for full collection lifecycle management

---

## 3. User Stories

### 3.1 Organization Isolation (Critical Security Requirement)

> **Collections are organization-scoped.** Users can ONLY see and access collections belonging to their **currently active organization**. This is enforced at multiple levels:
>
> 1. **Database**: `organization_slug` on all RAG tables
> 2. **PostgreSQL Functions**: All queries require `organization_slug` parameter
> 3. **API**: All endpoints filter by user's **currently selected** organization
> 4. **UI**: Collection list shows only the active org's collections

**Multi-Organization Users:**
- Users (especially admins) can belong to **multiple organizations**
- Users can **switch** their active organization via the UI
- When switching orgs, the entire UI updates (agents, collections, settings)
- RAG collections are filtered by the **currently active org**, not "user's org"

A user viewing "Acme Corp" cannot see collections from "Widget Inc" - even if they have access to both orgs. They must switch orgs to see Widget Inc's collections.

### 3.2 User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| RAG-1 | As a user, I can create a RAG collection for the active organization | Collection created with name, description, embedding model; associated with current active org |
| RAG-2 | As a user, I can upload documents to the active org's collection | PDF, TXT, MD, DOCX files accepted; processing status shown |
| RAG-3 | As a user, I can view documents in the active org's collection | List view with filename, size, chunk count, upload date |
| RAG-4 | As a user, I can delete documents from the active org's collection | Document and all chunks removed |
| RAG-5 | As a user, I can delete the active org's collection | Collection, all documents, and all chunks removed |
| RAG-6 | As a user, I can test queries against the active org's collection | Query input, results displayed with relevance scores |
| RAG-7 | As a user, I can see the active org's collection statistics | Total docs, total chunks, storage size, last updated |
| RAG-8 | As a user, I cannot see collections from organizations other than the active one | 404 returned for collection IDs not in active org; list only shows active org's collections |

> **Note:** All authenticated users within an organization can manage RAG collections and documents. This is intentional - RAG is a collaborative knowledge base for the org. Future enhancement: role-based permissions if needed.

### 3.3 System User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| RAG-9 | As a LangGraph agent, I can query a collection via API | JSON API returns ranked chunks with scores |
| RAG-10 | As the system, I process uploads asynchronously | Upload returns immediately; processing happens in background |
| RAG-11 | As the system, I track embedding costs | Token usage recorded per embedding operation |

---

## 4. Technical Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Front-End (Vue 3 + Ionic)                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Collections │  │  Documents  │  │     Query Tester        │  │
│  │    List     │  │   Upload    │  │   (Results + Scores)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS API (apps/api)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Collections │  │  Documents  │  │     Query/Search        │  │
│  │ Controller  │  │ Controller  │  │     Controller          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                │                     │                │
│         ▼                ▼                     ▼                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     RAG Service                             ││
│  │  - createCollection()    - processDocument()                ││
│  │  - uploadDocument()      - generateEmbeddings()             ││
│  │  - queryCollection()     - deleteCollection()               ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                     │                │
│         ▼                ▼                     ▼                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Chunking   │  │  Embedding  │  │     Vector Search       │  │
│  │  Service    │  │  Service    │  │     Service             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + pgvector)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ collections │  │  documents  │  │     document_chunks     │  │
│  │             │  │             │  │   (with embeddings)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Database Architecture

> **Important:** RAG uses a **separate database** (`rag_data`) from the main Orchestrator AI database (`postgres`).
>
> Since `auth.uid()` and RLS policies only work in the main Supabase database, we use **PostgreSQL functions**
> to enforce organization isolation. All API calls pass `organization_slug` as a parameter, and the functions
> filter data accordingly.

```
PostgreSQL Server (port 6012)
├── postgres      ← Main DB: auth.users, public.users, organizations, agents
└── rag_data      ← RAG DB: collections, documents, chunks (THIS DATABASE)
```

### 4.3 Database Schema

#### 4.3.1 rag_collections Table

```sql
CREATE TABLE rag_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Organization slug passed by API (validated against main DB before calling)
    organization_slug TEXT NOT NULL,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configuration
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
    chunk_size INTEGER NOT NULL DEFAULT 1000,
    chunk_overlap INTEGER NOT NULL DEFAULT 200,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, processing, error

    -- Statistics (denormalized for performance)
    document_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Constraints
    UNIQUE(organization_slug, slug)
);

-- Indexes
CREATE INDEX idx_rag_collections_org ON rag_collections(organization_slug);
CREATE INDEX idx_rag_collections_slug ON rag_collections(organization_slug, slug);
```

#### 4.2.2 rag_documents Table

```sql
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES rag_collections(id) ON DELETE CASCADE,

    -- File info
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- pdf, txt, md, docx
    file_size INTEGER NOT NULL, -- bytes
    file_hash VARCHAR(64), -- SHA-256 for deduplication

    -- Storage
    storage_path TEXT, -- Supabase storage path if stored

    -- Processing status
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, error
    error_message TEXT,

    -- Processing results
    chunk_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}', -- title, author, page_count, etc.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_rag_documents_collection ON rag_documents(collection_id);
CREATE INDEX idx_rag_documents_status ON rag_documents(status);
CREATE INDEX idx_rag_documents_hash ON rag_documents(file_hash);
```

#### 4.2.3 rag_document_chunks Table

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES rag_collections(id) ON DELETE CASCADE,

    -- Chunk content
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Order within document

    -- Embedding (768 dimensions for Ollama nomic-embed-text default)
    -- Can be 1024 for mxbai-embed-large or 1536/3072 for OpenAI if cloud allowed
    embedding vector(768),

    -- Token info
    token_count INTEGER NOT NULL,

    -- Source location
    page_number INTEGER, -- For PDFs
    start_char INTEGER, -- Character offset in original
    end_char INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}', -- headers, section title, etc.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for vector search
CREATE INDEX idx_rag_chunks_collection ON rag_document_chunks(collection_id);
CREATE INDEX idx_rag_chunks_document ON rag_document_chunks(document_id);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_rag_chunks_embedding ON rag_document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### 4.2.4 Observability (Via Existing Webhook Infrastructure)

> **No separate tables needed.** RAG events are sent to the existing observability webhook endpoint,
> which stores them in the main observability database alongside all other system events.

**RAG Event Types:**

| Event Type | When Fired | Key Data |
|------------|------------|----------|
| `rag.query` | User/agent searches a collection | collection_id, user_id, query_text, result_count, duration_ms, top_score |
| `rag.document.upload` | Document uploaded | collection_id, user_id, filename, file_size |
| `rag.document.processed` | Document chunking/embedding complete | document_id, chunk_count, token_count, duration_ms |
| `rag.document.deleted` | Document removed | collection_id, user_id, filename |
| `rag.collection.created` | New collection | collection_id, user_id, name |
| `rag.collection.deleted` | Collection removed | collection_id, user_id, name |

**Example: Sending RAG events to observability webhook:**

```typescript
// In RagService
@Injectable()
export class RagService {
  constructor(
    private observabilityService: ObservabilityWebhookService,
    // ... other deps
  ) {}

  async searchCollection(
    user: AuthenticatedUser,
    collectionId: string,
    query: string,
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    // Execute search...
    const results = await this.executeSearch(collectionId, query);

    // Send observability event (fire and forget)
    this.observabilityService.sendEvent({
      eventType: 'rag.query',
      organizationSlug: user.activeOrganizationSlug,
      userId: user.id,
      data: {
        collectionId,
        queryText: query,
        resultCount: results.length,
        topScore: results[0]?.score ?? null,
        durationMs: Date.now() - startTime,
      },
    });

    return results;
  }

  async uploadDocument(
    user: AuthenticatedUser,
    collectionId: string,
    file: File,
  ): Promise<Document> {
    // ... upload logic ...

    this.observabilityService.sendEvent({
      eventType: 'rag.document.upload',
      organizationSlug: user.activeOrganizationSlug,
      userId: user.id,
      data: {
        collectionId,
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    return document;
  }
}
```

This integrates RAG observability with the existing system - no separate tables, same dashboard, same retention policies.

### 4.4 PostgreSQL Functions (API Interface)

> **Key Design:** The RAG database exposes PostgreSQL functions that the NestJS API calls.
> Organization isolation is enforced by requiring `organization_slug` as a parameter.
> The API validates the user's org membership against the main DB before calling these functions.

#### 4.4.1 Collection Functions

```sql
-- Get all collections for an organization
CREATE OR REPLACE FUNCTION rag_get_collections(
    p_organization_slug TEXT
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    slug VARCHAR(255),
    description TEXT,
    embedding_model VARCHAR(100),
    status VARCHAR(50),
    document_count INTEGER,
    chunk_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT id, name, slug, description, embedding_model, status,
           document_count, chunk_count, created_at, updated_at
    FROM rag_collections
    WHERE organization_slug = p_organization_slug
    ORDER BY created_at DESC;
$$;

-- Get single collection (with org validation)
CREATE OR REPLACE FUNCTION rag_get_collection(
    p_collection_id UUID,
    p_organization_slug TEXT
)
RETURNS rag_collections
LANGUAGE sql STABLE
AS $$
    SELECT *
    FROM rag_collections
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug;
$$;

-- Create a new collection
CREATE OR REPLACE FUNCTION rag_create_collection(
    p_organization_slug TEXT,
    p_name VARCHAR(255),
    p_slug VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    p_chunk_size INTEGER DEFAULT 1000,
    p_chunk_overlap INTEGER DEFAULT 200,
    p_created_by UUID DEFAULT NULL
)
RETURNS rag_collections
LANGUAGE sql
AS $$
    INSERT INTO rag_collections (
        organization_slug, name, slug, description,
        embedding_model, chunk_size, chunk_overlap, created_by
    )
    VALUES (
        p_organization_slug, p_name, p_slug, p_description,
        p_embedding_model, p_chunk_size, p_chunk_overlap, p_created_by
    )
    RETURNING *;
$$;

-- Delete collection (with org validation)
CREATE OR REPLACE FUNCTION rag_delete_collection(
    p_collection_id UUID,
    p_organization_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM rag_collections
    WHERE id = p_collection_id
      AND organization_slug = p_organization_slug;
    RETURN FOUND;
END;
$$;
```

#### 4.4.2 Document Functions

```sql
-- Get documents for a collection (with org validation)
CREATE OR REPLACE FUNCTION rag_get_documents(
    p_collection_id UUID,
    p_organization_slug TEXT
)
RETURNS TABLE (
    id UUID,
    filename VARCHAR(500),
    file_type VARCHAR(50),
    file_size INTEGER,
    status VARCHAR(50),
    error_message TEXT,
    chunk_count INTEGER,
    token_count INTEGER,
    created_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
AS $$
    SELECT d.id, d.filename, d.file_type, d.file_size, d.status,
           d.error_message, d.chunk_count, d.token_count,
           d.created_at, d.processed_at
    FROM rag_documents d
    JOIN rag_collections c ON d.collection_id = c.id
    WHERE d.collection_id = p_collection_id
      AND c.organization_slug = p_organization_slug
    ORDER BY d.created_at DESC;
$$;

-- Insert document (returns NULL if collection doesn't belong to org)
CREATE OR REPLACE FUNCTION rag_insert_document(
    p_collection_id UUID,
    p_organization_slug TEXT,
    p_filename VARCHAR(500),
    p_file_type VARCHAR(50),
    p_file_size INTEGER,
    p_file_hash VARCHAR(64) DEFAULT NULL,
    p_storage_path TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS rag_documents
LANGUAGE plpgsql
AS $$
DECLARE
    v_collection_exists BOOLEAN;
    v_result rag_documents;
BEGIN
    -- Verify collection belongs to organization
    SELECT EXISTS(
        SELECT 1 FROM rag_collections
        WHERE id = p_collection_id AND organization_slug = p_organization_slug
    ) INTO v_collection_exists;

    IF NOT v_collection_exists THEN
        RETURN NULL;
    END IF;

    INSERT INTO rag_documents (
        collection_id, filename, file_type, file_size,
        file_hash, storage_path, created_by
    )
    VALUES (
        p_collection_id, p_filename, p_file_type, p_file_size,
        p_file_hash, p_storage_path, p_created_by
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;
```

#### 4.4.3 Chunk Functions

```sql
-- Insert chunks (batch insert with org validation)
CREATE OR REPLACE FUNCTION rag_insert_chunks(
    p_document_id UUID,
    p_organization_slug TEXT,
    p_chunks JSONB  -- Array of {content, chunk_index, embedding, token_count, page_number, metadata}
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_collection_id UUID;
    v_inserted INTEGER := 0;
    v_chunk JSONB;
BEGIN
    -- Get collection_id and verify org ownership
    SELECT c.id INTO v_collection_id
    FROM rag_documents d
    JOIN rag_collections c ON d.collection_id = c.id
    WHERE d.id = p_document_id
      AND c.organization_slug = p_organization_slug;

    IF v_collection_id IS NULL THEN
        RETURN 0;
    END IF;

    -- Insert all chunks
    FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks)
    LOOP
        INSERT INTO rag_document_chunks (
            document_id, collection_id, content, chunk_index,
            embedding, token_count, page_number, metadata
        )
        VALUES (
            p_document_id,
            v_collection_id,
            v_chunk->>'content',
            (v_chunk->>'chunk_index')::INTEGER,
            (v_chunk->>'embedding')::vector,
            (v_chunk->>'token_count')::INTEGER,
            (v_chunk->>'page_number')::INTEGER,
            COALESCE(v_chunk->'metadata', '{}'::JSONB)
        );
        v_inserted := v_inserted + 1;
    END LOOP;

    -- Update document stats
    UPDATE rag_documents
    SET chunk_count = v_inserted,
        status = 'completed',
        processed_at = NOW()
    WHERE id = p_document_id;

    -- Update collection stats
    UPDATE rag_collections
    SET chunk_count = chunk_count + v_inserted,
        document_count = document_count + 1,
        updated_at = NOW()
    WHERE id = v_collection_id;

    RETURN v_inserted;
END;
$$;
```

#### 4.4.4 Vector Search Function

```sql
-- Search chunks by similarity (THE MAIN QUERY FUNCTION)
CREATE OR REPLACE FUNCTION rag_search(
    p_collection_id UUID,
    p_organization_slug TEXT,
    p_query_embedding vector(1536),
    p_top_k INTEGER DEFAULT 5,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    document_filename VARCHAR(500),
    content TEXT,
    score FLOAT,
    page_number INTEGER,
    metadata JSONB
)
LANGUAGE sql STABLE
AS $$
    SELECT
        c.id AS chunk_id,
        c.document_id,
        d.filename AS document_filename,
        c.content,
        1 - (c.embedding <=> p_query_embedding) AS score,
        c.page_number,
        c.metadata
    FROM rag_document_chunks c
    JOIN rag_documents d ON c.document_id = d.id
    JOIN rag_collections col ON c.collection_id = col.id
    WHERE c.collection_id = p_collection_id
      AND col.organization_slug = p_organization_slug
      AND 1 - (c.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_top_k;
$$;
```

### 4.5 API Endpoints

#### 4.3.1 Collections API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rag/collections` | List collections for organization |
| POST | `/api/rag/collections` | Create new collection |
| GET | `/api/rag/collections/:id` | Get collection details + stats |
| PATCH | `/api/rag/collections/:id` | Update collection settings |
| DELETE | `/api/rag/collections/:id` | Delete collection and all contents |

**Create Collection Request:**
```typescript
interface CreateCollectionDto {
  name: string;
  slug?: string; // Auto-generated if not provided
  description?: string;
  embeddingModel?: 'text-embedding-3-small' | 'text-embedding-3-large';
  chunkSize?: number; // Default: 1000
  chunkOverlap?: number; // Default: 200
}
```

**Collection Response:**
```typescript
interface CollectionResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  status: 'active' | 'processing' | 'error';
  documentCount: number;
  chunkCount: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}
```

#### 4.3.2 Documents API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rag/collections/:id/documents` | List documents in collection |
| POST | `/api/rag/collections/:id/documents` | Upload document (multipart/form-data) |
| GET | `/api/rag/collections/:id/documents/:docId` | Get document details |
| DELETE | `/api/rag/collections/:id/documents/:docId` | Delete document and chunks |
| GET | `/api/rag/collections/:id/documents/:docId/chunks` | List chunks for document |

**Upload Response:**
```typescript
interface DocumentUploadResponse {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message: string; // "Document queued for processing"
}
```

**Document Response:**
```typescript
interface DocumentResponse {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage: string | null;
  chunkCount: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  processedAt: string | null;
}
```

#### 4.3.3 Query API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rag/collections/:id/query` | Query collection for relevant chunks |

**Query Request:**
```typescript
interface QueryCollectionDto {
  query: string;
  topK?: number; // Default: 5, Max: 20
  similarityThreshold?: number; // Default: 0.7, Range: 0-1
  strategy?: 'basic' | 'mmr' | 'reranking'; // Default: 'basic'
  filters?: {
    documentIds?: string[]; // Filter to specific documents
    metadata?: Record<string, unknown>; // Filter by chunk metadata
  };
  includeMetadata?: boolean; // Include chunk metadata in response
}
```

**Query Response:**
```typescript
interface QueryResponse {
  query: string;
  results: {
    chunkId: string;
    documentId: string;
    documentFilename: string;
    content: string;
    score: number; // Similarity score 0-1
    pageNumber?: number;
    metadata?: Record<string, unknown>;
  }[];
  totalResults: number;
  searchDurationMs: number;
}
```

### 4.4 Document Processing Pipeline

#### 4.4.1 Supported File Types

| Type | Extension | Processing Method |
|------|-----------|-------------------|
| PDF | .pdf | pdf-parse library |
| Plain Text | .txt | Direct read |
| Markdown | .md | Direct read (preserve formatting) |
| Word | .docx | mammoth library |

#### 4.4.2 Chunking Strategy

```typescript
interface ChunkingConfig {
  chunkSize: number; // Target characters per chunk
  chunkOverlap: number; // Overlap between chunks
  separators: string[]; // Split priorities
}

// Default separators (in order of preference)
const DEFAULT_SEPARATORS = [
  '\n\n',     // Paragraph break
  '\n',       // Line break
  '. ',       // Sentence end
  '? ',       // Question end
  '! ',       // Exclamation end
  '; ',       // Semicolon
  ', ',       // Comma
  ' ',        // Space
  '',         // Character
];
```

#### 4.4.3 Processing Flow

```
Upload → Validate → Store → Queue Processing
                              │
                              ▼
                    ┌─────────────────┐
                    │  Extract Text   │
                    │  (PDF/DOCX/etc) │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Chunk Text     │
                    │  (RecursiveText │
                    │   Splitter)     │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Generate        │
                    │ Embeddings      │
                    │ (Batch of 100)  │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Store Chunks   │
                    │  + Embeddings   │
                    └─────────────────┘
                              │
                              ▼
                    Update Document Status → Update Collection Stats
```

### 4.5 Embedding Service

> **CRITICAL: Self-Hosted / Inside-Firewall Architecture**
>
> Orchestrator AI is designed for **self-hosted deployment inside the customer's firewall**.
> RAG documents are intellectual property - the crown jewels.
>
> **For true data isolation, embeddings must be generated locally using Ollama.**
> This ensures documents **never leave the firewall** - a major selling point.

#### 4.5.1 Supported Embedding Models

| Provider | Model | Dimensions | Use Case |
|----------|-------|------------|----------|
| **Ollama** | `nomic-embed-text` | 768 | Default - fast, good quality |
| **Ollama** | `mxbai-embed-large` | 1024 | Higher accuracy |

**Default Configuration:** Ollama `nomic-embed-text` (768 dimensions)

> **Note:** Only local Ollama models are supported. This ensures documents never leave the firewall. Cloud embedding providers can be added later if needed.

#### 4.5.2 Embedding Architecture (All Inside Firewall)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER FIREWALL                                 │
│                                                                          │
│   Document Upload                                                        │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐ │
│   │    NestJS API   │──────│     Ollama      │──────│    Supabase     │ │
│   │   (apps/api)    │      │  (embeddings)   │      │   (pgvector)    │ │
│   └─────────────────┘      └─────────────────┘      └─────────────────┘ │
│        │                                                   │             │
│        │                         User Query                │             │
│        │                              │                    │             │
│        ▼                              ▼                    │             │
│   ┌─────────────────┐      ┌─────────────────┐            │             │
│   │  Query Handler  │──────│     Ollama      │            │             │
│   │                 │      │ (embed query)   │            │             │
│   └─────────────────┘      └─────────────────┘            │             │
│        │                                                   │             │
│        └───────────────────────────────────────────────────┘             │
│                              │                                           │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │     Ollama      │                                   │
│                    │ (interpret LLM) │                                   │
│                    └─────────────────┘                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     🚫 NO DATA LEAVES
```

**Complete RAG Flow (All Local):**
1. **Document Upload** → NestJS extracts text
2. **Embedding Generation** → Ollama `nomic-embed-text` (local)
3. **Storage** → Supabase pgvector (local)
4. **User Query** → Ollama embeds query (local)
5. **Vector Search** → pgvector similarity search (local)
6. **LLM Interpretation** → Ollama interprets results (local)

#### 4.5.3 Embedding Service Interface

```typescript
interface EmbeddingService {
  // Generate embedding for single text (uses configured provider)
  embed(text: string): Promise<number[]>;

  // Batch embed (more efficient)
  embedBatch(texts: string[]): Promise<number[][]>;

  // Get current embedding dimensions (varies by model)
  getDimensions(): number;
}

// Ollama-specific implementation
@Injectable()
export class OllamaEmbeddingService implements EmbeddingService {
  private readonly ollamaUrl: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(private configService: ConfigService) {
    this.ollamaUrl = this.configService.get('OLLAMA_URL') || 'http://localhost:11434';
    this.model = this.configService.get('EMBEDDING_MODEL') || 'nomic-embed-text';
    this.dimensions = this.configService.get('EMBEDDING_DIMENSIONS') || 768;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    const data = await response.json();
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Ollama processes one at a time - parallelize with Promise.all
    return Promise.all(texts.map(text => this.embed(text)));
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
```

#### 4.5.4 Configuration

```env
# Embedding Configuration (Ollama only)
EMBEDDING_MODEL=nomic-embed-text   # nomic-embed-text | mxbai-embed-large
EMBEDDING_DIMENSIONS=768           # 768 for nomic, 1024 for mxbai

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
```

#### 4.5.5 Database Schema Update

Vector column size depends on the embedding model:

```sql
-- For Ollama nomic-embed-text (768 dimensions)
CREATE TABLE rag_document_chunks (
    -- ... other columns ...
    embedding vector(768),  -- Matches nomic-embed-text
    -- ...
);

-- HNSW index for Ollama embeddings
CREATE INDEX idx_rag_chunks_embedding ON rag_document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

> **Note:** If switching embedding models, all documents must be re-embedded.
> The collection stores `embedding_dimensions` to track this.

### 4.6 Vector Search Strategies

#### 4.6.1 Basic Search (Default)

Simple cosine similarity search:

```sql
SELECT
  id,
  document_id,
  content,
  1 - (embedding <=> $1) as score
FROM rag_document_chunks
WHERE collection_id = $2
  AND 1 - (embedding <=> $1) > $3  -- similarity threshold
ORDER BY embedding <=> $1
LIMIT $4;
```

#### 4.6.2 MMR (Maximal Marginal Relevance)

Balances relevance with diversity to avoid redundant results:

```typescript
async function mmrSearch(
  queryEmbedding: number[],
  collectionId: string,
  topK: number,
  lambda: number = 0.5, // Balance between relevance (1) and diversity (0)
): Promise<Chunk[]> {
  // 1. Get initial candidates (2x topK)
  const candidates = await basicSearch(queryEmbedding, collectionId, topK * 2);

  // 2. Iteratively select diverse results
  const selected: Chunk[] = [];
  while (selected.length < topK && candidates.length > 0) {
    let bestScore = -Infinity;
    let bestIdx = 0;

    for (let i = 0; i < candidates.length; i++) {
      const relevance = candidates[i].score;
      const maxSimilarity = Math.max(
        ...selected.map(s => cosineSimilarity(candidates[i].embedding, s.embedding))
      );
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(candidates[bestIdx]);
    candidates.splice(bestIdx, 1);
  }

  return selected;
}
```

#### 4.6.3 Reranking (Future Enhancement)

Use a cross-encoder model to rerank initial results:

```typescript
async function rerankingSearch(
  query: string,
  collectionId: string,
  topK: number,
): Promise<Chunk[]> {
  // 1. Get initial candidates with basic search (3x topK)
  const candidates = await basicSearch(queryEmbedding, collectionId, topK * 3);

  // 2. Rerank with cross-encoder
  const reranked = await rerankModel.rerank(query, candidates.map(c => c.content));

  // 3. Return top K
  return reranked.slice(0, topK);
}
```

---

## 5. Front-End Design

### 5.1 Navigation Structure

```
Settings
└── RAG Collections
    ├── Collections List
    ├── Collection Detail
    │   ├── Overview (stats)
    │   ├── Documents Tab
    │   └── Query Tester Tab
    └── Create Collection Modal
```

### 5.2 Collections List Page

**Route:** `/settings/rag-collections`

**Components:**
- Page header with "Create Collection" button
- Collection cards grid/list:
  - Collection name + description
  - Document count, chunk count
  - Status badge (active/processing/error)
  - Last updated timestamp
  - Actions: View, Delete

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  RAG Collections                          [+ Create Collection] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐                │
│ │ HR Policies         │ │ Product Docs        │                │
│ │ Employee handbook   │ │ Technical manuals   │                │
│ │ ─────────────────── │ │ ─────────────────── │                │
│ │ 📄 12 docs          │ │ 📄 45 docs          │                │
│ │ 📦 234 chunks       │ │ 📦 1,203 chunks     │                │
│ │ ✅ Active           │ │ ⏳ Processing       │                │
│ │ Updated 2h ago      │ │ Updated 5m ago      │                │
│ │ [View] [Delete]     │ │ [View] [Delete]     │                │
│ └─────────────────────┘ └─────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Collection Detail Page

**Route:** `/settings/rag-collections/:id`

**Tabs:**

#### 5.3.1 Overview Tab
- Collection name (editable)
- Description (editable)
- Configuration (embedding model, chunk size - read-only after docs added)
- Statistics cards:
  - Total documents
  - Total chunks
  - Total tokens
  - Storage size
  - Last updated

#### 5.3.2 Documents Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  Documents                                    [+ Upload Files]  │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📄 employee-handbook.pdf                                  │   │
│ │    Status: ✅ Completed | 45 chunks | 12,340 tokens       │   │
│ │    Uploaded: Jan 15, 2025                    [🗑️ Delete]  │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ 📄 benefits-guide.pdf                                     │   │
│ │    Status: ⏳ Processing (chunk 23/50)                    │   │
│ │    Uploaded: Jan 21, 2025                                 │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ 📄 pto-policy.md                                          │   │
│ │    Status: ❌ Error: File too large                       │   │
│ │    Uploaded: Jan 21, 2025                    [🗑️ Delete]  │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Upload Modal:**
- Drag-and-drop zone
- File type restrictions shown
- Multiple file upload
- Progress indicators

#### 5.3.3 Query Tester Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  Query Tester                                                   │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ What is the PTO policy for new employees?                 │   │
│ │                                              [🔍 Search]  │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Settings: Top K [5 ▼]  Threshold [0.7 ▼]  Strategy [Basic ▼]   │
│                                                                 │
│ Results (5 found in 45ms):                                      │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📄 employee-handbook.pdf (page 12)           Score: 0.89  │   │
│ │ ─────────────────────────────────────────────────────────│   │
│ │ New employees accrue PTO at a rate of 1.25 days per      │   │
│ │ month during their first year. After completing one      │   │
│ │ year of service, the accrual rate increases to...        │   │
│ └───────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📄 pto-policy.md                             Score: 0.82  │   │
│ │ ─────────────────────────────────────────────────────────│   │
│ │ PTO Policy Overview: All full-time employees are         │   │
│ │ eligible for paid time off starting from their first...  │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Component Inventory

| Component | Location | Description |
|-----------|----------|-------------|
| RagCollectionsPage | pages/settings/ | Main collections list |
| RagCollectionDetailPage | pages/settings/ | Collection detail with tabs |
| CollectionCard | components/rag/ | Card for collection list |
| CreateCollectionModal | components/rag/ | Create collection form |
| DocumentList | components/rag/ | Documents table/list |
| DocumentUploadModal | components/rag/ | File upload with drag-drop |
| QueryTester | components/rag/ | Query input + results |
| QueryResultCard | components/rag/ | Single search result |

### 5.5 Pinia Store

```typescript
// stores/rag.store.ts
interface RagState {
  collections: Collection[];
  currentCollection: Collection | null;
  documents: Document[];
  queryResults: QueryResult[];

  // Loading states
  isLoadingCollections: boolean;
  isLoadingDocuments: boolean;
  isQuerying: boolean;
  isUploading: boolean;
}

interface RagActions {
  // Collections
  fetchCollections(): Promise<void>;
  fetchCollection(id: string): Promise<void>;
  createCollection(data: CreateCollectionDto): Promise<Collection>;
  updateCollection(id: string, data: UpdateCollectionDto): Promise<void>;
  deleteCollection(id: string): Promise<void>;

  // Documents
  fetchDocuments(collectionId: string): Promise<void>;
  uploadDocument(collectionId: string, file: File): Promise<void>;
  deleteDocument(collectionId: string, docId: string): Promise<void>;

  // Query
  queryCollection(collectionId: string, query: QueryDto): Promise<void>;
}
```

---

## 6. Security & Access Control

### 6.0 Security Story: "Nothing Leaves the Firewall"

> **For Infrastructure Teams & Security Reviews**

Orchestrator AI's RAG system is designed for **complete data isolation**. This is the security story:

#### The Problem We Solve
- RAG documents contain intellectual property (policies, procedures, proprietary knowledge)
- Many AI solutions require sending documents to external cloud services
- This is unacceptable for many organizations

#### Our Solution: 100% Self-Hosted

| Component | Where It Runs | Data Location |
|-----------|---------------|---------------|
| **Document Storage** | Supabase (customer server) | ✅ Inside firewall |
| **Vector Database** | pgvector in Supabase | ✅ Inside firewall |
| **Embedding Generation** | Ollama (customer server) | ✅ Inside firewall |
| **LLM Interpretation** | Ollama (customer server) | ✅ Inside firewall |
| **Application API** | NestJS (customer server) | ✅ Inside firewall |

#### Data Flow (All Internal)

```
┌────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER INFRASTRUCTURE                          │
│                                                                     │
│   User uploads HR_Policy.pdf                                        │
│              │                                                      │
│              ▼                                                      │
│   ┌─────────────────┐                                               │
│   │   NestJS API    │──── Text extraction (pdf-parse)               │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │     Ollama      │──── Embedding: nomic-embed-text               │
│   │  (localhost)    │     768-dimensional vector per chunk          │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │    Supabase     │──── Store: document + chunks + vectors        │
│   │    pgvector     │                                               │
│   └─────────────────┘                                               │
│                                                                     │
│   ═══════════════════════════════════════════════════════════       │
│                                                                     │
│   User asks: "What is our PTO policy?"                              │
│              │                                                      │
│              ▼                                                      │
│   ┌─────────────────┐                                               │
│   │     Ollama      │──── Embed query → 768-dim vector              │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │    pgvector     │──── Similarity search → top 5 chunks          │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │     Ollama      │──── LLM interprets chunks → answer            │
│   │   (llama3.2)    │                                               │
│   └─────────────────┘                                               │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
              🔒 NOTHING LEAVES THE FIREWALL
```

#### Security Guarantees

1. **No External API Calls for RAG**
   - Embeddings: Ollama (local)
   - LLM: Ollama (local)
   - Storage: Supabase (local)

2. **Organization Isolation**
   - Each customer has separate organization
   - All RAG queries filter by `organization_slug`
   - Cross-organization access is impossible

3. **Authentication**
   - JWT tokens validated against local Supabase auth
   - API validates organization membership before RAG access

4. **Optional Cloud Integration**
   - If customer explicitly allows, can use cloud embeddings/LLMs
   - Configured via environment variables
   - Default is 100% local

#### Comparison with Cloud Alternatives

| Feature | Orchestrator AI RAG | Typical Cloud RAG |
|---------|---------------------|-------------------|
| Document storage | Customer server | Cloud provider |
| Embedding generation | Customer Ollama | Cloud API (OpenAI, etc.) |
| Vector search | Customer Supabase | Cloud vector DB |
| LLM interpretation | Customer Ollama | Cloud API |
| **Data leaves firewall?** | **NO** | YES |

### 6.1 Authorization Rules

| Resource | Create | Read | Update | Delete |
|----------|--------|------|--------|--------|
| Collection | All org members | Role-based (see below) | All org members | All org members |
| Document | All org members | Role-based (see below) | N/A | All org members |
| Query | All org members | Role-based (see below) | N/A | N/A |

> **Philosophy:** RAG is a collaborative knowledge base by default. Any user in the org can contribute documents and test queries. However, sensitive collections can be restricted to Director or C-level roles.

### 6.1.1 Collection-Level Role-Based Access Control (RBAC)

Collections can optionally require a minimum role to access:

| Role | Level | Can Access |
|------|-------|------------|
| `member` | 0 | Default - all org members |
| `director` | 1 | Directors and above |
| `c-level` | 2 | C-level executives only |

**Schema Addition:**
```sql
-- On rag_collections table
required_role TEXT DEFAULT NULL,  -- NULL = anyone, 'director', 'c-level'
```

**Use Cases:**
- `NULL` (default): "HR Policies" - everyone can read
- `director`: "Strategic Plans" - directors and C-level only
- `c-level`: "Executive Compensation", "M&A Documents" - C-suite only

### 6.1.2 Role Validation via Callback

Since RAG is a separate database, it validates roles by calling back to the main Orchestrator API:

```
┌─────────────────┐                    ┌─────────────────┐
│   NestJS API    │───── query ───────▶│   RAG Database  │
│  (user: abc123) │                    │                 │
└─────────────────┘                    └────────┬────────┘
                                                │
                         collection.required_role = 'c-level'
                                                │
                                                ▼
                                  ┌──────────────────────────┐
                                  │  GET /internal/auth/     │
                                  │  users/:id/role          │
                                  │  ?org=active-org-slug    │
                                  │                          │
                                  │  Returns: { role: '...'} │
                                  └──────────────────────────┘
```

**Internal Auth Endpoint (NestJS):**
```typescript
// Internal endpoint - not exposed externally
@Controller('internal/auth')
export class InternalAuthController {

  @Get('users/:userId/role')
  async getUserRole(
    @Param('userId') userId: string,
    @Query('org') orgSlug: string,
    @Headers('x-internal-service-key') serviceKey: string,
  ): Promise<{ role: string; level: number }> {
    // Validate internal service key
    if (serviceKey !== this.configService.get('INTERNAL_SERVICE_KEY')) {
      throw new UnauthorizedException();
    }

    // Look up user's role in this organization
    const membership = await this.userService.getOrgMembership(userId, orgSlug);

    return {
      role: membership.role,      // 'member', 'director', 'c-level'
      level: membership.roleLevel // 0, 1, 2
    };
  }
}
```

**RAG Function with Role Check:**
```sql
CREATE OR REPLACE FUNCTION rag_search(
    p_service_key TEXT,
    p_collection_id UUID,
    p_organization_slug TEXT,
    p_user_id UUID,
    p_query_embedding vector(768),
    p_top_k INTEGER DEFAULT 5
)
RETURNS TABLE (...)
LANGUAGE plpgsql
AS $$
DECLARE
    v_required_role TEXT;
    v_user_role_level INTEGER;
BEGIN
    -- Validate service key
    IF p_service_key != current_setting('app.rag_service_key', true) THEN
        RAISE EXCEPTION 'Unauthorized: invalid service key';
    END IF;

    -- Check if collection has role requirement
    SELECT required_role INTO v_required_role
    FROM rag_collections
    WHERE id = p_collection_id AND organization_slug = p_organization_slug;

    IF v_required_role IS NOT NULL THEN
        -- Call back to Orchestrator to validate user role
        -- (via pg_net extension or handled by API layer before calling)
        -- If user doesn't have required role, raise exception
        RAISE EXCEPTION 'Access denied: requires % role', v_required_role;
    END IF;

    -- Execute search...
    RETURN QUERY SELECT ...;
END;
$$;
```

**Recommended Implementation:** Handle role check in NestJS before calling RAG function (simpler than pg_net callbacks):

```typescript
// RagService
async searchCollection(user: AuthenticatedUser, collectionId: string, ...): Promise<SearchResult[]> {
  // 1. Get collection metadata (including required_role)
  const collection = await this.getCollection(collectionId, user.activeOrganizationSlug);

  // 2. Check role if required
  if (collection.requiredRole) {
    const hasAccess = await this.authService.userHasRole(
      user.id,
      user.activeOrganizationSlug,
      collection.requiredRole
    );
    if (!hasAccess) {
      throw new ForbiddenException(`Requires ${collection.requiredRole} access`);
    }
  }

  // 3. Execute search
  return this.ragDataSource.query('SELECT * FROM rag_search(...)', [...]);
}
```

**Security Benefits:**
- Sensitive documents (exec comp, M&A, strategy) protected at collection level
- Role data stays in main DB (single source of truth)
- Internal endpoint not exposed externally
- Service key validates internal API calls
- Audit trail via observability (who tried to access what)

### 6.2 Organization Isolation (Function-Based + Service Key)

> **Note:** Since RAG uses a separate database (`rag_data`), traditional Supabase RLS with `auth.uid()` is not available.
> Instead, organization isolation is enforced through **PostgreSQL functions** that require both:
> 1. `organization_slug` - which org's data to access
> 2. `service_key` - proves the caller is authorized (API server)

**Security Flow:**
1. **API Layer (NestJS)**: Validates JWT, gets user's `activeOrganizationSlug`
2. **API Layer**: Calls RAG function with `service_key` + `organization_slug`
3. **RAG Functions**: Validate service key, then filter by `organization_slug`

**Service Key Validation:**
```sql
-- Set service key in database config (from environment variable)
ALTER DATABASE rag_data SET app.rag_service_key = 'your-secret-key-here';

-- All RAG functions validate the key before executing
CREATE OR REPLACE FUNCTION rag_search(
    p_service_key TEXT,              -- Required: proves caller is authorized
    p_collection_id UUID,
    p_organization_slug TEXT,
    p_query_embedding vector(768),
    p_top_k INTEGER DEFAULT 5
)
RETURNS TABLE (...)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    -- Validate service key
    IF p_service_key != current_setting('app.rag_service_key', true) THEN
        RAISE EXCEPTION 'Unauthorized: invalid service key';
    END IF;

    -- Execute search (observability handled by API via webhook)
    RETURN QUERY
    SELECT ... FROM rag_document_chunks
    WHERE collection_id = p_collection_id
      AND organization_slug = p_organization_slug
    ORDER BY embedding <=> p_query_embedding
    LIMIT p_top_k;
END;
$$;
```

**What This Protects Against:**
- ✅ Direct database connections bypassing the API
- ✅ Someone with DB credentials but not the service key
- ✅ Accidental misconfiguration exposing RAG database port

**What This Does NOT Protect Against:**
- ❌ Attacker with server access (can read env vars) - different threat model
- ❌ Compromised API server - if they're inside, they have the key

```typescript
// Example: RagService in NestJS
@Injectable()
export class RagService {
  private readonly serviceKey: string;

  constructor(
    @InjectDataSource('rag') private ragDataSource: DataSource,
    private configService: ConfigService,
  ) {
    this.serviceKey = this.configService.getOrThrow('RAG_SERVICE_KEY');
  }

  async getCollections(user: AuthenticatedUser): Promise<Collection[]> {
    // Pass service key + active org slug
    return this.ragDataSource.query(
      'SELECT * FROM rag_get_collections($1, $2)',
      [this.serviceKey, user.activeOrganizationSlug]
    );
  }

  async searchCollection(
    user: AuthenticatedUser,
    collectionId: string,
    queryEmbedding: number[],
    topK: number = 5,
  ): Promise<SearchResult[]> {
    return this.ragDataSource.query(
      'SELECT * FROM rag_search($1, $2, $3, $4, $5)',
      [this.serviceKey, collectionId, user.activeOrganizationSlug, queryEmbedding, topK]
    );
  }
}
```

**Environment Configuration:**
```env
# RAG Service Key - shared secret between API and RAG database
RAG_SERVICE_KEY=your-randomly-generated-secret-key
```

**How Active Organization Works:**
- User logs in → JWT contains user ID
- User selects an organization from their list → stored in session/local state
- API receives `activeOrganizationSlug` in request header or from session
- API validates user has access to that org before proceeding
- All RAG queries include service key + `activeOrganizationSlug`

**Why Functions Instead of RLS:**
- RAG database has no access to `auth.users` or `auth.uid()`
- Functions provide equivalent security with explicit org parameter
- All data access goes through functions - direct table access is blocked

### 6.3 File Upload Security

- Max file size: 50MB
- Allowed MIME types: application/pdf, text/plain, text/markdown, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- Virus scanning: Integrate with ClamAV or similar (future)
- File stored in Supabase Storage with private bucket

---

## 7. Performance Considerations

### 7.1 Indexing Strategy

| Index | Purpose | Type |
|-------|---------|------|
| `idx_rag_chunks_embedding` | Vector similarity search | HNSW |
| `idx_rag_chunks_collection` | Filter by collection | B-tree |
| `idx_rag_documents_collection` | Filter by collection | B-tree |
| `idx_rag_collections_org` | Filter by organization | B-tree |

### 7.2 Query Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Vector search (5 results) | < 100ms | HNSW index |
| Vector search (20 results) | < 200ms | HNSW index |
| Document list | < 50ms | B-tree index |
| Collection stats | < 50ms | Denormalized counts |

### 7.3 Embedding Batch Processing

- Process uploads asynchronously (don't block upload response)
- Batch embeddings in groups of 100
- Use connection pooling for database writes
- Update collection stats after processing completes

---

## 8. Error Handling

### 8.1 Document Processing Errors

| Error | Handling |
|-------|----------|
| Unsupported file type | Reject upload with clear message |
| File too large | Reject upload, suggest splitting |
| PDF extraction fails | Mark document as error, log details |
| Embedding API error | Retry 3x with backoff, then mark as error |
| Database write fails | Retry, then mark as error |

### 8.2 Query Errors

| Error | Handling |
|-------|----------|
| Collection not found | 404 response |
| Empty collection | Return empty results with message |
| Embedding API error | 500 response with message |
| Query too long | Truncate to max tokens |

---

## 9. Implementation Plan

### 9.1 Phase 6a: Database & Core API (3-4 days)

- [ ] Create database migration for RAG tables
- [ ] Enable pgvector extension
- [ ] Create HNSW index
- [ ] Implement RagModule with:
  - CollectionsService
  - DocumentsService
  - ChunkingService
  - EmbeddingService
  - VectorSearchService
- [ ] Create API endpoints for collections CRUD
- [ ] Create API endpoints for documents CRUD
- [ ] Create query endpoint

### 9.2 Phase 6b: Document Processing (2-3 days)

- [ ] Implement PDF text extraction
- [ ] Implement DOCX text extraction
- [ ] Implement recursive text chunking
- [ ] Implement embedding generation with batching
- [ ] Implement async processing queue
- [ ] Add processing status updates

### 9.3 Phase 6c: Front-End (3-4 days)

- [ ] Create Pinia store for RAG
- [ ] Create RAG service for API calls
- [ ] Create Collections List page
- [ ] Create Collection Detail page with tabs
- [ ] Create Document upload modal with drag-drop
- [ ] Create Query Tester component
- [ ] Add navigation menu item
- [ ] Add loading states and error handling

### 9.4 Phase 6d: Testing & Polish (1-2 days)

- [ ] Test with various PDF formats
- [ ] Test with large documents
- [ ] Test query performance
- [ ] Add collection statistics refresh
- [ ] Polish UI/UX
- [ ] Documentation

---

## 10. Testing Strategy

### 10.1 Unit Tests

- ChunkingService: Text splitting with various separators
- EmbeddingService: Batch processing, error handling
- VectorSearchService: Query building, result formatting

### 10.2 Integration Tests

- Full upload → process → query flow
- Collection CRUD operations
- Document CRUD operations
- RLS policy validation

### 10.3 Performance Tests

- Query latency with 1K, 10K, 100K chunks
- Upload processing time for various file sizes
- Concurrent query handling

---

## 11. Dependencies

### 11.1 NPM Packages

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "@langchain/textsplitters": "^0.0.3",
    "openai": "^4.x"
  }
}
```

### 11.2 Database Extensions

- pgvector (already available in Supabase)

---

## 12. Future Enhancements

1. **Hybrid Search**: Combine vector search with full-text search
2. **Reranking**: Add cross-encoder reranking for better accuracy
3. **Auto-tagging**: Use LLM to generate metadata tags for chunks
4. **Multi-modal**: Support images with vision models
5. **Incremental Updates**: Update only changed chunks on re-upload
6. **Analytics Dashboard**: Query patterns, popular documents, coverage gaps

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Collection creation | Works without errors |
| Document upload | All supported types process successfully |
| Query accuracy | Relevant chunks in top 5 results |
| Query latency | < 100ms for 95th percentile |
| UI usability | Admin can complete full flow without documentation |
