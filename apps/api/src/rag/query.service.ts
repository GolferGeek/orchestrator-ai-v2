import { Injectable, Logger } from '@nestjs/common';
import { RagDatabaseService } from './rag-database.service';
import { EmbeddingService } from './embedding.service';
import { QueryCollectionDto } from './dto';
import { RagComplexityType } from './dto/create-collection.dto';

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  content: string;
  score: number;
  pageNumber: number | null;
  chunkIndex: number;
  charOffset?: number; // Character offset for highlighting in document viewer
  metadata?: Record<string, unknown>;
  // Extended fields for advanced RAG types
  documentIdRef?: string; // Document ID reference (e.g., "FP-001")
  sectionPath?: string; // Section path (e.g., "Article II > Section 2.1")
  matchType?: 'keyword' | 'semantic' | 'both'; // For hybrid search
  version?: string; // For temporal search
}

export interface RelatedDocument {
  documentId: string;
  documentIdRef?: string;
  title: string;
  relationship: string;
}

export interface QueryResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchDurationMs: number;
  // Extended fields for advanced RAG types
  relatedDocuments?: RelatedDocument[]; // For cross-reference search
  complexityType?: RagComplexityType;
}

interface DbSearchResult {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  content: string;
  score: number;
  page_number: number | null;
  chunk_index: number;
  char_offset: number | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private ragDb: RagDatabaseService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * Convert database row to API response format
   */
  private toSearchResult(
    row: DbSearchResult,
    includeMetadata: boolean,
  ): SearchResult {
    const result: SearchResult = {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentFilename: row.document_filename,
      content: row.content,
      score: parseFloat(row.score.toFixed(4)),
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      charOffset: row.char_offset ?? undefined,
    };

    if (includeMetadata) {
      result.metadata = row.metadata || {};
    }

    return result;
  }

  /**
   * Search a collection using vector similarity
   */
  async queryCollection(
    collectionId: string,
    organizationSlug: string,
    dto: QueryCollectionDto,
  ): Promise<QueryResponse> {
    const startTime = Date.now();

    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.embed(dto.query);

    // Execute search based on strategy
    let results: SearchResult[];

    switch (dto.strategy) {
      case 'mmr':
        results = await this.mmrSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
          dto.includeMetadata || false,
        );
        break;

      case 'reranking':
        // For now, fall back to basic search
        // Reranking requires a cross-encoder model
        this.logger.warn(
          'Reranking strategy not yet implemented, using basic search',
        );
        results = await this.basicSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
          dto.includeMetadata || false,
        );
        break;

      case 'basic':
      default:
        results = await this.basicSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
          dto.includeMetadata || false,
        );
    }

    const searchDurationMs = Date.now() - startTime;

    this.logger.debug(
      `Query '${dto.query.substring(0, 50)}...' returned ${results.length} results in ${searchDurationMs}ms`,
    );

    return {
      query: dto.query,
      results,
      totalResults: results.length,
      searchDurationMs,
    };
  }

  /**
   * Basic vector similarity search
   */
  private async basicSearch(
    collectionId: string,
    organizationSlug: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
    includeMetadata: boolean,
  ): Promise<SearchResult[]> {
    // Format embedding as PostgreSQL vector literal
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const rows = await this.ragDb.queryAll<DbSearchResult>(
      `SELECT * FROM rag_search($1, $2, $3::vector, $4, $5)`,
      [collectionId, organizationSlug, embeddingStr, topK, similarityThreshold],
    );

    return rows.map((row) => this.toSearchResult(row, includeMetadata));
  }

  /**
   * MMR (Maximal Marginal Relevance) search
   * Balances relevance with diversity to avoid redundant results
   */
  private async mmrSearch(
    collectionId: string,
    organizationSlug: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
    includeMetadata: boolean,
    lambda: number = 0.5,
  ): Promise<SearchResult[]> {
    // Get more candidates than needed
    const candidates = await this.basicSearch(
      collectionId,
      organizationSlug,
      queryEmbedding,
      topK * 3,
      similarityThreshold,
      includeMetadata,
    );

    if (candidates.length <= topK) {
      return candidates;
    }

    // For MMR, we need the embeddings of the candidates
    // Since we don't have them in the search results, we'll use a simplified version
    // that uses content similarity as a proxy for embedding similarity

    const selected: SearchResult[] = [];
    const remaining = [...candidates];

    while (selected.length < topK && remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIdx = 0;

      for (let i = 0; i < remaining.length; i++) {
        const current = remaining[i];
        if (!current) continue;

        const relevance = current.score;

        // Calculate max similarity to already selected items using content overlap
        const maxSimilarity =
          selected.length > 0
            ? Math.max(
                ...selected.map((s) =>
                  this.contentSimilarity(current.content, s.content),
                ),
              )
            : 0;

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      const best = remaining[bestIdx];
      if (best) {
        selected.push(best);
        remaining.splice(bestIdx, 1);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Simple content similarity based on Jaccard coefficient of words
   * Used as a proxy when embeddings aren't available
   */
  private contentSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  // ==========================================================================
  // COMPLEXITY-BASED QUERY METHODS
  // ==========================================================================

  /**
   * Query a collection using its complexity type
   * Routes to appropriate search strategy based on collection settings
   */
  async queryByComplexity(
    collectionId: string,
    organizationSlug: string,
    complexityType: RagComplexityType,
    dto: QueryCollectionDto,
  ): Promise<QueryResponse> {
    const startTime = Date.now();
    const queryEmbedding = await this.embeddingService.embed(dto.query);

    let results: SearchResult[];
    let relatedDocuments: RelatedDocument[] | undefined;

    switch (complexityType) {
      case 'attributed':
        results = await this.attributedSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
        );
        break;

      case 'hybrid':
        results = await this.hybridSearch(
          collectionId,
          organizationSlug,
          dto.query,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
        );
        break;

      case 'cross-reference': {
        const crossRefResult = await this.crossReferenceSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
        );
        results = crossRefResult.results;
        relatedDocuments = crossRefResult.relatedDocuments;
        break;
      }

      case 'temporal':
        results = await this.temporalSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
        );
        break;

      case 'basic':
      default:
        results = await this.basicSearch(
          collectionId,
          organizationSlug,
          queryEmbedding,
          dto.topK || 5,
          dto.similarityThreshold || 0.5,
          dto.includeMetadata || false,
        );
    }

    const searchDurationMs = Date.now() - startTime;

    this.logger.debug(
      `Complexity query (${complexityType}) '${dto.query.substring(0, 50)}...' returned ${results.length} results in ${searchDurationMs}ms`,
    );

    return {
      query: dto.query,
      results,
      totalResults: results.length,
      searchDurationMs,
      complexityType,
      relatedDocuments,
    };
  }

  /**
   * Attributed search - Standard vector search with document citations enrichment
   * Extracts document_id and section_path from chunk metadata
   */
  private async attributedSearch(
    collectionId: string,
    organizationSlug: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
  ): Promise<SearchResult[]> {
    const baseResults = await this.basicSearch(
      collectionId,
      organizationSlug,
      queryEmbedding,
      topK,
      similarityThreshold,
      true, // Always include metadata for attribution
    );

    // Enrich with attribution info from metadata
    return baseResults.map((result) => ({
      ...result,
      documentIdRef: this.extractDocumentId(result.metadata),
      sectionPath: this.extractSectionPath(result.metadata, result.content),
    }));
  }

  /**
   * Hybrid search - Combines keyword search with vector search using RRF
   * Uses PostgreSQL full-text search for keywords + vector similarity
   */
  private async hybridSearch(
    collectionId: string,
    organizationSlug: string,
    query: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
  ): Promise<SearchResult[]> {
    // Get semantic results
    const semanticResults = await this.basicSearch(
      collectionId,
      organizationSlug,
      queryEmbedding,
      topK * 2, // Get more candidates for merging
      similarityThreshold * 0.8, // Lower threshold to get more candidates
      true,
    );

    // Get keyword results using full-text search
    const keywordResults = await this.keywordSearch(
      collectionId,
      organizationSlug,
      query,
      topK * 2,
    );

    // Merge using Reciprocal Rank Fusion (RRF)
    const merged = this.reciprocalRankFusion(
      semanticResults,
      keywordResults,
      topK,
    );

    return merged;
  }

  /**
   * Keyword search using PostgreSQL full-text search
   */
  private async keywordSearch(
    collectionId: string,
    organizationSlug: string,
    query: string,
    topK: number,
  ): Promise<SearchResult[]> {
    // Convert query to tsquery format
    const tsQuery = query
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter((w) => w)
      .join(' & ');

    if (!tsQuery) {
      return [];
    }

    try {
      const rows = await this.ragDb.queryAll<DbSearchResult>(
        `SELECT
          c.id AS chunk_id,
          c.document_id,
          d.filename AS document_filename,
          c.content,
          ts_rank(to_tsvector('english', c.content), to_tsquery('english', $4)) AS score,
          c.page_number,
          c.chunk_index,
          c.metadata
        FROM rag_data.rag_document_chunks c
        JOIN rag_data.rag_documents d ON c.document_id = d.id
        JOIN rag_data.rag_collections col ON c.collection_id = col.id
        WHERE col.id = $1
          AND col.organization_slug = $2
          AND to_tsvector('english', c.content) @@ to_tsquery('english', $4)
        ORDER BY score DESC
        LIMIT $3`,
        [collectionId, organizationSlug, topK, tsQuery],
      );

      return rows.map((row) => ({
        ...this.toSearchResult(row, true),
        matchType: 'keyword' as const,
      }));
    } catch (error) {
      this.logger.warn(
        `Keyword search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion - Combines ranked lists
   * RRF(d) = Σ 1/(k + rank(d)) for each ranking
   */
  private reciprocalRankFusion(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[],
    topK: number,
    k: number = 60,
  ): SearchResult[] {
    const scores = new Map<
      string,
      { score: number; result: SearchResult; sources: Set<string> }
    >();

    // Add semantic results
    semanticResults.forEach((result, idx) => {
      const existing = scores.get(result.chunkId);
      const rrfScore = 1 / (k + idx + 1);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('semantic');
      } else {
        scores.set(result.chunkId, {
          score: rrfScore,
          result: { ...result, matchType: 'semantic' },
          sources: new Set(['semantic']),
        });
      }
    });

    // Add keyword results
    keywordResults.forEach((result, idx) => {
      const existing = scores.get(result.chunkId);
      const rrfScore = 1 / (k + idx + 1);
      if (existing) {
        existing.score += rrfScore;
        existing.sources.add('keyword');
        // If found in both, mark as 'both'
        if (existing.sources.size === 2) {
          existing.result.matchType = 'both';
        }
      } else {
        scores.set(result.chunkId, {
          score: rrfScore,
          result: { ...result, matchType: 'keyword' },
          sources: new Set(['keyword']),
        });
      }
    });

    // Sort by RRF score and return top K
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        ...item.result,
        score: item.score,
      }));
  }

  /**
   * Cross-reference search - Vector search + follow document links
   * Identifies related documents from cross_references in metadata
   */
  private async crossReferenceSearch(
    collectionId: string,
    organizationSlug: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
  ): Promise<{ results: SearchResult[]; relatedDocuments: RelatedDocument[] }> {
    const baseResults = await this.basicSearch(
      collectionId,
      organizationSlug,
      queryEmbedding,
      topK,
      similarityThreshold,
      true,
    );

    // Extract cross-references from metadata
    const relatedDocIds = new Set<string>();
    const relatedDocuments: RelatedDocument[] = [];

    for (const result of baseResults) {
      // Enrich with document ID
      result.documentIdRef = this.extractDocumentId(result.metadata);
      result.sectionPath = this.extractSectionPath(
        result.metadata,
        result.content,
      );

      // Extract cross-references
      const refs = this.extractCrossReferences(result.metadata, result.content);
      for (const ref of refs) {
        const refId = ref.documentIdRef || ref.documentId;
        if (refId && !relatedDocIds.has(refId)) {
          relatedDocIds.add(refId);
          relatedDocuments.push(ref);
        }
      }
    }

    return { results: baseResults, relatedDocuments };
  }

  /**
   * Temporal search - Vector search with version information
   * Extracts version from metadata and sorts by version when relevant
   */
  private async temporalSearch(
    collectionId: string,
    organizationSlug: string,
    queryEmbedding: number[],
    topK: number,
    similarityThreshold: number,
  ): Promise<SearchResult[]> {
    const baseResults = await this.basicSearch(
      collectionId,
      organizationSlug,
      queryEmbedding,
      topK * 2, // Get more to group by version
      similarityThreshold,
      true,
    );

    // Enrich with version info and group
    const enriched = baseResults.map((result) => ({
      ...result,
      documentIdRef: this.extractDocumentId(result.metadata),
      version: this.extractVersion(result.metadata, result.documentFilename),
    }));

    // Group by document and show latest version first, but include all versions
    const byDocument = new Map<string, SearchResult[]>();
    for (const result of enriched) {
      const key = result.documentIdRef || result.documentFilename;
      if (!byDocument.has(key)) {
        byDocument.set(key, []);
      }
      byDocument.get(key)!.push(result);
    }

    // Sort each group by version (descending) and flatten
    const sorted: SearchResult[] = [];
    for (const [, versions] of byDocument) {
      versions.sort((a, b) => {
        const vA = a.version || '0';
        const vB = b.version || '0';
        return vB.localeCompare(vA, undefined, { numeric: true });
      });
      sorted.push(...versions);
    }

    return sorted.slice(0, topK);
  }

  // ==========================================================================
  // HELPER METHODS FOR METADATA EXTRACTION
  // ==========================================================================

  /**
   * Extract document ID from metadata (e.g., "FP-001")
   */
  private extractDocumentId(
    metadata?: Record<string, unknown>,
  ): string | undefined {
    if (!metadata) return undefined;

    // Check common fields
    if (typeof metadata.document_id === 'string') return metadata.document_id;
    if (typeof metadata.documentId === 'string') return metadata.documentId;
    if (typeof metadata.doc_id === 'string') return metadata.doc_id;

    return undefined;
  }

  /**
   * Extract section path from metadata or content headers
   */
  private extractSectionPath(
    metadata?: Record<string, unknown>,
    content?: string,
  ): string | undefined {
    // Try metadata first
    if (metadata) {
      if (typeof metadata.section_path === 'string')
        return metadata.section_path;
      if (typeof metadata.sectionPath === 'string') return metadata.sectionPath;
      if (typeof metadata.section === 'string') return metadata.section;
    }

    // Try to extract from content headers
    if (content) {
      const headerMatch = content.match(/^#+\s+(.+?)$/m);
      if (headerMatch) return headerMatch[1];
    }

    return undefined;
  }

  /**
   * Extract cross-references from metadata or content links
   */
  private extractCrossReferences(
    metadata?: Record<string, unknown>,
    content?: string,
  ): RelatedDocument[] {
    const refs: RelatedDocument[] = [];

    // Check metadata for cross_references array
    if (
      metadata?.cross_references &&
      Array.isArray(metadata.cross_references)
    ) {
      for (const ref of metadata.cross_references) {
        if (typeof ref === 'string') {
          refs.push({
            documentId: ref,
            documentIdRef: ref,
            title: ref,
            relationship: 'referenced',
          });
        } else if (typeof ref === 'object' && ref !== null) {
          const refObj = ref as Record<string, unknown>;
          const getId = (): string => {
            if (typeof refObj.id === 'string') return refObj.id;
            if (typeof refObj.document_id === 'string')
              return refObj.document_id;
            return '';
          };
          const getTitle = (): string => {
            if (typeof refObj.title === 'string') return refObj.title;
            if (typeof refObj.name === 'string') return refObj.name;
            return '';
          };
          const getRelationship = (): string => {
            if (typeof refObj.relationship === 'string')
              return refObj.relationship;
            return 'referenced';
          };
          refs.push({
            documentId: getId(),
            documentIdRef: getId(),
            title: getTitle(),
            relationship: getRelationship(),
          });
        }
      }
    }

    // Extract from content markdown links: [Title](LIT-001)
    if (content) {
      const linkPattern = /\[([^\]]+)\]\(([A-Z]{2,4}-\d{3})\)/g;
      let match;
      while ((match = linkPattern.exec(content)) !== null) {
        const docId = match[2] || '';
        refs.push({
          documentId: docId,
          documentIdRef: docId,
          title: match[1] || docId,
          relationship: 'see also',
        });
      }
    }

    return refs;
  }

  /**
   * Extract version from metadata or filename
   */
  private extractVersion(
    metadata?: Record<string, unknown>,
    filename?: string,
  ): string | undefined {
    // Try metadata first
    if (metadata) {
      if (typeof metadata.version === 'string') return metadata.version;
      if (typeof metadata.doc_version === 'string') return metadata.doc_version;
    }

    // Try to extract from filename (e.g., "document-v2.md", "document-v1.0.md")
    if (filename) {
      const versionMatch = filename.match(/-v(\d+(?:\.\d+)?)/i);
      if (versionMatch) return versionMatch[1];
    }

    return undefined;
  }
}
