/**
 * Learning Promotion Handler Tests
 *
 * Tests for the learning promotion dashboard handler, including:
 * - List-candidates action for test learnings
 * - Validate action for promotion validation
 * - Promote action for promoting test to production
 * - Reject action for rejecting test learnings
 * - History action for promotion history
 * - Stats action for promotion statistics
 * - Run-backtest action for backtest execution
 */

import { Test } from '@nestjs/testing';
import { LearningPromotionHandler } from '../learning-promotion.handler';
import { LearningPromotionService } from '../../../services/learning-promotion.service';
import { LearningService } from '../../../services/learning.service';
import { LearningRepository } from '../../../repositories/learning.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type {
  Learning,
  LearningLineageWithDetails,
} from '../../../interfaces/learning.interface';

describe('LearningPromotionHandler', () => {
  let handler: LearningPromotionHandler;
  let promotionService: jest.Mocked<LearningPromotionService>;
  let _learningService: jest.Mocked<LearningService>;
  let learningRepository: jest.Mocked<LearningRepository>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: 'prediction-runner',
    agentType: 'context' as const,
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockTestLearning: Learning = {
    id: 'learning-test-1',
    scope_level: 'runner' as const,
    domain: null,
    universe_id: null,
    target_id: null,
    analyst_id: null,
    learning_type: 'rule' as const,
    title: 'Test Momentum Threshold',
    description: 'Test learning for momentum threshold',
    config: {
      trigger_condition: 'momentum > 0.7',
      action: 'increase_confidence',
    },
    source_type: 'human' as const,
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    status: 'active' as const,
    superseded_by: null,
    version: 1,
    times_applied: 10,
    times_helpful: 8,
    is_test: true,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockProductionLearning: Learning = {
    ...mockTestLearning,
    id: 'learning-prod-1',
    title: 'Momentum Threshold',
    is_test: false,
  };

  const mockLineage: LearningLineageWithDetails = {
    id: 'lineage-1',
    organization_slug: 'test-org',
    test_learning_id: 'learning-test-1',
    production_learning_id: 'learning-prod-1',
    scenario_runs: ['run-1', 'run-2'],
    validation_metrics: {
      timesApplied: 10,
      timesHelpful: 8,
      successRate: 0.8,
    },
    backtest_result: {
      pass: true,
      improvement_score: 0.06,
    },
    promoted_by: 'test-user',
    promoted_at: '2024-01-20T00:00:00Z',
    notes: 'Validated successfully',
    created_at: '2024-01-20T00:00:00Z',
    promoter_email: 'test@example.com',
    promoter_name: 'Test User',
    test_learning_title: 'Test Momentum Threshold',
    production_learning_title: 'Momentum Threshold',
  };

  const mockValidationResult = {
    valid: true,
    learning: mockTestLearning,
    errors: [],
    warnings: [],
  };

  const mockPromotionStats = {
    total_test_learnings: 50,
    total_promoted: 20,
    total_rejected: 5,
    pending_review: 25,
    avg_times_applied: 15.5,
    avg_success_rate: 0.75,
  };

  const mockBacktestResult = {
    pass: true,
    improvement_score: 0.06,
    window_days: 30,
    details: {},
  };

  beforeEach(async () => {
    const mockPromotionService = {
      validateForPromotion: jest.fn(),
      promoteLearning: jest.fn(),
      rejectLearning: jest.fn(),
      getPromotionHistory: jest.fn(),
      getPromotionStats: jest.fn(),
      backtestLearning: jest.fn(),
    };

    const mockLearningService = {
      getActiveLearnings: jest.fn(),
      findByScope: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      supersede: jest.fn(),
    };

    const mockLearningRepository = {
      findByScope: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LearningPromotionHandler,
        {
          provide: LearningPromotionService,
          useValue: mockPromotionService,
        },
        {
          provide: LearningService,
          useValue: mockLearningService,
        },
        {
          provide: LearningRepository,
          useValue: mockLearningRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<LearningPromotionHandler>(LearningPromotionHandler);
    promotionService = moduleRef.get(LearningPromotionService);
    _learningService = moduleRef.get(LearningService);
    learningRepository = moduleRef.get(LearningRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list-candidates');
      expect(actions).toContain('validate');
      expect(actions).toContain('promote');
      expect(actions).toContain('reject');
      expect(actions).toContain('history');
      expect(actions).toContain('stats');
      expect(actions).toContain('run-backtest');
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

  describe('execute - list-candidates action', () => {
    it('should list test learning candidates', async () => {
      const testLearnings = [
        mockTestLearning,
        { ...mockTestLearning, id: 'learning-test-2', times_applied: 5 },
      ];
      learningRepository.findByScope.mockResolvedValue(testLearnings);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(learningRepository.findByScope).toHaveBeenCalledWith('runner');
      const data = result.data as typeof testLearnings;
      expect(data).toHaveLength(2);
      expect(data[0]?.id).toBe('learning-test-1'); // Higher times_applied first
    });

    it('should filter for active test learnings only', async () => {
      const allLearnings = [
        mockTestLearning, // active, is_test
        { ...mockTestLearning, id: 'learning-2', is_test: false }, // active, not test
        {
          ...mockTestLearning,
          id: 'learning-3',
          status: 'disabled' as const,
        }, // disabled, is_test
        { ...mockProductionLearning, id: 'learning-4' }, // active, production
      ];
      learningRepository.findByScope.mockResolvedValue(allLearnings);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as typeof allLearnings;
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('learning-test-1');
    });

    it('should sort by times_applied descending', async () => {
      const testLearnings = [
        { ...mockTestLearning, id: 'learning-1', times_applied: 5 },
        { ...mockTestLearning, id: 'learning-2', times_applied: 20 },
        { ...mockTestLearning, id: 'learning-3', times_applied: 10 },
      ];
      learningRepository.findByScope.mockResolvedValue(testLearnings);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as typeof testLearnings;
      expect(data[0]?.times_applied).toBe(20);
      expect(data[1]?.times_applied).toBe(10);
      expect(data[2]?.times_applied).toBe(5);
    });

    it('should enrich with validation metrics', async () => {
      learningRepository.findByScope.mockResolvedValue([mockTestLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as Array<
        typeof mockTestLearning & {
          validationMetrics: {
            timesApplied: number;
            timesHelpful: number;
            successRate: number;
          };
          readyForPromotion: boolean;
        }
      >;
      expect(data[0]?.validationMetrics.timesApplied).toBe(10);
      expect(data[0]?.validationMetrics.timesHelpful).toBe(8);
      expect(data[0]?.validationMetrics.successRate).toBe(0.8);
      expect(data[0]?.readyForPromotion).toBe(true);
    });

    it('should mark as not ready if times_applied < 3', async () => {
      const learning = {
        ...mockTestLearning,
        times_applied: 2,
        times_helpful: 2,
      };
      learningRepository.findByScope.mockResolvedValue([learning]);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as Array<
        typeof learning & { readyForPromotion: boolean }
      >;
      expect(data[0]?.readyForPromotion).toBe(false);
    });

    it('should mark as not ready if success rate < 0.5', async () => {
      const learning = {
        ...mockTestLearning,
        times_applied: 10,
        times_helpful: 4,
      };
      learningRepository.findByScope.mockResolvedValue([learning]);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as Array<
        typeof learning & { readyForPromotion: boolean }
      >;
      expect(data[0]?.readyForPromotion).toBe(false);
    });

    it('should paginate results', async () => {
      const testLearnings = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockTestLearning,
          id: `learning-${i}`,
          times_applied: 25 - i,
        }));
      learningRepository.findByScope.mockResolvedValue(testLearnings);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as typeof testLearnings;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      learningRepository.findByScope.mockResolvedValue([mockTestLearning]);

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle list-candidates service error', async () => {
      learningRepository.findByScope.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_CANDIDATES_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in list-candidates', async () => {
      learningRepository.findByScope.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list-candidates',
        params: {},
      };
      const result = await handler.execute(
        'list-candidates',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_CANDIDATES_FAILED');
      expect(result.error?.message).toBe('Failed to list promotion candidates');
    });
  });

  describe('execute - validate action', () => {
    it('should return error if learningId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'validate',
        params: {},
      };
      const result = await handler.execute('validate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should validate learning successfully', async () => {
      promotionService.validateForPromotion.mockResolvedValue(
        mockValidationResult,
      );

      const payload: DashboardRequestPayload = {
        action: 'validate',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('validate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.validateForPromotion).toHaveBeenCalledWith(
        'learning-test-1',
      );
      const data = result.data as {
        learningId: string;
        isValid: boolean;
        checks: {
          isTestLearning: boolean;
          isActive: boolean;
          notAlreadyPromoted: boolean;
          hasValidationMetrics: boolean;
          meetsMinApplications: boolean;
          meetsMinSuccessRate: boolean;
        };
        validationMetrics: {
          timesApplied: number;
          timesHelpful: number;
          successRate: number;
        };
        errors: string[];
        warnings: string[];
      };
      expect(data.learningId).toBe('learning-test-1');
      expect(data.isValid).toBe(true);
      expect(data.checks.isTestLearning).toBe(true);
      expect(data.checks.isActive).toBe(true);
      expect(data.checks.meetsMinApplications).toBe(true);
      expect(data.validationMetrics?.successRate).toBe(0.8);
    });

    it('should return invalid validation with errors', async () => {
      const invalidResult = {
        valid: false,
        learning: mockTestLearning,
        errors: ['Learning has already been promoted'],
        warnings: [],
      };
      promotionService.validateForPromotion.mockResolvedValue(invalidResult);

      const payload: DashboardRequestPayload = {
        action: 'validate',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('validate', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        learningId: string;
        isValid: boolean;
        checks: { notAlreadyPromoted: boolean };
        errors: string[];
      };
      expect(data.isValid).toBe(false);
      expect(data.checks.notAlreadyPromoted).toBe(false);
      expect(data.errors).toContain('Learning has already been promoted');
    });

    it('should handle validate service error', async () => {
      promotionService.validateForPromotion.mockRejectedValue(
        new Error('Validation service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'validate',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('validate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_FAILED');
      expect(result.error?.message).toBe('Validation service error');
    });

    it('should handle non-Error throws in validate', async () => {
      promotionService.validateForPromotion.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'validate',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('validate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_FAILED');
      expect(result.error?.message).toBe('Failed to validate learning');
    });
  });

  describe('execute - promote action', () => {
    it('should return error if learningId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: {},
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_LEARNING_ID');
    });

    it('should return error if userId is missing', async () => {
      const contextWithoutUser = { ...mockContext, userId: '' };
      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute(
        'promote',
        payload,
        contextWithoutUser,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_USER_ID');
    });

    it('should promote learning successfully', async () => {
      promotionService.promoteLearning.mockResolvedValue(mockLineage);

      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: {
          learningId: 'learning-test-1',
          reviewerNotes: 'Looks good',
        },
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.promoteLearning).toHaveBeenCalledWith(
        'learning-test-1',
        'test-user',
        'test-org',
        'Looks good',
        undefined,
        undefined,
      );
      const data = result.data as {
        id: string;
        testLearningId: string;
        productionLearningId: string;
        promotedBy: string;
      };
      expect(data.id).toBe('lineage-1');
      expect(data.testLearningId).toBe('learning-test-1');
      expect(data.productionLearningId).toBe('learning-prod-1');
      expect(data.promotedBy).toBe('test-user');
    });

    it('should promote learning with backtest result', async () => {
      promotionService.promoteLearning.mockResolvedValue(mockLineage);

      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: {
          learningId: 'learning-test-1',
          reviewerNotes: 'Backtest passed',
          backtestResult: {
            backtestId: 'backtest-1',
            learningId: 'learning-test-1',
            passed: true,
            metrics: {
              baselineAccuracy: 0.72,
              withLearningAccuracy: 0.78,
              accuracyLift: 0.06,
              baselineFalsePositiveRate: 0.15,
              withLearningFalsePositiveRate: 0.12,
              falsePositiveDelta: -0.03,
              predictionsAffected: 150,
              predictionsImproved: 95,
              predictionsDegraded: 10,
              statisticalSignificance: 0.95,
            },
            executedAt: '2024-01-20T00:00:00Z',
            executionTimeMs: 2500,
          },
        },
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.promoteLearning).toHaveBeenCalledWith(
        'learning-test-1',
        'test-user',
        'test-org',
        'Backtest passed',
        expect.objectContaining({
          pass: true,
          improvement_score: 0.06,
        }),
        undefined,
      );
    });

    it('should promote learning with scenario run IDs', async () => {
      promotionService.promoteLearning.mockResolvedValue(mockLineage);

      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: {
          learningId: 'learning-test-1',
          scenarioRunIds: ['run-1', 'run-2'],
        },
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.promoteLearning).toHaveBeenCalledWith(
        'learning-test-1',
        'test-user',
        'test-org',
        undefined,
        undefined,
        ['run-1', 'run-2'],
      );
    });

    it('should handle promote service error', async () => {
      promotionService.promoteLearning.mockRejectedValue(
        new Error('Promotion failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROMOTION_FAILED');
      expect(result.error?.message).toBe('Promotion failed');
    });

    it('should handle non-Error throws in promote', async () => {
      promotionService.promoteLearning.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'promote',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('promote', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROMOTION_FAILED');
      expect(result.error?.message).toBe('Failed to promote learning');
    });
  });

  describe('execute - reject action', () => {
    it('should return error if learningId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: { reason: 'Not good enough' },
      };
      const result = await handler.execute('reject', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_LEARNING_ID');
    });

    it('should return error if reason is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('reject', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_REASON');
    });

    it('should return error if userId is missing', async () => {
      const contextWithoutUser = { ...mockContext, userId: '' };
      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: {
          learningId: 'learning-test-1',
          reason: 'Not good enough',
        },
      };
      const result = await handler.execute(
        'reject',
        payload,
        contextWithoutUser,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_USER_ID');
    });

    it('should reject learning successfully', async () => {
      const rejectedLearning = {
        ...mockTestLearning,
        status: 'disabled' as const,
      };
      promotionService.rejectLearning.mockResolvedValue(rejectedLearning);

      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: {
          learningId: 'learning-test-1',
          reason: 'Not accurate enough',
        },
      };
      const result = await handler.execute('reject', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.rejectLearning).toHaveBeenCalledWith(
        'learning-test-1',
        'test-user',
        'test-org',
        'Not accurate enough',
      );
      const data = result.data as {
        learningId: string;
        status: string;
        reason: string;
        rejectedBy: string;
      };
      expect(data.learningId).toBe('learning-test-1');
      expect(data.status).toBe('disabled');
      expect(data.reason).toBe('Not accurate enough');
      expect(data.rejectedBy).toBe('test-user');
    });

    it('should handle reject service error', async () => {
      promotionService.rejectLearning.mockRejectedValue(
        new Error('Rejection failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: {
          learningId: 'learning-test-1',
          reason: 'Not good enough',
        },
      };
      const result = await handler.execute('reject', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REJECTION_FAILED');
      expect(result.error?.message).toBe('Rejection failed');
    });

    it('should handle non-Error throws in reject', async () => {
      promotionService.rejectLearning.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'reject',
        params: {
          learningId: 'learning-test-1',
          reason: 'Not good enough',
        },
      };
      const result = await handler.execute('reject', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REJECTION_FAILED');
      expect(result.error?.message).toBe('Failed to reject learning');
    });
  });

  describe('execute - history action', () => {
    it('should return error if orgSlug is missing', async () => {
      const contextWithoutOrg = { ...mockContext, orgSlug: '' };
      const payload: DashboardRequestPayload = {
        action: 'history',
        params: {},
      };
      const result = await handler.execute(
        'history',
        payload,
        contextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should get promotion history', async () => {
      promotionService.getPromotionHistory.mockResolvedValue([mockLineage]);

      const payload: DashboardRequestPayload = {
        action: 'history',
        params: {},
      };
      const result = await handler.execute('history', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.getPromotionHistory).toHaveBeenCalledWith(
        'test-org',
      );
      const data = result.data as Array<{
        id: string;
        testLearningId: string;
        productionLearningId: string;
        promotedBy: string;
      }>;
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('lineage-1');
      expect(data[0]?.testLearningId).toBe('learning-test-1');
    });

    it('should paginate history results', async () => {
      const history = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockLineage,
          id: `lineage-${i}`,
        }));
      promotionService.getPromotionHistory.mockResolvedValue(history);

      const payload: DashboardRequestPayload = {
        action: 'history',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('history', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof history;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      promotionService.getPromotionHistory.mockResolvedValue([mockLineage]);

      const payload: DashboardRequestPayload = {
        action: 'history',
        params: {},
      };
      const result = await handler.execute('history', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle history service error', async () => {
      promotionService.getPromotionHistory.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'history',
        params: {},
      };
      const result = await handler.execute('history', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HISTORY_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in history', async () => {
      promotionService.getPromotionHistory.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'history',
        params: {},
      };
      const result = await handler.execute('history', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HISTORY_FAILED');
      expect(result.error?.message).toBe('Failed to get promotion history');
    });
  });

  describe('execute - stats action', () => {
    it('should return error if orgSlug is missing', async () => {
      const contextWithoutOrg = { ...mockContext, orgSlug: '' };
      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, contextWithoutOrg);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should get promotion stats', async () => {
      promotionService.getPromotionStats.mockResolvedValue(mockPromotionStats);

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(true);
      expect(promotionService.getPromotionStats).toHaveBeenCalledWith(
        'test-org',
      );
      const data = result.data as {
        totalTestLearnings: number;
        totalPromoted: number;
        totalRejected: number;
        pendingReview: number;
        avgTimesApplied: number;
        avgSuccessRate: number;
      };
      expect(data.totalTestLearnings).toBe(50);
      expect(data.totalPromoted).toBe(20);
      expect(data.totalRejected).toBe(5);
      expect(data.pendingReview).toBe(25);
      expect(data.avgTimesApplied).toBe(15.5);
      expect(data.avgSuccessRate).toBe(0.75);
    });

    it('should handle stats service error', async () => {
      promotionService.getPromotionStats.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STATS_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in stats', async () => {
      promotionService.getPromotionStats.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STATS_FAILED');
      expect(result.error?.message).toBe('Failed to get promotion stats');
    });
  });

  describe('execute - run-backtest action', () => {
    it('should return error if learningId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'run-backtest',
        params: {},
      };
      const result = await handler.execute(
        'run-backtest',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_LEARNING_ID');
    });

    it('should run backtest successfully', async () => {
      promotionService.backtestLearning.mockResolvedValue(mockBacktestResult);

      const payload: DashboardRequestPayload = {
        action: 'run-backtest',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute(
        'run-backtest',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(promotionService.backtestLearning).toHaveBeenCalledWith(
        'learning-test-1',
        30,
      );
      const data = result.data as {
        backtestId: string;
        learningId: string;
        passed: boolean;
        metrics: {
          accuracyLift: number;
        };
      };
      expect(data.learningId).toBe('learning-test-1');
      expect(data.passed).toBe(true);
      expect(data.metrics.accuracyLift).toBeDefined();
    });

    it('should run backtest with custom window days', async () => {
      promotionService.backtestLearning.mockResolvedValue(mockBacktestResult);

      const payload: DashboardRequestPayload = {
        action: 'run-backtest',
        params: { learningId: 'learning-test-1', windowDays: 60 },
      };
      const result = await handler.execute(
        'run-backtest',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(promotionService.backtestLearning).toHaveBeenCalledWith(
        'learning-test-1',
        60,
      );
    });

    it('should handle backtest service error', async () => {
      promotionService.backtestLearning.mockRejectedValue(
        new Error('Backtest failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'run-backtest',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute(
        'run-backtest',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BACKTEST_FAILED');
      expect(result.error?.message).toBe('Backtest failed');
    });

    it('should handle non-Error throws in run-backtest', async () => {
      promotionService.backtestLearning.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'run-backtest',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute(
        'run-backtest',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BACKTEST_FAILED');
      expect(result.error?.message).toBe('Failed to run backtest');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      learningRepository.findByScope.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST-CANDIDATES',
        params: {},
      };
      const result = await handler.execute(
        'LIST-CANDIDATES',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      promotionService.validateForPromotion.mockResolvedValue(
        mockValidationResult,
      );

      const payload: DashboardRequestPayload = {
        action: 'Validate',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute('Validate', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase run-backtest', async () => {
      promotionService.backtestLearning.mockResolvedValue(mockBacktestResult);

      const payload: DashboardRequestPayload = {
        action: 'RUN-BACKTEST',
        params: { learningId: 'learning-test-1' },
      };
      const result = await handler.execute(
        'RUN-BACKTEST',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });
  });
});
