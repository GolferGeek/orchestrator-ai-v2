import { Test, TestingModule } from '@nestjs/testing';
import { ArticleProcessorService } from '../article-processor.service';
import {
  SourceSubscriptionRepository,
  CrawlerArticle,
} from '../../repositories/source-subscription.repository';
import { SignalRepository } from '../../repositories/signal.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('ArticleProcessorService', () => {
  let service: ArticleProcessorService;
  let mockSubscriptionRepository: Partial<SourceSubscriptionRepository>;
  let mockSignalRepository: Partial<SignalRepository>;
  let mockTargetRepository: Partial<TargetRepository>;
  let mockObservabilityService: Partial<ObservabilityEventsService>;

  const mockSubscription = {
    id: 'sub-123',
    source_id: 'source-123',
    target_id: 'target-123',
    universe_id: 'universe-123',
    filter_config: {
      keywords_include: ['stock', 'market'],
      keywords_exclude: ['spam'],
      min_relevance_score: 0.5,
    },
    last_processed_at: '2024-01-01T00:00:00Z',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTarget = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc',
    description: 'Technology company',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTestTarget = {
    ...mockTarget,
    id: 'test-target-123',
    symbol: 'T_AAPL', // Test target prefix
  };

  const createMockArticle = (
    overrides: Partial<CrawlerArticle> = {},
  ): CrawlerArticle => ({
    id: 'article-123',
    organization_slug: 'test-org',
    source_id: 'source-123',
    url: 'https://example.com/article/1',
    title: 'Stock Market Surges on Positive News',
    content:
      'The stock market showed strong gains today with tech stocks leading.',
    summary: 'Market gains overview',
    author: 'Test Author',
    published_at: '2024-01-15T00:00:00Z',
    content_hash: 'abc123hash',
    title_normalized: 'stock market surges positive news',
    key_phrases: ['stock market', 'positive news', 'tech stocks'],
    fingerprint_hash: 'fingerprint123',
    raw_data: null,
    first_seen_at: '2024-01-15T12:00:00Z',
    is_test: false,
    metadata: {},
    ...overrides,
  });

  beforeEach(async () => {
    mockSubscriptionRepository = {
      findById: jest.fn(),
      getNewArticles: jest.fn(),
      getNewArticlesForTarget: jest.fn(),
      updateWatermark: jest.fn(),
    };

    mockSignalRepository = {
      create: jest.fn(),
    };

    mockTargetRepository = {
      findById: jest.fn(),
    };

    mockObservabilityService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleProcessorService,
        {
          provide: SourceSubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        { provide: SignalRepository, useValue: mockSignalRepository },
        { provide: TargetRepository, useValue: mockTargetRepository },
        {
          provide: ObservabilityEventsService,
          useValue: mockObservabilityService,
        },
      ],
    }).compile();

    service = module.get<ArticleProcessorService>(ArticleProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // PROCESS SUBSCRIPTION
  // =============================================================================

  describe('processSubscription', () => {
    it('should process articles for a subscription and create signals', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.subscription_id).toBe('sub-123');
      expect(result.target_id).toBe('target-123');
      expect(result.articles_processed).toBe(1);
      expect(result.signals_created).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockSignalRepository.create).toHaveBeenCalled();
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

    it('should return error when target not found', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([createMockArticle()]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.processSubscription('sub-123');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Target not found');
    });

    it('should skip articles that fail keyword filters', async () => {
      const spamArticle = createMockArticle({
        title: 'Spam content with spam keywords',
        content: 'This is spam article that should be filtered',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([spamArticle]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
      expect(result.signals_skipped).toBe(1);
      expect(result.signals_created).toBe(0);
    });

    it('should mark test articles correctly for test targets', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        target_id: 'test-target-123',
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_test: true,
        }),
      );
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
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
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
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );

      await service.processSubscription('sub-123');

      expect(mockSubscriptionRepository.updateWatermark).not.toHaveBeenCalled();
    });

    it('should handle individual article processing errors', async () => {
      const articles = [
        createMockArticle(),
        createMockArticle({ id: 'article-456' }),
      ];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock)
        .mockResolvedValueOnce({ id: 'signal-123' })
        .mockRejectedValueOnce(new Error('Database error'));
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.signals_created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('article-456');
    });

    it('should respect limit parameter', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );

      await service.processSubscription('sub-123', 50);

      expect(mockSubscriptionRepository.getNewArticles).toHaveBeenCalledWith(
        'sub-123',
        50,
      );
    });
  });

  // =============================================================================
  // PROCESS TARGET
  // =============================================================================

  describe('processTarget', () => {
    it('should process articles for a target across all subscriptions', async () => {
      const articlesWithSub = [
        { ...createMockArticle(), subscription_id: 'sub-1' },
        {
          ...createMockArticle({ id: 'article-456' }),
          subscription_id: 'sub-2',
        },
      ];

      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (
        mockSubscriptionRepository.getNewArticlesForTarget as jest.Mock
      ).mockResolvedValue(articlesWithSub);
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processTarget('target-123');

      expect(result.target_id).toBe('target-123');
      expect(result.subscription_id).toBe('all');
      expect(result.articles_processed).toBe(2);
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should return error when target not found', async () => {
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.processTarget('nonexistent');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Target not found');
    });

    it('should group articles by subscription for watermark updates', async () => {
      const articlesWithSub = [
        {
          ...createMockArticle({ first_seen_at: '2024-01-15T12:00:00Z' }),
          subscription_id: 'sub-1',
        },
        {
          ...createMockArticle({
            id: 'article-2',
            first_seen_at: '2024-01-15T14:00:00Z',
          }),
          subscription_id: 'sub-1',
        },
        {
          ...createMockArticle({
            id: 'article-3',
            first_seen_at: '2024-01-15T13:00:00Z',
          }),
          subscription_id: 'sub-2',
        },
      ];

      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (
        mockSubscriptionRepository.getNewArticlesForTarget as jest.Mock
      ).mockResolvedValue(articlesWithSub);
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processTarget('target-123');

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
  });

  // =============================================================================
  // KEYWORD FILTERING (passesFilters - private method tested via processSubscription)
  // =============================================================================

  describe('keyword filtering', () => {
    it('should pass articles with include keywords', async () => {
      const article = createMockArticle({
        title: 'Stock market rally',
        content: 'Stock prices are up',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.signals_created).toBe(1);
    });

    it('should filter articles with exclude keywords', async () => {
      const article = createMockArticle({
        title: 'Spam stock market spam',
        content: 'This article contains spam',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.signals_skipped).toBe(1);
      expect(result.signals_created).toBe(0);
    });

    it('should filter articles without any include keywords when include list is set', async () => {
      const article = createMockArticle({
        title: 'Weather forecast today',
        content: 'Sunny with no clouds',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.signals_skipped).toBe(1);
    });

    it('should pass all articles when no include keywords specified', async () => {
      const article = createMockArticle({
        title: 'Random article',
        content: 'Some content here',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: { keywords_include: [], keywords_exclude: [] },
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.signals_created).toBe(1);
    });
  });

  // =============================================================================
  // SIGNAL DIRECTION INFERENCE (inferDirection - private method tested via processSubscription)
  // =============================================================================

  describe('signal direction inference', () => {
    it('should infer bullish direction from positive keywords', async () => {
      const article = createMockArticle({
        title: 'Stock Surges Rally Growth',
        content: 'Market shows bullish gains with positive outlook',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'bullish',
        }),
      );
    });

    it('should infer bearish direction from negative keywords', async () => {
      const article = createMockArticle({
        title: 'Stock Drops Fall Decline',
        content: 'Market shows bearish losses with crash fears',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'bearish',
        }),
      );
    });

    it('should infer neutral direction when no clear sentiment', async () => {
      const article = createMockArticle({
        title: 'Company Announces New Product',
        content: 'The company released a statement today',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'neutral',
        }),
      );
    });
  });

  // =============================================================================
  // SIGNAL CREATION
  // =============================================================================

  describe('signal creation', () => {
    it('should create signal with correct metadata', async () => {
      const article = createMockArticle();

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          target_id: 'target-123',
          source_id: 'source-123',
          url: 'https://example.com/article/1',
          detected_at: '2024-01-15T12:00:00Z',
          metadata: expect.objectContaining({
            crawler_article_id: 'article-123',
            headline: 'Stock Market Surges on Positive News',
            content_hash: 'abc123hash',
            key_phrases: ['stock market', 'positive news', 'tech stocks'],
          }),
        }),
      );
    });

    it('should use article content for signal content', async () => {
      const article = createMockArticle({
        content: 'Main article content',
        summary: 'Article summary',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Main article content',
        }),
      );
    });

    it('should fallback to summary when no content', async () => {
      const article = createMockArticle({
        content: null,
        summary: 'Article summary fallback',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        filter_config: {},
      });
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockSignalRepository.create as jest.Mock).mockResolvedValue({
        id: 'signal-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSignalRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Article summary fallback',
        }),
      );
    });
  });
});
