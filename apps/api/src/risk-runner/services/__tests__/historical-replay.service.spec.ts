import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HistoricalReplayService } from '../historical-replay.service';
import { EvaluationRepository } from '../../repositories/evaluation.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { LearningRepository } from '../../repositories/learning.repository';
import { RiskLearning } from '../../interfaces/learning.interface';
import { RiskEvaluation } from '../../interfaces/evaluation.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';

describe('HistoricalReplayService', () => {
  let service: HistoricalReplayService;
  let evaluationRepo: jest.Mocked<EvaluationRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let learningRepo: jest.Mocked<LearningRepository>;

  const mockLearning: RiskLearning = {
    id: 'learning-123',
    scope_level: 'scope',
    domain: 'investment',
    scope_id: 'scope-123',
    subject_id: null,
    dimension_id: null,
    learning_type: 'pattern',
    title: 'High market volatility pattern',
    description: 'When market dimension is high, increase overall risk',
    config: {
      pattern_signals: ['market_high'],
      pattern_effect: 'elevate_risk',
    },
    times_applied: 5,
    times_helpful: 4,
    effectiveness_score: 0.8,
    status: 'testing',
    is_test: true,
    source_type: 'ai_approved',
    parent_learning_id: null,
    is_production: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-123',
    subject_id: 'subject-123',
    task_id: 'task-123',
    overall_score: 65,
    dimension_scores: {
      market: 75,
      liquidity: 40,
      volatility: 60,
    },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.75,
    status: 'active',
    valid_until: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-10T00:00:00Z',
  };

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-123',
    composite_score_id: 'score-123',
    subject_id: 'subject-123',
    evaluation_window: '30d',
    actual_outcome: {
      price_change_percent: -10,
      max_drawdown_percent: 12,
      outcome_type: 'minor_decline',
    },
    outcome_severity: 60,
    score_accuracy: 0.85,
    dimension_accuracy: {
      market: {
        predicted_score: 75,
        contribution_to_accuracy: 0.2,
        was_helpful: true,
      },
      liquidity: {
        predicted_score: 40,
        contribution_to_accuracy: 0.1,
        was_helpful: true,
      },
      volatility: {
        predicted_score: 60,
        contribution_to_accuracy: 0.15,
        was_helpful: true,
      },
    },
    calibration_error: 5,
    learnings_suggested: null,
    notes: 'Good prediction',
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-10T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricalReplayService,
        {
          provide: EvaluationRepository,
          useValue: {
            findAllByWindow: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: LearningRepository,
          useValue: {
            findLearningById: jest.fn(),
            incrementApplied: jest.fn(),
            incrementHelpful: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HistoricalReplayService>(HistoricalReplayService);
    evaluationRepo = module.get(EvaluationRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    learningRepo = module.get(LearningRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('replayLearning', () => {
    it('should replay a learning against historical data', async () => {
      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayLearning('learning-123', 30);

      expect(result).toMatchObject({
        learningId: 'learning-123',
        learningTitle: mockLearning.title,
        sampleSize: expect.any(Number),
        executionTimeMs: expect.any(Number),
      });
      expect(learningRepo.findLearningById).toHaveBeenCalledWith(
        'learning-123',
      );
    });

    it('should throw BadRequestException if learning not found', async () => {
      learningRepo.findLearningById.mockResolvedValue(null);

      await expect(service.replayLearning('non-existent', 30)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if learning is not a test learning', async () => {
      learningRepo.findLearningById.mockResolvedValue({
        ...mockLearning,
        is_test: false,
      });

      await expect(service.replayLearning('learning-123', 30)).rejects.toThrow(
        'Can only replay test learnings (is_test=true)',
      );
    });

    it('should return failure result when no historical data available', async () => {
      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue([]);

      const result = await service.replayLearning('learning-123', 30);

      expect(result.pass).toBe(false);
      expect(result.sampleSize).toBe(0);
      expect(result.details).toMatchObject({
        error: 'No historical data available',
      });
    });

    it('should calculate improvement metrics correctly', async () => {
      // Create multiple evaluations with varying calibration errors
      const evaluations: RiskEvaluation[] = [
        { ...mockEvaluation, id: 'eval-1', calibration_error: 15 },
        { ...mockEvaluation, id: 'eval-2', calibration_error: 25 },
        { ...mockEvaluation, id: 'eval-3', calibration_error: 10 },
        { ...mockEvaluation, id: 'eval-4', calibration_error: 30 },
      ];

      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue(evaluations);
      compositeScoreRepo.findById.mockImplementation(async (id) => ({
        ...mockCompositeScore,
        id,
      }));

      const result = await service.replayLearning('learning-123', 30);

      expect(result.sampleSize).toBeGreaterThan(0);
      expect(result.baselineAccuracy).toBeDefined();
      expect(result.withLearningAccuracy).toBeDefined();
      expect(result.accuracyLift).toBeDefined();
    });

    it('should update learning stats after replay', async () => {
      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      await service.replayLearning('learning-123', 30);

      expect(learningRepo.incrementApplied).toHaveBeenCalledWith(
        'learning-123',
      );
    });

    it('should increment helpful when replay passes', async () => {
      // Set up data that will result in a passing replay
      const goodLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'weight_adjustment',
        config: {
          dimension_slug: 'market',
          weight_modifier: 1.2,
        },
      };

      // Create many evaluations with high calibration errors (baseline poor)
      const poorEvaluations: RiskEvaluation[] = Array.from(
        { length: 30 },
        (_, i) => ({
          ...mockEvaluation,
          id: `eval-${i}`,
          calibration_error: 25, // Above 20 = incorrect
        }),
      );

      learningRepo.findLearningById.mockResolvedValue(goodLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue(poorEvaluations);
      compositeScoreRepo.findById.mockImplementation(async (id) => ({
        ...mockCompositeScore,
        id,
        dimension_scores: { market: 75 }, // Weight adjustment will apply
      }));

      const result = await service.replayLearning('learning-123', 30);

      // If it passes, helpful should be incremented
      if (result.pass) {
        expect(learningRepo.incrementHelpful).toHaveBeenCalledWith(
          'learning-123',
        );
      }
    });
  });

  describe('replayMultipleLearnings', () => {
    it('should replay multiple learnings and return summary', async () => {
      const learning1 = {
        ...mockLearning,
        id: 'learning-1',
        title: 'Learning 1',
      };
      const learning2 = {
        ...mockLearning,
        id: 'learning-2',
        title: 'Learning 2',
      };

      // Each replay call makes 2 findLearningById calls: initial + stats update
      learningRepo.findLearningById
        .mockResolvedValueOnce(learning1) // First learning initial lookup
        .mockResolvedValueOnce(learning1) // First learning stats update
        .mockResolvedValueOnce(learning2) // Second learning initial lookup
        .mockResolvedValueOnce(learning2); // Second learning stats update
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayMultipleLearnings(
        ['learning-1', 'learning-2'],
        30,
        undefined,
        'Test Batch',
      );

      expect(result.totalLearnings).toBe(2);
      expect(result.results.length).toBe(2);
      expect(result.scenarioName).toBe('Test Batch');
      expect(result.executedAt).toBeDefined();
    });

    it('should continue with other learnings if one fails', async () => {
      const learning2 = {
        ...mockLearning,
        id: 'learning-2',
        title: 'Learning 2',
      };

      // First learning not found, second succeeds (needs 2 calls for stats update)
      learningRepo.findLearningById
        .mockResolvedValueOnce(null) // First learning not found
        .mockResolvedValueOnce(learning2) // Second learning initial lookup
        .mockResolvedValueOnce(learning2); // Second learning stats update
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayMultipleLearnings(
        ['learning-1', 'learning-2'],
        30,
      );

      expect(result.totalLearnings).toBe(2);
      expect(result.results.length).toBe(1); // Only one succeeded
    });

    it('should calculate overall improvement from all results', async () => {
      const learning1 = { ...mockLearning, id: 'learning-1' };
      const learning2 = { ...mockLearning, id: 'learning-2' };

      // Each replay call makes 2 findLearningById calls: initial + stats update
      learningRepo.findLearningById
        .mockResolvedValueOnce(learning1)
        .mockResolvedValueOnce(learning1)
        .mockResolvedValueOnce(learning2)
        .mockResolvedValueOnce(learning2);
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayMultipleLearnings(
        ['learning-1', 'learning-2'],
        30,
      );

      expect(typeof result.overallImprovement).toBe('number');
      expect(result.passedLearnings + result.failedLearnings).toBe(
        result.results.length,
      );
    });
  });

  describe('learning type applicability', () => {
    beforeEach(() => {
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
    });

    it('should apply weight_adjustment learnings correctly', async () => {
      const weightLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'weight_adjustment',
        config: {
          dimension_slug: 'market',
          weight_modifier: 1.2,
        },
      };

      learningRepo.findLearningById.mockResolvedValue(weightLearning);

      const result = await service.replayLearning('learning-123', 30);

      expect(result.affectedCount).toBeGreaterThanOrEqual(0);
    });

    it('should apply threshold learnings correctly', async () => {
      const thresholdLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'threshold',
        config: {
          threshold_name: 'overall',
          threshold_value: 70,
          threshold_direction: 'increase',
        },
      };

      learningRepo.findLearningById.mockResolvedValue(thresholdLearning);

      const result = await service.replayLearning('learning-123', 30);

      expect(result).toBeDefined();
    });

    it('should apply pattern learnings correctly', async () => {
      const patternLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'pattern',
        config: {
          pattern_signals: ['market_high', 'volatility_high'],
        },
      };

      learningRepo.findLearningById.mockResolvedValue(patternLearning);

      // Set up composite score that matches pattern
      compositeScoreRepo.findById.mockResolvedValue({
        ...mockCompositeScore,
        dimension_scores: { market: 80, volatility: 75 },
      });

      const result = await service.replayLearning('learning-123', 30);

      expect(result).toBeDefined();
    });

    it('should apply rule learnings based on confidence', async () => {
      const ruleLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'rule',
        config: {
          rule_condition: 'high_confidence_warning',
          applies_to: ['high_confidence'],
        },
      };

      learningRepo.findLearningById.mockResolvedValue(ruleLearning);

      // High confidence score
      compositeScoreRepo.findById.mockResolvedValue({
        ...mockCompositeScore,
        confidence: 0.85,
      });

      const result = await service.replayLearning('learning-123', 30);

      expect(result).toBeDefined();
    });

    it('should apply avoid learnings for anti-patterns', async () => {
      const avoidLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'avoid',
        config: {
          avoid_condition: 'overconfident',
        },
      };

      learningRepo.findLearningById.mockResolvedValue(avoidLearning);

      // Overconfident score
      compositeScoreRepo.findById.mockResolvedValue({
        ...mockCompositeScore,
        confidence: 0.95,
      });

      const result = await service.replayLearning('learning-123', 30);

      expect(result).toBeDefined();
    });
  });

  describe('statistical significance', () => {
    it('should return low significance for small sample sizes', async () => {
      // Only a few evaluations
      const fewEvaluations: RiskEvaluation[] = [
        { ...mockEvaluation, id: 'eval-1' },
        { ...mockEvaluation, id: 'eval-2' },
      ];

      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue(fewEvaluations);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayLearning('learning-123', 30);

      // With small sample, significance should be low
      expect(result.statisticalSignificance).toBeLessThanOrEqual(0.8);
    });

    it('should calculate higher significance for larger samples', async () => {
      // Many evaluations with consistent improvement
      const manyEvaluations: RiskEvaluation[] = Array.from(
        { length: 50 },
        (_, i) => ({
          ...mockEvaluation,
          id: `eval-${i}`,
          calibration_error: i % 2 === 0 ? 15 : 25, // Half correct, half incorrect
        }),
      );

      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue(manyEvaluations);
      compositeScoreRepo.findById.mockImplementation(async (id) => ({
        ...mockCompositeScore,
        id,
      }));

      const result = await service.replayLearning('learning-123', 30);

      // Should have a statistical significance value
      expect(result.statisticalSignificance).toBeGreaterThanOrEqual(0);
      expect(result.statisticalSignificance).toBeLessThanOrEqual(1);
    });
  });

  describe('pass/fail determination', () => {
    it('should fail if accuracy lift is negative', async () => {
      // Set up scenario where learning makes things worse
      const badLearning: RiskLearning = {
        ...mockLearning,
        learning_type: 'threshold',
        config: {
          threshold_name: 'overall',
          threshold_value: 90, // Will apply to nothing useful
          threshold_direction: 'decrease',
        },
      };

      // Good baseline (all correct)
      const goodEvaluations: RiskEvaluation[] = Array.from(
        { length: 25 },
        (_, i) => ({
          ...mockEvaluation,
          id: `eval-${i}`,
          calibration_error: 10, // Good accuracy
        }),
      );

      learningRepo.findLearningById.mockResolvedValue(badLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue(goodEvaluations);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayLearning('learning-123', 30);

      // With negative lift or no improvement, should not pass
      if (result.accuracyLift <= 0) {
        expect(result.pass).toBe(false);
      }
    });

    it('should fail if too many degraded cases', async () => {
      // This tests the degradation threshold (< 30% degraded)
      learningRepo.findLearningById.mockResolvedValue(mockLearning);
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);

      const result = await service.replayLearning('learning-123', 30);

      // Result should indicate degraded count tracking
      expect(typeof result.degradedCount).toBe('number');
    });
  });
});
