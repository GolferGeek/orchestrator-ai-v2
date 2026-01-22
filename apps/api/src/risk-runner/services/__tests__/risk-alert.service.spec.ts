import { Test, TestingModule } from '@nestjs/testing';
import { RiskAlertService } from '../risk-alert.service';
import { AlertRepository } from '../../repositories/alert.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { ScopeRepository } from '../../repositories/scope.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import { RiskAlert } from '../../interfaces/alert.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';
import { RiskScope } from '../../interfaces/scope.interface';
import { RiskSubject } from '../../interfaces/subject.interface';

describe('RiskAlertService', () => {
  let service: RiskAlertService;
  let alertRepo: jest.Mocked<AlertRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;

  const mockScope: RiskScope = {
    id: 'scope-123',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'Test Scope',
    description: null,
    domain: 'investment',
    llm_config: {},
    thresholds: {
      critical_threshold: 80,
      warning_threshold: 60,
      rapid_change_threshold: 15,
      stale_hours: 24,
    },
    analysis_config: {
      riskRadar: { enabled: true },
      redTeam: { enabled: true },
    },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-123',
    scope_id: 'scope-123',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-123',
    subject_id: 'subject-123',
    task_id: 'task-123',
    overall_score: 65,
    dimension_scores: { market: 70, fundamental: 60 },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.8,
    status: 'active',
    valid_until: '2026-01-16T00:00:00Z',
    is_test: false,
    test_scenario_id: null,
    created_at: new Date().toISOString(),
  };

  const mockAlert: RiskAlert = {
    id: 'alert-123',
    subject_id: 'subject-123',
    composite_score_id: 'score-123',
    alert_type: 'threshold_breach',
    severity: 'warning',
    title: 'Elevated risk level for AAPL',
    message: 'Risk score 65 exceeds warning threshold 60',
    details: {
      threshold: 60,
      actual_score: 65,
    },
    acknowledged_at: null,
    acknowledged_by: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAlertService,
        {
          provide: AlertRepository,
          useValue: {
            findBySubject: jest.fn(),
            findUnacknowledged: jest.fn(),
            findUnacknowledgedBySubject: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            acknowledge: jest.fn(),
            countUnacknowledgedBySeverity: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findHistory: jest.fn(),
          },
        },
        {
          provide: ScopeRepository,
          useValue: {
            findById: jest.fn(),
            findAllActive: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findByScope: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RiskAlertService>(RiskAlertService);
    alertRepo = module.get(AlertRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    scopeRepo = module.get(ScopeRepository);
    subjectRepo = module.get(SubjectRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkSubjectForAlerts', () => {
    it('should generate threshold_breach alert when score exceeds warning threshold', async () => {
      const currentScore = { ...mockCompositeScore, overall_score: 65 };
      compositeScoreRepo.findHistory.mockResolvedValue([currentScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue({
        ...mockAlert,
        alert_type: 'threshold_breach',
        severity: 'warning',
      });

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      expect(result.alertsGenerated).toHaveLength(1);
      const alert = result.alertsGenerated[0];
      expect(alert).toBeDefined();
      expect(alert?.alert_type).toBe('threshold_breach');
      expect(alert?.severity).toBe('warning');
      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'threshold_breach',
          severity: 'warning',
        }),
      );
    });

    it('should generate critical alert when score exceeds critical threshold', async () => {
      const currentScore = { ...mockCompositeScore, overall_score: 85 };
      compositeScoreRepo.findHistory.mockResolvedValue([currentScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue({
        ...mockAlert,
        alert_type: 'threshold_breach',
        severity: 'critical',
      });

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      expect(
        result.alertsGenerated.some((a) => a.severity === 'critical'),
      ).toBe(true);
    });

    it('should not generate threshold alert if one already exists for this score', async () => {
      const currentScore = { ...mockCompositeScore, overall_score: 65 };
      compositeScoreRepo.findHistory.mockResolvedValue([currentScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([
        {
          ...mockAlert,
          alert_type: 'threshold_breach',
          composite_score_id: 'score-123',
        },
      ]);

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      // Should not create duplicate alert
      expect(
        result.alertsGenerated.filter(
          (a) => a.alert_type === 'threshold_breach',
        ),
      ).toHaveLength(0);
      expect(alertRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'threshold_breach',
        }),
      );
    });

    it('should generate rapid_change alert when score changes significantly', async () => {
      const currentScore = { ...mockCompositeScore, overall_score: 70 };
      const previousScore = {
        ...mockCompositeScore,
        id: 'score-122',
        overall_score: 55,
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      };
      compositeScoreRepo.findHistory.mockResolvedValue([
        currentScore,
        previousScore,
      ]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockImplementation(async (data) => ({
        ...mockAlert,
        ...data,
        id: `alert-${Date.now()}`,
      }));

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      const rapidChangeAlert = result.alertsGenerated.find(
        (a) => a.alert_type === 'rapid_change',
      );
      expect(rapidChangeAlert).toBeDefined();
      expect(rapidChangeAlert?.severity).toBe('warning');
    });

    it('should generate stale_assessment alert when assessment is old', async () => {
      const staleScore = {
        ...mockCompositeScore,
        overall_score: 50, // Below warning threshold
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(), // 48 hours ago
      };
      compositeScoreRepo.findHistory.mockResolvedValue([staleScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockImplementation(async (data) => ({
        ...mockAlert,
        ...data,
        id: `alert-${Date.now()}`,
      }));

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      const staleAlert = result.alertsGenerated.find(
        (a) => a.alert_type === 'stale_assessment',
      );
      expect(staleAlert).toBeDefined();
      expect(staleAlert?.severity).toBe('info');
    });

    it('should not generate stale alert if one already exists', async () => {
      const staleScore = {
        ...mockCompositeScore,
        overall_score: 50,
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      };
      compositeScoreRepo.findHistory.mockResolvedValue([staleScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([
        {
          ...mockAlert,
          alert_type: 'stale_assessment',
        },
      ]);

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      expect(
        result.alertsGenerated.filter(
          (a) => a.alert_type === 'stale_assessment',
        ),
      ).toHaveLength(0);
    });

    it('should generate dimension_spike alert when individual dimension changes significantly', async () => {
      const currentScore = {
        ...mockCompositeScore,
        overall_score: 60,
        dimension_scores: { market: 85, fundamental: 50 },
      };
      const previousScore = {
        ...mockCompositeScore,
        id: 'score-122',
        overall_score: 55,
        dimension_scores: { market: 60, fundamental: 50 },
        created_at: new Date(Date.now() - 3600000).toISOString(),
      };
      compositeScoreRepo.findHistory.mockResolvedValue([
        currentScore,
        previousScore,
      ]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockImplementation(async (data) => ({
        ...mockAlert,
        ...data,
        id: `alert-${Date.now()}`,
      }));

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      const dimensionAlert = result.alertsGenerated.find(
        (a) => a.alert_type === 'dimension_spike',
      );
      expect(dimensionAlert).toBeDefined();
      expect(dimensionAlert?.details?.dimension_slug).toBe('market');
    });

    it('should use default thresholds when scope has no thresholds configured', async () => {
      const scopeNoThresholds = { ...mockScope, thresholds: null };
      const currentScore = { ...mockCompositeScore, overall_score: 85 }; // Above default critical (80)
      compositeScoreRepo.findHistory.mockResolvedValue([currentScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue({
        ...mockAlert,
        severity: 'critical',
      });

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        scopeNoThresholds,
      );

      expect(
        result.alertsGenerated.some((a) => a.severity === 'critical'),
      ).toBe(true);
    });

    it('should return empty alerts when no score exists', async () => {
      compositeScoreRepo.findHistory.mockResolvedValue([]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);

      const result = await service.checkSubjectForAlerts(
        mockSubject,
        mockScope,
      );

      expect(result.alertsGenerated).toHaveLength(0);
      expect(result.checksPerformed).toContain('stale_assessment');
    });
  });

  describe('checkScopeForAlerts', () => {
    it('should check all active subjects in scope', async () => {
      const subjects = [
        mockSubject,
        { ...mockSubject, id: 'subject-456', identifier: 'MSFT' },
      ];
      scopeRepo.findById.mockResolvedValue(mockScope);
      subjectRepo.findByScope.mockResolvedValue(subjects);
      compositeScoreRepo.findHistory.mockResolvedValue([mockCompositeScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue(mockAlert);

      const results = await service.checkScopeForAlerts('scope-123');

      expect(results).toHaveLength(2);
      expect(subjectRepo.findByScope).toHaveBeenCalledWith('scope-123');
    });

    it('should skip inactive scopes', async () => {
      scopeRepo.findById.mockResolvedValue({ ...mockScope, is_active: false });

      const results = await service.checkScopeForAlerts('scope-123');

      expect(results).toHaveLength(0);
      expect(subjectRepo.findByScope).not.toHaveBeenCalled();
    });

    it('should skip test subjects', async () => {
      const subjects = [
        mockSubject,
        { ...mockSubject, id: 'subject-test', is_test: true },
      ];
      scopeRepo.findById.mockResolvedValue(mockScope);
      subjectRepo.findByScope.mockResolvedValue(subjects);
      compositeScoreRepo.findHistory.mockResolvedValue([mockCompositeScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue(mockAlert);

      const results = await service.checkScopeForAlerts('scope-123');

      // Should only process non-test subjects
      expect(results).toHaveLength(1);
    });
  });

  describe('checkAllScopesForAlerts', () => {
    it('should check all active non-test scopes', async () => {
      const scopes = [
        mockScope,
        { ...mockScope, id: 'scope-456', name: 'Scope 2' },
        { ...mockScope, id: 'scope-test', is_test: true },
      ];
      scopeRepo.findAllActive.mockResolvedValue(scopes);
      scopeRepo.findById.mockResolvedValue(mockScope);
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);
      compositeScoreRepo.findHistory.mockResolvedValue([mockCompositeScore]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue(mockAlert);

      const summary = await service.checkAllScopesForAlerts();

      expect(summary.totalSubjectsChecked).toBe(2); // 2 non-test scopes
      expect(scopeRepo.findAllActive).toHaveBeenCalled();
    });

    it('should return proper summary counts', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScope]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);
      compositeScoreRepo.findHistory.mockResolvedValue([
        { ...mockCompositeScore, overall_score: 85 },
      ]);
      alertRepo.findUnacknowledgedBySubject.mockResolvedValue([]);
      alertRepo.create.mockResolvedValue({
        ...mockAlert,
        severity: 'critical',
      });

      const summary = await service.checkAllScopesForAlerts();

      expect(summary.criticalAlerts).toBeGreaterThanOrEqual(0);
      expect(summary.warningAlerts).toBeGreaterThanOrEqual(0);
      expect(summary.infoAlerts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Query methods', () => {
    describe('getAlertsBySubject', () => {
      it('should return alerts for subject', async () => {
        alertRepo.findBySubject.mockResolvedValue([mockAlert]);

        const result = await service.getAlertsBySubject('subject-123');

        expect(result).toEqual([mockAlert]);
        expect(alertRepo.findBySubject).toHaveBeenCalledWith(
          'subject-123',
          undefined,
        );
      });
    });

    describe('getUnacknowledgedAlerts', () => {
      it('should return unacknowledged alerts', async () => {
        alertRepo.findUnacknowledged.mockResolvedValue([
          {
            ...mockAlert,
            subject_identifier: 'AAPL',
            subject_name: 'Apple',
            scope_name: 'Test',
          },
        ]);

        const result = await service.getUnacknowledgedAlerts();

        expect(result).toHaveLength(1);
        expect(alertRepo.findUnacknowledged).toHaveBeenCalled();
      });
    });

    describe('acknowledgeAlert', () => {
      it('should acknowledge an alert', async () => {
        const acknowledgedAlert = {
          ...mockAlert,
          acknowledged_at: '2026-01-15T12:00:00Z',
          acknowledged_by: 'user-123',
        };
        alertRepo.acknowledge.mockResolvedValue(acknowledgedAlert);

        const result = await service.acknowledgeAlert('alert-123', 'user-123');

        expect(result.acknowledged_at).toBeDefined();
        expect(result.acknowledged_by).toBe('user-123');
        expect(alertRepo.acknowledge).toHaveBeenCalledWith(
          'alert-123',
          'user-123',
        );
      });
    });

    describe('countUnacknowledgedBySeverity', () => {
      it('should return counts by severity', async () => {
        alertRepo.countUnacknowledgedBySeverity.mockResolvedValue({
          critical: 2,
          warning: 5,
          info: 3,
        });

        const result = await service.countUnacknowledgedBySeverity();

        expect(result).toEqual({ critical: 2, warning: 5, info: 3 });
      });
    });
  });
});
