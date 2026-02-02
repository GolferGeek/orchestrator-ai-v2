import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import {
  LlmUsageLimiterService,
  TIER_LIMITS,
  LOCAL_PROVIDERS,
} from '../llm-usage-limiter.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('LlmUsageLimiterService', () => {
  let service: LlmUsageLimiterService;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmUsageLimiterService,
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LlmUsageLimiterService>(LlmUsageLimiterService);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset usage for test universe
    service.resetUsage('universe-123');
  });

  describe('isLocalProvider', () => {
    it('should return true for ollama', () => {
      expect(service.isLocalProvider('ollama')).toBe(true);
      expect(service.isLocalProvider('Ollama')).toBe(true);
      expect(service.isLocalProvider('OLLAMA')).toBe(true);
    });

    it('should return false for cloud providers', () => {
      expect(service.isLocalProvider('openai')).toBe(false);
      expect(service.isLocalProvider('anthropic')).toBe(false);
      expect(service.isLocalProvider('google')).toBe(false);
    });
  });

  describe('canUseTokens', () => {
    it('should allow tokens within daily limit', () => {
      const result = service.canUseTokens('universe-123', 1000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should always allow local providers', () => {
      const result = service.canUseTokens('universe-123', 999999999, 'ollama');

      expect(result.allowed).toBe(true);
    });

    it('should deny when exceeding daily token limit', () => {
      // Use all daily tokens
      const dailyLimit = TIER_LIMITS.free.daily_tokens;
      service.recordUsage('universe-123', dailyLimit, 'test');

      const result = service.canUseTokens('universe-123', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily token limit exceeded');
    });

    it('should deny when exceeding daily request limit', () => {
      // Use all daily requests
      const dailyLimit = TIER_LIMITS.free.daily_requests;
      for (let i = 0; i < dailyLimit; i++) {
        service.recordUsage('universe-123', 1, 'test');
      }

      const result = service.canUseTokens('universe-123', 1);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily request limit exceeded');
    });

    it('should return remaining tokens', () => {
      const result = service.canUseTokens('universe-123', 1000);

      expect(result.remaining).toBeDefined();
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('recordUsage', () => {
    it('should record token usage', () => {
      service.recordUsage('universe-123', 1000, 'prediction');

      const usage = service.getUsage('universe-123');
      expect(usage.daily_tokens).toBe(1000);
      expect(usage.daily_requests).toBe(1);
    });

    it('should accumulate usage', () => {
      service.recordUsage('universe-123', 500, 'test');
      service.recordUsage('universe-123', 500, 'test');

      const usage = service.getUsage('universe-123');
      expect(usage.daily_tokens).toBe(1000);
      expect(usage.daily_requests).toBe(2);
    });

    it('should skip recording for local providers', () => {
      service.recordUsage('universe-123', 1000, 'test', 'ollama');

      const usage = service.getUsage('universe-123');
      expect(usage.daily_tokens).toBe(0);
    });

    it('should track both daily and monthly usage', () => {
      service.recordUsage('universe-123', 1000, 'test');

      const usage = service.getUsage('universe-123');
      expect(usage.daily_tokens).toBe(1000);
      expect(usage.monthly_tokens).toBe(1000);
    });
  });

  describe('getUsage', () => {
    it('should return usage statistics', () => {
      const usage = service.getUsage('universe-123');

      expect(usage).toHaveProperty('daily_tokens');
      expect(usage).toHaveProperty('monthly_tokens');
      expect(usage).toHaveProperty('daily_requests');
      expect(usage).toHaveProperty('monthly_requests');
      expect(usage).toHaveProperty('tier');
      expect(usage).toHaveProperty('limits');
    });

    it('should initialize new universe with default tier', () => {
      const usage = service.getUsage('new-universe');

      expect(usage.tier).toBe('free');
    });

    it('should return correct limits for tier', () => {
      const usage = service.getUsage('universe-123');

      expect(usage.limits).toEqual(TIER_LIMITS.free);
    });
  });

  describe('setTier', () => {
    it('should update universe tier', () => {
      service.setTier('universe-123', 'pro');

      const usage = service.getUsage('universe-123');
      expect(usage.tier).toBe('pro');
      expect(usage.limits).toEqual(TIER_LIMITS.pro);
    });

    it('should update tier to enterprise', () => {
      service.setTier('universe-123', 'enterprise');

      const usage = service.getUsage('universe-123');
      expect(usage.tier).toBe('enterprise');
    });
  });

  describe('checkAndEmitWarnings', () => {
    it('should emit warning when approaching limit', async () => {
      // Use 75% of daily tokens
      const dailyLimit = TIER_LIMITS.free.daily_tokens;
      service.recordUsage('universe-123', dailyLimit * 0.76, 'test');

      await service.checkAndEmitWarnings(mockExecutionContext, 'universe-123');

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'llm.usage.warning',
          status: 'warning',
        }),
      );
    });

    it('should not emit warning when below threshold', async () => {
      // Use 50% of daily tokens
      const dailyLimit = TIER_LIMITS.free.daily_tokens;
      service.recordUsage('universe-123', dailyLimit * 0.5, 'test');

      await service.checkAndEmitWarnings(mockExecutionContext, 'universe-123');

      expect(observabilityEventsService.push).not.toHaveBeenCalled();
    });

    it('should emit critical warning at 95%', async () => {
      const dailyLimit = TIER_LIMITS.free.daily_tokens;
      service.recordUsage('universe-123', dailyLimit * 0.96, 'test');

      await service.checkAndEmitWarnings(mockExecutionContext, 'universe-123');

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            warning_level: 'critical',
          }),
        }),
      );
    });

    it('should emit high warning at 90%', async () => {
      const dailyLimit = TIER_LIMITS.free.daily_tokens;
      service.recordUsage('universe-123', dailyLimit * 0.91, 'test');

      await service.checkAndEmitWarnings(mockExecutionContext, 'universe-123');

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            warning_level: 'high',
          }),
        }),
      );
    });
  });

  describe('resetUsage', () => {
    it('should reset usage for universe', () => {
      service.recordUsage('universe-123', 1000, 'test');
      expect(service.getUsage('universe-123').daily_tokens).toBe(1000);

      service.resetUsage('universe-123');

      const usage = service.getUsage('universe-123');
      expect(usage.daily_tokens).toBe(0);
    });
  });

  describe('TIER_LIMITS', () => {
    it('should have limits for all tiers', () => {
      expect(TIER_LIMITS.free).toBeDefined();
      expect(TIER_LIMITS.pro).toBeDefined();
      expect(TIER_LIMITS.enterprise).toBeDefined();
    });

    it('should have required fields for each tier', () => {
      for (const tier of ['free', 'pro', 'enterprise'] as const) {
        const limits = TIER_LIMITS[tier];
        expect(limits.daily_tokens).toBeGreaterThan(0);
        expect(limits.monthly_tokens).toBeGreaterThan(0);
        expect(limits.daily_requests).toBeGreaterThan(0);
        expect(limits.monthly_requests).toBeGreaterThan(0);
      }
    });
  });

  describe('LOCAL_PROVIDERS', () => {
    it('should include ollama', () => {
      expect(LOCAL_PROVIDERS).toContain('ollama');
    });
  });

  describe('counter reset logic', () => {
    it('should initialize with current date for reset tracking', () => {
      // Just accessing getUsage triggers initialization
      const usage = service.getUsage('new-universe-reset');

      // New universe should have zero tokens
      expect(usage.daily_tokens).toBe(0);
      expect(usage.monthly_tokens).toBe(0);
    });
  });
});
