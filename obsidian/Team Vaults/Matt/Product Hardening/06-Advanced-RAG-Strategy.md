# Advanced RAG Strategy
## Comprehensive RAG Capabilities for Mid-Sized Companies

**Date:** 2025-01-27  
**Priority:** HIGH  
**Target:** Small-to-Mid-Sized Companies (Inside the Firewall)  
**Reference:** See `docs/prd/v2-final-solution.md` Section 1 for comprehensive advanced RAG strategies (13+ strategies documented)

---

## Current State

- ✅ Basic RAG with PostgreSQL + pgvector
- ✅ MMR (Maximal Marginal Relevance) search implemented
- ✅ Basic vector similarity search
- ⚠️ Reranking strategy not implemented (falls back to basic search)
- ⚠️ No hybrid search (keyword + semantic)
- ⚠️ Single vector database option (pgvector only)
- ⚠️ No advanced retrieval patterns

---

## Mid-Sized Requirements

- Advanced RAG patterns (hybrid search, reranking, query expansion)
- Support multiple vector databases (Pinecone, Weaviate, Qdrant)
- Allow customers to use their existing vector infrastructure
- Performance optimization (caching, batch processing)
- Foundation for future advanced strategies (Parent Document, Self-RAG, Adaptive RAG, etc.)

---

## Hardening Plan

### Phase 1: Core Advanced RAG Patterns (2-3 weeks with AI)

#### 1. Hybrid Search

**Description:** Combine keyword and semantic search for better retrieval accuracy.

**Implementation:**
- Keyword search using BM25 algorithm
- Vector similarity search (existing)
- Configurable weighting between keyword and semantic results
- Merge and rank combined results

**Technical Details:**
- Location: `apps/api/src/rag/search/hybrid-search.service.ts`
- **AI Time:** 3-4 days (hybrid search implementation)
- **Reference:** `docs/prd/v2-final-solution.md` - Strategy #4 (Hybrid Search RAG)

**Example:**
```typescript
interface HybridSearchOptions {
  query: string;
  collectionId: string;
  keywordWeight: number; // 0.0 to 1.0 (default: 0.5)
  semanticWeight: number; // 0.0 to 1.0 (default: 0.5)
  topK: number;
}
```

---

#### 2. Reranking Pipeline

**Description:** Use cross-encoder models to rerank initial search results for better relevance.

**Implementation:**
- Initial retrieval with basic/hybrid search (retrieve 3x topK candidates)
- Cross-encoder model reranking (using Ollama or external API)
- Return top-K reranked results

**Technical Details:**
- Location: `apps/api/src/rag/search/reranking.service.ts`
- **AI Time:** 3-4 days (reranking implementation)
- **Reference:** `specs/prd-phase-6-rag-infrastructure.md` Section 4.6.3

**Example:**
```typescript
interface RerankingOptions {
  query: string;
  candidates: Chunk[]; // Initial search results
  model: string; // Cross-encoder model name
  topK: number; // Final number of results
}
```

---

#### 3. Query Expansion

**Description:** Expand queries with related terms and synonyms for better retrieval.

**Implementation:**
- Query rewriting using LLM
- Synonym expansion
- Multi-query generation (generate 3-5 query variations)
- Search with all variations and merge results

**Technical Details:**
- Location: `apps/api/src/rag/search/query-expansion.service.ts`
- **AI Time:** 2-3 days (query expansion)
- **Reference:** `docs/prd/v2-final-solution.md` - Strategy #3 (Query Expansion RAG)

**Example:**
```typescript
interface QueryExpansionOptions {
  originalQuery: string;
  expansionMethod: 'synonym' | 'llm' | 'multi-query';
  maxExpansions: number; // Default: 3
}
```

---

### Phase 2: Vector Database Abstraction (1-2 weeks with AI)

#### 1. Vector Database Interface

**Description:** Abstract vector operations behind a unified interface to support multiple vector databases.

**Implementation:**
- Define common interface for vector operations
- Support: pgvector, Pinecone, Weaviate, Qdrant
- Location: `apps/api/src/rag/providers/vector-db.interface.ts`
- **AI Time:** 1 day (interface definition)

**Interface:**
```typescript
interface VectorDatabase {
  upsert(collectionId: string, vectors: Vector[]): Promise<void>;
  query(collectionId: string, queryVector: number[], topK: number): Promise<Vector[]>;
  delete(collectionId: string, vectorIds: string[]): Promise<void>;
  createCollection(collectionId: string, config: CollectionConfig): Promise<void>;
  deleteCollection(collectionId: string): Promise<void>;
}
```

---

#### 2. Provider Implementations

**Description:** Implement adapters for each vector database provider.

**Providers:**
1. **pgvector** (existing, wrap in interface)
   - Already implemented
   - Wrap existing code in interface adapter
   - **AI Time:** 1 day

2. **Pinecone**
   - Pinecone client integration
   - Handle Pinecone-specific configuration
   - **AI Time:** 1 day (parallel work)

3. **Weaviate**
   - Weaviate client integration
   - Handle Weaviate-specific configuration
   - **AI Time:** 1 day (parallel work)

4. **Qdrant**
   - Qdrant client integration
   - Handle Qdrant-specific configuration
   - **AI Time:** 1 day (parallel work)

**Location:** `apps/api/src/rag/providers/`
- `pgvector.provider.ts`
- `pinecone.provider.ts`
- `weaviate.provider.ts`
- `qdrant.provider.ts`

**Total AI Time:** 3-4 days (adapters for each provider, parallel work)

---

### Phase 3: RAG Performance Optimization (1-2 weeks with AI)

#### 1. Caching Layer

**Description:** Cache embeddings and search results to improve performance.

**Implementation:**
- Cache query embeddings (avoid regenerating for same queries)
- Cache search results (with TTL)
- Cache document embeddings (for frequently accessed documents)
- Location: `apps/api/src/rag/cache/`
- **AI Time:** 2-3 days (caching implementation)

**Caching Strategy:**
```typescript
interface RAGCache {
  // Query embeddings cache
  getQueryEmbedding(query: string): Promise<number[] | null>;
  setQueryEmbedding(query: string, embedding: number[]): Promise<void>;
  
  // Search results cache
  getSearchResults(cacheKey: string): Promise<SearchResult[] | null>;
  setSearchResults(cacheKey: string, results: SearchResult[], ttl: number): Promise<void>;
  
  // Document embeddings cache
  getDocumentEmbedding(docId: string): Promise<number[] | null>;
  setDocumentEmbedding(docId: string, embedding: number[]): Promise<void>;
}
```

---

#### 2. Batch Processing

**Description:** Process multiple documents/embeddings in batches for efficiency.

**Implementation:**
- Batch embedding generation (process 100 documents at a time)
- Batch document processing (chunking + embedding in parallel)
- Batch vector upserts (bulk insert to vector database)
- Location: `apps/api/src/rag/processing/`
- **AI Time:** 2-3 days (batch processing)

**Batch Processing:**
```typescript
interface BatchProcessor {
  processDocuments(documents: Document[], batchSize: number): Promise<void>;
  generateEmbeddings(texts: string[], batchSize: number): Promise<number[][]>;
  upsertVectors(vectors: Vector[], batchSize: number): Promise<void>;
}
```

---

### Phase 4: Foundation for Future Advanced Strategies (Optional - Future)

**Note:** These advanced strategies are documented in `docs/prd/v2-final-solution.md` and can be implemented incrementally based on customer needs:

1. **Parent Document RAG** - Retrieve parent documents from chunks
   - When a chunk matches, retrieve the full parent document
   - Provides more context for LLM generation
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #1

2. **Multi-Query RAG** - Generate multiple query variations
   - Generate 3-5 query variations from original query
   - Search with each variation
   - Merge and deduplicate results
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #2

3. **Self-RAG** - Self-reflective retrieval and generation
   - LLM evaluates if retrieved context is sufficient
   - Iteratively refines query if needed
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #5

4. **Corrective RAG (C-RAG)** - Corrective retrieval with query refinement
   - Detect when initial retrieval fails
   - Generate corrective query
   - Re-retrieve with corrected query
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #6

5. **Adaptive RAG** - Route queries based on complexity
   - Simple queries: Direct LLM generation (no RAG)
   - Complex queries: RAG + LLM generation
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #7

6. **Agentic RAG** - LLM-guided retrieval and reasoning
   - LLM decides what to retrieve
   - Iterative retrieval based on reasoning
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #8

7. **Multi-Step RAG** - Iterative query refinement
   - Multiple retrieval steps
   - Each step refines based on previous results
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #9

8. **Contextual Compression RAG** - Compress context before generation
   - Compress retrieved chunks to fit token limits
   - Preserve most relevant information
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #10

9. **Ensemble RAG** - Combine multiple retrieval strategies
   - Run multiple retrieval strategies in parallel
   - Combine and rank results
   - **Reference:** `docs/prd/v2-final-solution.md` - Strategy #11

**Reference Implementation:** [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)

---

## Additional Future Enhancements

**From `specs/prd-phase-6-rag-infrastructure.md` Section 12:**

1. **Auto-tagging** - Use LLM to generate metadata tags for chunks
   - Automatic tag generation during document processing
   - Improves filtering and search

2. **Multi-modal** - Support images with vision models
   - Extract text from images
   - Generate embeddings from image content
   - Support PDFs with images

3. **Incremental Updates** - Update only changed chunks on re-upload
   - Detect which chunks changed
   - Re-embed only changed chunks
   - Faster document updates

4. **Analytics Dashboard** - Query patterns, popular documents, coverage gaps
   - Track query patterns
   - Identify popular documents
   - Find knowledge gaps

---

## Implementation Timeline

### Phase 1: Core Advanced RAG Patterns
- **Timeline:** 2-3 weeks (with AI)
- **Human Oversight:** 1 week
- **Cost:** $10K-$15K

### Phase 2: Vector Database Abstraction
- **Timeline:** 1-2 weeks (with AI)
- **Human Oversight:** 3-5 days
- **Cost:** $5K-$8K

### Phase 3: RAG Performance Optimization
- **Timeline:** 1-2 weeks (with AI)
- **Human Oversight:** 3-5 days
- **Cost:** $5K-$8K

### Phase 4: Future Advanced Strategies
- **Timeline:** Incremental (as needed)
- **Cost:** Varies by strategy

**Total Effort:** 4-7 weeks (with AI) for core patterns | 2-3 weeks human oversight  
**Total Cost:** $20K-$31K (core patterns)

---

## Priority & Impact

**Priority:** HIGH  
**Blocking:** Yes - Advanced RAG is a key differentiator for mid-sized companies

**Why This Matters:**
- Mid-sized companies need sophisticated knowledge retrieval
- Advanced RAG improves accuracy and relevance
- Multiple vector database support allows customers to use existing infrastructure
- Performance optimization ensures scalability

**Success Metrics:**
- Query accuracy: Relevant chunks in top 3 results (vs top 5 currently)
- Query latency: < 100ms for 95th percentile (with caching)
- Vector database support: 4+ providers (pgvector, Pinecone, Weaviate, Qdrant)

---

## Documentation References

- **Full Advanced RAG Roadmap:** `docs/prd/v2-final-solution.md` Section 1
- **Current RAG Implementation:** `specs/prd-phase-6-rag-infrastructure.md`
- **Reference Implementation:** [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)

---

**See Also:**
- `01-Tier1-Small-Mid-Sized-Hardening.md` - Main hardening assessment (brief RAG mention)
- `03-Checklist.md` - Actionable checklist
- `00-Index.md` - Quick reference

