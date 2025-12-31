---
name: rag-skill
description: Query and analyze RAG (Retrieval-Augmented Generation) collections, documents, embeddings, and statistics. Use when answering questions about RAG data, collection counts, document ingestion status, or embedding analytics.
allowed-tools: Bash, Read, Grep, Glob
category: "data"
type: "knowledge"
used-by-agents: []
related-skills: [supabase-management-skill]
---

# RAG Skill

Query and analyze RAG collections, documents, and embeddings in the Orchestrator AI system.

## When to Use This Skill

Use this skill when the user asks about:
- **RAG collections** (count, list, details, configuration)
- **Documents** (ingestion status, counts, file types)
- **Embeddings** (chunks, vectors, dimensions, models)
- **RAG statistics** (token counts, chunk counts, collection sizes)
- **RAG system health** (processing status, errors)

**DO NOT use this skill when:**
- User wants to create or modify RAG data (use API endpoints instead)
- Task is unrelated to RAG data analysis
- User wants to query RAG content semantically (that's done via API, not this skill)

## RAG Database Schema

The RAG system uses the `rag_data` schema in Supabase with three main tables:

### 1. rag_collections
Stores RAG collection definitions with embedding configuration.

**Key Fields:**
- `id` (UUID) - Primary key
- `organization_slug` (TEXT) - Multi-tenant isolation
- `name` (VARCHAR) - Display name
- `slug` (VARCHAR) - URL-safe identifier
- `description` (TEXT) - Optional description
- `embedding_model` (VARCHAR) - Model name (default: 'nomic-embed-text')
- `embedding_dimensions` (INTEGER) - Vector dimensions (default: 768)
- `chunk_size` (INTEGER) - Default: 1000
- `chunk_overlap` (INTEGER) - Default: 200
- `status` (VARCHAR) - 'active', 'processing', 'error'
- `required_role` (TEXT) - Access control (NULL = all org members)
- `document_count` (INTEGER) - Number of documents
- `chunk_count` (INTEGER) - Number of chunks/embeddings
- `total_tokens` (INTEGER) - Total token count
- `created_at`, `updated_at` (TIMESTAMPTZ)
- `created_by` (UUID) - User who created it

**Unique Constraint:** (organization_slug, slug)

### 2. rag_documents
Stores source documents ingested into collections.

**Key Fields:**
- `id` (UUID) - Primary key
- `collection_id` (UUID) - Foreign key to rag_collections
- `organization_slug` (TEXT) - Denormalized for filtering
- `filename` (VARCHAR) - Original filename
- `file_type` (VARCHAR) - pdf, txt, md, docx, etc.
- `file_size` (INTEGER) - Size in bytes
- `file_hash` (VARCHAR) - SHA-256 for deduplication
- `storage_path` (TEXT) - Supabase storage location
- `status` (VARCHAR) - 'pending', 'processing', 'completed', 'error'
- `error_message` (TEXT) - If status is 'error'
- `chunk_count` (INTEGER) - Number of chunks created
- `token_count` (INTEGER) - Total tokens in document
- `metadata` (JSONB) - Title, author, page_count, etc.
- `created_at`, `updated_at`, `processed_at` (TIMESTAMPTZ)
- `created_by` (UUID)

### 3. rag_document_chunks
Stores document chunks with vector embeddings for semantic search.

**Key Fields:**
- `id` (UUID) - Primary key
- `document_id` (UUID) - Foreign key to rag_documents
- `collection_id` (UUID) - Foreign key to rag_collections
- `organization_slug` (TEXT) - Denormalized for filtering
- `content` (TEXT) - The actual text chunk
- `chunk_index` (INTEGER) - Order within document
- `embedding` (vector) - Vector embedding (768 dimensions default)
- `token_count` (INTEGER) - Tokens in this chunk
- `page_number` (INTEGER) - For PDFs
- `char_offset` (INTEGER) - Character offset in original document
- `metadata` (JSONB) - Headers, section title, etc.
- `created_at` (TIMESTAMPTZ)

## Querying RAG Data

### Database Connection

The RAG data is in the Supabase database accessible via:
- **Host**: 127.0.0.1
- **Port**: 6012 (when Supabase is running locally)
- **Database**: postgres
- **Schema**: rag_data
- **User**: postgres

### Example Queries

#### Count RAG Collections
```bash
# Using Node.js with Supabase client
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase
  .from('rag_collections')
  .select('*', { count: 'exact' })
  .then(({ count, error }) => {
    if (error) console.error(error);
    else console.log('Total Collections:', count);
  });
"
```

#### List All Collections
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase
  .from('rag_collections')
  .select('name, organization_slug, document_count, chunk_count, status')
  .then(({ data, error }) => {
    if (error) console.error(error);
    else console.table(data);
  });
"
```

#### Get Collection Details
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase
  .from('rag_collections')
  .select('*')
  .eq('slug', 'collection-slug-here')
  .single()
  .then(({ data, error }) => {
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
  });
"
```

#### Document Statistics by Collection
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

supabase
  .from('rag_documents')
  .select('collection_id, status, file_type')
  .then(({ data, error }) => {
    if (error) console.error(error);
    else {
      const stats = data.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      }, {});
      console.log('Document Status:', stats);
    }
  });
"
```

### Using Storage Scripts

Alternatively, if you need to export or backup RAG data, you can use the storage scripts:

```bash
# Export specific collection data
storage/scripts/export-rag-collection.sh <collection-slug>

# Backup entire RAG schema
storage/scripts/backup-rag-data.sh
```

## Common Questions & Answers

### "How many RAG collections do we have?"
Query `rag_collections` table and count rows, optionally filtering by organization_slug.

### "What's the status of document ingestion?"
Query `rag_documents` table and group by `status` field to see counts of pending, processing, completed, and error documents.

### "How many embeddings are in a collection?"
Check the `chunk_count` field in `rag_collections` table for that collection.

### "What embedding model are we using?"
Query `rag_collections` table and look at `embedding_model` and `embedding_dimensions` fields.

### "Which collections have errors?"
Query `rag_collections` WHERE status = 'error' or query `rag_documents` WHERE status = 'error'.

## Best Practices

1. **Always filter by organization_slug** when querying for security and performance
2. **Use denormalized counts** (document_count, chunk_count) from collections table for quick stats
3. **Check status fields** before assuming data is ready
4. **Query metadata JSONB** for rich document information
5. **Use vector search functions** (defined in migrations) for semantic queries

## Related Files

- **Schema**: `apps/api/supabase/migrations/migrations-rag/20250121000002_create_rag_tables.sql`
- **Indexes**: `apps/api/supabase/migrations/migrations-rag/20250121000003_create_rag_indexes.sql`
- **Functions**: `apps/api/supabase/migrations/migrations-rag/20250121000004_create_rag_functions.sql`
- **API Service**: `apps/api/src/rag/collections.service.ts`
- **API Controller**: `apps/api/src/rag/collections.controller.ts`

## Keywords

RAG, embeddings, vector search, collections, documents, chunks, pgvector, semantic search, retrieval augmented generation, knowledge base

## Self-Reporting

**When this skill is loaded, the agent using it should log the event:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, details)
VALUES ('skill', 'rag-skill', 'loaded',
  '{\"loaded_by\": \"agent-name\", \"context\": \"description\"}'::jsonb);"
```

**After using the skill's patterns, log if they helped:**

```bash
docker exec supabase_db_api-dev psql -U postgres -d postgres -c "
INSERT INTO code_ops.artifact_events (artifact_type, artifact_name, event_type, success, details)
VALUES ('skill', 'rag-skill', 'helped', true,
  '{\"outcome\": \"what the skill helped with\"}'::jsonb);"
```
