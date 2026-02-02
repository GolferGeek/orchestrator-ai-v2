import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioRunRepository } from '../scenario-run.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { ScenarioRun } from '../../interfaces/test-data.interface';

describe('ScenarioRunRepository', () => {
  let repository: ScenarioRunRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockScenarioRun: ScenarioRun = {
    id: 'run-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    status: 'pending',
    started_at: null,
    completed_at: null,
    triggered_by: 'test-user',
    version_info: { version: '1.0.0' },
    outcome_expected: { direction: 'up' },
    outcome_actual: null,
    outcome_match: null,
    error_message: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockCompletedRun: ScenarioRun = {
    ...mockScenarioRun,
    id: 'run-456',
    status: 'completed',
    started_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T01:00:00Z',
    outcome_actual: { direction: 'up', confidence: 0.85 },
    outcome_match: true,
  };

  const mockFailedRun: ScenarioRun = {
    ...mockScenarioRun,
    id: 'run-789',
    status: 'failed',
    started_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:30:00Z',
    error_message: 'Test execution failed',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string; code?: string } | null };
    delete?: { data?: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockScenarioRun, error: null };
    const listResult = overrides?.list ?? { data: [mockScenarioRun], error: null };
    const insertResult = overrides?.insert ?? { data: mockScenarioRun, error: null };
    const updateResult = overrides?.update ?? { data: mockScenarioRun, error: null };
    const deleteResult = overrides?.delete ?? { data: [], error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        not: jest.fn(),
        lt: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.not as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });

      const updateChain: Record<string, unknown> = {
        eq: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
      };
      (updateChain.eq as jest.Mock).mockReturnValue(updateChain);
      (updateChain.select as jest.Mock).mockReturnValue(updateChain);
      (updateChain.single as jest.Mock).mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
      });
      (chainableResult.update as jest.Mock).mockReturnValue(updateChain);

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.select as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioRunRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<ScenarioRunRepository>(ScenarioRunRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return scenario run when found', async () => {
      const result = await repository.findById('run-123');

      expect(result).toEqual(mockScenarioRun);
    });

    it('should return null when scenario run not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('run-123')).rejects.toThrow(
        'Failed to fetch scenario run: Database error',
      );
    });
  });

  describe('findByScenario', () => {
    it('should return runs for scenario', async () => {
      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([mockScenarioRun]);
    });

    it('should return empty array when no runs found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByScenario('scenario-123')).rejects.toThrow(
        'Failed to fetch scenario runs: Query failed',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return runs for organization', async () => {
      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([mockScenarioRun]);
    });

    it('should return empty array when no runs found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByOrganization('test-org')).rejects.toThrow(
        'Failed to fetch scenario runs by organization: Query failed',
      );
    });
  });

  describe('findByStatus', () => {
    it('should return runs with specified status', async () => {
      const result = await repository.findByStatus('test-org', 'pending');

      expect(result).toEqual([mockScenarioRun]);
    });

    it('should return completed runs', async () => {
      const mockClient = createMockClient({
        list: { data: [mockCompletedRun], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('test-org', 'completed');

      expect(result).toEqual([mockCompletedRun]);
    });

    it('should return failed runs', async () => {
      const mockClient = createMockClient({
        list: { data: [mockFailedRun], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('test-org', 'failed');

      expect(result).toEqual([mockFailedRun]);
    });

    it('should return empty array when no runs found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('test-org', 'running');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByStatus('test-org', 'pending')).rejects.toThrow(
        'Failed to fetch scenario runs by status: Query failed',
      );
    });
  });

  describe('findByOutcomeMatch', () => {
    it('should return runs with matching outcomes', async () => {
      const mockClient = createMockClient({
        list: { data: [mockCompletedRun], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByOutcomeMatch('test-org', true);

      expect(result).toEqual([mockCompletedRun]);
    });

    it('should return runs with non-matching outcomes', async () => {
      const nonMatchingRun = { ...mockCompletedRun, outcome_match: false };
      const mockClient = createMockClient({
        list: { data: [nonMatchingRun], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByOutcomeMatch('test-org', false);

      expect(result[0]?.outcome_match).toBe(false);
    });

    it('should return empty array when no runs found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByOutcomeMatch('test-org', true);

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByOutcomeMatch('test-org', true)).rejects.toThrow(
        'Failed to fetch scenario runs by outcome match: Query failed',
      );
    });
  });

  describe('findCompleted', () => {
    it('should return completed runs with outcome_match set', async () => {
      const mockClient = createMockClient({
        list: { data: [mockCompletedRun], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findCompleted('test-org');

      expect(result).toEqual([mockCompletedRun]);
    });

    it('should return empty array when no completed runs', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findCompleted('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findCompleted('test-org')).rejects.toThrow(
        'Failed to fetch completed scenario runs: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create scenario run successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        triggered_by: 'test-user',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockScenarioRun);
    });

    it('should create with all optional fields', async () => {
      const createData = {
        id: 'custom-id',
        organization_slug: 'test-org',
        scenario_id: 'scenario-123',
        triggered_by: 'test-user',
        version_info: { version: '2.0.0' },
        outcome_expected: { direction: 'down', threshold: 0.8 },
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
        }),
      ).rejects.toThrow('Create succeeded but no scenario run returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          scenario_id: 'scenario-123',
        }),
      ).rejects.toThrow('Failed to create scenario run: Insert failed');
    });
  });

  describe('update', () => {
    it('should update scenario run successfully', async () => {
      const result = await repository.update('run-123', { status: 'running' });

      expect(result).toEqual(mockScenarioRun);
    });

    it('should update multiple fields', async () => {
      const result = await repository.update('run-123', {
        status: 'completed',
        completed_at: '2024-01-01T01:00:00Z',
        outcome_actual: { direction: 'up' },
        outcome_match: true,
      });

      expect(result).toBeDefined();
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('run-123', { status: 'running' })).rejects.toThrow(
        'Update succeeded but no scenario run returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('run-123', { status: 'running' })).rejects.toThrow(
        'Failed to update scenario run: Update failed',
      );
    });
  });

  describe('markRunning', () => {
    it('should mark run as running and set started_at', async () => {
      const runningRun = { ...mockScenarioRun, status: 'running' as const, started_at: expect.any(String) };
      const mockClient = createMockClient({
        update: { data: runningRun, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markRunning('run-123');

      expect(result.status).toBe('running');
    });
  });

  describe('markCompleted', () => {
    it('should mark run as completed with outcome', async () => {
      const mockClient = createMockClient({
        update: { data: mockCompletedRun, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markCompleted(
        'run-123',
        { direction: 'up', confidence: 0.85 },
        true,
      );

      expect(result.status).toBe('completed');
      expect(result.outcome_match).toBe(true);
    });

    it('should mark run as completed with non-matching outcome', async () => {
      const nonMatchingRun = { ...mockCompletedRun, outcome_match: false };
      const mockClient = createMockClient({
        update: { data: nonMatchingRun, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markCompleted(
        'run-123',
        { direction: 'down' },
        false,
      );

      expect(result.status).toBe('completed');
      expect(result.outcome_match).toBe(false);
    });
  });

  describe('markFailed', () => {
    it('should mark run as failed with error message', async () => {
      const mockClient = createMockClient({
        update: { data: mockFailedRun, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markFailed('run-123', 'Test execution failed');

      expect(result.status).toBe('failed');
      expect(result.error_message).toBe('Test execution failed');
    });
  });

  describe('delete', () => {
    it('should delete scenario run successfully', async () => {
      await expect(repository.delete('run-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('run-123')).rejects.toThrow(
        'Failed to delete scenario run: Delete failed',
      );
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for scenario with all runs', async () => {
      const runs = [
        { ...mockScenarioRun, status: 'completed' as const, outcome_match: true },
        { ...mockScenarioRun, id: 'run-2', status: 'completed' as const, outcome_match: false },
        { ...mockScenarioRun, id: 'run-3', status: 'failed' as const },
        { ...mockScenarioRun, id: 'run-4', status: 'running' as const },
        { ...mockScenarioRun, id: 'run-5', status: 'pending' as const },
      ];
      const mockClient = createMockClient({
        list: { data: runs, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStatistics('scenario-123');

      expect(result.total_runs).toBe(5);
      expect(result.completed_runs).toBe(2);
      expect(result.failed_runs).toBe(1);
      expect(result.running_runs).toBe(1);
      expect(result.success_rate).toBe(0.4);
      expect(result.outcome_match_rate).toBe(0.5);
    });

    it('should return zero statistics for empty scenario', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStatistics('scenario-123');

      expect(result.total_runs).toBe(0);
      expect(result.completed_runs).toBe(0);
      expect(result.failed_runs).toBe(0);
      expect(result.running_runs).toBe(0);
      expect(result.success_rate).toBe(0);
      expect(result.outcome_match_rate).toBe(0);
    });

    it('should calculate outcome_match_rate correctly when all completed runs match', async () => {
      const runs = [
        { ...mockScenarioRun, status: 'completed' as const, outcome_match: true },
        { ...mockScenarioRun, id: 'run-2', status: 'completed' as const, outcome_match: true },
      ];
      const mockClient = createMockClient({
        list: { data: runs, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStatistics('scenario-123');

      expect(result.outcome_match_rate).toBe(1);
    });

    it('should calculate outcome_match_rate correctly when no completed runs match', async () => {
      const runs = [
        { ...mockScenarioRun, status: 'completed' as const, outcome_match: false },
        { ...mockScenarioRun, id: 'run-2', status: 'completed' as const, outcome_match: false },
      ];
      const mockClient = createMockClient({
        list: { data: runs, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStatistics('scenario-123');

      expect(result.outcome_match_rate).toBe(0);
    });
  });

  describe('status values', () => {
    const statuses = ['pending', 'running', 'completed', 'failed'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const runWithStatus = { ...mockScenarioRun, status };
        const mockClient = createMockClient({
          single: { data: runWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('run-123');

        expect(result?.status).toBe(status);
      });
    });
  });
});
