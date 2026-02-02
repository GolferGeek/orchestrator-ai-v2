import { Test, TestingModule } from '@nestjs/testing';
import { BaselinePredictionService } from '../baseline-prediction.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { TargetSnapshotService } from '../target-snapshot.service';

describe('BaselinePredictionService', () => {
  let service: BaselinePredictionService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let targetSnapshotService: jest.Mocked<TargetSnapshotService>;

  // Mock Supabase query builder
  const createMockQueryBuilder = () => {
    const builder: Record<string, jest.Mock> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    return builder;
  };

  const mockTargets = [
    {
      id: 'target-1',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      universe_id: 'universe-1',
    },
    {
      id: 'target-2',
      symbol: 'GOOGL',
      name: 'Alphabet Inc.',
      universe_id: 'universe-1',
    },
    {
      id: 'target-3',
      symbol: 'MSFT',
      name: 'Microsoft Corp.',
      universe_id: 'universe-1',
    },
  ];

  const mockPrediction = {
    id: 'prediction-1',
    target_id: 'target-1',
    direction: 'flat',
    confidence: 0.5,
    magnitude: 'small',
    status: 'active',
    entry_price: 150.0,
    analyst_ensemble: { baseline: true },
  };

  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

  beforeEach(async () => {
    mockQueryBuilder = createMockQueryBuilder();

    const mockSupabaseClient = {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaselinePredictionService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: PredictionRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: TargetSnapshotService,
          useValue: {
            fetchAndCaptureValue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BaselinePredictionService>(BaselinePredictionService);
    supabaseService = module.get(SupabaseService);
    predictionRepository = module.get(PredictionRepository);
    targetSnapshotService = module.get(TargetSnapshotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isBaselinePrediction', () => {
    it('should return true for baseline predictions', () => {
      const prediction = {
        analyst_ensemble: { baseline: true },
      };

      expect(service.isBaselinePrediction(prediction)).toBe(true);
    });

    it('should return false for non-baseline predictions', () => {
      const prediction = {
        analyst_ensemble: { baseline: false },
      };

      expect(service.isBaselinePrediction(prediction)).toBe(false);
    });

    it('should return false when baseline property is missing', () => {
      const prediction = {
        analyst_ensemble: { some_other_prop: true },
      };

      expect(service.isBaselinePrediction(prediction)).toBe(false);
    });

    it('should return false when analyst_ensemble is undefined', () => {
      const prediction = {};

      expect(service.isBaselinePrediction(prediction)).toBe(false);
    });
  });

  describe('createBaselinePredictions', () => {
    it('should create baseline predictions for targets without predictions', async () => {
      // Setup mock responses for the chain of queries
      const mockClient = supabaseService.getServiceClient();

      // First call: get active targets
      const targetsQueryBuilder = createMockQueryBuilder();
      targetsQueryBuilder.eq = jest.fn().mockReturnThis();
      (targetsQueryBuilder as unknown as { then: jest.Mock }).then = jest
        .fn()
        .mockResolvedValue({ data: mockTargets, error: null });

      // Second call: get existing predictions
      const existingPredictionsBuilder = createMockQueryBuilder();
      (existingPredictionsBuilder as unknown as { then: jest.Mock }).then = jest
        .fn()
        .mockResolvedValue({
          data: [{ target_id: 'target-1' }], // target-1 already has a prediction
          error: null,
        });

      // Third call: get current price (snapshot)
      const snapshotBuilder = createMockQueryBuilder();
      snapshotBuilder.single = jest
        .fn()
        .mockResolvedValue({ data: { value: 150.0 }, error: null });

      let queryCount = 0;
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          queryCount++;
          if (table === 'targets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: mockTargets,
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'predictions' && queryCount <= 2) {
            return {
              select: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: [{ target_id: 'target-1' }],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'target_snapshots') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: { value: 150.0 },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      predictionRepository.create.mockResolvedValue(mockPrediction as never);

      const result = await service.createBaselinePredictions('2024-01-15');

      // Should create baselines for target-2 and target-3 (target-1 already has prediction)
      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.targets).toContain('GOOGL');
      expect(result.targets).toContain('MSFT');
    });

    it('should return empty results when no active targets exist', async () => {
      const mockClient = supabaseService.getServiceClient();
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      }));

      const result = await service.createBaselinePredictions('2024-01-15');

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.targets).toEqual([]);
    });

    it('should throw error when fetching targets fails', async () => {
      const mockClient = supabaseService.getServiceClient();
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      }));

      await expect(
        service.createBaselinePredictions('2024-01-15'),
      ).rejects.toEqual({ message: 'Database error' });
    });

    it('should skip targets without price data', async () => {
      const mockClient = supabaseService.getServiceClient();

      let queryCount = 0;
      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          queryCount++;
          if (table === 'targets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({
                    data: [mockTargets[0]], // Only one target
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'predictions') {
            return {
              select: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'target_snapshots') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                      single: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'No snapshot' },
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      const result = await service.createBaselinePredictions('2024-01-15');

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should filter by universeId when provided', async () => {
      const mockClient = supabaseService.getServiceClient();
      const eqMock = jest.fn().mockResolvedValue({
        data: mockTargets,
        error: null,
      });

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'targets') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockReturnValue({
                    eq: eqMock, // universe_id filter
                  }),
                }),
              }),
            };
          }
          if (table === 'predictions') {
            return {
              select: jest.fn().mockReturnValue({
                gte: jest.fn().mockReturnValue({
                  lte: jest.fn().mockResolvedValue({
                    data: mockTargets.map((t) => ({ target_id: t.id })), // All have predictions
                    error: null,
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      }));

      await service.createBaselinePredictions('2024-01-15', 'universe-1');

      // The universe_id filter should have been applied
      expect(eqMock).toHaveBeenCalled();
    });
  });

  describe('getBaselinePredictions', () => {
    it('should return baseline predictions for a date', async () => {
      const mockClient = supabaseService.getServiceClient();
      const baselinePredictions = [
        {
          id: 'pred-1',
          target_id: 'target-1',
          entry_price: 150.0,
          status: 'active',
          target: { symbol: 'AAPL', universe_id: 'universe-1' },
        },
        {
          id: 'pred-2',
          target_id: 'target-2',
          entry_price: 175.0,
          status: 'active',
          target: { symbol: 'GOOGL', universe_id: 'universe-1' },
        },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: baselinePredictions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselinePredictions('2024-01-15');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'pred-1',
        target_id: 'target-1',
        symbol: 'AAPL',
        entry_price: 150.0,
        status: 'active',
      });
    });

    it('should handle array target from Supabase join', async () => {
      const mockClient = supabaseService.getServiceClient();
      const baselinePredictions = [
        {
          id: 'pred-1',
          target_id: 'target-1',
          entry_price: 150.0,
          status: 'active',
          target: [{ symbol: 'AAPL', universe_id: 'universe-1' }], // Array format
        },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: baselinePredictions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselinePredictions('2024-01-15');

      expect(result[0]?.symbol).toBe('AAPL');
    });

    it('should return UNKNOWN for missing symbol', async () => {
      const mockClient = supabaseService.getServiceClient();
      const baselinePredictions = [
        {
          id: 'pred-1',
          target_id: 'target-1',
          entry_price: 150.0,
          status: 'active',
          target: null, // No target data
        },
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: baselinePredictions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselinePredictions('2024-01-15');

      expect(result[0]?.symbol).toBe('UNKNOWN');
    });

    it('should return empty array on error', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Query failed' },
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselinePredictions('2024-01-15');

      expect(result).toEqual([]);
    });

    it('should filter by universeId when provided', async () => {
      const mockClient = supabaseService.getServiceClient();
      const eqMock = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockReturnValue({
                    eq: eqMock, // universe_id filter
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      await service.getBaselinePredictions('2024-01-15', 'universe-1');

      expect(eqMock).toHaveBeenCalled();
    });
  });

  describe('getBaselineStats', () => {
    it('should return statistics for baseline predictions', async () => {
      const mockClient = supabaseService.getServiceClient();
      const mockPredictions = [
        {
          id: 'pred-1',
          status: 'resolved',
          outcome_value: 0.3,
          direction: 'flat',
        }, // Correct flat (under 0.5%)
        {
          id: 'pred-2',
          status: 'resolved',
          outcome_value: 2.5,
          direction: 'flat',
        }, // Missed opportunity (over 0.5%)
        {
          id: 'pred-3',
          status: 'resolved',
          outcome_value: -1.5,
          direction: 'flat',
        }, // Missed opportunity
        {
          id: 'pred-4',
          status: 'active',
          outcome_value: null,
          direction: 'flat',
        }, // Still active
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: mockPredictions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselineStats('2024-01-01', '2024-01-31');

      expect(result.totalBaselines).toBe(4);
      expect(result.resolvedBaselines).toBe(3);
      expect(result.missedOpportunities).toBe(2); // 2.5% and -1.5% are > 0.5%
      expect(result.correctFlat).toBe(1); // 0.3% is <= 0.5%
    });

    it('should return zeros on error', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Query failed' },
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselineStats('2024-01-01', '2024-01-31');

      expect(result).toEqual({
        totalBaselines: 0,
        resolvedBaselines: 0,
        missedOpportunities: 0,
        correctFlat: 0,
      });
    });

    it('should handle null data gracefully', async () => {
      const mockClient = supabaseService.getServiceClient();

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselineStats('2024-01-01', '2024-01-31');

      expect(result.totalBaselines).toBe(0);
    });

    it('should correctly identify missed opportunities using 0.5% threshold', async () => {
      const mockClient = supabaseService.getServiceClient();
      const mockPredictions = [
        { id: 'p1', status: 'resolved', outcome_value: 0.49, direction: 'flat' }, // Correct (at threshold)
        { id: 'p2', status: 'resolved', outcome_value: 0.51, direction: 'flat' }, // Missed opportunity
        {
          id: 'p3',
          status: 'resolved',
          outcome_value: -0.49,
          direction: 'flat',
        }, // Correct (negative at threshold)
        {
          id: 'p4',
          status: 'resolved',
          outcome_value: -0.51,
          direction: 'flat',
        }, // Missed opportunity
      ];

      (mockClient.schema as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  contains: jest.fn().mockResolvedValue({
                    data: mockPredictions,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }));

      const result = await service.getBaselineStats('2024-01-01', '2024-01-31');

      expect(result.missedOpportunities).toBe(2);
      expect(result.correctFlat).toBe(2);
    });
  });
});
