import { Test, TestingModule } from '@nestjs/testing';
import { ArticleProcessorService } from '../article-processor.service';
import {
  SourceSubscriptionRepository,
  CrawlerArticle,
} from '../../repositories/source-subscription.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { TargetSnapshotRepository } from '../../repositories/target-snapshot.repository';
import { AnalystEnsembleService } from '../analyst-ensemble.service';
import { LlmTierResolverService } from '../llm-tier-resolver.service';
import { LLMService } from '@/llms/llm.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('ArticleProcessorService', () => {
  let service: ArticleProcessorService;
  let mockSubscriptionRepository: Partial<SourceSubscriptionRepository>;
  let mockTargetRepository: Partial<TargetRepository>;
  let mockPredictorRepository: Partial<PredictorRepository>;
  let mockTargetSnapshotRepository: Partial<TargetSnapshotRepository>;
  let mockAnalystEnsembleService: Partial<AnalystEnsembleService>;
  let mockLlmTierResolverService: Partial<LlmTierResolverService>;
  let mockLlmService: Partial<LLMService>;
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
      findByTarget: jest.fn(),
      getNewArticles: jest.fn(),
      updateWatermark: jest.fn(),
    };

    mockTargetRepository = {
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };

    mockPredictorRepository = {
      create: jest.fn(),
    };

    mockTargetSnapshotRepository = {
      findLatest: jest.fn(),
    };

    mockAnalystEnsembleService = {
      runEnsemble: jest.fn(),
    };

    mockLlmTierResolverService = {
      resolveTier: jest.fn(),
    };

    mockLlmService = {
      generateResponse: jest.fn(),
    };

    mockObservabilityService = {
      push: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleProcessorService,
        {
          provide: SourceSubscriptionRepository,
          useValue: mockSubscriptionRepository,
        },
        { provide: PredictorRepository, useValue: mockPredictorRepository },
        { provide: TargetRepository, useValue: mockTargetRepository },
        {
          provide: TargetSnapshotRepository,
          useValue: mockTargetSnapshotRepository,
        },
        {
          provide: AnalystEnsembleService,
          useValue: mockAnalystEnsembleService,
        },
        {
          provide: LlmTierResolverService,
          useValue: mockLlmTierResolverService,
        },
        { provide: LLMService, useValue: mockLlmService },
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
    it('should process articles for a subscription and create predictors', async () => {
      const articles = [
        createMockArticle({
          title: 'AAPL Stock Market Surges on Positive News',
          content: 'Apple Inc stock showed strong gains today',
        }),
      ];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive news"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'Strong positive sentiment',
        },
        assessments: [
          {
            key_factors: ['positive earnings', 'market growth'],
            risks: ['market volatility'],
          },
        ],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.subscription_id).toBe('all');
      expect(result.target_id).toBe('target-123');
      expect(result.articles_processed).toBe(1);
      expect(result.predictors_created).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPredictorRepository.create).toHaveBeenCalled();
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
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([createMockArticle()]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.processSubscription('sub-123');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Target not found');
    });

    it('should skip articles not relevant to any targets', async () => {
      const irrelevantArticle = createMockArticle({
        title: 'Weather forecast today',
        content: 'Sunny weather expected tomorrow',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([irrelevantArticle]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.articles_processed).toBe(1);
      expect(result.predictors_created).toBe(0);
    });

    it('should skip test targets (T_ prefix)', async () => {
      const articles = [createMockArticle()];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        target_id: 'test-target-123',
      });
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        { ...mockSubscription, target_id: 'test-target-123' },
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTestTarget,
      ]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      // Test targets are skipped in processArticleForAllTargets
      expect(result.predictors_created).toBe(0);
    });

    it('should update watermark after processing', async () => {
      const articleTime = '2024-01-15T12:00:00Z';
      const articles = [createMockArticle({ first_seen_at: articleTime })];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'positive',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledWith(
        mockSubscription.id,
        new Date(articleTime),
      );
    });

    it('should not update watermark when no articles processed', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);

      await service.processSubscription('sub-123');

      expect(mockSubscriptionRepository.updateWatermark).not.toHaveBeenCalled();
    });

    it('should handle individual predictor creation errors gracefully', async () => {
      const articles = [
        createMockArticle({
          title: 'AAPL stock gains',
          content: 'Apple Inc shows growth',
        }),
        createMockArticle({
          id: 'article-456',
          title: 'AAPL news error',
          content: 'Apple stock report',
        }),
      ];

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock)
        .mockResolvedValueOnce({
          aggregated: {
            direction: 'bullish',
            confidence: 0.8,
            consensus_strength: 0.7,
            reasoning: 'positive',
          },
          assessments: [{ key_factors: [], risks: [] }],
        })
        .mockRejectedValueOnce(new Error('Database error'));
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      // Both articles are processed (no article-level errors)
      expect(result.articles_processed).toBe(2);
      // Predictor creation errors are logged but don't fail article processing
      expect(result.predictors_created).toBe(1);
      // No article-level errors
      expect(result.errors).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);

      await service.processSubscription('sub-123', 50);

      expect(mockSubscriptionRepository.getNewArticles).toHaveBeenCalledWith(
        mockSubscription.id,
        50,
      );
    });
  });

  // =============================================================================
  // PROCESS TARGET
  // =============================================================================

  describe('processTarget', () => {
    it('should process articles for a target across all subscriptions', async () => {
      const articles = [
        createMockArticle({ title: 'AAPL news' }),
        createMockArticle({ id: 'article-456', title: 'Apple stock' }),
      ];

      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'positive',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processTarget('target-123');

      expect(result.target_id).toBe('target-123');
      expect(result.subscription_id).toBe('all');
      expect(result.articles_processed).toBe(2);
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalled();
    });

    it('should return error when target not found', async () => {
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(null);
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([]);

      const result = await service.processTarget('nonexistent');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Target not found');
    });

    it('should update watermark with latest article time', async () => {
      const articles = [
        createMockArticle({
          title: 'AAPL news',
          first_seen_at: '2024-01-15T12:00:00Z',
        }),
        createMockArticle({
          id: 'article-2',
          title: 'Apple stock',
          first_seen_at: '2024-01-15T14:00:00Z',
        }),
      ];

      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue(articles);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'positive',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processTarget('target-123');

      // Should update watermark with latest article time (14:00)
      expect(mockSubscriptionRepository.updateWatermark).toHaveBeenCalledWith(
        mockSubscription.id,
        new Date('2024-01-15T14:00:00Z'),
      );
    });
  });

  // =============================================================================
  // INSTRUMENT RELEVANCE (checkInstrumentMention - private method)
  // =============================================================================

  describe('instrument relevance', () => {
    it('should detect articles mentioning target symbol', async () => {
      const article = createMockArticle({
        title: 'AAPL stock rally',
        content: 'Apple stock prices are up',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'positive',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.predictors_created).toBe(1);
    });

    it('should skip articles not relevant to any targets', async () => {
      const article = createMockArticle({
        title: 'Weather forecast',
        content: 'Sunny weather tomorrow',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(result.predictors_created).toBe(0);
    });
  });

  // =============================================================================
  // DIRECTION INFERENCE (inferDirection - private method using LLM)
  // =============================================================================

  describe('direction inference', () => {
    it('should infer bullish direction using LLM', async () => {
      const article = createMockArticle({
        title: 'AAPL Stock Surges Rally Growth',
        content: 'Apple shows strong gains with positive outlook',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive outlook"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'positive',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'bullish',
        }),
      );
    });

    it('should infer bearish direction using LLM', async () => {
      const article = createMockArticle({
        title: 'AAPL Stock Drops Fall Decline',
        content: 'Apple shows losses with crash fears',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bearish", "reasoning": "negative outlook"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bearish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'negative',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'bearish',
        }),
      );
    });

    it('should fallback to neutral when LLM fails', async () => {
      const article = createMockArticle({
        title: 'AAPL Company Announces New Product',
        content: 'Apple released a statement today',
      });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockRejectedValue(
        new Error('LLM error'),
      );
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'neutral',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'neutral',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'neutral',
        }),
      );
    });
  });

  // =============================================================================
  // PREDICTOR CREATION
  // =============================================================================

  describe('predictor creation', () => {
    it('should create predictor with correct metadata', async () => {
      const article = createMockArticle({ title: 'AAPL news' });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.7,
          reasoning: 'Strong positive sentiment',
        },
        assessments: [{ key_factors: ['growth'], risks: ['volatility'] }],
      });
      (mockPredictorRepository.create as jest.Mock).mockResolvedValue({
        id: 'predictor-123',
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          article_id: 'article-123',
          target_id: 'target-123',
          direction: 'bullish',
          confidence: 0.8,
          analyst_slug: 'ensemble',
        }),
      );
    });

    it('should not create predictor when confidence is too low', async () => {
      const article = createMockArticle({ title: 'AAPL news' });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "neutral", "reasoning": "unclear"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'neutral',
          confidence: 0.3,
          consensus_strength: 0.4,
          reasoning: 'Low confidence',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).not.toHaveBeenCalled();
      expect(result.predictors_created).toBe(0);
    });

    it('should not create predictor when consensus is too low', async () => {
      const article = createMockArticle({ title: 'AAPL news' });

      (mockSubscriptionRepository.findById as jest.Mock).mockResolvedValue(
        mockSubscription,
      );
      (mockSubscriptionRepository.findByTarget as jest.Mock).mockResolvedValue([
        mockSubscription,
      ]);
      (
        mockSubscriptionRepository.getNewArticles as jest.Mock
      ).mockResolvedValue([article]);
      (mockTargetRepository.findById as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTargetRepository.findAllActive as jest.Mock).mockResolvedValue([
        mockTarget,
      ]);
      (mockLlmTierResolverService.resolveTier as jest.Mock).mockResolvedValue({
        provider: 'openai',
        model: 'gpt-4',
      });
      (mockLlmService.generateResponse as jest.Mock).mockResolvedValue({
        content: '{"direction": "bullish", "reasoning": "positive"}',
      });
      (mockAnalystEnsembleService.runEnsemble as jest.Mock).mockResolvedValue({
        aggregated: {
          direction: 'bullish',
          confidence: 0.8,
          consensus_strength: 0.3,
          reasoning: 'Low consensus',
        },
        assessments: [{ key_factors: [], risks: [] }],
      });
      (
        mockSubscriptionRepository.updateWatermark as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.processSubscription('sub-123');

      expect(mockPredictorRepository.create).not.toHaveBeenCalled();
      expect(result.predictors_created).toBe(0);
    });
  });
});
