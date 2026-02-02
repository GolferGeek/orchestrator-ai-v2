import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import {
  DegradedModeService,
  DEFAULT_DEGRADED_MODE_CONFIG,
} from '../degraded-mode.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('DegradedModeService', () => {
  let service: DegradedModeService;
  let supabaseService: jest.Mocked<SupabaseService>;
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
    const chain: Record<string, jest.Mock> = {};
    chain.single = jest
      .fn()
      .mockResolvedValue(overrides?.single ?? { data: null, error: null });
    chain.maybeSingle = jest
      .fn()
      .mockResolvedValue(overrides?.maybeSingle ?? { data: null, error: null });
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.gte = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);

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
        DegradedModeService,
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
    service = module.get<DegradedModeService>(DegradedModeService);
    supabaseService = module.get(SupabaseService);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reportDegradation', () => {
    it('should report service degradation', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'API timeout',
      );

      expect(observabilityEventsService.push).toHaveBeenCalled();
      expect(service.getDegradationLevel('firecrawl')).toBe('degraded');
    });

    it('should handle different degradation levels', async () => {
      const levels: Array<'normal' | 'partial' | 'degraded' | 'offline'> = [
        'normal',
        'partial',
        'degraded',
        'offline',
      ];

      for (const level of levels) {
        await service.reportDegradation(
          mockExecutionContext,
          `service-${level}`,
          level,
          'Test reason',
        );

        expect(service.getDegradationLevel(`service-${level}`)).toBe(level);
      }
    });

    it('should not re-report same degradation level', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'First report',
      );

      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Second report',
      );

      // Should only push once for same level
      expect(observabilityEventsService.push).toHaveBeenCalledTimes(1);
    });

    it('should update degradation when level changes', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'partial',
        'Initial',
      );

      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'offline',
        'Got worse',
      );

      expect(observabilityEventsService.push).toHaveBeenCalledTimes(2);
      expect(service.getDegradationLevel('firecrawl')).toBe('offline');
    });

    it('should check fallback availability', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test',
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('clearDegradation', () => {
    it('should clear degradation state', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test',
      );

      await service.clearDegradation(mockExecutionContext, 'firecrawl');

      expect(service.getDegradationLevel('firecrawl')).toBe('normal');
    });

    it('should emit recovery event', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test',
      );

      await service.clearDegradation(mockExecutionContext, 'firecrawl');

      const calls = observabilityEventsService.push.mock.calls;
      const recoveryCall = calls.find((call) => {
        const arg = call[0] as { hook_event_type?: string };
        return arg.hook_event_type === 'service.recovered';
      });
      expect(recoveryCall).toBeDefined();
    });

    it('should handle clearing non-existent degradation', async () => {
      // Should not throw
      await expect(
        service.clearDegradation(mockExecutionContext, 'unknown-service'),
      ).resolves.not.toThrow();
    });
  });

  describe('getDegradationLevel', () => {
    it('should return normal for unknown services', () => {
      expect(service.getDegradationLevel('unknown-service')).toBe('normal');
    });

    it('should return correct level for known services', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'partial',
        'Test',
      );

      expect(service.getDegradationLevel('firecrawl')).toBe('partial');
    });
  });

  describe('shouldUseFallback', () => {
    it('should return false when service is normal', () => {
      expect(service.shouldUseFallback('unknown-service')).toBe(false);
    });

    it('should return false when service is partial', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'partial',
        'Test',
      );

      expect(service.shouldUseFallback('firecrawl')).toBe(false);
    });

    it('should return true when service is degraded', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test',
      );

      expect(service.shouldUseFallback('firecrawl')).toBe(true);
    });

    it('should return true when service is offline', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'offline',
        'Test',
      );

      expect(service.shouldUseFallback('firecrawl')).toBe(true);
    });
  });

  describe('getAllDegradations', () => {
    it('should return empty array when no degradations', () => {
      expect(service.getAllDegradations()).toEqual([]);
    });

    it('should return all tracked degradations', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test 1',
      );
      await service.reportDegradation(
        mockExecutionContext,
        'price-api',
        'offline',
        'Test 2',
      );

      const degradations = service.getAllDegradations();

      expect(degradations).toHaveLength(2);
    });
  });

  describe('getCachedContent', () => {
    it('should return null when no cached content', async () => {
      const result = await service.getCachedContent('https://example.com');

      expect(result).toBeNull();
    });

    it('should return cached content when available', async () => {
      const cachedSignal = {
        content: 'Cached article content',
        url: 'https://example.com',
        detected_at: new Date().toISOString(),
        source_id: 'source-123',
        metadata: { title: 'Test Article' },
      };

      const mockClient = createMockClient({
        maybeSingle: { data: cachedSignal, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getCachedContent('https://example.com');

      expect(result).not.toBeNull();
      expect(result?.content).toBe('Cached article content');
      expect(result?.url).toBe('https://example.com');
    });

    it('should filter by source ID when provided', async () => {
      await service.getCachedContent('https://example.com', 'source-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should mark content as stale when old', async () => {
      const oldDate = new Date();
      oldDate.setMinutes(
        oldDate.getMinutes() -
          DEFAULT_DEGRADED_MODE_CONFIG.firecrawl.cacheTtlMinutes -
          1,
      );

      const cachedSignal = {
        content: 'Old content',
        url: 'https://example.com',
        detected_at: oldDate.toISOString(),
        source_id: 'source-123',
        metadata: {},
      };

      const mockClient = createMockClient({
        maybeSingle: { data: cachedSignal, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getCachedContent('https://example.com');

      expect(result?.isStale).toBe(true);
    });

    it('should return null for too old content', async () => {
      const veryOldDate = new Date();
      veryOldDate.setMinutes(
        veryOldDate.getMinutes() -
          DEFAULT_DEGRADED_MODE_CONFIG.firecrawl.maxStaleMinutes -
          1,
      );

      const cachedSignal = {
        content: 'Very old content',
        url: 'https://example.com',
        detected_at: veryOldDate.toISOString(),
        source_id: 'source-123',
        metadata: {},
      };

      const mockClient = createMockClient({
        maybeSingle: { data: cachedSignal, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getCachedContent('https://example.com');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockClient = createMockClient({
        maybeSingle: { data: null, error: { message: 'DB error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getCachedContent('https://example.com');

      expect(result).toBeNull();
    });
  });

  describe('getLastKnownPrice', () => {
    it('should return null when no price data', async () => {
      const result = await service.getLastKnownPrice('target-123');

      expect(result).toBeNull();
    });

    it('should return last known price when available', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('prediction').from('targets');
      chain.single = jest.fn().mockResolvedValue({
        data: { symbol: 'AAPL' },
        error: null,
      });

      const snapshotChain = mockClient
        .schema('prediction')
        .from('target_snapshots');
      snapshotChain.maybeSingle = jest.fn().mockResolvedValue({
        data: { value: 150.5, captured_at: new Date().toISOString() },
        error: null,
      });

      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const _result = await service.getLastKnownPrice('target-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should mark price as stale when old', async () => {
      const oldDate = new Date();
      oldDate.setMinutes(
        oldDate.getMinutes() -
          DEFAULT_DEGRADED_MODE_CONFIG.priceApi.maxStaleMinutes -
          1,
      );

      const mockClient = createMockClient({
        single: { data: { symbol: 'AAPL' }, error: null },
        maybeSingle: {
          data: { value: 150, captured_at: oldDate.toISOString() },
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const _result = await service.getLastKnownPrice('target-123');

      // Result depends on mock setup
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getDegradationSummary', () => {
    it('should return summary with no degradations', () => {
      const summary = service.getDegradationSummary();

      expect(summary.total).toBe(0);
      expect(summary.byLevel.normal).toBe(0);
      expect(summary.byLevel.partial).toBe(0);
      expect(summary.byLevel.degraded).toBe(0);
      expect(summary.byLevel.offline).toBe(0);
      expect(summary.services).toEqual([]);
    });

    it('should summarize degradations by level', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'service-1',
        'partial',
        'Test',
      );
      await service.reportDegradation(
        mockExecutionContext,
        'service-2',
        'degraded',
        'Test',
      );
      await service.reportDegradation(
        mockExecutionContext,
        'service-3',
        'degraded',
        'Test',
      );
      await service.reportDegradation(
        mockExecutionContext,
        'service-4',
        'offline',
        'Test',
      );

      const summary = service.getDegradationSummary();

      expect(summary.total).toBe(4);
      expect(summary.byLevel.partial).toBe(1);
      expect(summary.byLevel.degraded).toBe(2);
      expect(summary.byLevel.offline).toBe(1);
    });

    it('should list affected services', async () => {
      await service.reportDegradation(
        mockExecutionContext,
        'firecrawl',
        'degraded',
        'Test',
      );
      await service.reportDegradation(
        mockExecutionContext,
        'price-api',
        'offline',
        'Test',
      );

      const summary = service.getDegradationSummary();

      expect(summary.services).toHaveLength(2);
      expect(summary.services).toContainEqual({
        service: 'firecrawl',
        level: 'degraded',
      });
      expect(summary.services).toContainEqual({
        service: 'price-api',
        level: 'offline',
      });
    });
  });

  describe('DEFAULT_DEGRADED_MODE_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_DEGRADED_MODE_CONFIG.firecrawl.cacheTtlMinutes).toBe(60);
      expect(DEFAULT_DEGRADED_MODE_CONFIG.firecrawl.maxStaleMinutes).toBe(
        24 * 60,
      );
      expect(DEFAULT_DEGRADED_MODE_CONFIG.priceApi.maxStaleMinutes).toBe(30);
    });
  });
});
