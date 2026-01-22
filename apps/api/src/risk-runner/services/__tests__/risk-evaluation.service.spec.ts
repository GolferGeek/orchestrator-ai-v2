import { Test, TestingModule } from '@nestjs/testing';
import {
  RiskEvaluationService,
  EvaluationInput,
  SuggestedLearning,
} from '../risk-evaluation.service';
import { LLMService } from '@/llms/llm.service';
import { EvaluationRepository } from '../../repositories/evaluation.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import { LearningRepository } from '../../repositories/learning.repository';
import {
  RiskEvaluation,
  ActualOutcome,
} from '../../interfaces/evaluation.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';
import { RiskSubject } from '../../interfaces/subject.interface';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

describe('RiskEvaluationService', () => {
  let service: RiskEvaluationService;
  let evaluationRepo: jest.Mocked<EvaluationRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let learningRepo: jest.Mocked<LearningRepository>;
  let llmService: jest.Mocked<LLMService>;

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'investment-risk-agent',
    agentType: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-123',
    scope_id: 'scope-123',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-123',
    subject_id: 'subject-123',
    task_id: 'task-123',
    overall_score: 65,
    dimension_scores: { market: 70, fundamental: 60, technical: 65 },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.8,
    status: 'active',
    valid_until: '2026-01-16T00:00:00Z',
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-08T00:00:00Z',
  };

  const mockActualOutcome: ActualOutcome = {
    price_change_percent: -12,
    max_drawdown_percent: 15,
    volatility_realized: 0.25,
    volatility_predicted: 0.2,
    outcome_type: 'significant_decline',
    outcome_date: '2026-01-15T00:00:00Z',
    adverse_events: [],
  };

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-123',
    composite_score_id: 'score-123',
    subject_id: 'subject-123',
    evaluation_window: '7d',
    actual_outcome: mockActualOutcome,
    outcome_severity: 60,
    score_accuracy: 0.88,
    dimension_accuracy: {
      market: {
        predicted_score: 70,
        contribution_to_accuracy: 0.2,
        was_helpful: true,
      },
      fundamental: {
        predicted_score: 60,
        contribution_to_accuracy: 0.1,
        was_helpful: false,
      },
    },
    calibration_error: 5,
    learnings_suggested: null,
    notes: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskEvaluationService,
        {
          provide: EvaluationRepository,
          useValue: {
            findByScoreAndWindow: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findBySubject: jest.fn(),
            findAllByWindow: jest.fn(),
            calculateAverageAccuracy: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findById: jest.fn(),
            findScoresOlderThan: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findById: jest.fn(),
            findByScope: jest.fn(),
          },
        },
        {
          provide: LearningRepository,
          useValue: {
            createQueueItem: jest.fn(),
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

    service = module.get<RiskEvaluationService>(RiskEvaluationService);
    evaluationRepo = module.get(EvaluationRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    subjectRepo = module.get(SubjectRepository);
    learningRepo = module.get(LearningRepository);
    llmService = module.get(LLMService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateScore', () => {
    const evaluationInput: EvaluationInput = {
      compositeScore: mockCompositeScore,
      subject: mockSubject,
      actualOutcome: mockActualOutcome,
      evaluationWindow: '7d',
      context: mockExecutionContext,
    };

    it('should create evaluation when none exists', async () => {
      evaluationRepo.findByScoreAndWindow.mockResolvedValue(null);
      evaluationRepo.create.mockResolvedValue(mockEvaluation);

      const result = await service.evaluateScore(evaluationInput);

      expect(result.evaluation).toBeDefined();
      expect(result.scoreAccuracy).toBeGreaterThan(0);
      expect(evaluationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          composite_score_id: 'score-123',
          subject_id: 'subject-123',
          evaluation_window: '7d',
        }),
      );
    });

    it('should return existing evaluation if already evaluated', async () => {
      evaluationRepo.findByScoreAndWindow.mockResolvedValue(mockEvaluation);

      const result = await service.evaluateScore(evaluationInput);

      expect(result.evaluation).toEqual(mockEvaluation);
      expect(evaluationRepo.create).not.toHaveBeenCalled();
    });

    it('should generate learning suggestions when accuracy is low', async () => {
      const lowAccuracyOutcome: ActualOutcome = {
        price_change_percent: -40,
        max_drawdown_percent: 35,
        volatility_realized: 0.5,
        volatility_predicted: 0.2,
        outcome_type: 'major_event',
        adverse_events: [
          {
            type: 'earnings_miss',
            description: 'Major earnings miss',
            severity: 'critical',
            date: '2026-01-15T00:00:00Z',
          },
        ],
      };

      const lowAccuracyInput: EvaluationInput = {
        ...evaluationInput,
        actualOutcome: lowAccuracyOutcome,
      };

      const lowAccuracyEval: RiskEvaluation = {
        ...mockEvaluation,
        outcome_severity: 90, // High severity
        score_accuracy: 0.3, // Low accuracy
        calibration_error: 25,
      };

      evaluationRepo.findByScoreAndWindow.mockResolvedValue(null);
      evaluationRepo.create.mockResolvedValue(lowAccuracyEval);

      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          suggestions: [
            {
              type: 'pattern',
              title: 'Earnings risk underweighted',
              description: 'Risk model underweighted earnings event risk',
              reason: 'Score was 65 but outcome severity was 90',
              confidence: 0.8,
            },
          ],
        }),
      );

      const result = await service.evaluateScore(lowAccuracyInput);

      expect(result.suggestedLearnings.length).toBeGreaterThan(0);
      expect(llmService.generateResponse).toHaveBeenCalled();
    });

    it('should not generate suggestions when accuracy is high', async () => {
      const highAccuracyEval: RiskEvaluation = {
        ...mockEvaluation,
        outcome_severity: 65,
        score_accuracy: 0.95,
        calibration_error: 0,
      };

      evaluationRepo.findByScoreAndWindow.mockResolvedValue(null);
      evaluationRepo.create.mockResolvedValue(highAccuracyEval);

      const result = await service.evaluateScore(evaluationInput);

      expect(result.suggestedLearnings.length).toBe(0);
      expect(llmService.generateResponse).not.toHaveBeenCalled();
    });
  });

  describe('findScoresToEvaluate', () => {
    it('should find scores older than the evaluation window', async () => {
      compositeScoreRepo.findScoresOlderThan.mockResolvedValue([
        mockCompositeScore,
      ]);
      evaluationRepo.findByScoreAndWindow.mockResolvedValue(null);
      subjectRepo.findById.mockResolvedValue(mockSubject);

      const result = await service.findScoresToEvaluate('7d', 10);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.score).toEqual(mockCompositeScore);
      expect(result[0]?.subject).toEqual(mockSubject);
    });

    it('should filter out already evaluated scores', async () => {
      compositeScoreRepo.findScoresOlderThan.mockResolvedValue([
        mockCompositeScore,
      ]);
      evaluationRepo.findByScoreAndWindow.mockResolvedValue(mockEvaluation);

      const result = await service.findScoresToEvaluate('7d', 10);

      expect(result.length).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const scores = Array(10)
        .fill(mockCompositeScore)
        .map((s, i) => ({
          ...s,
          id: `score-${i}`,
        }));
      compositeScoreRepo.findScoresOlderThan.mockResolvedValue(scores);
      evaluationRepo.findByScoreAndWindow.mockResolvedValue(null);
      subjectRepo.findById.mockResolvedValue(mockSubject);

      const result = await service.findScoresToEvaluate('7d', 3);

      expect(result.length).toBe(3);
    });
  });

  describe('calculateAccuracyMetrics', () => {
    it('should calculate aggregate accuracy metrics', async () => {
      const evaluations = [
        { ...mockEvaluation, score_accuracy: 0.8, calibration_error: 5 },
        {
          ...mockEvaluation,
          id: 'eval-2',
          score_accuracy: 0.7,
          calibration_error: 10,
        },
        {
          ...mockEvaluation,
          id: 'eval-3',
          score_accuracy: 0.9,
          calibration_error: 3,
        },
      ];

      evaluationRepo.findAllByWindow.mockResolvedValue(evaluations);

      const metrics = await service.calculateAccuracyMetrics();

      expect(metrics.overallAccuracy).toBeGreaterThan(0);
      expect(metrics.calibrationScore).toBeGreaterThan(0);
      expect(metrics.brierScore).toBeGreaterThan(0);
      expect(metrics.byWindow).toBeDefined();
      expect(metrics.byDimension).toBeDefined();
    });

    it('should return zero metrics when no evaluations exist', async () => {
      evaluationRepo.findAllByWindow.mockResolvedValue([]);

      const metrics = await service.calculateAccuracyMetrics();

      expect(metrics.overallAccuracy).toBe(0);
      expect(metrics.calibrationScore).toBe(0);
      expect(metrics.brierScore).toBe(1.0);
    });

    it('should filter by scope when scopeId provided', async () => {
      const subjects = [mockSubject];
      subjectRepo.findByScope.mockResolvedValue(subjects);
      evaluationRepo.findBySubject.mockResolvedValue([mockEvaluation]);

      await service.calculateAccuracyMetrics('scope-123');

      expect(subjectRepo.findByScope).toHaveBeenCalledWith('scope-123');
      expect(evaluationRepo.findBySubject).toHaveBeenCalledWith('subject-123');
    });
  });

  describe('queueLearning', () => {
    it('should create queue item for suggested learning', async () => {
      const suggestion: SuggestedLearning = {
        type: 'pattern',
        scopeLevel: 'scope',
        title: 'Test pattern',
        description: 'Test description',
        config: {},
        confidence: 0.8,
        sourceEvaluationId: 'eval-123',
        reason: 'Identified from evaluation',
      };

      learningRepo.createQueueItem.mockResolvedValue({
        id: 'queue-123',
        suggested_title: suggestion.title,
        status: 'pending',
      } as any);

      await service.queueLearning(suggestion, 'scope-123', 'subject-123');

      expect(learningRepo.createQueueItem).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_id: 'scope-123',
          subject_id: 'subject-123',
          evaluation_id: 'eval-123',
          suggested_title: 'Test pattern',
          suggested_learning_type: 'pattern',
          ai_confidence: 0.8,
          status: 'pending',
        }),
      );
    });
  });

  describe('getEvaluationById', () => {
    it('should return evaluation by ID', async () => {
      evaluationRepo.findById.mockResolvedValue(mockEvaluation);

      const result = await service.getEvaluationById('eval-123');

      expect(result).toEqual(mockEvaluation);
      expect(evaluationRepo.findById).toHaveBeenCalledWith('eval-123');
    });

    it('should return null for non-existent evaluation', async () => {
      evaluationRepo.findById.mockResolvedValue(null);

      const result = await service.getEvaluationById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getEvaluationsForSubject', () => {
    it('should return all evaluations for a subject', async () => {
      const evaluations = [
        { ...mockEvaluation, evaluation_window: '7d' as const },
        { ...mockEvaluation, id: 'eval-2', evaluation_window: '30d' as const },
      ];
      evaluationRepo.findBySubject.mockResolvedValue(evaluations);

      const result = await service.getEvaluationsForSubject('subject-123');

      expect(result).toEqual(evaluations);
      expect(evaluationRepo.findBySubject).toHaveBeenCalledWith('subject-123');
    });
  });
});
