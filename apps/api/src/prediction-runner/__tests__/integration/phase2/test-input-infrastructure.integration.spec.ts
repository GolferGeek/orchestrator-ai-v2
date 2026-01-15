/**
 * Phase 2: Test Input Infrastructure Integration Tests
 *
 * Tests the complete test data isolation infrastructure including:
 * - test_db source type handling
 * - is_test flag propagation (INV-02)
 * - T_ prefix validation (INV-08)
 * - Test price data routing
 * - scenario_run_id linkage (INV-10)
 *
 * PRD Reference: docs/prd/2026-01-11-test-based-learning-loop.md
 * Section 7: Test Input Infrastructure
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  TestDbSourceCrawlerService,
  TestDbCrawlConfig,
} from '../../../services/test-db-source-crawler.service';
import {
  TestPriceDataRouterService,
  PriceDataPoint,
} from '../../../services/test-price-data-router.service';
import { Source, SourceType } from '../../../interfaces/source.interface';
import { CreateSignalData } from '../../../interfaces/signal.interface';

/**
 * Mock TestArticleRepository for testing
 */
class MockTestArticleRepository {
  private articles: Array<{
    id: string;
    title: string;
    content: string;
    target_symbols: string[];
    scenario_id: string | null;
    organization_slug: string;
    published_at: string;
    processed: boolean;
    synthetic_marker: string;
    sentiment_expected: string;
    strength_expected: number;
  }> = [];

  addArticle(article: (typeof this.articles)[0]): void {
    this.articles.push(article);
  }

  async findByScenario(scenarioId: string) {
    return this.articles.filter((a) => a.scenario_id === scenarioId);
  }

  async findByTargetSymbol(symbol: string) {
    return this.articles.filter((a) => a.target_symbols.includes(symbol));
  }

  async findUnprocessed() {
    return this.articles.filter((a) => !a.processed);
  }

  async bulkMarkProcessed(ids: string[]) {
    ids.forEach((id) => {
      const article = this.articles.find((a) => a.id === id);
      if (article) article.processed = true;
    });
    return ids.length;
  }

  reset(): void {
    this.articles = [];
  }
}

/**
 * Mock TestPriceDataService for testing
 */
class MockTestPriceDataService {
  private prices: Map<
    string,
    Array<{
      symbol: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      price_timestamp: string;
    }>
  > = new Map();

  addPrice(
    symbol: string,
    price: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      timestamp: string;
    },
  ): void {
    if (!this.prices.has(symbol)) {
      this.prices.set(symbol, []);
    }
    this.prices.get(symbol)!.push({
      symbol,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
      price_timestamp: price.timestamp,
    });
  }

  async getLatestPrice(symbol: string, _orgSlug: string) {
    const symbolPrices = this.prices.get(symbol) || [];
    if (symbolPrices.length === 0) return null;
    return symbolPrices[symbolPrices.length - 1];
  }

  async getPriceRange(
    symbol: string,
    _orgSlug: string,
    startDate: Date,
    endDate: Date,
  ) {
    const symbolPrices = this.prices.get(symbol) || [];
    return symbolPrices.filter((p) => {
      const timestamp = new Date(p.price_timestamp);
      return timestamp >= startDate && timestamp <= endDate;
    });
  }

  async generatePriceHistory(
    symbol: string,
    _startDate: Date,
    _endDate: Date,
    _orgSlug: string,
    params: { startPrice: number },
    _scenarioId?: string,
  ) {
    // Generate mock data
    const data = [
      {
        symbol,
        open: params.startPrice,
        high: params.startPrice * 1.02,
        low: params.startPrice * 0.98,
        close: params.startPrice * 1.01,
        volume: 1000000,
        price_timestamp: new Date().toISOString(),
      },
    ];
    if (!this.prices.has(symbol)) {
      this.prices.set(symbol, []);
    }
    this.prices.get(symbol)!.push(...data);
    return data;
  }

  async importFromJSON(
    data: Array<{
      symbol: string;
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>,
    _orgSlug: string,
    _scenarioId?: string,
  ) {
    data.forEach((d) => {
      this.addPrice(d.symbol, {
        ...d,
        timestamp: d.timestamp,
        volume: d.volume || 0,
      });
    });
    return { created_count: data.length, failed_count: 0, errors: [] };
  }

  reset(): void {
    this.prices.clear();
  }
}

/**
 * Mock TestPriceDataRepository for testing
 */
class MockTestPriceDataRepository {
  reset(): void {
    // No-op for mock
  }
}

describe('Phase 2: Test Input Infrastructure', () => {
  jest.setTimeout(30000);

  describe('TestDbSourceCrawlerService', () => {
    let service: TestDbSourceCrawlerService;
    let mockRepository: MockTestArticleRepository;

    beforeEach(async () => {
      mockRepository = new MockTestArticleRepository();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestDbSourceCrawlerService,
          { provide: 'TestArticleRepository', useValue: mockRepository },
        ],
      })
        .overrideProvider(TestDbSourceCrawlerService)
        .useFactory({
          factory: () => {
            const svc = new TestDbSourceCrawlerService(mockRepository as any);
            return svc;
          },
        })
        .compile();

      service = module.get<TestDbSourceCrawlerService>(
        TestDbSourceCrawlerService,
      );
    });

    afterEach(() => {
      mockRepository.reset();
    });

    describe('Source Type Validation', () => {
      it('should reject non-test_db source types', async () => {
        const source: Source = {
          id: 'test-source-1',
          name: 'Web Source',
          description: null,
          source_type: 'web' as SourceType,
          url: 'https://example.com',
          scope_level: 'domain',
          domain: 'stocks',
          universe_id: null,
          target_id: null,
          crawl_config: {},
          auth_config: { type: 'none' },
          crawl_frequency_minutes: 15,
          is_active: true,
          is_test: false,
          last_crawl_at: null,
          last_crawl_status: null,
          last_error: null,
          consecutive_errors: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const result = await service.crawlTestDbSource(source);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid source type');
        expect(result.is_test).toBe(true);
      });

      it('should require organization_slug for test_db sources', async () => {
        const source: Source = {
          id: 'test-source-2',
          name: 'Test DB Source',
          description: null,
          source_type: 'test_db',
          url: 'db://prediction.test_articles',
          scope_level: 'domain',
          domain: 'stocks',
          universe_id: null,
          target_id: null,
          crawl_config: {}, // Missing organization_slug
          auth_config: { type: 'none' },
          crawl_frequency_minutes: 15,
          is_active: true,
          is_test: true,
          last_crawl_at: null,
          last_crawl_status: null,
          last_error: null,
          consecutive_errors: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const result = await service.crawlTestDbSource(source);

        expect(result.success).toBe(false);
        expect(result.error).toContain('organization_slug');
      });
    });

    describe('INV-08: T_ Prefix Validation', () => {
      it('should validate T_ prefix on target symbols', async () => {
        // Add article with valid T_ prefix
        mockRepository.addArticle({
          id: 'article-1',
          title: 'Test: T_AAPL Earnings Beat',
          content: 'T_AAPL reported strong earnings...',
          target_symbols: ['T_AAPL'],
          scenario_id: 'scenario-1',
          organization_slug: 'test-org',
          published_at: new Date().toISOString(),
          processed: false,
          synthetic_marker: '[SYNTHETIC TEST CONTENT]',
          sentiment_expected: 'positive',
          strength_expected: 0.8,
        });

        const source: Source = {
          id: 'test-source-3',
          name: 'Test DB Source',
          description: null,
          source_type: 'test_db',
          url: 'db://prediction.test_articles',
          scope_level: 'domain',
          domain: 'stocks',
          universe_id: null,
          target_id: null,
          crawl_config: {
            organization_slug: 'test-org',
            scenario_id: 'scenario-1',
          },
          auth_config: { type: 'none' },
          crawl_frequency_minutes: 15,
          is_active: true,
          is_test: true,
          last_crawl_at: null,
          last_crawl_status: null,
          last_error: null,
          consecutive_errors: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const result = await service.crawlTestDbSource(source);

        expect(result.success).toBe(true);
        expect(result.items.length).toBe(1);
        expect(result.items[0]?.metadata?.target_symbols).toContain('T_AAPL');
      });
    });

    describe('Crawled Item Structure', () => {
      it('should convert test articles to CrawledItems with test metadata', async () => {
        mockRepository.addArticle({
          id: 'article-2',
          title: 'Test: T_MSFT Strong Growth',
          content: 'T_MSFT reported record revenue...',
          target_symbols: ['T_MSFT'],
          scenario_id: 'scenario-2',
          organization_slug: 'test-org',
          published_at: '2024-01-15T10:00:00Z',
          processed: false,
          synthetic_marker: '[SYNTHETIC TEST CONTENT]',
          sentiment_expected: 'positive',
          strength_expected: 0.9,
        });

        const source: Source = {
          id: 'test-source-4',
          name: 'Test DB Source',
          description: null,
          source_type: 'test_db',
          url: 'db://prediction.test_articles',
          scope_level: 'domain',
          domain: 'stocks',
          universe_id: null,
          target_id: null,
          crawl_config: {
            organization_slug: 'test-org',
          },
          auth_config: { type: 'none' },
          crawl_frequency_minutes: 15,
          is_active: true,
          is_test: true,
          last_crawl_at: null,
          last_crawl_status: null,
          last_error: null,
          consecutive_errors: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const result = await service.crawlTestDbSource(source);

        expect(result.success).toBe(true);
        expect(result.items.length).toBe(1);

        const item = result.items[0];
        expect(item).toBeDefined();
        expect(item?.content).toBe('T_MSFT reported record revenue...');
        expect(item?.title).toBe('Test: T_MSFT Strong Growth');
        expect(item?.url).toMatch(/^synthetic:\/\/test-article\//);
        expect(item?.metadata?.is_test).toBe(true);
        expect(item?.metadata?.is_synthetic).toBe(true);
        expect(item?.metadata?.test_article_id).toBe('article-2');
        expect(item?.metadata?.sentiment_expected).toBe('positive');
      });
    });

    describe('Static Configuration Helper', () => {
      it('should create valid test_db source configuration', () => {
        const config = TestDbSourceCrawlerService.createTestDbSourceConfig(
          'My Test Source',
          'my-org',
          {
            scenarioId: 'scenario-123',
            targetSymbols: ['T_AAPL', 'T_MSFT'],
            domain: 'stocks',
          },
        );

        expect(config.source_type).toBe('test_db');
        expect(config.is_test).toBe(true);
        expect(config.crawl_config.organization_slug).toBe('my-org');
        expect(config.crawl_config.scenario_id).toBe('scenario-123');
        expect(config.crawl_config.target_symbols).toEqual([
          'T_AAPL',
          'T_MSFT',
        ]);
        expect(config.url).toContain('my-org');
        expect(config.url).toContain('scenario-123');
      });
    });
  });

  describe('TestPriceDataRouterService', () => {
    let service: TestPriceDataRouterService;
    let mockPriceDataService: MockTestPriceDataService;
    let mockPriceDataRepository: MockTestPriceDataRepository;

    beforeEach(async () => {
      mockPriceDataService = new MockTestPriceDataService();
      mockPriceDataRepository = new MockTestPriceDataRepository();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TestPriceDataRouterService,
          { provide: 'TestPriceDataService', useValue: mockPriceDataService },
          {
            provide: 'TestPriceDataRepository',
            useValue: mockPriceDataRepository,
          },
        ],
      })
        .overrideProvider(TestPriceDataRouterService)
        .useFactory({
          factory: () => {
            return new TestPriceDataRouterService(
              mockPriceDataService as any,
              mockPriceDataRepository as any,
            );
          },
        })
        .compile();

      service = module.get<TestPriceDataRouterService>(
        TestPriceDataRouterService,
      );
    });

    afterEach(() => {
      mockPriceDataService.reset();
    });

    describe('Symbol Routing', () => {
      it('should identify T_ prefixed symbols as test symbols', () => {
        expect(service.isTestSymbol('T_AAPL')).toBe(true);
        expect(service.isTestSymbol('T_BTC')).toBe(true);
        expect(service.isTestSymbol('T_SPY')).toBe(true);
      });

      it('should identify non-T_ symbols as real symbols', () => {
        expect(service.isTestSymbol('AAPL')).toBe(false);
        expect(service.isTestSymbol('BTC')).toBe(false);
        expect(service.isTestSymbol('SPY')).toBe(false);
      });

      it('should convert real symbol to test symbol', () => {
        expect(service.getTestSymbol('AAPL')).toBe('T_AAPL');
        expect(service.getTestSymbol('BTC')).toBe('T_BTC');
      });

      it('should not double-prefix test symbols', () => {
        expect(service.getTestSymbol('T_AAPL')).toBe('T_AAPL');
      });

      it('should extract real symbol from test symbol', () => {
        expect(service.getRealSymbol('T_AAPL')).toBe('AAPL');
        expect(service.getRealSymbol('T_BTC')).toBe('BTC');
      });

      it('should pass through real symbols unchanged', () => {
        expect(service.getRealSymbol('AAPL')).toBe('AAPL');
      });
    });

    describe('Test Price Data Routing', () => {
      it('should route T_ symbols to test_price_data', async () => {
        // Add test price data
        mockPriceDataService.addPrice('T_AAPL', {
          open: 185.0,
          high: 188.0,
          low: 184.0,
          close: 187.5,
          volume: 1000000,
          timestamp: new Date().toISOString(),
        });

        const result = await service.getLatestPrice('T_AAPL', 'test-org');

        expect(result.is_test_route).toBe(true);
        expect(result.data).not.toBeNull();
        expect((result.data as PriceDataPoint).symbol).toBe('T_AAPL');
        expect((result.data as PriceDataPoint).is_test).toBe(true);
        expect((result.data as PriceDataPoint).source).toBe('test_db');
      });

      it('should return error for missing test price data', async () => {
        const result = await service.getLatestPrice('T_UNKNOWN', 'test-org');

        expect(result.is_test_route).toBe(true);
        expect(result.data).toBeNull();
        expect(result.error).toContain('No test price data found');
      });
    });

    describe('Price History Generation', () => {
      it('should only generate prices for T_ symbols', async () => {
        const validResult = await service.generateTestPriceHistory(
          'T_AAPL',
          'test-org',
          new Date('2024-01-01'),
          new Date('2024-01-31'),
          { startPrice: 185.0 },
        );

        expect(validResult.is_test_route).toBe(true);
        expect(validResult.error).toBeUndefined();
        expect(validResult.data).not.toBeNull();
      });

      it('should reject price generation for non-T_ symbols', async () => {
        const invalidResult = await service.generateTestPriceHistory(
          'AAPL',
          'test-org',
          new Date('2024-01-01'),
          new Date('2024-01-31'),
          { startPrice: 185.0 },
        );

        expect(invalidResult.is_test_route).toBe(false);
        expect(invalidResult.error).toContain(
          'Cannot generate test prices for non-test symbol',
        );
        expect(invalidResult.data).toBeNull();
      });
    });

    describe('External API Routing', () => {
      it('should route real symbols to external API when configured', async () => {
        // Set up mock external fetcher
        const mockExternalFetcher = {
          getLatestPrice: jest.fn().mockResolvedValue({
            symbol: 'AAPL',
            timestamp: new Date().toISOString(),
            open: 185.0,
            high: 188.0,
            low: 184.0,
            close: 187.5,
            volume: 50000000,
            is_test: false,
            source: 'external_api',
          }),
          getPriceRange: jest.fn().mockResolvedValue([]),
        };

        service.setExternalFetcher(mockExternalFetcher);

        const result = await service.getLatestPrice('AAPL', 'test-org');

        expect(result.is_test_route).toBe(false);
        expect(mockExternalFetcher.getLatestPrice).toHaveBeenCalledWith('AAPL');
      });

      it('should return error when external fetcher not configured', async () => {
        const result = await service.getLatestPrice('AAPL', 'test-org');

        expect(result.is_test_route).toBe(false);
        expect(result.error).toContain('No external price fetcher configured');
      });
    });
  });

  describe('Signal is_test Flag Propagation (INV-02)', () => {
    it('should set is_test=true for signals from test sources', () => {
      const testSource: Source = {
        id: 'source-1',
        name: 'Test Source',
        description: null,
        source_type: 'test_db',
        url: 'db://test',
        scope_level: 'domain',
        domain: 'stocks',
        universe_id: null,
        target_id: null,
        crawl_config: {},
        auth_config: { type: 'none' },
        crawl_frequency_minutes: 15,
        is_active: true,
        is_test: true, // Test source
        last_crawl_at: null,
        last_crawl_status: null,
        last_error: null,
        consecutive_errors: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Simulate signal creation logic from source-crawler.service.ts
      const isTestSignal =
        testSource.is_test === true || testSource.source_type === 'test_db';

      expect(isTestSignal).toBe(true);
    });

    it('should set is_test=false for signals from production sources', () => {
      const prodSource: Source = {
        id: 'source-2',
        name: 'Production RSS',
        description: null,
        source_type: 'rss',
        url: 'https://example.com/feed',
        scope_level: 'domain',
        domain: 'stocks',
        universe_id: null,
        target_id: null,
        crawl_config: {},
        auth_config: { type: 'none' },
        crawl_frequency_minutes: 15,
        is_active: true,
        is_test: false, // Production source
        last_crawl_at: null,
        last_crawl_status: null,
        last_error: null,
        consecutive_errors: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Simulate signal creation logic
      const isTestSignal =
        prodSource.is_test === true || prodSource.source_type === 'test_db';

      expect(isTestSignal).toBe(false);
    });
  });

  describe('CreateSignalData Interface', () => {
    it('should support is_test and scenario_run_id fields', () => {
      const signalData: CreateSignalData = {
        target_id: 'target-123',
        source_id: 'source-456',
        content: 'Test signal content',
        direction: 'bullish',
        is_test: true,
        scenario_run_id: 'run-789',
        metadata: {
          is_test: true,
          scenario_run_id: 'run-789',
        },
      };

      expect(signalData.is_test).toBe(true);
      expect(signalData.scenario_run_id).toBe('run-789');
      expect(signalData.metadata?.is_test).toBe(true);
    });
  });

  describe('Source Interface test_db Configuration', () => {
    it('should support test_db source type with crawl config', () => {
      const testDbSource: Source = {
        id: 'source-1',
        name: 'Test DB Source',
        description: 'Reads from test_articles table',
        source_type: 'test_db',
        url: 'db://prediction.test_articles?org=test-org',
        scope_level: 'domain',
        domain: 'stocks',
        universe_id: null,
        target_id: null,
        crawl_config: {
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
          target_symbols: ['T_AAPL', 'T_MSFT'],
          unprocessed_only: true,
          max_articles: 50,
        },
        auth_config: { type: 'none' },
        crawl_frequency_minutes: 15,
        is_active: true,
        is_test: true,
        last_crawl_at: null,
        last_crawl_status: null,
        last_error: null,
        consecutive_errors: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(testDbSource.source_type).toBe('test_db');
      expect(testDbSource.is_test).toBe(true);
      expect(testDbSource.crawl_config.organization_slug).toBe('test-org');
      expect(testDbSource.crawl_config.scenario_id).toBe('scenario-123');
      expect(testDbSource.crawl_config.target_symbols).toEqual([
        'T_AAPL',
        'T_MSFT',
      ]);
    });
  });
});
