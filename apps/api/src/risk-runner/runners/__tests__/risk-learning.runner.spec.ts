import { Test, TestingModule } from '@nestjs/testing';
import { RiskLearningRunner } from '../risk-learning.runner';
import { LLMService } from '@/llms/llm.service';
import { ScopeRepository } from '../../repositories/scope.repository';
import { EvaluationRepository } from '../../repositories/evaluation.repository';
import { LearningRepository } from '../../repositories/learning.repository';
import { RiskLearningService } from '../../services/risk-learning.service';
import { HistoricalReplayService } from '../../services/historical-replay.service';
import { RiskLearning } from '../../interfaces/learning.interface';
import {
  RiskEvaluation,
  DimensionAccuracy,
} from '../../interfaces/evaluation.interface';

describe('RiskLearningRunner', () => {
  let runner: RiskLearningRunner;
  let _scopeRepo: jest.Mocked<ScopeRepository>;
  let evaluationRepo: jest.Mocked<EvaluationRepository>;
  let learningRepo: jest.Mocked<LearningRepository>;
  let learningService: jest.Mocked<RiskLearningService>;
  let replayService: jest.Mocked<HistoricalReplayService>;
  let llmService: jest.Mocked<LLMService>;

  const mockLearning: RiskLearning = {
    id: 'learning-1',
    scope_level: 'domain',
    domain: 'investment',
    scope_id: null,
    subject_id: null,
    dimension_id: null,
    learning_type: 'pattern',
    title: 'High Volatility Pattern',
    description: 'Increase risk score when volatility is high',
    config: {
      pattern_signals: ['high_volatility'],
      pattern_effect: 'increase',
    },
    times_applied: 15,
    times_helpful: 12,
    effectiveness_score: 0.8,
    status: 'active',
    is_test: false,
    source_type: 'ai_approved',
    parent_learning_id: null,
    is_production: true,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockTestLearning: RiskLearning = {
    ...mockLearning,
    id: 'learning-test-1',
    title: 'Test Learning',
    is_test: true,
    status: 'testing',
    times_applied: 3,
  };

  const mockDimensionAccuracy: DimensionAccuracy = {
    market: {
      predicted_score: 60,
      contribution_to_accuracy: 0.6,
      was_helpful: true,
    },
    fundamental: {
      predicted_score: 40,
      contribution_to_accuracy: 0.4,
      was_helpful: false,
    },
  };

  // Use a recent date for evaluations to pass the 7-day filter
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-1',
    composite_score_id: 'score-1',
    subject_id: 'subject-1',
    evaluation_window: '7d',
    score_accuracy: 0.5, // Below 0.6 threshold for inaccurate
    calibration_error: 0.15,
    outcome_severity: 50, // Numeric 0-100
    dimension_accuracy: mockDimensionAccuracy,
    learnings_suggested: [],
    actual_outcome: {
      price_change_percent: -10,
      outcome_type: 'minor_decline',
    },
    notes: null,
    is_test: false,
    test_scenario_id: null,
    created_at: recentDate.toISOString(),
  };

  const mockInaccurateEvaluations: RiskEvaluation[] = [
    mockEvaluation,
    { ...mockEvaluation, id: 'eval-2', score_accuracy: 0.4 },
    { ...mockEvaluation, id: 'eval-3', score_accuracy: 0.55 },
    { ...mockEvaluation, id: 'eval-4', score_accuracy: 0.3 },
    { ...mockEvaluation, id: 'eval-5', score_accuracy: 0.45 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskLearningRunner,
        {
          provide: ScopeRepository,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
        {
          provide: EvaluationRepository,
          useValue: {
            findAllByWindow: jest.fn(),
          },
        },
        {
          provide: LearningRepository,
          useValue: {
            findAllLearnings: jest.fn(),
            createQueueItem: jest.fn(),
          },
        },
        {
          provide: RiskLearningService,
          useValue: {
            updateEffectivenessScore: jest.fn(),
            retireLearning: jest.fn(),
          },
        },
        {
          provide: HistoricalReplayService,
          useValue: {
            replayLearning: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<RiskLearningRunner>(RiskLearningRunner);
    _scopeRepo = module.get(ScopeRepository);
    evaluationRepo = module.get(EvaluationRepository);
    learningRepo = module.get(LearningRepository);
    learningService = module.get(RiskLearningService);
    replayService = module.get(HistoricalReplayService);
    llmService = module.get(LLMService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(runner).toBeDefined();
  });

  describe('isProcessing', () => {
    it('should return false when not running', () => {
      expect(runner.isProcessing()).toBe(false);
    });
  });

  describe('runLearningBatch', () => {
    beforeEach(() => {
      // Default setup - no learnings, no evaluations
      evaluationRepo.findAllByWindow.mockResolvedValue([]);
      learningRepo.findAllLearnings.mockResolvedValue([]);
    });

    it('should complete with no work when no data', async () => {
      const result = await runner.runLearningBatch();

      expect(result.learningsSuggested).toBe(0);
      expect(result.learningsUpdated).toBe(0);
      expect(result.learningsRetired).toBe(0);
      expect(result.replayTestsRun).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should skip if previous run is still in progress', async () => {
      evaluationRepo.findAllByWindow.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [];
      });

      // Start first run
      const firstRun = runner.runLearningBatch();

      // Try to start second run while first is in progress
      const secondResult = await runner.runLearningBatch();

      // Wait for first run to complete
      await firstRun;

      expect(secondResult.learningsSuggested).toBe(0);
      expect(secondResult.duration).toBe(0);
    });

    it('should update effectiveness scores for eligible learnings', async () => {
      const eligibleLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 15, // >= MIN_APPLICATIONS_FOR_EVALUATION (10)
        status: 'active',
      };

      learningRepo.findAllLearnings.mockResolvedValue([eligibleLearning]);

      const result = await runner.runLearningBatch();

      expect(learningService.updateEffectivenessScore).toHaveBeenCalledWith(
        'learning-1',
      );
      expect(result.learningsUpdated).toBe(1);
    });

    it('should not update effectiveness for learnings with few applications', async () => {
      const newLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 5, // < MIN_APPLICATIONS_FOR_EVALUATION (10)
      };

      learningRepo.findAllLearnings.mockResolvedValue([newLearning]);

      const result = await runner.runLearningBatch();

      expect(learningService.updateEffectivenessScore).not.toHaveBeenCalled();
      expect(result.learningsUpdated).toBe(0);
    });

    it('should run replay tests for testing learnings', async () => {
      learningRepo.findAllLearnings.mockResolvedValue([mockTestLearning]);
      replayService.replayLearning.mockResolvedValue({
        scenarioId: 'scenario-1',
        learningId: 'learning-test-1',
        learningTitle: 'Test Learning',
        pass: true,
        improvementScore: 0.15,
        baselineAccuracy: 0.6,
        withLearningAccuracy: 0.75,
        accuracyLift: 0.15,
        sampleSize: 100,
        affectedCount: 50,
        improvedCount: 40,
        degradedCount: 5,
        statisticalSignificance: 0.95,
        executionTimeMs: 500,
        details: {},
      });

      const result = await runner.runLearningBatch();

      expect(replayService.replayLearning).toHaveBeenCalledWith(
        'learning-test-1',
        30,
      );
      expect(result.replayTestsRun).toBe(1);
      expect(result.replayTestsPassed).toBe(1);
    });

    it('should count failed replay tests', async () => {
      learningRepo.findAllLearnings.mockResolvedValue([mockTestLearning]);
      replayService.replayLearning.mockResolvedValue({
        scenarioId: 'scenario-1',
        learningId: 'learning-test-1',
        learningTitle: 'Test Learning',
        pass: false,
        improvementScore: -0.05,
        baselineAccuracy: 0.6,
        withLearningAccuracy: 0.55,
        accuracyLift: -0.05,
        sampleSize: 100,
        affectedCount: 50,
        improvedCount: 10,
        degradedCount: 30,
        statisticalSignificance: 0.5,
        executionTimeMs: 500,
        details: {},
      });

      const result = await runner.runLearningBatch();

      expect(result.replayTestsRun).toBe(1);
      expect(result.replayTestsPassed).toBe(0);
    });

    it('should retire ineffective learnings', async () => {
      const ineffectiveLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 20,
        times_helpful: 5, // 25% effectiveness < MIN_EFFECTIVENESS_FOR_RETENTION (40%)
      };

      learningRepo.findAllLearnings.mockResolvedValue([ineffectiveLearning]);

      const result = await runner.runLearningBatch();

      expect(learningService.retireLearning).toHaveBeenCalled();
      expect(result.learningsRetired).toBe(1);
    });

    it('should retire stale learnings without applications', async () => {
      const staleLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 0,
        // Set updated_at to > 90 days ago
        updated_at: new Date(
          Date.now() - 100 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      };

      learningRepo.findAllLearnings.mockResolvedValue([staleLearning]);

      const result = await runner.runLearningBatch();

      expect(learningService.retireLearning).toHaveBeenCalled();
      expect(result.learningsRetired).toBe(1);
    });

    it('should not retire recently updated learnings', async () => {
      const recentLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 0,
        updated_at: new Date().toISOString(), // Recent
      };

      learningRepo.findAllLearnings.mockResolvedValue([recentLearning]);

      const result = await runner.runLearningBatch();

      expect(learningService.retireLearning).not.toHaveBeenCalled();
      expect(result.learningsRetired).toBe(0);
    });

    it('should skip retired learnings for effectiveness check', async () => {
      const retiredLearning: RiskLearning = {
        ...mockLearning,
        status: 'retired',
        times_applied: 20,
      };

      learningRepo.findAllLearnings.mockResolvedValue([retiredLearning]);

      await runner.runLearningBatch();

      expect(learningService.updateEffectivenessScore).not.toHaveBeenCalled();
      expect(learningService.retireLearning).not.toHaveBeenCalled();
    });

    it('should analyze evaluations for learning patterns', async () => {
      evaluationRepo.findAllByWindow.mockResolvedValue(
        mockInaccurateEvaluations,
      );
      learningRepo.findAllLearnings.mockResolvedValue([]);
      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          patterns: [
            {
              type: 'pattern',
              scopeLevel: 'domain',
              title: 'Volatility Spike Pattern',
              description: 'Increase score during volatility spikes',
              config: {},
              confidence: 0.85,
              reasoning: 'Consistent underestimation during spikes',
            },
          ],
        }),
      );

      const result = await runner.runLearningBatch();

      expect(llmService.generateResponse).toHaveBeenCalled();
      expect(learningRepo.createQueueItem).toHaveBeenCalled();
      expect(result.learningsSuggested).toBe(1);
    });

    it('should not suggest duplicate learnings', async () => {
      const existingLearning: RiskLearning = {
        ...mockLearning,
        title: 'Volatility Spike Pattern',
        description: 'Similar pattern already exists',
      };

      evaluationRepo.findAllByWindow.mockResolvedValue(
        mockInaccurateEvaluations,
      );
      learningRepo.findAllLearnings.mockResolvedValue([existingLearning]);
      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          patterns: [
            {
              type: 'pattern',
              scopeLevel: 'domain',
              title: 'Volatility Spike Pattern',
              description: 'Same pattern',
              config: {},
              confidence: 0.85,
              reasoning: 'Duplicate',
            },
          ],
        }),
      );

      const result = await runner.runLearningBatch();

      expect(learningRepo.createQueueItem).not.toHaveBeenCalled();
      expect(result.learningsSuggested).toBe(0);
    });

    it('should skip pattern analysis with insufficient evaluations', async () => {
      // Only return evaluations for one window (< 5 total required)
      // This ensures we have fewer than 5 total evaluations across all windows
      evaluationRepo.findAllByWindow.mockImplementation(async (window) => {
        if (window === '7d') {
          return [mockEvaluation, { ...mockEvaluation, id: 'eval-2' }];
        }
        return []; // Empty for other windows
      });

      const result = await runner.runLearningBatch();

      expect(llmService.generateResponse).not.toHaveBeenCalled();
      expect(result.learningsSuggested).toBe(0);
    });

    it('should handle LLM response parsing errors', async () => {
      evaluationRepo.findAllByWindow.mockResolvedValue(
        mockInaccurateEvaluations,
      );
      learningRepo.findAllLearnings.mockResolvedValue([]);
      llmService.generateResponse.mockResolvedValue('invalid json');

      const result = await runner.runLearningBatch();

      expect(result.learningsSuggested).toBe(0);
      expect(result.errors).toBe(0); // Parsing errors are warnings, not counted
    });

    it('should limit replay tests to 10 per run', async () => {
      const manyTestLearnings = Array.from({ length: 15 }, (_, i) => ({
        ...mockTestLearning,
        id: `learning-test-${i}`,
      }));

      learningRepo.findAllLearnings.mockResolvedValue(manyTestLearnings);
      replayService.replayLearning.mockResolvedValue({
        scenarioId: 'scenario-1',
        learningId: 'learning-test-1',
        learningTitle: 'Test Learning',
        pass: true,
        improvementScore: 0.1,
        baselineAccuracy: 0.6,
        withLearningAccuracy: 0.7,
        accuracyLift: 0.1,
        sampleSize: 100,
        affectedCount: 50,
        improvedCount: 35,
        degradedCount: 5,
        statisticalSignificance: 0.9,
        executionTimeMs: 500,
        details: {},
      });

      const result = await runner.runLearningBatch();

      expect(replayService.replayLearning).toHaveBeenCalledTimes(10);
      expect(result.replayTestsRun).toBe(10);
    });

    it('should handle errors during effectiveness update', async () => {
      const eligibleLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 15,
        status: 'active',
      };

      learningRepo.findAllLearnings.mockResolvedValue([eligibleLearning]);
      learningService.updateEffectivenessScore.mockRejectedValue(
        new Error('Update failed'),
      );

      const result = await runner.runLearningBatch();

      // Should continue despite error
      expect(result.learningsUpdated).toBe(0);
      expect(result.errors).toBe(0); // This is logged but not counted as error
    });

    it('should handle errors during replay test', async () => {
      learningRepo.findAllLearnings.mockResolvedValue([mockTestLearning]);
      replayService.replayLearning.mockRejectedValue(
        new Error('Replay failed'),
      );

      const result = await runner.runLearningBatch();

      expect(result.replayTestsRun).toBe(0);
      expect(result.replayTestsPassed).toBe(0);
    });

    it('should handle errors during retire operation', async () => {
      const ineffectiveLearning: RiskLearning = {
        ...mockLearning,
        times_applied: 20,
        times_helpful: 5,
      };

      learningRepo.findAllLearnings.mockResolvedValue([ineffectiveLearning]);
      learningService.retireLearning.mockRejectedValue(
        new Error('Retire failed'),
      );

      const result = await runner.runLearningBatch();

      expect(result.learningsRetired).toBe(0);
    });
  });

  describe('runScheduledLearningProcess', () => {
    it('should call runLearningBatch', async () => {
      evaluationRepo.findAllByWindow.mockResolvedValue([]);
      learningRepo.findAllLearnings.mockResolvedValue([]);

      await runner.runScheduledLearningProcess();

      expect(evaluationRepo.findAllByWindow).toHaveBeenCalled();
    });
  });
});
