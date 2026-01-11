import { Test, TestingModule } from '@nestjs/testing';
import { SourceCrawlerRunner } from '../source-crawler.runner';
import { SourceRepository } from '../../repositories/source.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { SourceCrawlerService } from '../../services/source-crawler.service';
import { Source, CrawlFrequency } from '../../interfaces/source.interface';

describe('SourceCrawlerRunner', () => {
  let runner: SourceCrawlerRunner;
  let sourceRepository: jest.Mocked<SourceRepository>;
  let _targetRepository: jest.Mocked<TargetRepository>;
  let sourceCrawlerService: jest.Mocked<SourceCrawlerService>;

  const mockSource: Source = {
    id: 'source-1',
    name: 'Test Source',
    description: null,
    url: 'https://example.com',
    source_type: 'web',
    scope_level: 'target',
    target_id: 'target-1',
    universe_id: null,
    domain: null,
    crawl_frequency_minutes: 15,
    crawl_config: {},
    auth_config: { type: 'none' },
    is_active: true,
    is_test: false,
    last_crawl_at: null,
    last_crawl_status: null,
    last_error: null,
    consecutive_errors: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceCrawlerRunner,
        {
          provide: SourceRepository,
          useValue: {
            findDueForCrawl: jest.fn(),
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findActiveByUniverse: jest.fn(),
          },
        },
        {
          provide: SourceCrawlerService,
          useValue: {
            crawlSource: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<SourceCrawlerRunner>(SourceCrawlerRunner);
    sourceRepository = module.get(SourceRepository);
    _targetRepository = module.get(TargetRepository);
    sourceCrawlerService = module.get(SourceCrawlerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('crawlByFrequency', () => {
    it('should return early if no sources are due for crawl', async () => {
      sourceRepository.findDueForCrawl.mockResolvedValue([]);

      const result = await runner.crawlByFrequency(15 as CrawlFrequency);

      expect(result).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
        signalsCreated: 0,
      });
      expect(sourceCrawlerService.crawlSource).not.toHaveBeenCalled();
    });

    it('should crawl target-scoped sources successfully', async () => {
      const targetSource: Source = {
        ...mockSource,
        scope_level: 'target',
        target_id: 'target-1',
      };
      sourceRepository.findDueForCrawl.mockResolvedValue([targetSource]);
      sourceCrawlerService.crawlSource.mockResolvedValue({
        crawl: {} as never,
        result: {
          success: true,
          source_id: 'source-1',
          items: [],
          duration_ms: 100,
        },
        signalsCreated: 2,
        dedupMetrics: {
          duplicates_exact: 0,
          duplicates_cross_source: 0,
          duplicates_fuzzy_title: 0,
          duplicates_phrase_overlap: 0,
        },
      });

      const result = await runner.crawlByFrequency(15 as CrawlFrequency);

      expect(result.total).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.signalsCreated).toBe(2);
    });

    it('should handle crawl failures gracefully', async () => {
      sourceRepository.findDueForCrawl.mockResolvedValue([mockSource]);
      sourceCrawlerService.crawlSource.mockResolvedValue({
        crawl: {} as never,
        result: {
          success: false,
          source_id: 'source-1',
          items: [],
          error: 'Network error',
          duration_ms: 100,
        },
        signalsCreated: 0,
        dedupMetrics: {
          duplicates_exact: 0,
          duplicates_cross_source: 0,
          duplicates_fuzzy_title: 0,
          duplicates_phrase_overlap: 0,
        },
      });

      const result = await runner.crawlByFrequency(15 as CrawlFrequency);

      expect(result.total).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should skip domain and runner scoped sources', async () => {
      const domainSource: Source = {
        ...mockSource,
        scope_level: 'domain',
        target_id: null,
      };
      sourceRepository.findDueForCrawl.mockResolvedValue([domainSource]);

      const result = await runner.crawlByFrequency(15 as CrawlFrequency);

      expect(result.total).toBe(1);
      expect(result.failed).toBe(1);
      expect(sourceCrawlerService.crawlSource).not.toHaveBeenCalled();
    });

    it('should prevent overlapping runs', async () => {
      sourceRepository.findDueForCrawl.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [mockSource];
      });
      sourceCrawlerService.crawlSource.mockResolvedValue({
        crawl: {} as never,
        result: {
          success: true,
          source_id: 'source-1',
          items: [],
          duration_ms: 100,
        },
        signalsCreated: 0,
        dedupMetrics: {
          duplicates_exact: 0,
          duplicates_cross_source: 0,
          duplicates_fuzzy_title: 0,
          duplicates_phrase_overlap: 0,
        },
      });

      // Start first run
      const firstRun = runner.crawlByFrequency(15 as CrawlFrequency);

      // Immediately try second run
      const secondRun = await runner.crawlByFrequency(15 as CrawlFrequency);

      // Second run should be skipped
      expect(secondRun).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
        signalsCreated: 0,
      });

      // Wait for first run to complete
      await firstRun;
    });
  });

  describe('crawlSingleSource', () => {
    it('should crawl a specific source by ID', async () => {
      sourceRepository.findByIdOrThrow.mockResolvedValue(mockSource);
      sourceCrawlerService.crawlSource.mockResolvedValue({
        crawl: {} as never,
        result: {
          success: true,
          source_id: 'source-1',
          items: [],
          duration_ms: 100,
        },
        signalsCreated: 3,
        dedupMetrics: {
          duplicates_exact: 0,
          duplicates_cross_source: 0,
          duplicates_fuzzy_title: 0,
          duplicates_phrase_overlap: 0,
        },
      });

      const result = await runner.crawlSingleSource('source-1');

      expect(result.success).toBe(true);
      expect(result.signalsCreated).toBe(3);
      expect(sourceRepository.findByIdOrThrow).toHaveBeenCalledWith('source-1');
    });

    it('should handle source not found', async () => {
      sourceRepository.findByIdOrThrow.mockRejectedValue(
        new Error('Source not found'),
      );

      const result = await runner.crawlSingleSource('invalid-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source not found');
    });
  });
});
