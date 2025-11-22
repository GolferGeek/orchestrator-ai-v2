import { Test, TestingModule } from '@nestjs/testing';
import { QueryService } from '../query.service';
import { RagDatabaseService } from '../rag-database.service';
import { EmbeddingService } from '../embedding.service';

describe('QueryService', () => {
  let service: QueryService;
  let ragDb: jest.Mocked<RagDatabaseService>;
  let embeddingService: jest.Mocked<EmbeddingService>;

  const mockSearchResults = [
    {
      chunk_id: 'chunk-1',
      document_id: 'doc-1',
      document_filename: 'test.pdf',
      content: 'This is the first chunk content.',
      score: 0.95,
      page_number: 1,
      chunk_index: 0,
      metadata: {},
    },
    {
      chunk_id: 'chunk-2',
      document_id: 'doc-1',
      document_filename: 'test.pdf',
      content: 'This is the second chunk content.',
      score: 0.85,
      page_number: 1,
      chunk_index: 1,
      metadata: {},
    },
  ];

  const mockEmbedding = Array(768).fill(0.1);

  beforeEach(async () => {
    const mockRagDb = {
      queryAll: jest.fn(),
    };

    const mockEmbeddingService = {
      embed: jest.fn().mockResolvedValue(mockEmbedding),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: RagDatabaseService, useValue: mockRagDb },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    ragDb = module.get(RagDatabaseService);
    embeddingService = module.get(EmbeddingService);
  });

  describe('queryCollection', () => {
    it('should return search results for a query', async () => {
      ragDb.queryAll.mockResolvedValue(mockSearchResults);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        topK: 5,
      });

      expect(result.query).toBe('test query');
      expect(result.results).toHaveLength(2);
      expect(result.totalResults).toBe(2);
      expect(result.searchDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should generate embedding for query', async () => {
      ragDb.queryAll.mockResolvedValue(mockSearchResults);

      await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
      });

      // Verify embed was called with query
      expect(embeddingService.embed.mock.calls[0]?.[0]).toBe('test query');
    });

    it('should pass correct parameters to database', async () => {
      ragDb.queryAll.mockResolvedValue([]);

      await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        topK: 10,
        similarityThreshold: 0.7,
      });

      // Verify queryAll was called with search parameters
      const [query, params] = ragDb.queryAll.mock.calls[0] ?? [];
      expect(query).toContain('rag_search');
      expect(params).toContain('collection-1');
      expect(params).toContain('test-org');
    });

    it('should include metadata when requested', async () => {
      ragDb.queryAll.mockResolvedValue([
        { ...mockSearchResults[0], metadata: { key: 'value' } },
      ]);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        includeMetadata: true,
      });

      expect(result.results[0]?.metadata).toEqual({ key: 'value' });
    });

    it('should not include metadata by default', async () => {
      ragDb.queryAll.mockResolvedValue(mockSearchResults);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        includeMetadata: false,
      });

      expect(result.results[0]?.metadata).toBeUndefined();
    });

    it('should format scores to 4 decimal places', async () => {
      ragDb.queryAll.mockResolvedValue([
        { ...mockSearchResults[0], score: 0.123456789 },
      ]);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
      });

      expect(result.results[0]?.score).toBe(0.1235);
    });
  });

  describe('MMR search', () => {
    it('should use MMR strategy when specified', async () => {
      // Return more results for MMR to filter
      const manyResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockSearchResults[0],
          chunk_id: `chunk-${i}`,
          content: `Content ${i}`,
          score: 0.9 - i * 0.05,
        }));

      ragDb.queryAll.mockResolvedValue(manyResults);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        topK: 3,
        strategy: 'mmr',
      });

      expect(result.results).toHaveLength(3);
    });

    it('should return all results if fewer than topK candidates', async () => {
      ragDb.queryAll.mockResolvedValue(mockSearchResults);

      const result = await service.queryCollection('collection-1', 'test-org', {
        query: 'test query',
        topK: 10,
        strategy: 'mmr',
      });

      expect(result.results).toHaveLength(2);
    });
  });
});
