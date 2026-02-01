import { Test, TestingModule } from '@nestjs/testing';
import { OutcomeTrackingRunner } from '../outcome-tracking.runner';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { TargetSnapshotRepository } from '../../repositories/target-snapshot.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { OutcomeTrackingService } from '../../services/outcome-tracking.service';
import { TargetSnapshotService } from '../../services/target-snapshot.service';
import { PositionResolutionService } from '../../services/position-resolution.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { Prediction } from '../../interfaces/prediction.interface';

describe('OutcomeTrackingRunner', () => {
  let runner: OutcomeTrackingRunner;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let targetSnapshotRepository: jest.Mocked<TargetSnapshotRepository>;
  let outcomeTrackingService: jest.Mocked<OutcomeTrackingService>;
  let targetSnapshotService: jest.Mocked<TargetSnapshotService>;

  const mockPrediction: Prediction = {
    id: 'prediction-1',
    target_id: 'target-1',
    task_id: null,
    direction: 'up',
    magnitude: 'medium',
    confidence: 0.75,
    timeframe_hours: 24,
    expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    predicted_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
    reasoning: 'Strong bullish signals',
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'active',
    entry_price: null,
    target_price: null,
    stop_loss: null,
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSnapshot = {
    id: 'snapshot-1',
    target_id: 'target-1',
    value: 150.0,
    value_type: 'price' as const,
    captured_at: new Date().toISOString(),
    source: 'polygon' as const,
    metadata: {},
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeTrackingRunner,
        {
          provide: PredictionRepository,
          useValue: {
            findActivePredictions: jest.fn(),
          },
        },
        {
          provide: TargetSnapshotRepository,
          useValue: {
            findClosestToTime: jest.fn(),
            findLatest: jest.fn(),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: OutcomeTrackingService,
          useValue: {
            captureOutcome: jest.fn(),
            resolvePrediction: jest.fn(),
            expirePredictions: jest.fn(),
            getPendingResolutionPredictions: jest.fn(),
          },
        },
        {
          provide: TargetSnapshotService,
          useValue: {
            fetchAndCaptureValue: jest.fn(),
          },
        },
        {
          provide: PositionResolutionService,
          useValue: {
            resolvePosition: jest.fn(),
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

    runner = module.get<OutcomeTrackingRunner>(OutcomeTrackingRunner);
    predictionRepository = module.get(PredictionRepository);
    targetSnapshotRepository = module.get(TargetSnapshotRepository);
    outcomeTrackingService = module.get(OutcomeTrackingService);
    targetSnapshotService = module.get(TargetSnapshotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runOutcomeTracking', () => {
    it('should capture snapshots for active predictions', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([
        mockPrediction,
      ]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );
      outcomeTrackingService.getPendingResolutionPredictions.mockResolvedValue(
        [],
      );
      outcomeTrackingService.expirePredictions.mockResolvedValue([]);

      const result = await runner.runOutcomeTracking();

      expect(result.snapshotsCaptured).toBe(1);
      expect(targetSnapshotService.fetchAndCaptureValue).toHaveBeenCalledWith(
        'target-1',
      );
    });

    it('should resolve predictions past their timeframe', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([]);
      outcomeTrackingService.getPendingResolutionPredictions.mockResolvedValue([
        mockPrediction,
      ]);
      targetSnapshotRepository.findClosestToTime.mockResolvedValue({
        ...mockSnapshot,
        value: 145.0,
        captured_at: mockPrediction.predicted_at,
      } as never);
      targetSnapshotRepository.findLatest.mockResolvedValue({
        ...mockSnapshot,
        value: 150.0,
      } as never);
      outcomeTrackingService.resolvePrediction.mockResolvedValue(
        mockPrediction,
      );
      outcomeTrackingService.expirePredictions.mockResolvedValue([]);

      const result = await runner.runOutcomeTracking();

      expect(result.predictionsResolved).toBe(1);
      expect(outcomeTrackingService.resolvePrediction).toHaveBeenCalled();
    });

    it('should expire old predictions', async () => {
      predictionRepository.findActivePredictions.mockResolvedValue([]);
      outcomeTrackingService.getPendingResolutionPredictions.mockResolvedValue(
        [],
      );
      outcomeTrackingService.expirePredictions.mockResolvedValue([
        mockPrediction,
      ]);

      const result = await runner.runOutcomeTracking();

      expect(result.predictionsExpired).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      predictionRepository.findActivePredictions.mockRejectedValue(
        new Error('DB error'),
      );
      outcomeTrackingService.getPendingResolutionPredictions.mockResolvedValue(
        [],
      );
      outcomeTrackingService.expirePredictions.mockResolvedValue([]);

      const result = await runner.runOutcomeTracking();

      expect(result.errors).toBeGreaterThan(0);
    });
  });

  describe('captureOutcomeManually', () => {
    it('should capture outcome for a specific prediction', async () => {
      outcomeTrackingService.captureOutcome.mockResolvedValue(mockPrediction);

      const result = await runner.captureOutcomeManually('prediction-1', 5.5);

      expect(result.success).toBe(true);
      expect(outcomeTrackingService.captureOutcome).toHaveBeenCalledWith(
        'prediction-1',
        5.5,
      );
    });

    it('should handle errors', async () => {
      outcomeTrackingService.captureOutcome.mockRejectedValue(
        new Error('Not found'),
      );

      const result = await runner.captureOutcomeManually('prediction-1', 5.5);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });
  });

  describe('resolveManually', () => {
    it('should resolve a specific prediction', async () => {
      outcomeTrackingService.resolvePrediction.mockResolvedValue(
        mockPrediction,
      );

      const result = await runner.resolveManually('prediction-1', 5.5);

      expect(result.success).toBe(true);
      expect(outcomeTrackingService.resolvePrediction).toHaveBeenCalledWith(
        'prediction-1',
        5.5,
      );
    });
  });
});
