import { Test, TestingModule } from '@nestjs/testing';
import { SourceCrawlRepository } from '../source-crawl.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { SourceCrawl } from '../../interfaces';

describe('SourceCrawlRepository', () => {
  let repository: SourceCrawlRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockCrawl: SourceCrawl = {
    id: 'crawl-123',
    source_id: 'source-123',
    started_at: '2024-01-15T10:00:00Z',
    completed_at: '2024-01-15T10:05:00Z',
    crawl_duration_ms: 300000,
    status: 'success',
    articles_found: 10,
    articles_new: 5,
    duplicates_exact: 2,
    duplicates_cross_source: 1,
    duplicates_fuzzy_title: 1,
    duplicates_phrase_overlap: 1,
    error_message: null,
    retry_count: 0,
    metadata: {},
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockCrawl, error: null };
    const listResult = overrides?.list ?? { data: [mockCrawl], error: null };
    const insertResult = overrides?.insert ?? { data: mockCrawl, error: null };
    const updateResult = overrides?.update ?? { data: mockCrawl, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

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
        SourceCrawlRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<SourceCrawlRepository>(SourceCrawlRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return crawl when found', async () => {
      const result = await repository.findById('crawl-123');

      expect(result).toEqual(mockCrawl);
    });

    it('should return null when crawl not found', async () => {
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

      await expect(repository.findById('crawl-123')).rejects.toThrow(
        'Failed to fetch crawl: Database error',
      );
    });
  });

  describe('findRecentForSource', () => {
    it('should return recent crawls for source', async () => {
      const result = await repository.findRecentForSource('source-123');

      expect(result).toEqual([mockCrawl]);
    });

    it('should accept custom limit', async () => {
      const result = await repository.findRecentForSource('source-123', 5);

      expect(result).toEqual([mockCrawl]);
    });

    it('should return empty array when no crawls found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findRecentForSource('source-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findRecentForSource('source-123'),
      ).rejects.toThrow(
        'Failed to fetch recent crawls for source: Query failed',
      );
    });
  });

  describe('findLatestForSource', () => {
    it('should return latest crawl for source', async () => {
      const result = await repository.findLatestForSource('source-123');

      expect(result).toEqual(mockCrawl);
    });

    it('should return null when no crawls found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findLatestForSource('source-123');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create crawl record successfully', async () => {
      const createData = {
        source_id: 'source-123',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockCrawl);
    });

    it('should create with running status by default', async () => {
      const result = await repository.create({ source_id: 'source-123' });

      expect(result).toBeDefined();
    });

    it('should create with custom status', async () => {
      const result = await repository.create({
        source_id: 'source-123',
        status: 'success',
      });

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
        repository.create({ source_id: 'source-123' }),
      ).rejects.toThrow('Create succeeded but no crawl record returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({ source_id: 'source-123' }),
      ).rejects.toThrow('Failed to create crawl record: Insert failed');
    });
  });

  describe('update', () => {
    it('should update crawl record successfully', async () => {
      const updatedCrawl = { ...mockCrawl, status: 'error' as const };
      const mockClient = createMockClient({
        update: { data: updatedCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.update('crawl-123', { status: 'error' });

      expect(result).toEqual(updatedCrawl);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('crawl-123', { status: 'error' }),
      ).rejects.toThrow('Update succeeded but no crawl record returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('crawl-123', { status: 'error' }),
      ).rejects.toThrow('Failed to update crawl record: Update failed');
    });
  });

  describe('markSuccess', () => {
    it('should mark crawl as successful with metrics', async () => {
      const successCrawl = { ...mockCrawl, status: 'success' as const };
      const mockClient = createMockClient({
        update: { data: successCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markSuccess('crawl-123', {
        articles_found: 10,
        articles_new: 5,
        duplicates_exact: 2,
        duplicates_cross_source: 1,
        duplicates_fuzzy_title: 1,
        duplicates_phrase_overlap: 1,
        crawl_duration_ms: 300000,
      });

      expect(result.status).toBe('success');
    });
  });

  describe('markError', () => {
    it('should mark crawl as error with message', async () => {
      const errorCrawl = {
        ...mockCrawl,
        status: 'error' as const,
        error_message: 'Connection failed',
      };
      const mockClient = createMockClient({
        update: { data: errorCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markError(
        'crawl-123',
        'Connection failed',
      );

      expect(result.status).toBe('error');
    });

    it('should include duration if provided', async () => {
      const errorCrawl = { ...mockCrawl, status: 'error' as const };
      const mockClient = createMockClient({
        update: { data: errorCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markError(
        'crawl-123',
        'Connection failed',
        5000,
      );

      expect(result).toBeDefined();
    });
  });

  describe('markTimeout', () => {
    it('should mark crawl as timeout', async () => {
      const timeoutCrawl = { ...mockCrawl, status: 'timeout' as const };
      const mockClient = createMockClient({
        update: { data: timeoutCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markTimeout('crawl-123');

      expect(result.status).toBe('timeout');
    });

    it('should include duration if provided', async () => {
      const timeoutCrawl = { ...mockCrawl, status: 'timeout' as const };
      const mockClient = createMockClient({
        update: { data: timeoutCrawl, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.markTimeout('crawl-123', 60000);

      expect(result).toBeDefined();
    });
  });

  describe('getStatsForSource', () => {
    it('should return stats for source', async () => {
      const crawls = [
        mockCrawl,
        { ...mockCrawl, id: 'crawl-456', articles_found: 8, articles_new: 3 },
      ];
      const mockClient = createMockClient({
        list: { data: crawls, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getStatsForSource('source-123');

      expect(result.total_crawls).toBe(2);
      expect(result.successful_crawls).toBe(2);
      expect(result.total_articles_found).toBe(18);
      expect(result.total_articles_new).toBe(8);
    });

    it('should accept custom days parameter', async () => {
      const result = await repository.getStatsForSource('source-123', 14);

      expect(result).toBeDefined();
    });

    it('should handle empty crawls', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getStatsForSource('source-123');

      expect(result.total_crawls).toBe(0);
      expect(result.successful_crawls).toBe(0);
      expect(result.avg_duration_ms).toBe(0);
    });

    it('should calculate duplicates correctly', async () => {
      const crawls = [mockCrawl];
      const mockClient = createMockClient({
        list: { data: crawls, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getStatsForSource('source-123');

      // 2 + 1 + 1 + 1 = 5 duplicates
      expect(result.total_duplicates).toBe(5);
    });

    it('should calculate average duration correctly', async () => {
      const crawls = [
        { ...mockCrawl, crawl_duration_ms: 1000 },
        { ...mockCrawl, id: 'crawl-456', crawl_duration_ms: 3000 },
      ];
      const mockClient = createMockClient({
        list: { data: crawls, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getStatsForSource('source-123');

      expect(result.avg_duration_ms).toBe(2000);
    });

    it('should only count successful crawls in metrics', async () => {
      const crawls = [
        mockCrawl, // success
        {
          ...mockCrawl,
          id: 'crawl-456',
          status: 'error' as const,
          articles_found: 0,
          articles_new: 0,
        },
      ];
      const mockClient = createMockClient({
        list: { data: crawls, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getStatsForSource('source-123');

      expect(result.total_crawls).toBe(2);
      expect(result.successful_crawls).toBe(1);
      expect(result.total_articles_found).toBe(10); // Only from successful crawl
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.getStatsForSource('source-123')).rejects.toThrow(
        'Failed to fetch crawl stats: Query failed',
      );
    });
  });

  describe('crawl statuses', () => {
    const statuses = ['running', 'success', 'error', 'timeout'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const crawlWithStatus = { ...mockCrawl, status };
        const mockClient = createMockClient({
          single: { data: crawlWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('crawl-123');

        expect(result?.status).toBe(status);
      });
    });
  });
});
