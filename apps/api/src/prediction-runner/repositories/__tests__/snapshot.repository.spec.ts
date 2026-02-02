import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotRepository } from '../snapshot.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { PredictionSnapshot } from '../../interfaces/snapshot.interface';

describe('SnapshotRepository', () => {
  let repository: SnapshotRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSnapshot: PredictionSnapshot = {
    id: 'snapshot-123',
    prediction_id: 'pred-123',
    captured_at: '2024-01-01T10:00:00Z',
    predictors: [
      {
        predictor_id: 'predictor-1',
        signal_content: 'Test signal content',
        direction: 'bullish',
        strength: 7,
        confidence: 0.8,
        analyst_slug: 'fred',
        created_at: '2024-01-01T09:00:00Z',
      },
    ],
    rejected_signals: [
      {
        signal_id: 'signal-1',
        content: 'Rejected signal content',
        rejection_reason: 'Low confidence',
        confidence: 0.3,
        rejected_at: '2024-01-01T09:30:00Z',
      },
    ],
    analyst_assessments: [
      {
        analyst: {
          analyst_id: 'analyst-123',
          slug: 'fred',
          name: 'Fred the Fundamental',
          perspective: 'Fundamentals-focused analyst',
          effective_weight: 1.0,
          effective_tier: 'gold',
          tier_instructions: {},
          learned_patterns: [],
          scope_level: 'runner',
        },
        tier: 'gold',
        direction: 'up',
        confidence: 0.8,
        reasoning: 'Strong fundamentals',
        key_factors: ['strong earnings'],
        risks: ['market volatility'],
        learnings_applied: [],
      },
    ],
    llm_ensemble: {
      tiers_used: ['gold', 'silver'],
      tier_results: {
        gold: {
          direction: 'up',
          confidence: 0.85,
          model: 'claude-3-opus',
          provider: 'anthropic',
        },
        silver: {
          direction: 'up',
          confidence: 0.75,
          model: 'claude-3-sonnet',
          provider: 'anthropic',
        },
      },
      agreement_level: 0.9,
    },
    learnings_applied: [
      {
        learning_id: 'learning-1',
        type: 'pattern',
        content: 'Applied learning content',
        scope: 'target',
        applied_to: 'fred',
      },
    ],
    threshold_evaluation: {
      min_predictors: 2,
      actual_predictors: 3,
      min_combined_strength: 15,
      actual_combined_strength: 21,
      min_consensus: 0.7,
      actual_consensus: 0.85,
      passed: true,
    },
    timeline: [
      {
        timestamp: '2024-01-01T09:00:00Z',
        event_type: 'signal_received',
        details: { signal_id: 'signal-1' },
      },
      {
        timestamp: '2024-01-01T09:30:00Z',
        event_type: 'predictor_created',
        details: { predictor_id: 'predictor-1' },
      },
      {
        timestamp: '2024-01-01T10:00:00Z',
        event_type: 'prediction_generated',
        details: { prediction_id: 'pred-123' },
      },
    ],
    created_at: '2024-01-01T10:00:00Z',
  };

  const mockDbSnapshot = {
    ...mockSnapshot,
    analyst_predictions: mockSnapshot.analyst_assessments,
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    insert?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockDbSnapshot,
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockSnapshot,
      error: null,
    };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<SnapshotRepository>(SnapshotRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create snapshot successfully', async () => {
      const createData = {
        prediction_id: 'pred-123',
        predictors: mockSnapshot.predictors,
        rejected_signals: mockSnapshot.rejected_signals,
        analyst_assessments: mockSnapshot.analyst_assessments,
        llm_ensemble: mockSnapshot.llm_ensemble,
        learnings_applied: mockSnapshot.learnings_applied,
        threshold_evaluation: mockSnapshot.threshold_evaluation,
        timeline: mockSnapshot.timeline,
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          prediction_id: 'pred-123',
          predictors: [],
          rejected_signals: [],
          analyst_assessments: [],
          llm_ensemble: {
            tiers_used: [],
            tier_results: {},
            agreement_level: 0,
          },
          learnings_applied: [],
          threshold_evaluation: {
            min_predictors: 0,
            actual_predictors: 0,
            min_combined_strength: 0,
            actual_combined_strength: 0,
            min_consensus: 0,
            actual_consensus: 0,
            passed: false,
          },
          timeline: [],
        }),
      ).rejects.toThrow('Create succeeded but no snapshot returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          prediction_id: 'pred-123',
          predictors: [],
          rejected_signals: [],
          analyst_assessments: [],
          llm_ensemble: {
            tiers_used: [],
            tier_results: {},
            agreement_level: 0,
          },
          learnings_applied: [],
          threshold_evaluation: {
            min_predictors: 0,
            actual_predictors: 0,
            min_combined_strength: 0,
            actual_combined_strength: 0,
            min_consensus: 0,
            actual_consensus: 0,
            passed: false,
          },
          timeline: [],
        }),
      ).rejects.toThrow('Failed to create snapshot: Insert failed');
    });
  });

  describe('findByPredictionId', () => {
    it('should return snapshot when found', async () => {
      const result = await repository.findByPredictionId('pred-123');

      expect(result).toBeDefined();
      expect(result?.prediction_id).toBe('pred-123');
    });

    it('should map analyst_predictions to analyst_assessments', async () => {
      const result = await repository.findByPredictionId('pred-123');

      expect(result?.analyst_assessments).toBeDefined();
    });

    it('should return null when snapshot not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByPredictionId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByPredictionId('pred-123')).rejects.toThrow(
        'Failed to fetch snapshot: Database error',
      );
    });
  });

  describe('threshold evaluation', () => {
    it('should store threshold evaluation with all required fields', async () => {
      const createData = {
        prediction_id: 'pred-123',
        predictors: [],
        rejected_signals: [],
        analyst_assessments: [],
        llm_ensemble: {
          tiers_used: ['gold'],
          tier_results: {},
          agreement_level: 1.0,
        },
        learnings_applied: [],
        threshold_evaluation: {
          min_predictors: 3,
          actual_predictors: 5,
          min_combined_strength: 20,
          actual_combined_strength: 35,
          min_consensus: 0.6,
          actual_consensus: 0.9,
          passed: true,
        },
        timeline: [],
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should handle failed threshold evaluation', async () => {
      const createData = {
        prediction_id: 'pred-123',
        predictors: [],
        rejected_signals: [],
        analyst_assessments: [],
        llm_ensemble: {
          tiers_used: ['bronze'],
          tier_results: {},
          agreement_level: 0.5,
        },
        learnings_applied: [],
        threshold_evaluation: {
          min_predictors: 3,
          actual_predictors: 1,
          min_combined_strength: 20,
          actual_combined_strength: 5,
          min_consensus: 0.6,
          actual_consensus: 0.3,
          passed: false,
        },
        timeline: [],
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });
  });

  describe('timeline events', () => {
    const eventTypes = [
      'signal_received',
      'signal_evaluated',
      'predictor_created',
      'threshold_checked',
      'prediction_generated',
      'notification_sent',
    ] as const;

    eventTypes.forEach((eventType) => {
      it(`should handle ${eventType} timeline event`, async () => {
        const createData = {
          prediction_id: 'pred-123',
          predictors: [],
          rejected_signals: [],
          analyst_assessments: [],
          llm_ensemble: {
            tiers_used: [],
            tier_results: {},
            agreement_level: 0,
          },
          learnings_applied: [],
          threshold_evaluation: {
            min_predictors: 0,
            actual_predictors: 0,
            min_combined_strength: 0,
            actual_combined_strength: 0,
            min_consensus: 0,
            actual_consensus: 0,
            passed: false,
          },
          timeline: [
            {
              timestamp: '2024-01-01T10:00:00Z',
              event_type: eventType,
              details: { test: 'data' },
            },
          ],
        };

        const result = await repository.create(createData);

        expect(result).toBeDefined();
      });
    });
  });
});
