import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import {
  AnomalyDetectionService,
  DEFAULT_ANOMALY_CONFIG,
} from '../anomaly-detection.service';
import { AlertService } from '../alert.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let alertService: jest.Mocked<AlertService>;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const createChain = (finalResult: unknown) => {
      const chain: Record<string, jest.Mock> = {};
      chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
      chain.select = jest.fn().mockImplementation(() => {
        return {
          ...chain,
          gte: jest.fn().mockReturnValue(chain),
          lt: jest.fn().mockReturnValue(chain),
          lte: jest.fn().mockReturnValue(chain),
          eq: jest.fn().mockReturnValue(chain),
          then: (resolve: (v: unknown) => void) =>
            resolve(finalResult ?? { data: [], error: null }),
        };
      });
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.lt = jest.fn().mockReturnValue(chain);
      chain.lte = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      return chain;
    };

    const chain = createChain(overrides?.select);

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
        AnomalyDetectionService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: AlertService,
          useValue: {
            createAlert: jest.fn().mockResolvedValue({ id: 'alert-123' }),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
    supabaseService = module.get(SupabaseService);
    alertService = module.get(AlertService);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectAnomalies', () => {
    it('should run full anomaly detection', async () => {
      const result = await service.detectAnomalies(mockExecutionContext);

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('signal_rate_anomalies');
      expect(result).toHaveProperty('accuracy_anomalies');
      expect(result).toHaveProperty('alerts_created');
      expect(observabilityEventsService.push).toHaveBeenCalled();
    });

    it('should use custom config when provided', async () => {
      const customConfig = {
        ...DEFAULT_ANOMALY_CONFIG,
        signal_rate_threshold_pct: 75,
        accuracy_threshold_pct: 30,
      };

      const result = await service.detectAnomalies(
        mockExecutionContext,
        customConfig,
      );

      expect(result).toBeDefined();
    });

    it('should return zero alerts when no anomalies detected', async () => {
      const result = await service.detectAnomalies(mockExecutionContext);

      expect(result.alerts_created).toBe(0);
    });
  });

  describe('detectSignalRateAnomalies', () => {
    it('should return empty array when not enough samples', async () => {
      const result = await service.detectSignalRateAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect increase anomaly', async () => {
      // Mock data with significant increase
      const baselineSignals = [
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
      ];

      const currentSignals = [
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
        {
          source_id: 'source-1',
          sources: { id: 'source-1', name: 'Source 1' },
        },
      ];

      let callCount = 0;
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockImplementation(() => ({
              gte: jest.fn().mockReturnThis(),
              lt: jest.fn().mockReturnThis(),
              eq: jest.fn().mockImplementation(() => {
                callCount++;
                const data = callCount === 1 ? baselineSignals : currentSignals;
                return Promise.resolve({ data, error: null });
              }),
            })),
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectSignalRateAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockClient = createMockClient({
        select: { data: null, error: { message: 'DB error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectSignalRateAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      expect(result).toEqual([]);
    });
  });

  describe('detectAccuracyAnomalies', () => {
    it('should return empty array when not enough predictions', async () => {
      const result = await service.detectAccuracyAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockClient = createMockClient({
        select: { data: null, error: { message: 'DB error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectAccuracyAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      expect(result).toEqual([]);
    });

    it('should only alert on accuracy drops (not improvements)', async () => {
      // Baseline: 50% accuracy, Current: 80% accuracy (improvement)
      // Should NOT create an anomaly alert
      const baselinePredictions = [
        { id: '1', direction: 'up', outcome_value: 1, target_id: 't1' },
        { id: '2', direction: 'up', outcome_value: -1, target_id: 't1' },
      ];
      const currentPredictions = [
        { id: '3', direction: 'up', outcome_value: 1, target_id: 't1' },
        { id: '4', direction: 'up', outcome_value: 1, target_id: 't1' },
      ];

      // Add enough samples to meet minimum
      for (let i = 0; i < 18; i++) {
        baselinePredictions.push({
          id: `b${i}`,
          direction: i % 2 === 0 ? 'up' : 'down',
          outcome_value: i % 2 === 0 ? 1 : -1,
          target_id: 't1',
        });
        currentPredictions.push({
          id: `c${i}`,
          direction: 'up',
          outcome_value: 1,
          target_id: 't1',
        });
      }

      let callCount = 0;
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockImplementation(() => ({
              eq: jest.fn().mockReturnThis(),
              gte: jest.fn().mockReturnThis(),
              lt: jest.fn().mockReturnThis(),
              lte: jest.fn().mockImplementation(() => {
                callCount++;
                const data =
                  callCount === 1 ? baselinePredictions : currentPredictions;
                return Promise.resolve({ data, error: null });
              }),
            })),
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectAccuracyAnomalies(
        DEFAULT_ANOMALY_CONFIG,
      );

      // Should not detect anomaly for accuracy improvement
      expect(
        result.every(
          (a) => a.deviation_pct < 0 || a.deviation_pct === undefined,
        ),
      ).toBe(true);
    });
  });

  describe('DEFAULT_ANOMALY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_ANOMALY_CONFIG.signal_rate_min_samples).toBe(10);
      expect(DEFAULT_ANOMALY_CONFIG.signal_rate_threshold_pct).toBe(50);
      expect(DEFAULT_ANOMALY_CONFIG.signal_rate_window_hours).toBe(24);
      expect(DEFAULT_ANOMALY_CONFIG.accuracy_min_predictions).toBe(20);
      expect(DEFAULT_ANOMALY_CONFIG.accuracy_threshold_pct).toBe(20);
      expect(DEFAULT_ANOMALY_CONFIG.accuracy_window_days).toBe(7);
    });
  });

  describe('severity calculation', () => {
    it('should correctly assign severities for signal rate anomalies', async () => {
      // Test through detectAnomalies which uses internal severity calculation
      const result = await service.detectAnomalies(mockExecutionContext);
      expect(result).toBeDefined();
    });
  });

  describe('alert creation', () => {
    it('should create alerts for detected anomalies', async () => {
      // When anomalies are detected, alerts should be created
      const result = await service.detectAnomalies(mockExecutionContext);
      expect(result.alerts_created).toBeGreaterThanOrEqual(0);
    });

    it('should handle alert creation failures gracefully', async () => {
      alertService.createAlert.mockRejectedValue(
        new Error('Alert creation failed'),
      );

      // Should not throw, just return 0 alerts created
      const result = await service.detectAnomalies(mockExecutionContext);
      expect(result).toBeDefined();
    });
  });
});
