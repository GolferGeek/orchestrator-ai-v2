/**
 * Analytics Handler Tests
 *
 * Tests for the analytics dashboard handler, including:
 * - Accuracy comparison analytics
 * - Accuracy by strategy analytics
 * - Accuracy by target analytics
 * - Learning velocity analytics
 * - Scenario effectiveness analytics
 * - Promotion funnel analytics
 * - Summary analytics
 */

import { Test } from '@nestjs/testing';
import { AnalyticsHandler } from '../analytics.handler';
import { AnalyticsService } from '../../../services/analytics.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('AnalyticsHandler', () => {
  let handler: AnalyticsHandler;
  let analyticsService: jest.Mocked<AnalyticsService>;

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

  const mockContextWithoutOrg: ExecutionContext = {
    ...mockContext,
    orgSlug: '',
  };

  const mockAccuracyComparison = [
    {
      period_date: '2024-01-15',
      is_test: true,
      total_predictions: 50,
      resolved_predictions: 45,
      correct_predictions: 34,
      accuracy_pct: 0.75,
      avg_confidence: 0.68,
      avg_overall_score: 0.72,
    },
    {
      period_date: '2024-01-15',
      is_test: false,
      total_predictions: 200,
      resolved_predictions: 180,
      correct_predictions: 130,
      accuracy_pct: 0.72,
      avg_confidence: 0.7,
      avg_overall_score: 0.71,
    },
  ];

  const mockAccuracyByStrategy = [
    {
      strategy_name: 'Conservative Strategy',
      total_predictions: 100,
      resolved_predictions: 90,
      correct_predictions: 80,
      accuracy_pct: 0.8,
      avg_confidence: 0.72,
      avg_magnitude_score: 0.85,
      avg_timing_score: 0.78,
    },
  ];

  const mockAccuracyByTarget = [
    {
      target_id: 'target-1',
      target_name: 'Apple Inc',
      target_type: 'stock',
      total_predictions: 50,
      resolved_predictions: 45,
      correct_predictions: 40,
      accuracy_pct: 0.8,
      avg_confidence: 0.75,
      is_test: false,
    },
  ];

  const mockLearningVelocity = [
    {
      period_date: '2024-01-15',
      test_learnings_created: 10,
      production_learnings_created: 5,
      learnings_promoted: 3,
      avg_days_to_promotion: 5.5,
    },
  ];

  const mockScenarioEffectiveness = [
    {
      scenario_type: 'momentum_test',
      total_scenarios: 5,
      total_runs: 100,
      successful_runs: 85,
      success_rate_pct: 85.0,
      learnings_generated: 15,
      avg_run_duration_minutes: 30.5,
    },
  ];

  const mockPromotionFunnel = [
    {
      stage: 'suggested',
      count: 100,
      pct_of_total: 100.0,
    },
    {
      stage: 'approved',
      count: 75,
      pct_of_total: 75.0,
    },
    {
      stage: 'promoted',
      count: 50,
      pct_of_total: 50.0,
    },
  ];

  const mockSummary = {
    accuracy: {
      test: {
        total_predictions: 100,
        accuracy_pct: 0.75,
        avg_confidence: 0.68,
      },
      production: {
        total_predictions: 900,
        accuracy_pct: 0.76,
        avg_confidence: 0.72,
      },
    },
    learning_velocity: {
      test_learnings_created: 10,
      production_learnings_created: 5,
      learnings_promoted: 3,
      avg_days_to_promotion: 5.5,
    },
    scenario_effectiveness: {
      total_scenarios: 10,
      total_runs: 100,
      overall_success_rate_pct: 0.85,
      total_learnings_generated: 15,
    },
    promotion_funnel: {
      test_created: 50,
      validated: 40,
      backtested: 30,
      promoted: 20,
    },
  };

  beforeEach(async () => {
    const mockAnalyticsService = {
      getAccuracyComparison: jest.fn(),
      getAccuracyByStrategy: jest.fn(),
      getAccuracyByTarget: jest.fn(),
      getLearningVelocity: jest.fn(),
      getScenarioEffectiveness: jest.fn(),
      getPromotionFunnel: jest.fn(),
      getSummary: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsHandler,
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    handler = moduleRef.get<AnalyticsHandler>(AnalyticsHandler);
    analyticsService = moduleRef.get(AnalyticsService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('accuracy-comparison');
      expect(actions).toContain('accuracy-by-strategy');
      expect(actions).toContain('accuracy-by-target');
      expect(actions).toContain('learning-velocity');
      expect(actions).toContain('scenario-effectiveness');
      expect(actions).toContain('promotion-funnel');
      expect(actions).toContain('summary');
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

  describe('execute - accuracy-comparison action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'accuracy-comparison',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-comparison',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return accuracy comparison data', async () => {
      analyticsService.getAccuracyComparison.mockResolvedValue(
        mockAccuracyComparison,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-comparison',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-comparison',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyComparison).toHaveBeenCalledWith(
        'test-org',
        undefined,
        undefined,
      );
      expect(result.metadata?.totalCount).toBe(2);
    });

    it('should pass date range parameters', async () => {
      analyticsService.getAccuracyComparison.mockResolvedValue(
        mockAccuracyComparison,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-comparison',
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      };
      const result = await handler.execute(
        'accuracy-comparison',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyComparison).toHaveBeenCalledWith(
        'test-org',
        '2024-01-01',
        '2024-01-31',
      );
    });

    it('should handle accuracy comparison service error', async () => {
      analyticsService.getAccuracyComparison.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-comparison',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-comparison',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCURACY_COMPARISON_FAILED');
    });
  });

  describe('execute - accuracy-by-strategy action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-strategy',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-strategy',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return accuracy by strategy data', async () => {
      analyticsService.getAccuracyByStrategy.mockResolvedValue(
        mockAccuracyByStrategy,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-strategy',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-strategy',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyByStrategy).toHaveBeenCalledWith(
        'test-org',
        false,
      );
      const data = result.data as (typeof mockAccuracyByStrategy)[0][];
      expect(data[0]?.strategy_name).toBe('Conservative Strategy');
    });

    it('should pass includeTest parameter', async () => {
      analyticsService.getAccuracyByStrategy.mockResolvedValue(
        mockAccuracyByStrategy,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-strategy',
        params: { includeTest: true },
      };
      const result = await handler.execute(
        'accuracy-by-strategy',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyByStrategy).toHaveBeenCalledWith(
        'test-org',
        true,
      );
    });

    it('should handle accuracy by strategy service error', async () => {
      analyticsService.getAccuracyByStrategy.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-strategy',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-strategy',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCURACY_BY_STRATEGY_FAILED');
    });
  });

  describe('execute - accuracy-by-target action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-target',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-target',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return accuracy by target data', async () => {
      analyticsService.getAccuracyByTarget.mockResolvedValue(
        mockAccuracyByTarget,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-target',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyByTarget).toHaveBeenCalledWith(
        'test-org',
        false,
      );
      const data = result.data as (typeof mockAccuracyByTarget)[0][];
      expect(data[0]?.target_name).toBe('Apple Inc');
    });

    it('should pass includeTest parameter', async () => {
      analyticsService.getAccuracyByTarget.mockResolvedValue(
        mockAccuracyByTarget,
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-target',
        params: { includeTest: true },
      };
      const result = await handler.execute(
        'accuracy-by-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getAccuracyByTarget).toHaveBeenCalledWith(
        'test-org',
        true,
      );
    });

    it('should handle accuracy by target service error', async () => {
      analyticsService.getAccuracyByTarget.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'accuracy-by-target',
        params: {},
      };
      const result = await handler.execute(
        'accuracy-by-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCURACY_BY_TARGET_FAILED');
    });
  });

  describe('execute - learning-velocity action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'learning-velocity',
        params: {},
      };
      const result = await handler.execute(
        'learning-velocity',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return learning velocity data', async () => {
      analyticsService.getLearningVelocity.mockResolvedValue(
        mockLearningVelocity,
      );

      const payload: DashboardRequestPayload = {
        action: 'learning-velocity',
        params: {},
      };
      const result = await handler.execute(
        'learning-velocity',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getLearningVelocity).toHaveBeenCalledWith(
        'test-org',
        undefined,
        undefined,
      );
      const data = result.data as (typeof mockLearningVelocity)[0][];
      expect(data[0]?.test_learnings_created).toBe(10);
    });

    it('should pass date range parameters', async () => {
      analyticsService.getLearningVelocity.mockResolvedValue(
        mockLearningVelocity,
      );

      const payload: DashboardRequestPayload = {
        action: 'learning-velocity',
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      };
      const result = await handler.execute(
        'learning-velocity',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getLearningVelocity).toHaveBeenCalledWith(
        'test-org',
        '2024-01-01',
        '2024-01-31',
      );
    });

    it('should handle learning velocity service error', async () => {
      analyticsService.getLearningVelocity.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'learning-velocity',
        params: {},
      };
      const result = await handler.execute(
        'learning-velocity',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LEARNING_VELOCITY_FAILED');
    });
  });

  describe('execute - scenario-effectiveness action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'scenario-effectiveness',
        params: {},
      };
      const result = await handler.execute(
        'scenario-effectiveness',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return scenario effectiveness data', async () => {
      analyticsService.getScenarioEffectiveness.mockResolvedValue(
        mockScenarioEffectiveness,
      );

      const payload: DashboardRequestPayload = {
        action: 'scenario-effectiveness',
        params: {},
      };
      const result = await handler.execute(
        'scenario-effectiveness',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getScenarioEffectiveness).toHaveBeenCalledWith(
        'test-org',
      );
      const data = result.data as (typeof mockScenarioEffectiveness)[0][];
      expect(data[0]?.scenario_type).toBe('momentum_test');
      expect(data[0]?.success_rate_pct).toBe(85.0);
    });

    it('should handle scenario effectiveness service error', async () => {
      analyticsService.getScenarioEffectiveness.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'scenario-effectiveness',
        params: {},
      };
      const result = await handler.execute(
        'scenario-effectiveness',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SCENARIO_EFFECTIVENESS_FAILED');
    });
  });

  describe('execute - promotion-funnel action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'promotion-funnel',
        params: {},
      };
      const result = await handler.execute(
        'promotion-funnel',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return promotion funnel data', async () => {
      analyticsService.getPromotionFunnel.mockResolvedValue(mockPromotionFunnel);

      const payload: DashboardRequestPayload = {
        action: 'promotion-funnel',
        params: {},
      };
      const result = await handler.execute(
        'promotion-funnel',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(analyticsService.getPromotionFunnel).toHaveBeenCalledWith(
        'test-org',
      );
      const data = result.data as (typeof mockPromotionFunnel)[0][];
      expect(data).toHaveLength(3);
      expect(data[0]?.stage).toBe('suggested');
      expect(data[2]?.stage).toBe('promoted');
    });

    it('should handle promotion funnel service error', async () => {
      analyticsService.getPromotionFunnel.mockRejectedValue(
        new Error('Service error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'promotion-funnel',
        params: {},
      };
      const result = await handler.execute(
        'promotion-funnel',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROMOTION_FUNNEL_FAILED');
    });
  });

  describe('execute - summary action', () => {
    it('should return error if orgSlug is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute(
        'summary',
        payload,
        mockContextWithoutOrg,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG_SLUG');
    });

    it('should return summary data', async () => {
      analyticsService.getSummary.mockResolvedValue(mockSummary);

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(true);
      expect(analyticsService.getSummary).toHaveBeenCalledWith('test-org');
      const data = result.data as typeof mockSummary;
      expect(data.accuracy.production.total_predictions).toBe(900);
      expect(data.accuracy.production.accuracy_pct).toBe(0.76);
      expect(data.scenario_effectiveness.total_scenarios).toBe(10);
    });

    it('should handle summary service error', async () => {
      analyticsService.getSummary.mockRejectedValue(new Error('Service error'));

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ANALYTICS_SUMMARY_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      analyticsService.getSummary.mockResolvedValue(mockSummary);

      const payload: DashboardRequestPayload = {
        action: 'SUMMARY',
        params: {},
      };
      const result = await handler.execute('SUMMARY', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      analyticsService.getPromotionFunnel.mockResolvedValue(mockPromotionFunnel);

      const payload: DashboardRequestPayload = {
        action: 'Promotion-Funnel',
        params: {},
      };
      const result = await handler.execute(
        'Promotion-Funnel',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });
  });
});
