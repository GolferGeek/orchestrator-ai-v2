import { Test, TestingModule } from '@nestjs/testing';
import { CrawlerRunner } from '../crawler.runner';
import { CrawlerService } from '../../services/crawler.service';
import { CrawlerSourceRepository } from '../../repositories/source.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { Source, SourceDueForCrawl, CrawlFrequency } from '../../interfaces';

// Mock rss-parser
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({
      items: [
        {
          title: 'Test Article',
          link: 'https://example.com/article-1',
          content: 'Article content',
          contentSnippet: 'Article snippet',
          pubDate: '2024-01-15T10:00:00Z',
          creator: 'Test Author',
        },
      ],
    }),
  }));
});

// Mock global fetch
global.fetch = jest.fn();

describe('CrawlerRunner', () => {
  let runner: CrawlerRunner;
  let crawlerService: jest.Mocked<CrawlerService>;
  let crawlerSourceRepository: jest.Mocked<CrawlerSourceRepository>;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockSource: Source = {
    id: 'source-123',
    organization_slug: 'test-org',
    name: 'Test Source',
    description: 'Test description',
    source_type: 'rss',
    url: 'https://example.com/feed.xml',
    crawl_config: {},
    auth_config: null,
    crawl_frequency_minutes: 15,
    is_active: true,
    is_test: false,
    last_crawl_at: '2024-01-15T09:00:00Z',
    last_crawl_status: 'success',
    last_error: null,
    consecutive_errors: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSourceDue: SourceDueForCrawl = {
    source_id: 'source-123',
    organization_slug: 'test-org',
    name: 'Test Source',
    source_type: 'rss',
    url: 'https://example.com/feed.xml',
    crawl_config: {},
    auth_config: null,
    crawl_frequency_minutes: 15,
    last_crawl_at: '2024-01-15T09:00:00Z',
  };

  const mockCrawlResult = {
    articles_found: 10,
    articles_new: 5,
    new_articles: [],
    result: {
      success: true,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerRunner,
        {
          provide: CrawlerService,
          useValue: {
            crawlSource: jest.fn().mockResolvedValue(mockCrawlResult),
          },
        },
        {
          provide: CrawlerSourceRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockSource),
            findDueForCrawl: jest.fn().mockResolvedValue([mockSourceDue]),
            markCrawlSuccess: jest.fn().mockResolvedValue(undefined),
            markCrawlError: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    runner = module.get<CrawlerRunner>(CrawlerRunner);
    crawlerService = module.get(CrawlerService);
    crawlerSourceRepository = module.get(CrawlerSourceRepository);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DISABLE_SCHEDULED_CRAWLING;
  });

  describe('crawlByFrequency', () => {
    it('should crawl sources with specified frequency', async () => {
      const result = await runner.crawlByFrequency(15);

      expect(result.total).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.articlesNew).toBe(5);
      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(15);
    });

    it('should return early when no sources are due', async () => {
      crawlerSourceRepository.findDueForCrawl.mockResolvedValue([]);

      const result = await runner.crawlByFrequency(15);

      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.articlesNew).toBe(0);
    });

    it('should return early when already running', async () => {
      // Create a controlled promise to simulate a long-running task
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      crawlerSourceRepository.findDueForCrawl.mockImplementationOnce(async () => {
        await firstPromise;
        return [mockSourceDue];
      });

      // Start first run
      const firstRun = runner.crawlByFrequency(15);

      // Try to start second run while first is running
      const secondResult = await runner.crawlByFrequency(15);

      expect(secondResult.total).toBe(0);
      expect(secondResult.successful).toBe(0);

      // Complete first run
      resolveFirst!();
      await firstRun;
    });

    it('should handle multiple sources', async () => {
      const sources: SourceDueForCrawl[] = [
        mockSourceDue,
        { ...mockSourceDue, source_id: 'source-456', name: 'Source 2' },
        { ...mockSourceDue, source_id: 'source-789', name: 'Source 3' },
      ];
      crawlerSourceRepository.findDueForCrawl.mockResolvedValue(sources);

      const result = await runner.crawlByFrequency(15);

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.articlesNew).toBe(15); // 5 per source
    });

    it('should handle source crawl failures', async () => {
      crawlerSourceRepository.findById.mockResolvedValue(null);

      const result = await runner.crawlByFrequency(15);

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.successful).toBe(0);
    });

    it('should continue processing when one source fails', async () => {
      const sources: SourceDueForCrawl[] = [
        mockSourceDue,
        { ...mockSourceDue, source_id: 'source-456', name: 'Source 2' },
      ];
      crawlerSourceRepository.findDueForCrawl.mockResolvedValue(sources);

      crawlerSourceRepository.findById
        .mockResolvedValueOnce(null) // First source fails
        .mockResolvedValueOnce(mockSource); // Second source succeeds

      const result = await runner.crawlByFrequency(15);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should send observability events', async () => {
      await runner.crawlByFrequency(15);

      expect(observabilityEventsService.push).toHaveBeenCalledTimes(2);
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'source.crawl.started',
          status: 'started',
        }),
      );
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'source.crawl.completed',
          status: 'completed',
        }),
      );
    });

    it('should reset isRunning flag after error', async () => {
      crawlerSourceRepository.findDueForCrawl.mockRejectedValueOnce(new Error('Database error'));

      try {
        await runner.crawlByFrequency(15);
      } catch {
        // Ignore error
      }

      // Should be able to run again after error
      crawlerSourceRepository.findDueForCrawl.mockResolvedValue([]);
      const result = await runner.crawlByFrequency(15);
      expect(result).toBeDefined();
    });

    it('should process different frequency values', async () => {
      const frequencies: CrawlFrequency[] = [5, 10, 15, 30, 60];

      for (const frequency of frequencies) {
        crawlerSourceRepository.findDueForCrawl.mockResolvedValue([mockSourceDue]);
        const result = await runner.crawlByFrequency(frequency);
        expect(result.total).toBe(1);
        expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(frequency);
      }
    });
  });

  describe('crawlSingleSource', () => {
    it('should crawl a single source successfully', async () => {
      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
      expect(result.articlesNew).toBe(5);
      expect(crawlerSourceRepository.findById).toHaveBeenCalledWith('source-123');
    });

    it('should return failure when source not found', async () => {
      crawlerSourceRepository.findById.mockResolvedValue(null);

      const result = await runner.crawlSingleSource('nonexistent');

      expect(result.success).toBe(false);
      expect(result.articlesNew).toBe(0);
    });

    it('should handle crawl service failure', async () => {
      crawlerService.crawlSource.mockResolvedValue({
        articles_found: 0,
        articles_new: 0,
        new_articles: [],
        result: { success: false, error: 'Crawl failed' },
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(false);
      expect(crawlerSourceRepository.markCrawlError).toHaveBeenCalledWith(
        'source-123',
        'Crawl failed',
      );
    });

    it('should handle exceptions gracefully', async () => {
      crawlerSourceRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await runner.crawlSingleSource('source-123');

      // Internal crawlSource catches exceptions, so error is not propagated
      expect(result.success).toBe(false);
      expect(result.articlesNew).toBe(0);
    });

    it('should mark crawl success on successful crawl', async () => {
      await runner.crawlSingleSource('source-123');

      expect(crawlerSourceRepository.markCrawlSuccess).toHaveBeenCalledWith('source-123');
    });
  });

  describe('source type handling', () => {
    it('should handle RSS source type', async () => {
      const rssSource: Source = { ...mockSource, source_type: 'rss' };
      crawlerSourceRepository.findById.mockResolvedValue(rssSource);

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle web source type', async () => {
      const webSource: Source = { ...mockSource, source_type: 'web' };
      crawlerSourceRepository.findById.mockResolvedValue(webSource);

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle API source type with successful response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { url: 'https://example.com/api-item', title: 'API Item', content: 'API Content' },
          ],
        }),
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle API source type with failed response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(false);
      expect(crawlerSourceRepository.markCrawlError).toHaveBeenCalled();
    });

    it('should handle unsupported source type', async () => {
      const unsupportedSource = { ...mockSource, source_type: 'unknown' as Source['source_type'] };
      crawlerSourceRepository.findById.mockResolvedValue(unsupportedSource);

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(false);
    });
  });

  describe('cron jobs', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should run 5-min crawl when not disabled', async () => {
      await runner.crawl5MinSources();

      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(5);
    });

    it('should run 10-min crawl when not disabled', async () => {
      await runner.crawl10MinSources();

      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(10);
    });

    it('should run 15-min crawl when not disabled', async () => {
      await runner.crawl15MinSources();

      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(15);
    });

    it('should run 30-min crawl when not disabled', async () => {
      await runner.crawl30MinSources();

      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(30);
    });

    it('should run hourly crawl when not disabled', async () => {
      await runner.crawlHourlySources();

      expect(crawlerSourceRepository.findDueForCrawl).toHaveBeenCalledWith(60);
    });

    it('should not run when DISABLE_SCHEDULED_CRAWLING is true', async () => {
      process.env.DISABLE_SCHEDULED_CRAWLING = 'true';

      await runner.crawl5MinSources();
      await runner.crawl10MinSources();
      await runner.crawl15MinSources();
      await runner.crawl30MinSources();
      await runner.crawlHourlySources();

      expect(crawlerSourceRepository.findDueForCrawl).not.toHaveBeenCalled();
    });
  });

  describe('concurrent frequency runs', () => {
    it('should allow different frequencies to run concurrently', async () => {
      // Create controlled promises
      let resolve5: () => void;
      let resolve15: () => void;
      const promise5 = new Promise<SourceDueForCrawl[]>((resolve) => {
        resolve5 = () => resolve([mockSourceDue]);
      });
      const promise15 = new Promise<SourceDueForCrawl[]>((resolve) => {
        resolve15 = () => resolve([mockSourceDue]);
      });

      crawlerSourceRepository.findDueForCrawl
        .mockReturnValueOnce(promise5)
        .mockReturnValueOnce(promise15);

      // Start both
      const run5 = runner.crawlByFrequency(5);
      const run15 = runner.crawlByFrequency(15);

      // Both should be running (not blocked)
      // Resolve them
      resolve5!();
      resolve15!();

      const [result5, result15] = await Promise.all([run5, run15]);

      expect(result5.total).toBe(1);
      expect(result15.total).toBe(1);
    });
  });

  describe('execution context', () => {
    it('should create proper execution context for observability', async () => {
      await runner.crawlByFrequency(15);

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            orgSlug: 'system',
            agentSlug: 'crawler-runner',
            agentType: 'runner',
          }),
          source_app: 'crawler',
        }),
      );
    });

    it('should include completion payload with statistics', async () => {
      await runner.crawlByFrequency(15);

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          payload: expect.objectContaining({
            frequency: 15,
            total: 1,
            successful: 1,
            failed: 0,
            articlesNew: 5,
          }),
        }),
      );
    });
  });

  describe('API response parsing', () => {
    it('should handle array response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [
          { url: 'https://example.com/1', title: 'Item 1' },
          { url: 'https://example.com/2', title: 'Item 2' },
        ],
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle articles key in response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          articles: [{ url: 'https://example.com/1', title: 'Article 1' }],
        }),
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle results key in response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ url: 'https://example.com/1', headline: 'Result 1' }],
        }),
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });

    it('should handle single object response', async () => {
      const apiSource: Source = { ...mockSource, source_type: 'api' };
      crawlerSourceRepository.findById.mockResolvedValue(apiSource);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          url: 'https://example.com/single',
          title: 'Single Item',
          body: 'Content here',
        }),
      });

      const result = await runner.crawlSingleSource('source-123');

      expect(result.success).toBe(true);
    });
  });
});
