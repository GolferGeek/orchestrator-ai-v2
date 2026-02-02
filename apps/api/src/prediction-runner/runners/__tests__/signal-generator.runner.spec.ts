import { Test, TestingModule } from '@nestjs/testing';
import { SignalGeneratorRunner } from '../signal-generator.runner';
import { ArticleProcessorService } from '../../services/article-processor.service';
import { TargetRepository } from '../../repositories/target.repository';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('SignalGeneratorRunner', () => {
  let runner: SignalGeneratorRunner;
  let articleProcessorService: jest.Mocked<ArticleProcessorService>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockTarget = {
    id: 'target-123',
    symbol: 'AAPL',
    name: 'Apple Inc',
    target_type: 'stock' as const,
    universe_id: 'universe-123',
    context: null,
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockProcessResult = {
    subscription_id: 'sub-123',
    target_id: 'target-123',
    articles_processed: 5,
    signals_created: 3,
    signals_skipped: 1,
    errors: [] as string[],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalGeneratorRunner,
        {
          provide: ArticleProcessorService,
          useValue: {
            processTarget: jest.fn().mockResolvedValue(mockProcessResult),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findAllActive: jest.fn().mockResolvedValue([mockTarget]),
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
    runner = module.get<SignalGeneratorRunner>(SignalGeneratorRunner);
    articleProcessorService = module.get(ArticleProcessorService);
    targetRepository = module.get(TargetRepository);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DISABLE_SIGNAL_GENERATION;
    delete process.env.DISABLE_PREDICTION_RUNNERS;
  });

  describe('generateSignalsForAllTargets', () => {
    it('should generate signals for all active targets', async () => {
      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_processed).toBe(1);
      expect(result.total_articles).toBe(5);
      expect(result.total_signals).toBe(3);
      expect(result.errors).toEqual([]);
      expect(targetRepository.findAllActive).toHaveBeenCalled();
      expect(articleProcessorService.processTarget).toHaveBeenCalledWith(
        'target-123',
      );
    });

    it('should process multiple targets', async () => {
      const targets = [
        mockTarget,
        {
          ...mockTarget,
          id: 'target-456',
          symbol: 'MSFT',
          name: 'Microsoft Corp',
        },
        {
          ...mockTarget,
          id: 'target-789',
          symbol: 'GOOGL',
          name: 'Alphabet Inc',
        },
      ];
      targetRepository.findAllActive.mockResolvedValue(targets);

      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_processed).toBe(3);
      expect(result.total_articles).toBe(15); // 5 per target
      expect(result.total_signals).toBe(9); // 3 per target
      expect(articleProcessorService.processTarget).toHaveBeenCalledTimes(3);
    });

    it('should return early when no active targets found', async () => {
      targetRepository.findAllActive.mockResolvedValue([]);

      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_processed).toBe(0);
      expect(result.total_articles).toBe(0);
      expect(result.total_signals).toBe(0);
      expect(articleProcessorService.processTarget).not.toHaveBeenCalled();
    });

    it('should return early when already running', async () => {
      // Create a controlled promise to simulate a long-running task
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      targetRepository.findAllActive.mockImplementationOnce(async () => {
        await firstPromise;
        return [mockTarget];
      });

      // Start first run
      const firstRun = runner.generateSignalsForAllTargets();

      // Try to start second run while first is running
      const secondResult = await runner.generateSignalsForAllTargets();

      expect(secondResult.targets_processed).toBe(0);
      expect(secondResult.total_articles).toBe(0);
      expect(secondResult.total_signals).toBe(0);

      // Complete first run
      resolveFirst!();
      await firstRun;
    });

    it('should handle errors from article processor', async () => {
      articleProcessorService.processTarget.mockRejectedValue(
        new Error('Processing failed'),
      );

      const result = await runner.generateSignalsForAllTargets();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Failed to process target target-123');
    });

    it('should collect errors from article processor results', async () => {
      articleProcessorService.processTarget.mockResolvedValue({
        subscription_id: 'sub-123',
        target_id: 'target-123',
        articles_processed: 5,
        signals_created: 2,
        signals_skipped: 1,
        errors: ['Article 1 failed', 'Article 2 failed'],
      });

      const result = await runner.generateSignalsForAllTargets();

      expect(result.errors).toContain('Article 1 failed');
      expect(result.errors).toContain('Article 2 failed');
    });

    it('should send observability events', async () => {
      await runner.generateSignalsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledTimes(2);
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'signal.generation.started',
          status: 'started',
        }),
      );
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'signal.generation.completed',
          status: 'completed',
        }),
      );
    });

    it('should continue processing other targets when one fails', async () => {
      const targets = [
        mockTarget,
        {
          ...mockTarget,
          id: 'target-456',
          symbol: 'MSFT',
          name: 'Microsoft Corp',
        },
      ];
      targetRepository.findAllActive.mockResolvedValue(targets);

      articleProcessorService.processTarget
        .mockRejectedValueOnce(new Error('First target failed'))
        .mockResolvedValueOnce(mockProcessResult);

      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_processed).toBe(1);
      expect(result.total_articles).toBe(5);
      expect(result.errors.length).toBe(1);
      expect(articleProcessorService.processTarget).toHaveBeenCalledTimes(2);
    });

    it('should reset isRunning flag after error', async () => {
      targetRepository.findAllActive.mockRejectedValueOnce(
        new Error('Database error'),
      );

      try {
        await runner.generateSignalsForAllTargets();
      } catch {
        // Ignore error
      }

      // Should be able to run again after error
      targetRepository.findAllActive.mockResolvedValue([]);
      const result = await runner.generateSignalsForAllTargets();
      expect(result).toBeDefined();
    });
  });

  describe('generateSignalsForTarget', () => {
    it('should generate signals for a specific target', async () => {
      const result = await runner.generateSignalsForTarget('target-123');

      expect(result.articles_processed).toBe(5);
      expect(result.signals_created).toBe(3);
      expect(result.errors).toEqual([]);
      expect(articleProcessorService.processTarget).toHaveBeenCalledWith(
        'target-123',
      );
    });

    it('should handle errors gracefully', async () => {
      articleProcessorService.processTarget.mockRejectedValue(
        new Error('Target processing failed'),
      );

      const result = await runner.generateSignalsForTarget('target-123');

      expect(result.articles_processed).toBe(0);
      expect(result.signals_created).toBe(0);
      expect(result.errors).toContain('Target processing failed');
    });

    it('should handle non-Error exceptions', async () => {
      articleProcessorService.processTarget.mockRejectedValue('String error');

      const result = await runner.generateSignalsForTarget('target-123');

      expect(result.errors).toContain('Unknown error');
    });
  });

  describe('processArticles (cron)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should process articles when not disabled', async () => {
      await runner.processArticles();

      expect(targetRepository.findAllActive).toHaveBeenCalled();
    });

    it('should not run when DISABLE_SIGNAL_GENERATION is true', async () => {
      process.env.DISABLE_SIGNAL_GENERATION = 'true';

      await runner.processArticles();

      expect(targetRepository.findAllActive).not.toHaveBeenCalled();
    });

    it('should not run when DISABLE_PREDICTION_RUNNERS is true', async () => {
      process.env.DISABLE_PREDICTION_RUNNERS = 'true';

      await runner.processArticles();

      expect(targetRepository.findAllActive).not.toHaveBeenCalled();
    });
  });

  describe('result handling', () => {
    it('should handle zero articles processed', async () => {
      articleProcessorService.processTarget.mockResolvedValue({
        subscription_id: 'sub-123',
        target_id: 'target-123',
        articles_processed: 0,
        signals_created: 0,
        signals_skipped: 0,
        errors: [],
      });

      const result = await runner.generateSignalsForAllTargets();

      expect(result.total_articles).toBe(0);
      expect(result.total_signals).toBe(0);
    });

    it('should handle large number of articles', async () => {
      articleProcessorService.processTarget.mockResolvedValue({
        subscription_id: 'sub-123',
        target_id: 'target-123',
        articles_processed: 1000,
        signals_created: 500,
        signals_skipped: 100,
        errors: [],
      });

      const result = await runner.generateSignalsForAllTargets();

      expect(result.total_articles).toBe(1000);
      expect(result.total_signals).toBe(500);
    });

    it('should aggregate results from multiple targets', async () => {
      const targets = [
        mockTarget,
        {
          ...mockTarget,
          id: 'target-456',
          symbol: 'MSFT',
          name: 'Microsoft Corp',
        },
      ];
      targetRepository.findAllActive.mockResolvedValue(targets);

      articleProcessorService.processTarget
        .mockResolvedValueOnce({
          subscription_id: 'sub-1',
          target_id: 'target-123',
          articles_processed: 10,
          signals_created: 5,
          signals_skipped: 2,
          errors: ['Error 1'],
        })
        .mockResolvedValueOnce({
          subscription_id: 'sub-2',
          target_id: 'target-456',
          articles_processed: 20,
          signals_created: 8,
          signals_skipped: 3,
          errors: ['Error 2'],
        });

      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_processed).toBe(2);
      expect(result.total_articles).toBe(30);
      expect(result.total_signals).toBe(13);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('execution context', () => {
    it('should create proper execution context for observability', async () => {
      await runner.generateSignalsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            orgSlug: 'system',
            agentSlug: 'signal-generator',
            agentType: 'runner',
          }),
          source_app: 'prediction-runner',
        }),
      );
    });

    it('should include completion payload', async () => {
      await runner.generateSignalsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          payload: expect.objectContaining({
            targets_processed: 1,
            total_articles: 5,
            total_signals: 3,
          }),
        }),
      );
    });
  });
});
