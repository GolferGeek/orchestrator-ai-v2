import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationHandler } from '../evaluation.handler';
import { RiskEvaluationService } from '../../../services/risk-evaluation.service';
import { EvaluationRepository } from '../../../repositories/evaluation.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { RiskEvaluation } from '../../../interfaces/evaluation.interface';

describe('EvaluationHandler', () => {
  let handler: EvaluationHandler;
  let evaluationService: jest.Mocked<RiskEvaluationService>;
  let evaluationRepo: jest.Mocked<EvaluationRepository>;

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

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-123',
    composite_score_id: 'score-123',
    subject_id: 'subject-123',
    evaluation_window: '7d',
    actual_outcome: {
      price_change_percent: -10,
      max_drawdown_percent: 12,
      outcome_type: 'minor_decline',
    },
    outcome_severity: 60,
    score_accuracy: 0.85,
    dimension_accuracy: {
      market: {
        predicted_score: 70,
        contribution_to_accuracy: 0.2,
        was_helpful: true,
      },
    },
    calibration_error: 5,
    learnings_suggested: null,
    notes: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  const createPayload = (
    action: string,
    params?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number },
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
    pagination,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationHandler,
        {
          provide: RiskEvaluationService,
          useValue: {
            getEvaluationById: jest.fn(),
            getEvaluationsForSubject: jest.fn(),
            calculateAccuracyMetrics: jest.fn(),
          },
        },
        {
          provide: EvaluationRepository,
          useValue: {
            findAllByWindow: jest.fn(),
            findByCompositeScore: jest.fn(),
            calculateAverageAccuracy: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<EvaluationHandler>(EvaluationHandler);
    evaluationService = module.get(RiskEvaluationService);
    evaluationRepo = module.get(EvaluationRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('getBySubject');
      expect(actions).toContain('getByScore');
      expect(actions).toContain('metrics');
      expect(actions).toContain('accuracy');
      expect(actions).toContain('byWindow');
    });
  });

  describe('execute - list', () => {
    it('should return evaluations for all windows', async () => {
      evaluationRepo.findAllByWindow
        .mockResolvedValueOnce([mockEvaluation])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const payload = createPayload('list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by window when specified', async () => {
      evaluationRepo.findAllByWindow.mockResolvedValue([mockEvaluation]);

      const payload = createPayload('list', { window: '7d' });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(evaluationRepo.findAllByWindow).toHaveBeenCalledWith('7d', {
        includeTest: false,
      });
    });

    it('should apply pagination', async () => {
      const evaluations = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockEvaluation, id: `eval-${i}` }));
      evaluationRepo.findAllByWindow
        .mockResolvedValueOnce(evaluations)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const payload = createPayload('list', {}, { page: 2, pageSize: 10 });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.totalCount).toBe(25);
    });
  });

  describe('execute - get', () => {
    it('should return evaluation by ID', async () => {
      evaluationService.getEvaluationById.mockResolvedValue(mockEvaluation);

      const payload = createPayload('get', { id: 'eval-123' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvaluation);
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('get');
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when evaluation not found', async () => {
      evaluationService.getEvaluationById.mockResolvedValue(null);

      const payload = createPayload('get', { id: 'nonexistent' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - getBySubject', () => {
    it('should return evaluations for a subject', async () => {
      const evaluations = [
        { ...mockEvaluation, evaluation_window: '7d' as const },
        { ...mockEvaluation, id: 'eval-2', evaluation_window: '30d' as const },
      ];
      evaluationService.getEvaluationsForSubject.mockResolvedValue(evaluations);

      const payload = createPayload('getBySubject', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'getBySubject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata?.totalCount).toBe(2);
    });

    it('should return error when subjectId is missing', async () => {
      const payload = createPayload('getBySubject');
      const result = await handler.execute(
        'getBySubject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SUBJECT_ID');
    });
  });

  describe('execute - getByScore', () => {
    it('should return evaluations for a composite score', async () => {
      evaluationRepo.findByCompositeScore.mockResolvedValue([mockEvaluation]);

      const payload = createPayload('getByScore', {
        compositeScoreId: 'score-123',
      });
      const result = await handler.execute(
        'getByScore',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return error when compositeScoreId is missing', async () => {
      const payload = createPayload('getByScore');
      const result = await handler.execute(
        'getByScore',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCORE_ID');
    });
  });

  describe('execute - metrics / accuracy', () => {
    it('should return accuracy metrics', async () => {
      const metrics = {
        overallAccuracy: 0.82,
        calibrationScore: 0.75,
        discriminationScore: 0.8,
        brierScore: 0.15,
        byWindow: { '7d': { count: 10, accuracy: 0.85 } },
        byDimension: { market: { count: 8, accuracy: 0.9 } },
      };
      evaluationService.calculateAccuracyMetrics.mockResolvedValue(metrics);

      const payload = createPayload('metrics');
      const result = await handler.execute(
        'metrics',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('overallAccuracy', '82.0%');
      expect(result.data).toHaveProperty('calibrationScore', '75.0%');
      expect(result.data).toHaveProperty('raw', metrics);
    });

    it('should filter by scope when scopeId provided', async () => {
      const metrics = {
        overallAccuracy: 0.82,
        calibrationScore: 0.75,
        discriminationScore: 0.8,
        brierScore: 0.15,
        byWindow: {},
        byDimension: {},
      };
      evaluationService.calculateAccuracyMetrics.mockResolvedValue(metrics);

      const payload = createPayload('metrics', { scopeId: 'scope-123' });
      const result = await handler.execute(
        'metrics',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(evaluationService.calculateAccuracyMetrics).toHaveBeenCalledWith(
        'scope-123',
      );
    });
  });

  describe('execute - byWindow', () => {
    it('should return evaluations grouped by window', async () => {
      const evaluations = [
        { ...mockEvaluation, score_accuracy: 0.8, calibration_error: 10 },
        {
          ...mockEvaluation,
          id: 'eval-2',
          score_accuracy: 0.9,
          calibration_error: 5,
        },
      ];
      evaluationRepo.findAllByWindow.mockResolvedValue(evaluations);
      evaluationRepo.calculateAverageAccuracy.mockResolvedValue(0.85);

      const payload = createPayload('byWindow', { window: '7d' });
      const result = await handler.execute(
        'byWindow',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as {
        window: string;
        evaluations: unknown[];
        stats: Record<string, unknown>;
      };
      expect(data).toHaveProperty('window', '7d');
      expect(data).toHaveProperty('evaluations');
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('avgAccuracy', '85.0%');
    });

    it('should return error when window is missing', async () => {
      const payload = createPayload('byWindow');
      const result = await handler.execute(
        'byWindow',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_WINDOW');
    });

    it('should return error for invalid window', async () => {
      const payload = createPayload('byWindow', { window: 'invalid' });
      const result = await handler.execute(
        'byWindow',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_WINDOW');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
    });
  });
});
