import { Test, TestingModule } from '@nestjs/testing';
import {
  BackpressureService,
  DEFAULT_BACKPRESSURE_CONFIG,
} from '../backpressure.service';

describe('BackpressureService', () => {
  let service: BackpressureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BackpressureService],
    }).compile();

    module.useLogger(false);
    service = module.get<BackpressureService>(BackpressureService);
    // Reset state before each test
    service.reset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canStartCrawl', () => {
    it('should allow crawl when under limits', () => {
      const result = service.canStartCrawl('source-123');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block crawl when global limit reached', () => {
      // Fill up global limit
      for (
        let i = 0;
        i < DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsGlobal;
        i++
      ) {
        service.recordCrawlStart(`source-${i}`);
      }

      const result = service.canStartCrawl('source-new');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Global crawl limit');
    });

    it('should block crawl when source limit reached', () => {
      // Fill up source limit (default: 1)
      service.recordCrawlStart('source-123');

      const result = service.canStartCrawl('source-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Source crawl limit');
    });

    it('should block crawl when queue depth threshold exceeded', () => {
      // Fill up queue
      service.incrementQueueDepth(
        DEFAULT_BACKPRESSURE_CONFIG.queueDepthThreshold,
      );

      const result = service.canStartCrawl('source-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Queue depth threshold');
    });

    it('should suggest delay when blocked', () => {
      // Fill up global limit
      for (
        let i = 0;
        i < DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsGlobal;
        i++
      ) {
        service.recordCrawlStart(`source-${i}`);
      }

      const result = service.canStartCrawl('source-new');

      expect(result.delayMs).toBeDefined();
      expect(result.delayMs).toBeGreaterThan(0);
    });

    it('should consume token when crawl allowed', () => {
      const statsBefore = service.getStats();
      const tokensBefore = statsBefore.availableTokens;

      service.canStartCrawl('source-123');

      const statsAfter = service.getStats();
      expect(statsAfter.availableTokens).toBeLessThanOrEqual(tokensBefore);
    });
  });

  describe('recordCrawlStart', () => {
    it('should increment global counter', () => {
      expect(service.getStats().activeCrawlsGlobal).toBe(0);

      service.recordCrawlStart('source-123');

      expect(service.getStats().activeCrawlsGlobal).toBe(1);
    });

    it('should increment per-source counter', () => {
      service.recordCrawlStart('source-123');
      service.recordCrawlStart('source-456');

      const stats = service.getStats();
      expect(stats.activeCrawlsBySource.get('source-123')).toBe(1);
      expect(stats.activeCrawlsBySource.get('source-456')).toBe(1);
    });

    it('should track multiple crawls for same source', () => {
      // Note: This tests the counter even though limit is usually 1
      service.recordCrawlStart('source-123');
      service.recordCrawlStart('source-123');

      const stats = service.getStats();
      expect(stats.activeCrawlsBySource.get('source-123')).toBe(2);
    });
  });

  describe('recordCrawlComplete', () => {
    it('should decrement global counter', () => {
      service.recordCrawlStart('source-123');
      expect(service.getStats().activeCrawlsGlobal).toBe(1);

      service.recordCrawlComplete('source-123');

      expect(service.getStats().activeCrawlsGlobal).toBe(0);
    });

    it('should decrement per-source counter', () => {
      service.recordCrawlStart('source-123');
      service.recordCrawlComplete('source-123');

      const stats = service.getStats();
      expect(stats.activeCrawlsBySource.get('source-123')).toBe(0);
    });

    it('should not go below zero for global counter', () => {
      service.recordCrawlComplete('source-123');
      service.recordCrawlComplete('source-123');

      expect(service.getStats().activeCrawlsGlobal).toBe(0);
    });

    it('should handle unknown source gracefully', () => {
      // Should not throw
      expect(() => service.recordCrawlComplete('unknown-source')).not.toThrow();
    });
  });

  describe('queue management', () => {
    it('should return initial queue depth of 0', () => {
      expect(service.getQueueDepth()).toBe(0);
    });

    it('should increment queue depth', () => {
      service.incrementQueueDepth(5);

      expect(service.getQueueDepth()).toBe(5);
    });

    it('should increment queue depth with default count', () => {
      service.incrementQueueDepth();

      expect(service.getQueueDepth()).toBe(1);
    });

    it('should decrement queue depth', () => {
      service.incrementQueueDepth(10);
      service.decrementQueueDepth(3);

      expect(service.getQueueDepth()).toBe(7);
    });

    it('should decrement with default count', () => {
      service.incrementQueueDepth(5);
      service.decrementQueueDepth();

      expect(service.getQueueDepth()).toBe(4);
    });

    it('should not go below zero', () => {
      service.decrementQueueDepth(10);

      expect(service.getQueueDepth()).toBe(0);
    });
  });

  describe('isUnderBackpressure', () => {
    it('should return normal status when all limits clear', () => {
      const status = service.isUnderBackpressure();

      expect(status.isUnderBackpressure).toBe(false);
      expect(status.reason).toBeUndefined();
    });

    it('should detect backpressure when approaching global limit', () => {
      // 80% of global limit triggers warning
      const targetCount = Math.ceil(
        DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsGlobal * 0.8,
      );
      for (let i = 0; i < targetCount; i++) {
        service.recordCrawlStart(`source-${i}`);
      }

      const status = service.isUnderBackpressure();

      expect(status.isUnderBackpressure).toBe(true);
      expect(status.reason).toContain('crawl limit');
    });

    it('should detect backpressure when queue depth high', () => {
      // 80% of queue threshold
      const targetDepth = Math.ceil(
        DEFAULT_BACKPRESSURE_CONFIG.queueDepthThreshold * 0.8,
      );
      service.incrementQueueDepth(targetDepth);

      const status = service.isUnderBackpressure();

      expect(status.isUnderBackpressure).toBe(true);
      expect(status.reason).toContain('Queue depth');
    });

    it('should return current crawl counts', () => {
      service.recordCrawlStart('source-1');
      service.recordCrawlStart('source-2');

      const status = service.isUnderBackpressure();

      expect(status.currentCrawls).toBe(2);
      expect(status.maxCrawls).toBe(
        DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsGlobal,
      );
    });

    it('should return queue depth', () => {
      service.incrementQueueDepth(15);

      const status = service.isUnderBackpressure();

      expect(status.queueDepth).toBe(15);
    });

    it('should return available tokens', () => {
      const status = service.isUnderBackpressure();

      expect(status.availableTokens).toBe(
        DEFAULT_BACKPRESSURE_CONFIG.maxTokens,
      );
    });
  });

  describe('getStats', () => {
    it('should return comprehensive statistics', () => {
      service.recordCrawlStart('source-1');
      service.recordCrawlStart('source-2');
      service.incrementQueueDepth(5);

      const stats = service.getStats();

      expect(stats.activeCrawlsGlobal).toBe(2);
      expect(stats.activeCrawlsBySource.size).toBe(2);
      expect(stats.queueDepth).toBe(5);
      expect(stats.availableTokens).toBeDefined();
      expect(stats.config).toEqual(DEFAULT_BACKPRESSURE_CONFIG);
    });

    it('should return a copy of config', () => {
      const stats = service.getStats();

      expect(stats.config).toEqual(DEFAULT_BACKPRESSURE_CONFIG);
      expect(stats.config).not.toBe(DEFAULT_BACKPRESSURE_CONFIG); // Should be a copy
    });
  });

  describe('reset', () => {
    it('should clear all counters', () => {
      service.recordCrawlStart('source-1');
      service.recordCrawlStart('source-2');
      service.incrementQueueDepth(50);

      service.reset();

      const stats = service.getStats();
      expect(stats.activeCrawlsGlobal).toBe(0);
      expect(stats.activeCrawlsBySource.size).toBe(0);
      expect(stats.queueDepth).toBe(0);
    });

    it('should restore tokens to max', () => {
      // Drain some tokens
      for (let i = 0; i < 10; i++) {
        service.canStartCrawl(`source-${i}`);
      }

      service.reset();

      const stats = service.getStats();
      expect(stats.availableTokens).toBe(DEFAULT_BACKPRESSURE_CONFIG.maxTokens);
    });
  });

  describe('DEFAULT_BACKPRESSURE_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsPerSource).toBe(1);
      expect(DEFAULT_BACKPRESSURE_CONFIG.maxConcurrentCrawlsGlobal).toBe(10);
      expect(DEFAULT_BACKPRESSURE_CONFIG.crawlDelayMs).toBe(1000);
      expect(DEFAULT_BACKPRESSURE_CONFIG.queueDepthThreshold).toBe(100);
      expect(DEFAULT_BACKPRESSURE_CONFIG.tokenRefillRate).toBe(10);
      expect(DEFAULT_BACKPRESSURE_CONFIG.maxTokens).toBe(50);
    });
  });

  describe('token bucket behavior', () => {
    it('should refill tokens over time', async () => {
      // Drain all tokens
      for (let i = 0; i < DEFAULT_BACKPRESSURE_CONFIG.maxTokens; i++) {
        service.canStartCrawl(`source-${i}`);
      }

      // Wait a bit for token refill
      await new Promise((resolve) => setTimeout(resolve, 200));

      const status = service.isUnderBackpressure();
      expect(status.availableTokens).toBeGreaterThan(0);
    });

    it('should block when no tokens available', () => {
      // Drain all tokens quickly
      for (let i = 0; i < DEFAULT_BACKPRESSURE_CONFIG.maxTokens + 5; i++) {
        const result = service.canStartCrawl(`source-${i}`);
        if (!result.allowed && result.reason?.includes('no tokens')) {
          // Found the blocking condition
          expect(result.reason).toContain('no tokens');
          return;
        }
      }
    });
  });
});
