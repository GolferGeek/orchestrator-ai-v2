import { Injectable, Logger } from '@nestjs/common';
import { RagDatabaseService } from './rag-database.service';
import { EmbeddingService } from './embedding.service';
import { QueryCollectionDto } from './dto';

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

interface DbSearchResult {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  content: string;
  score: number;
  page_number: number | null;
  chunk_index: number;
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
}
