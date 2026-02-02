import { Test, TestingModule } from '@nestjs/testing';
import { BaselinePredictionRunner } from '../baseline-prediction.runner';
import { BaselinePredictionService } from '../../services/baseline-prediction.service';

describe('BaselinePredictionRunner', () => {
  let runner: BaselinePredictionRunner;
  let baselinePredictionService: jest.Mocked<BaselinePredictionService>;

  const mockResult = {
    created: 5,
    skipped: 10,
    errors: 0,
    targets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaselinePredictionRunner,
        {
          provide: BaselinePredictionService,
          useValue: {
            createBaselinePredictions: jest.fn().mockResolvedValue(mockResult),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    runner = module.get<BaselinePredictionRunner>(BaselinePredictionRunner);
    baselinePredictionService = module.get(BaselinePredictionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runForDate', () => {
    it('should create baseline predictions for date', async () => {
      const result = await runner.runForDate('2024-01-15');

      expect(result).toEqual(mockResult);
      expect(baselinePredictionService.createBaselinePredictions).toHaveBeenCalledWith('2024-01-15', undefined);
    });

    it('should create baseline predictions for date with universe filter', async () => {
      const result = await runner.runForDate('2024-01-15', 'universe-123');

      expect(result).toEqual(mockResult);
      expect(baselinePredictionService.createBaselinePredictions).toHaveBeenCalledWith('2024-01-15', 'universe-123');
    });

    it('should return null when already running', async () => {
      // Start a run that won't complete
      const firstRun = runner.runForDate('2024-01-15');

      // Try to start another run immediately
      const secondRun = await runner.runForDate('2024-01-16');

      expect(secondRun).toBeNull();

      // Wait for first run to complete
      await firstRun;
    });

    it('should handle errors from service', async () => {
      baselinePredictionService.createBaselinePredictions.mockRejectedValue(new Error('Service failed'));

      await expect(runner.runForDate('2024-01-15')).rejects.toThrow('Service failed');
    });

    it('should reset isRunning flag after error', async () => {
      baselinePredictionService.createBaselinePredictions.mockRejectedValueOnce(new Error('Service failed'));

      try {
        await runner.runForDate('2024-01-15');
      } catch {
        // Ignore error
      }

      // Should be able to run again after error
      baselinePredictionService.createBaselinePredictions.mockResolvedValue(mockResult);
      const result = await runner.runForDate('2024-01-16');
      expect(result).toEqual(mockResult);
    });
  });

  describe('manualRun', () => {
    it('should call runForDate with provided parameters', async () => {
      const result = await runner.manualRun('2024-01-15');

      expect(result).toEqual(mockResult);
    });

    it('should call runForDate with universe filter', async () => {
      const result = await runner.manualRun('2024-01-15', 'universe-123');

      expect(result).toEqual(mockResult);
      expect(baselinePredictionService.createBaselinePredictions).toHaveBeenCalledWith('2024-01-15', 'universe-123');
    });
  });

  describe('getStatus', () => {
    it('should return isRunning false when idle', () => {
      const status = runner.getStatus();

      expect(status).toEqual({ isRunning: false });
    });

    it('should return isRunning true when running', async () => {
      // Create a promise that we can control
      let resolveService: (value: typeof mockResult) => void;
      const servicePromise = new Promise<typeof mockResult>((resolve) => {
        resolveService = resolve;
      });
      baselinePredictionService.createBaselinePredictions.mockReturnValue(servicePromise);

      // Start the run
      const runPromise = runner.runForDate('2024-01-15');

      // Check status while running
      expect(runner.getStatus()).toEqual({ isRunning: true });

      // Complete the run
      resolveService!(mockResult);
      await runPromise;

      // Check status after completion
      expect(runner.getStatus()).toEqual({ isRunning: false });
    });
  });

  describe('runBaselineCreation (cron)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should run baseline creation for today', async () => {
      await runner.runBaselineCreation();

      expect(baselinePredictionService.createBaselinePredictions).toHaveBeenCalled();
    });

    it('should not run when disabled via environment variable', async () => {
      process.env.DISABLE_PREDICTION_RUNNERS = 'true';

      await runner.runBaselineCreation();

      expect(baselinePredictionService.createBaselinePredictions).not.toHaveBeenCalled();
    });
  });

  describe('result handling', () => {
    it('should handle result with zero created', async () => {
      baselinePredictionService.createBaselinePredictions.mockResolvedValue({
        created: 0,
        skipped: 15,
        errors: 0,
        targets: [],
      });

      const result = await runner.runForDate('2024-01-15');

      expect(result?.created).toBe(0);
    });

    it('should handle result with errors', async () => {
      baselinePredictionService.createBaselinePredictions.mockResolvedValue({
        created: 3,
        skipped: 10,
        errors: 2,
        targets: ['AAPL', 'MSFT', 'GOOGL'],
      });

      const result = await runner.runForDate('2024-01-15');

      expect(result?.errors).toBe(2);
    });

    it('should handle result with many targets', async () => {
      const manyTargets = Array.from({ length: 20 }, (_, i) => `TARGET${i}`);
      baselinePredictionService.createBaselinePredictions.mockResolvedValue({
        created: 20,
        skipped: 5,
        errors: 0,
        targets: manyTargets,
      });

      const result = await runner.runForDate('2024-01-15');

      expect(result?.targets.length).toBe(20);
    });
  });
});
