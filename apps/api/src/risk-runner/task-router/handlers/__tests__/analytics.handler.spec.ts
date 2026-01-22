import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsHandler } from '../analytics.handler';
import { SupabaseService } from '@/supabase/supabase.service';
import { CompositeScoreRepository } from '../../../repositories/composite-score.repository';
import { DimensionRepository } from '../../../repositories/dimension.repository';
import { SubjectRepository } from '../../../repositories/subject.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';

type AnyData = any;

describe('AnalyticsHandler', () => {
  let handler: AnalyticsHandler;
  let _supabaseService: jest.Mocked<SupabaseService>;
  let _compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let dimensionRepo: jest.Mocked<DimensionRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;

  const mockClient = {
    schema: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'risk-agent',
    agentType: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockDimensions = [
    {
      id: 'dim-1',
      slug: 'market-volatility',
      name: 'Market Volatility',
      display_name: 'Market Volatility',
      icon: 'chart-line',
      color: '#EF4444',
      display_order: 1,
    },
    {
      id: 'dim-2',
      slug: 'liquidity-risk',
      name: 'Liquidity Risk',
      display_name: 'Liquidity Risk',
      icon: 'water',
      color: '#3B82F6',
      display_order: 2,
    },
  ];

  const mockSubjects = [
    {
      id: 'subject-1',
      scope_id: 'scope-1',
      identifier: 'BTC',
      name: 'Bitcoin',
      subject_type: 'asset',
    },
    {
      id: 'subject-2',
      scope_id: 'scope-1',
      identifier: 'ETH',
      name: 'Ethereum',
      subject_type: 'asset',
    },
  ];

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
    // Reset all mocks
    jest.clearAllMocks();
    Object.values(mockClient).forEach((fn) => {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        fn.mockReset();
        if (fn !== mockClient.single && fn !== mockClient.rpc) {
          fn.mockReturnThis();
        }
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsHandler,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findLatestBySubject: jest.fn(),
          },
        },
        {
          provide: DimensionRepository,
          useValue: {
            findByScope: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<AnalyticsHandler>(AnalyticsHandler);
    _supabaseService = module.get(SupabaseService);
    _compositeScoreRepo = module.get(CompositeScoreRepository);
    dimensionRepo = module.get(DimensionRepository);
    subjectRepo = module.get(SubjectRepository);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('score-history');
      expect(actions).toContain('score-trends');
      expect(actions).toContain('scope-score-history');
      expect(actions).toContain('heatmap');
      expect(actions).toContain('portfolio-aggregate');
      expect(actions).toContain('risk-distribution');
      expect(actions).toContain('dimension-contributions');
      expect(actions).toContain('correlations');
      expect(actions).toContain('compare-subjects');
      expect(actions).toContain('save-comparison');
      expect(actions).toContain('list-comparisons');
      expect(actions).toContain('delete-comparison');
    });
  });

  describe('execute - score-history', () => {
    const mockHistoryData = [
      {
        id: 'score-1',
        overall_score: 0.65,
        dimension_scores: { 'market-volatility': 0.7 },
        confidence: 0.85,
        previous_score: 0.6,
        score_change: 0.05,
        score_change_percent: 8.33,
        debate_adjustment: 0,
        created_at: '2024-01-15T00:00:00Z',
      },
      {
        id: 'score-2',
        overall_score: 0.6,
        dimension_scores: { 'market-volatility': 0.65 },
        confidence: 0.82,
        previous_score: null,
        score_change: null,
        score_change_percent: null,
        debate_adjustment: 0,
        created_at: '2024-01-14T00:00:00Z',
      },
    ];

    it('should return score history for a subject', async () => {
      mockClient.rpc.mockResolvedValue({ data: mockHistoryData, error: null });

      const payload = createPayload('analytics.score-history', {
        subjectId: 'subject-1',
        days: 30,
      });
      const result = await handler.execute(
        'score-history',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      const data = result.data as Array<Record<string, unknown>>;
      expect(data).toHaveLength(2);
      expect(data[0]?.['overallScore']).toBe(0.65);
      expect(result.metadata?.subjectId).toBe('subject-1');
    });

    it('should return error when subjectId is missing', async () => {
      const payload = createPayload('analytics.score-history', {});
      const result = await handler.execute(
        'score-history',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SUBJECT_ID');
    });

    it('should use default days and limit', async () => {
      mockClient.rpc.mockResolvedValue({ data: [], error: null });

      const payload = createPayload('analytics.score-history', {
        subjectId: 'subject-1',
      });
      await handler.execute('score-history', payload, mockExecutionContext);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_score_history', {
        p_subject_id: 'subject-1',
        p_days: 30,
        p_limit: 100,
      });
    });
  });

  describe('execute - score-trends', () => {
    const mockTrendData = [
      {
        subject_id: 'subject-1',
        current_score: 0.65,
        change_7d: 0.05,
        change_30d: 0.1,
        total_assessments: 10,
        avg_score: 0.6,
        max_score: 0.7,
        min_score: 0.5,
        score_stddev: 0.08,
        first_assessment: '2024-01-01T00:00:00Z',
        latest_assessment: '2024-01-15T00:00:00Z',
      },
    ];

    it('should return score trends for a scope', async () => {
      mockClient.eq.mockResolvedValue({ data: mockTrendData, error: null });

      const payload = createPayload('analytics.score-trends', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'score-trends',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data[0].currentScore).toBe(0.65);
      expect(data[0].change7d).toBe(0.05);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.score-trends', {});
      const result = await handler.execute(
        'score-trends',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - heatmap', () => {
    const mockHeatmapData = [
      {
        subject_id: 'subject-1',
        subject_name: 'Bitcoin',
        subject_identifier: 'BTC',
        subject_type: 'asset',
        dimensions: [
          { slug: 'market-volatility', score: 0.7, risk_level: 'critical' },
          { slug: 'liquidity-risk', score: 0.3, risk_level: 'low' },
        ],
      },
    ];

    it('should return heatmap data for a scope', async () => {
      dimensionRepo.findByScope.mockResolvedValue(
        mockDimensions as unknown as never,
      );
      mockClient.rpc.mockResolvedValue({ data: mockHeatmapData, error: null });
      mockClient.single.mockResolvedValue({
        data: { id: 'scope-1', name: 'Test Scope' },
        error: null,
      });

      const payload = createPayload('analytics.heatmap', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'heatmap',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.rows).toHaveLength(1);
      expect(data.dimensions).toHaveLength(2);
      expect(result.metadata?.subjectCount).toBe(1);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.heatmap', {});
      const result = await handler.execute(
        'heatmap',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - portfolio-aggregate', () => {
    const mockAggregateData = {
      scope_id: 'scope-1',
      scope_name: 'Crypto Portfolio',
      domain: 'investment',
      subject_count: 5,
      avg_score: 0.55,
      max_score: 0.8,
      min_score: 0.3,
      score_stddev: 0.15,
      avg_confidence: 0.82,
      critical_count: 1,
      high_count: 2,
      medium_count: 1,
      low_count: 1,
      latest_assessment: '2024-01-15T00:00:00Z',
      oldest_assessment: '2024-01-01T00:00:00Z',
    };

    it('should return portfolio aggregate for a scope', async () => {
      mockClient.single.mockResolvedValue({
        data: mockAggregateData,
        error: null,
      });

      const payload = createPayload('analytics.portfolio-aggregate', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'portfolio-aggregate',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.subjectCount).toBe(5);
      expect(data.avgScore).toBe(0.55);
      expect(data.criticalCount).toBe(1);
    });

    it('should return default values when no data exists', async () => {
      mockClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const payload = createPayload('analytics.portfolio-aggregate', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'portfolio-aggregate',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.subjectCount).toBe(0);
      expect(data.avgScore).toBe(0);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.portfolio-aggregate', {});
      const result = await handler.execute(
        'portfolio-aggregate',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - risk-distribution', () => {
    const mockDistributionData = [
      { risk_level: 'critical', color: '#DC2626', count: 1, percentage: 20 },
      { risk_level: 'high', color: '#EA580C', count: 2, percentage: 40 },
      { risk_level: 'medium', color: '#F59E0B', count: 1, percentage: 20 },
      { risk_level: 'low', color: '#10B981', count: 1, percentage: 20 },
    ];

    it('should return risk distribution for a scope', async () => {
      mockClient.eq.mockResolvedValue({
        data: mockDistributionData,
        error: null,
      });

      const payload = createPayload('analytics.risk-distribution', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'risk-distribution',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data).toHaveLength(4);
      // Should be sorted by risk level
      expect(data[0].riskLevel).toBe('critical');
      expect(data[3].riskLevel).toBe('low');
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.risk-distribution', {});
      const result = await handler.execute(
        'risk-distribution',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - dimension-contributions', () => {
    const mockContributionData = [
      {
        dimension_id: 'dim-1',
        dimension_slug: 'market-volatility',
        dimension_name: 'Market Volatility',
        dimension_icon: 'chart-line',
        dimension_color: '#EF4444',
        weight: 0.4,
        assessment_count: 10,
        avg_score: 0.65,
        avg_confidence: 0.85,
        max_score: 0.8,
        min_score: 0.5,
        weighted_contribution: 0.26,
      },
    ];

    it('should return dimension contributions for a scope', async () => {
      mockClient.eq.mockResolvedValue({
        data: mockContributionData,
        error: null,
      });

      const payload = createPayload('analytics.dimension-contributions', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'dimension-contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data[0].dimensionSlug).toBe('market-volatility');
      expect(data[0].weightedContribution).toBe(0.26);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.dimension-contributions', {});
      const result = await handler.execute(
        'dimension-contributions',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - correlations', () => {
    const mockCorrelationData = [
      {
        dimension1_id: 'dim-1',
        dimension1_slug: 'market-volatility',
        dimension1_name: 'Market Volatility',
        dimension2_id: 'dim-2',
        dimension2_slug: 'liquidity-risk',
        dimension2_name: 'Liquidity Risk',
        correlation: 0.78,
        sample_size: 10,
      },
    ];

    it('should return correlation matrix for a scope', async () => {
      dimensionRepo.findByScope.mockResolvedValue(
        mockDimensions as unknown as never,
      );
      mockClient.rpc.mockResolvedValue({
        data: mockCorrelationData,
        error: null,
      });

      const payload = createPayload('analytics.correlations', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'correlations',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.dimensions).toHaveLength(2);
      expect(data.correlations).toHaveLength(1);
      expect(data.matrix).toBeDefined();
      // Check matrix is symmetric
      expect(data.matrix[0][1]).toBe(data.matrix[1][0]);
      // Diagonal should be 1
      expect(data.matrix[0][0]).toBe(1);
      expect(data.matrix[1][1]).toBe(1);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.correlations', {});
      const result = await handler.execute(
        'correlations',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - compare-subjects', () => {
    const mockCompositeScores = [
      {
        id: 'cs-1',
        subject_id: 'subject-1',
        overall_score: 0.65,
        dimension_scores: { 'market-volatility': 0.7, 'liquidity-risk': 0.4 },
        confidence: 0.85,
        status: 'active',
        is_test: false,
        created_at: '2024-01-15T00:00:00Z',
      },
      {
        id: 'cs-2',
        subject_id: 'subject-2',
        overall_score: 0.55,
        dimension_scores: { 'market-volatility': 0.5, 'liquidity-risk': 0.6 },
        confidence: 0.82,
        status: 'active',
        is_test: false,
        created_at: '2024-01-15T00:00:00Z',
      },
    ];

    it('should compare multiple subjects', async () => {
      subjectRepo.findById
        .mockResolvedValueOnce(mockSubjects[0] as unknown as never)
        .mockResolvedValueOnce(mockSubjects[1] as unknown as never);
      dimensionRepo.findByScope.mockResolvedValue(
        mockDimensions as unknown as never,
      );
      mockClient.order.mockResolvedValue({
        data: mockCompositeScores,
        error: null,
      });

      const payload = createPayload('analytics.compare-subjects', {
        subjectIds: ['subject-1', 'subject-2'],
      });
      const result = await handler.execute(
        'compare-subjects',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.subjects).toHaveLength(2);
      expect(data.rankings).toHaveLength(2);
      // Subject-2 should rank first (lower score = better for risk)
      expect(data.rankings[0].subjectId).toBe('subject-2');
    });

    it('should return error when fewer than 2 subjects provided', async () => {
      const payload = createPayload('analytics.compare-subjects', {
        subjectIds: ['subject-1'],
      });
      const result = await handler.execute(
        'compare-subjects',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_SUBJECTS');
    });

    it('should return error when more than 6 subjects provided', async () => {
      const payload = createPayload('analytics.compare-subjects', {
        subjectIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
      });
      const result = await handler.execute(
        'compare-subjects',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOO_MANY_SUBJECTS');
    });
  });

  describe('execute - save-comparison', () => {
    it('should save a comparison set', async () => {
      const savedComparison = {
        id: 'comp-1',
        scope_id: 'scope-1',
        name: 'BTC vs ETH',
        subject_ids: ['subject-1', 'subject-2'],
        created_at: '2024-01-15T00:00:00Z',
      };
      mockClient.single.mockResolvedValue({
        data: savedComparison,
        error: null,
      });

      const payload = createPayload('analytics.save-comparison', {
        scopeId: 'scope-1',
        name: 'BTC vs ETH',
        subjectIds: ['subject-1', 'subject-2'],
      });
      const result = await handler.execute(
        'save-comparison',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.name).toBe('BTC vs ETH');
    });

    it('should return error when required params are missing', async () => {
      const payload = createPayload('analytics.save-comparison', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'save-comparison',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('execute - list-comparisons', () => {
    const mockComparisons = [
      {
        id: 'comp-1',
        scope_id: 'scope-1',
        name: 'BTC vs ETH',
        subject_ids: ['subject-1', 'subject-2'],
        created_at: '2024-01-15T00:00:00Z',
      },
      {
        id: 'comp-2',
        scope_id: 'scope-1',
        name: 'Top 3 Assets',
        subject_ids: ['subject-1', 'subject-2', 'subject-3'],
        created_at: '2024-01-14T00:00:00Z',
      },
    ];

    it('should list comparisons for a scope', async () => {
      mockClient.order.mockResolvedValue({
        data: mockComparisons,
        error: null,
      });

      const payload = createPayload('analytics.list-comparisons', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'list-comparisons',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data).toHaveLength(2);
      expect(result.metadata?.count).toBe(2);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('analytics.list-comparisons', {});
      const result = await handler.execute(
        'list-comparisons',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - delete-comparison', () => {
    it('should delete a comparison', async () => {
      mockClient.eq.mockResolvedValue({ error: null });

      const payload = createPayload('analytics.delete-comparison', {
        id: 'comp-1',
      });
      const result = await handler.execute(
        'delete-comparison',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.success).toBe(true);
    });

    it('should return error when id is missing', async () => {
      const payload = createPayload('analytics.delete-comparison', {});
      const result = await handler.execute(
        'delete-comparison',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('analytics.unsupported');
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
