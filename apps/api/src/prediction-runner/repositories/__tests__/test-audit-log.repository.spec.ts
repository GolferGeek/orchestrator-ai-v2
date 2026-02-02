import { Test, TestingModule } from '@nestjs/testing';
import { TestAuditLogRepository } from '../test-audit-log.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { TestAuditLogEntry } from '../../interfaces/test-data.interface';

describe('TestAuditLogRepository', () => {
  let repository: TestAuditLogRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockAuditEntry: TestAuditLogEntry = {
    id: 'audit-123',
    organization_slug: 'test-org',
    user_id: 'user-123',
    action: 'scenario_created',
    resource_type: 'test_scenario',
    resource_id: 'scenario-123',
    details: { name: 'Test Scenario', target_id: 'target-123' },
    created_at: '2024-01-01T10:00:00Z',
  };

  const mockOtherEntry: TestAuditLogEntry = {
    ...mockAuditEntry,
    id: 'audit-456',
    action: 'scenario_updated',
    details: { field: 'name', old_value: 'Old Name', new_value: 'New Name' },
    created_at: '2024-01-01T11:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockAuditEntry,
      error: null,
    };
    const listResult = overrides?.list ?? {
      data: [mockAuditEntry],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockAuditEntry,
      error: null,
    };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
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
        TestAuditLogRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TestAuditLogRepository>(TestAuditLogRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create audit log entry successfully', async () => {
      const logData = {
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_created',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
      };

      const result = await repository.log(logData);

      expect(result).toEqual(mockAuditEntry);
    });

    it('should create with details', async () => {
      const logData = {
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_created',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: { name: 'Test Scenario' },
      };

      const result = await repository.log(logData);

      expect(result).toBeDefined();
    });

    it('should throw error when log returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.log({
          organization_slug: 'test-org',
          user_id: 'user-123',
          action: 'scenario_created',
          resource_type: 'test_scenario',
          resource_id: 'scenario-123',
        }),
      ).rejects.toThrow('Log succeeded but no audit entry returned');
    });

    it('should throw error on log failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.log({
          organization_slug: 'test-org',
          user_id: 'user-123',
          action: 'scenario_created',
          resource_type: 'test_scenario',
          resource_id: 'scenario-123',
        }),
      ).rejects.toThrow('Failed to create audit log entry: Insert failed');
    });
  });

  describe('findByResource', () => {
    it('should return entries for resource', async () => {
      const result = await repository.findByResource(
        'test_scenario',
        'scenario-123',
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply action filter', async () => {
      const result = await repository.findByResource(
        'test_scenario',
        'scenario-123',
        {
          action: 'scenario_created',
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply user_id filter', async () => {
      const result = await repository.findByResource(
        'test_scenario',
        'scenario-123',
        {
          user_id: 'user-123',
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply date range filters', async () => {
      const result = await repository.findByResource(
        'test_scenario',
        'scenario-123',
        {
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-02T00:00:00Z',
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply limit filter', async () => {
      const result = await repository.findByResource(
        'test_scenario',
        'scenario-123',
        {
          limit: 10,
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return empty array when no entries found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByResource(
        'test_scenario',
        'nonexistent',
      );

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByResource('test_scenario', 'scenario-123'),
      ).rejects.toThrow(
        'Failed to fetch audit log entries by resource: Query failed',
      );
    });
  });

  describe('findByUser', () => {
    it('should return entries for user', async () => {
      const result = await repository.findByUser('user-123', 'test-org');

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply action filter', async () => {
      const result = await repository.findByUser('user-123', 'test-org', {
        action: 'scenario_created',
      });

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply resource filters', async () => {
      const result = await repository.findByUser('user-123', 'test-org', {
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
      });

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply date range and limit filters', async () => {
      const result = await repository.findByUser('user-123', 'test-org', {
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-02T00:00:00Z',
        limit: 50,
      });

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return empty array when no entries found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByUser('user-456', 'test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByUser('user-123', 'test-org'),
      ).rejects.toThrow(
        'Failed to fetch audit log entries by user: Query failed',
      );
    });
  });

  describe('findByAction', () => {
    it('should return entries for action', async () => {
      const result = await repository.findByAction(
        'scenario_created',
        'test-org',
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply resource filters', async () => {
      const result = await repository.findByAction(
        'scenario_created',
        'test-org',
        {
          resource_type: 'test_scenario',
          resource_id: 'scenario-123',
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply user_id filter', async () => {
      const result = await repository.findByAction(
        'scenario_created',
        'test-org',
        {
          user_id: 'user-123',
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply all filters', async () => {
      const result = await repository.findByAction(
        'scenario_created',
        'test-org',
        {
          resource_type: 'test_scenario',
          resource_id: 'scenario-123',
          user_id: 'user-123',
          start_date: '2024-01-01T00:00:00Z',
          end_date: '2024-01-02T00:00:00Z',
          limit: 20,
        },
      );

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return empty array when no entries found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByAction(
        'nonexistent_action',
        'test-org',
      );

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByAction('scenario_created', 'test-org'),
      ).rejects.toThrow(
        'Failed to fetch audit log entries by action: Query failed',
      );
    });
  });

  describe('getAuditTrail', () => {
    it('should return complete audit trail for resource', async () => {
      const mockClient = createMockClient({
        list: { data: [mockAuditEntry, mockOtherEntry], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getAuditTrail(
        'test_scenario',
        'scenario-123',
      );

      expect(result.length).toBe(2);
    });
  });

  describe('find', () => {
    it('should return entries with default limit', async () => {
      const result = await repository.find('test-org');

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should apply all filters', async () => {
      const result = await repository.find('test-org', {
        action: 'scenario_created',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        user_id: 'user-123',
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-02T00:00:00Z',
        limit: 50,
      });

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return empty array when no entries found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.find('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.find('test-org')).rejects.toThrow(
        'Failed to fetch audit log entries: Query failed',
      );
    });
  });

  describe('getRecent', () => {
    it('should return recent entries with default limit', async () => {
      const result = await repository.getRecent('test-org');

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return recent entries with custom limit', async () => {
      const result = await repository.getRecent('test-org', 10);

      expect(result).toEqual([mockAuditEntry]);
    });

    it('should return empty array when no entries found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getRecent('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.getRecent('test-org')).rejects.toThrow(
        'Failed to fetch recent audit log entries: Query failed',
      );
    });
  });

  describe('action types', () => {
    const actions = [
      'scenario_created',
      'scenario_updated',
      'scenario_deleted',
      'scenario_run_started',
      'scenario_run_completed',
      'scenario_run_failed',
      'learning_promoted',
      'learning_rejected',
      'data_injected',
      'data_cleaned',
    ] as const;

    actions.forEach((action) => {
      it(`should handle ${action} action type`, async () => {
        const entryWithAction = { ...mockAuditEntry, action };
        const mockClient = createMockClient({
          list: { data: [entryWithAction], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findByAction(action, 'test-org');

        expect(result[0]?.action).toBe(action);
      });
    });
  });

  describe('resource types', () => {
    const resourceTypes = [
      'test_scenario',
      'scenario_run',
      'learning',
      'injection',
    ] as const;

    resourceTypes.forEach((resourceType) => {
      it(`should handle ${resourceType} resource type`, async () => {
        const entryWithResource = {
          ...mockAuditEntry,
          resource_type: resourceType,
        };
        const mockClient = createMockClient({
          list: { data: [entryWithResource], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findByResource(
          resourceType,
          'resource-123',
        );

        expect(result[0]?.resource_type).toBe(resourceType);
      });
    });
  });
});
