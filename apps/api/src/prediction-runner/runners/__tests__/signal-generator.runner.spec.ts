import { Test, TestingModule } from '@nestjs/testing';
import { SignalGeneratorRunner } from '../signal-generator.runner';
import { ArticleProcessorService } from '../../services/article-processor.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('SignalGeneratorRunner', () => {
  let runner: SignalGeneratorRunner;
  let articleProcessorService: jest.Mocked<ArticleProcessorService>;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockProcessAllTargetsResult = {
    articles_processed: 5,
    predictors_created: 3,
    targets_affected: 1,
    errors: [] as string[],
  };

  const mockProcessTargetResult = {
    subscription_id: 'sub-123',
    target_id: 'target-123',
    articles_processed: 5,
    predictors_created: 3,
    articles_skipped: 1,
    errors: [] as string[],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalGeneratorRunner,
        {
          provide: ArticleProcessorService,
          useValue: {
            processTarget: jest.fn().mockResolvedValue(mockProcessTargetResult),
            processAllTargets: jest
              .fn()
              .mockResolvedValue(mockProcessAllTargetsResult),
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
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DISABLE_SIGNAL_GENERATION;
    delete process.env.DISABLE_PREDICTION_RUNNERS;
  });

  describe('generatePredictorsForAllTargets', () => {
    it('should generate predictors for all active targets', async () => {
      const result = await runner.generatePredictorsForAllTargets();

      expect(result.targets_affected).toBe(1);
      expect(result.articles_processed).toBe(5);
      expect(result.predictors_created).toBe(3);
      expect(result.errors).toEqual([]);
      expect(articleProcessorService.processAllTargets).toHaveBeenCalled();
    });

    it('should process multiple targets', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 15,
        predictors_created: 9,
        targets_affected: 3,
        errors: [],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.targets_affected).toBe(3);
      expect(result.articles_processed).toBe(15);
      expect(result.predictors_created).toBe(9);
      expect(articleProcessorService.processAllTargets).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should return early when no active targets found', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 0,
        predictors_created: 0,
        targets_affected: 0,
        errors: [],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.targets_affected).toBe(0);
      expect(result.articles_processed).toBe(0);
      expect(result.predictors_created).toBe(0);
    });

    it('should return early when already running', async () => {
      // Create a controlled promise to simulate a long-running task
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      articleProcessorService.processAllTargets.mockImplementationOnce(
        async () => {
          await firstPromise;
          return mockProcessAllTargetsResult;
        },
      );

      // Start first run
      const firstRun = runner.generatePredictorsForAllTargets();

      // Try to start second run while first is running
      const secondResult = await runner.generatePredictorsForAllTargets();

      expect(secondResult.targets_affected).toBe(0);
      expect(secondResult.articles_processed).toBe(0);
      expect(secondResult.predictors_created).toBe(0);

      // Complete first run
      resolveFirst!();
      await firstRun;
    });

    it('should handle errors from article processor', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 5,
        predictors_created: 2,
        targets_affected: 1,
        errors: ['Processing error'],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Processing error');
    });

    it('should collect errors from article processor results', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 5,
        predictors_created: 2,
        targets_affected: 1,
        errors: ['Article 1 failed', 'Article 2 failed'],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.errors).toContain('Article 1 failed');
      expect(result.errors).toContain('Article 2 failed');
    });

    it('should send observability events', async () => {
      await runner.generatePredictorsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledTimes(2);
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'predictor.generation.started',
          status: 'started',
        }),
      );
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'predictor.generation.completed',
          status: 'completed',
        }),
      );
    });

    it('should continue processing when errors occur', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 5,
        predictors_created: 3,
        targets_affected: 1,
        errors: ['First target failed'],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.targets_affected).toBe(1);
      expect(result.articles_processed).toBe(5);
      expect(result.errors.length).toBe(1);
    });

    it('should reset isRunning flag after error', async () => {
      articleProcessorService.processAllTargets.mockRejectedValueOnce(
        new Error('Database error'),
      );

      try {
        await runner.generatePredictorsForAllTargets();
      } catch {
        // Ignore error
      }

      // Should be able to run again after error
      articleProcessorService.processAllTargets.mockResolvedValue(
        mockProcessAllTargetsResult,
      );
      const result = await runner.generatePredictorsForAllTargets();
      expect(result).toBeDefined();
    });
  });

  describe('generateSignalsForAllTargets (legacy)', () => {
    it('should call generatePredictorsForAllTargets', async () => {
      const result = await runner.generateSignalsForAllTargets();

      expect(result.targets_affected).toBe(1);
      expect(result.articles_processed).toBe(5);
      expect(result.predictors_created).toBe(3);
      expect(articleProcessorService.processAllTargets).toHaveBeenCalled();
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

      expect(articleProcessorService.processAllTargets).toHaveBeenCalled();
    });

    it('should not run when DISABLE_SIGNAL_GENERATION is true', async () => {
      process.env.DISABLE_SIGNAL_GENERATION = 'true';

      await runner.processArticles();

      expect(articleProcessorService.processAllTargets).not.toHaveBeenCalled();
    });

    it('should not run when DISABLE_PREDICTION_RUNNERS is true', async () => {
      process.env.DISABLE_PREDICTION_RUNNERS = 'true';

      await runner.processArticles();

      expect(articleProcessorService.processAllTargets).not.toHaveBeenCalled();
    });
  });

  describe('result handling', () => {
    it('should handle zero articles processed', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 0,
        predictors_created: 0,
        targets_affected: 0,
        errors: [],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.articles_processed).toBe(0);
      expect(result.predictors_created).toBe(0);
    });

    it('should handle large number of articles', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 1000,
        predictors_created: 500,
        targets_affected: 10,
        errors: [],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.articles_processed).toBe(1000);
      expect(result.predictors_created).toBe(500);
    });

    it('should aggregate results from multiple targets', async () => {
      articleProcessorService.processAllTargets.mockResolvedValue({
        articles_processed: 30,
        predictors_created: 13,
        targets_affected: 2,
        errors: ['Error 1', 'Error 2'],
      });

      const result = await runner.generatePredictorsForAllTargets();

      expect(result.targets_affected).toBe(2);
      expect(result.articles_processed).toBe(30);
      expect(result.predictors_created).toBe(13);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('execution context', () => {
    it('should create proper execution context for observability', async () => {
      await runner.generatePredictorsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            orgSlug: 'system',
            agentSlug: 'predictor-generator',
            agentType: 'runner',
          }),
          source_app: 'prediction-runner',
        }),
      );
    });

    it('should include completion payload', async () => {
      await runner.generatePredictorsForAllTargets();

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          payload: expect.objectContaining({
            articles_processed: 5,
            predictors_created: 3,
            targets_affected: 1,
            errors_count: 0,
          }),
        }),
      );
    });
  });
});
