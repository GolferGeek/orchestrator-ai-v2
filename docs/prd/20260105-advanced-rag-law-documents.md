# Advanced RAG for Law Documents - Implementation Plan

**Date**: 2026-01-05
**Status**: Draft
**Related PRD**: [20260105-legal-department-ai-m0.md](./20260105-legal-department-ai-m0.md)

## Overview

This plan implements an advanced RAG (Retrieval-Augmented Generation) system that provides **document-level attribution** alongside chunk retrieval. When users query the RAG system, they receive not just relevant text chunks but also:

1. **Document Links** - Direct references to source documents
2. **Section Attribution** - Which section/heading the chunk came from
3. **Document Metadata** - Title, category, version, last updated
4. **Contextual Breadcrumbs** - Document → Section → Subsection path

## Current State Analysis

### Existing RAG Infrastructure

The codebase already has a solid RAG foundation:

| Component | Location | Status |
|-----------|----------|--------|
| `rag_collections` | `rag_data` schema | ✅ Exists |
| `rag_documents` | `rag_data` schema | ✅ Exists with `metadata` JSONB |
| `rag_document_chunks` | `rag_data` schema | ✅ Has `document_id` FK |
| `QueryService` | [apps/api/src/rag/query.service.ts](../apps/api/src/rag/query.service.ts) | ✅ Returns `documentId`, `documentFilename` |
| `DocumentProcessorService` | [apps/api/src/rag/document-processor.service.ts](../apps/api/src/rag/document-processor.service.ts) | ✅ Full pipeline |
| Extractors | PDF, DOCX, Text | ✅ Working |

### What's Missing for "Advanced" RAG

1. **Rich Document Metadata** - Documents are stored but without structured metadata (title, category, URL, version)
2. **Section-Level Attribution** - Chunks don't track which heading/section they came from
3. **Document URLs/Links** - No way to generate clickable links back to source documents
4. **Enhanced Search Response** - Search returns chunks but doesn't aggregate by document

## Implementation Plan

### Phase 1: Enhanced Document Metadata Schema

**Goal**: Enrich document metadata during ingestion for better attribution.

#### 1.1 Define Document Metadata Contract

```typescript
// Enhanced document metadata structure
interface LawDocumentMetadata {
  // Document identification
  title: string;                    // "Standard Non-Disclosure Agreement"
  slug: string;                     // "standard-nda-template"
  category: string;                 // "contracts" | "firm-policies" | "litigation" | etc.
  subcategory?: string;             // "templates" | "checklists" | etc.

  // Document structure
  documentType: string;             // "template" | "policy" | "checklist" | "guide"
  sections: string[];               // ["RECITALS", "DEFINITION OF CONFIDENTIAL INFORMATION", ...]

  // Source information
  sourcePath: string;               // "/docs/RAG-filler/law/contracts/standard-nda-template.md"
  sourceUrl?: string;               // Public URL if available

  // Versioning
  version?: string;                 // "1.0"
  lastUpdated?: string;             // ISO date

  // Search optimization
  keywords?: string[];              // ["NDA", "confidentiality", "non-disclosure"]
}
```

#### 1.2 Define Chunk Metadata Contract

```typescript
// Enhanced chunk metadata for section attribution
interface LawChunkMetadata {
  // Section hierarchy
  sectionPath: string[];            // ["ARTICLE II", "2.1 Standard Exceptions"]
  sectionTitle: string;             // "Standard Exceptions"
  headingLevel: number;             // 1, 2, 3 (H1, H2, H3)

  // Position in document
  isFirstInSection: boolean;        // True if this chunk starts a section
  precedingHeading?: string;        // The heading immediately before this chunk

  // Document reference (denormalized for query efficiency)
  documentTitle: string;            // "Standard Non-Disclosure Agreement"
  documentCategory: string;         // "contracts"
}
```

### Phase 2: Smart Document Parser

**Goal**: Extract structured metadata from markdown documents during ingestion.

#### 2.1 Markdown Parser Service

Create a parser that extracts:
- Document title from H1 or frontmatter
- Section hierarchy from headings
- Category from file path
- Keywords from content analysis

```typescript
// apps/api/src/rag/parsers/markdown-parser.service.ts
@Injectable()
export class MarkdownParserService {
  /**
   * Parse markdown document to extract structure and metadata
   */
  parseDocument(content: string, filePath: string): ParsedDocument {
    return {
      title: this.extractTitle(content),
      sections: this.extractSections(content),
      category: this.extractCategoryFromPath(filePath),
      metadata: this.extractFrontmatter(content),
    };
  }

  /**
   * Chunk with section awareness
   */
  chunkWithSections(
    content: string,
    options: ChunkOptions
  ): ChunkWithSection[] {
    // Split by sections first, then chunk within sections
    // Each chunk gets section attribution
  }
}
```

#### 2.2 Section-Aware Chunking

Modify the chunking strategy to:
1. Split document by major sections (## headings)
2. Chunk within sections while preserving section metadata
3. Include preceding heading in chunk metadata

```typescript
// Enhanced chunking output
interface ChunkWithSection extends Chunk {
  metadata: {
    sectionPath: string[];
    sectionTitle: string;
    precedingHeading: string;
    documentTitle: string;
    documentCategory: string;
  };
}
```

### Phase 3: Enhanced Search Response

**Goal**: Return document-level attribution alongside chunks.

#### 3.1 Extended SearchResult Interface

```typescript
// apps/transport-types/response/rag-response.types.ts

export interface EnhancedSearchResult extends SearchResult {
  // Existing fields
  chunkId: string;
  documentId: string;
  documentFilename: string;
  content: string;
  score: number;

  // Enhanced fields
  document: {
    title: string;
    category: string;
    documentType: string;
    sourcePath: string;
    sourceUrl?: string;
  };

  section: {
    path: string[];           // ["ARTICLE II", "2.1 Standard Exceptions"]
    title: string;            // "Standard Exceptions"
    breadcrumb: string;       // "ARTICLE II > 2.1 Standard Exceptions"
  };

  // Citation helper
  citation: string;           // "Standard NDA Template, Section 2.1 Standard Exceptions"
}
```

#### 3.2 Document-Grouped Response

Add option to group results by document:

```typescript
export interface DocumentGroupedResponse {
  query: string;
  documents: Array<{
    documentId: string;
    title: string;
    category: string;
    sourcePath: string;
    relevanceScore: number;   // Aggregate score across chunks
    chunks: EnhancedSearchResult[];
  }>;
  totalDocuments: number;
  totalChunks: number;
  searchDurationMs: number;
}
```

### Phase 4: Law Document Ingestion Script

**Goal**: Ingest all law documents with rich metadata.

#### 4.1 Documents to Ingest

| Path | Category | Document Type |
|------|----------|---------------|
| `contracts/standard-nda-template.md` | contracts | template |
| `contracts/engagement-letter-template.md` | contracts | template |
| `client-intake/personal-injury-intake-checklist.md` | client-intake | checklist |
| `firm-policies/fee-agreement-policy.md` | firm-policies | policy |
| `firm-policies/client-confidentiality-policy.md` | firm-policies | policy |
| `firm-policies/conflict-of-interest-policy.md` | firm-policies | policy |
| `estate-planning/basic-estate-plan-guide.md` | estate-planning | guide |
| `litigation/motion-to-dismiss-checklist.md` | litigation | checklist |

#### 4.2 Ingestion Script

```typescript
// scripts/ingest-law-documents.ts

async function ingestLawDocuments() {
  const lawDocsPath = 'docs/RAG-filler/law';

  // 1. Create collection for law documents
  const collection = await createCollection({
    name: 'law-firm-knowledge',
    slug: 'law-firm-knowledge',
    description: 'Law firm templates, policies, and procedures',
    embeddingModel: 'text-embedding-3-small',
    chunkSize: 500,
    chunkOverlap: 50,
  });

  // 2. Process each document with enhanced metadata
  for (const docPath of lawDocuments) {
    const content = await readFile(docPath);
    const parsed = markdownParser.parseDocument(content, docPath);

    await processDocumentWithMetadata({
      collectionId: collection.id,
      content,
      filename: path.basename(docPath),
      metadata: {
        title: parsed.title,
        category: parsed.category,
        documentType: parsed.documentType,
        sections: parsed.sections,
        sourcePath: docPath,
        keywords: parsed.keywords,
      },
    });
  }
}
```

### Phase 5: RAG Runner Enhancement & Agent Registration

**Goal**: Enhance the existing RAG Runner to support advanced RAG complexity levels and register the Legal Department RAG agent.

#### 5.1 RAG Runner Architecture

The existing `RagAgentRunnerService` ([apps/api/src/agent2agent/services/rag-agent-runner.service.ts](../apps/api/src/agent2agent/services/rag-agent-runner.service.ts)) handles RAG agent execution. It uses `RagConfig` from agent metadata:

```typescript
// Current RagConfig (line 28)
interface RagConfig {
  collection_slug: string;
  top_k?: number;
  similarity_threshold?: number;
  no_results_message?: string;
  no_access_message?: string;
}
```

**Enhanced RagConfig** - Add complexity level flag:

```typescript
interface RagConfig {
  collection_slug: string;
  top_k?: number;
  similarity_threshold?: number;
  no_results_message?: string;
  no_access_message?: string;

  // NEW: RAG complexity level
  // 'basic' - Standard chunk retrieval (existing behavior)
  // 'attributed' - Chunks include parent document metadata and section attribution
  // Future: 'hybrid', 'multi-hop', 'agentic', etc.
  complexity?: 'basic' | 'attributed';  // Default: 'basic'

  // NEW: Attributed RAG options (only used when complexity='attributed')
  attributedOptions?: {
    includeDocumentMetadata: boolean;    // Include document title, category, sourcePath
    includeSectionAttribution: boolean;  // Include section breadcrumbs
    groupByDocument: boolean;            // Aggregate results by document
    generateCitations: boolean;          // Add citation strings to results
  };
}
```

#### 5.2 RAG Runner Changes

Modify `RagAgentRunnerService` to switch behavior based on `complexity`:

```typescript
// In handleConverse() and executeBuild()
const ragConfig = this.extractRagConfig(definition);

if (ragConfig.complexity === 'attributed') {
  // Use attributed query with document/section metadata
  const queryResponse = await this.queryService.queryCollectionAttributed(
    collection.id,
    resolvedOrgSlug,
    {
      query: userMessage,
      topK: ragConfig.top_k ?? 5,
      similarityThreshold: ragConfig.similarity_threshold ?? 0.5,
      strategy: 'mmr',  // Use MMR for diversity in attributed mode
      includeMetadata: true,
      includeDocumentMetadata: ragConfig.attributedOptions?.includeDocumentMetadata ?? true,
      includeSectionAttribution: ragConfig.attributedOptions?.includeSectionAttribution ?? true,
      groupByDocument: ragConfig.attributedOptions?.groupByDocument ?? false,
    },
  );

  // Build prompt with enhanced citations
  const systemPrompt = this.buildAttributedRagPrompt(
    definition,
    collection,
    queryResponse.results,
    optimizedHistory,
  );
} else {
  // Existing basic behavior
}
```

#### 5.3 Legal Department RAG Agent Registration

Register a new RAG agent in the database with advanced complexity:

```sql
INSERT INTO agents.agent_definitions (
  slug,
  name,
  description,
  agent_type,
  visibility,
  metadata,
  prompts,
  llm,
  organization_slugs
) VALUES (
  'legal-knowledge-agent',
  'Legal Knowledge Assistant',
  'Answers questions about law firm policies, templates, and procedures using the firm knowledge base',
  'rag',
  'organization',
  jsonb_build_object(
    'rag_config', jsonb_build_object(
      'collection_slug', 'law-firm-knowledge',
      'top_k', 5,
      'similarity_threshold', 0.6,
      'complexity', 'attributed',
      'attributedOptions', jsonb_build_object(
        'includeDocumentMetadata', true,
        'includeSectionAttribution', true,
        'groupByDocument', false,
        'generateCitations', true
      ),
      'no_results_message', 'I could not find relevant information in our law firm knowledge base for that question.',
      'no_access_message', 'You do not have access to the legal knowledge base.'
    )
  ),
  jsonb_build_object(
    'system', 'You are a Legal Knowledge Assistant for a law firm. Answer questions using ONLY the retrieved context from our knowledge base. Always cite your sources using the document title and section. If the context does not contain enough information, say so clearly.',
    'build', 'You are generating a formal response to a legal knowledge query. Structure your response clearly with proper citations to source documents.'
  ),
  jsonb_build_object(
    'provider', 'anthropic',
    'model', 'claude-sonnet-4-20250514',
    'temperature', 0.3,
    'maxTokens', 2000
  ),
  ARRAY['demo-org']
);
```

#### 5.4 Response Format with Citations

When `generateCitations: true`, the RAG Runner formats sources in the response:

```
Based on our firm's policies:

**Standard NDA Template** (contracts)
> The Receiving Party agrees that the Confidential Information is to be considered
> confidential and proprietary to Disclosing Party...
> — Section 3: Obligations of Receiving Party

**Conflict of Interest Policy** (firm-policies)
> Before accepting any new client matter, attorneys must conduct a conflict check...
> — Section 2.1: Conflict Check Procedures

Sources:
- Standard NDA Template: /docs/RAG-filler/law/contracts/standard-nda-template.md
- Conflict of Interest Policy: /docs/RAG-filler/law/firm-policies/conflict-of-interest-policy.md
```

The `formatSources()` method in the runner is enhanced to include document metadata and section breadcrumbs when available

## Deliverables Summary

| # | Deliverable | Type | Priority |
|---|-------------|------|----------|
| 1 | `MarkdownParserService` | API Service | High |
| 2 | Enhanced `ChunkingService` with section awareness | API Service | High |
| 3 | `EnhancedSearchResult` type | Transport Types | High |
| 4 | `DocumentGroupedResponse` type | Transport Types | Medium |
| 5 | Law document ingestion script | Script | High |
| 6 | Updated `QueryService.queryCollectionAttributed()` | API Service | High |
| 7 | Enhanced `RagAgentRunnerService` with complexity switch (`attributed`) | API Service | High |
| 8 | Legal Knowledge Agent registration (SQL) | Database | High |
| 9 | Unit tests for markdown parser | Tests | High |

## File Changes

### New Files

```
apps/api/src/rag/parsers/
├── markdown-parser.service.ts      # Parse markdown structure
├── markdown-parser.service.spec.ts # Tests
└── index.ts                        # Exports

apps/transport-types/response/
└── rag-response.types.ts           # Enhanced response types

scripts/
└── ingest-law-documents.ts         # Ingestion script

apps/api/supabase/migrations/
└── YYYYMMDD_add_legal_knowledge_agent.sql  # Agent registration
```

### Modified Files

```
apps/api/src/rag/
├── chunking.service.ts             # Add section-aware chunking
├── query.service.ts                # Add queryCollectionAttributed(), document grouping
├── query.controller.ts             # Add query params for metadata/grouping
└── dto/query-collection.dto.ts     # Add includeDocumentMetadata, groupByDocument

apps/api/src/agent2agent/services/
└── rag-agent-runner.service.ts     # Add complexity switch, buildAttributedRagPrompt()
```

## Success Criteria

1. **Document Attribution**: Every search result includes document title, category, and source path
2. **Section Attribution**: Every chunk knows which section it came from
3. **Citation Generation**: Agent responses include proper citations to source documents
4. **Document Grouping**: Ability to group chunks by parent document
5. **All Law Documents Ingested**: 8 documents successfully processed with rich metadata

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Markdown parsing edge cases | Start with simple structure, iterate based on real documents |
| Large documents chunking | Section-aware chunking prevents splitting mid-section |
| Performance impact of metadata | Metadata is stored once per document, denormalized to chunks |
| Breaking existing RAG queries | Enhanced fields are additive, existing queries continue to work |

## Next Steps

1. **Approve this plan** - Review with stakeholder
2. **Create `MarkdownParserService`** - Core parsing logic for extracting document structure
3. **Update `ChunkingService`** - Add section-aware chunking
4. **Add `EnhancedSearchResult` types** - Transport types for rich results
5. **Add `queryCollectionAttributed()`** - QueryService enhancement
6. **Enhance `RagAgentRunnerService`** - Add complexity switch and `buildAttributedRagPrompt()`
7. **Create ingestion script** - Ingest law documents with rich metadata
8. **Run ingestion** - Load all 8 law documents into `law-firm-knowledge` collection
9. **Register Legal Knowledge Agent** - SQL migration with advanced RAG config
10. **Test with sample queries** - Validate document/section attribution works end-to-end
