/**
 * E2E Tests for Risk Dashboard Flow
 *
 * Tests the complete flow from the PRD:
 * 1. Create scope via dashboard
 * 2. Add subject to scope
 * 3. Run assessment (mock LLM)
 * 4. View composite scores
 * 5. View alerts
 * 6. Acknowledge alerts
 * 7. View learnings
 *
 * Uses mocked services to simulate the full flow without real LLM calls
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RiskDashboardRouter } from '../task-router/risk-dashboard.router';
import { ScopeHandler } from '../task-router/handlers/scope.handler';
import { SubjectHandler } from '../task-router/handlers/subject.handler';
import { AssessmentHandler } from '../task-router/handlers/assessment.handler';
import { CompositeScoreHandler } from '../task-router/handlers/composite-score.handler';
import { AlertHandler } from '../task-router/handlers/alert.handler';
import { DebateHandler } from '../task-router/handlers/debate.handler';
import { LearningQueueHandler } from '../task-router/handlers/learning-queue.handler';
import { EvaluationHandler } from '../task-router/handlers/evaluation.handler';
import { CorrelationHandler } from '../task-router/handlers/correlation.handler';
import { PortfolioHandler } from '../task-router/handlers/portfolio.handler';
import { ScopeRepository } from '../repositories/scope.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { DimensionRepository } from '../repositories/dimension.repository';
import { DimensionContextRepository } from '../repositories/dimension-context.repository';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { CompositeScoreRepository } from '../repositories/composite-score.repository';
import { AlertRepository } from '../repositories/alert.repository';
import { DebateRepository } from '../repositories/debate.repository';
import { LearningRepository } from '../repositories/learning.repository';
import { EvaluationRepository } from '../repositories/evaluation.repository';
import { RiskAnalysisService } from '../services/risk-analysis.service';
import { RiskAlertService } from '../services/risk-alert.service';
import { RiskLearningService } from '../services/risk-learning.service';
import { RiskEvaluationService } from '../services/risk-evaluation.service';
import { DebateService } from '../services/debate.service';
import { CorrelationAnalysisService } from '../services/correlation-analysis.service';
import { PortfolioRiskService } from '../services/portfolio-risk.service';
import { HistoricalReplayService } from '../services/historical-replay.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { LLMService } from '@/llms/llm.service';
import { ExecutionContext, NIL_UUID } from '@orchestrator-ai/transport-types';
import { RiskScope } from '../interfaces/scope.interface';
import { RiskSubject } from '../interfaces/subject.interface';
import { RiskCompositeScore } from '../interfaces/composite-score.interface';
import { UnacknowledgedAlertView } from '../interfaces/alert.interface';

describe('Risk Dashboard E2E Flow', () => {
  let dashboardRouter: RiskDashboardRouter;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let alertRepo: jest.Mocked<AlertRepository>;

  // Test data
  const testContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'test-user-id',
    conversationId: NIL_UUID,
    taskId: 'test-task-id',
    planId: NIL_UUID,
    deliverableId: NIL_UUID,
    agentSlug: 'investment-risk-agent',
    agentType: 'risk',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockScope: RiskScope = {
    id: 'scope-e2e-test',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'E2E Test Scope',
    description: 'Scope for E2E testing',
    domain: 'investment',
    llm_config: {
      gold: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    },
    thresholds: {
      critical_threshold: 80,
      warning_threshold: 60,
      rapid_change_threshold: 15,
      stale_hours: 24,
    },
    analysis_config: {
      riskRadar: { enabled: true },
      redTeam: { enabled: true, threshold: 50, lowConfidenceThreshold: 0.5 },
    },
    is_active: true,
    is_test: true,
    test_scenario_id: 'e2e-test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockSubject: RiskSubject = {
    id: 'subject-e2e-test',
    scope_id: 'scope-e2e-test',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: { sector: 'Technology', industry: 'Consumer Electronics' },
    is_active: true,
    is_test: true,
    test_scenario_id: 'e2e-test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-e2e-test',
    subject_id: 'subject-e2e-test',
    task_id: 'task-e2e-test',
    overall_score: 65,
    confidence: 0.85,
    dimension_scores: {
      'market-risk': 70,
      'credit-risk': 55,
      'liquidity-risk': 60,
      'operational-risk': 65,
      'regulatory-risk': 70,
      'concentration-risk': 75,
    },
    pre_debate_score: 63,
    debate_id: 'debate-e2e-test',
    debate_adjustment: 2,
    status: 'active',
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_test: true,
    test_scenario_id: 'e2e-test',
    created_at: new Date().toISOString(),
  };

  const mockAlert: UnacknowledgedAlertView = {
    id: 'alert-e2e-test',
    subject_id: 'subject-e2e-test',
    composite_score_id: 'score-e2e-test',
    alert_type: 'threshold_breach',
    severity: 'warning',
    title: 'Elevated Risk Warning',
    message: 'Risk score 65 approaching threshold 70',
    details: { threshold: 70, actual_score: 65 },
    acknowledged_at: null,
    acknowledged_by: null,
    is_test: true,
    test_scenario_id: 'e2e-test',
    created_at: new Date().toISOString(),
    // View fields
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'E2E Test Scope',
  };

  // Create mock Supabase client
  const createMockClient = () => {
    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        then: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    // Create mock repositories with jest.Mocked types
    scopeRepo = {
      findAll: jest.fn(),
      findAllActive: jest.fn(),
      findById: jest.fn(),
      findByIdOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ScopeRepository>;

    subjectRepo = {
      findByScope: jest.fn(),
      findById: jest.fn(),
      findByIdOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<SubjectRepository>;

    compositeScoreRepo = {
      findActiveBySubject: jest.fn(),
      findById: jest.fn(),
      findHistory: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<CompositeScoreRepository>;

    alertRepo = {
      findUnacknowledged: jest.fn(),
      findByScope: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      acknowledge: jest.fn(),
    } as unknown as jest.Mocked<AlertRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskDashboardRouter,
        ScopeHandler,
        SubjectHandler,
        AssessmentHandler,
        CompositeScoreHandler,
        AlertHandler,
        DebateHandler,
        LearningQueueHandler,
        EvaluationHandler,
        CorrelationHandler,
        PortfolioHandler,
        { provide: ScopeRepository, useValue: scopeRepo },
        { provide: SubjectRepository, useValue: subjectRepo },
        { provide: CompositeScoreRepository, useValue: compositeScoreRepo },
        { provide: AlertRepository, useValue: alertRepo },
        {
          provide: DimensionRepository,
          useValue: {
            findByScope: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
          },
        },
        {
          provide: DimensionContextRepository,
          useValue: {
            findActiveForDimension: jest.fn(),
          },
        },
        {
          provide: AssessmentRepository,
          useValue: {
            findBySubjectAndTask: jest.fn().mockResolvedValue([]),
            findBySubject: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DebateRepository,
          useValue: {
            findBySubject: jest.fn().mockResolvedValue([]),
            findLatestBySubject: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LearningRepository,
          useValue: {
            findPendingQueue: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
          },
        },
        {
          provide: EvaluationRepository,
          useValue: {
            findBySubject: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RiskAnalysisService,
          useValue: {
            analyzeSubject: jest.fn().mockResolvedValue({
              subject: mockSubject,
              compositeScore: mockCompositeScore,
              assessmentCount: 6,
              debateTriggered: true,
            }),
          },
        },
        {
          provide: RiskAlertService,
          useValue: {
            checkSubjectForAlerts: jest.fn().mockResolvedValue({
              subjectId: mockSubject.id,
              subjectIdentifier: mockSubject.identifier,
              alertsGenerated: [mockAlert],
              checksPerformed: ['threshold_breach', 'rapid_change'],
            }),
            getUnacknowledgedAlerts: jest.fn().mockResolvedValue([mockAlert]),
            getAlertsBySubject: jest.fn().mockResolvedValue([mockAlert]),
            getAlertById: jest.fn().mockResolvedValue(mockAlert),
            getUnacknowledgedBySubject: jest
              .fn()
              .mockResolvedValue([mockAlert]),
            acknowledgeAlert: jest.fn().mockResolvedValue({
              ...mockAlert,
              acknowledged_at: new Date().toISOString(),
              acknowledged_by: 'test-user-id',
            }),
            countUnacknowledgedBySeverity: jest.fn().mockResolvedValue({
              critical: 0,
              warning: 1,
              info: 0,
            }),
          },
        },
        {
          provide: RiskLearningService,
          useValue: {
            processQueueItem: jest.fn(),
          },
        },
        {
          provide: RiskEvaluationService,
          useValue: {
            evaluateScore: jest.fn(),
          },
        },
        {
          provide: DebateService,
          useValue: {
            runDebate: jest.fn(),
          },
        },
        {
          provide: CorrelationAnalysisService,
          useValue: {
            calculatePairCorrelation: jest.fn(),
            analyzeConcentrationRisk: jest.fn(),
          },
        },
        {
          provide: PortfolioRiskService,
          useValue: {
            analyzePortfolio: jest.fn(),
          },
        },
        {
          provide: HistoricalReplayService,
          useValue: {
            replayLearning: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockClient),
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue({
              content: JSON.stringify({
                score: 65,
                confidence: 0.85,
                reasoning: 'Test',
              }),
            }),
          },
        },
      ],
    }).compile();

    dashboardRouter = module.get<RiskDashboardRouter>(RiskDashboardRouter);
  });

  describe('Flow 1: Create Scope', () => {
    it('should create a new scope via dashboard action', async () => {
      scopeRepo.create.mockResolvedValue(mockScope);

      const payload = {
        action: 'scopes.create',
        params: {
          name: 'E2E Test Scope',
          domain: 'investment',
          description: 'Scope for E2E testing',
          llmConfig: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          },
          thresholdConfig: { alertThreshold: 0.8, debateThreshold: 0.7 },
          analysisConfig: {
            riskRadar: { enabled: true },
            debate: { enabled: true },
          },
        },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(scopeRepo.create).toHaveBeenCalled();
    });

    it('should list scopes via dashboard action', async () => {
      scopeRepo.findAll.mockResolvedValue([mockScope]);

      const payload = {
        action: 'scopes.list',
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(scopeRepo.findAll).toHaveBeenCalledWith(testContext.orgSlug);
    });

    it('should get scope by ID via dashboard action', async () => {
      scopeRepo.findById.mockResolvedValue(mockScope);

      const payload = {
        action: 'scopes.get',
        params: { id: mockScope.id },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(scopeRepo.findById).toHaveBeenCalledWith(mockScope.id);
    });
  });

  describe('Flow 2: Add Subject', () => {
    it('should create a new subject via dashboard action', async () => {
      subjectRepo.create.mockResolvedValue(mockSubject);

      const payload = {
        action: 'subjects.create',
        params: {
          scopeId: mockScope.id,
          identifier: 'AAPL',
          name: 'Apple Inc.',
          subjectType: 'stock',
          metadata: { sector: 'Technology' },
        },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(subjectRepo.create).toHaveBeenCalled();
    });

    it('should list subjects by scope via dashboard action', async () => {
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);

      const payload = {
        action: 'subjects.list',
        params: { scopeId: mockScope.id },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(subjectRepo.findByScope).toHaveBeenCalledWith(mockScope.id);
    });

    it('should get subject by ID via dashboard action', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);

      const payload = {
        action: 'subjects.get',
        params: { id: mockSubject.id },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(subjectRepo.findById).toHaveBeenCalledWith(mockSubject.id);
    });
  });

  describe('Flow 3: View Composite Scores', () => {
    it('should get active composite score for subject', async () => {
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );

      const payload = {
        action: 'composite-scores.getBySubject',
        params: { subjectId: mockSubject.id },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(compositeScoreRepo.findActiveBySubject).toHaveBeenCalledWith(
        mockSubject.id,
      );
    });

    it('should get score history for subject', async () => {
      compositeScoreRepo.findHistory.mockResolvedValue([
        mockCompositeScore,
        { ...mockCompositeScore, id: 'score-2', status: 'superseded' },
      ]);

      const payload = {
        action: 'composite-scores.history',
        params: { subjectId: mockSubject.id, limit: 10 },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(compositeScoreRepo.findHistory).toHaveBeenCalledWith(
        mockSubject.id,
        10,
      );
    });
  });

  describe('Flow 4: View and Acknowledge Alerts', () => {
    it('should list unacknowledged alerts', async () => {
      // RiskAlertService.getUnacknowledgedAlerts is mocked in beforeEach

      const payload = {
        action: 'alerts.list',
        params: {}, // No subjectId means it uses getUnacknowledgedAlerts
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should acknowledge an alert', async () => {
      // RiskAlertService.acknowledgeAlert is mocked in beforeEach

      const payload = {
        action: 'alerts.acknowledge',
        params: { id: mockAlert.id },
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Flow 5: Dashboard Routing', () => {
    it('should route to correct handler based on action', async () => {
      // Setup mocks
      scopeRepo.findAll.mockResolvedValue([mockScope]);
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );
      // alerts.list uses RiskAlertService which is already mocked in beforeEach

      // Test routing to different handlers
      const actions = [
        'scopes.list',
        'subjects.list',
        'composite-scores.getBySubject',
        'alerts.list',
      ];

      for (const action of actions) {
        const payload = {
          action,
          params: { scopeId: mockScope.id, subjectId: mockSubject.id },
        };

        const result = await dashboardRouter.route(
          payload.action,
          payload,
          testContext,
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      }
    });

    it('should handle unknown actions gracefully', async () => {
      const payload = {
        action: 'unknown.action',
        params: {},
      };

      const result = await dashboardRouter.route(
        payload.action,
        payload,
        testContext,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });
  });

  describe('Flow 6: Full User Flow Simulation', () => {
    it('should complete the full flow: create scope -> add subject -> view score -> view alert -> acknowledge', async () => {
      // Step 1: Create scope
      scopeRepo.create.mockResolvedValue(mockScope);
      const createScopeResult = await dashboardRouter.route(
        'scopes.create',
        {
          action: 'scopes.create',
          params: { name: 'Test Scope', domain: 'investment' },
        },
        testContext,
      );
      expect(createScopeResult).toBeDefined();
      expect(createScopeResult.success).toBe(true);

      // Step 2: Add subject
      subjectRepo.create.mockResolvedValue(mockSubject);
      const createSubjectResult = await dashboardRouter.route(
        'subjects.create',
        {
          action: 'subjects.create',
          params: {
            scopeId: mockScope.id,
            identifier: 'AAPL',
            subjectType: 'stock',
          },
        },
        testContext,
      );
      expect(createSubjectResult).toBeDefined();
      expect(createSubjectResult.success).toBe(true);

      // Step 3: View composite score (after assessment would have run)
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );
      const scoreResult = await dashboardRouter.route(
        'composite-scores.getBySubject',
        {
          action: 'composite-scores.getBySubject',
          params: { subjectId: mockSubject.id },
        },
        testContext,
      );
      expect(scoreResult).toBeDefined();
      expect(scoreResult.success).toBe(true);

      // Step 4: View alerts (uses RiskAlertService mock from beforeEach)
      const alertsResult = await dashboardRouter.route(
        'alerts.list',
        {
          action: 'alerts.list',
          params: {},
        },
        testContext,
      );
      expect(alertsResult).toBeDefined();
      expect(alertsResult.success).toBe(true);

      // Step 5: Acknowledge alert (uses RiskAlertService mock from beforeEach)
      const ackResult = await dashboardRouter.route(
        'alerts.acknowledge',
        {
          action: 'alerts.acknowledge',
          params: { id: mockAlert.id },
        },
        testContext,
      );
      expect(ackResult).toBeDefined();
      expect(ackResult.success).toBe(true);

      // Verify repository methods were called (not alert repo since it uses service)
      expect(scopeRepo.create).toHaveBeenCalledTimes(1);
      expect(subjectRepo.create).toHaveBeenCalledTimes(1);
      expect(compositeScoreRepo.findActiveBySubject).toHaveBeenCalledTimes(1);
    });
  });
});
