import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationService, EvaluationResult } from '../evaluation.service';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { SnapshotService } from '../snapshot.service';
import { Prediction } from '../../interfaces/prediction.interface';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let snapshotService: jest.Mocked<SnapshotService>;

  const mockPrediction: Prediction = {
    id: 'pred-123',
    target_id: 'target-456',
    task_id: null,
    direction: 'up',
    confidence: 0.75,
    magnitude: 'medium',
    reasoning: 'Test prediction',
    timeframe_hours: 24,
    predicted_at: '2026-01-08T12:00:00Z',
    expires_at: '2026-01-09T12:00:00Z',
    entry_price: 100,
    target_price: 105,
    stop_loss: 95,
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'resolved',
    outcome_value: 5.5,
    outcome_captured_at: '2026-01-09T06:00:00Z',
    resolution_notes: null,
    created_at: '2026-01-08T12:00:00Z',
    updated_at: '2026-01-09T06:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationService,
        {
          provide: PredictionRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: SnapshotService,
          useValue: {
            buildSnapshotData: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EvaluationService>(EvaluationService);
    predictionRepository = module.get(PredictionRepository);
    snapshotService = module.get(SnapshotService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluatePrediction', () => {
    it('should throw error if prediction not found', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      await expect(service.evaluatePrediction('nonexistent')).rejects.toThrow(
        'Prediction not found: nonexistent',
      );
    });

    it('should throw error if prediction has no outcome value', async () => {
      const predictionWithoutOutcome = {
        ...mockPrediction,
        outcome_value: null,
      };
      predictionRepository.findById.mockResolvedValue(predictionWithoutOutcome);

      await expect(service.evaluatePrediction('pred-123')).rejects.toThrow(
        'has no outcome value',
      );
    });

    it('should correctly evaluate an accurate prediction (direction up, actual up)', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);
      predictionRepository.update.mockResolvedValue(mockPrediction);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.directionCorrect).toBe(true);
      expect(result.actualDirection).toBe('up');
      expect(result.predictionId).toBe('pred-123');
      expect(result.overallScore).toBeGreaterThan(0.5);
      expect(predictionRepository.update).toHaveBeenCalledWith(
        'pred-123',
        expect.objectContaining({
          resolution_notes: expect.stringContaining('direction=correct'),
        }),
      );
    });

    it('should correctly evaluate an incorrect prediction (predicted up, actual down)', async () => {
      const wrongPrediction = {
        ...mockPrediction,
        direction: 'up' as const,
        outcome_value: -5.0, // Actual went down
      };
      predictionRepository.findById.mockResolvedValue(wrongPrediction);
      predictionRepository.update.mockResolvedValue(wrongPrediction);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.directionCorrect).toBe(false);
      expect(result.actualDirection).toBe('down');
      expect(result.overallScore).toBeLessThan(0.5);
      expect(predictionRepository.update).toHaveBeenCalledWith(
        'pred-123',
        expect.objectContaining({
          resolution_notes: expect.stringContaining('direction=wrong'),
        }),
      );
    });

    it('should determine flat direction for small moves', async () => {
      const flatPrediction = {
        ...mockPrediction,
        direction: 'flat' as const,
        outcome_value: 0.3, // < 0.5% threshold
      };
      predictionRepository.findById.mockResolvedValue(flatPrediction);
      predictionRepository.update.mockResolvedValue(flatPrediction);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.actualDirection).toBe('flat');
      expect(result.directionCorrect).toBe(true);
    });

    it('should calculate correct magnitude accuracy for exact match', async () => {
      const exactMagnitude = {
        ...mockPrediction,
        magnitude: 'medium' as const, // 5.0 expected
        outcome_value: 5.0, // Exact match
      };
      predictionRepository.findById.mockResolvedValue(exactMagnitude);
      predictionRepository.update.mockResolvedValue(exactMagnitude);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.magnitudeAccuracy).toBe(1.0);
    });

    it('should calculate reduced magnitude accuracy for mismatches', async () => {
      const offMagnitude = {
        ...mockPrediction,
        magnitude: 'medium' as const, // 5.0 expected
        outcome_value: 10.0, // Double the prediction
      };
      predictionRepository.findById.mockResolvedValue(offMagnitude);
      predictionRepository.update.mockResolvedValue(offMagnitude);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.magnitudeAccuracy).toBeLessThan(1.0);
      expect(result.magnitudeAccuracy).toBeGreaterThan(0.0);
    });

    it('should calculate good timing accuracy for early outcomes', async () => {
      // Outcome captured 6 hours into 24 hour horizon = early
      const earlyOutcome = {
        ...mockPrediction,
        predicted_at: '2026-01-08T12:00:00Z',
        expires_at: '2026-01-09T12:00:00Z',
        outcome_captured_at: '2026-01-08T18:00:00Z', // 6 hours in
      };
      predictionRepository.findById.mockResolvedValue(earlyOutcome);
      predictionRepository.update.mockResolvedValue(earlyOutcome);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.timingAccuracy).toBeGreaterThanOrEqual(0.8);
    });

    it('should calculate reduced timing accuracy for late outcomes', async () => {
      // Outcome captured after expiration
      const lateOutcome = {
        ...mockPrediction,
        predicted_at: '2026-01-08T12:00:00Z',
        expires_at: '2026-01-09T12:00:00Z',
        outcome_captured_at: '2026-01-10T12:00:00Z', // 24 hours late
      };
      predictionRepository.findById.mockResolvedValue(lateOutcome);
      predictionRepository.update.mockResolvedValue(lateOutcome);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.timingAccuracy).toBeLessThan(0.8);
    });

    it('should handle null magnitude gracefully', async () => {
      const nullMagnitude = {
        ...mockPrediction,
        magnitude: null,
        outcome_value: 3.0,
      };
      predictionRepository.findById.mockResolvedValue(nullMagnitude);
      predictionRepository.update.mockResolvedValue(nullMagnitude);

      const result = await service.evaluatePrediction('pred-123');

      expect(result.magnitudeAccuracy).toBeGreaterThan(0);
      expect(result.details.predictedMagnitude).toBe(3.0); // Default value
    });
  });

  describe('generateLearnings', () => {
    it('should return empty array for empty evaluations', () => {
      const learnings = service.generateLearnings([]);
      expect(learnings).toEqual([]);
    });

    it('should suggest threshold increase for low accuracy', () => {
      const lowAccuracyEvaluations: EvaluationResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          predictionId: `pred-${i}`,
          directionCorrect: i < 3, // Only 30% correct
          magnitudeAccuracy: 0.5,
          timingAccuracy: 0.8,
          overallScore: 0.4,
          actualDirection: 'up' as const,
          actualMagnitude: 5,
          details: {
            predictedDirection: 'down' as const,
            predictedMagnitude: 5,
            predictedConfidence: 0.6,
            horizonHours: 24,
          },
        }));

      const learnings = service.generateLearnings(lowAccuracyEvaluations);

      expect(learnings.some((l) => l.type === 'threshold')).toBe(true);
      expect(
        learnings.some((l) => l.content.includes('confidence threshold')),
      ).toBe(true);
    });

    it('should identify magnitude underestimation pattern', () => {
      const underestimatedEvaluations: EvaluationResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          predictionId: `pred-${i}`,
          directionCorrect: true,
          magnitudeAccuracy: 0.3,
          timingAccuracy: 0.8,
          overallScore: 0.6,
          actualDirection: 'up' as const,
          actualMagnitude: 15, // Much larger than predicted
          details: {
            predictedDirection: 'up' as const,
            predictedMagnitude: 5, // Underestimated
            predictedConfidence: 0.7,
            horizonHours: 24,
          },
        }));

      const learnings = service.generateLearnings(underestimatedEvaluations);

      expect(learnings.some((l) => l.type === 'weight_adjustment')).toBe(true);
      expect(learnings.some((l) => l.content.includes('underestimating'))).toBe(
        true,
      );
    });

    it('should identify overconfidence pattern', () => {
      const overconfidentEvaluations: EvaluationResult[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          predictionId: `pred-${i}`,
          directionCorrect: false, // Wrong despite high confidence
          magnitudeAccuracy: 0.5,
          timingAccuracy: 0.8,
          overallScore: 0.3,
          actualDirection: 'down' as const,
          actualMagnitude: 5,
          details: {
            predictedDirection: 'up' as const,
            predictedMagnitude: 5,
            predictedConfidence: 0.9, // High confidence
            horizonHours: 24,
          },
        }));

      const learnings = service.generateLearnings(overconfidentEvaluations);

      expect(learnings.some((l) => l.type === 'avoid')).toBe(true);
      expect(learnings.some((l) => l.content.includes('High-confidence'))).toBe(
        true,
      );
    });

    it('should not generate learnings for good performance', () => {
      const goodEvaluations: EvaluationResult[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          predictionId: `pred-${i}`,
          directionCorrect: true, // 100% correct
          magnitudeAccuracy: 0.9,
          timingAccuracy: 0.9,
          overallScore: 0.9,
          actualDirection: 'up' as const,
          actualMagnitude: 5,
          details: {
            predictedDirection: 'up' as const,
            predictedMagnitude: 5,
            predictedConfidence: 0.7,
            horizonHours: 24,
          },
        }));

      const learnings = service.generateLearnings(goodEvaluations);

      expect(learnings.length).toBe(0);
    });
  });
});
