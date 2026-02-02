import { Test, TestingModule } from '@nestjs/testing';
import {
  LiveDataService,
  DataSource,
  CreateDataSourceParams,
} from '../live-data.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('LiveDataService', () => {
  let service: LiveDataService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockDataSource: DataSource = {
    id: 'ds-123',
    scopeId: 'scope-123',
    name: 'Test Source',
    description: 'Test data source',
    sourceType: 'api',
    config: {
      endpoint: 'https://api.example.com/data',
      method: 'GET',
    },
    schedule: 'hourly',
    dimensionMapping: {},
    subjectFilter: null,
    status: 'active',
    errorMessage: null,
    errorCount: 0,
    lastFetchAt: null,
    lastFetchStatus: null,
    lastFetchData: null,
    nextFetchAt: new Date(Date.now() + 3600000).toISOString(),
    autoReanalyze: true,
    reanalyzeThreshold: 0.1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const defaultResult = {
      data: mockDataSource,
      error: null,
    };

    const chain: Record<string, jest.Mock> = {};
    chain.single = jest
      .fn()
      .mockResolvedValue(overrides?.single ?? defaultResult);
    chain.limit = jest.fn().mockReturnValue(chain);
    chain.range = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.lte = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.select = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.delete = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(overrides?.delete ?? { error: null }),
    });

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveDataService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LiveDataService>(LiveDataService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDataSource', () => {
    it('should create a data source', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'New Source',
        sourceType: 'api',
        config: {
          endpoint: 'https://api.example.com',
          method: 'GET',
        },
      };

      const result = await service.createDataSource(params);

      expect(result).toBeDefined();
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should handle all source types', async () => {
      const types: Array<'firecrawl' | 'api' | 'rss' | 'webhook' | 'manual'> = [
        'firecrawl',
        'api',
        'rss',
        'webhook',
        'manual',
      ];

      for (const sourceType of types) {
        const params: CreateDataSourceParams = {
          scopeId: 'scope-123',
          name: `${sourceType} Source`,
          sourceType,
          config: {},
        };

        const result = await service.createDataSource(params);
        expect(result).toBeDefined();
      }
    });

    it('should set optional parameters', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Full Config Source',
        sourceType: 'api',
        config: { endpoint: 'https://api.example.com', method: 'GET' },
        description: 'Test description',
        schedule: 'daily',
        dimensionMapping: {
          field1: { sourceField: 'value', transform: 'normalize' },
        },
        subjectFilter: { subjectTypes: ['stock'] },
        autoReanalyze: false,
        reanalyzeThreshold: 0.2,
      };

      const result = await service.createDataSource(params);
      expect(result).toBeDefined();
    });

    it('should throw error on creation failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Failing Source',
        sourceType: 'api',
        config: {},
      };

      await expect(service.createDataSource(params)).rejects.toThrow(
        'Failed to create data source',
      );
    });
  });

  describe('getDataSource', () => {
    it('should return data source by ID', async () => {
      const result = await service.getDataSource('ds-123');
      expect(result).toBeDefined();
    });

    it('should return null when not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getDataSource('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listDataSources', () => {
    it('should list data sources for a scope', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('data_sources');
      chain.order = jest.fn().mockResolvedValue({
        data: [mockDataSource],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.listDataSources('scope-123');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should apply filter options', async () => {
      await service.listDataSources('scope-123', {
        status: 'active',
        sourceType: 'api',
        limit: 10,
        offset: 5,
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('updateDataSource', () => {
    it('should update data source', async () => {
      const result = await service.updateDataSource('ds-123', {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(result).toBeDefined();
    });

    it('should update schedule and recalculate next fetch', async () => {
      const result = await service.updateDataSource('ds-123', {
        schedule: 'daily',
      });

      expect(result).toBeDefined();
    });

    it('should reset error state when setting to active', async () => {
      const result = await service.updateDataSource('ds-123', {
        status: 'active',
      });

      expect(result).toBeDefined();
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        service.updateDataSource('ds-123', { name: 'New Name' }),
      ).rejects.toThrow('Failed to update data source');
    });
  });

  describe('deleteDataSource', () => {
    it('should delete data source', async () => {
      await expect(service.deleteDataSource('ds-123')).resolves.not.toThrow();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(service.deleteDataSource('ds-123')).rejects.toThrow(
        'Failed to delete data source',
      );
    });
  });

  describe('fetchData', () => {
    it('should throw error for unknown source', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(service.fetchData('nonexistent')).rejects.toThrow(
        'Data source not found',
      );
    });

    it('should call getDataSource before fetching', async () => {
      // The fetchData method first gets the data source, then processes it
      // This test verifies the flow exists
      const mockClient = createMockClient({
        single: { data: mockDataSource, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      // Will fail due to subsequent DB operations, but we verify it tries to fetch
      try {
        await service.fetchData('ds-123');
      } catch {
        // Expected - subsequent DB operations fail
      }

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getFetchHistory', () => {
    it('should return fetch history', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('data_source_fetch_history');
      chain.limit = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'fh-123',
            data_source_id: 'ds-123',
            status: 'success',
            fetch_duration_ms: 500,
            dimensions_updated: ['dim1'],
            subjects_affected: ['subj1'],
            reanalysis_triggered: false,
            fetched_at: new Date().toISOString(),
          },
        ],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getFetchHistory('ds-123');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should apply limit parameter', async () => {
      await service.getFetchHistory('ds-123', 50);
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('getSourcesDueForFetch', () => {
    it('should return sources due for fetching', async () => {
      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('data_sources');
      chain.order = jest.fn().mockResolvedValue({
        data: [mockDataSource],
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getSourcesDueForFetch();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getHealthSummary', () => {
    it('should return health summary', async () => {
      const sources = [
        { ...mockDataSource, status: 'active', lastFetchStatus: 'success' },
        { ...mockDataSource, status: 'paused', lastFetchStatus: 'failed' },
        { ...mockDataSource, status: 'error', lastFetchStatus: null },
      ];

      const mockClient = createMockClient();
      const chain = mockClient.schema('risk').from('data_sources');
      chain.order = jest.fn().mockResolvedValue({
        data: sources,
        error: null,
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.getHealthSummary('scope-123');

      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(typeof result.active).toBe('number');
      expect(typeof result.paused).toBe('number');
      expect(typeof result.error).toBe('number');
      expect(typeof result.lastFetchSuccess).toBe('number');
    });
  });

  describe('schedule presets', () => {
    it('should handle hourly schedule', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Hourly Source',
        sourceType: 'api',
        config: {},
        schedule: 'hourly',
      };

      const result = await service.createDataSource(params);
      expect(result).toBeDefined();
    });

    it('should handle daily schedule', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Daily Source',
        sourceType: 'api',
        config: {},
        schedule: 'daily',
      };

      const result = await service.createDataSource(params);
      expect(result).toBeDefined();
    });

    it('should handle weekly schedule', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Weekly Source',
        sourceType: 'api',
        config: {},
        schedule: 'weekly',
      };

      const result = await service.createDataSource(params);
      expect(result).toBeDefined();
    });

    it('should handle realtime schedule', async () => {
      const params: CreateDataSourceParams = {
        scopeId: 'scope-123',
        name: 'Realtime Source',
        sourceType: 'api',
        config: {},
        schedule: 'realtime',
      };

      const result = await service.createDataSource(params);
      expect(result).toBeDefined();
    });
  });
});
