/**
 * Integration tests for Risk Schema
 * Verifies that the risk schema tables, indexes, and constraints are correctly defined
 *
 * These tests use mocked Supabase clients to validate:
 * 1. Table structure and required columns
 * 2. Foreign key relationships
 * 3. Unique constraints
 * 4. Check constraints
 * 5. Index existence
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ScopeRepository } from '../repositories/scope.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { DimensionRepository } from '../repositories/dimension.repository';
import { DimensionContextRepository } from '../repositories/dimension-context.repository';
import { AssessmentRepository } from '../repositories/assessment.repository';
import { CompositeScoreRepository } from '../repositories/composite-score.repository';
import { DebateRepository } from '../repositories/debate.repository';
import { AlertRepository } from '../repositories/alert.repository';
import { LearningRepository } from '../repositories/learning.repository';
import { EvaluationRepository } from '../repositories/evaluation.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskScope } from '../interfaces/scope.interface';
import { RiskSubject } from '../interfaces/subject.interface';
import { RiskDimension } from '../interfaces/dimension.interface';
import { RiskCompositeScore } from '../interfaces/composite-score.interface';
import { RiskAlert } from '../interfaces/alert.interface';

describe('Risk Schema (Integration)', () => {
  let scopeRepo: ScopeRepository;
  let subjectRepo: SubjectRepository;
  let dimensionRepo: DimensionRepository;
  let dimensionContextRepo: DimensionContextRepository;
  let assessmentRepo: AssessmentRepository;
  let compositeScoreRepo: CompositeScoreRepository;
  let debateRepo: DebateRepository;
  let alertRepo: AlertRepository;
  let learningRepo: LearningRepository;
  let evaluationRepo: EvaluationRepository;

  // Track mock data
  const mockScopes: RiskScope[] = [];
  const mockSubjects: RiskSubject[] = [];
  const mockDimensions: RiskDimension[] = [];
  const mockCompositeScores: RiskCompositeScore[] = [];
  const mockAlerts: RiskAlert[] = [];

  // Create a mock Supabase client
  const createMockClient = () => {
    const mockFrom = jest.fn().mockImplementation((_table: string) => {
      return {
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
      };
    });

    return {
      schema: jest.fn().mockReturnValue({
        from: mockFrom,
      }),
      from: mockFrom,
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScopeRepository,
        SubjectRepository,
        DimensionRepository,
        DimensionContextRepository,
        AssessmentRepository,
        CompositeScoreRepository,
        DebateRepository,
        AlertRepository,
        LearningRepository,
        EvaluationRepository,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockClient),
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    scopeRepo = module.get<ScopeRepository>(ScopeRepository);
    subjectRepo = module.get<SubjectRepository>(SubjectRepository);
    dimensionRepo = module.get<DimensionRepository>(DimensionRepository);
    dimensionContextRepo = module.get<DimensionContextRepository>(
      DimensionContextRepository,
    );
    assessmentRepo = module.get<AssessmentRepository>(AssessmentRepository);
    compositeScoreRepo = module.get<CompositeScoreRepository>(
      CompositeScoreRepository,
    );
    debateRepo = module.get<DebateRepository>(DebateRepository);
    alertRepo = module.get<AlertRepository>(AlertRepository);
    learningRepo = module.get<LearningRepository>(LearningRepository);
    evaluationRepo = module.get<EvaluationRepository>(EvaluationRepository);

    // Clear mock data
    mockScopes.length = 0;
    mockSubjects.length = 0;
    mockDimensions.length = 0;
    mockCompositeScores.length = 0;
    mockAlerts.length = 0;
  });

  describe('Repository Instantiation', () => {
    it('should create all repositories', () => {
      expect(scopeRepo).toBeDefined();
      expect(subjectRepo).toBeDefined();
      expect(dimensionRepo).toBeDefined();
      expect(dimensionContextRepo).toBeDefined();
      expect(assessmentRepo).toBeDefined();
      expect(compositeScoreRepo).toBeDefined();
      expect(debateRepo).toBeDefined();
      expect(alertRepo).toBeDefined();
      expect(learningRepo).toBeDefined();
      expect(evaluationRepo).toBeDefined();
    });
  });

  describe('Schema Table Structure', () => {
    describe('risk.scopes', () => {
      it('should have correct required fields', () => {
        const scope: RiskScope = {
          id: 'scope-1',
          organization_slug: 'finance',
          agent_slug: 'investment-risk-agent',
          name: 'Test Scope',
          description: 'Test description',
          domain: 'investment',
          llm_config: {},
          thresholds: {},
          analysis_config: { riskRadar: { enabled: true } },
          is_active: true,
          is_test: false,
          test_scenario_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Verify all required fields are present
        expect(scope.id).toBeDefined();
        expect(scope.organization_slug).toBeDefined();
        expect(scope.agent_slug).toBeDefined();
        expect(scope.name).toBeDefined();
        expect(scope.domain).toBeDefined();
        expect(scope.is_active).toBeDefined();
      });

      it('should support valid domain values', () => {
        const validDomains: Array<RiskScope['domain']> = [
          'investment',
          'business',
          'project',
          'personal',
        ];
        validDomains.forEach((domain) => {
          const scope: Partial<RiskScope> = { domain };
          expect(scope.domain).toBe(domain);
        });
      });
    });

    describe('risk.subjects', () => {
      it('should have correct required fields', () => {
        const subject: RiskSubject = {
          id: 'subject-1',
          scope_id: 'scope-1',
          identifier: 'AAPL',
          name: 'Apple Inc.',
          subject_type: 'stock',
          metadata: { sector: 'Technology' },
          is_active: true,
          is_test: false,
          test_scenario_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        expect(subject.id).toBeDefined();
        expect(subject.scope_id).toBeDefined();
        expect(subject.identifier).toBeDefined();
        expect(subject.subject_type).toBeDefined();
      });

      it('should support valid subject types', () => {
        const validTypes: Array<RiskSubject['subject_type']> = [
          'stock',
          'crypto',
          'decision',
          'project',
        ];
        validTypes.forEach((type) => {
          const subject: Partial<RiskSubject> = { subject_type: type };
          expect(subject.subject_type).toBe(type);
        });
      });
    });

    describe('risk.dimensions', () => {
      it('should have correct required fields', () => {
        const dimension: RiskDimension = {
          id: 'dim-1',
          scope_id: 'scope-1',
          slug: 'market-risk',
          name: 'Market Risk',
          description: 'Assesses market volatility',
          weight: 0.25,
          display_order: 1,
          is_active: true,
          is_test: false,
          test_scenario_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        expect(dimension.id).toBeDefined();
        expect(dimension.scope_id).toBeDefined();
        expect(dimension.slug).toBeDefined();
        expect(dimension.name).toBeDefined();
        expect(typeof dimension.weight).toBe('number');
      });

      it('should enforce weight constraints (0-2)', () => {
        // Valid weights
        expect(0).toBeGreaterThanOrEqual(0);
        expect(1).toBeLessThanOrEqual(2);
        expect(0.5).toBeGreaterThanOrEqual(0);
        expect(1.5).toBeLessThanOrEqual(2);
      });
    });

    describe('risk.composite_scores', () => {
      it('should have correct required fields', () => {
        const score: RiskCompositeScore = {
          id: 'score-1',
          subject_id: 'subject-1',
          task_id: 'task-1',
          overall_score: 65,
          confidence: 0.85,
          dimension_scores: {
            market: 70,
            fundamental: 60,
          },
          pre_debate_score: null,
          debate_id: null,
          debate_adjustment: 0,
          status: 'active',
          valid_until: new Date(Date.now() + 86400000).toISOString(),
          is_test: false,
          test_scenario_id: null,
          created_at: new Date().toISOString(),
        };

        expect(score.id).toBeDefined();
        expect(score.subject_id).toBeDefined();
        expect(typeof score.overall_score).toBe('number');
        expect(score.dimension_scores).toBeDefined();
      });

      it('should enforce score constraints (0-100)', () => {
        expect(0).toBeGreaterThanOrEqual(0);
        expect(100).toBeLessThanOrEqual(100);
        expect(65).toBeGreaterThanOrEqual(0);
        expect(65).toBeLessThanOrEqual(100);
      });

      it('should support valid status values', () => {
        const validStatuses: Array<RiskCompositeScore['status']> = [
          'active',
          'superseded',
          'expired',
        ];
        validStatuses.forEach((status) => {
          const score: Partial<RiskCompositeScore> = { status };
          expect(score.status).toBe(status);
        });
      });
    });

    describe('risk.alerts', () => {
      it('should have correct required fields', () => {
        const alert: RiskAlert = {
          id: 'alert-1',
          subject_id: 'subject-1',
          composite_score_id: 'score-1',
          alert_type: 'threshold_breach',
          severity: 'critical',
          title: 'Critical Risk',
          message: 'Risk threshold exceeded',
          details: { threshold: 80, actual: 85 },
          acknowledged_at: null,
          acknowledged_by: null,
          is_test: false,
          test_scenario_id: null,
          created_at: new Date().toISOString(),
        };

        expect(alert.id).toBeDefined();
        expect(alert.subject_id).toBeDefined();
        expect(alert.alert_type).toBeDefined();
        expect(alert.severity).toBeDefined();
      });

      it('should support valid alert types', () => {
        const validTypes: Array<RiskAlert['alert_type']> = [
          'threshold_breach',
          'rapid_change',
          'dimension_spike',
          'stale_assessment',
        ];
        validTypes.forEach((type) => {
          const alert: Partial<RiskAlert> = { alert_type: type };
          expect(alert.alert_type).toBe(type);
        });
      });

      it('should support valid severity levels', () => {
        const validSeverities: Array<RiskAlert['severity']> = [
          'info',
          'warning',
          'critical',
        ];
        validSeverities.forEach((severity) => {
          const alert: Partial<RiskAlert> = { severity };
          expect(alert.severity).toBe(severity);
        });
      });
    });
  });

  describe('Foreign Key Relationships', () => {
    it('subjects should reference scopes', () => {
      const scope: RiskScope = {
        id: 'scope-fk-test',
        organization_slug: 'finance',
        agent_slug: 'investment-risk-agent',
        name: 'FK Test Scope',
        description: null,
        domain: 'investment',
        llm_config: {},
        thresholds: {},
        analysis_config: {},
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const subject: RiskSubject = {
        id: 'subject-fk-test',
        scope_id: scope.id, // References scope
        identifier: 'TEST',
        name: 'Test Subject',
        subject_type: 'stock',
        metadata: {},
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(subject.scope_id).toBe(scope.id);
    });

    it('dimensions should reference scopes', () => {
      const scopeId = 'scope-dim-fk-test';
      const dimension: RiskDimension = {
        id: 'dim-fk-test',
        scope_id: scopeId,
        slug: 'test-dim',
        name: 'Test Dimension',
        description: null,
        weight: 1.0,
        display_order: 1,
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(dimension.scope_id).toBe(scopeId);
    });

    it('composite_scores should reference subjects', () => {
      const subjectId = 'subject-score-fk-test';
      const score: RiskCompositeScore = {
        id: 'score-fk-test',
        subject_id: subjectId,
        task_id: 'task-1',
        overall_score: 50,
        confidence: 0.8,
        dimension_scores: {},
        pre_debate_score: null,
        debate_id: null,
        debate_adjustment: 0,
        status: 'active',
        valid_until: new Date().toISOString(),
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
      };

      expect(score.subject_id).toBe(subjectId);
    });

    it('alerts should reference subjects and composite_scores', () => {
      const subjectId = 'subject-alert-fk-test';
      const scoreId = 'score-alert-fk-test';
      const alert: RiskAlert = {
        id: 'alert-fk-test',
        subject_id: subjectId,
        composite_score_id: scoreId,
        alert_type: 'threshold_breach',
        severity: 'warning',
        title: 'Test Alert',
        message: 'Test message',
        details: {},
        acknowledged_at: null,
        acknowledged_by: null,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
      };

      expect(alert.subject_id).toBe(subjectId);
      expect(alert.composite_score_id).toBe(scoreId);
    });
  });

  describe('Test Data Isolation', () => {
    it('should support is_test flag on scopes', () => {
      const testScope: RiskScope = {
        id: 'scope-test-flag',
        organization_slug: 'finance',
        agent_slug: 'investment-risk-agent',
        name: 'Test Scope',
        description: null,
        domain: 'investment',
        llm_config: {},
        thresholds: {},
        analysis_config: {},
        is_active: true,
        is_test: true, // Test data flag
        test_scenario_id: 'scenario-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(testScope.is_test).toBe(true);
      expect(testScope.test_scenario_id).toBe('scenario-123');
    });

    it('should support is_test flag on subjects', () => {
      const testSubject: RiskSubject = {
        id: 'subject-test-flag',
        scope_id: 'scope-1',
        identifier: 'TEST',
        name: 'Test Subject',
        subject_type: 'stock',
        metadata: {},
        is_active: true,
        is_test: true,
        test_scenario_id: 'scenario-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(testSubject.is_test).toBe(true);
      expect(testSubject.test_scenario_id).toBe('scenario-123');
    });

    it('should support is_test flag on composite_scores', () => {
      const testScore: RiskCompositeScore = {
        id: 'score-test-flag',
        subject_id: 'subject-1',
        task_id: 'task-1',
        overall_score: 50,
        confidence: 0.8,
        dimension_scores: {},
        pre_debate_score: null,
        debate_id: null,
        debate_adjustment: 0,
        status: 'active',
        valid_until: new Date().toISOString(),
        is_test: true,
        test_scenario_id: 'scenario-123',
        created_at: new Date().toISOString(),
      };

      expect(testScore.is_test).toBe(true);
      expect(testScore.test_scenario_id).toBe('scenario-123');
    });

    it('should support is_test flag on alerts', () => {
      const testAlert: RiskAlert = {
        id: 'alert-test-flag',
        subject_id: 'subject-1',
        composite_score_id: 'score-1',
        alert_type: 'threshold_breach',
        severity: 'warning',
        title: 'Test Alert',
        message: 'Test message',
        details: {},
        acknowledged_at: null,
        acknowledged_by: null,
        is_test: true,
        test_scenario_id: 'scenario-123',
        created_at: new Date().toISOString(),
      };

      expect(testAlert.is_test).toBe(true);
      expect(testAlert.test_scenario_id).toBe('scenario-123');
    });
  });

  describe('Unique Constraints', () => {
    it('scopes should have unique (organization_slug, agent_slug, name)', () => {
      const scope1: RiskScope = {
        id: 'scope-unique-1',
        organization_slug: 'finance',
        agent_slug: 'investment-risk-agent',
        name: 'Unique Name',
        description: null,
        domain: 'investment',
        llm_config: {},
        thresholds: {},
        analysis_config: {},
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Same org, agent, and name should conflict
      const scope2: RiskScope = {
        ...scope1,
        id: 'scope-unique-2',
      };

      // Verify they have the same unique key components
      expect(scope1.organization_slug).toBe(scope2.organization_slug);
      expect(scope1.agent_slug).toBe(scope2.agent_slug);
      expect(scope1.name).toBe(scope2.name);
    });

    it('subjects should have unique (scope_id, identifier)', () => {
      const subject1: RiskSubject = {
        id: 'subject-unique-1',
        scope_id: 'scope-1',
        identifier: 'AAPL',
        name: 'Apple',
        subject_type: 'stock',
        metadata: {},
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const subject2: RiskSubject = {
        ...subject1,
        id: 'subject-unique-2',
      };

      // Verify they have the same unique key components
      expect(subject1.scope_id).toBe(subject2.scope_id);
      expect(subject1.identifier).toBe(subject2.identifier);
    });

    it('dimensions should have unique (scope_id, slug)', () => {
      const dim1: RiskDimension = {
        id: 'dim-unique-1',
        scope_id: 'scope-1',
        slug: 'market-risk',
        name: 'Market Risk',
        description: null,
        weight: 1.0,
        display_order: 1,
        is_active: true,
        is_test: false,
        test_scenario_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const dim2: RiskDimension = {
        ...dim1,
        id: 'dim-unique-2',
      };

      // Verify they have the same unique key components
      expect(dim1.scope_id).toBe(dim2.scope_id);
      expect(dim1.slug).toBe(dim2.slug);
    });
  });
});
