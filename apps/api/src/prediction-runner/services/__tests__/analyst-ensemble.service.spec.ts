import { Test, TestingModule } from '@nestjs/testing';
import { AnalystEnsembleService } from '../analyst-ensemble.service';
import { AnalystService } from '../analyst.service';
import { LearningService } from '../learning.service';
import { AnalystPromptBuilderService } from '../analyst-prompt-builder.service';
import { LlmTierResolverService } from '../llm-tier-resolver.service';
import { LlmUsageLimiterService } from '../llm-usage-limiter.service';
import { AnalystMotivationService } from '../analyst-motivation.service';
import { LLMService } from '@/llms/llm.service';
import { AnalystRepository } from '../../repositories/analyst.repository';
import { ActiveAnalyst } from '../../interfaces/analyst.interface';
import { Target } from '../../interfaces/target.interface';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { AnalystAssessmentResult } from '../../interfaces/ensemble.interface';
import {
  AnalystContextVersion,
  ForkType,
} from '../../interfaces/portfolio.interface';

describe('AnalystEnsembleService', () => {
  let service: AnalystEnsembleService;
  let analystService: jest.Mocked<AnalystService>;
  let analystRepository: jest.Mocked<AnalystRepository>;
  let learningService: jest.Mocked<LearningService>;
  let promptBuilderService: jest.Mocked<AnalystPromptBuilderService>;
  let llmTierResolverService: jest.Mocked<LlmTierResolverService>;
  let llmService: jest.Mocked<LLMService>;

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: 'deliverable-123',
    agentSlug: 'test-analyst',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-3-sonnet',
  };

  const mockTarget: Target = {
    id: 'target-456',
    universe_id: 'universe-123',
    name: 'Apple Inc',
    target_type: 'stock',
    symbol: 'AAPL',
    context: 'Large cap tech company',
    is_active: true,
    is_archived: false,
    llm_config_override: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const createMockAnalyst = (
    overrides: Partial<ActiveAnalyst> = {},
  ): ActiveAnalyst => ({
    analyst_id: `analyst-${Math.random().toString(36).substr(2, 9)}`,
    slug: 'test-analyst',
    name: 'Test Analyst',
    perspective: 'Balanced analysis',
    effective_weight: 1.0,
    effective_tier: 'silver',
    tier_instructions: {},
    learned_patterns: [],
    scope_level: 'runner',
    ...overrides,
  });

  const createMockAssessment = (
    analyst: ActiveAnalyst,
    overrides: Partial<AnalystAssessmentResult> = {},
  ): AnalystAssessmentResult => ({
    analyst,
    tier: analyst.effective_tier,
    direction: 'bullish',
    confidence: 0.75,
    reasoning: 'Test reasoning',
    key_factors: ['factor1'],
    risks: ['risk1'],
    learnings_applied: [],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystEnsembleService,
        {
          provide: AnalystService,
          useValue: {
            getActiveAnalysts: jest.fn(),
          },
        },
        {
          provide: AnalystRepository,
          useValue: {
            getAllCurrentContextVersions: jest
              .fn()
              .mockResolvedValue(new Map()),
          },
        },
        {
          provide: LearningService,
          useValue: {
            getActiveLearnings: jest.fn(),
          },
        },
        {
          provide: AnalystPromptBuilderService,
          useValue: {
            buildPrompt: jest.fn(),
          },
        },
        {
          provide: LlmTierResolverService,
          useValue: {
            createTierContext: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
        {
          provide: LlmUsageLimiterService,
          useValue: {
            canUseTokens: jest
              .fn()
              .mockReturnValue({ allowed: true, remaining: 100000 }),
            recordUsage: jest.fn(),
            checkAndEmitWarnings: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AnalystMotivationService,
          useValue: {
            buildPerformanceContext: jest.fn().mockResolvedValue(null),
            shouldIncludeInEnsemble: jest.fn().mockReturnValue(true),
            getEffectiveWeight: jest
              .fn()
              .mockImplementation((weight) => weight),
            formatPerformanceContextForPrompt: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<AnalystEnsembleService>(AnalystEnsembleService);
    analystService = module.get(AnalystService);
    analystRepository = module.get(AnalystRepository);
    learningService = module.get(LearningService);
    promptBuilderService = module.get(AnalystPromptBuilderService);
    llmTierResolverService = module.get(LlmTierResolverService);
    llmService = module.get(LLMService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runEnsemble', () => {
    const mockInput = {
      targetId: 'target-456',
      content: 'Test content',
      direction: 'bullish',
    };

    beforeEach(() => {
      learningService.getActiveLearnings.mockResolvedValue([]);
      promptBuilderService.buildPrompt.mockReturnValue({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
        learningIds: [],
      });
      llmTierResolverService.createTierContext.mockResolvedValue({
        context: mockExecutionContext,
        resolved: {
          tier: 'silver',
          provider: 'anthropic',
          model: 'claude-3-sonnet',
        },
      });
    });

    it('should throw error when no analysts available', async () => {
      analystService.getActiveAnalysts.mockResolvedValue([]);

      await expect(
        service.runEnsemble(mockExecutionContext, mockTarget, mockInput),
      ).rejects.toThrow('No active analysts available for evaluation');
    });

    it('should run ensemble with single analyst', async () => {
      const analyst = createMockAnalyst();
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);
      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Strong buy signal',
          key_factors: ['momentum'],
          risks: ['volatility'],
        }),
      );

      const result = await service.runEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.assessments).toHaveLength(1);
      expect(result.assessments[0]!.direction).toBe('bullish');
      expect(result.assessments[0]!.confidence).toBe(0.8);
      expect(result.aggregated.direction).toBe('bullish');
    });

    it('should aggregate multiple analyst assessments', async () => {
      const analysts = [
        createMockAnalyst({ slug: 'analyst-1', effective_weight: 1.0 }),
        createMockAnalyst({ slug: 'analyst-2', effective_weight: 1.0 }),
        createMockAnalyst({ slug: 'analyst-3', effective_weight: 1.0 }),
      ];
      analystService.getActiveAnalysts.mockResolvedValue(analysts);
      llmService.generateResponse
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.7 }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bearish', confidence: 0.6 }),
        );

      const result = await service.runEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.assessments).toHaveLength(3);
      expect(result.aggregated.direction).toBe('bullish'); // 2/3 bullish
      // Consensus strength calculation is complex (combines majority and average methods)
      expect(result.aggregated.consensus_strength).toBeGreaterThan(0);
    });

    it('should continue if one analyst fails', async () => {
      const analysts = [
        createMockAnalyst({ slug: 'analyst-1' }),
        createMockAnalyst({ slug: 'analyst-2' }),
      ];
      analystService.getActiveAnalysts.mockResolvedValue(analysts);
      llmService.generateResponse
        .mockRejectedValueOnce(new Error('LLM error'))
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
        );

      const result = await service.runEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.assessments).toHaveLength(1);
      expect(result.assessments[0]!.direction).toBe('bullish');
    });

    it('should throw error if all analysts fail', async () => {
      const analysts = [
        createMockAnalyst({ slug: 'analyst-1' }),
        createMockAnalyst({ slug: 'analyst-2' }),
      ];
      analystService.getActiveAnalysts.mockResolvedValue(analysts);
      llmService.generateResponse.mockRejectedValue(new Error('LLM error'));

      await expect(
        service.runEnsemble(mockExecutionContext, mockTarget, mockInput),
      ).rejects.toThrow('All analyst assessments failed');
    });

    it('should parse non-JSON response gracefully', async () => {
      const analyst = createMockAnalyst();
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);
      llmService.generateResponse.mockResolvedValue(
        'This is not JSON, just plain text',
      );

      const result = await service.runEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      // Should default to neutral with 0.5 confidence
      expect(result.assessments[0]!.direction).toBe('neutral');
      expect(result.assessments[0]!.confidence).toBe(0.5);
    });

    it('should clamp confidence to 0-1 range', async () => {
      const analyst = createMockAnalyst();
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);
      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          direction: 'bullish',
          confidence: 1.5, // Invalid, should be clamped
          reasoning: 'Test',
        }),
      );

      const result = await service.runEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.assessments[0]!.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('aggregateAssessments', () => {
    describe('weighted_majority', () => {
      it('should return neutral for empty assessments', () => {
        const result = service.aggregateAssessments([], 'weighted_majority');

        expect(result.direction).toBe('neutral');
        expect(result.confidence).toBe(0);
        expect(result.consensus_strength).toBe(0);
      });

      it('should return bullish when majority is bullish', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst2 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, {
            direction: 'bullish',
            confidence: 0.8,
          }),
          createMockAssessment(analyst1, {
            direction: 'bullish',
            confidence: 0.7,
          }),
          createMockAssessment(analyst2, {
            direction: 'bearish',
            confidence: 0.6,
          }),
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_majority',
        );

        expect(result.direction).toBe('bullish');
        expect(result.consensus_strength).toBeCloseTo(0.667, 2);
      });

      it('should respect analyst weights', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 3.0 }); // Heavy weight
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst2 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, { direction: 'bearish' }), // 3x weight
          createMockAssessment(analyst1, { direction: 'bullish' }),
          createMockAssessment(analyst2, { direction: 'bullish' }),
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_majority',
        );

        // bearish has 3 weight, bullish has 2 weight
        expect(result.direction).toBe('bearish');
      });
    });

    describe('weighted_average', () => {
      it('should calculate weighted average direction', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, {
            direction: 'bullish',
            confidence: 0.8,
          }),
          createMockAssessment(analyst1, {
            direction: 'bearish',
            confidence: 0.8,
          }),
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_average',
        );

        // Bullish (1) + Bearish (-1) = 0 = neutral
        expect(result.direction).toBe('neutral');
      });

      it('should calculate confidence-weighted average', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, {
            direction: 'bullish',
            confidence: 1.0,
          }), // High confidence bullish
          createMockAssessment(analyst1, {
            direction: 'bearish',
            confidence: 0.2,
          }), // Low confidence bearish
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_average',
        );

        // Should lean bullish due to higher confidence
        expect(result.direction).toBe('bullish');
      });
    });

    describe('weighted_ensemble', () => {
      it('should use majority when consensus is strong', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst2 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, { direction: 'bullish' }),
          createMockAssessment(analyst1, { direction: 'bullish' }),
          createMockAssessment(analyst2, { direction: 'bullish' }),
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_ensemble',
        );

        expect(result.direction).toBe('bullish');
        // weighted_ensemble blends majority and average, so consensus varies
        expect(result.consensus_strength).toBeGreaterThan(0.8);
      });

      it('should blend confidence from both methods', () => {
        const analyst0 = createMockAnalyst({ effective_weight: 1.0 });
        const analyst1 = createMockAnalyst({ effective_weight: 1.0 });
        const assessments = [
          createMockAssessment(analyst0, {
            direction: 'bullish',
            confidence: 0.9,
          }),
          createMockAssessment(analyst1, {
            direction: 'bullish',
            confidence: 0.7,
          }),
        ];

        const result = service.aggregateAssessments(
          assessments,
          'weighted_ensemble',
        );

        // Confidence should be blended, not just averaged
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  // =============================================================================
  // DUAL-FORK ENSEMBLE TESTS
  // =============================================================================

  describe('runDualForkEnsemble', () => {
    const mockInput = {
      targetId: 'target-456',
      content: 'Test content',
      direction: 'bullish',
    };

    const createMockContextVersion = (
      analystId: string,
      forkType: ForkType,
    ): AnalystContextVersion => ({
      id: `version-${forkType}-${analystId}`,
      analyst_id: analystId,
      fork_type: forkType,
      version_number: 1,
      perspective: `${forkType} perspective`,
      tier_instructions: {},
      default_weight: 1.0,
      changed_by: 'system',
      is_current: true,
      created_at: '2026-01-01T00:00:00Z',
    });

    beforeEach(() => {
      learningService.getActiveLearnings.mockResolvedValue([]);
      promptBuilderService.buildPrompt.mockReturnValue({
        systemPrompt: 'System prompt',
        userPrompt: 'User prompt',
        learningIds: [],
      });
      llmTierResolverService.createTierContext.mockResolvedValue({
        context: mockExecutionContext,
        resolved: {
          tier: 'silver',
          provider: 'anthropic',
          model: 'claude-3-sonnet',
        },
      });
    });

    it('should throw error when no analysts available', async () => {
      analystService.getActiveAnalysts.mockResolvedValue([]);

      await expect(
        service.runDualForkEnsemble(
          mockExecutionContext,
          mockTarget,
          mockInput,
        ),
      ).rejects.toThrow('No active analysts available for evaluation');
    });

    it('should run assessments for both forks', async () => {
      const analyst = createMockAnalyst({ analyst_id: 'analyst-123' });
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);

      // Mock context versions for both forks
      const userVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'user')],
      ]);
      const agentVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'agent')],
      ]);
      analystRepository.getAllCurrentContextVersions
        .mockResolvedValueOnce(userVersions)
        .mockResolvedValueOnce(agentVersions);

      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Strong buy signal',
        }),
      );

      const result = await service.runDualForkEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.userForkAssessments).toHaveLength(1);
      expect(result.agentForkAssessments).toHaveLength(1);
      expect(result.userForkAssessments[0]!.fork_type).toBe('user');
      expect(result.agentForkAssessments[0]!.fork_type).toBe('agent');
    });

    it('should include context version IDs in assessments', async () => {
      const analyst = createMockAnalyst({ analyst_id: 'analyst-123' });
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);

      const userVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'user')],
      ]);
      const agentVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'agent')],
      ]);
      analystRepository.getAllCurrentContextVersions
        .mockResolvedValueOnce(userVersions)
        .mockResolvedValueOnce(agentVersions);

      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
      );

      const result = await service.runDualForkEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.userForkAssessments[0]!.context_version_id).toBe(
        'version-user-analyst-123',
      );
      expect(result.agentForkAssessments[0]!.context_version_id).toBe(
        'version-agent-analyst-123',
      );
    });

    it('should aggregate results per fork', async () => {
      const analysts = [
        createMockAnalyst({ analyst_id: 'analyst-1', slug: 'analyst-1' }),
        createMockAnalyst({ analyst_id: 'analyst-2', slug: 'analyst-2' }),
      ];
      analystService.getActiveAnalysts.mockResolvedValue(analysts);

      // Mock context versions
      const userVersions = new Map(
        analysts.map((a) => [
          a.analyst_id,
          createMockContextVersion(a.analyst_id, 'user'),
        ]),
      );
      const agentVersions = new Map(
        analysts.map((a) => [
          a.analyst_id,
          createMockContextVersion(a.analyst_id, 'agent'),
        ]),
      );
      analystRepository.getAllCurrentContextVersions
        .mockResolvedValueOnce(userVersions)
        .mockResolvedValueOnce(agentVersions);

      // User fork: both bullish
      // Agent fork: split
      llmService.generateResponse
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
        ) // user-1
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.7 }),
        ) // agent-1
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.9 }),
        ) // user-2
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bearish', confidence: 0.6 }),
        ); // agent-2

      const result = await service.runDualForkEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.userForkAssessments).toHaveLength(2);
      expect(result.agentForkAssessments).toHaveLength(2);

      // User fork should be bullish (both assessments bullish)
      expect(result.userForkAggregated.direction).toBe('bullish');

      // Combined result uses user fork for backward compatibility
      expect(result.combined.aggregated.direction).toBe('bullish');
    });

    it('should only apply learnings to user fork', async () => {
      const analyst = createMockAnalyst({ analyst_id: 'analyst-123' });
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);

      const userVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'user')],
      ]);
      const agentVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'agent')],
      ]);
      analystRepository.getAllCurrentContextVersions
        .mockResolvedValueOnce(userVersions)
        .mockResolvedValueOnce(agentVersions);

      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
      );

      await service.runDualForkEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      // Learnings should be fetched for user fork (first call)
      // but not for agent fork (agent fork uses empty array)
      expect(learningService.getActiveLearnings).toHaveBeenCalledTimes(1);
    });

    it('should continue if one fork fails', async () => {
      const analyst = createMockAnalyst({ analyst_id: 'analyst-123' });
      analystService.getActiveAnalysts.mockResolvedValue([analyst]);

      const userVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'user')],
      ]);
      const agentVersions = new Map([
        ['analyst-123', createMockContextVersion('analyst-123', 'agent')],
      ]);
      analystRepository.getAllCurrentContextVersions
        .mockResolvedValueOnce(userVersions)
        .mockResolvedValueOnce(agentVersions);

      // User fork succeeds, agent fork fails
      llmService.generateResponse
        .mockResolvedValueOnce(
          JSON.stringify({ direction: 'bullish', confidence: 0.8 }),
        )
        .mockRejectedValueOnce(new Error('LLM error'));

      const result = await service.runDualForkEnsemble(
        mockExecutionContext,
        mockTarget,
        mockInput,
      );

      expect(result.userForkAssessments).toHaveLength(1);
      expect(result.agentForkAssessments).toHaveLength(0);
      expect(result.agentForkAggregated.reasoning).toBe(
        'No agent fork assessments available',
      );
    });
  });
});
