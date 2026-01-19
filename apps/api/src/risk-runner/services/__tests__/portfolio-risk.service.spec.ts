import { Test, TestingModule } from '@nestjs/testing';
import { PortfolioRiskService } from '../portfolio-risk.service';
import { SubjectRepository } from '../../repositories/subject.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { AssessmentRepository } from '../../repositories/assessment.repository';
import { AlertRepository } from '../../repositories/alert.repository';
import { ScopeRepository } from '../../repositories/scope.repository';
import { DimensionRepository } from '../../repositories/dimension.repository';
import { CorrelationAnalysisService } from '../correlation-analysis.service';

describe('PortfolioRiskService', () => {
  let service: PortfolioRiskService;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let alertRepo: jest.Mocked<AlertRepository>;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let dimensionRepo: jest.Mocked<DimensionRepository>;
  let correlationService: jest.Mocked<CorrelationAnalysisService>;

  const mockScope = {
    id: 'scope-1',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'US Tech Stocks',
    description: null,
    domain: 'investment' as const,
    llm_config: {},
    thresholds: {},
    analysis_config: { riskRadar: { enabled: true } },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSubjects = [
    {
      id: 'subject-1',
      scope_id: 'scope-1',
      identifier: 'AAPL',
      name: 'Apple Inc.',
      subject_type: 'stock' as const,
      metadata: { weight: 0.5 },
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'subject-2',
      scope_id: 'scope-1',
      identifier: 'MSFT',
      name: 'Microsoft Corp.',
      subject_type: 'stock' as const,
      metadata: { weight: 0.3 },
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'subject-3',
      scope_id: 'scope-1',
      identifier: 'GOOGL',
      name: 'Alphabet Inc.',
      subject_type: 'stock' as const,
      metadata: { weight: 0.2 },
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockDimensions = [
    {
      id: 'dim-1',
      scope_id: 'scope-1',
      slug: 'market',
      name: 'Market Risk',
      display_name: 'Market Risk',
      description: null,
      icon: 'chart-line',
      color: '#EF4444',
      weight: 1.0,
      display_order: 1,
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'dim-2',
      scope_id: 'scope-1',
      slug: 'fundamental',
      name: 'Fundamental Risk',
      display_name: 'Fundamental Risk',
      description: null,
      icon: 'building',
      color: '#3B82F6',
      weight: 1.0,
      display_order: 2,
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const mockCompositeScores = {
    'subject-1': {
      id: 'score-1',
      subject_id: 'subject-1',
      task_id: 'task-1',
      overall_score: 75,
      dimension_scores: { market: 80, fundamental: 70 },
      debate_id: null,
      debate_adjustment: 0,
      pre_debate_score: null,
      confidence: 0.8,
      status: 'active' as const,
      valid_until: null,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    'subject-2': {
      id: 'score-2',
      subject_id: 'subject-2',
      task_id: 'task-2',
      overall_score: 55,
      dimension_scores: { market: 60, fundamental: 50 },
      debate_id: null,
      debate_adjustment: 0,
      pre_debate_score: null,
      confidence: 0.75,
      status: 'active' as const,
      valid_until: null,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    'subject-3': {
      id: 'score-3',
      subject_id: 'subject-3',
      task_id: 'task-3',
      overall_score: 35,
      dimension_scores: { market: 40, fundamental: 30 },
      debate_id: null,
      debate_adjustment: 0,
      pre_debate_score: null,
      confidence: 0.7,
      status: 'active' as const,
      valid_until: null,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  };

  const mockAlerts = [
    {
      id: 'alert-1',
      subject_id: 'subject-1',
      composite_score_id: 'score-1',
      alert_type: 'threshold_breach' as const,
      severity: 'warning' as const,
      title: 'High risk',
      message: 'Score exceeded threshold',
      details: {},
      acknowledged_at: null,
      acknowledged_by: null,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-15T00:00:00Z',
    },
    {
      id: 'alert-2',
      subject_id: 'subject-1',
      composite_score_id: 'score-1',
      alert_type: 'rapid_change' as const,
      severity: 'critical' as const,
      title: 'Rapid change',
      message: 'Score changed rapidly',
      details: {},
      acknowledged_at: '2024-01-14T00:00:00Z',
      acknowledged_by: 'user-1',
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-14T00:00:00Z',
    },
  ];

  const mockConcentrationRisk = {
    scope_id: 'scope-1',
    total_subjects: 3,
    highly_correlated_pairs: 1,
    concentration_score: 35,
    risk_level: 'moderate' as const,
    recommendations: ['Consider diversifying'],
    top_correlated_pairs: [],
    calculated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const mockSubjectRepo = {
      findById: jest.fn(),
      findByScope: jest.fn(),
    };

    const mockCompositeScoreRepo = {
      findActiveBySubject: jest.fn(),
      findHistory: jest.fn(),
    };

    const mockAssessmentRepo = {
      findBySubject: jest.fn(),
    };

    const mockAlertRepo = {
      findByScope: jest.fn(),
      findBySubject: jest.fn(),
    };

    const mockScopeRepo = {
      findById: jest.fn(),
    };

    const mockDimensionRepo = {
      findByScope: jest.fn(),
    };

    const mockCorrelationService = {
      analyzeConcentrationRisk: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioRiskService,
        { provide: SubjectRepository, useValue: mockSubjectRepo },
        { provide: CompositeScoreRepository, useValue: mockCompositeScoreRepo },
        { provide: AssessmentRepository, useValue: mockAssessmentRepo },
        { provide: AlertRepository, useValue: mockAlertRepo },
        { provide: ScopeRepository, useValue: mockScopeRepo },
        { provide: DimensionRepository, useValue: mockDimensionRepo },
        {
          provide: CorrelationAnalysisService,
          useValue: mockCorrelationService,
        },
      ],
    }).compile();

    service = module.get<PortfolioRiskService>(PortfolioRiskService);
    subjectRepo = module.get(SubjectRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    alertRepo = module.get(AlertRepository);
    scopeRepo = module.get(ScopeRepository);
    dimensionRepo = module.get(DimensionRepository);
    correlationService = module.get(CorrelationAnalysisService);
  });

  describe('getPortfolioSummary', () => {
    beforeEach(() => {
      scopeRepo.findById.mockResolvedValue(mockScope);
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      subjectRepo.findById.mockImplementation(async (id: string) => {
        return mockSubjects.find((s) => s.id === id) ?? null;
      });
      compositeScoreRepo.findActiveBySubject.mockImplementation(
        async (id: string) => {
          return (
            mockCompositeScores[id as keyof typeof mockCompositeScores] ?? null
          );
        },
      );
      dimensionRepo.findByScope.mockResolvedValue(mockDimensions);
      alertRepo.findByScope.mockResolvedValue(mockAlerts);
      correlationService.analyzeConcentrationRisk.mockResolvedValue(
        mockConcentrationRisk,
      );
    });

    it('should generate portfolio summary', async () => {
      const result = await service.getPortfolioSummary('scope-1');

      expect(result.scope_id).toBe('scope-1');
      expect(result.scope_name).toBe('US Tech Stocks');
      expect(result.total_subjects).toBe(3);
      expect(result.assessed_subjects).toBe(3);
      expect(result.average_risk_score).toBeDefined();
      expect(result.max_risk_score).toBe(75);
      expect(result.min_risk_score).toBe(35);
    });

    it('should throw error when scope not found', async () => {
      scopeRepo.findById.mockResolvedValue(null);

      await expect(service.getPortfolioSummary('nonexistent')).rejects.toThrow(
        'Scope not found',
      );
    });

    it('should calculate correct risk distribution', async () => {
      const result = await service.getPortfolioSummary('scope-1');

      expect(result.risk_distribution).toBeDefined();
      expect(result.risk_distribution.low).toBeDefined();
      expect(result.risk_distribution.moderate).toBeDefined();
      expect(result.risk_distribution.elevated).toBeDefined();
      expect(result.risk_distribution.high).toBeDefined();
      expect(result.risk_distribution.critical).toBeDefined();
    });

    it('should include dimension breakdown', async () => {
      const result = await service.getPortfolioSummary('scope-1');

      expect(result.dimension_breakdown).toBeDefined();
      expect(result.dimension_breakdown.length).toBeGreaterThan(0);
      expect(result.dimension_breakdown[0]!.dimension_slug).toBeDefined();
      expect(result.dimension_breakdown[0]!.average_score).toBeDefined();
    });

    it('should include alerts summary', async () => {
      const result = await service.getPortfolioSummary('scope-1');

      expect(result.alerts_summary).toBeDefined();
      expect(result.alerts_summary.total).toBe(2);
      expect(result.alerts_summary.unacknowledged).toBe(1);
      expect(result.alerts_summary.by_severity.warning).toBe(1);
      expect(result.alerts_summary.by_severity.critical).toBe(1);
    });

    it('should include concentration risk summary', async () => {
      const result = await service.getPortfolioSummary('scope-1');

      expect(result.concentration_risk).toBeDefined();
      expect(result.concentration_risk.concentration_score).toBe(35);
      expect(result.concentration_risk.risk_level).toBe('moderate');
    });
  });

  describe('getSubjectContributions', () => {
    beforeEach(() => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      compositeScoreRepo.findActiveBySubject.mockImplementation(
        async (id: string) => {
          return (
            mockCompositeScores[id as keyof typeof mockCompositeScores] ?? null
          );
        },
      );
      alertRepo.findBySubject.mockResolvedValue([]);
    });

    it('should get subject contributions', async () => {
      const result = await service.getSubjectContributions('scope-1');

      expect(result).toHaveLength(3);
      expect(result[0]!.identifier).toBeDefined();
      expect(result[0]!.risk_score).toBeDefined();
      expect(result[0]!.weight).toBeDefined();
      expect(result[0]!.weighted_contribution).toBeDefined();
      expect(result[0]!.percentage_of_total).toBeDefined();
    });

    it('should sort by weighted contribution (highest first)', async () => {
      const result = await service.getSubjectContributions('scope-1');

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i]!.weighted_contribution).toBeGreaterThanOrEqual(
          result[i + 1]!.weighted_contribution,
        );
      }
    });

    it('should identify high risk subjects', async () => {
      const result = await service.getSubjectContributions('scope-1');

      const highRiskSubject = result.find((c) => c.identifier === 'AAPL');
      expect(highRiskSubject!.is_high_risk).toBe(true);

      const lowRiskSubject = result.find((c) => c.identifier === 'GOOGL');
      expect(lowRiskSubject!.is_high_risk).toBe(false);
    });

    it('should calculate percentage of total correctly', async () => {
      const result = await service.getSubjectContributions('scope-1');

      const totalPercentage = result.reduce(
        (sum, c) => sum + c.percentage_of_total,
        0,
      );
      expect(totalPercentage).toBeGreaterThanOrEqual(99);
      expect(totalPercentage).toBeLessThanOrEqual(101);
    });
  });

  describe('getPortfolioHeatmap', () => {
    beforeEach(() => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      dimensionRepo.findByScope.mockResolvedValue(mockDimensions);
      compositeScoreRepo.findActiveBySubject.mockImplementation(
        async (id: string) => {
          return (
            mockCompositeScores[id as keyof typeof mockCompositeScores] ?? null
          );
        },
      );
    });

    it('should generate portfolio heatmap', async () => {
      const result = await service.getPortfolioHeatmap('scope-1');

      expect(result.scope_id).toBe('scope-1');
      expect(result.subjects).toHaveLength(3);
      expect(result.dimensions).toHaveLength(2);
      expect(result.cells.length).toBeGreaterThan(0);
    });

    it('should include subjects with overall scores', async () => {
      const result = await service.getPortfolioHeatmap('scope-1');

      expect(result.subjects[0]!.identifier).toBeDefined();
      expect(result.subjects[0]!.overall_score).toBeDefined();
    });

    it('should have cells for each subject-dimension pair', async () => {
      const result = await service.getPortfolioHeatmap('scope-1');

      const expectedCells = result.subjects.length * result.dimensions.length;
      expect(result.cells).toHaveLength(expectedCells);
    });

    it('should include relative scores in cells', async () => {
      const result = await service.getPortfolioHeatmap('scope-1');

      expect(result.cells[0]!.relative_score).toBeDefined();
      expect(['low', 'average', 'high']).toContain(
        result.cells[0]!.relative_score,
      );
    });
  });

  describe('getPortfolioTrend', () => {
    beforeEach(() => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      compositeScoreRepo.findHistory.mockResolvedValue([
        mockCompositeScores['subject-1'],
      ]);
    });

    it('should generate portfolio trend for week', async () => {
      const result = await service.getPortfolioTrend('scope-1', 'week');

      expect(result.scope_id).toBe('scope-1');
      expect(result.period).toBe('week');
      expect(result.data_points).toBeDefined();
      expect(result.data_points.length).toBeGreaterThan(0);
      expect(result.trend_direction).toBeDefined();
      expect(['improving', 'stable', 'worsening']).toContain(
        result.trend_direction,
      );
    });

    it('should support day period', async () => {
      const result = await service.getPortfolioTrend('scope-1', 'day');

      expect(result.period).toBe('day');
    });

    it('should support month period', async () => {
      const result = await service.getPortfolioTrend('scope-1', 'month');

      expect(result.period).toBe('month');
    });

    it('should include change percentage', async () => {
      const result = await service.getPortfolioTrend('scope-1');

      expect(result.change_percentage).toBeDefined();
      expect(typeof result.change_percentage).toBe('number');
    });

    it('should include data points with required fields', async () => {
      const result = await service.getPortfolioTrend('scope-1');

      const point = result.data_points[0];
      expect(point).toBeDefined();
      expect(point!.date).toBeDefined();
      expect(point!.average_risk_score).toBeDefined();
      expect(point!.subjects_assessed).toBeDefined();
      expect(point!.high_risk_subjects).toBeDefined();
    });
  });
});
