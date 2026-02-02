/**
 * Evaluation Handler Tests
 *
 * Tests for the evaluation dashboard handler, including:
 * - List action for resolved predictions with evaluations
 * - Get action for detailed evaluation data
 * - Evaluate action for triggering evaluation
 * - Override action for manual evaluation override
 */

import { Test } from '@nestjs/testing';
import { EvaluationHandler } from '../evaluation.handler';
import { PredictionRepository } from '../../../repositories/prediction.repository';
import { EvaluationService } from '../../../services/evaluation.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { Prediction } from '../../../interfaces/prediction.interface';

describe('EvaluationHandler', () => {
  let handler: EvaluationHandler;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let evaluationService: jest.Mocked<EvaluationService>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: 'prediction-runner',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockPrediction: Prediction = {
    id: 'pred-1',
    target_id: 'target-1',
    task_id: null,
    direction: 'up',
    confidence: 0.75,
    magnitude: 'medium',
    reasoning: 'Strong technical indicators',
    timeframe_hours: 24,
    predicted_at: '2024-01-15T09:00:00Z',
    expires_at: '2024-01-16T09:00:00Z',
    entry_price: 185.50,
    target_price: 190.00,
    stop_loss: 182.00,
    analyst_ensemble: { 'technical-tina': 0.6, 'sentiment-sam': 0.4 },
    llm_ensemble: { claude: 0.5, gpt: 0.5 },
    status: 'resolved',
    outcome_value: 8.5,
    outcome_captured_at: '2024-01-16T09:00:00Z',
    resolution_notes: 'Price moved up as predicted',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-16T09:00:00Z',
  };

  const mockEvaluationResult = {
    predictionId: 'pred-1',
    directionCorrect: true,
    magnitudeAccuracy: 0.85,
    timingAccuracy: 0.9,
    overallScore: 0.88,
    actualDirection: 'up' as const,
    actualMagnitude: 8.5,
    details: {
      predictedDirection: 'up' as const,
      predictedMagnitude: 8.0,
      predictedConfidence: 0.75,
      horizonHours: 24,
    },
  };

  beforeEach(async () => {
    const mockPredictionRepository = {
      findById: jest.fn(),
      findByTarget: jest.fn(),
    };

    const mockEvaluationService = {
      evaluatePrediction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EvaluationHandler,
        {
          provide: PredictionRepository,
          useValue: mockPredictionRepository,
        },
        {
          provide: EvaluationService,
          useValue: mockEvaluationService,
        },
      ],
    }).compile();

    handler = moduleRef.get<EvaluationHandler>(EvaluationHandler);
    predictionRepository = moduleRef.get(PredictionRepository);
    evaluationService = moduleRef.get(EvaluationService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('evaluate');
      expect(actions).toContain('override');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'invalid',
        params: {},
      };
      const result = await handler.execute('invalid', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('execute - list action', () => {
    it('should list predictions with evaluations', async () => {
      predictionRepository.findByTarget.mockResolvedValue([mockPrediction]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findByTarget).toHaveBeenCalledWith(
        'target-1',
        'resolved',
      );
      const data = result.data as { id: string; targetId: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.targetId).toBe('target-1');
    });

    it('should return empty array without targetId filter', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as unknown[];
      expect(data).toHaveLength(0);
    });

    it('should filter by fromDate', async () => {
      const predictions = [
        { ...mockPrediction, predicted_at: '2024-01-20T09:00:00Z' },
        { ...mockPrediction, id: 'pred-2', predicted_at: '2024-01-05T09:00:00Z' },
      ];
      predictionRepository.findByTarget.mockResolvedValue(predictions);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { targetId: 'target-1', fromDate: '2024-01-15' },
        },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should filter by toDate', async () => {
      const predictions = [
        { ...mockPrediction, predicted_at: '2024-01-10T09:00:00Z' },
        { ...mockPrediction, id: 'pred-2', predicted_at: '2024-01-25T09:00:00Z' },
      ];
      predictionRepository.findByTarget.mockResolvedValue(predictions);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { targetId: 'target-1', toDate: '2024-01-15' },
        },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('pred-1');
    });

    it('should paginate results', async () => {
      const predictions = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockPrediction,
          id: `pred-${i}`,
        }));
      predictionRepository.findByTarget.mockResolvedValue(predictions);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1' }, page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { id: string }[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
    });

    it('should handle list service error', async () => {
      predictionRepository.findByTarget.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
    });
  });

  describe('execute - get action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get evaluation by predictionId', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findById).toHaveBeenCalledWith('pred-1');
      const data = result.data as {
        prediction: { id: string };
        evaluation: null;
      };
      expect(data.prediction.id).toBe('pred-1');
    });

    it('should get evaluation by id parameter', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(predictionRepository.findById).toHaveBeenCalledWith('pred-1');
    });

    it('should return NOT_FOUND error if prediction does not exist', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - evaluate action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'evaluate',
        params: {},
      };
      const result = await handler.execute('evaluate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should evaluate prediction successfully', async () => {
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );

      const payload: DashboardRequestPayload = {
        action: 'evaluate',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('evaluate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(evaluationService.evaluatePrediction).toHaveBeenCalledWith(
        'pred-1',
      );
      const data = result.data as {
        predictionId: string;
        evaluation: { directionCorrect: boolean; overallScore: number };
      };
      expect(data.predictionId).toBe('pred-1');
      expect(data.evaluation.directionCorrect).toBe(true);
      expect(data.evaluation.overallScore).toBe(0.88);
    });

    it('should handle evaluate service error', async () => {
      evaluationService.evaluatePrediction.mockRejectedValue(
        new Error('Evaluation failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'evaluate',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('evaluate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EVALUATE_FAILED');
    });
  });

  describe('execute - override action', () => {
    beforeEach(async () => {
      // First evaluate to populate the cache
      evaluationService.evaluatePrediction.mockResolvedValue(
        mockEvaluationResult,
      );
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const evaluatePayload: DashboardRequestPayload = {
        action: 'evaluate',
        params: { predictionId: 'pred-1' },
      };
      await handler.execute('evaluate', evaluatePayload, mockContext);
    });

    it('should return error if predictionId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          overrideType: 'direction',
          overrideValue: true,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error if overrideType is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideValue: true,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error if reason is too short', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'direction',
          overrideValue: true,
          reason: 'Short',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REASON');
    });

    it('should return error for invalid overrideType', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'invalid',
          overrideValue: 0.5,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_TYPE');
    });

    it('should return error if direction override is not boolean', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'direction',
          overrideValue: 0.5,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_VALUE');
    });

    it('should return error if magnitude override is not between 0 and 1', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'magnitude',
          overrideValue: 1.5,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_VALUE');
    });

    it('should return error if prediction not found', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'non-existent',
          overrideType: 'direction',
          overrideValue: true,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return error if prediction has not been evaluated', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-2',
          overrideType: 'direction',
          overrideValue: true,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_EVALUATION');
    });

    it('should override direction successfully', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'direction',
          overrideValue: false,
          reason: 'Manual review shows direction was incorrect',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        predictionId: string;
        overrideApplied: {
          type: string;
          value: boolean;
          by: string;
        };
      };
      expect(data.predictionId).toBe('pred-1');
      expect(data.overrideApplied.type).toBe('direction');
      expect(data.overrideApplied.value).toBe(false);
      expect(data.overrideApplied.by).toBe('test-user');
    });

    it('should override magnitude successfully', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'magnitude',
          overrideValue: 0.95,
          reason: 'Manual review shows better magnitude accuracy',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        overrideApplied: { type: string; value: number };
      };
      expect(data.overrideApplied.type).toBe('magnitude');
      expect(data.overrideApplied.value).toBe(0.95);
    });

    it('should override timing successfully', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'timing',
          overrideValue: 0.7,
          reason: 'Manual review shows timing was suboptimal',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        overrideApplied: { type: string; value: number };
      };
      expect(data.overrideApplied.type).toBe('timing');
      expect(data.overrideApplied.value).toBe(0.7);
    });

    it('should override overall score successfully', async () => {
      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'overall',
          overrideValue: 0.6,
          reason: 'Manual review shows overall score should be lower',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        overrideApplied: { type: string; value: number };
      };
      expect(data.overrideApplied.type).toBe('overall');
      expect(data.overrideApplied.value).toBe(0.6);
    });

    it('should handle override service error', async () => {
      predictionRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'override',
        params: {
          predictionId: 'pred-1',
          overrideType: 'direction',
          overrideValue: true,
          reason: 'Test override reason here',
        },
      };
      const result = await handler.execute('override', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('OVERRIDE_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      predictionRepository.findById.mockResolvedValue(mockPrediction);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'pred-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
