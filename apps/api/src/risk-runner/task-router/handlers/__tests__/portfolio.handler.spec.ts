import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioHandler } from '../portfolio.handler';
import { PortfolioRiskService } from '../../../services/portfolio-risk.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  PortfolioRiskSummary,
  SubjectRiskContribution,
  PortfolioHeatmap,
  PortfolioTrend,
} from '../../../interfaces/portfolio.interface';

describe('PortfolioHandler', () => {
  let handler: PortfolioHandler;
  let portfolioService: jest.Mocked<PortfolioRiskService>;

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

  const mockPortfolioSummary: PortfolioRiskSummary = {
    scope_id: 'scope-1',
    scope_name: 'US Tech Stocks',
    total_subjects: 3,
    assessed_subjects: 3,
    average_risk_score: 55,
    weighted_risk_score: 55,
    max_risk_score: 75,
    min_risk_score: 35,
    risk_distribution: {
      low: 1,
      moderate: 1,
      elevated: 0,
      high: 1,
      critical: 0,
    },
    dimension_breakdown: [
      {
        dimension_slug: 'market',
        dimension_name: 'Market Risk',
        average_score: 60,
        max_score: 80,
        min_score: 40,
        contributing_subjects: 3,
      },
    ],
    alerts_summary: {
      total: 2,
      unacknowledged: 1,
      by_severity: { info: 0, warning: 1, critical: 1 },
      recent_alerts: [],
    },
    concentration_risk: {
      concentration_score: 35,
      risk_level: 'moderate',
      highly_correlated_pairs: 1,
      recommendation: 'Consider diversifying',
    },
    calculated_at: '2026-01-15T00:00:00Z',
  };

  const mockSubjectContributions: SubjectRiskContribution[] = [
    {
      subject_id: 'subject-1',
      identifier: 'AAPL',
      name: 'Apple Inc.',
      risk_score: 75,
      weight: 0.5,
      weighted_contribution: 37.5,
      percentage_of_total: 50,
      dimension_scores: { market: 80, fundamental: 70 },
      is_high_risk: true,
      alerts_count: 1,
    },
    {
      subject_id: 'subject-2',
      identifier: 'MSFT',
      name: 'Microsoft Corp.',
      risk_score: 55,
      weight: 0.3,
      weighted_contribution: 16.5,
      percentage_of_total: 30,
      dimension_scores: { market: 60, fundamental: 50 },
      is_high_risk: false,
      alerts_count: 0,
    },
    {
      subject_id: 'subject-3',
      identifier: 'GOOGL',
      name: 'Alphabet Inc.',
      risk_score: 35,
      weight: 0.2,
      weighted_contribution: 7,
      percentage_of_total: 20,
      dimension_scores: { market: 40, fundamental: 30 },
      is_high_risk: false,
      alerts_count: 0,
    },
  ];

  const mockPortfolioHeatmap: PortfolioHeatmap = {
    scope_id: 'scope-1',
    subjects: [
      { id: 'subject-1', identifier: 'AAPL', overall_score: 75 },
      { id: 'subject-2', identifier: 'MSFT', overall_score: 55 },
      { id: 'subject-3', identifier: 'GOOGL', overall_score: 35 },
    ],
    dimensions: ['market', 'fundamental'],
    cells: [
      {
        subject_index: 0,
        dimension_index: 0,
        score: 80,
        relative_score: 'high',
      },
      {
        subject_index: 0,
        dimension_index: 1,
        score: 70,
        relative_score: 'high',
      },
      {
        subject_index: 1,
        dimension_index: 0,
        score: 60,
        relative_score: 'average',
      },
      {
        subject_index: 1,
        dimension_index: 1,
        score: 50,
        relative_score: 'average',
      },
      {
        subject_index: 2,
        dimension_index: 0,
        score: 40,
        relative_score: 'low',
      },
      {
        subject_index: 2,
        dimension_index: 1,
        score: 30,
        relative_score: 'low',
      },
    ],
  };

  const mockPortfolioTrend: PortfolioTrend = {
    scope_id: 'scope-1',
    period: 'week',
    data_points: [
      {
        date: '2026-01-09',
        average_risk_score: 50,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-10',
        average_risk_score: 52,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-11',
        average_risk_score: 53,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-12',
        average_risk_score: 55,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-13',
        average_risk_score: 54,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-14',
        average_risk_score: 55,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
      {
        date: '2026-01-15',
        average_risk_score: 55,
        subjects_assessed: 3,
        high_risk_subjects: 1,
      },
    ],
    trend_direction: 'worsening',
    change_percentage: 10,
  };

  const createPayload = (
    action: string,
    params?: Record<string, unknown>,
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioHandler,
        {
          provide: PortfolioRiskService,
          useValue: {
            getPortfolioSummary: jest.fn(),
            getSubjectContributions: jest.fn(),
            getPortfolioHeatmap: jest.fn(),
            getPortfolioTrend: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<PortfolioHandler>(PortfolioHandler);
    portfolioService = module.get(PortfolioRiskService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('summary');
      expect(actions).toContain('contributions');
      expect(actions).toContain('heatmap');
      expect(actions).toContain('trend');
    });
  });

  describe('execute - summary', () => {
    it('should generate portfolio summary for a scope', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      const payload = createPayload('portfolio.summary', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPortfolioSummary);
      expect(result.metadata?.assessmentCoverage).toBe(100);
      expect(portfolioService.getPortfolioSummary).toHaveBeenCalledWith(
        'scope-1',
        {
          includeInactiveSubjects: undefined,
          maxAlerts: undefined,
        },
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('portfolio.summary');
      const result = await handler.execute(
        'summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should pass optional parameters', async () => {
      portfolioService.getPortfolioSummary.mockResolvedValue(
        mockPortfolioSummary,
      );

      const payload = createPayload('portfolio.summary', {
        scopeId: 'scope-1',
        includeInactive: true,
        maxAlerts: 10,
      });
      await handler.execute('summary', payload, mockExecutionContext);

      expect(portfolioService.getPortfolioSummary).toHaveBeenCalledWith(
        'scope-1',
        {
          includeInactiveSubjects: true,
          maxAlerts: 10,
        },
      );
    });

    it('should handle service error', async () => {
      portfolioService.getPortfolioSummary.mockRejectedValue(
        new Error('Scope not found: invalid-scope'),
      );

      const payload = createPayload('portfolio.summary', {
        scopeId: 'invalid-scope',
      });
      const result = await handler.execute(
        'summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUMMARY_GENERATION_FAILED');
      expect(result.error?.message).toContain('Scope not found');
    });

    it('should calculate assessment coverage correctly', async () => {
      const partialSummary = {
        ...mockPortfolioSummary,
        total_subjects: 5,
        assessed_subjects: 3,
      };
      portfolioService.getPortfolioSummary.mockResolvedValue(partialSummary);

      const payload = createPayload('portfolio.summary', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.assessmentCoverage).toBe(60);
    });

    it('should handle zero subjects', async () => {
      const emptyPortfolio = {
        ...mockPortfolioSummary,
        total_subjects: 0,
        assessed_subjects: 0,
      };
      portfolioService.getPortfolioSummary.mockResolvedValue(emptyPortfolio);

      const payload = createPayload('portfolio.summary', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.assessmentCoverage).toBe(0);
    });
  });

  describe('execute - contributions', () => {
    it('should get subject contributions for a scope', async () => {
      portfolioService.getSubjectContributions.mockResolvedValue(
        mockSubjectContributions,
      );

      const payload = createPayload('portfolio.contributions', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubjectContributions);
      expect(result.metadata?.totalSubjects).toBe(3);
      expect(result.metadata?.highRiskSubjects).toBe(1);
      expect(portfolioService.getSubjectContributions).toHaveBeenCalledWith(
        'scope-1',
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('portfolio.contributions');
      const result = await handler.execute(
        'contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should handle service error', async () => {
      portfolioService.getSubjectContributions.mockRejectedValue(
        new Error('Scope not found'),
      );

      const payload = createPayload('portfolio.contributions', {
        scopeId: 'invalid-scope',
      });
      const result = await handler.execute(
        'contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONTRIBUTIONS_FAILED');
    });

    it('should count high risk subjects correctly', async () => {
      const allHighRisk = mockSubjectContributions.map((c) => ({
        ...c,
        is_high_risk: true,
      }));
      portfolioService.getSubjectContributions.mockResolvedValue(allHighRisk);

      const payload = createPayload('portfolio.contributions', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.highRiskSubjects).toBe(3);
    });
  });

  describe('execute - heatmap', () => {
    it('should generate portfolio heatmap for a scope', async () => {
      portfolioService.getPortfolioHeatmap.mockResolvedValue(
        mockPortfolioHeatmap,
      );

      const payload = createPayload('portfolio.heatmap', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'heatmap',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPortfolioHeatmap);
      expect(result.metadata?.subjectCount).toBe(3);
      expect(result.metadata?.dimensionCount).toBe(2);
      expect(portfolioService.getPortfolioHeatmap).toHaveBeenCalledWith(
        'scope-1',
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('portfolio.heatmap');
      const result = await handler.execute(
        'heatmap',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should handle service error', async () => {
      portfolioService.getPortfolioHeatmap.mockRejectedValue(
        new Error('Failed to generate heatmap'),
      );

      const payload = createPayload('portfolio.heatmap', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'heatmap',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HEATMAP_FAILED');
    });
  });

  describe('execute - trend', () => {
    it('should generate portfolio trend for a scope with default period', async () => {
      portfolioService.getPortfolioTrend.mockResolvedValue(mockPortfolioTrend);

      const payload = createPayload('portfolio.trend', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'trend',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPortfolioTrend);
      expect(result.metadata?.trendDirection).toBe('worsening');
      expect(result.metadata?.dataPoints).toBe(7);
      expect(portfolioService.getPortfolioTrend).toHaveBeenCalledWith(
        'scope-1',
        'week',
      );
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('portfolio.trend');
      const result = await handler.execute(
        'trend',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should pass custom period parameter', async () => {
      portfolioService.getPortfolioTrend.mockResolvedValue({
        ...mockPortfolioTrend,
        period: 'day',
      });

      const payload = createPayload('portfolio.trend', {
        scopeId: 'scope-1',
        period: 'day',
      });
      await handler.execute('trend', payload, mockExecutionContext);

      expect(portfolioService.getPortfolioTrend).toHaveBeenCalledWith(
        'scope-1',
        'day',
      );
    });

    it('should handle month period', async () => {
      portfolioService.getPortfolioTrend.mockResolvedValue({
        ...mockPortfolioTrend,
        period: 'month',
      });

      const payload = createPayload('portfolio.trend', {
        scopeId: 'scope-1',
        period: 'month',
      });
      const result = await handler.execute(
        'trend',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(portfolioService.getPortfolioTrend).toHaveBeenCalledWith(
        'scope-1',
        'month',
      );
    });

    it('should handle service error', async () => {
      portfolioService.getPortfolioTrend.mockRejectedValue(
        new Error('Failed to generate trend'),
      );

      const payload = createPayload('portfolio.trend', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'trend',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TREND_FAILED');
    });

    it('should report different trend directions', async () => {
      const improvingTrend = {
        ...mockPortfolioTrend,
        trend_direction: 'improving' as const,
      };
      portfolioService.getPortfolioTrend.mockResolvedValue(improvingTrend);

      const payload = createPayload('portfolio.trend', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'trend',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.trendDirection).toBe('improving');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('portfolio.unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });
});
