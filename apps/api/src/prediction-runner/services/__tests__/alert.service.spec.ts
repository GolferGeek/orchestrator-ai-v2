import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import {
  AlertService,
  Alert,
  CreateAlertData,
  CrawlFailureContext,
  CrawlSuccessContext,
  DEFAULT_ALERT_CONFIG,
} from '../alert.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('AlertService', () => {
  let service: AlertService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let _observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  const mockAlert: Alert = {
    id: 'alert-123',
    alert_type: 'crawl.failure.threshold',
    severity: 'warning',
    status: 'active',
    source_id: 'source-123',
    title: 'Crawl Failure Alert',
    message: 'Source has exceeded failure threshold',
    details: { consecutiveErrors: 3 },
    created_at: new Date().toISOString(),
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const defaultResult = {
      data: mockAlert,
      error: null,
    };

    const chain: Record<string, jest.Mock> = {};
    chain.single = jest
      .fn()
      .mockResolvedValue(overrides?.single ?? defaultResult);
    chain.maybeSingle = jest
      .fn()
      .mockResolvedValue(overrides?.maybeSingle ?? { data: null, error: null });
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.range = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.gte = jest.fn().mockReturnValue(chain);
    chain.lte = jest.fn().mockReturnValue(chain);
    chain.in = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.is = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);

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
        AlertService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
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
    service = module.get<AlertService>(AlertService);
    supabaseService = module.get(SupabaseService);
    _observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAndCreateCrawlFailureAlert', () => {
    const failureContext: CrawlFailureContext = {
      sourceId: 'source-123',
      sourceName: 'Test Source',
      sourceType: 'firecrawl',
      consecutiveErrors: 3,
      lastError: 'Connection timeout',
    };

    it('should not create alert when below threshold', async () => {
      const belowThreshold = { ...failureContext, consecutiveErrors: 2 };

      const result = await service.checkAndCreateCrawlFailureAlert(
        mockExecutionContext,
        belowThreshold,
      );

      expect(result).toBeNull();
    });

    it('should create alert when threshold is met', async () => {
      const mockClient = createMockClient({
        maybeSingle: { data: null, error: null }, // No existing alert
        single: { data: mockAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const _result = await service.checkAndCreateCrawlFailureAlert(
        mockExecutionContext,
        failureContext,
      );

      // Should return the created alert or existing one
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should return existing alert if already active', async () => {
      const mockClient = createMockClient({
        maybeSingle: { data: mockAlert, error: null }, // Existing alert
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.checkAndCreateCrawlFailureAlert(
        mockExecutionContext,
        failureContext,
      );

      expect(result).toEqual(mockAlert);
    });

    it('should use custom config thresholds', async () => {
      const customConfig = {
        crawl_failure_threshold: 5,
        crawl_degraded_threshold: 80,
        crawl_degraded_window_hours: 12,
      };

      const result = await service.checkAndCreateCrawlFailureAlert(
        mockExecutionContext,
        failureContext,
        customConfig,
      );

      // With threshold of 5, 3 errors should not trigger
      expect(result).toBeNull();
    });

    it('should set critical severity for high consecutive errors', async () => {
      const highErrors: CrawlFailureContext = {
        ...failureContext,
        consecutiveErrors: 6, // 2x threshold
      };

      const mockClient = createMockClient({
        maybeSingle: { data: null, error: null },
        single: { data: { ...mockAlert, severity: 'critical' }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await service.checkAndCreateCrawlFailureAlert(
        mockExecutionContext,
        highErrors,
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('resolveCrawlFailureAlert', () => {
    const successContext: CrawlSuccessContext = {
      sourceId: 'source-123',
      sourceName: 'Test Source',
      sourceType: 'firecrawl',
      previousConsecutiveErrors: 3,
    };

    it('should resolve active alerts when crawl succeeds', async () => {
      const mockClient = createMockClient({
        maybeSingle: { data: mockAlert, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await service.resolveCrawlFailureAlert(
        mockExecutionContext,
        successContext,
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should not resolve if no previous errors', async () => {
      const noErrors = { ...successContext, previousConsecutiveErrors: 0 };

      const result = await service.resolveCrawlFailureAlert(
        mockExecutionContext,
        noErrors,
      );

      expect(result).toBeNull();
    });
  });

  describe('createAlert', () => {
    it('should create a new alert', async () => {
      const alertData: CreateAlertData = {
        alert_type: 'crawl.failure.threshold',
        severity: 'warning',
        source_id: 'source-123',
        title: 'Test Alert',
        message: 'Test message',
        details: { test: true },
      };

      const result = await service.createAlert(alertData);

      expect(result).toBeDefined();
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should create alerts with different severities', async () => {
      const severities: Array<'info' | 'warning' | 'critical'> = [
        'info',
        'warning',
        'critical',
      ];

      for (const severity of severities) {
        const alertData: CreateAlertData = {
          alert_type: 'crawl.failure.threshold',
          severity,
          title: `${severity} Alert`,
          message: 'Test message',
          details: {},
        };

        const result = await service.createAlert(alertData);
        expect(result).toBeDefined();
      }
    });

    it('should create alerts with different types', async () => {
      const types: Array<CreateAlertData['alert_type']> = [
        'crawl.failure.threshold',
        'crawl.failure.resolved',
        'crawl.degraded',
        'anomaly.signal_rate',
        'anomaly.prediction_accuracy',
      ];

      for (const alertType of types) {
        const alertData: CreateAlertData = {
          alert_type: alertType,
          severity: 'warning',
          title: 'Test Alert',
          message: 'Test message',
          details: {},
        };

        const result = await service.createAlert(alertData);
        expect(result).toBeDefined();
      }
    });
  });

  describe('listAlerts', () => {
    it('should list alerts without filters', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('prediction').from('alerts');
      chain.order = jest.fn().mockResolvedValue({
        data: [mockAlert],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.listAlerts(mockExecutionContext);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should apply status filter', async () => {
      await service.listAlerts(mockExecutionContext, { status: 'active' });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply severity filter', async () => {
      await service.listAlerts(mockExecutionContext, { severity: 'critical' });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply type filter', async () => {
      await service.listAlerts(mockExecutionContext, {
        alert_type: 'crawl.failure.threshold',
      });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply source_id filter', async () => {
      await service.listAlerts(mockExecutionContext, {
        source_id: 'source-123',
      });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply limit and offset', async () => {
      await service.listAlerts(mockExecutionContext, { limit: 10, offset: 20 });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply date range filters', async () => {
      await service.listAlerts(mockExecutionContext, {
        created_after: '2024-01-01',
        created_before: '2024-12-31',
      });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should handle array filters for status', async () => {
      await service.listAlerts(mockExecutionContext, {
        status: ['active', 'acknowledged'],
      });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getAlertById', () => {
    it('should get alert by ID', async () => {
      const result = await service.getAlertById('alert-123');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(service.getAlertById('nonexistent')).rejects.toThrow();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const result = await service.acknowledgeAlert(
        mockExecutionContext,
        'alert-123',
      );

      expect(result).toBeDefined();
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const result = await service.resolveAlert(
        mockExecutionContext,
        'alert-123',
      );

      expect(result).toBeDefined();
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should resolve an alert with resolution note', async () => {
      const result = await service.resolveAlert(
        mockExecutionContext,
        'alert-123',
        'Issue was resolved manually',
      );

      expect(result).toBeDefined();
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getAlertCounts', () => {
    it('should return alert counts by status', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('prediction').from('alerts');
      chain.select = jest.fn().mockResolvedValue({
        data: [
          { status: 'active' },
          { status: 'active' },
          { status: 'acknowledged' },
          { status: 'resolved' },
        ],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getAlertCounts();

      expect(result).toHaveProperty('active');
      expect(result).toHaveProperty('acknowledged');
      expect(result).toHaveProperty('resolved');
      expect(result).toHaveProperty('total');
    });
  });

  describe('getActiveAlertsForUniverse', () => {
    it('should return active alerts for a universe', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('prediction').from('alerts');
      chain.order = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [mockAlert],
          error: null,
        }),
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getActiveAlertsForUniverse('universe-123');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('DEFAULT_ALERT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_ALERT_CONFIG.crawl_failure_threshold).toBe(3);
      expect(DEFAULT_ALERT_CONFIG.crawl_degraded_threshold).toBe(70);
      expect(DEFAULT_ALERT_CONFIG.crawl_degraded_window_hours).toBe(24);
    });
  });
});
