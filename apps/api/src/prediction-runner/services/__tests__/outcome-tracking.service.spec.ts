import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeTrackingService } from '../outcome-tracking.service';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { Prediction } from '../../interfaces/prediction.interface';

describe('OutcomeTrackingService', () => {
  let service: OutcomeTrackingService;
  let predictionRepository: jest.Mocked<PredictionRepository>;

  const mockPrediction: Prediction = {
    id: 'pred-123',
    target_id: 'target-123',
    task_id: 'task-123',
    direction: 'up',
    confidence: 0.85,
    magnitude: 'medium',
    reasoning: 'Technical analysis shows bullish pattern',
    timeframe_hours: 24,
    predicted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    entry_price: 100.0,
    target_price: 110.0,
    stop_loss: 95.0,
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'active',
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeTrackingService,
        {
          provide: PredictionRepository,
          useValue: {
            update: jest.fn().mockResolvedValue(mockPrediction),
            resolve: jest.fn().mockResolvedValue({
              ...mockPrediction,
              status: 'resolved',
              outcome_value: 155.0,
            }),
            findPendingResolution: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<OutcomeTrackingService>(OutcomeTrackingService);
    predictionRepository = module.get(PredictionRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('captureOutcome', () => {
    it('should capture outcome value for a prediction', async () => {
      const value = 155.0;

      const result = await service.captureOutcome('pred-123', value);

      expect(predictionRepository.update).toHaveBeenCalledWith('pred-123', {
        outcome_value: value,
        outcome_captured_at: expect.any(String),
      });
      expect(result).toBeDefined();
    });

    it('should use provided timestamp when specified', async () => {
      const value = 155.0;
      const timestamp = new Date('2024-01-15T10:00:00Z');

      await service.captureOutcome('pred-123', value, timestamp);

      expect(predictionRepository.update).toHaveBeenCalledWith('pred-123', {
        outcome_value: value,
        outcome_captured_at: timestamp.toISOString(),
      });
    });

    it('should use current time when timestamp not provided', async () => {
      const value = 155.0;
      const beforeCall = new Date();

      await service.captureOutcome('pred-123', value);

      const call = predictionRepository.update.mock.calls[0];
      const capturedAt = new Date(call?.[1]?.outcome_captured_at as string);
      expect(capturedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    });

    it('should handle negative outcome values', async () => {
      const value = -10.5;

      await service.captureOutcome('pred-123', value);

      expect(predictionRepository.update).toHaveBeenCalledWith('pred-123', {
        outcome_value: value,
        outcome_captured_at: expect.any(String),
      });
    });

    it('should handle zero outcome value', async () => {
      const value = 0;

      await service.captureOutcome('pred-123', value);

      expect(predictionRepository.update).toHaveBeenCalledWith('pred-123', {
        outcome_value: 0,
        outcome_captured_at: expect.any(String),
      });
    });
  });

  describe('resolvePrediction', () => {
    it('should resolve prediction with outcome value', async () => {
      const outcomeValue = 155.0;

      const result = await service.resolvePrediction('pred-123', outcomeValue);

      expect(predictionRepository.resolve).toHaveBeenCalledWith(
        'pred-123',
        outcomeValue,
      );
      expect(result.status).toBe('resolved');
      expect(result.outcome_value).toBe(155.0);
    });

    it('should handle various outcome values', async () => {
      const testValues = [100.0, 0, -50.5, 999.99];

      for (const value of testValues) {
        await service.resolvePrediction('pred-123', value);

        expect(predictionRepository.resolve).toHaveBeenCalledWith(
          'pred-123',
          value,
        );
      }
    });
  });

  describe('expirePredictions', () => {
    it('should expire pending predictions', async () => {
      const pendingPredictions = [
        { ...mockPrediction, id: 'pred-1' },
        { ...mockPrediction, id: 'pred-2' },
      ];
      predictionRepository.findPendingResolution.mockResolvedValue(
        pendingPredictions,
      );

      const result = await service.expirePredictions();

      expect(predictionRepository.findPendingResolution).toHaveBeenCalled();
      expect(predictionRepository.update).toHaveBeenCalledTimes(2);
      expect(predictionRepository.update).toHaveBeenCalledWith('pred-1', {
        status: 'expired',
      });
      expect(predictionRepository.update).toHaveBeenCalledWith('pred-2', {
        status: 'expired',
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no predictions to expire', async () => {
      predictionRepository.findPendingResolution.mockResolvedValue([]);

      const result = await service.expirePredictions();

      expect(result).toEqual([]);
      expect(predictionRepository.update).not.toHaveBeenCalled();
    });

    it('should handle single prediction expiration', async () => {
      predictionRepository.findPendingResolution.mockResolvedValue([
        mockPrediction,
      ]);

      const result = await service.expirePredictions();

      expect(result).toHaveLength(1);
      expect(predictionRepository.update).toHaveBeenCalledWith('pred-123', {
        status: 'expired',
      });
    });
  });

  describe('getPendingResolutionPredictions', () => {
    it('should return predictions pending resolution', async () => {
      const pendingPredictions = [
        { ...mockPrediction, id: 'pred-1' },
        { ...mockPrediction, id: 'pred-2' },
        { ...mockPrediction, id: 'pred-3' },
      ];
      predictionRepository.findPendingResolution.mockResolvedValue(
        pendingPredictions,
      );

      const result = await service.getPendingResolutionPredictions();

      expect(predictionRepository.findPendingResolution).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no pending predictions', async () => {
      predictionRepository.findPendingResolution.mockResolvedValue([]);

      const result = await service.getPendingResolutionPredictions();

      expect(result).toEqual([]);
    });
  });
});
