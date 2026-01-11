import { Test, TestingModule } from '@nestjs/testing';
import { SignalDetectionService } from '../signal-detection.service';
import { SignalRepository } from '../../repositories/signal.repository';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { AnalystEnsembleService } from '../analyst-ensemble.service';
import { TargetService } from '../target.service';
import { Signal } from '../../interfaces/signal.interface';
import { Target } from '../../interfaces/target.interface';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import {
  EnsembleResult,
  AnalystAssessmentResult,
} from '../../interfaces/ensemble.interface';
import { ActiveAnalyst } from '../../interfaces/analyst.interface';

describe('SignalDetectionService', () => {
  let service: SignalDetectionService;
  let signalRepository: jest.Mocked<SignalRepository>;
  let predictorRepository: jest.Mocked<PredictorRepository>;
  let ensembleService: jest.Mocked<AnalystEnsembleService>;
  let targetService: jest.Mocked<TargetService>;

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

  const mockSignal: Signal = {
    id: 'signal-123',
    target_id: 'target-456',
    source_id: 'source-789',
    content: 'Breaking news: Company X announces major earnings beat',
    direction: 'bullish',
    detected_at: '2026-01-08T12:00:00Z',
    url: 'https://example.com/news/123',
    metadata: { source: 'news', category: 'earnings' },
    disposition: 'pending',
    urgency: null,
    processing_worker: null,
    processing_started_at: null,
    evaluation_result: null,
    review_queue_id: null,
    created_at: '2026-01-08T12:00:00Z',
    updated_at: '2026-01-08T12:00:00Z',
    expired_at: null,
    is_test: false,
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

  const mockAnalyst: ActiveAnalyst = {
    analyst_id: 'analyst-1',
    slug: 'analyst-1',
    name: 'Test Analyst 1',
    perspective: 'Test perspective',
    effective_weight: 1.0,
    effective_tier: 'silver',
    tier_instructions: {},
    learned_patterns: [],
    scope_level: 'runner',
  };

  const createMockEnsembleResult = (
    overrides: Partial<EnsembleResult['aggregated']> = {},
  ): EnsembleResult => {
    const mockAssessment: AnalystAssessmentResult = {
      analyst: mockAnalyst,
      tier: 'silver',
      direction: 'bullish',
      confidence: 0.8,
      reasoning: 'Strong earnings beat indicates momentum',
      key_factors: ['earnings beat', 'revenue growth'],
      risks: ['market volatility'],
      learnings_applied: [],
    };

    return {
      assessments: [mockAssessment],
      aggregated: {
        direction: 'bullish',
        confidence: 0.775,
        consensus_strength: 0.85,
        reasoning: 'Consensus bullish view based on earnings and sentiment',
        ...overrides,
      },
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalDetectionService,
        {
          provide: SignalRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: PredictorRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: AnalystEnsembleService,
          useValue: {
            runEnsemble: jest.fn(),
          },
        },
        {
          provide: TargetService,
          useValue: {
            findByIdOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SignalDetectionService>(SignalDetectionService);
    signalRepository = module.get(SignalRepository);
    predictorRepository = module.get(PredictorRepository);
    ensembleService = module.get(AnalystEnsembleService);
    targetService = module.get(TargetService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processSignal', () => {
    beforeEach(() => {
      targetService.findByIdOrThrow.mockResolvedValue(mockTarget);
    });

    it('should create predictor when confidence and consensus are high', async () => {
      ensembleService.runEnsemble.mockResolvedValue(createMockEnsembleResult());
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
        signal_id: mockSignal.id,
        target_id: mockSignal.target_id,
        direction: 'bullish',
        strength: 8,
        confidence: 0.775,
        reasoning: 'Consensus bullish view based on earnings and sentiment',
        analyst_slug: 'ensemble',
        analyst_assessment: {
          direction: 'bullish',
          confidence: 0.775,
          reasoning: 'Test',
          key_factors: [],
          risks: [],
        },
        llm_usage_id: null,
        status: 'active',
        consumed_at: null,
        consumed_by_prediction_id: null,
        expires_at: '2026-01-09T12:00:00Z',
        created_at: '2026-01-08T12:00:00Z',
        updated_at: '2026-01-08T12:00:00Z',
      });

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.shouldCreatePredictor).toBe(true);
      expect(result.urgency).toBe('notable');
      expect(result.confidence).toBe(0.775);
      expect(predictorRepository.create).toHaveBeenCalled();
      expect(signalRepository.update).toHaveBeenCalledWith(
        mockSignal.id,
        expect.objectContaining({
          disposition: 'predictor_created',
        }),
      );
    });

    it('should reject signal when confidence is too low', async () => {
      ensembleService.runEnsemble.mockResolvedValue(
        createMockEnsembleResult({
          confidence: 0.3, // Below 0.5 threshold
          consensus_strength: 0.7,
        }),
      );

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.shouldCreatePredictor).toBe(false);
      expect(predictorRepository.create).not.toHaveBeenCalled();
      expect(signalRepository.update).toHaveBeenCalledWith(
        mockSignal.id,
        expect.objectContaining({
          disposition: 'rejected',
        }),
      );
    });

    it('should reject signal when consensus is too low', async () => {
      ensembleService.runEnsemble.mockResolvedValue(
        createMockEnsembleResult({
          confidence: 0.8,
          consensus_strength: 0.4, // Below 0.6 threshold
        }),
      );

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.shouldCreatePredictor).toBe(false);
      expect(predictorRepository.create).not.toHaveBeenCalled();
    });

    it('should mark urgency as urgent when confidence >= 0.9', async () => {
      ensembleService.runEnsemble.mockResolvedValue(
        createMockEnsembleResult({
          confidence: 0.95,
          consensus_strength: 0.9,
        }),
      );
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
      } as ReturnType<typeof predictorRepository.create> extends Promise<
        infer T
      >
        ? T
        : never);

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.urgency).toBe('urgent');
    });

    it('should mark urgency as notable when 0.7 <= confidence < 0.9', async () => {
      ensembleService.runEnsemble.mockResolvedValue(
        createMockEnsembleResult({
          confidence: 0.75,
          consensus_strength: 0.8,
        }),
      );
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
      } as ReturnType<typeof predictorRepository.create> extends Promise<
        infer T
      >
        ? T
        : never);

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.urgency).toBe('notable');
    });

    it('should mark urgency as routine when confidence < 0.7', async () => {
      ensembleService.runEnsemble.mockResolvedValue(
        createMockEnsembleResult({
          confidence: 0.55, // Still above 0.5 to create predictor
          consensus_strength: 0.65,
        }),
      );
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
      } as ReturnType<typeof predictorRepository.create> extends Promise<
        infer T
      >
        ? T
        : never);

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.urgency).toBe('routine');
    });

    it('should extract key factors from ensemble assessments', async () => {
      ensembleService.runEnsemble.mockResolvedValue(createMockEnsembleResult());
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
      } as ReturnType<typeof predictorRepository.create> extends Promise<
        infer T
      >
        ? T
        : never);

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.key_factors).toContain('earnings beat');
    });

    it('should extract risks from ensemble assessments', async () => {
      ensembleService.runEnsemble.mockResolvedValue(createMockEnsembleResult());
      predictorRepository.create.mockResolvedValue({
        id: 'predictor-123',
      } as ReturnType<typeof predictorRepository.create> extends Promise<
        infer T
      >
        ? T
        : never);

      const result = await service.processSignal(mockExecutionContext, {
        targetId: mockSignal.target_id,
        signal: mockSignal,
      });

      expect(result.risks).toContain('market volatility');
    });
  });
});
