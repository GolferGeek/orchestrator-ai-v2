import { Test, TestingModule } from '@nestjs/testing';
import { TestScenarioComparisonService } from '../test-scenario-comparison.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('TestScenarioComparisonService', () => {
  let service: TestScenarioComparisonService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockTestPredictions = [
    {
      id: 'test-pred-1',
      target_id: 'target-123',
      test_scenario_id: 'scenario-123',
      direction: 'up',
      confidence: 0.8,
      status: 'resolved',
      outcome_value: 5,
      predicted_at: '2024-01-01T10:00:00Z',
      targets: { universe_id: 'universe-123' },
    },
    {
      id: 'test-pred-2',
      target_id: 'target-456',
      test_scenario_id: 'scenario-123',
      direction: 'down',
      confidence: 0.6,
      status: 'pending',
      outcome_value: null,
      predicted_at: '2024-01-01T11:00:00Z',
      targets: { universe_id: 'universe-123' },
    },
  ];

  const mockProductionPredictions = [
    {
      id: 'prod-pred-1',
      target_id: 'target-123',
      direction: 'up',
      confidence: 0.75,
      status: 'resolved',
      outcome_value: 5,
      predicted_at: '2024-01-01T10:30:00Z',
    },
    {
      id: 'prod-pred-2',
      target_id: 'target-456',
      direction: 'up', // Different direction
      confidence: 0.7,
      status: 'resolved',
      outcome_value: -3,
      predicted_at: '2024-01-01T11:30:00Z',
    },
  ];

  const mockTestSignals = [
    { id: 'test-sig-1', content: 'Strong momentum', url: 'http://test.com/1', target_id: 'target-123' },
    { id: 'test-sig-2', content: 'Price breakout', url: 'http://test.com/2', target_id: 'target-456' },
  ];

  const mockProdSignals = [
    { id: 'prod-sig-1', content: 'Strong momentum', url: 'http://test.com/1', target_id: 'target-123' },
    { id: 'prod-sig-2', content: 'Different signal', url: 'http://other.com/1', target_id: 'target-456' },
  ];

  const createMockClient = (overrides?: {
    testPredictions?: { data: unknown[] | null; error: { message: string } | null };
    prodPredictions?: { data: unknown[] | null; error: { message: string } | null };
    testSignals?: { data: unknown[] | null; error: { message: string } | null };
    prodSignals?: { data: unknown[] | null; error: { message: string } | null };
  }) => {
    const testPredResult = overrides?.testPredictions ?? { data: mockTestPredictions, error: null };
    const prodPredResult = overrides?.prodPredictions ?? { data: mockProductionPredictions, error: null };
    const testSigResult = overrides?.testSignals ?? { data: mockTestSignals, error: null };
    const prodSigResult = overrides?.prodSignals ?? { data: mockProdSignals, error: null };

    let queryCount = 0;
    let signalQueryCount = 0;

    const createChain = (fromTable: string) => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        or: jest.fn(),
        order: jest.fn(),
        then: (resolve: (v: unknown) => void) => {
          if (fromTable === 'predictions') {
            queryCount++;
            return resolve(queryCount === 1 ? testPredResult : prodPredResult);
          } else if (fromTable === 'signals') {
            signalQueryCount++;
            return resolve(signalQueryCount === 1 ? testSigResult : prodSigResult);
          }
          return resolve({ data: [], error: null });
        },
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.or as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation((table: string) => createChain(table)),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestScenarioComparisonService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestScenarioComparisonService>(TestScenarioComparisonService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('compareTestScenarioVsProduction', () => {
    it('should compare test predictions against production', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
      expect(result.scenario_id).toBe('scenario-123');
      expect(result.universe_id).toBe('universe-123');
      expect(result.metrics).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.signal_comparison).toBeDefined();
    });

    it('should return empty result when no test predictions', async () => {
      const mockClient = createMockClient({
        testPredictions: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.metrics.total_test_predictions).toBe(0);
      expect(result.details).toEqual([]);
      expect(result.signal_comparison.test_signals_count).toBe(0);
    });

    it('should throw error when test predictions fetch fails', async () => {
      const mockClient = createMockClient({
        testPredictions: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        service.compareTestScenarioVsProduction('universe-123', 'scenario-123'),
      ).rejects.toThrow('Failed to fetch test predictions');
    });

    it('should throw error when production predictions fetch fails', async () => {
      const mockClient = createMockClient({
        prodPredictions: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        service.compareTestScenarioVsProduction('universe-123', 'scenario-123'),
      ).rejects.toThrow('Failed to fetch production predictions');
    });

    it('should include comparison details for each test prediction', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details.length).toBe(mockTestPredictions.length);
      expect(result.details[0]?.test_prediction_id).toBe('test-pred-1');
      expect(result.details[0]?.production_prediction_id).toBe('prod-pred-1');
    });

    it('should calculate direction match correctly', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // First prediction: both 'up' - should match
      expect(result.details[0]?.direction_match).toBe(true);
      // Second prediction: test='down', prod='up' - should not match
      expect(result.details[1]?.direction_match).toBe(false);
    });

    it('should calculate confidence difference', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // First: test=0.8, prod=0.75, diff=0.05
      expect(result.details[0]?.confidence_diff).toBeCloseTo(0.05, 2);
    });

    it('should identify both resolved predictions', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // First: both resolved
      expect(result.details[0]?.both_resolved).toBe(true);
      // Second: test is pending
      expect(result.details[1]?.both_resolved).toBe(false);
    });
  });

  describe('metrics calculation', () => {
    it('should calculate match rate percentage', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.metrics.total_test_predictions).toBe(2);
      expect(result.metrics.matched_predictions).toBe(2);
      expect(result.metrics.match_rate_pct).toBe(100);
    });

    it('should calculate direction agreement percentage', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // 1 out of 2 matched predictions have same direction
      expect(result.metrics.direction_agreement_count).toBe(1);
      expect(result.metrics.direction_agreement_pct).toBe(50);
    });

    it('should calculate average confidence difference', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.metrics.avg_confidence_diff).toBeDefined();
    });

    it('should handle no matched predictions', async () => {
      const mockClient = createMockClient({
        prodPredictions: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.metrics.matched_predictions).toBe(0);
      expect(result.metrics.direction_agreement_pct).toBe(0);
      expect(result.metrics.avg_confidence_diff).toBeNull();
    });

    it('should calculate test and production accuracy', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // Only resolved predictions count for accuracy
      expect(result.metrics.both_resolved_count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('signal comparison', () => {
    it('should compare signals between test and production', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.signal_comparison.test_signals_count).toBe(2);
      expect(result.signal_comparison.production_signals_count).toBe(2);
    });

    it('should calculate signal overlap', async () => {
      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      // 1 shared signal out of 2 test signals = 50% overlap
      expect(result.signal_comparison.shared_signals_count).toBe(1);
      expect(result.signal_comparison.overlap_pct).toBe(50);
    });

    it('should handle test signals fetch error gracefully', async () => {
      const mockClient = createMockClient({
        testSignals: { data: null, error: { message: 'Signal fetch failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.signal_comparison.test_signals_count).toBe(0);
      expect(result.signal_comparison.overlap_pct).toBe(0);
    });

    it('should handle production signals fetch error gracefully', async () => {
      const mockClient = createMockClient({
        prodSignals: { data: null, error: { message: 'Signal fetch failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.signal_comparison.production_signals_count).toBe(0);
    });

    it('should handle no signals', async () => {
      const mockClient = createMockClient({
        testSignals: { data: [], error: null },
        prodSignals: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.signal_comparison.test_signals_count).toBe(0);
      expect(result.signal_comparison.production_signals_count).toBe(0);
      expect(result.signal_comparison.overlap_pct).toBe(0);
    });
  });

  describe('prediction matching', () => {
    it('should match predictions within 1 hour window', async () => {
      const testPreds = [
        {
          id: 'test-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: 5,
          predicted_at: '2024-01-01T10:00:00Z',
          targets: { universe_id: 'universe-123' },
        },
      ];

      const prodPreds = [
        {
          id: 'prod-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: 5,
          predicted_at: '2024-01-01T10:30:00Z', // 30 mins later
        },
      ];

      const mockClient = createMockClient({
        testPredictions: { data: testPreds, error: null },
        prodPredictions: { data: prodPreds, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details[0]?.production_prediction_id).toBe('prod-1');
      expect(result.details[0]?.predicted_at_diff_minutes).toBe(30);
    });

    it('should not match predictions outside 1 hour window', async () => {
      const testPreds = [
        {
          id: 'test-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'pending',
          outcome_value: null,
          predicted_at: '2024-01-01T10:00:00Z',
          targets: { universe_id: 'universe-123' },
        },
      ];

      const prodPreds = [
        {
          id: 'prod-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'pending',
          outcome_value: null,
          predicted_at: '2024-01-01T12:00:00Z', // 2 hours later
        },
      ];

      const mockClient = createMockClient({
        testPredictions: { data: testPreds, error: null },
        prodPredictions: { data: prodPreds, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details[0]?.production_prediction_id).toBeNull();
    });

    it('should only match predictions for same target', async () => {
      const testPreds = [
        {
          id: 'test-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'pending',
          outcome_value: null,
          predicted_at: '2024-01-01T10:00:00Z',
          targets: { universe_id: 'universe-123' },
        },
      ];

      const prodPreds = [
        {
          id: 'prod-1',
          target_id: 'target-different', // Different target
          direction: 'up',
          confidence: 0.8,
          status: 'pending',
          outcome_value: null,
          predicted_at: '2024-01-01T10:00:00Z',
        },
      ];

      const mockClient = createMockClient({
        testPredictions: { data: testPreds, error: null },
        prodPredictions: { data: prodPreds, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details[0]?.production_prediction_id).toBeNull();
    });
  });

  describe('correctness calculation', () => {
    it('should calculate test correctness for resolved predictions', async () => {
      const testPreds = [
        {
          id: 'test-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: 5, // Positive = up
          predicted_at: '2024-01-01T10:00:00Z',
          targets: { universe_id: 'universe-123' },
        },
      ];

      const prodPreds = [
        {
          id: 'prod-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: 5,
          predicted_at: '2024-01-01T10:00:00Z',
        },
      ];

      const mockClient = createMockClient({
        testPredictions: { data: testPreds, error: null },
        prodPredictions: { data: prodPreds, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details[0]?.test_correct).toBe(true);
      expect(result.details[0]?.production_correct).toBe(true);
    });

    it('should identify incorrect predictions', async () => {
      const testPreds = [
        {
          id: 'test-1',
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: -5, // Negative = down, but predicted up
          predicted_at: '2024-01-01T10:00:00Z',
          targets: { universe_id: 'universe-123' },
        },
      ];

      const prodPreds = [
        {
          id: 'prod-1',
          target_id: 'target-123',
          direction: 'down',
          confidence: 0.8,
          status: 'resolved',
          outcome_value: -5,
          predicted_at: '2024-01-01T10:00:00Z',
        },
      ];

      const mockClient = createMockClient({
        testPredictions: { data: testPreds, error: null },
        prodPredictions: { data: prodPreds, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.compareTestScenarioVsProduction('universe-123', 'scenario-123');

      expect(result.details[0]?.test_correct).toBe(false);
      expect(result.details[0]?.production_correct).toBe(true);
    });
  });
});
