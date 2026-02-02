import { Test, TestingModule } from '@nestjs/testing';
import { ArticleRepository } from '../article.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Article, ArticleFingerprint, ArticleWithPhraseOverlap } from '../../interfaces';

describe('ArticleRepository', () => {
  let repository: ArticleRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockArticle: Article = {
    id: 'article-123',
    organization_slug: 'test-org',
    source_id: 'source-123',
    url: 'https://example.com/article-1',
    title: 'Test Article',
    content: 'Test content',
    summary: 'Test summary',
    author: 'Test Author',
    published_at: '2024-01-15T10:00:00Z',
    content_hash: 'abc123hash',
    title_normalized: 'test article',
    key_phrases: ['test', 'article'],
    fingerprint_hash: 'fingerprint123',
    raw_data: { original: 'data' },
    is_test: false,
    first_seen_at: '2024-01-15T10:00:00Z',
    metadata: {},
  };

  const mockFingerprint: ArticleFingerprint = {
    article_id: 'article-123',
    source_id: 'source-123',
    title_normalized: 'test article',
    key_phrases: ['test', 'article'],
    fingerprint_hash: 'fingerprint123',
    first_seen_at: '2024-01-15T10:00:00Z',
  };

  const mockPhraseOverlap: ArticleWithPhraseOverlap = {
    article_id: 'article-123',
    source_id: 'source-123',
    title_normalized: 'test article',
    key_phrases: ['test', 'article'],
    overlap_count: 2,
    first_seen_at: '2024-01-15T10:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string; code?: string } | null };
    update?: { error: { message: string } | null };
    rpc?: { data: unknown; error: { message: string } | null };
    count?: { count: number | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockArticle, error: null };
    const listResult = overrides?.list ?? { data: [mockArticle], error: null };
    const insertResult = overrides?.insert ?? { data: mockArticle, error: null };
    const updateResult = overrides?.update ?? { error: null };
    const rpcResult = overrides?.rpc ?? { data: [mockFingerprint], error: null };
    const countResult = overrides?.count ?? { count: 10, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        gt: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockImplementation((cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact' && opts?.head === true) {
          return {
            eq: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(countResult),
            }),
          };
        }
        return chainableResult;
      });
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gt as jest.Mock).mockReturnValue(chainableResult);
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

      const updateChain: Record<string, unknown> = {
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
      };
      (updateChain.eq as jest.Mock).mockReturnValue(updateChain);
      (chainableResult.update as jest.Mock).mockReturnValue(updateChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
      rpc: jest.fn().mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(rpcResult),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<ArticleRepository>(ArticleRepository);
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
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('article-123')).rejects.toThrow(
        'Failed to fetch article: Database error',
      );
    });
  });

  describe('findByContentHash', () => {
    it('should return article when found', async () => {
      const result = await repository.findByContentHash('test-org', 'abc123hash');

      expect(result).toEqual(mockArticle);
    });

    it('should return null when not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByContentHash('test-org', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByContentHash('test-org', 'hash')).rejects.toThrow(
        'Failed to fetch article by content hash: Database error',
      );
    });
  });

  describe('checkContentHashExists', () => {
    it('should return true when hash exists', async () => {
      const mockClient = createMockClient({
        rpc: { data: true, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.checkContentHashExists('test-org', 'abc123hash');

      expect(result).toBe(true);
    });

    it('should return false when hash does not exist', async () => {
      const mockClient = createMockClient({
        rpc: { data: false, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.checkContentHashExists('test-org', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should handle null data as false', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.checkContentHashExists('test-org', 'hash');

      expect(result).toBe(false);
    });

    it('should accept excludeSourceId parameter', async () => {
      const mockClient = createMockClient({
        rpc: { data: false, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.checkContentHashExists('test-org', 'hash', 'source-123');

      expect(result).toBe(false);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.checkContentHashExists('test-org', 'hash')).rejects.toThrow(
        'Failed to check content hash: RPC failed',
      );
    });
  });

  describe('findRecentFingerprints', () => {
    it('should return recent fingerprints', async () => {
      const result = await repository.findRecentFingerprints('test-org');

      expect(result).toEqual([mockFingerprint]);
    });

    it('should accept custom hoursBack and limit', async () => {
      const result = await repository.findRecentFingerprints('test-org', 48, 50);

      expect(result).toEqual([mockFingerprint]);
    });

    it('should return empty array when no fingerprints found', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findRecentFingerprints('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findRecentFingerprints('test-org')).rejects.toThrow(
        'Failed to fetch recent fingerprints: RPC failed',
      );
    });
  });

  describe('findByPhraseOverlap', () => {
    it('should return articles with phrase overlap', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockPhraseOverlap], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByPhraseOverlap('test-org', ['test', 'article']);

      expect(result).toEqual([mockPhraseOverlap]);
    });

    it('should accept custom hoursBack and limit', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockPhraseOverlap], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByPhraseOverlap('test-org', ['test'], 48, 25);

      expect(result).toEqual([mockPhraseOverlap]);
    });

    it('should return empty array when no overlap found', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByPhraseOverlap('test-org', ['unique', 'phrases']);

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByPhraseOverlap('test-org', ['test'])).rejects.toThrow(
        'Failed to find articles by phrase overlap: RPC failed',
      );
    });
  });

  describe('findNewForSource', () => {
    it('should return new articles for source', async () => {
      const result = await repository.findNewForSource('source-123', new Date('2024-01-15T00:00:00Z'));

      expect(result).toEqual([mockArticle]);
    });

    it('should accept custom limit', async () => {
      const result = await repository.findNewForSource('source-123', new Date(), 50);

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no new articles', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findNewForSource('source-123', new Date());

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findNewForSource('source-123', new Date())).rejects.toThrow(
        'Failed to fetch new articles for source: Query failed',
      );
    });
  });

  describe('findNewForSources', () => {
    it('should return new articles for multiple sources', async () => {
      const result = await repository.findNewForSources(['source-123', 'source-456'], new Date());

      expect(result).toEqual([mockArticle]);
    });

    it('should return empty array when no source ids provided', async () => {
      const result = await repository.findNewForSources([], new Date());

      expect(result).toEqual([]);
    });

    it('should accept custom limit', async () => {
      const result = await repository.findNewForSources(['source-123'], new Date(), 50);

      expect(result).toEqual([mockArticle]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findNewForSources(['source-123'], new Date())).rejects.toThrow(
        'Failed to fetch new articles for sources: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create article successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        source_id: 'source-123',
        url: 'https://example.com/new-article',
        title: 'New Article',
        content_hash: 'newhash123',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockArticle);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          source_id: 'source-123',
          url: 'https://example.com/article',
          content_hash: 'hash123',
        }),
      ).rejects.toThrow('Create succeeded but no article returned');
    });

    it('should return existing article on duplicate constraint violation', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Duplicate', code: '23505' } },
        single: { data: mockArticle, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.create({
        organization_slug: 'test-org',
        source_id: 'source-123',
        url: 'https://example.com/article',
        content_hash: 'abc123hash',
      });

      expect(result).toEqual(mockArticle);
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          source_id: 'source-123',
          url: 'https://example.com/article',
          content_hash: 'hash123',
        }),
      ).rejects.toThrow('Failed to create article: Insert failed');
    });
  });

  describe('createIfNotExists', () => {
    it('should return existing article if exists', async () => {
      const result = await repository.createIfNotExists({
        organization_slug: 'test-org',
        source_id: 'source-123',
        url: 'https://example.com/article',
        content_hash: 'abc123hash',
      });

      expect(result.article).toEqual(mockArticle);
      expect(result.isNew).toBe(false);
    });

    it('should create new article if not exists', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
        insert: { data: mockArticle, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.createIfNotExists({
        organization_slug: 'test-org',
        source_id: 'source-123',
        url: 'https://example.com/new-article',
        content_hash: 'newhash123',
      });

      expect(result.article).toEqual(mockArticle);
      expect(result.isNew).toBe(true);
    });
  });

  describe('updateFingerprint', () => {
    it('should update fingerprint successfully', async () => {
      await expect(
        repository.updateFingerprint('article-123', 'normalized title', ['key', 'phrases'], 'fingerprint'),
      ).resolves.toBeUndefined();
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.updateFingerprint('article-123', 'normalized', ['key'], 'fingerprint'),
      ).rejects.toThrow('Failed to update article fingerprint: Update failed');
    });
  });

  describe('countForSource', () => {
    it('should return count of articles for source', async () => {
      const result = await repository.countForSource('source-123');

      expect(result).toBe(10);
    });

    it('should return 0 when count is null', async () => {
      const mockClient = createMockClient({
        count: { count: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.countForSource('source-123');

      expect(result).toBe(0);
    });

    it('should throw error on count failure', async () => {
      const mockClient = createMockClient({
        count: { count: null, error: { message: 'Count failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.countForSource('source-123')).rejects.toThrow(
        'Failed to count articles: Count failed',
      );
    });
  });
});
