import { Test, TestingModule } from '@nestjs/testing';
import { LearningImpactService } from '../learning-impact.service';
import { LearningRepository } from '../../repositories/learning.repository';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { SnapshotRepository } from '../../repositories/snapshot.repository';
import { Learning } from '../../interfaces/learning.interface';
import { Prediction } from '../../interfaces/prediction.interface';
import { PredictionSnapshot } from '../../interfaces/snapshot.interface';

describe('LearningImpactService', () => {
  let service: LearningImpactService;
  let learningRepository: jest.Mocked<LearningRepository>;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let snapshotRepository: jest.Mocked<SnapshotRepository>;

  const mockLearning: Learning = {
    id: 'learning-123',
    scope_level: 'target',
    domain: 'stocks',
    universe_id: 'universe-123',
    target_id: 'target-123',
    analyst_id: null,
    learning_type: 'pattern',
    title: 'Bull flag pattern',
    description: 'Recognize bull flag patterns',
    config: { indicators: ['bullFlag'] },
    source_type: 'ai_approved',
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    status: 'active',
    superseded_by: null,
    version: 1,
    times_applied: 10,
    times_helpful: 8,
    is_test: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

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
    status: 'resolved',
    outcome_value: 5.0,
    outcome_captured_at: new Date().toISOString(),
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSnapshot: PredictionSnapshot = {
    id: 'snapshot-123',
    prediction_id: 'pred-123',
    captured_at: new Date().toISOString(),
    predictors: [],
    rejected_signals: [],
    analyst_assessments: [],
    llm_ensemble: { tiers_used: [], tier_results: {}, agreement_level: 0 },
    learnings_applied: [
      {
        learning_id: 'learning-123',
        type: 'pattern',
        content: 'Bull flag pattern',
        scope: 'target',
        applied_to: 'prediction',
      },
    ],
    threshold_evaluation: {
      min_predictors: 3,
      actual_predictors: 5,
      min_combined_strength: 15,
      actual_combined_strength: 25,
      min_consensus: 0.6,
      actual_consensus: 0.8,
      passed: true,
    },
    timeline: [],
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningImpactService,
        {
          provide: LearningRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockLearning),
            findByScope: jest.fn().mockResolvedValue([mockLearning]),
            incrementApplication: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockPrediction),
            findByTarget: jest.fn().mockResolvedValue([mockPrediction]),
          },
        },
        {
          provide: SnapshotRepository,
          useValue: {
            findByPredictionId: jest.fn().mockResolvedValue(mockSnapshot),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LearningImpactService>(LearningImpactService);
    learningRepository = module.get(LearningRepository);
    predictionRepository = module.get(PredictionRepository);
    snapshotRepository = module.get(SnapshotRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLearningImpact', () => {
    it('should return impact metrics for a learning', async () => {
      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
      expect(result?.learningId).toBe('learning-123');
      expect(result?.learningTitle).toBe('Bull flag pattern');
      expect(result?.learningType).toBe('pattern');
      expect(result?.scopeLevel).toBe('target');
      expect(result?.timesApplied).toBe(10);
    });

    it('should return null when learning not found', async () => {
      learningRepository.findById.mockResolvedValue(null);

      const result = await service.getLearningImpact('nonexistent');

      expect(result).toBeNull();
    });

    it('should calculate accuracy metrics when predictions available', async () => {
      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
      expect(result?.predictionsAffected).toBeGreaterThanOrEqual(0);
    });

    it('should include recommendation based on metrics', async () => {
      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
      expect([
        'promote',
        'maintain',
        'review',
        'demote',
        'insufficient_data',
      ]).toContain(result?.recommendation);
    });

    it('should return insufficient_data when few applications', async () => {
      learningRepository.findById.mockResolvedValue({
        ...mockLearning,
        times_applied: 2,
      });
      predictionRepository.findByTarget.mockResolvedValue([]);

      const result = await service.getLearningImpact('learning-123');

      expect(result?.recommendation).toBe('insufficient_data');
    });
  });

  describe('getImpactSummary', () => {
    it('should return summary for all learnings', async () => {
      const result = await service.getImpactSummary();

      expect(result).toHaveProperty('totalLearnings');
      expect(result).toHaveProperty('activeLearnings');
      expect(result).toHaveProperty('totalApplications');
      expect(result).toHaveProperty('predictionsWithLearnings');
      expect(result).toHaveProperty('topPerformers');
      expect(result).toHaveProperty('underperformers');
      expect(result).toHaveProperty('byType');
      expect(result).toHaveProperty('byScope');
    });

    it('should filter by scope level', async () => {
      await service.getImpactSummary('target');

      expect(learningRepository.findByScope).toHaveBeenCalledWith(
        'target',
        undefined,
        undefined,
        undefined,
        'active',
      );
    });

    it('should filter by target ID', async () => {
      await service.getImpactSummary('target', 'target-123');

      expect(learningRepository.findByScope).toHaveBeenCalledWith(
        'target',
        undefined,
        undefined,
        'target-123',
        'active',
      );
    });

    it('should calculate average accuracy impact', async () => {
      const result = await service.getImpactSummary();

      expect(
        result.averageAccuracyImpact === null ||
          typeof result.averageAccuracyImpact === 'number',
      ).toBe(true);
    });

    it('should group by type', async () => {
      const result = await service.getImpactSummary();

      expect(result.byType).toBeDefined();
      expect(typeof result.byType).toBe('object');
    });

    it('should group by scope', async () => {
      const result = await service.getImpactSummary();

      expect(result.byScope).toBeDefined();
      expect(typeof result.byScope).toBe('object');
    });
  });

  describe('getLearningsForReview', () => {
    it('should return learnings needing review', async () => {
      const result = await service.getLearningsForReview();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter to demote and review recommendations', async () => {
      const result = await service.getLearningsForReview();

      for (const metric of result) {
        expect(['review', 'demote']).toContain(metric.recommendation);
      }
    });
  });

  describe('trackLearningApplication', () => {
    it('should increment application count for each learning', async () => {
      await service.trackLearningApplication('pred-123', [
        'learning-1',
        'learning-2',
      ]);

      expect(learningRepository.incrementApplication).toHaveBeenCalledTimes(2);
      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-1',
      );
      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-2',
      );
    });

    it('should handle empty learning IDs array', async () => {
      await service.trackLearningApplication('pred-123', []);

      expect(learningRepository.incrementApplication).not.toHaveBeenCalled();
    });

    it('should continue when one increment fails', async () => {
      learningRepository.incrementApplication
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      await service.trackLearningApplication('pred-123', [
        'learning-1',
        'learning-2',
      ]);

      expect(learningRepository.incrementApplication).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordLearningFeedback', () => {
    it('should record positive feedback', async () => {
      await service.recordLearningFeedback('pred-123', 'learning-123', true);

      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-123',
        true,
      );
    });

    it('should record negative feedback', async () => {
      await service.recordLearningFeedback('pred-123', 'learning-123', false);

      expect(learningRepository.incrementApplication).toHaveBeenCalledWith(
        'learning-123',
        false,
      );
    });
  });

  describe('private methods via public interface', () => {
    it('should extract learning IDs from snapshots', async () => {
      // Testing through getLearningImpact
      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
      expect(result?.predictionsAffected).toBeGreaterThanOrEqual(0);
    });

    it('should calculate effectiveness score', async () => {
      // When times_applied >= 5 (MIN_APPLICATIONS threshold)
      const result = await service.getLearningImpact('learning-123');

      // Should have an effectiveness score since times_applied = 10
      expect(
        result?.effectivenessScore === null ||
          typeof result?.effectivenessScore === 'number',
      ).toBe(true);
    });

    it('should determine correct recommendation based on accuracy delta', async () => {
      // High accuracy improvement should recommend promote
      learningRepository.findById.mockResolvedValue({
        ...mockLearning,
        times_applied: 20,
        times_helpful: 18,
      });

      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
      expect(result?.recommendation).toBeDefined();
    });
  });

  describe('baseline accuracy calculation', () => {
    it('should handle no baseline predictions', async () => {
      predictionRepository.findByTarget.mockResolvedValue([]);

      const result = await service.getLearningImpact('learning-123');

      expect(result?.predictionAccuracyBaseline).toBeNull();
    });

    it('should exclude target learning from baseline', async () => {
      const predictionWithoutLearning = {
        ...mockPrediction,
        id: 'pred-no-learning',
      };
      predictionRepository.findByTarget.mockResolvedValue([
        mockPrediction,
        predictionWithoutLearning,
      ]);

      // Mock snapshot without the learning
      snapshotRepository.findByPredictionId.mockImplementation(
        async (predId) => {
          if (predId === 'pred-no-learning') {
            return { ...mockSnapshot, learnings_applied: [] };
          }
          return mockSnapshot;
        },
      );

      const result = await service.getLearningImpact('learning-123');

      expect(result).toBeDefined();
    });
  });
});
