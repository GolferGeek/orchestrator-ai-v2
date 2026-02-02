/**
 * Learning Queue Handler Tests
 *
 * Tests for the learning queue dashboard handler, including:
 * - List action for pending learning suggestions with filtering and pagination
 * - Get action for individual queue items
 * - Respond action for human review decisions (approve/reject/modify)
 */

import { Test } from '@nestjs/testing';
import { LearningQueueHandler } from '../learning-queue.handler';
import { LearningQueueService } from '../../../services/learning-queue.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { LearningQueue } from '../../../interfaces/learning.interface';

describe('LearningQueueHandler', () => {
  let handler: LearningQueueHandler;
  let learningQueueService: jest.Mocked<LearningQueueService>;

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

  const mockLearningQueueItem: LearningQueue = {
    id: 'queue-1',
    suggested_scope_level: 'runner' as const,
    suggested_domain: null,
    suggested_universe_id: null,
    suggested_target_id: null,
    suggested_analyst_id: null,
    suggested_learning_type: 'pattern' as const,
    suggested_title: 'Increase momentum threshold',
    suggested_description: 'Increase momentum threshold for better accuracy',
    suggested_config: { adjustment: 0.1 },
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    ai_reasoning: 'Based on historical performance analysis',
    ai_confidence: 0.8,
    status: 'pending' as const,
    reviewed_at: null,
    reviewed_by_user_id: null,
    reviewer_notes: null,
    final_scope_level: null,
    final_domain: null,
    final_universe_id: null,
    final_target_id: null,
    final_analyst_id: null,
    learning_id: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  const mockDomainLearning: LearningQueue = {
    ...mockLearningQueueItem,
    id: 'queue-2',
    suggested_scope_level: 'domain' as const,
    suggested_domain: 'stocks',
    suggested_learning_type: 'threshold' as const,
    suggested_title: 'Adjust confidence threshold for stocks',
  };

  const mockUniverseLearning: LearningQueue = {
    ...mockLearningQueueItem,
    id: 'queue-3',
    suggested_scope_level: 'universe' as const,
    suggested_universe_id: 'universe-123',
    suggested_learning_type: 'rule' as const,
    suggested_title: 'Universe-specific rule',
  };

  const mockApprovedItem: LearningQueue = {
    ...mockLearningQueueItem,
    id: 'queue-4',
    status: 'approved' as const,
    reviewed_at: '2024-01-16T10:00:00Z',
    reviewed_by_user_id: 'user-123',
    reviewer_notes: 'Looks good',
    learning_id: 'learning-456',
  };

  beforeEach(async () => {
    const mockLearningQueueService = {
      getItemsByStatus: jest.fn(),
      findById: jest.fn(),
      respond: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LearningQueueHandler,
        {
          provide: LearningQueueService,
          useValue: mockLearningQueueService,
        },
      ],
    }).compile();

    handler = moduleRef.get<LearningQueueHandler>(LearningQueueHandler);
    learningQueueService = moduleRef.get(LearningQueueService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('respond');
      expect(actions).toHaveLength(3);
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
      expect(result.error?.message).toContain('invalid');
      expect(result.error?.details?.supportedActions).toEqual([
        'list',
        'get',
        'respond',
      ]);
    });
  });

  describe('execute - list action', () => {
    it('should list pending items by default', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([
        mockLearningQueueItem,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.getItemsByStatus).toHaveBeenCalledWith(
        'pending',
      );
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('queue-1');
    });

    it('should list items by specified status', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([
        mockApprovedItem,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { status: 'approved' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.getItemsByStatus).toHaveBeenCalledWith(
        'approved',
      );
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(1);
      expect(data[0]?.status).toBe('approved');
    });

    it('should filter by suggestedScopeLevel', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([
        mockLearningQueueItem,
        mockDomainLearning,
        mockUniverseLearning,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { suggestedScopeLevel: 'domain' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(1);
      expect(data[0]?.suggested_scope_level).toBe('domain');
    });

    it('should filter by suggestedLearningType', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([
        mockLearningQueueItem,
        mockDomainLearning,
        mockUniverseLearning,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { suggestedLearningType: 'rule' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(1);
      expect(data[0]?.suggested_learning_type).toBe('rule');
    });

    it('should apply multiple filters', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([
        mockLearningQueueItem,
        mockDomainLearning,
        mockUniverseLearning,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: {
            suggestedScopeLevel: 'universe',
            suggestedLearningType: 'rule',
          },
        },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('queue-3');
    });

    it('should paginate results with default values', async () => {
      const items: LearningQueue[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockLearningQueueItem,
          id: `queue-${i}`,
        }));
      learningQueueService.getItemsByStatus.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(20); // Default pageSize
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should paginate results with custom page and pageSize', async () => {
      const items: LearningQueue[] = Array(30)
        .fill(null)
        .map((_, i) => ({
          ...mockLearningQueueItem,
          id: `queue-${i}`,
        }));
      learningQueueService.getItemsByStatus.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(10);
      expect(data[0]?.id).toBe('queue-10'); // Second page starts at index 10
      expect(result.metadata?.totalCount).toBe(30);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should handle last page pagination', async () => {
      const items: LearningQueue[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockLearningQueueItem,
          id: `queue-${i}`,
        }));
      learningQueueService.getItemsByStatus.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 3, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(5); // Last page has 5 items
      expect(result.metadata?.hasMore).toBe(false);
    });

    it('should handle empty results', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as LearningQueue[];
      expect(data).toHaveLength(0);
      expect(result.metadata?.totalCount).toBe(0);
    });

    it('should handle list service error', async () => {
      learningQueueService.getItemsByStatus.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in list', async () => {
      learningQueueService.getItemsByStatus.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list learning queue');
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
      expect(result.error?.message).toBe('Queue item ID is required');
    });

    it('should get queue item by id', async () => {
      learningQueueService.findById.mockResolvedValue(mockLearningQueueItem);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'queue-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.findById).toHaveBeenCalledWith('queue-1');
      const data = result.data as LearningQueue;
      expect(data.id).toBe('queue-1');
      expect(data.suggested_title).toBe('Increase momentum threshold');
    });

    it('should return NOT_FOUND error if item does not exist', async () => {
      learningQueueService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('non-existent');
    });

    it('should handle get service error', async () => {
      learningQueueService.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'queue-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      learningQueueService.findById.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'queue-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get queue item');
    });
  });

  describe('execute - respond action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { decision: 'approved' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('id and decision');
    });

    it('should return error if decision is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('id and decision');
    });

    it('should return error for invalid decision', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'invalid' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DECISION');
      expect(result.error?.message).toContain('approved');
      expect(result.error?.message).toContain('rejected');
      expect(result.error?.message).toContain('modified');
    });

    it('should approve a learning successfully', async () => {
      learningQueueService.respond.mockResolvedValue(mockApprovedItem);

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'approved' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        {
          status: 'approved',
          reviewer_notes: undefined,
        },
        'test-user',
      );
      const data = result.data as { queueItem: LearningQueue; message: string };
      expect(data.message).toBe('Learning queue item approved');
      expect(data.queueItem.id).toBe('queue-4');
    });

    it('should reject a learning successfully', async () => {
      const rejectedItem: LearningQueue = {
        ...mockLearningQueueItem,
        status: 'rejected' as const,
        reviewed_at: '2024-01-16T10:00:00Z',
        reviewed_by_user_id: 'test-user',
      };
      learningQueueService.respond.mockResolvedValue(rejectedItem);

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'rejected' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        {
          status: 'rejected',
          reviewer_notes: undefined,
        },
        'test-user',
      );
      const data = result.data as { message: string };
      expect(data.message).toBe('Learning queue item rejected');
    });

    it('should modify a learning with reviewer notes', async () => {
      const modifiedItem: LearningQueue = {
        ...mockLearningQueueItem,
        status: 'modified' as const,
        reviewed_at: '2024-01-16T10:00:00Z',
        reviewed_by_user_id: 'test-user',
        reviewer_notes: 'Adjusted threshold value',
      };
      learningQueueService.respond.mockResolvedValue(modifiedItem);

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          id: 'queue-1',
          decision: 'modified',
          reviewerNotes: 'Adjusted threshold value',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        {
          status: 'modified',
          reviewer_notes: 'Adjusted threshold value',
        },
        'test-user',
      );
    });

    it('should include final fields when modifying', async () => {
      const modifiedItem: LearningQueue = {
        ...mockLearningQueueItem,
        status: 'modified' as const,
        reviewed_at: '2024-01-16T10:00:00Z',
        reviewed_by_user_id: 'test-user',
        final_scope_level: 'domain' as const,
        learning_id: 'learning-789',
      };
      learningQueueService.respond.mockResolvedValue(modifiedItem);

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          id: 'queue-1',
          decision: 'modified',
          finalTitle: 'Updated threshold',
          finalDescription: 'Updated description',
          finalScopeLevel: 'domain',
          finalLearningType: 'threshold',
          finalConfig: { adjustment: 0.2 },
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        {
          status: 'modified',
          reviewer_notes: undefined,
          final_title: 'Updated threshold',
          final_description: 'Updated description',
          final_scope_level: 'domain',
          final_learning_type: 'threshold',
          final_config: { adjustment: 0.2 },
        },
        'test-user',
      );
    });

    it('should only include final fields for modified decision', async () => {
      learningQueueService.respond.mockResolvedValue(mockApprovedItem);

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          id: 'queue-1',
          decision: 'approved',
          finalTitle: 'Should be ignored',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        {
          status: 'approved',
          reviewer_notes: undefined,
        },
        'test-user',
      );
    });

    it('should use userId from context', async () => {
      learningQueueService.respond.mockResolvedValue(mockApprovedItem);

      const customContext: ExecutionContext = {
        ...mockContext,
        userId: 'custom-user-123',
      };

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'approved' },
      };
      const result = await handler.execute('respond', payload, customContext);

      expect(result.success).toBe(true);
      expect(learningQueueService.respond).toHaveBeenCalledWith(
        'queue-1',
        expect.any(Object),
        'custom-user-123',
      );
    });

    it('should handle respond service error', async () => {
      learningQueueService.respond.mockRejectedValue(
        new Error('Processing failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'approved' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPOND_FAILED');
      expect(result.error?.message).toBe('Processing failed');
    });

    it('should handle non-Error throws in respond', async () => {
      learningQueueService.respond.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { id: 'queue-1', decision: 'approved' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPOND_FAILED');
      expect(result.error?.message).toBe('Failed to respond to queue item');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      learningQueueService.getItemsByStatus.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      learningQueueService.findById.mockResolvedValue(mockLearningQueueItem);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'queue-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase respond action', async () => {
      learningQueueService.respond.mockResolvedValue(mockApprovedItem);

      const payload: DashboardRequestPayload = {
        action: 'RESPOND',
        params: { id: 'queue-1', decision: 'approved' },
      };
      const result = await handler.execute('RESPOND', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
