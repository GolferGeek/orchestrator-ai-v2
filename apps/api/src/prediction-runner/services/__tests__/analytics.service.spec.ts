import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../analytics.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockAccuracyData = [
    {
      period_date: '2024-01-15',
      is_test: true,
      total_predictions: 100,
      resolved_predictions: 80,
      correct_predictions: 60,
      accuracy_pct: 75.0,
      avg_confidence: 0.85,
      avg_overall_score: 0.8,
    },
    {
      period_date: '2024-01-15',
      is_test: false,
      total_predictions: 50,
      resolved_predictions: 40,
      correct_predictions: 32,
      accuracy_pct: 80.0,
      avg_confidence: 0.88,
      avg_overall_score: 0.82,
    },
  ];

  const mockVelocityData = [
    {
      period_date: '2024-01-15',
      test_learnings_created: 10,
      production_learnings_created: 5,
      learnings_promoted: 3,
      avg_days_to_promotion: 5.5,
    },
  ];

  const mockScenarioData = [
    {
      scenario_type: 'backtest',
      total_scenarios: 20,
      total_runs: 100,
      successful_runs: 85,
      success_rate_pct: 85.0,
      learnings_generated: 30,
      avg_run_duration_minutes: 15.5,
    },
  ];

  const mockFunnelData = [
    { stage: 'test_created', count: 100, pct_of_total: 100 },
    { stage: 'validated', count: 80, pct_of_total: 80 },
    { stage: 'backtested', count: 50, pct_of_total: 50 },
    { stage: 'promoted', count: 20, pct_of_total: 20 },
  ];

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const createChain = (finalResult: unknown) => {
      const chain: Record<string, jest.Mock> = {};
      chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
      chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      chain.limit = jest.fn().mockReturnValue(chain);
      chain.range = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockImplementation(() => {
        // Return resolved value for final call, chain for intermediate
        const result = finalResult ?? { data: [], error: null };
        return {
          ...chain,
          then: (resolve: (v: unknown) => void) => resolve(result),
          gte: jest.fn().mockReturnValue(chain),
          lte: jest.fn().mockReturnValue(chain),
        };
      });
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.lte = jest.fn().mockReturnValue(chain);
      chain.in = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      return chain;
    };

    const chain = createChain(overrides?.order);

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<AnalyticsService>(AnalyticsService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccuracyComparison', () => {
    it('should fetch accuracy comparison data', async () => {
      const mockClient = createMockClient({
        order: { data: mockAccuracyData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getAccuracyComparison('test-org');

      expect(Array.isArray(result)).toBe(true);
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply date range filters', async () => {
      const mockClient = createMockClient({
        order: { data: mockAccuracyData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getAccuracyComparison('test-org', '2024-01-01', '2024-01-31');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should transform data to DTOs', async () => {
      const mockClient = createMockClient({
        order: { data: mockAccuracyData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getAccuracyComparison('test-org');

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('period_date');
      expect(result[0]).toHaveProperty('is_test');
      expect(result[0]).toHaveProperty('accuracy_pct');
    });

    it('should handle null values in data', async () => {
      const dataWithNulls = [
        {
          period_date: '2024-01-15',
          is_test: true,
          total_predictions: 0,
          resolved_predictions: 0,
          correct_predictions: 0,
          accuracy_pct: null,
          avg_confidence: null,
          avg_overall_score: null,
        },
      ];
      const mockClient = createMockClient({
        order: { data: dataWithNulls, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getAccuracyComparison('test-org');

      expect(result[0]?.accuracy_pct).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        order: { data: null, error: { message: 'DB error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(service.getAccuracyComparison('test-org')).rejects.toThrow(
        'Failed to fetch accuracy comparison',
      );
    });
  });

  describe('getLearningVelocity', () => {
    it('should fetch learning velocity data', async () => {
      const mockClient = createMockClient({
        order: { data: mockVelocityData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getLearningVelocity('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should apply date filters', async () => {
      const mockClient = createMockClient({
        order: { data: mockVelocityData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getLearningVelocity('test-org', '2024-01-01', '2024-12-31');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        order: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(service.getLearningVelocity('test-org')).rejects.toThrow();
    });
  });

  describe('getScenarioEffectiveness', () => {
    it('should fetch scenario effectiveness data', async () => {
      const mockClient = createMockClient({
        order: { data: mockScenarioData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getScenarioEffectiveness('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should transform scenario data to DTOs', async () => {
      const mockClient = createMockClient({
        order: { data: mockScenarioData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getScenarioEffectiveness('test-org');

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('scenario_type');
        expect(result[0]).toHaveProperty('total_runs');
        expect(result[0]).toHaveProperty('success_rate_pct');
      }
    });
  });

  describe('getPromotionFunnel', () => {
    it('should fetch promotion funnel data', async () => {
      const mockClient = createMockClient({
        order: { data: mockFunnelData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getPromotionFunnel('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should transform funnel stages', async () => {
      const mockClient = createMockClient({
        order: { data: mockFunnelData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getPromotionFunnel('test-org');

      if (result.length > 0) {
        expect(result[0]).toHaveProperty('stage');
        expect(result[0]).toHaveProperty('count');
        expect(result[0]).toHaveProperty('pct_of_total');
      }
    });
  });

  describe('getSummary', () => {
    it('should aggregate analytics summary', async () => {
      // Mock all queries
      const mockClient = createMockClient({
        order: { data: mockAccuracyData, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getSummary('test-org');

      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('learning_velocity');
      expect(result).toHaveProperty('scenario_effectiveness');
      expect(result).toHaveProperty('promotion_funnel');
    });

    it('should handle empty data', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getSummary('test-org');

      expect(result.accuracy.test.total_predictions).toBe(0);
      expect(result.accuracy.production.total_predictions).toBe(0);
    });
  });

  describe('getAccuracyByStrategy', () => {
    it('should fetch accuracy by strategy', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('predictions');
      chain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getAccuracyByStrategy('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should include test data when requested', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('predictions');
      chain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getAccuracyByStrategy('test-org', true);

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getAccuracyByTarget', () => {
    it('should fetch accuracy by target', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('predictions');
      chain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getAccuracyByTarget('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should include test data when requested', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('predictions');
      chain.eq = jest.fn().mockResolvedValue({ data: [], error: null });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getAccuracyByTarget('test-org', true);

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getSignalDetectionRate', () => {
    it('should fetch signal detection rate', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getSignalDetectionRate('test-org');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support different groupBy options', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const groupByOptions: Array<'day' | 'week' | 'month' | 'source' | 'target'> = [
        'day',
        'week',
        'month',
        'source',
        'target',
      ];

      for (const groupBy of groupByOptions) {
        const result = await service.getSignalDetectionRate(
          'test-org',
          undefined,
          undefined,
          groupBy,
        );
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should apply date range filters', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getSignalDetectionRate(
        'test-org',
        '2024-01-01',
        '2024-12-31',
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should filter by universe', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getSignalDetectionRate(
        'test-org',
        undefined,
        undefined,
        'day',
        'universe-123',
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should filter by target', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getSignalDetectionRate(
        'test-org',
        undefined,
        undefined,
        'day',
        undefined,
        'target-123',
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should include test signals when requested', async () => {
      const mockClient = createMockClient({
        order: { data: [], error: null },
      });
      const chain = mockClient.schema('prediction').from('signals');
      chain.eq = jest.fn().mockReturnValue(chain);
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await service.getSignalDetectionRate(
        'test-org',
        undefined,
        undefined,
        'day',
        undefined,
        undefined,
        true,
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });
});
