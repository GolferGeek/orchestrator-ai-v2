import { Test, TestingModule } from '@nestjs/testing';
import {
  ExternalIntegrationService,
  DEFAULT_RETRY_CONFIG,
} from '../external-integration.service';

describe('ExternalIntegrationService', () => {
  let service: ExternalIntegrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExternalIntegrationService],
    }).compile();

    module.useLogger(false);
    service = module.get<ExternalIntegrationService>(
      ExternalIntegrationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset all service health
    (['firecrawl', 'rss', 'price_api', 'llm', 'slack'] as const).forEach(
      (svc) => {
        service.resetServiceHealth(svc);
      },
    );
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await service.executeWithRetry('firecrawl', operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('success');

      const result = await service.executeWithRetry('firecrawl', operation, {
        initialDelayMs: 10,
        maxRetries: 3,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        service.executeWithRetry('firecrawl', operation, {
          maxRetries: 2,
          initialDelayMs: 10,
        }),
      ).rejects.toThrow('Always fails');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should timeout long operations', async () => {
      const operation = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 500)),
        );

      await expect(
        service.executeWithRetry('firecrawl', operation, {
          timeoutMs: 50,
          maxRetries: 0,
        }),
      ).rejects.toThrow('timed out');
    });

    it('should use custom retry config', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValue('success');

      const result = await service.executeWithRetry('firecrawl', operation, {
        maxRetries: 1,
        initialDelayMs: 5,
        timeoutMs: 5000,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should record success in health tracking', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await service.executeWithRetry('firecrawl', operation);

      const health = service.getServiceHealth('firecrawl');
      expect(health?.status).toBe('healthy');
      expect(health?.consecutiveFailures).toBe(0);
    });

    it('should record failures in health tracking', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      await expect(
        service.executeWithRetry('firecrawl', operation, {
          maxRetries: 2,
          initialDelayMs: 5,
        }),
      ).rejects.toThrow();

      const health = service.getServiceHealth('firecrawl');
      expect(health?.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('getServiceHealth', () => {
    it('should return health for tracked service', () => {
      const health = service.getServiceHealth('firecrawl');

      expect(health).toBeDefined();
      expect(health?.service).toBe('firecrawl');
      expect(health?.status).toBe('healthy');
    });

    it('should return null for untracked service', () => {
      const health = service.getServiceHealth('unknown' as 'firecrawl');

      expect(health).toBeNull();
    });

    it('should show degraded status after failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      try {
        await service.executeWithRetry('firecrawl', operation, {
          maxRetries: 0,
          initialDelayMs: 5,
        });
      } catch {
        // Expected
      }

      const health = service.getServiceHealth('firecrawl');
      expect(['degraded', 'down']).toContain(health?.status);
    });

    it('should show down status after multiple consecutive failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await service.executeWithRetry('firecrawl', operation, {
            maxRetries: 0,
            initialDelayMs: 5,
          });
        } catch {
          // Expected
        }
      }

      const health = service.getServiceHealth('firecrawl');
      expect(health?.status).toBe('down');
      expect(health?.consecutiveFailures).toBe(3);
    });
  });

  describe('getAllServiceHealth', () => {
    it('should return health for all services', () => {
      const allHealth = service.getAllServiceHealth();

      expect(allHealth).toHaveLength(5);
      expect(allHealth.map((h) => h.service)).toContain('firecrawl');
      expect(allHealth.map((h) => h.service)).toContain('rss');
      expect(allHealth.map((h) => h.service)).toContain('price_api');
      expect(allHealth.map((h) => h.service)).toContain('llm');
      expect(allHealth.map((h) => h.service)).toContain('slack');
    });
  });

  describe('isServiceHealthy', () => {
    it('should return true for healthy service', () => {
      expect(service.isServiceHealthy('firecrawl')).toBe(true);
    });

    it('should return false for unhealthy service', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await service.executeWithRetry('firecrawl', operation, {
            maxRetries: 0,
            initialDelayMs: 5,
          });
        } catch {
          // Expected
        }
      }

      expect(service.isServiceHealthy('firecrawl')).toBe(false);
    });
  });

  describe('resetServiceHealth', () => {
    it('should reset service health', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Fail'));

      try {
        await service.executeWithRetry('firecrawl', operation, {
          maxRetries: 0,
          initialDelayMs: 5,
        });
      } catch {
        // Expected
      }

      expect(service.getServiceHealth('firecrawl')?.consecutiveFailures).toBe(
        1,
      );

      service.resetServiceHealth('firecrawl');

      const health = service.getServiceHealth('firecrawl');
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.status).toBe('healthy');
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.timeoutMs).toBe(30000);
    });
  });

  describe('error rate calculation', () => {
    it('should calculate error rate from recent results', async () => {
      // Record some successes and failures
      const successOp = jest.fn().mockResolvedValue('ok');
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));

      // 3 successes
      for (let i = 0; i < 3; i++) {
        await service.executeWithRetry('firecrawl', successOp, {
          maxRetries: 0,
        });
      }

      // 1 failure
      try {
        await service.executeWithRetry('firecrawl', failOp, {
          maxRetries: 0,
          initialDelayMs: 5,
        });
      } catch {
        // Expected
      }

      const health = service.getServiceHealth('firecrawl');
      expect(health?.errorRate).toBe(0.25); // 1/4
    });
  });
});
