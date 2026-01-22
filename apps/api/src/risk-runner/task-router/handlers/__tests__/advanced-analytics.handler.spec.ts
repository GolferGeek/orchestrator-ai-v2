import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedAnalyticsHandler } from '../advanced-analytics.handler';
import { ExecutiveSummaryService } from '../../../services/executive-summary.service';
import { ScenarioAnalysisService } from '../../../services/scenario-analysis.service';
import { ReportGeneratorService } from '../../../services/report-generator.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';

// Type helper for test assertions
type AnyData = any;

describe('AdvancedAnalyticsHandler', () => {
  let handler: AdvancedAnalyticsHandler;
  let executiveSummaryService: jest.Mocked<ExecutiveSummaryService>;
  let scenarioAnalysisService: jest.Mocked<ScenarioAnalysisService>;
  let reportGeneratorService: jest.Mocked<ReportGeneratorService>;

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
        AdvancedAnalyticsHandler,
        {
          provide: ExecutiveSummaryService,
          useValue: {
            generateSummary: jest.fn(),
            getLatestSummary: jest.fn(),
            listSummaries: jest.fn(),
          },
        },
        {
          provide: ScenarioAnalysisService,
          useValue: {
            runScenario: jest.fn(),
            saveScenario: jest.fn(),
            listScenarios: jest.fn(),
            getScenario: jest.fn(),
            deleteScenario: jest.fn(),
            getTemplates: jest.fn(),
          },
        },
        {
          provide: ReportGeneratorService,
          useValue: {
            generateReport: jest.fn(),
            getReport: jest.fn(),
            listReports: jest.fn(),
            deleteReport: jest.fn(),
            refreshDownloadUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<AdvancedAnalyticsHandler>(AdvancedAnalyticsHandler);
    executiveSummaryService = module.get(ExecutiveSummaryService);
    scenarioAnalysisService = module.get(ScenarioAnalysisService);
    reportGeneratorService = module.get(ReportGeneratorService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('generate-summary');
      expect(actions).toContain('get-latest-summary');
      expect(actions).toContain('list-summaries');
      expect(actions).toContain('run-scenario');
      expect(actions).toContain('save-scenario');
      expect(actions).toContain('generate-report');
      expect(actions).toContain('get-report');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTIVE SUMMARY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('execute - generate-summary', () => {
    const mockSummary = {
      id: 'summary-1',
      scope_id: 'scope-1',
      summary_type: 'ad-hoc',
      content: {
        headline: 'Portfolio risk at moderate levels',
        status: 'medium',
        keyFindings: ['Finding 1', 'Finding 2'],
        recommendations: ['Recommendation 1'],
        riskHighlights: { topRisks: [], recentChanges: [] },
      },
      generated_at: '2024-01-15T00:00:00Z',
      expires_at: '2024-01-16T00:00:00Z',
    };

    it('should generate an executive summary', async () => {
      executiveSummaryService.generateSummary.mockResolvedValue({
        summary: mockSummary as any,
        cached: false,
      });

      const payload = createPayload('generate-summary', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'generate-summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.id).toBe('summary-1');
      expect(data.content.headline).toBeDefined();
      expect(result.metadata?.cached).toBe(false);
    });

    it('should return cached summary when available', async () => {
      executiveSummaryService.generateSummary.mockResolvedValue({
        summary: mockSummary as any,
        cached: true,
      });

      const payload = createPayload('generate-summary', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'generate-summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.cached).toBe(true);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('generate-summary', {});
      const result = await handler.execute(
        'generate-summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - get-latest-summary', () => {
    it('should return the latest summary', async () => {
      executiveSummaryService.getLatestSummary.mockResolvedValue({
        id: 'summary-1',
        scope_id: 'scope-1',
        summary_type: 'ad-hoc',
        content: { headline: 'Test' },
        generated_at: '2024-01-15T00:00:00Z',
        expires_at: null,
      } as any);

      const payload = createPayload('get-latest-summary', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'get-latest-summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.id).toBe('summary-1');
    });

    it('should return null when no summary exists', async () => {
      executiveSummaryService.getLatestSummary.mockResolvedValue(null);

      const payload = createPayload('get-latest-summary', {
        scopeId: 'scope-1',
      });
      const result = await handler.execute(
        'get-latest-summary',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.metadata?.found).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO ANALYSIS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('execute - run-scenario', () => {
    const mockScenarioResult = {
      scenarioName: 'Market Stress Test',
      adjustments: { 'market-volatility': 0.2 },
      portfolioBaseline: 0.5,
      portfolioAdjusted: 0.6,
      portfolioChange: 0.1,
      portfolioChangePercent: 20,
      subjectResults: [],
      riskDistributionBefore: { critical: 1, high: 2, medium: 1, low: 1 },
      riskDistributionAfter: { critical: 2, high: 2, medium: 1, low: 0 },
    };

    it('should run a scenario analysis', async () => {
      scenarioAnalysisService.runScenario.mockResolvedValue(mockScenarioResult);

      const payload = createPayload('run-scenario', {
        scopeId: 'scope-1',
        name: 'Market Stress Test',
        adjustments: [{ dimensionSlug: 'market-volatility', adjustment: 0.2 }],
      });
      const result = await handler.execute(
        'run-scenario',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.scenarioName).toBe('Market Stress Test');
      expect(data.portfolioChange).toBe(0.1);
    });

    it('should return error when required params are missing', async () => {
      const payload = createPayload('run-scenario', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'run-scenario',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('execute - save-scenario', () => {
    it('should save a scenario', async () => {
      scenarioAnalysisService.saveScenario.mockResolvedValue({
        id: 'scenario-1',
        scope_id: 'scope-1',
        name: 'Market Stress Test',
        description: null,
        adjustments: { 'market-volatility': 0.2 },
        is_template: false,
        created_at: '2024-01-15T00:00:00Z',
      } as any);

      const payload = createPayload('save-scenario', {
        scopeId: 'scope-1',
        name: 'Market Stress Test',
        adjustments: [{ dimensionSlug: 'market-volatility', adjustment: 0.2 }],
      });
      const result = await handler.execute(
        'save-scenario',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.id).toBe('scenario-1');
      expect(data.name).toBe('Market Stress Test');
    });
  });

  describe('execute - list-scenarios', () => {
    it('should list scenarios for a scope', async () => {
      scenarioAnalysisService.listScenarios.mockResolvedValue([
        {
          id: 'scenario-1',
          scope_id: 'scope-1',
          name: 'Scenario 1',
          description: null,
          adjustments: {},
          is_template: false,
          created_at: '2024-01-15T00:00:00Z',
        },
        {
          id: 'scenario-2',
          scope_id: 'scope-1',
          name: 'Scenario 2',
          description: null,
          adjustments: {},
          is_template: false,
          created_at: '2024-01-14T00:00:00Z',
        },
      ] as any[]);

      const payload = createPayload('list-scenarios', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'list-scenarios',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data).toHaveLength(2);
      expect(result.metadata?.count).toBe(2);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('list-scenarios', {});
      const result = await handler.execute(
        'list-scenarios',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - delete-scenario', () => {
    it('should delete a scenario', async () => {
      scenarioAnalysisService.deleteScenario.mockResolvedValue(undefined);

      const payload = createPayload('delete-scenario', { id: 'scenario-1' });
      const result = await handler.execute(
        'delete-scenario',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.success).toBe(true);
    });

    it('should return error when id is missing', async () => {
      const payload = createPayload('delete-scenario', {});
      const result = await handler.execute(
        'delete-scenario',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF REPORT TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('execute - generate-report', () => {
    const mockReport = {
      id: 'report-1',
      scope_id: 'scope-1',
      title: 'Q1 Risk Report',
      report_type: 'comprehensive',
      status: 'pending',
      created_at: '2024-01-15T00:00:00Z',
    };

    it('should generate a report', async () => {
      reportGeneratorService.generateReport.mockResolvedValue(
        mockReport as any,
      );

      const payload = createPayload('generate-report', {
        scopeId: 'scope-1',
        title: 'Q1 Risk Report',
      });
      const result = await handler.execute(
        'generate-report',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.id).toBe('report-1');
      expect(data.title).toBe('Q1 Risk Report');
      expect(data.status).toBe('pending');
    });

    it('should return error when required params are missing', async () => {
      const payload = createPayload('generate-report', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'generate-report',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('execute - get-report', () => {
    it('should get a report by ID', async () => {
      reportGeneratorService.getReport.mockResolvedValue({
        id: 'report-1',
        scope_id: 'scope-1',
        title: 'Q1 Risk Report',
        report_type: 'comprehensive',
        config: {},
        status: 'completed',
        file_path: 'reports/scope-1/report-1.pdf',
        file_size: 1024,
        download_url: 'https://example.com/download',
        download_expires_at: '2024-01-16T00:00:00Z',
        error_message: null,
        generated_at: '2024-01-15T00:00:00Z',
        created_at: '2024-01-15T00:00:00Z',
      } as any);

      const payload = createPayload('get-report', { id: 'report-1' });
      const result = await handler.execute(
        'get-report',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.id).toBe('report-1');
      expect(data.status).toBe('completed');
      expect(data.downloadUrl).toBe('https://example.com/download');
    });

    it('should return error when report not found', async () => {
      reportGeneratorService.getReport.mockResolvedValue(null);

      const payload = createPayload('get-report', { id: 'nonexistent' });
      const result = await handler.execute(
        'get-report',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - list-reports', () => {
    it('should list reports for a scope', async () => {
      reportGeneratorService.listReports.mockResolvedValue([
        {
          id: 'report-1',
          scope_id: 'scope-1',
          title: 'Report 1',
          report_type: 'comprehensive',
          status: 'completed',
          download_url: 'https://example.com/1',
          download_expires_at: '2024-01-16T00:00:00Z',
          generated_at: '2024-01-15T00:00:00Z',
          created_at: '2024-01-15T00:00:00Z',
        },
      ] as any[]);

      const payload = createPayload('list-reports', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'list-reports',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data).toHaveLength(1);
      expect(result.metadata?.count).toBe(1);
    });
  });

  describe('execute - delete-report', () => {
    it('should delete a report', async () => {
      reportGeneratorService.deleteReport.mockResolvedValue(undefined);

      const payload = createPayload('delete-report', { id: 'report-1' });
      const result = await handler.execute(
        'delete-report',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.success).toBe(true);
    });
  });

  describe('execute - refresh-download-url', () => {
    it('should refresh download URL', async () => {
      reportGeneratorService.refreshDownloadUrl.mockResolvedValue(
        'https://example.com/new-url',
      );

      const payload = createPayload('refresh-download-url', { id: 'report-1' });
      const result = await handler.execute(
        'refresh-download-url',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as AnyData;
      expect(data.downloadUrl).toBe('https://example.com/new-url');
    });

    it('should return error when refresh fails', async () => {
      reportGeneratorService.refreshDownloadUrl.mockResolvedValue(null);

      const payload = createPayload('refresh-download-url', { id: 'report-1' });
      const result = await handler.execute(
        'refresh-download-url',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REFRESH_FAILED');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('unsupported');
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
