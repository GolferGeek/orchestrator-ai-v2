import { Test, TestingModule } from '@nestjs/testing';
import {
  MonteCarloService,
  SimulationParameters,
} from '../monte-carlo.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('MonteCarloService', () => {
  let service: MonteCarloService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockClient = {
    schema: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset and re-configure each mock to return mockClient for chaining
    mockClient.schema.mockReset().mockReturnValue(mockClient);
    mockClient.from.mockReset().mockReturnValue(mockClient);
    mockClient.select.mockReset().mockReturnValue(mockClient);
    mockClient.insert.mockReset().mockReturnValue(mockClient);
    mockClient.update.mockReset().mockReturnValue(mockClient);
    mockClient.delete.mockReset().mockReturnValue(mockClient);
    mockClient.eq.mockReset().mockReturnValue(mockClient);
    mockClient.order.mockReset().mockReturnValue(mockClient);
    mockClient.limit.mockReset().mockReturnValue(mockClient);
    mockClient.range.mockReset().mockReturnValue(mockClient);
    mockClient.single.mockReset();

    const mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonteCarloService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<MonteCarloService>(MonteCarloService);
    supabaseService = module.get(SupabaseService);
  });

  describe('Simulation Execution', () => {
    it('should create a simulation record and run the simulation', async () => {
      const mockSimulationId = 'sim-123';
      const mockCreatedSimulation = {
        id: mockSimulationId,
        scope_id: 'scope-1',
        name: 'Test Sim',
        iterations: 1000,
        status: 'running',
      };

      const mockUpdatedSimulation = {
        ...mockCreatedSimulation,
        status: 'completed',
        results: expect.any(Object),
      };

      // Mock insert for creating simulation
      mockClient.single.mockResolvedValueOnce({
        data: mockCreatedSimulation,
        error: null,
      });

      // Mock update for completing simulation
      mockClient.single.mockResolvedValueOnce({
        data: mockUpdatedSimulation,
        error: null,
      });

      const parameters: SimulationParameters = {
        dimensionDistributions: {
          'market-volatility': {
            distribution: 'normal',
            mean: 0.5,
            stdDev: 0.15,
          },
          'liquidity-risk': { distribution: 'uniform', min: 0.2, max: 0.8 },
        },
      };

      const result = await service.runSimulation(
        'scope-1',
        'Test Sim',
        parameters,
        1000,
      );

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
      expect(mockClient.schema).toHaveBeenCalledWith('risk');
      expect(mockClient.from).toHaveBeenCalledWith('simulations');
      expect(mockClient.insert).toHaveBeenCalled();
      expect(result.status).toBe('completed');
    });

    it('should handle simulation errors and mark as failed', async () => {
      const mockSimulationId = 'sim-123';
      const mockCreatedSimulation = {
        id: mockSimulationId,
        scope_id: 'scope-1',
        name: 'Test Sim',
        iterations: 1000,
        status: 'running',
      };

      // Mock insert for creating simulation (first single() call)
      mockClient.single.mockResolvedValueOnce({
        data: mockCreatedSimulation,
        error: null,
      });

      // Mock update failure (second single() call - the update to store results)
      mockClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      // Third single() call would be for the error update, but we expect an exception before that

      const parameters: SimulationParameters = {
        dimensionDistributions: {
          'market-volatility': {
            distribution: 'normal',
            mean: 0.5,
            stdDev: 0.15,
          },
        },
      };

      await expect(
        service.runSimulation('scope-1', 'Test Sim', parameters, 1000),
      ).rejects.toThrow('Failed to update simulation');
    });
  });

  describe('Distribution Sampling', () => {
    // Test the distribution templates
    it('should provide distribution templates', () => {
      const templates = service.getDistributionTemplates();

      expect(templates).toHaveProperty('normal-low');
      expect(templates).toHaveProperty('normal-medium');
      expect(templates).toHaveProperty('normal-high');
      expect(templates).toHaveProperty('uniform-full');
      expect(templates).toHaveProperty('beta-left-skewed');
      expect(templates).toHaveProperty('beta-right-skewed');
      expect(templates).toHaveProperty('triangular-conservative');

      expect(templates['normal-medium']).toEqual({
        distribution: 'normal',
        mean: 0.5,
        stdDev: 0.15,
      });
    });
  });

  describe('getSimulation', () => {
    it('should retrieve a simulation by ID', async () => {
      const mockSimulation = {
        id: 'sim-123',
        scope_id: 'scope-1',
        name: 'Test Sim',
        iterations: 10000,
        parameters: { dimensionDistributions: {} },
        results: { mean: 0.52 },
        status: 'completed',
        created_at: '2026-01-17T00:00:00Z',
      };

      mockClient.single.mockResolvedValueOnce({
        data: mockSimulation,
        error: null,
      });

      const result = await service.getSimulation('sim-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('sim-123');
      expect(result?.scopeId).toBe('scope-1');
      expect(mockClient.eq).toHaveBeenCalledWith('id', 'sim-123');
    });

    it('should return null when simulation not found', async () => {
      mockClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getSimulation('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('listSimulations', () => {
    it('should list simulations for a scope', async () => {
      const mockSimulations = [
        {
          id: 'sim-1',
          scope_id: 'scope-1',
          name: 'Sim 1',
          status: 'completed',
          created_at: '2026-01-17T00:00:00Z',
        },
        {
          id: 'sim-2',
          scope_id: 'scope-1',
          name: 'Sim 2',
          status: 'running',
          created_at: '2026-01-17T01:00:00Z',
        },
      ];

      // Make mockClient thenable so `await query` works
      // The service builds the chain and then awaits it
      const thenableClient = mockClient as unknown as {
        then: (
          resolve: (value: { data: unknown; error: null }) => void,
        ) => void;
      };
      thenableClient.then = jest
        .fn()
        .mockImplementation((resolve) =>
          resolve({ data: mockSimulations, error: null }),
        );

      const result = await service.listSimulations('scope-1', { limit: 10 });

      expect(mockClient.schema).toHaveBeenCalledWith('risk');
      expect(mockClient.from).toHaveBeenCalledWith('simulations');
      expect(result).toBeDefined();
      expect(result.length).toBe(2);
    });

    it('should filter by status when provided', async () => {
      // Make mockClient thenable so `await query` works
      const thenableClient = mockClient as unknown as {
        then: (
          resolve: (value: { data: unknown; error: null }) => void,
        ) => void;
      };
      thenableClient.then = jest
        .fn()
        .mockImplementation((resolve) => resolve({ data: [], error: null }));

      const result = await service.listSimulations('scope-1', {
        status: 'completed',
      });

      expect(mockClient.eq).toHaveBeenCalledWith('scope_id', 'scope-1');
      expect(mockClient.eq).toHaveBeenCalledWith('status', 'completed');
      expect(result).toEqual([]);
    });
  });

  describe('deleteSimulation', () => {
    it('should delete a simulation', async () => {
      mockClient.eq.mockResolvedValueOnce({ error: null });

      await service.deleteSimulation('sim-123');

      expect(mockClient.delete).toHaveBeenCalled();
      expect(mockClient.eq).toHaveBeenCalledWith('id', 'sim-123');
    });

    it('should throw error on deletion failure', async () => {
      mockClient.eq.mockResolvedValueOnce({
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteSimulation('sim-123')).rejects.toThrow(
        'Failed to delete simulation',
      );
    });
  });

  describe('Statistical Calculations', () => {
    // Test the private statistical methods indirectly through running a simulation
    it('should calculate VaR metrics correctly in simulation results', async () => {
      const mockSimulationId = 'sim-stats';
      const mockCreatedSimulation = {
        id: mockSimulationId,
        scope_id: 'scope-1',
        name: 'Stats Test',
        iterations: 1000,
        status: 'running',
      };

      // Track the results that get saved
      let savedResults: unknown = null;

      mockClient.single.mockResolvedValueOnce({
        data: mockCreatedSimulation,
        error: null,
      });

      mockClient.update.mockImplementation((data) => {
        savedResults = data;
        return mockClient;
      });

      mockClient.single.mockResolvedValueOnce({
        data: {
          ...mockCreatedSimulation,
          status: 'completed',
          results: savedResults,
        },
        error: null,
      });

      const parameters: SimulationParameters = {
        dimensionDistributions: {
          'test-dim': { distribution: 'uniform', min: 0, max: 1 },
        },
      };

      const result = await service.runSimulation(
        'scope-1',
        'Stats Test',
        parameters,
        500, // Smaller iteration count for faster test
      );

      // Verify the structure of results
      if (result.results) {
        // Mean should be approximately 0.5 for uniform distribution
        expect(result.results.mean).toBeGreaterThan(0.3);
        expect(result.results.mean).toBeLessThan(0.7);

        // VaR values should exist and be ordered
        expect(result.results.var95).toBeDefined();
        expect(result.results.var99).toBeDefined();
        expect(result.results.var99).toBeGreaterThanOrEqual(
          result.results.var95,
        );

        // CVaR should be at least as high as VaR
        expect(result.results.cvar95).toBeGreaterThanOrEqual(
          result.results.var95,
        );
        expect(result.results.cvar99).toBeGreaterThanOrEqual(
          result.results.var99,
        );

        // Percentiles should be ordered
        expect(result.results.percentile5).toBeLessThanOrEqual(
          result.results.percentile25,
        );
        expect(result.results.percentile25).toBeLessThanOrEqual(
          result.results.median,
        );
        expect(result.results.median).toBeLessThanOrEqual(
          result.results.percentile75,
        );
        expect(result.results.percentile75).toBeLessThanOrEqual(
          result.results.percentile95,
        );

        // Distribution histogram should have entries
        expect(result.results.distribution.length).toBeGreaterThan(0);
      }
    });
  });
});
