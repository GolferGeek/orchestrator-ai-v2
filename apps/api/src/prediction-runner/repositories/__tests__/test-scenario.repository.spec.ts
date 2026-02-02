import { Test, TestingModule } from '@nestjs/testing';
import { TestScenarioRepository } from '../test-scenario.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { TestScenario, TestScenarioSummary } from '../../interfaces/test-data.interface';

describe('TestScenarioRepository', () => {
  let repository: TestScenarioRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockTestScenario: TestScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    description: 'A test scenario for testing',
    injection_points: ['signals', 'predictors'],
    target_id: 'target-123',
    organization_slug: 'test-org',
    config: {
      auto_run_tiers: true,
      tiers_to_run: ['tier1', 'tier2'],
    },
    created_by: 'user-123',
    status: 'active',
    results: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  const mockTestScenarioSummary: TestScenarioSummary = {
    ...mockTestScenario,
    data_counts: {
      signals: 10,
      predictors: 5,
    },
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
    rpc?: { data: unknown | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockTestScenario, error: null };
    const listResult = overrides?.list ?? { data: [mockTestScenario], error: null };
    const insertResult = overrides?.insert ?? { data: mockTestScenario, error: null };
    const updateResult = overrides?.update ?? { data: mockTestScenario, error: null };
    const deleteResult = overrides?.delete ?? { error: null };
    const rpcResult = overrides?.rpc ?? {
      data: [{ table_name: 'signals', rows_deleted: 5 }],
      error: null,
    };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
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
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
        rpc: jest.fn().mockImplementation(() => ({
          then: (resolve: (v: unknown) => void) => resolve(rpcResult),
          ...rpcResult,
        })),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestScenarioRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TestScenarioRepository>(TestScenarioRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return scenario when found', async () => {
      const result = await repository.findById('scenario-123');

      expect(result).toEqual(mockTestScenario);
    });

    it('should return null when scenario not found', async () => {
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

      await expect(repository.findById('scenario-123')).rejects.toThrow(
        'Failed to fetch test scenario: Database error',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return scenarios for organization', async () => {
      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([mockTestScenario]);
    });

    it('should return empty array when no scenarios found', async () => {
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
        'Failed to fetch test scenarios: Query failed',
      );
    });
  });

  describe('findActiveByOrganization', () => {
    it('should return active scenarios for organization', async () => {
      const result = await repository.findActiveByOrganization('test-org');

      expect(result).toEqual([mockTestScenario]);
    });

    it('should return empty array when no active scenarios', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveByOrganization('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findActiveByOrganization('test-org')).rejects.toThrow(
        'Failed to fetch active test scenarios: Query failed',
      );
    });
  });

  describe('findByTarget', () => {
    it('should return scenarios for target', async () => {
      const result = await repository.findByTarget('target-123');

      expect(result).toEqual([mockTestScenario]);
    });

    it('should return empty array when no scenarios found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByTarget('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByTarget('target-123')).rejects.toThrow(
        'Failed to fetch test scenarios by target: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create scenario successfully', async () => {
      const createData = {
        name: 'New Scenario',
        injection_points: ['signals'] as ('signals' | 'predictors')[],
        organization_slug: 'test-org',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockTestScenario);
    });

    it('should create scenario with optional fields', async () => {
      const createData = {
        name: 'Full Scenario',
        description: 'A comprehensive test scenario',
        injection_points: ['signals', 'predictors', 'predictions'] as (
          | 'signals'
          | 'predictors'
          | 'predictions'
        )[],
        target_id: 'target-123',
        organization_slug: 'test-org',
        config: {
          auto_run_tiers: true,
          tiers_to_run: ['tier1'],
        },
        created_by: 'user-123',
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
          name: 'Test',
          injection_points: ['signals'] as ('signals')[],
          organization_slug: 'test-org',
        }),
      ).rejects.toThrow('Create succeeded but no test scenario returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          name: 'Test',
          injection_points: ['signals'] as ('signals')[],
          organization_slug: 'test-org',
        }),
      ).rejects.toThrow('Failed to create test scenario: Insert failed');
    });
  });

  describe('update', () => {
    it('should update scenario successfully', async () => {
      const result = await repository.update('scenario-123', { name: 'Updated Name' });

      expect(result).toEqual(mockTestScenario);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('scenario-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no test scenario returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('scenario-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update test scenario: Update failed',
      );
    });
  });

  describe('markRunning', () => {
    it('should mark scenario as running', async () => {
      const result = await repository.markRunning('scenario-123');

      expect(result).toBeDefined();
    });
  });

  describe('markCompleted', () => {
    it('should mark scenario as completed with results', async () => {
      const results = {
        items_injected: { signals: 10 },
        items_generated: { predictors: 5 },
      };

      const result = await repository.markCompleted('scenario-123', results);

      expect(result).toBeDefined();
    });

    it('should mark scenario as completed without results', async () => {
      const result = await repository.markCompleted('scenario-123', null);

      expect(result).toBeDefined();
    });
  });

  describe('markFailed', () => {
    it('should mark scenario as failed with error message', async () => {
      const result = await repository.markFailed('scenario-123', 'Processing error');

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete scenario successfully', async () => {
      await expect(repository.delete('scenario-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('scenario-123')).rejects.toThrow(
        'Failed to delete test scenario: Delete failed',
      );
    });
  });

  describe('cleanupScenario', () => {
    it('should cleanup scenario data', async () => {
      const result = await repository.cleanupScenario('scenario-123');

      expect(result.tables_cleaned).toBeDefined();
      expect(result.total_deleted).toBeGreaterThanOrEqual(0);
    });

    it('should throw error on cleanup failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'Cleanup failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.cleanupScenario('scenario-123')).rejects.toThrow(
        'Failed to cleanup test scenario: Cleanup failed',
      );
    });
  });

  describe('cleanupAllTestData', () => {
    it('should cleanup all test data', async () => {
      const result = await repository.cleanupAllTestData();

      expect(result.tables_cleaned).toBeDefined();
      expect(result.total_deleted).toBeGreaterThanOrEqual(0);
    });

    it('should throw error on cleanup failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'Cleanup failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.cleanupAllTestData()).rejects.toThrow(
        'Failed to cleanup all test data: Cleanup failed',
      );
    });
  });

  describe('getSummaries', () => {
    it('should return scenario summaries', async () => {
      const mockClient = createMockClient({
        list: { data: [mockTestScenarioSummary], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSummaries('test-org');

      expect(result).toEqual([mockTestScenarioSummary]);
    });

    it('should return empty array when no summaries', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSummaries('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getSummaries('test-org')).rejects.toThrow(
        'Failed to fetch test scenario summaries: Query failed',
      );
    });
  });

  describe('scenario statuses', () => {
    const statuses = ['active', 'running', 'completed', 'failed', 'archived'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const scenarioWithStatus = { ...mockTestScenario, status };
        const mockClient = createMockClient({
          single: { data: scenarioWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('scenario-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('injection points', () => {
    const injectionPoints = [
      'signals',
      'predictors',
      'predictions',
      'targets',
      'universes',
      'sources',
    ] as const;

    it('should handle multiple injection points', async () => {
      const scenarioWithPoints = {
        ...mockTestScenario,
        injection_points: injectionPoints as unknown as TestScenario['injection_points'],
      };
      const mockClient = createMockClient({
        single: { data: scenarioWithPoints, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('scenario-123');

      expect(result?.injection_points.length).toBe(injectionPoints.length);
    });
  });
});
