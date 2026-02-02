import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnalystRepository } from '../analyst.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  Analyst,
  ActiveAnalyst,
  PersonalityAnalyst,
  ContextProvider,
} from '../../interfaces/analyst.interface';
import { AnalystContextVersion } from '../../interfaces/portfolio.interface';

describe('AnalystRepository', () => {
  let repository: AnalystRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockAnalyst: Analyst = {
    id: 'analyst-123',
    scope_level: 'runner',
    domain: null,
    universe_id: null,
    target_id: null,
    slug: 'fred',
    name: 'Fred the Fundamental',
    perspective: 'Fundamentals-focused analyst',
    tier_instructions: {
      gold: 'Detailed fundamental analysis',
      silver: 'Standard fundamental analysis',
      bronze: 'Basic fundamental analysis',
    },
    default_weight: 1.0,
    learned_patterns: ['pattern1', 'pattern2'],
    agent_id: null,
    is_enabled: true,
    analyst_type: 'personality',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockActiveAnalyst: ActiveAnalyst = {
    analyst_id: 'analyst-123',
    slug: 'fred',
    name: 'Fred the Fundamental',
    perspective: 'Fundamentals-focused analyst',
    effective_weight: 1.0,
    effective_tier: 'gold',
    tier_instructions: {
      gold: 'Detailed fundamental analysis',
    },
    learned_patterns: ['pattern1'],
    scope_level: 'runner',
    analyst_type: 'personality',
  };

  const mockPersonalityAnalyst: PersonalityAnalyst = {
    analyst_id: 'analyst-123',
    slug: 'fred',
    name: 'Fred the Fundamental',
    perspective: 'Fundamentals-focused analyst',
    default_weight: 1.0,
    tier_instructions: {
      gold: 'Detailed fundamental analysis',
    },
  };

  const mockContextProvider: ContextProvider = {
    scope_level: 'domain',
    slug: 'stock-expert',
    name: 'Stock Expert',
    perspective: 'Deep stock market knowledge',
    tier_instructions: {
      gold: 'Detailed stock analysis',
    },
  };

  const mockContextVersion: AnalystContextVersion = {
    id: 'version-123',
    analyst_id: 'analyst-123',
    fork_type: 'user',
    version_number: 1,
    perspective: 'Fundamentals-focused analyst',
    tier_instructions: {
      gold: 'Detailed fundamental analysis',
    },
    default_weight: 1.0,
    agent_journal: undefined,
    change_reason: 'Initial version',
    changed_by: 'user',
    is_current: true,
    created_at: '2024-01-01T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
    rpc?: { data: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockAnalyst, error: null };
    const listResult = overrides?.list ?? { data: [mockAnalyst], error: null };
    const insertResult = overrides?.insert ?? { data: mockAnalyst, error: null };
    const updateResult = overrides?.update ?? { data: mockAnalyst, error: null };
    const deleteResult = overrides?.delete ?? { error: null };
    const rpcResult = overrides?.rpc ?? { data: [mockActiveAnalyst], error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
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
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
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
        })),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<AnalystRepository>(AnalystRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveAnalysts', () => {
    it('should return active analysts for target', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockActiveAnalyst], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getActiveAnalysts('target-123');

      expect(result).toEqual([mockActiveAnalyst]);
    });

    it('should filter by tier', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockActiveAnalyst], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getActiveAnalysts('target-123', 'gold');

      expect(result).toBeDefined();
    });

    it('should return empty array when no analysts', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getActiveAnalysts('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getActiveAnalysts('target-123')).rejects.toThrow(
        'Failed to get active analysts: RPC failed',
      );
    });
  });

  describe('findById', () => {
    it('should return analyst when found', async () => {
      const result = await repository.findById('analyst-123');

      expect(result).toEqual(mockAnalyst);
    });

    it('should return null when analyst not found', async () => {
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

      await expect(repository.findById('analyst-123')).rejects.toThrow(
        'Failed to fetch analyst: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return analyst when found', async () => {
      const result = await repository.findByIdOrThrow('analyst-123');

      expect(result).toEqual(mockAnalyst);
    });

    it('should throw NotFoundException when analyst not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return analysts by slug', async () => {
      const result = await repository.findBySlug('fred');

      expect(result).toEqual([mockAnalyst]);
    });

    it('should filter by scope level', async () => {
      const result = await repository.findBySlug('fred', 'runner');

      expect(result).toBeDefined();
    });

    it('should filter by domain', async () => {
      const result = await repository.findBySlug('fred', undefined, 'stocks');

      expect(result).toBeDefined();
    });

    it('should filter by both scope and domain', async () => {
      const result = await repository.findBySlug('fred', 'domain', 'stocks');

      expect(result).toBeDefined();
    });

    it('should return empty array when no analysts found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySlug('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySlug('fred')).rejects.toThrow(
        'Failed to find analysts by slug: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create analyst successfully', async () => {
      const createData = {
        slug: 'new-analyst',
        name: 'New Analyst',
        perspective: 'New perspective',
        scope_level: 'runner' as const,
        analyst_type: 'personality' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockAnalyst);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.create({ slug: 'test' })).rejects.toThrow(
        'Create succeeded but no analyst returned',
      );
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.create({ slug: 'test' })).rejects.toThrow(
        'Failed to create analyst: Insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update analyst successfully', async () => {
      const result = await repository.update('analyst-123', { name: 'Updated Name' });

      expect(result).toEqual(mockAnalyst);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('analyst-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no analyst returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('analyst-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update analyst: Update failed',
      );
    });
  });

  describe('getActive', () => {
    it('should return active analysts', async () => {
      const result = await repository.getActive();

      expect(result).toEqual([mockAnalyst]);
    });

    it('should return empty array when no active analysts', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getActive();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getActive()).rejects.toThrow(
        'Failed to get active analysts: Query failed',
      );
    });
  });

  describe('findByDomain', () => {
    it('should return analysts for domain', async () => {
      const result = await repository.findByDomain('stocks');

      expect(result).toEqual([mockAnalyst]);
    });

    it('should return empty array when no analysts in domain', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByDomain('crypto');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByDomain('stocks')).rejects.toThrow(
        'Failed to find analysts by domain: Query failed',
      );
    });
  });

  describe('findRunnerLevel', () => {
    it('should return runner-level analysts', async () => {
      const result = await repository.findRunnerLevel();

      expect(result).toEqual([mockAnalyst]);
    });

    it('should return empty array when no runner-level analysts', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findRunnerLevel();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findRunnerLevel()).rejects.toThrow(
        'Failed to find runner-level analysts: Query failed',
      );
    });
  });

  describe('getPersonalityAnalysts', () => {
    it('should return personality analysts', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockPersonalityAnalyst], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getPersonalityAnalysts();

      expect(result).toEqual([mockPersonalityAnalyst]);
    });

    it('should return empty array when no personality analysts', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getPersonalityAnalysts();

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getPersonalityAnalysts()).rejects.toThrow(
        'Failed to get personality analysts: RPC failed',
      );
    });
  });

  describe('getContextProvidersForTarget', () => {
    it('should return context providers for target', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockContextProvider], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getContextProvidersForTarget('target-123');

      expect(result).toEqual([mockContextProvider]);
    });

    it('should return empty array when no providers', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getContextProvidersForTarget('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getContextProvidersForTarget('target-123')).rejects.toThrow(
        'Failed to get context providers for target: RPC failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete analyst successfully', async () => {
      await expect(repository.delete('analyst-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('analyst-123')).rejects.toThrow(
        'Failed to delete analyst: Delete failed',
      );
    });
  });

  describe('getCurrentContextVersion', () => {
    it('should return current context version', async () => {
      const mockClient = createMockClient({
        single: { data: mockContextVersion, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getCurrentContextVersion('analyst-123', 'user');

      expect(result).toEqual(mockContextVersion);
    });

    it('should return null when no current version', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getCurrentContextVersion('analyst-123', 'user');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getCurrentContextVersion('analyst-123', 'user')).rejects.toThrow(
        'Failed to get current context version: Query failed',
      );
    });
  });

  describe('getContextVersionHistory', () => {
    it('should return version history', async () => {
      const mockClient = createMockClient({
        list: { data: [mockContextVersion], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getContextVersionHistory('analyst-123', 'user');

      expect(result).toEqual([mockContextVersion]);
    });

    it('should return empty array when no history', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getContextVersionHistory('analyst-123', 'user');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getContextVersionHistory('analyst-123', 'user')).rejects.toThrow(
        'Failed to get context version history: Query failed',
      );
    });
  });

  describe('getAllCurrentContextVersions', () => {
    it('should return map of current versions', async () => {
      const mockClient = createMockClient({
        list: { data: [mockContextVersion], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getAllCurrentContextVersions('user');

      expect(result.get('analyst-123')).toEqual(mockContextVersion);
    });

    it('should return empty map when no versions', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getAllCurrentContextVersions('user');

      expect(result.size).toBe(0);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getAllCurrentContextVersions('user')).rejects.toThrow(
        'Failed to get all current context versions: Query failed',
      );
    });
  });

  describe('analyst scope levels', () => {
    const scopeLevels = ['runner', 'domain', 'universe', 'target'] as const;

    scopeLevels.forEach((scopeLevel) => {
      it(`should handle ${scopeLevel} scope level`, async () => {
        const analystWithScope = { ...mockAnalyst, scope_level: scopeLevel };
        const mockClient = createMockClient({
          single: { data: analystWithScope, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('analyst-123');

        expect(result?.scope_level).toBe(scopeLevel);
      });
    });
  });

  describe('analyst types', () => {
    const analystTypes = ['personality', 'context_provider'] as const;

    analystTypes.forEach((analystType) => {
      it(`should handle ${analystType} analyst type`, async () => {
        const analystWithType = { ...mockAnalyst, analyst_type: analystType };
        const mockClient = createMockClient({
          single: { data: analystWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('analyst-123');

        expect(result?.analyst_type).toBe(analystType);
      });
    });
  });

  describe('LLM tiers', () => {
    const tiers = ['gold', 'silver', 'bronze'] as const;

    tiers.forEach((tier) => {
      it(`should handle ${tier} tier`, async () => {
        const activeAnalystWithTier = { ...mockActiveAnalyst, effective_tier: tier };
        const mockClient = createMockClient({
          rpc: { data: [activeAnalystWithTier], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.getActiveAnalysts('target-123', tier);

        expect(result[0]?.effective_tier).toBe(tier);
      });
    });
  });
});
