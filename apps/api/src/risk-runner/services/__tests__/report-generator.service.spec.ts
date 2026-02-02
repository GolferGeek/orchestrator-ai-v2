import { Test, TestingModule } from '@nestjs/testing';
import { ReportGeneratorService, Report, GenerateReportInput } from '../report-generator.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('ReportGeneratorService', () => {
  let service: ReportGeneratorService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockReport: Report = {
    id: 'report-123',
    scope_id: 'scope-123',
    title: 'Test Report',
    report_type: 'comprehensive',
    config: {
      includeExecutiveSummary: true,
      includeHeatmap: true,
      includeSubjectDetails: true,
      includeCorrelations: true,
      includeTrends: true,
      includeDimensionAnalysis: true,
    },
    status: 'pending',
    file_path: null,
    file_size: null,
    download_url: null,
    download_expires_at: null,
    error_message: null,
    generated_at: null,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const defaultResult = {
      data: mockReport,
      error: null,
    };

    const chain: Record<string, jest.Mock> = {};
    chain.single = jest.fn().mockResolvedValue(overrides?.single ?? defaultResult);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.delete = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(overrides?.delete ?? { error: null }),
    });
    chain.rpc = jest.fn().mockResolvedValue({ data: [], error: null });

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
        rpc: chain.rpc,
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportGeneratorService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<ReportGeneratorService>(ReportGeneratorService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should create a report request', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'My Report',
        config: {},
      };

      const result = await service.generateReport(input);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should handle comprehensive report type', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Comprehensive Report',
        reportType: 'comprehensive',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should handle executive report type', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Executive Report',
        reportType: 'executive',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should handle detailed report type', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Detailed Report',
        reportType: 'detailed',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should override default config with provided values', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Custom Config Report',
        config: {
          includeExecutiveSummary: false,
          includeCorrelations: false,
        },
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should include createdBy', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Report with Creator',
        config: {},
        createdBy: 'user-456',
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should throw error on creation failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Failing Report',
        config: {},
      };

      await expect(service.generateReport(input)).rejects.toThrow();
    });
  });

  describe('getReport', () => {
    it('should return report by ID', async () => {
      const result = await service.getReport('report-123');
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { code: 'PGRST116', message: 'Not found' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.getReport('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { code: 'OTHER', message: 'DB error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(service.getReport('report-123')).rejects.toThrow('DB error');
    });
  });

  describe('listReports', () => {
    it('should list reports for a scope', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('reports');
      chain.order = jest.fn().mockResolvedValue({
        data: [mockReport],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.listReports('scope-123');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by status', async () => {
      await service.listReports('scope-123', { status: 'completed' });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply limit', async () => {
      await service.listReports('scope-123', { limit: 10 });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('reports');
      chain.order = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(service.listReports('scope-123')).rejects.toThrow('Query failed');
    });
  });

  describe('deleteReport', () => {
    it('should delete a report', async () => {
      await expect(service.deleteReport('report-123')).resolves.not.toThrow();
    });

    it('should handle report with file path', async () => {
      const reportWithFile = {
        ...mockReport,
        file_path: 'reports/scope-123/report-123.pdf',
      };
      const mockClient = createMockClient({
        single: { data: reportWithFile, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(service.deleteReport('report-123')).resolves.not.toThrow();
    });

    it('should handle delete when report not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      // Should not throw even if report not found initially
      await expect(service.deleteReport('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('refreshDownloadUrl', () => {
    it('should return null for pending report', async () => {
      const result = await service.refreshDownloadUrl('report-123');
      expect(result).toBeNull();
    });

    it('should return null for report without file', async () => {
      const completedNoFile = { ...mockReport, status: 'completed', file_path: null };
      const mockClient = createMockClient({
        single: { data: completedNoFile, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.refreshDownloadUrl('report-123');
      expect(result).toBeNull();
    });

    it('should generate new URL for completed report with file', async () => {
      const completedWithFile = {
        ...mockReport,
        status: 'completed',
        file_path: 'reports/scope-123/report-123.pdf',
      };
      const mockClient = createMockClient({
        single: { data: completedWithFile, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.refreshDownloadUrl('report-123');
      expect(result).toContain('https://');
    });

    it('should return null for nonexistent report', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await service.refreshDownloadUrl('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('config building', () => {
    it('should apply comprehensive defaults', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Comprehensive',
        reportType: 'comprehensive',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should apply executive defaults', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Executive',
        reportType: 'executive',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should apply detailed defaults', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Detailed',
        reportType: 'detailed',
        config: {},
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should apply date range from config', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Date Range Report',
        config: {
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31',
          },
        },
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });

    it('should apply subject filter from config', async () => {
      const input: GenerateReportInput = {
        scopeId: 'scope-123',
        title: 'Filtered Report',
        config: {
          subjectFilter: ['subject-1', 'subject-2'],
        },
      };

      const result = await service.generateReport(input);
      expect(result).toBeDefined();
    });
  });

  describe('report statuses', () => {
    const statuses: Array<'pending' | 'generating' | 'completed' | 'failed'> = [
      'pending',
      'generating',
      'completed',
      'failed',
    ];

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const reportWithStatus = { ...mockReport, status };
        const mockClient = createMockClient({
          single: { data: reportWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await service.getReport('report-123');
        expect(result?.status).toBe(status);
      });
    });
  });
});
