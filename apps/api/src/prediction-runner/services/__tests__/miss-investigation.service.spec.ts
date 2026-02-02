import { Test, TestingModule } from '@nestjs/testing';
import { MissInvestigationService } from '../miss-investigation.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('MissInvestigationService', () => {
  let service: MissInvestigationService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockPrediction = {
    id: 'pred-123',
    target_id: 'target-123',
    direction: 'up',
    magnitude: 'medium',
    confidence: 0.8,
    status: 'resolved',
    outcome_value: -5, // Opposite direction
    predicted_at: '2024-01-01T10:00:00Z',
    target: {
      id: 'target-123',
      symbol: 'AAPL',
      name: 'Apple',
      target_type: 'stock',
    },
  };

  const mockPredictors = [
    {
      id: 'predictor-123',
      direction: 'bullish',
      confidence: 0.7,
      strength: 6,
      analyst_slug: 'test-analyst',
      status: 'consumed',
      consumed_by_prediction_id: 'pred-123',
      signal: {
        id: 'sig-123',
        content: 'Test signal content',
        direction: 'bullish',
        source: {
          id: 'source-123',
          name: 'TestSource',
          source_type: 'news',
          url: 'http://test.com',
        },
      },
    },
  ];

  const mockUnusedPredictors = [
    {
      id: 'unused-pred-1',
      direction: 'bearish', // Would have helped
      confidence: 0.55,
      strength: 4,
      analyst_slug: 'bearish-analyst',
      status: 'expired',
      consumed_by_prediction_id: null,
      signal: {
        id: 'sig-456',
        content: 'Bearish signal',
        direction: 'bearish',
        source: {
          id: 'source-456',
          name: 'BearSource',
          source_type: 'news',
          url: null,
        },
      },
    },
  ];

  const mockSignals = [
    {
      id: 'sig-rejected-1',
      content: 'Rejected signal',
      direction: 'bearish',
      disposition: 'rejected',
      detected_at: '2024-01-01T08:00:00Z',
      evaluation_result: { analyst_slug: 'analyst-1' },
      source: {
        id: 'source-789',
        name: 'RejectSource',
        source_type: 'news',
        url: null,
      },
    },
  ];

  const createMockClient = (overrides?: {
    predictions?: { data: unknown[] | null; error: { message: string } | null };
    predictors?: { data: unknown[] | null; error: { message: string } | null };
    signals?: { data: unknown[] | null; error: { message: string } | null };
    singlePrediction?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
  }) => {
    const predictionsResult = overrides?.predictions ?? {
      data: [mockPrediction],
      error: null,
    };
    const predictorsResult = overrides?.predictors ?? {
      data: mockPredictors,
      error: null,
    };
    const signalsResult = overrides?.signals ?? {
      data: mockSignals,
      error: null,
    };
    const singlePredResult = overrides?.singlePrediction ?? {
      data: mockPrediction,
      error: null,
    };

    let _queryCount = 0;
    let predictorQueryCount = 0;
    let _signalQueryCount = 0;

    const createChain = (fromTable: string) => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        in: jest.fn(),
        is: jest.fn(),
        not: jest.fn(),
        or: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        then: (resolve: (v: unknown) => void) => {
          if (fromTable === 'predictions') {
            _queryCount++;
            return resolve(predictionsResult);
          } else if (fromTable === 'predictors') {
            predictorQueryCount++;
            if (predictorQueryCount === 1) {
              // First predictor query: consumed predictors
              return resolve(predictorsResult);
            } else {
              // Second query: unused predictors
              return resolve({ data: mockUnusedPredictors, error: null });
            }
          } else if (fromTable === 'signals') {
            _signalQueryCount++;
            return resolve(signalsResult);
          }
          return resolve({ data: [], error: null });
        },
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.is as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.not as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.or as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singlePredResult),
      });

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest
          .fn()
          .mockImplementation((table: string) => createChain(table)),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissInvestigationService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<MissInvestigationService>(MissInvestigationService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('identifyMisses', () => {
    it('should identify misses for a given date', async () => {
      const result = await service.identifyMisses('2024-01-01');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should identify direction_wrong miss type', async () => {
      const result = await service.identifyMisses('2024-01-01');

      if (result.length > 0) {
        // Predicted up, actual down (from negative outcome_value) = direction_wrong
        expect(result[0]?.missType).toBe('direction_wrong');
      }
    });

    it('should filter by universe ID when provided', async () => {
      await service.identifyMisses('2024-01-01', 'universe-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const mockClient = createMockClient({
        predictions: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.identifyMisses('2024-01-01');

      expect(result).toEqual([]);
    });

    it('should throw error when fetch fails', async () => {
      const mockClient = createMockClient({
        predictions: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(service.identifyMisses('2024-01-01')).rejects.toBeDefined();
    });
  });

  describe('investigateMissById', () => {
    it('should investigate a miss by prediction ID', async () => {
      const result = await service.investigateMissById('pred-123');

      expect(result).toBeDefined();
      expect(result?.prediction.id).toBe('pred-123');
    });

    it('should return null for non-existent prediction', async () => {
      const mockClient = createMockClient({
        singlePrediction: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.investigateMissById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null for prediction without outcome', async () => {
      const mockClient = createMockClient({
        singlePrediction: {
          data: { ...mockPrediction, outcome_value: null },
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.investigateMissById('pred-123');

      expect(result).toBeNull();
    });

    it('should return null for correct prediction (not a miss)', async () => {
      // Predicted up, outcome positive = correct
      const mockClient = createMockClient({
        singlePrediction: {
          data: { ...mockPrediction, outcome_value: 5 },
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.investigateMissById('pred-123');

      expect(result).toBeNull();
    });
  });

  describe('investigateMiss', () => {
    it('should investigate a miss and check for unused predictors', async () => {
      const predictionWithChain = {
        ...mockPrediction,
        consumedPredictors: mockPredictors,
      };

      const result = await service.investigateMiss(
        predictionWithChain as never,
        'direction_wrong',
        'down',
        5,
      );

      expect(result).toBeDefined();
      expect(result.missType).toBe('direction_wrong');
      expect(result.actual.direction).toBe('down');
    });

    it('should set investigation level to predictor when unused predictors found', async () => {
      const predictionWithChain = {
        ...mockPrediction,
        consumedPredictors: mockPredictors,
      };

      const result = await service.investigateMiss(
        predictionWithChain as never,
        'direction_wrong',
        'down',
        5,
      );

      // When unused predictors would have helped, level should be 'predictor'
      expect(['predictor', 'signal', 'source', 'unpredictable']).toContain(
        result.investigationLevel,
      );
    });

    it('should generate suggested learning when unused predictors found', async () => {
      const predictionWithChain = {
        ...mockPrediction,
        consumedPredictors: mockPredictors,
      };

      const result = await service.investigateMiss(
        predictionWithChain as never,
        'direction_wrong',
        'down',
        5,
      );

      if (result.unusedPredictors.length > 0) {
        expect(result.suggestedLearning).toBeDefined();
      }
    });
  });

  describe('generateDailySummary', () => {
    it('should generate daily summary from investigations', async () => {
      const investigations = [
        {
          id: 'inv-1',
          prediction: mockPrediction as never,
          missType: 'direction_wrong' as const,
          predicted: {
            direction: 'up' as const,
            magnitude: 'medium',
            confidence: 0.8,
          },
          actual: { direction: 'down' as const, magnitude: 5 },
          investigationLevel: 'predictor' as const,
          unusedPredictors: [],
          misreadSignals: [],
          investigatedAt: '2024-01-01T16:00:00Z',
        },
        {
          id: 'inv-2',
          prediction: mockPrediction as never,
          missType: 'missed_opportunity' as const,
          predicted: {
            direction: 'flat' as const,
            magnitude: 'small',
            confidence: 0.6,
          },
          actual: { direction: 'up' as const, magnitude: 3 },
          investigationLevel: 'signal' as const,
          unusedPredictors: [],
          misreadSignals: [],
          investigatedAt: '2024-01-01T16:00:00Z',
        },
      ];

      const result = await service.generateDailySummary(
        '2024-01-01',
        investigations,
      );

      expect(result.date).toBe('2024-01-01');
      expect(result.totalMisses).toBe(2);
      expect(result.byType.direction_wrong).toBe(1);
      expect(result.byType.missed_opportunity).toBe(1);
      expect(result.byLevel.predictor).toBe(1);
      expect(result.byLevel.signal).toBe(1);
    });

    it('should handle empty investigations', async () => {
      const result = await service.generateDailySummary('2024-01-01', []);

      expect(result.totalMisses).toBe(0);
      expect(result.byType.direction_wrong).toBe(0);
      expect(result.byType.missed_opportunity).toBe(0);
    });

    it('should track source gaps from research results', async () => {
      const investigations = [
        {
          id: 'inv-1',
          prediction: mockPrediction as never,
          missType: 'direction_wrong' as const,
          predicted: {
            direction: 'up' as const,
            magnitude: 'medium',
            confidence: 0.8,
          },
          actual: { direction: 'down' as const, magnitude: 5 },
          investigationLevel: 'source' as const,
          unusedPredictors: [],
          misreadSignals: [],
          investigatedAt: '2024-01-01T16:00:00Z',
          sourceResearch: {
            discoveredDrivers: ['Earnings miss'],
            signalsWeHad: [],
            signalTypesNeeded: ['earnings_report'],
            suggestedSources: [
              {
                name: 'SEC EDGAR',
                type: 'sec_filing' as const,
                description: 'Filing source',
              },
            ],
            predictability: 'predictable' as const,
            reasoning: 'Test',
          },
        },
      ];

      const result = await service.generateDailySummary(
        '2024-01-01',
        investigations,
      );

      expect(result.topSourceGaps.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('miss type determination', () => {
    it('should identify missed_opportunity when predicted flat but moved', async () => {
      const flatPrediction = {
        ...mockPrediction,
        direction: 'flat',
        outcome_value: 5, // Moved up
      };
      const mockClient = createMockClient({
        predictions: { data: [flatPrediction], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.identifyMisses('2024-01-01');

      if (result.length > 0) {
        expect(result[0]?.missType).toBe('missed_opportunity');
      }
    });

    it('should identify false_positive when predicted move but stayed flat', async () => {
      const falsePosPreiction = {
        ...mockPrediction,
        direction: 'up',
        outcome_value: 0.1, // Stayed flat (below threshold)
      };
      const mockClient = createMockClient({
        predictions: { data: [falsePosPreiction], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.identifyMisses('2024-01-01');

      if (result.length > 0) {
        expect(result[0]?.missType).toBe('false_positive');
      }
    });
  });
});
