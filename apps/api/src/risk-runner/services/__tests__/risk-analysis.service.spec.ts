import { Test, TestingModule } from '@nestjs/testing';
import { RiskAnalysisService } from '../risk-analysis.service';
import { ScopeRepository } from '../../repositories/scope.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import { DimensionRepository } from '../../repositories/dimension.repository';
import { AssessmentRepository } from '../../repositories/assessment.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import {
  PredictorReaderRepository,
  PredictorForRisk,
} from '../../repositories/predictor-reader.repository';
import { DimensionAnalyzerService } from '../dimension-analyzer.service';
import { ScoreAggregationService } from '../score-aggregation.service';
import { DebateService } from '../debate.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { RiskScope } from '../../interfaces/scope.interface';
import { RiskSubject } from '../../interfaces/subject.interface';
import { RiskDimension } from '../../interfaces/dimension.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';
import {
  RiskAssessment,
  CreateRiskAssessmentData,
} from '../../interfaces/assessment.interface';
import { RiskDebate } from '../../interfaces/debate.interface';

describe('RiskAnalysisService', () => {
  let service: RiskAnalysisService;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let dimensionRepo: jest.Mocked<DimensionRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let predictorReaderRepo: jest.Mocked<PredictorReaderRepository>;
  let dimensionAnalyzer: jest.Mocked<DimensionAnalyzerService>;
  let scoreAggregation: jest.Mocked<ScoreAggregationService>;
  let debateService: jest.Mocked<DebateService>;
  let observabilityEvents: jest.Mocked<ObservabilityEventsService>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: 'risk-runner',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockScope: RiskScope = {
    id: 'scope-1',
    organization_slug: 'test-org',
    agent_slug: 'risk-runner',
    name: 'Test Scope',
    description: 'Test scope description',
    domain: 'investment',
    llm_config: null,
    thresholds: {
      critical_threshold: 0.8,
      warning_threshold: 0.6,
      rapid_change_threshold: 0.15,
      stale_hours: 24,
    },
    analysis_config: {
      riskRadar: { enabled: true },
    },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-1',
    scope_id: 'scope-1',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: { exchange: 'NASDAQ', sector: 'Technology' },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockDimension: RiskDimension = {
    id: 'dimension-1',
    scope_id: 'scope-1',
    name: 'Market Risk',
    slug: 'market-risk',
    description: 'Market-related risks',
    display_name: 'Market Risk',
    icon: 'chart-line',
    color: '#EF4444',
    weight: 0.5,
    display_order: 1,
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-1',
    subject_id: 'subject-1',
    task_id: 'test-task',
    overall_score: 0.65,
    dimension_scores: { 'market-risk': 0.65 },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.8,
    status: 'active',
    valid_until: new Date(Date.now() + 86400000).toISOString(),
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
  };

  // Mock for dimensionAnalyzer.analyzeDimension return type
  const mockAnalyzerOutput: CreateRiskAssessmentData = {
    subject_id: 'subject-1',
    dimension_id: 'dimension-1',
    dimension_context_id: 'context-1',
    task_id: 'test-task',
    score: 0.65,
    confidence: 0.8,
    reasoning: 'Market shows moderate risk',
    evidence: ['Recent volatility increase', 'Sector rotation signals'],
    signals: [
      { name: 'volatility', value: 25, impact: 'negative', weight: 0.3 },
    ],
    analyst_response: { raw_response: 'Analysis complete' },
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4',
    is_test: false,
    test_scenario_id: 'scenario-1',
  };

  // Mock for assessmentRepo.createBatch return type (full RiskAssessment)
  const mockAssessment: RiskAssessment = {
    id: 'assessment-1',
    subject_id: 'subject-1',
    dimension_id: 'dimension-1',
    dimension_context_id: 'context-1',
    task_id: 'test-task',
    score: 0.65,
    confidence: 0.8,
    reasoning: 'Market shows moderate risk',
    evidence: ['Recent volatility increase', 'Sector rotation signals'],
    signals: [
      { name: 'volatility', value: 25, impact: 'negative', weight: 0.3 },
    ],
    analyst_response: { raw_response: 'Analysis complete' },
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
  };

  const mockDebate: RiskDebate = {
    id: 'debate-1',
    subject_id: 'subject-1',
    composite_score_id: 'score-1',
    task_id: 'test-task',
    blue_assessment: {
      summary: 'Risk assessment is accurate',
      key_findings: ['Market conditions warrant caution'],
      evidence_cited: ['Volatility data'],
      confidence_explanation: 'High confidence based on multiple indicators',
    },
    red_challenges: {
      challenges: [
        {
          dimension: 'market-risk',
          challenge: 'Risk may be overestimated',
          evidence: ['Historical recovery patterns'],
          suggested_adjustment: -0.05,
        },
      ],
      blind_spots: ['Regulatory changes'],
      alternative_scenarios: [
        {
          name: 'Bull scenario',
          description: 'Market recovery',
          probability: 0.3,
          impact_on_score: -10,
        },
      ],
      overstated_risks: ['Volatility impact'],
      understated_risks: ['Liquidity risk'],
    },
    arbiter_synthesis: {
      final_assessment: 'Moderate adjustment warranted',
      accepted_challenges: ['Risk may be overestimated'],
      rejected_challenges: [],
      adjustment_reasoning: 'Red team raised valid points',
      confidence_level: 0.75,
      key_takeaways: ['Monitor volatility closely'],
      recommended_adjustment: -5,
    },
    original_score: 0.65,
    final_score: 0.6,
    score_adjustment: -0.05,
    transcript: [],
    status: 'completed',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01',
    completed_at: '2024-01-01',
  };

  const mockPredictors: PredictorForRisk[] = [
    {
      id: 'predictor-1',
      article_id: 'article-1',
      target_id: 'target-1',
      target_symbol: 'AAPL',
      direction: 'bullish',
      strength: 0.7,
      confidence: 0.8,
      reasoning: 'Positive earnings expected',
      analyst_slug: 'market-analyst',
      analyst_assessment: {
        direction: 'bullish',
        confidence: 0.8,
        reasoning: 'Strong fundamentals',
        key_factors: ['Revenue growth', 'Market expansion'],
        risks: ['Competition', 'Regulatory'],
      },
      created_at: new Date().toISOString(),
      article_title: 'Apple Reports Strong Quarter',
      article_url: 'https://example.com/article',
    },
  ];

  beforeEach(async () => {
    // Store original env value
    const originalEnv = process.env.RISK_RADAR_ENABLED;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAnalysisService,
        {
          provide: ScopeRepository,
          useValue: {
            findByAgentSlug: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findByScope: jest.fn(),
          },
        },
        {
          provide: DimensionRepository,
          useValue: {
            findByScope: jest.fn(),
          },
        },
        {
          provide: AssessmentRepository,
          useValue: {
            createBatch: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            create: jest.fn(),
            findActiveBySubject: jest.fn(),
            supersedeForSubject: jest.fn(),
          },
        },
        {
          provide: PredictorReaderRepository,
          useValue: {
            findPredictorsBySymbol: jest.fn(),
          },
        },
        {
          provide: DimensionAnalyzerService,
          useValue: {
            analyzeDimension: jest.fn(),
          },
        },
        {
          provide: ScoreAggregationService,
          useValue: {
            aggregateAssessments: jest.fn(),
            calculateValidUntil: jest.fn(),
          },
        },
        {
          provide: DebateService,
          useValue: {
            shouldTriggerDebate: jest.fn(),
            runDebate: jest.fn(),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<RiskAnalysisService>(RiskAnalysisService);
    scopeRepo = module.get(ScopeRepository);
    subjectRepo = module.get(SubjectRepository);
    dimensionRepo = module.get(DimensionRepository);
    assessmentRepo = module.get(AssessmentRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    predictorReaderRepo = module.get(PredictorReaderRepository);
    dimensionAnalyzer = module.get(DimensionAnalyzerService);
    scoreAggregation = module.get(ScoreAggregationService);
    debateService = module.get(DebateService);
    observabilityEvents = module.get(ObservabilityEventsService);

    // Restore env
    process.env.RISK_RADAR_ENABLED = originalEnv;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeSubject', () => {
    beforeEach(() => {
      // Setup default mocks for successful analysis
      predictorReaderRepo.findPredictorsBySymbol.mockResolvedValue(
        mockPredictors,
      );
      dimensionRepo.findByScope.mockResolvedValue([mockDimension]);
      dimensionAnalyzer.analyzeDimension.mockResolvedValue(mockAnalyzerOutput);
      assessmentRepo.createBatch.mockResolvedValue([mockAssessment]);
      scoreAggregation.aggregateAssessments.mockReturnValue({
        overallScore: 0.65,
        dimensionScores: { 'market-risk': 0.65 },
        confidence: 0.8,
      });
      scoreAggregation.calculateValidUntil.mockReturnValue(
        new Date(Date.now() + 86400000),
      );
      compositeScoreRepo.supersedeForSubject.mockResolvedValue(1);
      compositeScoreRepo.create.mockResolvedValue(mockCompositeScore);
      debateService.shouldTriggerDebate.mockReturnValue(false);
    });

    it('should complete risk analysis successfully', async () => {
      const result = await service.analyzeSubject(
        mockSubject,
        mockScope,
        mockContext,
      );

      expect(result.subject).toEqual(mockSubject);
      expect(result.compositeScore).toEqual(mockCompositeScore);
      expect(result.assessmentCount).toBe(1);
      expect(result.debateTriggered).toBe(false);
      expect(dimensionRepo.findByScope).toHaveBeenCalledWith('scope-1');
      expect(dimensionAnalyzer.analyzeDimension).toHaveBeenCalled();
      expect(assessmentRepo.createBatch).toHaveBeenCalled();
      expect(compositeScoreRepo.create).toHaveBeenCalled();
    });

    it('should throw error when Risk Radar is disabled', async () => {
      const disabledScope: RiskScope = {
        ...mockScope,
        analysis_config: { riskRadar: { enabled: false } },
      };

      await expect(
        service.analyzeSubject(mockSubject, disabledScope, mockContext),
      ).rejects.toThrow('Risk Radar is not enabled');
    });

    it('should allow analysis when RISK_RADAR_ENABLED env var is true', async () => {
      process.env.RISK_RADAR_ENABLED = 'true';
      const disabledScope: RiskScope = {
        ...mockScope,
        analysis_config: { riskRadar: { enabled: false } },
      };

      const result = await service.analyzeSubject(
        mockSubject,
        disabledScope,
        mockContext,
      );

      expect(result.subject).toEqual(mockSubject);
    });

    it('should throw error when no dimensions are configured', async () => {
      dimensionRepo.findByScope.mockResolvedValue([]);

      await expect(
        service.analyzeSubject(mockSubject, mockScope, mockContext),
      ).rejects.toThrow('No dimensions configured');
    });

    it('should throw error when all dimension analyses fail', async () => {
      dimensionAnalyzer.analyzeDimension.mockRejectedValue(
        new Error('Analysis failed'),
      );

      await expect(
        service.analyzeSubject(mockSubject, mockScope, mockContext),
      ).rejects.toThrow('All dimension analyses failed');
    });

    it('should continue with successful assessments when some fail', async () => {
      const secondDimension: RiskDimension = {
        ...mockDimension,
        id: 'dimension-2',
        slug: 'credit-risk',
      };
      dimensionRepo.findByScope.mockResolvedValue([
        mockDimension,
        secondDimension,
      ]);
      dimensionAnalyzer.analyzeDimension
        .mockResolvedValueOnce(mockAnalyzerOutput)
        .mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await service.analyzeSubject(
        mockSubject,
        mockScope,
        mockContext,
      );

      expect(result.assessmentCount).toBe(1);
    });

    it('should trigger debate when conditions are met', async () => {
      debateService.shouldTriggerDebate.mockReturnValue(true);
      debateService.runDebate.mockResolvedValue({
        debate: mockDebate,
        adjustedScore: 0.6,
        adjustment: -0.05,
      });

      const result = await service.analyzeSubject(
        mockSubject,
        mockScope,
        mockContext,
      );

      expect(result.debateTriggered).toBe(true);
      expect(result.debate).toBeDefined();
      expect(debateService.runDebate).toHaveBeenCalled();
    });

    it('should continue without debate when debate fails', async () => {
      debateService.shouldTriggerDebate.mockReturnValue(true);
      debateService.runDebate.mockRejectedValue(new Error('Debate failed'));

      const result = await service.analyzeSubject(
        mockSubject,
        mockScope,
        mockContext,
      );

      expect(result.debateTriggered).toBe(false);
      expect(result.debate).toBeUndefined();
    });

    it('should emit progress events', async () => {
      await service.analyzeSubject(mockSubject, mockScope, mockContext);

      expect(observabilityEvents.push).toHaveBeenCalled();
      const calls = observabilityEvents.push.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0]![0]).toMatchObject({
        source_app: 'risk-analysis',
        hook_event_type: 'risk.analysis.progress',
      });
    });

    it('should use default stale_hours when not specified in scope', async () => {
      const scopeWithoutStaleHours: RiskScope = {
        ...mockScope,
        thresholds: null,
      };

      await service.analyzeSubject(
        mockSubject,
        scopeWithoutStaleHours,
        mockContext,
      );

      expect(scoreAggregation.calculateValidUntil).toHaveBeenCalledWith(
        expect.any(Date),
        24, // Default stale_hours
      );
    });
  });

  describe('analyzeScope', () => {
    beforeEach(() => {
      predictorReaderRepo.findPredictorsBySymbol.mockResolvedValue(
        mockPredictors,
      );
      dimensionRepo.findByScope.mockResolvedValue([mockDimension]);
      dimensionAnalyzer.analyzeDimension.mockResolvedValue(mockAnalyzerOutput);
      assessmentRepo.createBatch.mockResolvedValue([mockAssessment]);
      scoreAggregation.aggregateAssessments.mockReturnValue({
        overallScore: 0.65,
        dimensionScores: { 'market-risk': 0.65 },
        confidence: 0.8,
      });
      scoreAggregation.calculateValidUntil.mockReturnValue(
        new Date(Date.now() + 86400000),
      );
      compositeScoreRepo.supersedeForSubject.mockResolvedValue(1);
      compositeScoreRepo.create.mockResolvedValue(mockCompositeScore);
      debateService.shouldTriggerDebate.mockReturnValue(false);
    });

    it('should analyze all subjects in scope', async () => {
      const subjects: RiskSubject[] = [
        mockSubject,
        { ...mockSubject, id: 'subject-2', identifier: 'GOOGL' },
      ];
      subjectRepo.findByScope.mockResolvedValue(subjects);

      const results = await service.analyzeScope(mockScope, mockContext);

      expect(results).toHaveLength(2);
      expect(subjectRepo.findByScope).toHaveBeenCalledWith('scope-1');
    });

    it('should continue analyzing other subjects when one fails', async () => {
      const subjects: RiskSubject[] = [
        mockSubject,
        { ...mockSubject, id: 'subject-2', identifier: 'GOOGL' },
      ];
      subjectRepo.findByScope.mockResolvedValue(subjects);

      // First subject has no predictors (fails early with no-data), second succeeds
      predictorReaderRepo.findPredictorsBySymbol
        .mockResolvedValueOnce([]) // No predictors for AAPL
        .mockResolvedValueOnce(mockPredictors); // Predictors for GOOGL

      const results = await service.analyzeScope(mockScope, mockContext);

      // Both subjects should return results (first with noDataAvailable, second with analysis)
      expect(results).toHaveLength(2);
      expect(results[0]!.noDataAvailable).toBe(true);
      expect(results[1]!.noDataAvailable).toBeUndefined();
    });

    it('should return empty array when no subjects in scope', async () => {
      subjectRepo.findByScope.mockResolvedValue([]);

      const results = await service.analyzeScope(mockScope, mockContext);

      expect(results).toHaveLength(0);
    });
  });

  describe('getCurrentScore', () => {
    it('should return active score for subject', async () => {
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );

      const result = await service.getCurrentScore('subject-1');

      expect(result).toEqual(mockCompositeScore);
      expect(compositeScoreRepo.findActiveBySubject).toHaveBeenCalledWith(
        'subject-1',
      );
    });

    it('should return null when no active score exists', async () => {
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(null);

      const result = await service.getCurrentScore('subject-1');

      expect(result).toBeNull();
    });
  });

  describe('isScoreStale', () => {
    it('should return true when no score exists', async () => {
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(null);

      const result = await service.isScoreStale('subject-1');

      expect(result).toBe(true);
    });

    it('should return true when score is past valid_until', async () => {
      const staleScore: RiskCompositeScore = {
        ...mockCompositeScore,
        valid_until: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(staleScore);

      const result = await service.isScoreStale('subject-1');

      expect(result).toBe(true);
    });

    it('should return false when score is still valid', async () => {
      const validScore: RiskCompositeScore = {
        ...mockCompositeScore,
        valid_until: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      };
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(validScore);

      const result = await service.isScoreStale('subject-1');

      expect(result).toBe(false);
    });

    it('should return false when valid_until is not set', async () => {
      const scoreWithoutValidity: RiskCompositeScore = {
        ...mockCompositeScore,
        valid_until: null,
      };
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        scoreWithoutValidity,
      );

      const result = await service.isScoreStale('subject-1');

      expect(result).toBe(false);
    });
  });

  describe('getScopesForAgent', () => {
    it('should return scopes for an agent', async () => {
      scopeRepo.findByAgentSlug.mockResolvedValue([mockScope]);

      const result = await service.getScopesForAgent('risk-runner', 'test-org');

      expect(result).toEqual([mockScope]);
      expect(scopeRepo.findByAgentSlug).toHaveBeenCalledWith(
        'risk-runner',
        'test-org',
      );
    });

    it('should return empty array when no scopes found', async () => {
      scopeRepo.findByAgentSlug.mockResolvedValue([]);

      const result = await service.getScopesForAgent(
        'unknown-agent',
        'test-org',
      );

      expect(result).toEqual([]);
    });
  });
});
