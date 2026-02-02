/**
 * Prediction Handler Tests
 *
 * Tests for the prediction dashboard handler, including:
 * - List action for predictions with filtering and pagination
 * - Get action for individual predictions
 * - GetSnapshot action for prediction explainability
 * - GetDeepDive action for full lineage tracing
 * - Compare action for multi-prediction comparison
 * - Generate action for manual prediction generation
 * - Use action for creating positions from predictions
 * - CalculateSize action for position sizing
 * - Portfolio action for user portfolio summary
 * - ClosedPositions action for position history
 * - ClosePosition action for closing positions
 */

import { Test } from '@nestjs/testing';
import { PredictionHandler } from '../prediction.handler';
import { PredictionRepository } from '../../../repositories/prediction.repository';
import { PredictorRepository } from '../../../repositories/predictor.repository';
import { SignalRepository } from '../../../repositories/signal.repository';
import { SignalFingerprintRepository } from '../../../repositories/signal-fingerprint.repository';
import { TargetRepository } from '../../../repositories/target.repository';
import { SnapshotService } from '../../../services/snapshot.service';
import { PredictionGenerationService } from '../../../services/prediction-generation.service';
import { UserPositionService } from '../../../services/user-position.service';
import type {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { Prediction } from '../../../interfaces/prediction.interface';

describe('PredictionHandler', () => {
  let handler: PredictionHandler;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let predictorRepository: jest.Mocked<PredictorRepository>;
  let signalRepository: jest.Mocked<SignalRepository>;
  let signalFingerprintRepository: jest.Mocked<SignalFingerprintRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let snapshotService: jest.Mocked<SnapshotService>;
  let predictionGenerationService: jest.Mocked<PredictionGenerationService>;
  let userPositionService: jest.Mocked<UserPositionService>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: undefined as unknown as string, // Set to undefined to avoid universe filtering in tests
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  } as const;

  const mockPrediction: Prediction = {
    id: 'pred-1',
    target_id: 'target-1',
    task_id: 'task-1',
    direction: 'up',
    confidence: 0.75,
    magnitude: 'medium',
    reasoning: 'Strong technical indicators',
    timeframe_hours: 24,
    predicted_at: '2024-01-15T09:00:00Z',
    expires_at: '2024-01-16T09:00:00Z',
    entry_price: 185.5,
    target_price: 190.0,
    stop_loss: 182.0,
    analyst_ensemble: { 'technical-tina': 0.6, 'sentiment-sally': 0.4 },
    llm_ensemble: { claude: 0.5, gpt: 0.5 },
    status: 'active',
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
    is_test_data: false,
  };

  const mockTarget = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc',
    target_type: 'stock' as const,
    context: 'Tech company',
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-15T00:00:00Z',
    llm_config_override: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockPredictor = {
    id: 'predictor-1',
    signal_id: 'signal-1',
    target_id: 'target-1',
    analyst_slug: 'technical-tina',
    direction: 'bullish' as const,
    strength: 0.8,
    confidence: 0.75,
    reasoning: 'Strong momentum',
    analyst_assessment: {
      direction: 'bullish' as const,
      confidence: 0.75,
      reasoning: 'Strong momentum',
      key_factors: ['momentum', 'volume'],
      risks: ['market volatility'],
    },
    llm_usage_id: null,
    status: 'active' as const,
    consumed_at: null,
    consumed_by_prediction_id: null,
    expires_at: '2024-01-16T09:00:00Z',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
  };

  const mockSignal = {
    id: 'signal-1',
    source_id: 'source-1',
    target_id: 'target-1',
    content: 'Bullish signal detected',
    direction: 'bullish' as const,
    urgency: 'notable' as const,
    url: 'https://example.com/article',
    detected_at: '2024-01-15T08:00:00Z',
    metadata: {},
    disposition: 'pending' as const,
    processing_worker: null,
    processing_started_at: null,
    evaluation_result: null,
    review_queue_id: null,
    expired_at: null,
    is_test: false,
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z',
  };

  const mockSnapshot = {
    id: 'snapshot-1',
    prediction_id: 'pred-1',
    captured_at: '2024-01-15T09:00:00Z',
    predictors: [
      {
        predictor_id: 'predictor-1',
        direction: 'up',
        strength: 0.8,
        confidence: 0.75,
        signal_content: 'Strong momentum',
        analyst_slug: 'technical-tina',
        created_at: '2024-01-15T09:00:00Z',
      },
    ],
    rejected_signals: [],
    analyst_assessments: [
      {
        analyst: {
          analyst_id: 'analyst-1',
          slug: 'technical-tina',
          name: 'Technical Tina',
          perspective: 'Technical analysis focused on price action',
          effective_weight: 1.0,
          effective_tier: 'gold' as const,
          tier_instructions: { gold: 'Provide detailed technical analysis' },
          learned_patterns: [],
          scope_level: 'runner' as const,
        },
        tier: 'gold' as const,
        direction: 'up',
        confidence: 0.75,
        reasoning: 'Strong technical indicators',
        key_factors: ['momentum', 'volume'],
        risks: ['market volatility'],
        learnings_applied: [],
      },
    ],
    llm_ensemble: {
      tiers_used: ['gold'],
      tier_results: {},
      agreement_level: 0.9,
    },
    learnings_applied: [],
    threshold_evaluation: {
      min_predictors: 1,
      actual_predictors: 1,
      min_combined_strength: 0.5,
      actual_combined_strength: 0.8,
      min_consensus: 0.6,
      actual_consensus: 0.75,
      passed: true,
    },
    timeline: [],
    created_at: '2024-01-15T09:00:00Z',
  };

  const mockPortfolio = {
    id: 'portfolio-1',
    user_id: 'test-user',
    org_slug: 'test-org',
    initial_balance: 10000,
    current_balance: 10500,
    total_realized_pnl: 500,
    total_unrealized_pnl: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockPosition = {
    id: 'position-1',
    portfolio_id: 'portfolio-1',
    prediction_id: 'pred-1',
    target_id: 'target-1',
    symbol: 'AAPL',
    direction: 'long' as const,
    quantity: 10,
    entry_price: 150.0,
    current_price: 155.0,
    unrealized_pnl: 50,
    status: 'open' as const,
    opened_at: '2024-01-15T09:00:00Z',
    closed_at: undefined,
    exit_price: undefined,
    realized_pnl: undefined,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
  };

  beforeEach(async () => {
    const mockPredictionRepository = {
      findById: jest.fn(),
      findByTarget: jest.fn(),
      findByUniverse: jest.fn(),
      findActivePredictions: jest.fn(),
    };

    const mockPredictorRepository = {
      findById: jest.fn(),
      findByPredictionId: jest.fn(),
      findActiveByTarget: jest.fn(),
    };

    const mockSignalRepository = {
      findById: jest.fn(),
    };

    const mockSignalFingerprintRepository = {
      findBySignalId: jest.fn(),
    };

    const mockFromTargets = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ id: 'target-1', universe_id: 'universe-1' }],
      }),
    };

    const mockFromUniverses = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [{ id: 'universe-1' }],
      }),
    };

    const mockSupabaseClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'targets') return mockFromTargets;
        if (table === 'universes') return mockFromUniverses;
        return mockFromUniverses; // default
      }),
    };

    const mockTargetRepository = {
      findById: jest.fn(),
      findActiveByUniverse: jest.fn(),
      supabaseService: {
        getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
      },
    };

    const mockSnapshotService = {
      getSnapshot: jest.fn(),
    };

    const mockPredictionGenerationService = {
      attemptPredictionGeneration: jest.fn(),
    };

    const mockUserPositionService = {
      createPositionFromPrediction: jest.fn(),
      calculateRecommendedSize: jest.fn(),
      getPortfolioSummary: jest.fn(),
      getOrCreatePortfolio: jest.fn(),
      getClosedPositions: jest.fn(),
      closePosition: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PredictionHandler,
        {
          provide: PredictionRepository,
          useValue: mockPredictionRepository,
        },
        {
          provide: PredictorRepository,
          useValue: mockPredictorRepository,
        },
        {
          provide: SignalRepository,
          useValue: mockSignalRepository,
        },
        {
          provide: SignalFingerprintRepository,
          useValue: mockSignalFingerprintRepository,
        },
        {
          provide: TargetRepository,
          useValue: mockTargetRepository,
        },
        {
          provide: SnapshotService,
          useValue: mockSnapshotService,
        },
        {
          provide: PredictionGenerationService,
          useValue: mockPredictionGenerationService,
        },
        {
          provide: UserPositionService,
          useValue: mockUserPositionService,
        },
      ],
    }).compile();

    handler = moduleRef.get<PredictionHandler>(PredictionHandler);
    predictionRepository = moduleRef.get(PredictionRepository);
    predictorRepository = moduleRef.get(PredictorRepository);
    signalRepository = moduleRef.get(SignalRepository);
    signalFingerprintRepository = moduleRef.get(SignalFingerprintRepository);
    targetRepository = moduleRef.get(TargetRepository);
    snapshotService = moduleRef.get(SnapshotService);
    predictionGenerationService = moduleRef.get(PredictionGenerationService);
    userPositionService = moduleRef.get(UserPositionService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('getSnapshot');
      expect(actions).toContain('getDeepDive');
      expect(actions).toContain('compare');
      expect(actions).toContain('generate');
      expect(actions).toContain('use');
      expect(actions).toContain('calculateSize');
      expect(actions).toContain('portfolio');
      expect(actions).toContain('closedPositions');
      expect(actions).toContain('closePosition');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'invalid',
        params: {},
      };
      const result = await handler.execute('invalid', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('execute - list action', () => {
    it('should list active predictions by default', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([
        mockPrediction,
      ]);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findActivePredictions).toHaveBeenCalled();
    });

    it('should list predictions by target', async () => {
      predictionRepository.findByTarget.mockResolvedValue([mockPrediction]);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findByTarget).toHaveBeenCalledWith(
        'target-1',
        undefined,
        { includeTestData: false },
      );
    });

    it('should list predictions by universe', async () => {
      predictionRepository.findByUniverse.mockResolvedValue([mockPrediction]);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { universeId: 'universe-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findByUniverse).toHaveBeenCalledWith(
        'universe-1',
        undefined,
        { includeTestData: false },
      );
    });

    it('should filter by status', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([
        mockPrediction,
      ]);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { status: 'active' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findActivePredictions).toHaveBeenCalled();
    });

    it('should filter by direction', async () => {
      const predictions = [
        { ...mockPrediction, direction: 'up' as const },
        { ...mockPrediction, id: 'pred-2', direction: 'down' as const },
      ];
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { direction: 'up' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { direction: string }[];
      expect(data.every((p) => p.direction === 'up')).toBe(true);
    });

    it('should filter by fromDate', async () => {
      const predictions = [
        { ...mockPrediction, predicted_at: '2024-01-20T09:00:00Z' },
        {
          ...mockPrediction,
          id: 'pred-2',
          predicted_at: '2024-01-05T09:00:00Z',
        },
      ];
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { fromDate: '2024-01-15' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should filter by toDate', async () => {
      const predictions = [
        { ...mockPrediction, predicted_at: '2024-01-10T09:00:00Z' },
        {
          ...mockPrediction,
          id: 'pred-2',
          predicted_at: '2024-01-25T09:00:00Z',
        },
      ];
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { toDate: '2024-01-15' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should filter by outcome - pending', async () => {
      const predictions = [
        { ...mockPrediction, outcome_value: null },
        { ...mockPrediction, id: 'pred-2', outcome_value: 5.0 },
      ];
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { outcome: 'pending' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should filter by outcome - correct', async () => {
      const predictions = [
        {
          ...mockPrediction,
          direction: 'up' as const,
          outcome_value: 5.0,
        },
        {
          ...mockPrediction,
          id: 'pred-2',
          direction: 'up' as const,
          outcome_value: -5.0,
        },
      ];
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
        filters: { outcome: 'correct' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should paginate results', async () => {
      const predictions = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockPrediction, id: `pred-${i}` }));
      predictionRepository.findActivePredictions.mockResolvedValue(predictions);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
    });

    it('should include snapshots if requested', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([
        mockPrediction,
      ]);
      targetRepository.findById.mockResolvedValue(mockTarget);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { includeSnapshot: true },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(snapshotService.getSnapshot).toHaveBeenCalledWith('pred-1');
    });

    it('should handle list service error', async () => {
      predictionRepository.findActivePredictions.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
    });
  });

  describe('execute - get action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get prediction by id', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findById).toHaveBeenCalledWith('pred-1');
      const data = result.data as { id: string };
      expect(data.id).toBe('pred-1');
    });

    it('should include snapshot if requested', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'pred-1', includeSnapshot: true },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(snapshotService.getSnapshot).toHaveBeenCalledWith('pred-1');
    });

    it('should return NOT_FOUND error if prediction does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - getSnapshot action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'getSnapshot',
        params: {},
      };
      const result = await handler.execute('getSnapshot', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get snapshot by prediction id', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'getSnapshot',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('getSnapshot', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findById).toHaveBeenCalledWith('pred-1');
      expect(snapshotService.getSnapshot).toHaveBeenCalledWith('pred-1');
      const data = result.data as { predictionId: string };
      expect(data.predictionId).toBe('pred-1');
    });

    it('should handle get-snapshot alias', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'get-snapshot',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute(
        'get-snapshot',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should handle snapshot alias', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'snapshot',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('snapshot', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should return NOT_FOUND error if prediction does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'getSnapshot',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('getSnapshot', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return SNAPSHOT_NOT_FOUND error if snapshot does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'getSnapshot',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('getSnapshot', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SNAPSHOT_NOT_FOUND');
    });

    it('should handle getSnapshot service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'getSnapshot',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('getSnapshot', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SNAPSHOT_FAILED');
    });
  });

  describe('execute - getDeepDive action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'getDeepDive',
        params: {},
      };
      const result = await handler.execute('getDeepDive', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get deep dive by prediction id', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
      predictorRepository.findById.mockResolvedValue(mockPredictor);
      signalRepository.findById.mockResolvedValue(mockSignal);
      signalFingerprintRepository.findBySignalId.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'getDeepDive',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('getDeepDive', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findById).toHaveBeenCalledWith('pred-1');
      expect(snapshotService.getSnapshot).toHaveBeenCalledWith('pred-1');
      const data = result.data as {
        prediction: { id: string };
        lineage: unknown;
      };
      expect(data.prediction.id).toBe('pred-1');
      expect(data.lineage).toBeDefined();
    });

    it('should handle get-deep-dive alias', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
      predictorRepository.findById.mockResolvedValue(mockPredictor);
      signalRepository.findById.mockResolvedValue(mockSignal);

      const payload: DashboardRequestPayload = {
        action: 'get-deep-dive',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute(
        'get-deep-dive',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should return NOT_FOUND error if prediction does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'getDeepDive',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('getDeepDive', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle getDeepDive service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'getDeepDive',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('getDeepDive', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEEPDIVE_FAILED');
    });
  });

  describe('execute - compare action', () => {
    it('should return error if less than 2 ids provided', async () => {
      const payload: DashboardRequestPayload = {
        action: 'compare',
        params: { ids: ['pred-1'] },
      };
      const result = await handler.execute('compare', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_IDS');
    });

    it('should return error if more than 10 ids provided', async () => {
      const ids = Array(11)
        .fill(null)
        .map((_, i) => `pred-${i}`);
      const payload: DashboardRequestPayload = {
        action: 'compare',
        params: { ids },
      };
      const result = await handler.execute('compare', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOO_MANY_IDS');
    });

    it('should compare predictions successfully', async () => {
      const prediction1 = mockPrediction;
      const prediction2 = {
        ...mockPrediction,
        id: 'pred-2',
        direction: 'down' as const,
      };
      predictionRepository.findById
        .mockResolvedValueOnce(prediction1)
        .mockResolvedValueOnce(prediction2);
      snapshotService.getSnapshot
        .mockResolvedValueOnce(mockSnapshot)
        .mockResolvedValueOnce(mockSnapshot);
      predictorRepository.findById.mockResolvedValue(mockPredictor);

      const payload: DashboardRequestPayload = {
        action: 'compare',
        params: { ids: ['pred-1', 'pred-2'] },
      };
      const result = await handler.execute('compare', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        predictions: unknown[];
        comparison: { totalCompared: number };
      };
      expect(data.predictions).toHaveLength(2);
      expect(data.comparison.totalCompared).toBe(2);
    });

    it('should return error if less than 2 valid predictions found', async () => {
      predictionRepository.findById
        .mockResolvedValueOnce(mockPrediction)
        .mockResolvedValueOnce(null);

      const payload: DashboardRequestPayload = {
        action: 'compare',
        params: { ids: ['pred-1', 'pred-2'] },
      };
      const result = await handler.execute('compare', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_PREDICTIONS');
    });

    it('should handle compare service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'compare',
        params: { ids: ['pred-1', 'pred-2'] },
      };
      const result = await handler.execute('compare', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COMPARE_FAILED');
    });
  });

  describe('execute - generate action', () => {
    it('should return error if targetId and universeId are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: {},
      };
      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('should generate prediction for target', async () => {
      targetRepository.findById.mockResolvedValue(mockTarget);
      predictorRepository.findActiveByTarget.mockResolvedValue([mockPredictor]);
      predictionGenerationService.attemptPredictionGeneration.mockResolvedValue(
        mockPrediction,
      );

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findById).toHaveBeenCalledWith('target-1');
      expect(
        predictionGenerationService.attemptPredictionGeneration,
      ).toHaveBeenCalled();
      const data = result.data as { generated: number };
      expect(data.generated).toBe(1);
    });

    it('should generate predictions for universe', async () => {
      targetRepository.findActiveByUniverse.mockResolvedValue([mockTarget]);
      predictorRepository.findActiveByTarget.mockResolvedValue([mockPredictor]);
      predictionGenerationService.attemptPredictionGeneration.mockResolvedValue(
        mockPrediction,
      );

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
        'universe-1',
      );
      const data = result.data as { generated: number };
      expect(data.generated).toBe(1);
    });

    it('should return NOT_FOUND error if target does not exist', async () => {
      targetRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: { targetId: 'non-existent' },
      };
      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle generate service error', async () => {
      targetRepository.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'generate',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('generate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GENERATE_FAILED');
    });
  });

  describe('execute - use action', () => {
    it('should return error if predictionId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'use',
        params: { quantity: 10 },
      };
      const result = await handler.execute('use', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PREDICTION_ID');
    });

    it('should return error if quantity is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'use',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('use', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUANTITY');
    });

    it('should return error if quantity is not positive', async () => {
      const payload: DashboardRequestPayload = {
        action: 'use',
        params: { id: 'pred-1', quantity: 0 },
      };
      const result = await handler.execute('use', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_QUANTITY');
    });

    it('should create position from prediction', async () => {
      userPositionService.createPositionFromPrediction.mockResolvedValue({
        position: mockPosition,
        portfolio: mockPortfolio,
        prediction: mockPrediction,
      });

      const payload: DashboardRequestPayload = {
        action: 'use',
        params: { id: 'pred-1', quantity: 10 },
      };
      const result = await handler.execute('use', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        userPositionService.createPositionFromPrediction,
      ).toHaveBeenCalledWith({
        userId: 'test-user',
        orgSlug: 'test-org',
        predictionId: 'pred-1',
        quantity: 10,
        entryPrice: undefined,
      });
    });

    it('should handle use service error', async () => {
      userPositionService.createPositionFromPrediction.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'use',
        params: { id: 'pred-1', quantity: 10 },
      };
      const result = await handler.execute('use', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('USE_FAILED');
    });
  });

  describe('execute - calculateSize action', () => {
    it('should return error if predictionId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'calculateSize',
        params: {},
      };
      const result = await handler.execute(
        'calculateSize',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PREDICTION_ID');
    });

    it('should calculate position size', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      targetRepository.findById.mockResolvedValue(mockTarget);
      userPositionService.getOrCreatePortfolio.mockResolvedValue(mockPortfolio);
      userPositionService.calculateRecommendedSize.mockResolvedValue({
        recommendedQuantity: 10,
        riskAmount: 100,
        entryPrice: 150.0,
        stopPrice: 145.0,
        targetPrice: 160.0,
        potentialProfit: 100,
        potentialLoss: 50,
        riskRewardRatio: 2,
        reasoning: 'Based on confidence and portfolio risk',
      });

      const payload: DashboardRequestPayload = {
        action: 'calculateSize',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute(
        'calculateSize',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(userPositionService.calculateRecommendedSize).toHaveBeenCalled();
      const data = result.data as { recommendedQuantity: number };
      expect(data.recommendedQuantity).toBe(10);
    });

    it('should handle calculate-size alias', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      targetRepository.findById.mockResolvedValue(mockTarget);
      userPositionService.getOrCreatePortfolio.mockResolvedValue(mockPortfolio);
      userPositionService.calculateRecommendedSize.mockResolvedValue({
        recommendedQuantity: 10,
        riskAmount: 100,
        entryPrice: 150.0,
        stopPrice: 145.0,
        targetPrice: 160.0,
        potentialProfit: 100,
        potentialLoss: 50,
        riskRewardRatio: 2,
        reasoning: 'Based on confidence and portfolio risk',
      });

      const payload: DashboardRequestPayload = {
        action: 'calculate-size',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute(
        'calculate-size',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should return NOT_FOUND error if prediction does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'calculateSize',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute(
        'calculateSize',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle calculateSize service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'calculateSize',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute(
        'calculateSize',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CALCULATE_SIZE_FAILED');
    });
  });

  describe('execute - portfolio action', () => {
    it('should get portfolio summary', async () => {
      userPositionService.getPortfolioSummary.mockResolvedValue({
        portfolio: mockPortfolio,
        openPositions: [mockPosition],
        totalUnrealizedPnl: 50,
        totalRealizedPnl: 500,
        winRate: 0.6,
        totalTrades: 10,
        wins: 6,
        losses: 4,
      });

      const payload: DashboardRequestPayload = {
        action: 'portfolio',
        params: {},
      };
      const result = await handler.execute('portfolio', payload, mockContext);

      expect(result.success).toBe(true);
      expect(userPositionService.getPortfolioSummary).toHaveBeenCalledWith(
        'test-user',
        'test-org',
      );
    });

    it('should create new portfolio if none exists', async () => {
      userPositionService.getPortfolioSummary.mockResolvedValue({
        portfolio: null,
        openPositions: [],
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
        winRate: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
      });
      userPositionService.getOrCreatePortfolio.mockResolvedValue(mockPortfolio);

      const payload: DashboardRequestPayload = {
        action: 'portfolio',
        params: {},
      };
      const result = await handler.execute('portfolio', payload, mockContext);

      expect(result.success).toBe(true);
      expect(userPositionService.getOrCreatePortfolio).toHaveBeenCalledWith(
        'test-user',
        'test-org',
      );
    });

    it('should handle portfolio service error', async () => {
      userPositionService.getPortfolioSummary.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'portfolio',
        params: {},
      };
      const result = await handler.execute('portfolio', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PORTFOLIO_FAILED');
    });
  });

  describe('execute - closedPositions action', () => {
    it('should get closed positions', async () => {
      const closedPosition = {
        ...mockPosition,
        status: 'closed' as const,
        closed_at: '2024-01-16T09:00:00Z',
        exit_price: 155.0,
        realized_pnl: 50,
      };
      userPositionService.getClosedPositions.mockResolvedValue({
        positions: [closedPosition],
        statistics: {
          totalClosed: 1,
          wins: 1,
          losses: 0,
          totalPnl: 50,
          avgPnl: 50,
          winRate: 1.0,
        },
      });

      const payload: DashboardRequestPayload = {
        action: 'closedPositions',
        params: {},
      };
      const result = await handler.execute(
        'closedPositions',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(userPositionService.getClosedPositions).toHaveBeenCalledWith(
        'test-user',
        'test-org',
        {
          startDate: undefined,
          endDate: undefined,
          symbol: undefined,
          limit: undefined,
        },
      );
    });

    it('should handle closed-positions alias', async () => {
      userPositionService.getClosedPositions.mockResolvedValue({
        positions: [],
        statistics: {
          totalClosed: 0,
          wins: 0,
          losses: 0,
          totalPnl: 0,
          avgPnl: 0,
          winRate: 0,
        },
      });

      const payload: DashboardRequestPayload = {
        action: 'closed-positions',
        params: {},
      };
      const result = await handler.execute(
        'closed-positions',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should apply filters', async () => {
      userPositionService.getClosedPositions.mockResolvedValue({
        positions: [],
        statistics: {
          totalClosed: 0,
          wins: 0,
          losses: 0,
          totalPnl: 0,
          avgPnl: 0,
          winRate: 0,
        },
      });

      const payload: DashboardRequestPayload = {
        action: 'closedPositions',
        params: {
          filters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            symbol: 'AAPL',
            limit: 10,
          },
        },
      };
      const result = await handler.execute(
        'closedPositions',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(userPositionService.getClosedPositions).toHaveBeenCalledWith(
        'test-user',
        'test-org',
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          symbol: 'AAPL',
          limit: 10,
        },
      );
    });

    it('should handle closedPositions service error', async () => {
      userPositionService.getClosedPositions.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'closedPositions',
        params: {},
      };
      const result = await handler.execute(
        'closedPositions',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CLOSED_POSITIONS_FAILED');
    });
  });

  describe('execute - closePosition action', () => {
    it('should return error if positionId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'closePosition',
        params: { exitPrice: 155.0 },
      };
      const result = await handler.execute(
        'closePosition',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_POSITION_ID');
    });

    it('should return error if exitPrice is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'closePosition',
        params: { id: 'position-1' },
      };
      const result = await handler.execute(
        'closePosition',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_EXIT_PRICE');
    });

    it('should close position', async () => {
      userPositionService.closePosition.mockResolvedValue({
        realizedPnl: 50,
        isWin: true,
      });

      const payload: DashboardRequestPayload = {
        action: 'closePosition',
        params: { id: 'position-1', exitPrice: 155.0 },
      };
      const result = await handler.execute(
        'closePosition',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(userPositionService.closePosition).toHaveBeenCalledWith(
        'position-1',
        155.0,
      );
      const data = result.data as { realizedPnl: number; isWin: boolean };
      expect(data.realizedPnl).toBe(50);
      expect(data.isWin).toBe(true);
    });

    it('should handle close-position alias', async () => {
      userPositionService.closePosition.mockResolvedValue({
        realizedPnl: 50,
        isWin: true,
      });

      const payload: DashboardRequestPayload = {
        action: 'close-position',
        params: { id: 'position-1', exitPrice: 155.0 },
      };
      const result = await handler.execute(
        'close-position',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should handle closePosition service error', async () => {
      userPositionService.closePosition.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'closePosition',
        params: { id: 'position-1', exitPrice: 155.0 },
      };
      const result = await handler.execute(
        'closePosition',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CLOSE_POSITION_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([]);
      targetRepository.findById.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase compound action names', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const payload: DashboardRequestPayload = {
        action: 'GETSNAPSHOT',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('GETSNAPSHOT', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
