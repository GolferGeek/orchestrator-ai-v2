/**
 * Learning Handler Tests
 *
 * Tests for the learning dashboard handler, including:
 * - List action for learnings by scope/target
 * - Get action for individual learnings
 * - Create action for new learnings
 * - Update action for modifying learnings
 * - Supersede action for replacing learnings
 */

import { Test } from '@nestjs/testing';
import { LearningHandler } from '../learning.handler';
import { LearningService } from '../../../services/learning.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('LearningHandler', () => {
  let handler: LearningHandler;
  let learningService: jest.Mocked<LearningService>;

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

  const mockLearning = {
    id: 'learning-1',
    scope_level: 'runner' as const,
    domain: null,
    universe_id: null,
    target_id: null,
    analyst_id: null,
    learning_type: 'rule' as const,
    title: 'Momentum threshold',
    description: 'Increase momentum threshold for better accuracy',
    config: { threshold: 0.7 },
    source_type: 'human' as const,
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    status: 'active' as const,
    superseded_by: null,
    version: 1,
    times_applied: 10,
    times_helpful: 8,
    is_test: false,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const mockLearningService = {
      getActiveLearnings: jest.fn(),
      findByScope: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      supersede: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LearningHandler,
        {
          provide: LearningService,
          useValue: mockLearningService,
        },
      ],
    }).compile();

    handler = moduleRef.get<LearningHandler>(LearningHandler);
    learningService = moduleRef.get(LearningService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('supersede');
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
    });
  });

  describe('execute - list action', () => {
    it('should return empty array without targetId or scopeLevel', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof mockLearning[];
      expect(data).toHaveLength(0);
    });

    it('should list learnings by targetId using scope resolution', async () => {
      learningService.getActiveLearnings.mockResolvedValue([mockLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.getActiveLearnings).toHaveBeenCalledWith(
        'target-1',
        undefined,
        undefined,
      );
    });

    it('should list learnings by targetId and analystId', async () => {
      learningService.getActiveLearnings.mockResolvedValue([mockLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1', analystId: 'analyst-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.getActiveLearnings).toHaveBeenCalledWith(
        'target-1',
        undefined,
        'analyst-1',
      );
    });

    it('should list learnings by scopeLevel', async () => {
      learningService.findByScope.mockResolvedValue([mockLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.findByScope).toHaveBeenCalled();
    });

    it('should list learnings by scopeLevel with status filter', async () => {
      learningService.findByScope.mockResolvedValue([mockLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner', status: 'active' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should filter by learningType', async () => {
      const learnings = [
        { ...mockLearning, learning_type: 'rule' },
        { ...mockLearning, id: 'learning-2', learning_type: 'pattern' },
      ];
      learningService.findByScope.mockResolvedValue(learnings);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner', learningType: 'rule' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof learnings;
      expect(data).toHaveLength(1);
      expect(data[0]?.learning_type).toBe('rule');
    });

    it('should filter by sourceType', async () => {
      const learnings = [
        { ...mockLearning, source_type: 'human' },
        { ...mockLearning, id: 'learning-2', source_type: 'ai_suggested' },
      ];
      learningService.findByScope.mockResolvedValue(learnings);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner', sourceType: 'human' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof learnings;
      expect(data).toHaveLength(1);
      expect(data[0]?.source_type).toBe('human');
    });

    it('should paginate results', async () => {
      const learnings = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockLearning, id: `learning-${i}` }));
      learningService.findByScope.mockResolvedValue(learnings);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner' }, page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof learnings;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
    });

    it('should handle list service error', async () => {
      learningService.findByScope.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { scopeLevel: 'runner' } },
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

    it('should get learning by id', async () => {
      learningService.findById.mockResolvedValue(mockLearning);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'learning-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.findById).toHaveBeenCalledWith('learning-1');
      const data = result.data as typeof mockLearning;
      expect(data.title).toBe('Momentum threshold');
    });

    it('should return NOT_FOUND error if learning does not exist', async () => {
      learningService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      learningService.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'learning-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - create action', () => {
    it('should return error if required fields are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: { scope_level: 'runner' },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should create learning successfully', async () => {
      learningService.create.mockResolvedValue(mockLearning);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'Momentum threshold',
          description: 'Increase momentum threshold',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'Momentum threshold',
          description: 'Increase momentum threshold',
          source_type: 'human',
          status: 'active',
        }),
      );
    });

    it('should create learning with all optional fields', async () => {
      learningService.create.mockResolvedValue(mockLearning);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          scope_level: 'target',
          learning_type: 'pattern',
          title: 'AAPL pattern',
          description: 'Pattern for AAPL',
          config: { threshold: 0.8 },
          source_type: 'ai_suggested',
          domain: 'stocks',
          universe_id: 'universe-1',
          target_id: 'target-1',
          analyst_id: 'analyst-1',
          source_evaluation_id: 'eval-1',
          source_missed_opportunity_id: 'miss-1',
          status: 'active',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle create service error', async () => {
      learningService.create.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'Test',
          description: 'Test description',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
    });
  });

  describe('execute - update action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { title: 'New Title' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should update learning successfully', async () => {
      const updatedLearning = { ...mockLearning, title: 'New Title' };
      learningService.update.mockResolvedValue(updatedLearning);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'learning-1', title: 'New Title' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.update).toHaveBeenCalledWith('learning-1', {
        title: 'New Title',
      });
    });

    it('should update learning with multiple fields', async () => {
      learningService.update.mockResolvedValue(mockLearning);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'learning-1',
          title: 'New Title',
          description: 'New description',
          config: { threshold: 0.9 },
          status: 'disabled',
        },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.update).toHaveBeenCalledWith('learning-1', {
        title: 'New Title',
        description: 'New description',
        config: { threshold: 0.9 },
        status: 'disabled',
      });
    });

    it('should handle update service error', async () => {
      learningService.update.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'learning-1', title: 'New Title' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_FAILED');
    });
  });

  describe('execute - supersede action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'supersede',
        params: {
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'New version',
          description: 'New version description',
        },
      };
      const result = await handler.execute('supersede', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error if required fields are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'supersede',
        params: { id: 'learning-1', scope_level: 'runner' },
      };
      const result = await handler.execute('supersede', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should supersede learning successfully', async () => {
      const newLearning = { ...mockLearning, id: 'learning-2', version: 2 };
      learningService.supersede.mockResolvedValue(newLearning);

      const payload: DashboardRequestPayload = {
        action: 'supersede',
        params: {
          id: 'learning-1',
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'Updated momentum threshold',
          description: 'Better threshold based on testing',
        },
      };
      const result = await handler.execute('supersede', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningService.supersede).toHaveBeenCalledWith(
        'learning-1',
        expect.objectContaining({
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'Updated momentum threshold',
          description: 'Better threshold based on testing',
        }),
      );
      const data = result.data as { superseded: string; newLearning: typeof newLearning };
      expect(data.superseded).toBe('learning-1');
      expect(data.newLearning.version).toBe(2);
    });

    it('should handle supersede service error', async () => {
      learningService.supersede.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'supersede',
        params: {
          id: 'learning-1',
          scope_level: 'runner',
          learning_type: 'rule',
          title: 'New version',
          description: 'New version description',
        },
      };
      const result = await handler.execute('supersede', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUPERSEDE_FAILED');
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
      learningService.findById.mockResolvedValue(mockLearning);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'learning-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
