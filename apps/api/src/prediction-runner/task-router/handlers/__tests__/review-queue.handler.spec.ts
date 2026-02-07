/**
 * Review Queue Handler Tests
 *
 * Tests for the review queue dashboard handler, including:
 * - List action for pending reviews with filtering
 * - Get action for individual review items
 * - Respond action for human review decisions
 */

import { Test } from '@nestjs/testing';
import { ReviewQueueHandler } from '../review-queue.handler';
import {
  ReviewQueueService,
  ReviewQueueItem,
} from '../../../services/review-queue.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('ReviewQueueHandler', () => {
  let handler: ReviewQueueHandler;
  let reviewQueueService: jest.Mocked<ReviewQueueService>;

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

  const mockReviewItem: ReviewQueueItem = {
    id: 'review-1',
    signal_id: 'signal-1',
    target_id: 'target-1',
    confidence: 0.55,
    recommended_action: 'approve',
    assessment_summary: 'Strong technical signal with momentum indicators',
    analyst_reasoning: 'RSI and MACD confirm bullish trend',
    status: 'pending',
    decision: null,
    decided_by: null,
    decided_at: null,
    notes: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  const mockPredictor = {
    id: 'predictor-1',
    article_id: 'article-1',
    target_id: 'target-1',
    direction: 'bullish' as const,
    strength: 7,
    confidence: 0.7,
    reasoning: 'Strong technical signal',
    analyst_slug: 'technical-tina',
    analyst_assessment: {
      direction: 'bullish' as const,
      confidence: 0.7,
      reasoning: 'Technical indicators confirm bullish trend',
      key_factors: ['RSI breakout', 'MACD crossover'],
      risks: ['Overbought conditions'],
    },
    llm_usage_id: 'llm-1',
    status: 'active' as const,
    consumed_at: null,
    consumed_by_prediction_id: null,
    expires_at: '2024-01-16T10:00:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  const mockLearningQueue = {
    id: 'learning-queue-1',
    suggested_scope_level: 'runner' as const,
    suggested_domain: null,
    suggested_universe_id: null,
    suggested_target_id: null,
    suggested_analyst_id: null,
    suggested_learning_type: 'pattern' as const,
    suggested_title: 'Increase momentum threshold',
    suggested_description: 'Increase momentum threshold for better accuracy',
    suggested_config: {},
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    ai_reasoning: 'Based on historical performance',
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

  const mockReviewResponse = {
    predictor: mockPredictor,
    learning: mockLearningQueue,
  };

  beforeEach(async () => {
    const mockReviewQueueService = {
      getPendingReviews: jest.fn(),
      getReviewItem: jest.fn(),
      handleReviewResponse: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewQueueHandler,
        {
          provide: ReviewQueueService,
          useValue: mockReviewQueueService,
        },
      ],
    }).compile();

    handler = moduleRef.get<ReviewQueueHandler>(ReviewQueueHandler);
    reviewQueueService = moduleRef.get(ReviewQueueService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('respond');
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
    it('should list pending reviews without filters', async () => {
      reviewQueueService.getPendingReviews.mockResolvedValue([mockReviewItem]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.getPendingReviews).toHaveBeenCalledWith(
        undefined,
      );
      const data = result.data as ReviewQueueItem[];
      expect(data).toHaveLength(1);
      expect(data[0]?.target_id).toBe('target-1');
    });

    it('should list pending reviews with targetId filter', async () => {
      reviewQueueService.getPendingReviews.mockResolvedValue([mockReviewItem]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { targetId: 'target-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.getPendingReviews).toHaveBeenCalledWith(
        'target-1',
      );
    });

    it('should filter by fromDate', async () => {
      const items: ReviewQueueItem[] = [
        { ...mockReviewItem, created_at: '2024-01-20T10:00:00Z' },
        {
          ...mockReviewItem,
          id: 'review-2',
          created_at: '2024-01-05T10:00:00Z',
        },
      ];
      reviewQueueService.getPendingReviews.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { fromDate: '2024-01-15' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ReviewQueueItem[];
      expect(data).toHaveLength(1);
      expect(data[0]?.created_at).toBe('2024-01-20T10:00:00Z');
    });

    it('should filter by toDate', async () => {
      const items: ReviewQueueItem[] = [
        { ...mockReviewItem, created_at: '2024-01-10T10:00:00Z' },
        {
          ...mockReviewItem,
          id: 'review-2',
          created_at: '2024-01-25T10:00:00Z',
        },
      ];
      reviewQueueService.getPendingReviews.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { toDate: '2024-01-15' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ReviewQueueItem[];
      expect(data).toHaveLength(1);
      expect(data[0]?.created_at).toBe('2024-01-10T10:00:00Z');
    });

    it('should filter by both fromDate and toDate', async () => {
      const items: ReviewQueueItem[] = [
        { ...mockReviewItem, created_at: '2024-01-05T10:00:00Z' },
        {
          ...mockReviewItem,
          id: 'review-2',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          ...mockReviewItem,
          id: 'review-3',
          created_at: '2024-01-25T10:00:00Z',
        },
      ];
      reviewQueueService.getPendingReviews.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { fromDate: '2024-01-10', toDate: '2024-01-20' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ReviewQueueItem[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('review-2');
    });

    it('should paginate results', async () => {
      const items: ReviewQueueItem[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockReviewItem,
          id: `review-${i}`,
        }));
      reviewQueueService.getPendingReviews.mockResolvedValue(items);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ReviewQueueItem[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      reviewQueueService.getPendingReviews.mockResolvedValue([mockReviewItem]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle list service error', async () => {
      reviewQueueService.getPendingReviews.mockRejectedValue(
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
      reviewQueueService.getPendingReviews.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list review queue');
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

    it('should get review item by id', async () => {
      reviewQueueService.getReviewItem.mockResolvedValue(mockReviewItem);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'review-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.getReviewItem).toHaveBeenCalledWith('review-1');
      const data = result.data as ReviewQueueItem;
      expect(data.id).toBe('review-1');
      expect(data.confidence).toBe(0.55);
    });

    it('should return NOT_FOUND error if item does not exist', async () => {
      reviewQueueService.getReviewItem.mockResolvedValue(null);

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
      reviewQueueService.getReviewItem.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'review-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      reviewQueueService.getReviewItem.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'review-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get review item');
    });
  });

  describe('execute - respond action', () => {
    it('should return error if reviewId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { decision: 'approve' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error if decision is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error for invalid decision', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1', decision: 'invalid' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DECISION');
      expect(result.error?.message).toContain('approve');
      expect(result.error?.message).toContain('reject');
      expect(result.error?.message).toContain('modify');
    });

    it('should approve a review successfully', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1', decision: 'approve' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.handleReviewResponse).toHaveBeenCalledWith({
        review_id: 'review-1',
        decision: 'approve',
        strength_override: undefined,
        notes: undefined,
        learning_note: undefined,
      });
      const data = result.data as {
        message: string;
        predictor: object;
        learning: object;
      };
      expect(data.message).toBe('Signal approved successfully');
    });

    it('should reject a review successfully', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1', decision: 'reject' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { message: string };
      expect(data.message).toBe('Signal rejected successfully');
    });

    it('should modify a review with strength override', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          reviewId: 'review-1',
          decision: 'modify',
          strengthOverride: 0.8,
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.handleReviewResponse).toHaveBeenCalledWith({
        review_id: 'review-1',
        decision: 'modify',
        strength_override: 0.8,
        notes: undefined,
        learning_note: undefined,
      });
    });

    it('should include notes in the response', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          reviewId: 'review-1',
          decision: 'approve',
          notes: 'Strong technical signal',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.handleReviewResponse).toHaveBeenCalledWith({
        review_id: 'review-1',
        decision: 'approve',
        strength_override: undefined,
        notes: 'Strong technical signal',
        learning_note: undefined,
      });
    });

    it('should include learning note in the response', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          reviewId: 'review-1',
          decision: 'approve',
          learningNote: 'Consider momentum threshold for this pattern',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.handleReviewResponse).toHaveBeenCalledWith({
        review_id: 'review-1',
        decision: 'approve',
        strength_override: undefined,
        notes: undefined,
        learning_note: 'Consider momentum threshold for this pattern',
      });
    });

    it('should include all optional fields', async () => {
      reviewQueueService.handleReviewResponse.mockResolvedValue(
        mockReviewResponse,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          reviewId: 'review-1',
          decision: 'modify',
          strengthOverride: 0.75,
          notes: 'Adjusted based on volume analysis',
          learningNote: 'Volume should be weighted higher',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(reviewQueueService.handleReviewResponse).toHaveBeenCalledWith({
        review_id: 'review-1',
        decision: 'modify',
        strength_override: 0.75,
        notes: 'Adjusted based on volume analysis',
        learning_note: 'Volume should be weighted higher',
      });
    });

    it('should handle respond service error', async () => {
      reviewQueueService.handleReviewResponse.mockRejectedValue(
        new Error('Processing failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1', decision: 'approve' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPOND_FAILED');
      expect(result.error?.message).toBe('Processing failed');
    });

    it('should handle non-Error throws in respond', async () => {
      reviewQueueService.handleReviewResponse.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: { reviewId: 'review-1', decision: 'approve' },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESPOND_FAILED');
      expect(result.error?.message).toBe('Failed to respond to review item');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      reviewQueueService.getPendingReviews.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      reviewQueueService.getReviewItem.mockResolvedValue(mockReviewItem);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'review-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
