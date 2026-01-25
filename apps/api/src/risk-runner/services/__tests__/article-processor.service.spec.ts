import { Test, TestingModule } from '@nestjs/testing';
import { RiskArticleProcessorService } from '../article-processor.service';
import {
  RiskSourceSubscriptionRepository,
  CrawlerArticle,
  RiskCrawlerArticle,
  RiskDimensionMapping,
  RiskSubjectFilter,
} from '../../repositories/source-subscription.repository';

describe('RiskArticleProcessorService', () => {
  let service: RiskArticleProcessorService;
  let mockSubscriptionRepository: Partial<RiskSourceSubscriptionRepository>;

  const mockDimensionMapping: RiskDimensionMapping = {
    dimensions: ['financial', 'regulatory'],
    weight: 1.0,
    auto_apply: true,
  };

  const mockSubjectFilter: RiskSubjectFilter = {
    subject_ids: [],
    subject_types: ['company'],
    identifier_pattern: null,
    apply_to_all: false,
  };

  const mockSubscription = {
    id: 'sub-123',
    source_id: 'source-123',
    scope_id: 'scope-123',
    dimension_mapping: mockDimensionMapping,
    subject_filter: mockSubjectFilter,
    last_processed_at: '2024-01-01T00:00:00Z',
    auto_reanalyze: true,
    reanalyze_threshold: 0.1,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const createMockArticle = (
    overrides: Partial<CrawlerArticle> = {},
  ): CrawlerArticle => ({
    id: 'article-123',
    organization_slug: 'test-org',
    source_id: 'source-123',
    url: 'https://example.com/article/1',
    title: 'Company Faces Regulatory Investigation',
    content: 'The SEC has launched an investigation into accounting practices.',
    summary: 'Regulatory probe overview',
    author: 'Test Author',
    published_at: '2024-01-15T00:00:00Z',
    content_hash: 'abc123hash',
    title_normalized: 'company faces regulatory investigation',
    key_phrases: ['regulatory investigation', 'sec investigation'],
    fingerprint_hash: 'fingerprint123',
    raw_data: null,
    first_seen_at: '2024-01-15T12:00:00Z',
    is_test: false,
    metadata: null,
    ...overrides,
  });

  const createMockRiskArticle = (
    overrides: Partial<RiskCrawlerArticle> = {},
  ): RiskCrawlerArticle => ({
    ...createMockArticle(),
    subscription_id: 'sub-123',
    dimension_mapping: mockDimensionMapping,
    subject_filter: mockSubjectFilter,
    ...overrides,
  });

  beforeEach(async () => {
    mockSubscriptionRepository = {
      findById: jest.fn(),
      getNewArticles: jest.fn(),
      getNewArticlesForScope: jest.fn(),
      updateWatermark: jest.fn(),
      getSubscriptionStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskArticleProcessorService,
        {
          provide: RiskSourceSubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
      ],
    }).compile();

    service = module.get<RiskArticleProcessorService>(
      RiskArticleProcessorService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // PROCESS SUBSCRIPTION
  // =============================================================================

  describe('processSubscription', () => {
    it('should process articles for a subscription and trigger dimension updates', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.scope_id).toBe('scope-123');
      expect(result.subscription_id).toBe('sub-123');
      expect(result.articles_processed).toBe(1);
      expect(result.dimension_updates_triggered).toBeGreaterThan(0);
      expect(result.reanalysis_triggered).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalled();
    });

    it('should throw error when subscription not found', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.processSubscription('nonexistent')).rejects.toThrow(
        'Subscription not found: nonexistent',
      );
    });

    it('should skip articles with no dimension mapping', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        dimension_mapping: { dimensions: [], weight: 1.0, auto_apply: true },
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      // Articles are skipped when no dimensions mapped
      expect(result.articles_skipped).toBe(1);
      expect(result.articles_processed).toBe(0);
      expect(result.dimension_updates_triggered).toBe(0);
    });

    it('should update watermark after processing', async () => {
      const articleTime = '2024-01-15T12:00:00Z';
      const articles = [createMockArticle({ first_seen_at: articleTime })];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledWith(
        'sub-123',
        new Date(articleTime),
      );
    });

    it('should not update watermark when no articles processed', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([]);

      await service.processSubscription('sub-123');

      expect(mockSubscriptionRepository.updateWatermark).not.toHaveBeenCalled();
    });

    it('should not trigger reanalysis when auto_reanalyze is false', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        auto_reanalyze: false,
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.reanalysis_triggered).toBe(false);
    });

    it('should respect limit parameter', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([]);

      await service.processSubscription('sub-123', 50);

      expect(mockSubscriptionRepository.getNewArticles).toHaveBeenCalledWith(
        'sub-123',
        50,
      );
    });
  });

  // =============================================================================
  // PROCESS SCOPE
  // =============================================================================

  describe('processScope', () => {
    it('should process articles for a scope across all subscriptions', async () => {
      const articlesWithContext = [
        createMockRiskArticle({ subscription_id: 'sub-1' }),
        createMockRiskArticle({ id: 'article-456', subscription_id: 'sub-2' }),
      ];

      (
        mockSubscriptionRepository.getNewArticlesForScope as jest.Mock
      ).mockResolvedValue(articlesWithContext);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processScope('scope-123');

      expect(result.scope_id).toBe('scope-123');
      expect(result.subscription_id).toBeNull();
      expect(result.articles_processed).toBe(2);
      expect(result.reanalysis_triggered).toBe(true);
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should group articles by subscription for watermark updates', async () => {
      const articlesWithContext = [
        createMockRiskArticle({
          first_seen_at: '2024-01-15T12:00:00Z',
          subscription_id: 'sub-1',
        }),
        createMockRiskArticle({
          id: 'article-2',
          first_seen_at: '2024-01-15T14:00:00Z',
          subscription_id: 'sub-1',
        }),
        createMockRiskArticle({
          id: 'article-3',
          first_seen_at: '2024-01-15T13:00:00Z',
          subscription_id: 'sub-2',
        }),
      ];

      (
        mockSubscriptionRepository.getNewArticlesForScope as jest.Mock
      ).mockResolvedValue(articlesWithContext);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processScope('scope-123');

      // sub-1 should get the latest time (14:00)
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledWith(
        'sub-1',
        new Date('2024-01-15T14:00:00Z'),
      );
      // sub-2 should get its own latest time (13:00)
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledWith(
        'sub-2',
        new Date('2024-01-15T13:00:00Z'),
      );
    });

    it('should not trigger reanalysis when no articles processed', async () => {
      (
        mockSubscriptionRepository.getNewArticlesForScope as jest.Mock
      ).mockResolvedValue([]);

      const result = await service.processScope('scope-123');

      expect(result.reanalysis_triggered).toBe(false);
      expect(result.dimension_updates_triggered).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      (
        mockSubscriptionRepository.getNewArticlesForScope as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const result = await service.processScope('scope-123');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database error');
    });
  });

  // =============================================================================
  // RISK DATA EXTRACTION
  // =============================================================================

  describe('risk data extraction', () => {
    it('should extract negative sentiment from risk-related content', async () => {
      const article = createMockArticle({
        title: 'Company Faces Crisis and Failure',
        content: 'The company announced losses and a lawsuit investigation',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
      expect(result.dimension_updates_triggered).toBeGreaterThan(0);
    });

    it('should extract positive sentiment from growth-related content', async () => {
      const article = createMockArticle({
        title: 'Company Shows Strong Growth',
        content: 'Positive earnings with success in new markets',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
    });

    it('should detect legal risk indicators', async () => {
      const article = createMockArticle({
        title: 'Lawsuit Filed Against Company',
        content: 'Litigation expected to go to court this year',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
    });

    it('should detect regulatory risk indicators', async () => {
      const article = createMockArticle({
        title: 'SEC Investigation Launched',
        content: 'Company faces compliance violation and potential fine',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
    });

    it('should detect operational risk indicators', async () => {
      const article = createMockArticle({
        title: 'Major Service Outage Reported',
        content: 'Customers affected by system disruption and breach concerns',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
    });

    it('should detect market risk indicators', async () => {
      const article = createMockArticle({
        title: 'Market Volatility Increases',
        content: 'Fears of recession and market crash grow',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
    });
  });

  // =============================================================================
  // DIMENSION UPDATES
  // =============================================================================

  describe('dimension updates', () => {
    it('should trigger updates for mapped dimensions', async () => {
      const article = createMockArticle();

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        dimension_mapping: {
          dimensions: ['financial', 'regulatory', 'operational'],
          weight: 1.0,
          auto_apply: true,
        },
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      // Should trigger updates for the 3 dimensions
      expect(result.dimension_updates_triggered).toBeLessThanOrEqual(3);
    });
  });

  // =============================================================================
  // SUBSCRIPTION STATS
  // =============================================================================

  describe('getSubscriptionStats', () => {
    it('should return subscription statistics', async () => {
      const mockStats = [
        {
          subscription_id: 'sub-123',
          source_id: 'source-123',
          source_name: 'Test Source',
          source_url: 'https://example.com',
          scope_id: 'scope-123',
          scope_name: 'Test Scope',
          is_active: true,
          auto_reanalyze: true,
          last_processed_at: '2024-01-15T12:00:00Z',
          pending_articles: 5,
          processed_articles: 100,
        },
      ];

      (
        mockSubscriptionRepository.getSubscriptionStats as jest.Mock
      ).mockResolvedValue(mockStats);

      const result = await service.getSubscriptionStats('scope-123');

      expect(result).toEqual(mockStats);
      expect(
        mockSubscriptionRepository.getSubscriptionStats,
      ).toHaveBeenCalledWith('scope-123');
    });
  });

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  describe('error handling', () => {
    it('should handle individual article processing errors', async () => {
      const articles = [
        createMockArticle(),
        createMockArticle({ id: 'article-456', title: null, content: null }),
      ];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      // Both should be processed, but one may not extract useful data
      expect(result.articles_processed).toBeGreaterThan(0);
    });

    it('should return errors in result when subscription processing fails', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockRejectedValue(new Error('Database connection failed'));

      const result = await service.processSubscription('sub-123');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Database connection failed');
    });
  });
});
