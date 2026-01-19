import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationAnalysisService } from '../correlation-analysis.service';
import { SubjectRepository } from '../../repositories/subject.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { AssessmentRepository } from '../../repositories/assessment.repository';
import { ScopeRepository } from '../../repositories/scope.repository';

describe('CorrelationAnalysisService', () => {
  let service: CorrelationAnalysisService;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
  let scopeRepo: jest.Mocked<ScopeRepository>;

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
      metadata: {},
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
      metadata: {},
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
      metadata: {},
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
      overall_score: 65,
      dimension_scores: { market: 70, fundamental: 60 },
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
      overall_score: 45,
      dimension_scores: { market: 40, fundamental: 50 },
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

  const mockAssessments = {
    'subject-1': [
      {
        id: 'assessment-1-1',
        subject_id: 'subject-1',
        dimension_id: 'dim-market',
        dimension_context_id: null,
        task_id: 'task-1',
        score: 70,
        confidence: 0.8,
        reasoning: 'High volatility',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'assessment-1-2',
        subject_id: 'subject-1',
        dimension_id: 'dim-fundamental',
        dimension_context_id: null,
        task_id: 'task-1',
        score: 60,
        confidence: 0.8,
        reasoning: 'Strong fundamentals',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    'subject-2': [
      {
        id: 'assessment-2-1',
        subject_id: 'subject-2',
        dimension_id: 'dim-market',
        dimension_context_id: null,
        task_id: 'task-2',
        score: 60,
        confidence: 0.75,
        reasoning: 'Moderate volatility',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'assessment-2-2',
        subject_id: 'subject-2',
        dimension_id: 'dim-fundamental',
        dimension_context_id: null,
        task_id: 'task-2',
        score: 50,
        confidence: 0.75,
        reasoning: 'Good fundamentals',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    'subject-3': [
      {
        id: 'assessment-3-1',
        subject_id: 'subject-3',
        dimension_id: 'dim-market',
        dimension_context_id: null,
        task_id: 'task-3',
        score: 40,
        confidence: 0.7,
        reasoning: 'Low volatility',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'assessment-3-2',
        subject_id: 'subject-3',
        dimension_id: 'dim-fundamental',
        dimension_context_id: null,
        task_id: 'task-3',
        score: 50,
        confidence: 0.7,
        reasoning: 'Moderate fundamentals',
        evidence: [],
        signals: [],
        analyst_response: {},
        llm_provider: null,
        llm_model: null,
        is_test: false,
        test_scenario_id: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(async () => {
    const mockSubjectRepo = {
      findById: jest.fn(),
      findByScope: jest.fn(),
    };

    const mockCompositeScoreRepo = {
      findActiveBySubject: jest.fn(),
    };

    const mockAssessmentRepo = {
      findBySubject: jest.fn(),
    };

    const mockScopeRepo = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationAnalysisService,
        { provide: SubjectRepository, useValue: mockSubjectRepo },
        { provide: CompositeScoreRepository, useValue: mockCompositeScoreRepo },
        { provide: AssessmentRepository, useValue: mockAssessmentRepo },
        { provide: ScopeRepository, useValue: mockScopeRepo },
      ],
    }).compile();

    service = module.get<CorrelationAnalysisService>(
      CorrelationAnalysisService,
    );
    subjectRepo = module.get(SubjectRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    assessmentRepo = module.get(AssessmentRepository);
    scopeRepo = module.get(ScopeRepository);
  });

  describe('calculateSubjectCorrelation', () => {
    it('should calculate correlation between two subjects', async () => {
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

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        return mockAssessments[id as keyof typeof mockAssessments] ?? [];
      });

      const result = await service.calculateSubjectCorrelation(
        'subject-1',
        'subject-2',
      );

      expect(result).not.toBeNull();
      expect(result!.subject_a_identifier).toBe('AAPL');
      expect(result!.subject_b_identifier).toBe('MSFT');
      expect(result!.correlation_coefficient).toBeGreaterThanOrEqual(-1);
      expect(result!.correlation_coefficient).toBeLessThanOrEqual(1);
      expect(result!.strength).toBeDefined();
      expect(result!.dimension_correlations).toHaveLength(2);
    });

    it('should return null when subjects have insufficient shared dimensions', async () => {
      subjectRepo.findById.mockImplementation(async (id: string) => {
        return mockSubjects.find((s) => s.id === id) ?? null;
      });

      compositeScoreRepo.findActiveBySubject.mockResolvedValue(null);
      assessmentRepo.findBySubject.mockResolvedValue([]);

      const result = await service.calculateSubjectCorrelation(
        'subject-1',
        'subject-2',
      );

      expect(result).toBeNull();
    });

    it('should return null when subject not found', async () => {
      subjectRepo.findById.mockResolvedValue(null);

      const result = await service.calculateSubjectCorrelation(
        'nonexistent',
        'subject-2',
      );

      expect(result).toBeNull();
    });

    it('should identify strong positive correlation', async () => {
      // Create subjects with similar dimension scores
      const similarAssessments = {
        'subject-1': [
          { ...mockAssessments['subject-1'][0]!, score: 80 },
          { ...mockAssessments['subject-1'][1]!, score: 70 },
        ],
        'subject-2': [
          { ...mockAssessments['subject-2'][0]!, score: 75 },
          { ...mockAssessments['subject-2'][1]!, score: 65 },
        ],
      };

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

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        return similarAssessments[id as keyof typeof similarAssessments] ?? [];
      });

      const result = await service.calculateSubjectCorrelation(
        'subject-1',
        'subject-2',
      );

      expect(result).not.toBeNull();
      expect(result!.correlation_coefficient).toBeGreaterThan(0);
    });
  });

  describe('generateCorrelationMatrix', () => {
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

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        return mockAssessments[id as keyof typeof mockAssessments] ?? [];
      });
    });

    it('should generate correlation matrix for a scope', async () => {
      const result = await service.generateCorrelationMatrix('scope-1');

      expect(result.scope_id).toBe('scope-1');
      expect(result.scope_name).toBe('US Tech Stocks');
      expect(result.subjects).toHaveLength(3);
      expect(result.matrix.length).toBeGreaterThan(0);
      expect(result.average_correlation).toBeDefined();
      expect(result.highest_correlation).toBeDefined();
      expect(result.lowest_correlation).toBeDefined();
    });

    it('should throw error when scope not found', async () => {
      scopeRepo.findById.mockResolvedValue(null);

      await expect(
        service.generateCorrelationMatrix('nonexistent'),
      ).rejects.toThrow('Scope not found');
    });

    it('should filter inactive subjects by default', async () => {
      const subjectsWithInactive = [
        ...mockSubjects,
        {
          ...mockSubjects[0]!,
          id: 'subject-inactive',
          identifier: 'INACTIVE',
          is_active: false,
        },
      ];

      subjectRepo.findByScope.mockResolvedValue(subjectsWithInactive);

      const result = await service.generateCorrelationMatrix('scope-1');

      expect(result.subjects).toHaveLength(3);
      expect(
        result.subjects.find((s) => s.identifier === 'INACTIVE'),
      ).toBeUndefined();
    });

    it('should include inactive subjects when option set', async () => {
      const inactiveSubject = {
        ...mockSubjects[0]!,
        id: 'subject-inactive',
        identifier: 'INACTIVE',
        is_active: false,
      };

      const subjectsWithInactive = [...mockSubjects, inactiveSubject];

      subjectRepo.findByScope.mockResolvedValue(subjectsWithInactive);

      // Add mock data for inactive subject - including findById
      subjectRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'subject-inactive') {
          return inactiveSubject;
        }
        return mockSubjects.find((s) => s.id === id) ?? null;
      });

      compositeScoreRepo.findActiveBySubject.mockImplementation(
        async (id: string) => {
          if (id === 'subject-inactive') {
            return mockCompositeScores['subject-1'];
          }
          return (
            mockCompositeScores[id as keyof typeof mockCompositeScores] ?? null
          );
        },
      );

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        if (id === 'subject-inactive') {
          return mockAssessments['subject-1'];
        }
        return mockAssessments[id as keyof typeof mockAssessments] ?? [];
      });

      const result = await service.generateCorrelationMatrix('scope-1', {
        includeInactiveSubjects: true,
      });

      expect(result.subjects).toHaveLength(4);
    });
  });

  describe('analyzeConcentrationRisk', () => {
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

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        return mockAssessments[id as keyof typeof mockAssessments] ?? [];
      });
    });

    it('should analyze concentration risk for a scope', async () => {
      const result = await service.analyzeConcentrationRisk('scope-1');

      expect(result.scope_id).toBe('scope-1');
      expect(result.total_subjects).toBe(3);
      expect(result.concentration_score).toBeGreaterThanOrEqual(0);
      expect(result.concentration_score).toBeLessThanOrEqual(100);
      expect(['low', 'moderate', 'high', 'critical']).toContain(
        result.risk_level,
      );
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should identify highly correlated pairs', async () => {
      // Create subjects with highly correlated scores
      const highlyCorrelatedAssessments = {
        'subject-1': [
          { ...mockAssessments['subject-1'][0]!, score: 80 },
          { ...mockAssessments['subject-1'][1]!, score: 80 },
        ],
        'subject-2': [
          { ...mockAssessments['subject-2'][0]!, score: 80 },
          { ...mockAssessments['subject-2'][1]!, score: 80 },
        ],
        'subject-3': [
          { ...mockAssessments['subject-3'][0]!, score: 80 },
          { ...mockAssessments['subject-3'][1]!, score: 80 },
        ],
      };

      assessmentRepo.findBySubject.mockImplementation(async (id: string) => {
        return (
          highlyCorrelatedAssessments[
            id as keyof typeof highlyCorrelatedAssessments
          ] ?? []
        );
      });

      const result = await service.analyzeConcentrationRisk('scope-1');

      expect(result.highly_correlated_pairs).toBeDefined();
      expect(result.top_correlated_pairs).toBeDefined();
    });

    it('should provide appropriate recommendations based on risk level', async () => {
      const result = await service.analyzeConcentrationRisk('scope-1');

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.every((r) => typeof r === 'string')).toBe(
        true,
      );
    });
  });
});
