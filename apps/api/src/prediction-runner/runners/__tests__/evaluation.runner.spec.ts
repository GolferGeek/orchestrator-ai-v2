import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationRunner } from '../evaluation.runner';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { LearningQueueRepository } from '../../repositories/learning-queue.repository';
import {
  EvaluationService,
  EvaluationResult,
} from '../../services/evaluation.service';
import { Prediction } from '../../interfaces/prediction.interface';

describe('EvaluationRunner', () => {
  let runner: EvaluationRunner;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let learningQueueRepository: jest.Mocked<LearningQueueRepository>;
  let evaluationService: jest.Mocked<EvaluationService>;

  const mockPrediction: Prediction = {
    id: 'prediction-1',
    target_id: 'target-1',
    task_id: null,
    direction: 'up',
    magnitude: 'medium',
    confidence: 0.75,
    timeframe_hours: 24,
    expires_at: new Date().toISOString(),
    predicted_at: new Date().toISOString(),
    reasoning: 'Strong bullish signals',
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'resolved',
    entry_price: null,
    target_price: null,
    stop_loss: null,
    outcome_value: 5.5,
    outcome_captured_at: new Date().toISOString(),
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockEvaluationResult: EvaluationResult = {
    predictionId: 'prediction-1',
    directionCorrect: true,
    magnitudeAccuracy: 0.8,
    timingAccuracy: 0.9,
    overallScore: 0.85,
    actualDirection: 'up',
    actualMagnitude: 5.5,
    details: {
      predictedDirection: 'up',
      predictedMagnitude: 5.0,
      predictedConfidence: 0.75,
      horizonHours: 24,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationRunner,
        {
          provide: PredictionRepository,
          useValue: {
            findResolvedWithoutEvaluation: jest.fn(),
          },
        },
        {
          provide: LearningQueueRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: EvaluationService,
          useValue: {
            evaluatePrediction: jest.fn(),
            generateLearnings: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<EvaluationRunner>(EvaluationRunner);
    predictionRepository = module.get(PredictionRepository);
    learningQueueRepository = module.get(LearningQueueRepository);
    evaluationService = module.get(EvaluationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runEvaluationBatch', () => {
    it('should evaluate resolved predictions', async () => {
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue([
        mockPrediction,
      ]);
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );
      evaluationService.generateLearnings.mockReturnValue([]);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(1);
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(0);
    });

    it('should track incorrect predictions', async () => {
      const wrongResult: EvaluationResult = {
        ...mockEvaluationResult,
        directionCorrect: false,
      };
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue([
        mockPrediction,
      ]);
      evaluationService.evaluatePrediction.mockResolvedValue(wrongResult);
      evaluationService.generateLearnings.mockReturnValue([]);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(1);
      expect(result.correct).toBe(0);
      expect(result.incorrect).toBe(1);
    });

    it('should generate and queue learnings when enough evaluations', async () => {
      const predictions = Array(5)
        .fill(mockPrediction)
        .map((p, i) => ({
          ...p,
          id: `prediction-${i}`,
        }));
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue(
        predictions,
      );
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );
      evaluationService.generateLearnings.mockReturnValue([
        {
          type: 'pattern' as const,
          scope: 'runner' as const,
          content: 'Test learning',
          reason: 'Test reason',
          sourceEvaluationId: 'prediction-1',
        },
      ]);
      learningQueueRepository.create.mockResolvedValue({} as never);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(5);
      expect(result.learningsSuggested).toBe(1);
      expect(learningQueueRepository.create).toHaveBeenCalled();
    });

    it('should not generate learnings with too few evaluations', async () => {
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue([
        mockPrediction,
      ]);
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );
      evaluationService.generateLearnings.mockReturnValue([]);

      const result = await runner.runEvaluationBatch();

      expect(result.learningsSuggested).toBe(0);
      expect(evaluationService.generateLearnings).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue([
        mockPrediction,
      ]);
      evaluationService.evaluatePrediction.mockRejectedValue(
        new Error('Evaluation failed'),
      );

      const result = await runner.runEvaluationBatch();

      expect(result.errors).toBe(1);
    });

    it('should return early when no predictions to evaluate', async () => {
      predictionRepository.findResolvedWithoutEvaluation.mockResolvedValue([]);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(0);
      expect(evaluationService.evaluatePrediction).not.toHaveBeenCalled();
    });
  });

  describe('evaluateManually', () => {
    it('should evaluate a specific prediction', async () => {
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );

      const result = await runner.evaluateManually('prediction-1');

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mockEvaluationResult);
    });

    it('should handle errors', async () => {
      evaluationService.evaluatePrediction.mockRejectedValue(
        new Error('Not found'),
      );

      const result = await runner.evaluateManually('prediction-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });
  });
});
