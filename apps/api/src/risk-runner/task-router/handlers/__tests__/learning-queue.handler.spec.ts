import { Test, TestingModule } from '@nestjs/testing';
import { LearningQueueHandler } from '../learning-queue.handler';
import { RiskLearningService } from '../../../services/risk-learning.service';
import { HistoricalReplayService } from '../../../services/historical-replay.service';
import { LearningRepository } from '../../../repositories/learning.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  RiskLearning,
  RiskLearningQueueItem,
  PendingLearningView,
} from '../../../interfaces/learning.interface';

describe('LearningQueueHandler', () => {
  let handler: LearningQueueHandler;
  let learningService: jest.Mocked<RiskLearningService>;
  let replayService: jest.Mocked<HistoricalReplayService>;
  let _learningRepo: jest.Mocked<LearningRepository>;

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

  const mockQueueItem: RiskLearningQueueItem = {
    id: 'queue-123',
    scope_id: 'scope-123',
    subject_id: null,
    evaluation_id: 'eval-123',
    suggested_scope_level: 'scope',
    suggested_learning_type: 'pattern',
    suggested_title: 'Test pattern',
    suggested_description: 'Test description',
    suggested_config: {},
    ai_reasoning: 'Test reasoning',
    ai_confidence: 0.8,
    status: 'pending',
    reviewed_by_user_id: null,
    reviewer_notes: null,
    reviewed_at: null,
    learning_id: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  const mockPendingView: PendingLearningView = {
    ...mockQueueItem,
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'US Tech Stocks',
  };

  const mockLearning: RiskLearning = {
    id: 'learning-123',
    scope_level: 'scope',
    domain: 'investment',
    scope_id: 'scope-123',
    subject_id: null,
    dimension_id: null,
    learning_type: 'pattern',
    title: 'Test pattern',
    description: 'Test description',
    config: {},
    times_applied: 0,
    times_helpful: 0,
    effectiveness_score: null,
    status: 'testing',
    is_test: true,
    source_type: 'ai_approved',
    parent_learning_id: null,
    is_production: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
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
        LearningQueueHandler,
        {
          provide: RiskLearningService,
          useValue: {
            getPendingQueue: jest.fn(),
            getQueueByScope: jest.fn(),
            getQueueItemById: jest.fn(),
            respondToQueueItem: jest.fn(),
            countPendingQueue: jest.fn(),
            validateForPromotion: jest.fn(),
            promoteLearning: jest.fn(),
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
          provide: LearningRepository,
          useValue: {},
        },
      ],
    }).compile();

    handler = module.get<LearningQueueHandler>(LearningQueueHandler);
    learningService = module.get(RiskLearningService);
    replayService = module.get(HistoricalReplayService);
    _learningRepo = module.get(LearningRepository);

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
      expect(actions).toContain('respond');
      expect(actions).toContain('approve');
      expect(actions).toContain('reject');
      expect(actions).toContain('modify');
      expect(actions).toContain('count');
      expect(actions).toContain('replay');
      expect(actions).toContain('promote');
      expect(actions).toContain('retire');
    });
  });

  describe('execute - list', () => {
    it('should return pending queue items', async () => {
      learningService.getPendingQueue.mockResolvedValue([mockPendingView]);

      const payload = createPayload('list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(learningService.getPendingQueue).toHaveBeenCalled();
    });

    it('should filter by scope when scopeId provided', async () => {
      learningService.getQueueByScope.mockResolvedValue([mockPendingView]);

      const payload = createPayload('list', { scopeId: 'scope-123' });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(learningService.getQueueByScope).toHaveBeenCalledWith(
        'scope-123',
        {
          includeTest: false,
        },
      );
    });

    it('should apply pagination', async () => {
      const items = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockPendingView, id: `queue-${i}` }));
      learningService.getPendingQueue.mockResolvedValue(items);

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
    it('should return a queue item by ID', async () => {
      learningService.getQueueItemById.mockResolvedValue(mockQueueItem);

      const payload = createPayload('get', { id: 'queue-123' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQueueItem);
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

    it('should return error when item not found', async () => {
      learningService.getQueueItemById.mockResolvedValue(null);

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

  describe('execute - respond', () => {
    it('should approve a queue item and create learning', async () => {
      learningService.respondToQueueItem.mockResolvedValue(mockLearning);

      const payload = createPayload('respond', {
        id: 'queue-123',
        decision: 'approved',
        reviewerNotes: 'Looks good',
      });
      const result = await handler.execute(
        'respond',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('learningId', 'learning-123');
      expect(result.data).toHaveProperty('decision', 'approved');
    });

    it('should reject a queue item', async () => {
      learningService.respondToQueueItem.mockResolvedValue(null);

      const payload = createPayload('respond', {
        id: 'queue-123',
        decision: 'rejected',
        reviewerNotes: 'Not applicable',
      });
      const result = await handler.execute(
        'respond',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('decision', 'rejected');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('respond', { decision: 'approved' });
      const result = await handler.execute(
        'respond',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when decision is missing', async () => {
      const payload = createPayload('respond', { id: 'queue-123' });
      const result = await handler.execute(
        'respond',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_DECISION');
    });

    it('should return error for invalid decision', async () => {
      const payload = createPayload('respond', {
        id: 'queue-123',
        decision: 'invalid',
      });
      const result = await handler.execute(
        'respond',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DECISION');
    });
  });

  describe('execute - approve (shortcut)', () => {
    it('should approve a queue item', async () => {
      learningService.respondToQueueItem.mockResolvedValue(mockLearning);

      const payload = createPayload('approve', { id: 'queue-123' });
      const result = await handler.execute(
        'approve',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('decision', 'approved');
    });
  });

  describe('execute - reject (shortcut)', () => {
    it('should reject a queue item', async () => {
      learningService.respondToQueueItem.mockResolvedValue(null);

      const payload = createPayload('reject', { id: 'queue-123' });
      const result = await handler.execute(
        'reject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('decision', 'rejected');
    });
  });

  describe('execute - count', () => {
    it('should return count of pending items', async () => {
      learningService.countPendingQueue.mockResolvedValue(15);

      const payload = createPayload('count');
      const result = await handler.execute(
        'count',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ pendingCount: 15 });
    });
  });

  describe('execute - replay', () => {
    it('should run replay test for a learning', async () => {
      const replayResult = {
        scenarioId: 'replay-learning-123',
        learningId: 'learning-123',
        learningTitle: 'Test pattern',
        pass: true,
        improvementScore: 0.1,
        baselineAccuracy: 0.7,
        withLearningAccuracy: 0.8,
        accuracyLift: 0.1,
        sampleSize: 50,
        affectedCount: 20,
        improvedCount: 15,
        degradedCount: 2,
        statisticalSignificance: 0.95,
        executionTimeMs: 1500,
        details: {},
      };
      replayService.replayLearning.mockResolvedValue(replayResult);

      const payload = createPayload('replay', {
        learningId: 'learning-123',
        windowDays: 30,
      });
      const result = await handler.execute(
        'replay',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(replayResult);
      expect(result.metadata?.message).toContain('PASSED');
    });

    it('should return error when learningId is missing', async () => {
      const payload = createPayload('replay');
      const result = await handler.execute(
        'replay',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_LEARNING_ID');
    });
  });

  describe('execute - promote', () => {
    it('should promote a learning to production', async () => {
      const productionLearning = {
        ...mockLearning,
        id: 'learning-prod',
        is_test: false,
        is_production: true,
        status: 'active' as const,
      };
      learningService.validateForPromotion.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        learning: mockLearning,
      });
      learningService.promoteLearning.mockResolvedValue(productionLearning);

      const payload = createPayload('promote', { learningId: 'learning-123' });
      const result = await handler.execute(
        'promote',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty(
        'productionLearningId',
        'learning-prod',
      );
    });

    it('should return error when validation fails', async () => {
      learningService.validateForPromotion.mockResolvedValue({
        valid: false,
        errors: ['Learning has never been applied'],
        warnings: [],
        learning: undefined,
      });

      const payload = createPayload('promote', { learningId: 'learning-123' });
      const result = await handler.execute(
        'promote',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('execute - retire', () => {
    it('should retire a learning', async () => {
      const retiredLearning = { ...mockLearning, status: 'retired' as const };
      learningService.retireLearning.mockResolvedValue(retiredLearning);

      const payload = createPayload('retire', {
        learningId: 'learning-123',
        reason: 'No longer effective',
      });
      const result = await handler.execute(
        'retire',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'retired');
    });

    it('should return error when learningId is missing', async () => {
      const payload = createPayload('retire');
      const result = await handler.execute(
        'retire',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_LEARNING_ID');
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
