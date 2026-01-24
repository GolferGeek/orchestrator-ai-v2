import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerService } from '../crawler.service';
import { CrawlerSourceRepository } from '../../repositories/source.repository';
import { ArticleRepository } from '../../repositories/article.repository';
import { SourceCrawlRepository } from '../../repositories/source-crawl.repository';
import { DeduplicationService, DEFAULT_DEDUP_CONFIG } from '../deduplication.service';

describe('CrawlerService', () => {
  let service: CrawlerService;
  let mockSourceRepository: Partial<CrawlerSourceRepository>;
  let mockArticleRepository: Partial<ArticleRepository>;
  let mockSourceCrawlRepository: Partial<SourceCrawlRepository>;
  let mockDeduplicationService: Partial<DeduplicationService>;

  const mockSource = {
    id: 'source-123',
    organization_slug: 'test-org',
    name: 'Test Source',
    source_type: 'rss' as const,
    url: 'https://example.com/feed',
    crawl_frequency_minutes: 60,
    is_active: true,
    is_test: false,
    consecutive_errors: 0,
    last_crawl_at: null,
    last_error_at: null,
    crawl_config: {},
    auth_config: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockArticle = {
    id: 'article-123',
    organization_slug: 'test-org',
    source_id: 'source-123',
    url: 'https://example.com/article/1',
    title: 'Test Article',
    content: 'Article content here',
    summary: 'Article summary',
    author: 'Test Author',
    published_at: '2024-01-15T00:00:00Z',
    content_hash: 'abc123hash',
    title_normalized: 'test article',
    key_phrases: ['test article', 'article content'],
    fingerprint_hash: 'fingerprint123',
    raw_data: null,
    is_test: false,
    first_seen_at: '2024-01-15T12:00:00Z',
    metadata: {},
  };

  beforeEach(async () => {
    mockSourceRepository = {
      findOrCreate: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findDueForCrawl: jest.fn(),
      markCrawlSuccess: jest.fn(),
      markCrawlError: jest.fn(),
    };

    mockArticleRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      findNewForSource: jest.fn(),
      findNewForSources: jest.fn(),
    };

    mockSourceCrawlRepository = {
      create: jest.fn(),
      markSuccess: jest.fn(),
      markError: jest.fn(),
    };

    mockDeduplicationService = {
      generateContentHash: jest.fn(),
      normalizeTitle: jest.fn(),
      extractKeyPhrases: jest.fn(),
      generateFingerprintHash: jest.fn(),
      checkDuplicate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        { provide: CrawlerSourceRepository, useValue: mockSourceRepository },
        { provide: ArticleRepository, useValue: mockArticleRepository },
        { provide: SourceCrawlRepository, useValue: mockSourceCrawlRepository },
        { provide: DeduplicationService, useValue: mockDeduplicationService },
      ],
    }).compile();

    service = module.get<CrawlerService>(CrawlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // SOURCE MANAGEMENT
  // =============================================================================

  describe('findOrCreateSource', () => {
    it('should find or create a source', async () => {
      (mockSourceRepository.findOrCreate as jest.Mock).mockResolvedValue(mockSource);

      const sourceData = {
        organization_slug: 'test-org',
        name: 'Test Source',
        source_type: 'rss' as const,
        url: 'https://example.com/feed',
      };

      const result = await service.findOrCreateSource(sourceData);

      expect(result).toEqual(mockSource);
      expect(mockSourceRepository.findOrCreate).toHaveBeenCalledWith(sourceData);
    });
  });

  describe('findSourceById', () => {
    it('should find source by ID', async () => {
      (mockSourceRepository.findById as jest.Mock).mockResolvedValue(mockSource);

      const result = await service.findSourceById('source-123');

      expect(result).toEqual(mockSource);
      expect(mockSourceRepository.findById).toHaveBeenCalledWith('source-123');
    });

    it('should return null when source not found', async () => {
      (mockSourceRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.findSourceById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAllSources', () => {
    it('should find all sources for an organization', async () => {
      (mockSourceRepository.findAll as jest.Mock).mockResolvedValue([mockSource]);

      const result = await service.findAllSources('test-org');

      expect(result).toEqual([mockSource]);
      expect(mockSourceRepository.findAll).toHaveBeenCalledWith('test-org');
    });
  });

  describe('findSourcesDueForCrawl', () => {
    it('should find sources due for crawling', async () => {
      const dueSources = [
        {
          ...mockSource,
          minutes_overdue: 30,
        },
      ];
      (mockSourceRepository.findDueForCrawl as jest.Mock).mockResolvedValue(dueSources);

      const result = await service.findSourcesDueForCrawl();

      expect(result).toEqual(dueSources);
      expect(mockSourceRepository.findDueForCrawl).toHaveBeenCalledWith(undefined);
    });

    it('should filter by frequency when provided', async () => {
      (mockSourceRepository.findDueForCrawl as jest.Mock).mockResolvedValue([]);

      await service.findSourcesDueForCrawl(60);

      expect(mockSourceRepository.findDueForCrawl).toHaveBeenCalledWith(60);
    });
  });

  describe('markSourceCrawlSuccess', () => {
    it('should mark source crawl as successful', async () => {
      (mockSourceRepository.markCrawlSuccess as jest.Mock).mockResolvedValue(undefined);

      await service.markSourceCrawlSuccess('source-123');

      expect(mockSourceRepository.markCrawlSuccess).toHaveBeenCalledWith('source-123');
    });
  });

  describe('markSourceCrawlError', () => {
    it('should mark source crawl as failed', async () => {
      (mockSourceRepository.markCrawlError as jest.Mock).mockResolvedValue(undefined);

      await service.markSourceCrawlError('source-123', 'Connection timeout');

      expect(mockSourceRepository.markCrawlError).toHaveBeenCalledWith(
        'source-123',
        'Connection timeout',
      );
    });
  });

  // =============================================================================
  // ARTICLE MANAGEMENT
  // =============================================================================

  describe('storeArticle', () => {
    const articleData = {
      organization_slug: 'test-org',
      source_id: 'source-123',
      url: 'https://example.com/article/1',
      title: 'Test Article',
      content: 'Article content here',
      content_hash: 'abc123hash',
    };

    it('should store new article when not duplicate', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: false,
      });
      (mockDeduplicationService.normalizeTitle as jest.Mock).mockReturnValue('test article');
      (mockDeduplicationService.extractKeyPhrases as jest.Mock).mockReturnValue(['test article']);
      (mockDeduplicationService.generateFingerprintHash as jest.Mock).mockReturnValue('fingerprint');
      (mockArticleRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.storeArticle(articleData);

      expect(result.article).toEqual(mockArticle);
      expect(result.isNew).toBe(true);
      expect(result.duplicateType).toBeUndefined();
      expect(mockArticleRepository.create).toHaveBeenCalled();
    });

    it('should return existing article when exact duplicate', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: true,
        duplicate_type: 'exact',
        existing_article_id: 'existing-article',
      });
      (mockArticleRepository.findById as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.storeArticle(articleData);

      expect(result.article).toEqual(mockArticle);
      expect(result.isNew).toBe(false);
      expect(result.duplicateType).toBe('exact');
      expect(mockArticleRepository.create).not.toHaveBeenCalled();
    });

    it('should return existing article when cross-source duplicate', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: true,
        duplicate_type: 'cross_source',
        existing_article_id: 'existing-article',
      });
      (mockArticleRepository.findById as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.storeArticle(articleData);

      expect(result.isNew).toBe(false);
      expect(result.duplicateType).toBe('cross_source');
    });

    it('should return existing article when fuzzy title duplicate', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: true,
        duplicate_type: 'fuzzy_title',
        existing_article_id: 'existing-article',
      });
      (mockArticleRepository.findById as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.storeArticle(articleData);

      expect(result.isNew).toBe(false);
      expect(result.duplicateType).toBe('fuzzy_title');
    });

    it('should use custom dedup config when provided', async () => {
      const customConfig = { ...DEFAULT_DEDUP_CONFIG, fuzzy_dedup_enabled: false };
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: false,
      });
      (mockDeduplicationService.normalizeTitle as jest.Mock).mockReturnValue('test');
      (mockDeduplicationService.extractKeyPhrases as jest.Mock).mockReturnValue([]);
      (mockArticleRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      await service.storeArticle(articleData, customConfig);

      expect(mockDeduplicationService.checkDuplicate).toHaveBeenCalledWith(
        articleData.organization_slug,
        articleData.source_id,
        articleData.content_hash,
        articleData.title,
        articleData.content,
        customConfig,
      );
    });
  });

  describe('findNewArticlesForSource', () => {
    it('should find new articles since given timestamp', async () => {
      (mockArticleRepository.findNewForSource as jest.Mock).mockResolvedValue([mockArticle]);
      const since = new Date('2024-01-01');

      const result = await service.findNewArticlesForSource('source-123', since, 50);

      expect(result).toEqual([mockArticle]);
      expect(mockArticleRepository.findNewForSource).toHaveBeenCalledWith(
        'source-123',
        since,
        50,
      );
    });

    it('should use default limit of 100', async () => {
      (mockArticleRepository.findNewForSource as jest.Mock).mockResolvedValue([]);
      const since = new Date();

      await service.findNewArticlesForSource('source-123', since);

      expect(mockArticleRepository.findNewForSource).toHaveBeenCalledWith(
        'source-123',
        since,
        100,
      );
    });
  });

  describe('findNewArticlesForSources', () => {
    it('should find new articles for multiple sources', async () => {
      (mockArticleRepository.findNewForSources as jest.Mock).mockResolvedValue([mockArticle]);
      const sourceIds = ['source-1', 'source-2'];
      const since = new Date();

      const result = await service.findNewArticlesForSources(sourceIds, since);

      expect(result).toEqual([mockArticle]);
      expect(mockArticleRepository.findNewForSources).toHaveBeenCalledWith(
        sourceIds,
        since,
        100,
      );
    });
  });

  // =============================================================================
  // CRAWL MANAGEMENT
  // =============================================================================

  describe('startCrawl', () => {
    it('should create a new crawl record', async () => {
      const mockCrawl = {
        id: 'crawl-123',
        source_id: 'source-123',
        started_at: new Date().toISOString(),
        status: 'running',
      };
      (mockSourceCrawlRepository.create as jest.Mock).mockResolvedValue(mockCrawl);

      const result = await service.startCrawl('source-123');

      expect(result).toEqual(mockCrawl);
      expect(mockSourceCrawlRepository.create).toHaveBeenCalledWith({
        source_id: 'source-123',
      });
    });
  });

  describe('completeCrawlSuccess', () => {
    it('should mark crawl as successful with metrics', async () => {
      const mockCrawl = {
        id: 'crawl-123',
        status: 'success',
      };
      const metrics = {
        articles_found: 10,
        articles_new: 5,
        duplicates_exact: 2,
        duplicates_cross_source: 1,
        duplicates_fuzzy_title: 1,
        duplicates_phrase_overlap: 1,
        crawl_duration_ms: 5000,
      };
      (mockSourceCrawlRepository.markSuccess as jest.Mock).mockResolvedValue(mockCrawl);

      const result = await service.completeCrawlSuccess('crawl-123', metrics);

      expect(result).toEqual(mockCrawl);
      expect(mockSourceCrawlRepository.markSuccess).toHaveBeenCalledWith('crawl-123', metrics);
    });
  });

  describe('completeCrawlError', () => {
    it('should mark crawl as failed with error message', async () => {
      const mockCrawl = {
        id: 'crawl-123',
        status: 'error',
        error_message: 'Connection failed',
      };
      (mockSourceCrawlRepository.markError as jest.Mock).mockResolvedValue(mockCrawl);

      const result = await service.completeCrawlError('crawl-123', 'Connection failed', 1000);

      expect(result).toEqual(mockCrawl);
      expect(mockSourceCrawlRepository.markError).toHaveBeenCalledWith(
        'crawl-123',
        'Connection failed',
        1000,
      );
    });
  });

  // =============================================================================
  // BATCH PROCESSING
  // =============================================================================

  describe('processCrawledItems', () => {
    const items = [
      {
        url: 'https://example.com/1',
        title: 'Article 1',
        content: 'Content 1',
      },
      {
        url: 'https://example.com/2',
        title: 'Article 2',
        content: 'Content 2',
      },
      {
        url: 'https://example.com/3',
        title: 'Article 3',
        content: 'Content 3',
      },
    ];

    beforeEach(() => {
      (mockDeduplicationService.generateContentHash as jest.Mock).mockImplementation(
        (content) => `hash-${content}`,
      );
    });

    it('should process all items and return results', async () => {
      // First item: new
      (mockDeduplicationService.checkDuplicate as jest.Mock)
        .mockResolvedValueOnce({ is_duplicate: false })
        .mockResolvedValueOnce({ is_duplicate: true, duplicate_type: 'exact' })
        .mockResolvedValueOnce({ is_duplicate: true, duplicate_type: 'cross_source' });

      (mockDeduplicationService.normalizeTitle as jest.Mock).mockReturnValue('normalized');
      (mockDeduplicationService.extractKeyPhrases as jest.Mock).mockReturnValue([]);
      (mockArticleRepository.create as jest.Mock).mockResolvedValue(mockArticle);
      (mockArticleRepository.findById as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.processCrawledItems('source-123', 'test-org', items);

      expect(result.source_id).toBe('source-123');
      expect(result.articles_found).toBe(3);
      expect(result.articles_new).toBe(1);
      expect(result.duplicates.exact).toBe(1);
      expect(result.duplicates.cross_source).toBe(1);
      expect(result.new_articles).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle errors for individual items', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock)
        .mockResolvedValueOnce({ is_duplicate: false })
        .mockRejectedValueOnce(new Error('Processing failed'));

      (mockDeduplicationService.normalizeTitle as jest.Mock).mockReturnValue('normalized');
      (mockDeduplicationService.extractKeyPhrases as jest.Mock).mockReturnValue([]);
      (mockArticleRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      const result = await service.processCrawledItems('source-123', 'test-org', items.slice(0, 2));

      expect(result.articles_new).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!).toContain('Processing failed');
    });

    it('should generate content hash for each item', async () => {
      (mockDeduplicationService.checkDuplicate as jest.Mock).mockResolvedValue({
        is_duplicate: false,
      });
      (mockDeduplicationService.normalizeTitle as jest.Mock).mockReturnValue('normalized');
      (mockDeduplicationService.extractKeyPhrases as jest.Mock).mockReturnValue([]);
      (mockArticleRepository.create as jest.Mock).mockResolvedValue(mockArticle);

      await service.processCrawledItems('source-123', 'test-org', [items[0]!]);

      expect(mockDeduplicationService.generateContentHash).toHaveBeenCalledWith(
        'Article 1|Content 1|https://example.com/1',
      );
    });
  });
});
