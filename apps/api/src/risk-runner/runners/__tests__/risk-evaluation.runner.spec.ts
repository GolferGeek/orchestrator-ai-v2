import { Test, TestingModule } from '@nestjs/testing';
import { RiskEvaluationRunner } from '../risk-evaluation.runner';
import { ScopeRepository } from '../../repositories/scope.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import {
  RiskEvaluationService,
  EvaluationResult,
  SuggestedLearning,
} from '../../services/risk-evaluation.service';
import { RiskScope } from '../../interfaces/scope.interface';
import { RiskSubject } from '../../interfaces/subject.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';
import { RiskEvaluation } from '../../interfaces/evaluation.interface';

describe('RiskEvaluationRunner', () => {
  let runner: RiskEvaluationRunner;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let evaluationService: jest.Mocked<RiskEvaluationService>;

  const mockScope: RiskScope = {
    id: 'scope-1',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'US Tech Stocks',
    description: 'Technology sector risk analysis',
    domain: 'investment',
    llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } },
    thresholds: { critical_threshold: 70 },
    analysis_config: { riskRadar: { enabled: true } },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-1',
    scope_id: 'scope-1',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: { sector: 'Technology' },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-1',
    subject_id: 'subject-1',
    task_id: 'task-1',
    overall_score: 65,
    confidence: 0.8,
    dimension_scores: { market: 70, fundamental: 60 },
    pre_debate_score: null,
    debate_id: null,
    debate_adjustment: 0,
    status: 'active',
    valid_until: '2024-01-02T00:00:00Z',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-1',
    composite_score_id: 'score-1',
    subject_id: 'subject-1',
    evaluation_window: '7d',
    actual_outcome: { price_change_percent: -5, outcome_type: 'minor_decline' },
    outcome_severity: 30,
    score_accuracy: 0.85,
    dimension_accuracy: {
      market: {
        predicted_score: 70,
        contribution_to_accuracy: 0.9,
        was_helpful: true,
      },
      fundamental: {
        predicted_score: 60,
        contribution_to_accuracy: 0.8,
        was_helpful: true,
      },
    },
    calibration_error: 0.05,
    learnings_suggested: [],
    notes: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockEvaluationResult: EvaluationResult = {
    evaluation: mockEvaluation,
    scoreAccuracy: 0.85,
    wasCalibrated: true,
    suggestedLearnings: [],
  };

  const mockScoresToEvaluate = [
    { score: mockCompositeScore, subject: mockSubject },
    {
      score: { ...mockCompositeScore, id: 'score-2' },
      subject: { ...mockSubject, id: 'subject-2', identifier: 'MSFT' },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskEvaluationRunner,
        {
          provide: ScopeRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: RiskEvaluationService,
          useValue: {
            findScoresToEvaluate: jest.fn(),
            evaluateScore: jest.fn(),
            queueLearning: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<RiskEvaluationRunner>(RiskEvaluationRunner);
    scopeRepo = module.get(ScopeRepository);
    subjectRepo = module.get(SubjectRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    evaluationService = module.get(RiskEvaluationService);

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

  describe('runEvaluationBatch', () => {
    it('should evaluate scores for all windows', async () => {
      evaluationService.findScoresToEvaluate.mockResolvedValue(
        mockScoresToEvaluate,
      );
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(mockEvaluationResult);

      const result = await runner.runEvaluationBatch();

      // Should be called 3 times (7d, 30d, 90d)
      expect(evaluationService.findScoresToEvaluate).toHaveBeenCalledTimes(3);
      expect(evaluationService.findScoresToEvaluate).toHaveBeenCalledWith(
        '7d',
        100,
      );
      expect(evaluationService.findScoresToEvaluate).toHaveBeenCalledWith(
        '30d',
        100,
      );
      expect(evaluationService.findScoresToEvaluate).toHaveBeenCalledWith(
        '90d',
        100,
      );

      // 2 scores per window = 6 evaluations
      expect(result.evaluated).toBe(6);
      expect(result.accurate).toBe(6); // All wasCalibrated = true
      expect(result.inaccurate).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should skip if previous run is still in progress', async () => {
      evaluationService.findScoresToEvaluate.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockScoresToEvaluate;
      });
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(mockEvaluationResult);

      // Start first run
      const firstRun = runner.runEvaluationBatch();

      // Try to start second run while first is in progress
      const secondResult = await runner.runEvaluationBatch();

      // Wait for first run to complete
      await firstRun;

      expect(secondResult.evaluated).toBe(0);
      expect(secondResult.duration).toBe(0);
    });

    it('should count inaccurate evaluations', async () => {
      const inaccurateResult: EvaluationResult = {
        ...mockEvaluationResult,
        wasCalibrated: false,
      };

      evaluationService.findScoresToEvaluate.mockResolvedValue([
        mockScoresToEvaluate[0]!,
      ]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(inaccurateResult);

      const result = await runner.runEvaluationBatch();

      expect(result.accurate).toBe(0);
      expect(result.inaccurate).toBe(3); // 1 per window
    });

    it('should queue suggested learnings', async () => {
      const suggestedLearnings: SuggestedLearning[] = [
        {
          type: 'weight_adjustment',
          scopeLevel: 'scope',
          title: 'Adjust market weight',
          description: 'Increase weight for market dimension',
          config: { weight: 1.2 },
          confidence: 0.8,
          sourceEvaluationId: 'eval-1',
          reason: 'Market dimension consistently underweighted',
        },
        {
          type: 'pattern',
          scopeLevel: 'domain',
          title: 'High volatility pattern',
          description: 'Increase score when volatility is high',
          config: {},
          confidence: 0.7,
          sourceEvaluationId: 'eval-1',
          reason: 'Volatility spikes correlate with risk events',
        },
      ];

      const resultWithLearnings: EvaluationResult = {
        ...mockEvaluationResult,
        suggestedLearnings,
      };

      evaluationService.findScoresToEvaluate.mockResolvedValue([
        mockScoresToEvaluate[0]!,
      ]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(resultWithLearnings);

      const result = await runner.runEvaluationBatch();

      // 2 learnings per evaluation, 3 windows
      expect(result.learningsSuggested).toBe(6);
      expect(evaluationService.queueLearning).toHaveBeenCalledTimes(6);
    });

    it('should skip subjects without outcome data', async () => {
      const decisionSubject: RiskSubject = {
        ...mockSubject,
        subject_type: 'decision',
      };

      evaluationService.findScoresToEvaluate.mockResolvedValue([
        { score: mockCompositeScore, subject: decisionSubject },
      ]);

      const result = await runner.runEvaluationBatch();

      // Evaluated but no outcome data (decision type doesn't return price data)
      expect(result.evaluated).toBe(3);
      expect(evaluationService.evaluateScore).not.toHaveBeenCalled();
    });

    it('should skip when scope not found', async () => {
      evaluationService.findScoresToEvaluate.mockResolvedValue(
        mockScoresToEvaluate,
      );
      scopeRepo.findById.mockResolvedValue(null);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(6);
      expect(evaluationService.evaluateScore).not.toHaveBeenCalled();
    });

    it('should handle evaluation errors gracefully', async () => {
      evaluationService.findScoresToEvaluate.mockResolvedValue([
        mockScoresToEvaluate[0]!,
      ]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockRejectedValue(
        new Error('Evaluation failed'),
      );

      const result = await runner.runEvaluationBatch();

      expect(result.errors).toBe(3);
    });

    it('should handle empty scores list', async () => {
      evaluationService.findScoresToEvaluate.mockResolvedValue([]);

      const result = await runner.runEvaluationBatch();

      expect(result.evaluated).toBe(0);
      expect(result.accurate).toBe(0);
    });
  });

  describe('evaluateScore', () => {
    it('should evaluate a specific composite score', async () => {
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
      subjectRepo.findById.mockResolvedValue(mockSubject);
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(mockEvaluationResult);

      const result = await runner.evaluateScore('score-1', '7d');

      expect(result).toEqual(mockEvaluationResult);
      expect(compositeScoreRepo.findById).toHaveBeenCalledWith('score-1');
      expect(subjectRepo.findById).toHaveBeenCalledWith('subject-1');
    });

    it('should return null when composite score not found', async () => {
      compositeScoreRepo.findById.mockResolvedValue(null);

      const result = await runner.evaluateScore('nonexistent', '7d');

      expect(result).toBeNull();
    });

    it('should return null when subject not found', async () => {
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
      subjectRepo.findById.mockResolvedValue(null);

      const result = await runner.evaluateScore('score-1', '7d');

      expect(result).toBeNull();
    });

    it('should return null when no outcome data available', async () => {
      const projectSubject: RiskSubject = {
        ...mockSubject,
        subject_type: 'project',
      };
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
      subjectRepo.findById.mockResolvedValue(projectSubject);

      const result = await runner.evaluateScore('score-1', '7d');

      expect(result).toBeNull();
    });

    it('should return null when scope not found', async () => {
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
      subjectRepo.findById.mockResolvedValue(mockSubject);
      scopeRepo.findById.mockResolvedValue(null);

      const result = await runner.evaluateScore('score-1', '7d');

      expect(result).toBeNull();
    });

    it('should evaluate with different windows', async () => {
      compositeScoreRepo.findById.mockResolvedValue(mockCompositeScore);
      subjectRepo.findById.mockResolvedValue(mockSubject);
      scopeRepo.findById.mockResolvedValue(mockScope);
      evaluationService.evaluateScore.mockResolvedValue(mockEvaluationResult);

      await runner.evaluateScore('score-1', '30d');

      expect(evaluationService.evaluateScore).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluationWindow: '30d',
        }),
      );
    });
  });

  describe('runScheduledEvaluations', () => {
    it('should call runEvaluationBatch', async () => {
      evaluationService.findScoresToEvaluate.mockResolvedValue([]);

      await runner.runScheduledEvaluations();

      expect(evaluationService.findScoresToEvaluate).toHaveBeenCalled();
    });
  });
});
