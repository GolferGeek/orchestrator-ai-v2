import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScenarioGeneratorService } from '../scenario-generator.service';
import { AiArticleGeneratorService } from '../ai-article-generator.service';
import { TestTargetMirrorService } from '../test-target-mirror.service';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import { TestArticleRepository } from '../../repositories/test-article.repository';
import { TestPriceDataRepository } from '../../repositories/test-price-data.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { LearningRepository } from '../../repositories/learning.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { MissedOpportunity } from '../../interfaces/missed-opportunity.interface';
import { Learning } from '../../interfaces/learning.interface';
import { Target } from '../../interfaces/target.interface';
import { TestScenario } from '../../interfaces/test-data.interface';

describe('ScenarioGeneratorService', () => {
  let service: ScenarioGeneratorService;
  let mockAiArticleGenerator: Partial<AiArticleGeneratorService>;
  let mockTestScenarioRepository: Partial<TestScenarioRepository>;
  let mockTestTargetMirrorService: Partial<TestTargetMirrorService>;
  let mockTestArticleRepository: Partial<TestArticleRepository>;
  let mockTestPriceDataRepository: Partial<TestPriceDataRepository>;
  let mockTargetRepository: Partial<TargetRepository>;
  let mockLearningRepository: Partial<LearningRepository>;
  let mockSupabaseService: Partial<SupabaseService>;

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

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: null,
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTestTarget: Target = {
    id: 'test-target-123',
    universe_id: 'universe-123',
    symbol: 'T_AAPL',
    name: 'Test Mirror: Apple Inc.',
    target_type: 'stock',
    context: null,
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockMissedOpportunity: MissedOpportunity = {
    id: 'miss-123',
    target_id: 'target-123',
    detected_at: '2024-01-03T00:00:00Z',
    move_direction: 'up',
    move_percentage: 15.5,
    move_start: '2024-01-01T00:00:00Z',
    move_end: '2024-01-02T00:00:00Z',
    significance_score: 0.85,
    analysis_status: 'completed',
    discovered_drivers: ['Earnings beat', 'Strong guidance'],
    source_gaps: ['Missing news coverage'],
    suggested_learnings: [],
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
  };

  const mockLearning: Learning = {
    id: 'learning-123',
    target_id: 'target-123',
    title: 'Earnings signal pattern',
    description: 'System should recognize earnings beat patterns earlier',
    learning_type: 'pattern',
    scope_level: 'target',
    domain: null,
    universe_id: null,
    analyst_id: null,
    config: {},
    source_type: 'human',
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    status: 'active',
    superseded_by: null,
    version: 1,
    times_applied: 0,
    times_helpful: 0,
    is_test: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    description: 'Test description',
    injection_points: ['targets', 'sources', 'signals'],
    target_id: 'test-target-123',
    organization_slug: 'test-org',
    config: {},
    created_by: null,
    status: 'active',
    results: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  beforeEach(async () => {
    mockAiArticleGenerator = {
      generateArticles: jest.fn(),
    };

    mockTestScenarioRepository = {
      create: jest.fn(),
    };

    mockTestTargetMirrorService = {
      ensureMirror: jest.fn(),
    };

    mockTestArticleRepository = {
      create: jest.fn(),
    };

    mockTestPriceDataRepository = {
      bulkCreate: jest.fn(),
    };

    mockTargetRepository = {
      findByIdOrThrow: jest.fn(),
    };

    mockLearningRepository = {
      findByIdOrThrow: jest.fn(),
    };

    const mockClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioGeneratorService,
        {
          provide: AiArticleGeneratorService,
          useValue: mockAiArticleGenerator,
        },
        {
          provide: TestScenarioRepository,
          useValue: mockTestScenarioRepository,
        },
        {
          provide: TestTargetMirrorService,
          useValue: mockTestTargetMirrorService,
        },
        { provide: TestArticleRepository, useValue: mockTestArticleRepository },
        {
          provide: TestPriceDataRepository,
          useValue: mockTestPriceDataRepository,
        },
        { provide: TargetRepository, useValue: mockTargetRepository },
        { provide: LearningRepository, useValue: mockLearningRepository },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<ScenarioGeneratorService>(ScenarioGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateFromMissedOpportunity', () => {
    beforeEach(() => {
      const mockClient = {
        schema: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockMissedOpportunity,
          error: null,
        }),
      };

      mockSupabaseService.getServiceClient = jest
        .fn()
        .mockReturnValue(mockClient);

      (mockTargetRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTestTargetMirrorService.ensureMirror as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );
      (mockTestScenarioRepository.create as jest.Mock).mockResolvedValue(
        mockScenario,
      );
      (mockTestArticleRepository.create as jest.Mock).mockResolvedValue({
        id: 'article-1',
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'Test Article',
        content: '[SYNTHETIC TEST ARTICLE]\n\nTest content',
        source_name: 'Test News',
        published_at: '2024-01-01T12:00:00Z',
        target_symbols: ['T_AAPL'],
        sentiment_expected: 'positive',
        strength_expected: 0.8,
        is_synthetic: true,
        synthetic_marker: '[SYNTHETIC TEST ARTICLE]',
        processed: false,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      });
      (mockTestPriceDataRepository.bulkCreate as jest.Mock).mockResolvedValue({
        created_count: 10,
      });
    });

    it('should generate scenario from missed opportunity', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'T_AAPL Surges on Strong Earnings',
            content: '[SYNTHETIC TEST ARTICLE]\n\nT_AAPL reported...',
            summary: 'T_AAPL beats expectations',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'bullish',
            intended_strength: 'strong',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test Financial Times',
          },
        ],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      const result = await service.generateFromMissedOpportunity(
        'miss-123',
        { articleCount: 3 },
        mockExecutionContext,
      );

      expect(result).toBeDefined();
      expect(result.sourceType).toBe('missed_opportunity');
      expect(result.sourceId).toBe('miss-123');
      expect(result.realTargetSymbol).toBe('AAPL');
      expect(result.testTargetSymbol).toBe('T_AAPL');
      expect(mockTestTargetMirrorService.ensureMirror).toHaveBeenCalledWith(
        'target-123',
        'test-org',
      );
    });

    it('should map real target to T_ test mirror', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
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

      const result = await service.generateFromMissedOpportunity(
        'miss-123',
        {},
        mockExecutionContext,
      );

      expect(mockTestTargetMirrorService.ensureMirror).toHaveBeenCalledWith(
        'target-123',
        'test-org',
      );
      expect(result.testTargetSymbol).toBe('T_AAPL');
      expect(result.testTargetSymbol).toMatch(/^T_/);
    });

    it('should create test articles via AI service', async () => {
      const mockArticles = [
        {
          title: 'Article 1',
          content: '[SYNTHETIC TEST ARTICLE]\n\nContent 1',
          target_symbols: ['T_AAPL'],
          intended_sentiment: 'bullish',
          intended_strength: 'strong',
          simulated_published_at: '2024-01-01T10:00:00Z',
          simulated_source_name: 'Source 1',
        },
        {
          title: 'Article 2',
          content: '[SYNTHETIC TEST ARTICLE]\n\nContent 2',
          target_symbols: ['T_AAPL'],
          intended_sentiment: 'bullish',
          intended_strength: 'strong',
          simulated_published_at: '2024-01-01T11:00:00Z',
          simulated_source_name: 'Source 2',
        },
      ];

      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: mockArticles,
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 1500,
          generation_time_ms: 2000,
        },
      });

      await service.generateFromMissedOpportunity(
        'miss-123',
        { articleCount: 2 },
        mockExecutionContext,
      );

      expect(mockAiArticleGenerator.generateArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          target_symbols: ['T_AAPL'],
          article_count: 2,
        }),
        mockExecutionContext,
      );
      expect(mockTestArticleRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should create test price data from historical prices', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
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

      await service.generateFromMissedOpportunity(
        'miss-123',
        {},
        mockExecutionContext,
      );

      expect(mockTestPriceDataRepository.bulkCreate).toHaveBeenCalled();
      const priceDataCall = (
        mockTestPriceDataRepository.bulkCreate as jest.Mock
      ).mock.calls[0][0];
      expect(priceDataCall.length).toBeGreaterThan(0);
      expect(priceDataCall[0]).toHaveProperty('symbol', 'T_AAPL');
      expect(priceDataCall[0]).toHaveProperty('open');
      expect(priceDataCall[0]).toHaveProperty('high');
      expect(priceDataCall[0]).toHaveProperty('low');
      expect(priceDataCall[0]).toHaveProperty('close');
    });

    it('should link scenario to source missed opportunity', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
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

      await service.generateFromMissedOpportunity(
        'miss-123',
        {},
        mockExecutionContext,
      );

      expect(mockTestScenarioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            source_missed_opportunity_id: 'miss-123',
          }),
        }),
      );
    });

    it('should handle missing missed opportunity gracefully', async () => {
      const mockClient = {
        schema: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabaseService.getServiceClient = jest
        .fn()
        .mockReturnValue(mockClient);

      await expect(
        service.generateFromMissedOpportunity(
          'nonexistent',
          {},
          mockExecutionContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle AI generation failure', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: false,
        articles: [],
        generation_metadata: {
          model_used: 'claude-opus-4-5',
          tokens_used: 0,
          generation_time_ms: 100,
        },
        errors: ['Failed to generate articles'],
      });

      await expect(
        service.generateFromMissedOpportunity(
          'miss-123',
          {},
          mockExecutionContext,
        ),
      ).rejects.toThrow('Failed to generate articles');
    });
  });

  describe('generateFromLearning', () => {
    beforeEach(() => {
      (mockLearningRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        mockLearning,
      );
      (mockTargetRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        mockTarget,
      );
      (mockTestTargetMirrorService.ensureMirror as jest.Mock).mockResolvedValue(
        mockTestTarget,
      );
      (mockTestScenarioRepository.create as jest.Mock).mockResolvedValue(
        mockScenario,
      );
      (mockTestArticleRepository.create as jest.Mock).mockResolvedValue({
        id: 'article-1',
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        title: 'Test Article',
        content: '[SYNTHETIC TEST ARTICLE]\n\nTest content',
        source_name: 'Test News',
        published_at: '2024-01-01T12:00:00Z',
        target_symbols: ['T_AAPL'],
        sentiment_expected: 'positive',
        strength_expected: 0.5,
        is_synthetic: true,
        synthetic_marker: '[SYNTHETIC TEST ARTICLE]',
        processed: false,
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
      });
      (mockTestPriceDataRepository.bulkCreate as jest.Mock).mockResolvedValue({
        created_count: 24,
      });
    });

    it('should generate scenario from learning', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test Learning Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'neutral',
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

      const result = await service.generateFromLearning(
        'learning-123',
        {},
        mockExecutionContext,
      );

      expect(result).toBeDefined();
      expect(result.sourceType).toBe('learning');
      expect(result.sourceId).toBe('learning-123');
    });

    it('should handle missing learning gracefully', async () => {
      (mockLearningRepository.findByIdOrThrow as jest.Mock).mockRejectedValue(
        new NotFoundException('Learning not found'),
      );

      await expect(
        service.generateFromLearning('nonexistent', {}, mockExecutionContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use learning description for custom prompt', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'neutral',
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

      await service.generateFromLearning(
        'learning-123',
        {},
        mockExecutionContext,
      );

      expect(mockAiArticleGenerator.generateArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_prompt: mockLearning.description,
        }),
        mockExecutionContext,
      );
    });

    it('should generate placeholder price data', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test',
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

      await service.generateFromLearning(
        'learning-123',
        {},
        mockExecutionContext,
      );

      expect(mockTestPriceDataRepository.bulkCreate).toHaveBeenCalled();
      const priceDataCall = (
        mockTestPriceDataRepository.bulkCreate as jest.Mock
      ).mock.calls[0][0];
      // Should have 24 hours of data (25 data points including hour 0)
      expect(priceDataCall.length).toBe(25);
    });

    it('should handle learning without target_id', async () => {
      const learningWithoutTarget = {
        ...mockLearning,
        target_id: null,
        scope_level: 'organization',
      };

      (mockLearningRepository.findByIdOrThrow as jest.Mock).mockResolvedValue(
        learningWithoutTarget,
      );

      await expect(
        service.generateFromLearning('learning-123', {}, mockExecutionContext),
      ).rejects.toThrow('Cannot generate scenario from learning');
    });

    it('should link scenario to source learning', async () => {
      (mockAiArticleGenerator.generateArticles as jest.Mock).mockResolvedValue({
        success: true,
        articles: [
          {
            title: 'Test',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest',
            target_symbols: ['T_AAPL'],
            intended_sentiment: 'neutral',
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

      await service.generateFromLearning(
        'learning-123',
        {},
        mockExecutionContext,
      );

      expect(mockTestScenarioRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            source_learning_id: 'learning-123',
          }),
        }),
      );
    });
  });
});
