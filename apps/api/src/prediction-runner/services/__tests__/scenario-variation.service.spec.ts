import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScenarioVariationService } from '../scenario-variation.service';
import { AiArticleGeneratorService } from '../ai-article-generator.service';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import {
  TestArticleRepository,
  TestArticle,
} from '../../repositories/test-article.repository';
import {
  TestPriceDataRepository,
  TestPriceData,
} from '../../repositories/test-price-data.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { TestScenario } from '../../interfaces/test-data.interface';
import { ScenarioVariationRequest } from '../../interfaces/ai-generation.interface';

describe('ScenarioVariationService', () => {
  let service: ScenarioVariationService;
  let mockAiArticleGenerator: Partial<AiArticleGeneratorService>;
  let mockTestScenarioRepository: Partial<TestScenarioRepository>;
  let mockTestArticleRepository: Partial<TestArticleRepository>;
  let mockTestPriceDataRepository: Partial<TestPriceDataRepository>;

  const mockExecutionContext: ExecutionContext = {
    userId: 'test-user-id',
    orgSlug: 'test-org',
    conversationId: 'test-conversation-id',
    agentSlug: 'test-agent',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    taskId: 'task-123',
    deliverableId: 'deliverable-123',
    planId: 'plan-123',
  };

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    description: 'Original test scenario',
    injection_points: ['targets', 'sources', 'signals'],
    target_id: 'target-123',
    organization_slug: 'test-org',
    config: { scenario_type: 'earnings_beat' },
    created_by: null,
    status: 'active',
    results: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  const mockArticles: TestArticle[] = [
    {
      id: 'article-1',
      organization_slug: 'test-org',
      scenario_id: 'scenario-123',
      title: 'Original Article',
      content: '[SYNTHETIC TEST ARTICLE]\n\nOriginal content',
      source_name: 'Test News',
      published_at: '2024-01-01T12:00:00Z',
      target_symbols: ['T_AAPL'],
      sentiment_expected: 'positive',
      strength_expected: 0.8,
      is_synthetic: true,
      synthetic_marker: '[SYNTHETIC TEST ARTICLE]',
      processed: false,
      processed_at: null,
      created_by: null,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockPriceData: TestPriceData[] = [
    {
      id: 'price-1',
      organization_slug: 'test-org',
      scenario_id: 'scenario-123',
      symbol: 'T_AAPL',
      price_timestamp: '2024-01-01T10:00:00Z',
      open: 100,
      high: 105,
      low: 99,
      close: 103,
      volume: 1000000,
      metadata: {},
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    mockAiArticleGenerator = {
      generateArticles: jest.fn(),
    };

    mockTestScenarioRepository = {
      findById: jest.fn(),
      create: jest.fn(),
    };

    mockTestArticleRepository = {
      findByScenario: jest.fn(),
      create: jest.fn(),
    };

    mockTestPriceDataRepository = {
      findByScenario: jest.fn(),
      bulkCreate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioVariationService,
        {
          provide: AiArticleGeneratorService,
          useValue: mockAiArticleGenerator,
        },
        {
          provide: TestScenarioRepository,
          useValue: mockTestScenarioRepository,
        },
        { provide: TestArticleRepository, useValue: mockTestArticleRepository },
        {
          provide: TestPriceDataRepository,
          useValue: mockTestPriceDataRepository,
        },
      ],
    }).compile();

    service = module.get<ScenarioVariationService>(ScenarioVariationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateVariations', () => {
    beforeEach(() => {
      (mockTestScenarioRepository.findById as jest.Mock).mockResolvedValue(
        mockScenario,
      );
      (mockTestArticleRepository.findByScenario as jest.Mock).mockResolvedValue(
        mockArticles,
      );
      (
        mockTestPriceDataRepository.findByScenario as jest.Mock
      ).mockResolvedValue(mockPriceData);
      (mockTestScenarioRepository.create as jest.Mock).mockImplementation(
        (data) => ({
          ...mockScenario,
          id: `variation-${Date.now()}`,
          ...data,
        }),
      );
      (mockTestArticleRepository.create as jest.Mock).mockImplementation(
        (data) => ({
          ...mockArticles[0],
          id: `article-${Date.now()}`,
          ...data,
        }),
      );
      (mockTestPriceDataRepository.bulkCreate as jest.Mock).mockResolvedValue({
        created_count: 1,
      });
    });

    it('should generate timing shift variations', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(1);
      expect(result.variations[0]?.variationType).toBe('timing_shift');
      expect(result.variations[0]?.variationName).toContain('Timing Shift');
    });

    it('should generate sentiment weaker variations', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Weaker Sentiment Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nWeaker content',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'weak',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['sentiment_weaker'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(1);
      expect(result.variations[0]?.variationType).toBe('sentiment_weaker');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'sentiment_adjustment',
        'weaker',
      );
    });

    it('should generate sentiment stronger variations', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Stronger Sentiment Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nStronger content',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'strong',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['sentiment_stronger'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(1);
      expect(result.variations[0]?.variationType).toBe('sentiment_stronger');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'sentiment_adjustment',
        'stronger',
      );
    });

    it('should generate conflicting signal variations', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Conflicting Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nConflicting content',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bearish',
            intended_strength: 'moderate',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['conflicting_signal'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(1);
      expect(result.variations[0]?.variationType).toBe('conflicting_signal');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'adds_conflicting_article',
        true,
      );
      // Should have original article + conflicting article
      expect(result.variations[0]?.articles.length).toBeGreaterThan(1);
    });

    it('should generate language ambiguity variations', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Article May Show Growth',
            content:
              '[SYNTHETIC TEST ARTICLE]\n\nThe company might reportedly see growth...',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'weak',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['language_ambiguity'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(1);
      expect(result.variations[0]?.variationType).toBe('language_ambiguity');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'adds_hedging_language',
        true,
      );
    });

    it('should link variations to parent scenario', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.variations[0]?.parentScenarioId).toBe('scenario-123');
      expect(mockTestScenarioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            parent_scenario_id: 'scenario-123',
          }),
        }),
      );
    });

    it('should handle missing source scenario', async () => {
      (mockTestScenarioRepository.findById as jest.Mock).mockResolvedValue(
        null,
      );

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'nonexistent',
        variationTypes: ['timing_shift'],
      };

      await expect(
        service.generateVariations(request, mockExecutionContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should generate multiple variations per type', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 3,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(3);
      expect(
        result.variations.every((v) => v.variationType === 'timing_shift'),
      ).toBe(true);
    });

    it('should generate multiple variation types', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'moderate',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: [
          'timing_shift',
          'sentiment_weaker',
          'conflicting_signal',
        ],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations).toHaveLength(3);
      expect(result.variations.map((v) => v.variationType)).toEqual(
        expect.arrayContaining([
          'timing_shift',
          'sentiment_weaker',
          'conflicting_signal',
        ]),
      );
    });

    it('should handle negation variation type', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Not as bad as feared',
            content:
              '[SYNTHETIC TEST ARTICLE]\n\nThe situation is not as bad as feared...',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'moderate',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['negation'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations[0]?.variationType).toBe('negation');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'uses_negation_patterns',
        true,
      );
    });

    it('should handle delayed_outcome variation type', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['delayed_outcome'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations[0]?.variationType).toBe('delayed_outcome');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'delay_hours',
      );
      expect(result.variations[0]?.variationName).toContain('Delayed Outcome');
    });

    it('should handle multi_article variation type', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Follow-up Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nFollow-up content',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'moderate',
            simulated_published_at: '2024-01-01T13:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['multi_article'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.variations[0]?.variationType).toBe('multi_article');
      expect(result.variations[0]?.variationConfig).toHaveProperty(
        'additional_articles',
      );
      // Should have original + additional articles
      expect(result.variations[0]?.articles.length).toBeGreaterThan(1);
    });

    it('should continue on individual variation failures', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock)
        .mockResolvedValueOnce({
          success: false,
          articles: [],
          generation_metadata: {
            model_used: 'claude-opus-4-5',
            tokens_used: 0,
            generation_time_ms: 100,
          },
          errors: ['Generation failed'],
        })
        .mockResolvedValueOnce({
          success: true,
          articles: [
            {
              title: 'Success Article',
              content: '[SYNTHETIC TEST ARTICLE]\n\nSuccess',
              target_symbols: ['T_AAPL'],
              intended_sentiment: 'bullish',
              intended_strength: 'moderate',
              simulated_published_at: '2024-01-01T12:00:00Z',
              simulated_source_name: 'Test News',
            },
          ],
          generation_metadata: {
            model_used: 'claude-opus-4-5',
            tokens_used: 1500,
            generation_time_ms: 2000,
          },
        });

      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['sentiment_weaker', 'sentiment_stronger'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true); // At least one succeeded
      if (result.variations.length < 2) {
        // If one variation succeeded and one failed, we should have errors
        expect(result.errors).toBeDefined();
        expect(result.errors!.length).toBeGreaterThan(0);
      }
    });

    it('should include source scenario in result', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.sourceScenario).toBeDefined();
      expect(result.sourceScenario.id).toBe('scenario-123');
      expect(result.sourceScenario.name).toBe('Test Scenario');
    });

    it('should default to 1 variation per type if not specified', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        // variationsPerType not specified
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      expect(result.variations).toHaveLength(1);
    });

    it('should shift timestamps correctly for timing variations', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      const variation = result.variations[0];
      expect(variation?.variationConfig).toHaveProperty('shift_hours');
      expect(variation?.variationConfig).toHaveProperty('shift_direction');

      // Verify price data timestamps were shifted
      const originalTime = new Date(
        mockPriceData[0]!.price_timestamp,
      ).getTime();
      const shiftedTime = new Date(
        variation!.priceData[0]!.price_timestamp,
      ).getTime();
      expect(shiftedTime).not.toBe(originalTime);
    });

    it('should preserve article content for timing variations', async () => {
      const request: ScenarioVariationRequest = {
        sourceScenarioId: 'scenario-123',
        variationTypes: ['timing_shift'],
        variationsPerType: 1,
      };

      const result = await service.generateVariations(
        request,
        mockExecutionContext,
      );

      const variation = result.variations[0];
      expect(variation?.articles[0]?.title).toBe('Original Article');
      expect(variation?.articles[0]?.content).toContain(
        '[SYNTHETIC TEST ARTICLE]',
      );
    });
  });
});
