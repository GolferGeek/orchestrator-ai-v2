import { Test, TestingModule } from '@nestjs/testing';
import { TestArticleRepository, TestArticle } from '../test-article.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('TestArticleRepository', () => {
  let repository: TestArticleRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockArticle: TestArticle = {
    id: 'article-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    title: 'Test Article Title',
    content: 'Test article content about AAPL stock',
    source_name: 'Test News',
    published_at: '2024-01-01T10:00:00Z',
    target_symbols: ['AAPL', 'MSFT'],
    sentiment_expected: 'positive',
    strength_expected: 0.8,
    is_synthetic: true,
    synthetic_marker: 'TEST-001',
    processed: false,
    processed_at: null,
    created_by: 'user-123',
    created_at: '2024-01-01T09:00:00Z',
    metadata: { source: 'test-runner' },
  };

  const mockProcessedArticle: TestArticle = {
    ...mockArticle,
    id: 'article-456',
    processed: true,
    processed_at: '2024-01-01T11:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    insertBatch?: { data: unknown[] | null; error: { message: string } | null };
    update?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    updateBatch?: { data: unknown[] | null; error: { message: string } | null };
    delete?: { data?: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockArticle,
      error: null,
    };
    const listResult = overrides?.list ?? { data: [mockArticle], error: null };
    const insertResult = overrides?.insert ?? {
      data: mockArticle,
      error: null,
    };
    const insertBatchResult = overrides?.insertBatch ?? {
      data: [mockArticle],
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockArticle,
      error: null,
    };
    const updateBatchResult = overrides?.updateBatch ?? {
      data: [mockArticle],
      error: null,
    };
    const deleteResult = overrides?.delete ?? { data: [], error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        contains: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.contains as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockImplementation((data) => {
        if (Array.isArray(data)) {
          return {
            ...chainableResult,
            select: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) =>
                resolve(insertBatchResult),
            }),
          };
        }
        return {
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(insertResult),
            }),
          }),
        };
      });

      const updateChain: Record<string, unknown> = {
        eq: jest.fn(),
        in: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(updateBatchResult),
      };
      (updateChain.eq as jest.Mock).mockReturnValue(updateChain);
      (updateChain.in as jest.Mock).mockReturnValue(updateChain);
      (updateChain.select as jest.Mock).mockReturnValue(updateChain);
      (updateChain.single as jest.Mock).mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
      });
      (chainableResult.update as jest.Mock).mockReturnValue(updateChain);

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.select as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestArticleRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TestArticleRepository>(TestArticleRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return article when found', async () => {
      const result = await repository.findById('article-123');

      expect(result).toEqual(mockArticle);
    });

    it('should return null when article not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findById('article-123')).rejects.toThrow(
        'Failed to fetch test article: Database error',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return articles for organization', async () => {
      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no articles found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByOrganization('test-org')).rejects.toThrow(
        'Failed to fetch test articles: Query failed',
      );
    });
  });

  describe('findByScenario', () => {
    it('should return articles for scenario', async () => {
      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no articles found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByScenario('scenario-123')).rejects.toThrow(
        'Failed to fetch test articles by scenario: Query failed',
      );
    });
  });

  describe('findByTargetSymbol', () => {
    it('should return articles for target symbol', async () => {
      const result = await repository.findByTargetSymbol('AAPL');

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no articles found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByTargetSymbol('TSLA');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByTargetSymbol('AAPL')).rejects.toThrow(
        'Failed to fetch test articles by target symbol: Query failed',
      );
    });
  });

  describe('findUnprocessed', () => {
    it('should return unprocessed articles', async () => {
      const result = await repository.findUnprocessed();

      expect(result).toEqual([mockArticle]);
    });

    it('should filter by scenario when provided', async () => {
      const result = await repository.findUnprocessed('scenario-123');

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no unprocessed articles', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findUnprocessed();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findUnprocessed()).rejects.toThrow(
        'Failed to fetch unprocessed test articles: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create article successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        title: 'New Article',
        content: 'Article content',
        published_at: '2024-01-01T10:00:00Z',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockArticle);
    });

    it('should create with all optional fields', async () => {
      const createData = {
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'New Article',
        content: 'Article content',
        source_name: 'Test Source',
        published_at: '2024-01-01T10:00:00Z',
        target_symbols: ['AAPL'],
        sentiment_expected: 'positive' as const,
        strength_expected: 0.8,
        is_synthetic: true,
        synthetic_marker: 'TEST-001',
        processed: false,
        created_by: 'user-123',
        metadata: { test: true },
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          organization_slug: 'test-org',
          title: 'Test',
          content: 'Content',
          published_at: '2024-01-01T10:00:00Z',
        }),
      ).rejects.toThrow('Create succeeded but no test article returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          organization_slug: 'test-org',
          title: 'Test',
          content: 'Content',
          published_at: '2024-01-01T10:00:00Z',
        }),
      ).rejects.toThrow('Failed to create test article: Insert failed');
    });
  });

  describe('bulkCreate', () => {
    it('should bulk create articles', async () => {
      const articles = [
        {
          organization_slug: 'test-org',
          title: 'Article 1',
          content: 'Content 1',
          published_at: '2024-01-01T10:00:00Z',
        },
        {
          organization_slug: 'test-org',
          title: 'Article 2',
          content: 'Content 2',
          published_at: '2024-01-01T11:00:00Z',
        },
      ];
      const mockClient = createMockClient({
        insertBatch: {
          data: [mockArticle, { ...mockArticle, id: 'article-124' }],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.bulkCreate(articles);

      expect(result.length).toBe(2);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.bulkCreate([]);

      expect(result).toEqual([]);
    });

    it('should throw error on bulk create failure', async () => {
      const mockClient = createMockClient({
        insertBatch: { data: null, error: { message: 'Bulk insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.bulkCreate([
          {
            organization_slug: 'test-org',
            title: 'Test',
            content: 'Content',
            published_at: '2024-01-01T10:00:00Z',
          },
        ]),
      ).rejects.toThrow(
        'Failed to bulk create test articles: Bulk insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update article successfully', async () => {
      const result = await repository.update('article-123', {
        title: 'Updated Title',
      });

      expect(result).toEqual(mockArticle);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('article-123', { title: 'Updated' }),
      ).rejects.toThrow('Update succeeded but no test article returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('article-123', { title: 'Updated' }),
      ).rejects.toThrow('Failed to update test article: Update failed');
    });
  });

  describe('markProcessed', () => {
    it('should mark article as processed', async () => {
      const mockClient = createMockClient({
        update: { data: mockProcessedArticle, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markProcessed('article-123');

      expect(result.processed).toBe(true);
    });
  });

  describe('bulkMarkProcessed', () => {
    it('should bulk mark articles as processed', async () => {
      const mockClient = createMockClient({
        updateBatch: { data: [mockProcessedArticle], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.bulkMarkProcessed(['article-123']);

      expect(count).toBe(1);
    });

    it('should return 0 for empty input', async () => {
      const count = await repository.bulkMarkProcessed([]);

      expect(count).toBe(0);
    });

    it('should throw error on bulk mark failure', async () => {
      const mockClient = createMockClient({
        updateBatch: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.bulkMarkProcessed(['article-123']),
      ).rejects.toThrow(
        'Failed to bulk mark test articles as processed: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete article successfully', async () => {
      await expect(repository.delete('article-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('article-123')).rejects.toThrow(
        'Failed to delete test article: Delete failed',
      );
    });
  });

  describe('deleteByScenario', () => {
    it('should delete articles by scenario', async () => {
      const mockClient = createMockClient({
        delete: {
          data: [{ id: 'article-123' }, { id: 'article-124' }],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.deleteByScenario('scenario-123');

      expect(count).toBe(2);
    });

    it('should return 0 when no articles deleted', async () => {
      const mockClient = createMockClient({
        delete: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.deleteByScenario('scenario-123');

      expect(count).toBe(0);
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.deleteByScenario('scenario-123')).rejects.toThrow(
        'Failed to delete test articles by scenario: Delete failed',
      );
    });
  });

  describe('sentiment values', () => {
    const sentiments = ['positive', 'negative', 'neutral'] as const;

    sentiments.forEach((sentiment) => {
      it(`should handle ${sentiment} sentiment`, async () => {
        const articleWithSentiment = {
          ...mockArticle,
          sentiment_expected: sentiment,
        };
        const mockClient = createMockClient({
          single: { data: articleWithSentiment, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('article-123');

        expect(result?.sentiment_expected).toBe(sentiment);
      });
    });
  });
});
