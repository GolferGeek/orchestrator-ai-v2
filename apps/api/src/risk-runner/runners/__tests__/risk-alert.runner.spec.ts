import { Test, TestingModule } from '@nestjs/testing';
import { RiskAlertRunner } from '../risk-alert.runner';
import {
  RiskAlertService,
  AlertCheckResult,
  BatchAlertCheckSummary,
} from '../../services/risk-alert.service';
import { ScopeRepository } from '../../repositories/scope.repository';
import { RiskScope } from '../../interfaces/scope.interface';

describe('RiskAlertRunner', () => {
  let runner: RiskAlertRunner;
  let riskAlertService: jest.Mocked<RiskAlertService>;
  let scopeRepo: jest.Mocked<ScopeRepository>;

  const mockScope: RiskScope = {
    id: 'scope-1',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'US Tech Stocks',
    description: 'Technology sector risk analysis',
    domain: 'investment',
    llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } },
    thresholds: { critical_threshold: 70 },
    analysis_config: { riskRadar: { enabled: true } },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockScopes: RiskScope[] = [
    mockScope,
    { ...mockScope, id: 'scope-2', name: 'Crypto Portfolio' },
    { ...mockScope, id: 'scope-3', name: 'Test Scope', is_test: true },
  ];

  const mockAlertCheckResults: AlertCheckResult[] = [
    {
      subjectId: 'subject-1',
      subjectIdentifier: 'AAPL',
      alertsGenerated: [
        {
          id: 'alert-1',
          subject_id: 'subject-1',
          composite_score_id: 'score-1',
          alert_type: 'threshold_breach',
          severity: 'critical',
          title: 'Critical Risk Level',
          message: 'Risk score exceeded critical threshold',
          details: { threshold: 70, actual_score: 85 },
          acknowledged_at: null,
          acknowledged_by: null,
          is_test: false,
          test_scenario_id: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
      checksPerformed: ['threshold_breach', 'rapid_change'],
    },
  ];

  const mockAlertSummary: BatchAlertCheckSummary = {
    totalSubjectsChecked: 10,
    totalAlertsGenerated: 3,
    criticalAlerts: 1,
    warningAlerts: 1,
    infoAlerts: 1,
    results: mockAlertCheckResults,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAlertRunner,
        {
          provide: RiskAlertService,
          useValue: {
            checkAllScopesForAlerts: jest.fn(),
            checkScopeForAlerts: jest.fn(),
          },
        },
        {
          provide: ScopeRepository,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<RiskAlertRunner>(RiskAlertRunner);
    riskAlertService = module.get(RiskAlertService);
    scopeRepo = module.get(ScopeRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(runner).toBeDefined();
  });

  describe('isProcessing', () => {
    it('should return false when not running', () => {
      expect(runner.isProcessing()).toBe(false);
    });
  });

  describe('runBatchAlertCheck', () => {
    it('should check all scopes for alerts', async () => {
      scopeRepo.findAllActive.mockResolvedValue(mockScopes);
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue(
        mockAlertSummary,
      );

      const result = await runner.runBatchAlertCheck();

      expect(result.totalSubjectsChecked).toBe(10);
      expect(result.totalAlertsGenerated).toBe(3);
      expect(result.criticalAlerts).toBe(1);
      expect(result.warningAlerts).toBe(1);
      expect(result.infoAlerts).toBe(1);
      expect(result.scopesProcessed).toBe(2); // Excludes test scope
      expect(result.skipped).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should skip if previous run is still in progress', async () => {
      scopeRepo.findAllActive.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockScopes;
      });
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue(
        mockAlertSummary,
      );

      // Start first run
      const firstRun = runner.runBatchAlertCheck();

      // Try to start second run while first is in progress
      const secondResult = await runner.runBatchAlertCheck();

      // Wait for first run to complete
      await firstRun;

      expect(secondResult.totalSubjectsChecked).toBe(0);
      expect(secondResult.skipped).toBe(true);
      expect(secondResult.duration).toBe(0);
    });

    it('should handle service errors gracefully', async () => {
      scopeRepo.findAllActive.mockResolvedValue(mockScopes);
      riskAlertService.checkAllScopesForAlerts.mockRejectedValue(
        new Error('Service error'),
      );

      const result = await runner.runBatchAlertCheck();

      expect(result.totalSubjectsChecked).toBe(0);
      expect(result.totalAlertsGenerated).toBe(0);
      expect(result.skipped).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty scopes list', async () => {
      scopeRepo.findAllActive.mockResolvedValue([]);
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue({
        totalSubjectsChecked: 0,
        totalAlertsGenerated: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        infoAlerts: 0,
        results: [],
      });

      const result = await runner.runBatchAlertCheck();

      expect(result.scopesProcessed).toBe(0);
      expect(result.totalAlertsGenerated).toBe(0);
    });

    it('should exclude test scopes from scope count', async () => {
      const allTestScopes = mockScopes.map((s) => ({ ...s, is_test: true }));
      scopeRepo.findAllActive.mockResolvedValue(allTestScopes);
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue(
        mockAlertSummary,
      );

      const result = await runner.runBatchAlertCheck();

      expect(result.scopesProcessed).toBe(0);
    });

    it('should report high critical alerts', async () => {
      const highCriticalSummary: BatchAlertCheckSummary = {
        totalSubjectsChecked: 20,
        totalAlertsGenerated: 10,
        criticalAlerts: 5,
        warningAlerts: 3,
        infoAlerts: 2,
        results: [],
      };

      scopeRepo.findAllActive.mockResolvedValue(mockScopes);
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue(
        highCriticalSummary,
      );

      const result = await runner.runBatchAlertCheck();

      expect(result.criticalAlerts).toBe(5);
    });
  });

  describe('checkScopeAlerts', () => {
    it('should check alerts for a single scope', async () => {
      riskAlertService.checkScopeForAlerts.mockResolvedValue(
        mockAlertCheckResults,
      );

      const result = await runner.checkScopeAlerts('scope-1');

      expect(result).toEqual(mockAlertCheckResults);
      expect(riskAlertService.checkScopeForAlerts).toHaveBeenCalledWith(
        'scope-1',
      );
    });

    it('should return empty array when no alerts', async () => {
      riskAlertService.checkScopeForAlerts.mockResolvedValue([]);

      const result = await runner.checkScopeAlerts('scope-1');

      expect(result).toEqual([]);
    });
  });

  describe('runScheduledAlertCheck', () => {
    it('should call runBatchAlertCheck', async () => {
      scopeRepo.findAllActive.mockResolvedValue([]);
      riskAlertService.checkAllScopesForAlerts.mockResolvedValue({
        totalSubjectsChecked: 0,
        totalAlertsGenerated: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        infoAlerts: 0,
        results: [],
      });

      await runner.runScheduledAlertCheck();

      expect(riskAlertService.checkAllScopesForAlerts).toHaveBeenCalled();
    });
  });
});
