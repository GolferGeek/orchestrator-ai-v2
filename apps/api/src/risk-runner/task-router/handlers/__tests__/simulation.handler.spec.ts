import { Test, TestingModule } from '@nestjs/testing';
import { SimulationHandler } from '../simulation.handler';
import {
  MonteCarloService,
  type SimulationParameters,
  type Simulation,
  type SimulationResults,
} from '../../../services/monte-carlo.service';
import {
  LiveDataService,
  type DataSource,
  type FetchResult,
  type FetchHistoryRecord,
} from '../../../services/live-data.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';

describe('SimulationHandler', () => {
  let handler: SimulationHandler;
  let monteCarloService: jest.Mocked<MonteCarloService>;
  let liveDataService: jest.Mocked<LiveDataService>;

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

  const mockSimulationResults: SimulationResults = {
    mean: 0.52,
    median: 0.51,
    stdDev: 0.12,
    variance: 0.0144,
    percentile5: 0.32,
    percentile25: 0.44,
    percentile75: 0.60,
    percentile95: 0.72,
    percentile99: 0.81,
    var95: 0.72,
    var99: 0.81,
    cvar95: 0.76,
    cvar99: 0.85,
    skewness: 0.12,
    kurtosis: -0.05,
    distribution: [
      { bin: 0.1, count: 50 },
      { bin: 0.3, count: 250 },
      { bin: 0.5, count: 450 },
      { bin: 0.7, count: 200 },
      { bin: 0.9, count: 50 },
    ],
    executionTimeMs: 1250,
  };

  const mockSimulation: Simulation = {
    id: 'sim-1',
    scopeId: 'scope-1',
    subjectId: null,
    name: 'Test Simulation',
    description: 'A test simulation',
    iterations: 10000,
    parameters: {
      dimensionDistributions: {
        'market-volatility': { distribution: 'normal', mean: 0.5, stdDev: 0.15 },
        'liquidity-risk': { distribution: 'normal', mean: 0.4, stdDev: 0.1 },
      },
    },
    results: mockSimulationResults,
    status: 'completed',
    errorMessage: null,
    startedAt: '2026-01-17T00:00:00Z',
    completedAt: '2026-01-17T00:00:01Z',
    createdAt: '2026-01-17T00:00:00Z',
  };

  const mockDataSource: DataSource = {
    id: 'ds-1',
    scopeId: 'scope-1',
    name: 'Test API Source',
    description: 'A test data source',
    sourceType: 'api',
    config: { endpoint: 'https://api.example.com/data', method: 'GET' },
    schedule: 'hourly',
    dimensionMapping: {
      'market-volatility': { sourceField: 'volatility', transform: 'normalize' },
    },
    subjectFilter: null,
    status: 'active',
    errorMessage: null,
    errorCount: 0,
    lastFetchAt: '2026-01-17T00:00:00Z',
    lastFetchStatus: 'success',
    lastFetchData: { volatility: 0.5 },
    nextFetchAt: '2026-01-17T01:00:00Z',
    autoReanalyze: true,
    reanalyzeThreshold: 0.1,
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-17T00:00:00Z',
  };

  const createPayload = (
    params?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number },
  ): DashboardRequestPayload => ({
    action: 'test-action',
    params: params as DashboardRequestPayload['params'],
    pagination,
  });

  beforeEach(async () => {
    const mockMonteCarloService = {
      runSimulation: jest.fn(),
      getSimulation: jest.fn(),
      listSimulations: jest.fn(),
      deleteSimulation: jest.fn(),
      getDistributionTemplates: jest.fn(),
    };

    const mockLiveDataService = {
      createDataSource: jest.fn(),
      getDataSource: jest.fn(),
      listDataSources: jest.fn(),
      updateDataSource: jest.fn(),
      deleteDataSource: jest.fn(),
      fetchData: jest.fn(),
      getFetchHistory: jest.fn(),
      getHealthSummary: jest.fn(),
      getSourcesDueForFetch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationHandler,
        { provide: MonteCarloService, useValue: mockMonteCarloService },
        { provide: LiveDataService, useValue: mockLiveDataService },
      ],
    }).compile();

    handler = module.get<SimulationHandler>(SimulationHandler);
    monteCarloService = module.get(MonteCarloService);
    liveDataService = module.get(LiveDataService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('run-simulation');
      expect(actions).toContain('get-simulation');
      expect(actions).toContain('list-simulations');
      expect(actions).toContain('delete-simulation');
      expect(actions).toContain('get-distribution-templates');
      expect(actions).toContain('create-source');
      expect(actions).toContain('get-source');
      expect(actions).toContain('list-sources');
      expect(actions).toContain('update-source');
      expect(actions).toContain('delete-source');
      expect(actions).toContain('fetch-source');
      expect(actions).toContain('get-fetch-history');
      expect(actions).toContain('get-health-summary');
      expect(actions).toContain('get-due-sources');
    });
  });

  describe('Monte Carlo Simulation Actions', () => {
    describe('run-simulation', () => {
      it('should run a simulation successfully', async () => {
        monteCarloService.runSimulation.mockResolvedValue(mockSimulation);

        const result = await handler.execute(
          'run-simulation',
          createPayload({
            scopeId: 'scope-1',
            name: 'Test Simulation',
            parameters: {
              dimensionDistributions: {
                'market-volatility': { distribution: 'normal', mean: 0.5, stdDev: 0.15 },
              },
            },
            iterations: 10000,
          }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSimulation);
        expect(monteCarloService.runSimulation).toHaveBeenCalledWith(
          'scope-1',
          'Test Simulation',
          expect.objectContaining({
            dimensionDistributions: expect.any(Object),
          }),
          10000,
          undefined,
          undefined,
        );
      });

      it('should return error when scopeId is missing', async () => {
        const result = await handler.execute(
          'run-simulation',
          createPayload({
            name: 'Test Simulation',
            parameters: { dimensionDistributions: {} },
          }),
          mockExecutionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAM');
        expect(result.error?.message).toContain('scopeId');
      });

      it('should return error when name is missing', async () => {
        const result = await handler.execute(
          'run-simulation',
          createPayload({
            scopeId: 'scope-1',
            parameters: { dimensionDistributions: {} },
          }),
          mockExecutionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAM');
        expect(result.error?.message).toContain('name');
      });
    });

    describe('get-simulation', () => {
      it('should get a simulation by ID', async () => {
        monteCarloService.getSimulation.mockResolvedValue(mockSimulation);

        const result = await handler.execute(
          'get-simulation',
          createPayload({ simulationId: 'sim-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSimulation);
        expect(monteCarloService.getSimulation).toHaveBeenCalledWith('sim-1');
      });

      it('should return error when simulation not found', async () => {
        monteCarloService.getSimulation.mockResolvedValue(null);

        const result = await handler.execute(
          'get-simulation',
          createPayload({ simulationId: 'nonexistent' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NOT_FOUND');
      });
    });

    describe('list-simulations', () => {
      it('should list simulations for a scope', async () => {
        monteCarloService.listSimulations.mockResolvedValue([mockSimulation]);

        const result = await handler.execute(
          'list-simulations',
          createPayload({ scopeId: 'scope-1', limit: 10 }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual([mockSimulation]);
        expect(result.metadata?.count).toBe(1);
      });
    });

    describe('delete-simulation', () => {
      it('should delete a simulation', async () => {
        monteCarloService.deleteSimulation.mockResolvedValue(undefined);

        const result = await handler.execute(
          'delete-simulation',
          createPayload({ simulationId: 'sim-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ deleted: true });
        expect(monteCarloService.deleteSimulation).toHaveBeenCalledWith('sim-1');
      });
    });

    describe('get-distribution-templates', () => {
      it('should return distribution templates', async () => {
        const templates = {
          'normal-low': { distribution: 'normal', mean: 0.3, stdDev: 0.1 },
          'normal-medium': { distribution: 'normal', mean: 0.5, stdDev: 0.15 },
        };
        monteCarloService.getDistributionTemplates.mockReturnValue(templates as any);

        const result = await handler.execute(
          'get-distribution-templates',
          createPayload({}),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(templates);
      });
    });
  });

  describe('Data Source Actions', () => {
    describe('create-source', () => {
      it('should create a data source', async () => {
        liveDataService.createDataSource.mockResolvedValue(mockDataSource);

        const result = await handler.execute(
          'create-source',
          createPayload({
            scopeId: 'scope-1',
            name: 'Test API Source',
            sourceType: 'api',
            config: { endpoint: 'https://api.example.com/data', method: 'GET' },
          }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockDataSource);
        expect(liveDataService.createDataSource).toHaveBeenCalledWith(
          expect.objectContaining({
            scopeId: 'scope-1',
            name: 'Test API Source',
            sourceType: 'api',
          }),
        );
      });

      it('should return error when required params are missing', async () => {
        const result = await handler.execute(
          'create-source',
          createPayload({ name: 'Test' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAM');
      });
    });

    describe('get-source', () => {
      it('should get a data source by ID', async () => {
        liveDataService.getDataSource.mockResolvedValue(mockDataSource);

        const result = await handler.execute(
          'get-source',
          createPayload({ dataSourceId: 'ds-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockDataSource);
      });

      it('should return error when data source not found', async () => {
        liveDataService.getDataSource.mockResolvedValue(null);

        const result = await handler.execute(
          'get-source',
          createPayload({ dataSourceId: 'nonexistent' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NOT_FOUND');
      });
    });

    describe('list-sources', () => {
      it('should list data sources for a scope', async () => {
        liveDataService.listDataSources.mockResolvedValue([mockDataSource]);

        const result = await handler.execute(
          'list-sources',
          createPayload({ scopeId: 'scope-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual([mockDataSource]);
        expect(result.metadata?.count).toBe(1);
      });
    });

    describe('update-source', () => {
      it('should update a data source', async () => {
        const updatedSource = { ...mockDataSource, name: 'Updated Name' };
        liveDataService.updateDataSource.mockResolvedValue(updatedSource);

        const result = await handler.execute(
          'update-source',
          createPayload({ dataSourceId: 'ds-1', name: 'Updated Name' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect((result.data as DataSource)?.name).toBe('Updated Name');
      });
    });

    describe('delete-source', () => {
      it('should delete a data source', async () => {
        liveDataService.deleteDataSource.mockResolvedValue(undefined);

        const result = await handler.execute(
          'delete-source',
          createPayload({ dataSourceId: 'ds-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ deleted: true });
      });
    });

    describe('fetch-source', () => {
      it('should fetch data from a source', async () => {
        const fetchResult: FetchResult = {
          success: true,
          data: { volatility: 0.55 },
          durationMs: 250,
          dimensionsUpdated: ['market-volatility'],
          reanalysisTriggered: true,
        };
        liveDataService.fetchData.mockResolvedValue(fetchResult);

        const result = await handler.execute(
          'fetch-source',
          createPayload({ dataSourceId: 'ds-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(fetchResult);
      });
    });

    describe('get-fetch-history', () => {
      it('should get fetch history for a data source', async () => {
        const history: FetchHistoryRecord[] = [
          {
            id: 'fh-1',
            dataSourceId: 'ds-1',
            status: 'success',
            fetchDurationMs: 250,
            rawResponse: {},
            parsedData: {},
            errorMessage: null,
            dimensionsUpdated: ['market-volatility'],
            subjectsAffected: [],
            reanalysisTriggered: false,
            reanalysisTaskIds: [],
            fetchedAt: '2026-01-17T00:00:00Z',
          },
        ];
        liveDataService.getFetchHistory.mockResolvedValue(history);

        const result = await handler.execute(
          'get-fetch-history',
          createPayload({ dataSourceId: 'ds-1', limit: 10 }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(history);
        expect(result.metadata?.count).toBe(1);
      });
    });

    describe('get-health-summary', () => {
      it('should get health summary for a scope', async () => {
        const summary = {
          total: 5,
          active: 3,
          paused: 1,
          error: 1,
          disabled: 0,
          lastFetchSuccess: 3,
          lastFetchFailed: 1,
        };
        liveDataService.getHealthSummary.mockResolvedValue(summary);

        const result = await handler.execute(
          'get-health-summary',
          createPayload({ scopeId: 'scope-1' }),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(summary);
      });
    });

    describe('get-due-sources', () => {
      it('should get data sources due for fetching', async () => {
        liveDataService.getSourcesDueForFetch.mockResolvedValue([mockDataSource]);

        const result = await handler.execute(
          'get-due-sources',
          createPayload({}),
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual([mockDataSource]);
        expect(result.metadata?.count).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return error for unsupported action', async () => {
      const result = await handler.execute(
        'unknown-action',
        createPayload({}),
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
    });

    it('should handle service errors gracefully', async () => {
      monteCarloService.runSimulation.mockRejectedValue(new Error('Database error'));

      const result = await handler.execute(
        'run-simulation',
        createPayload({
          scopeId: 'scope-1',
          name: 'Test',
          parameters: { dimensionDistributions: {} },
        }),
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HANDLER_ERROR');
      expect(result.error?.message).toContain('Database error');
    });
  });
});
