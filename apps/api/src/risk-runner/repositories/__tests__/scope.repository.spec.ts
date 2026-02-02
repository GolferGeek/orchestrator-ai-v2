import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScopeRepository, ScopeFilter } from '../scope.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskScope } from '../../interfaces/scope.interface';

describe('ScopeRepository', () => {
  let repository: ScopeRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockScope: RiskScope = {
    id: 'scope-123',
    organization_slug: 'test-org',
    agent_slug: 'risk-analyst',
    name: 'Test Scope',
    description: 'Test scope description',
    domain: 'investment',
    llm_config: null,
    thresholds: null,
    analysis_config: {
      riskRadar: { enabled: true },
      redTeam: { enabled: false },
    },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockScope, error: null };
    const listResult = overrides?.list ?? { data: [mockScope], error: null };
    const insertResult = overrides?.insert ?? { data: mockScope, error: null };
    const updateResult = overrides?.update ?? { data: mockScope, error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
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
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

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
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScopeRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<ScopeRepository>(ScopeRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all scopes for organization', async () => {
      const result = await repository.findAll('test-org');

      expect(result).toEqual([mockScope]);
    });

    it('should return empty array when no scopes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAll('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAll('test-org')).rejects.toThrow(
        'Failed to fetch scopes: Query failed',
      );
    });

    it('should apply includeTest filter', async () => {
      const filter: ScopeFilter = { includeTest: true };
      const result = await repository.findAll('test-org', filter);

      expect(result).toEqual([mockScope]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: ScopeFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findAll('test-org', filter);

      expect(result).toEqual([mockScope]);
    });
  });

  describe('findById', () => {
    it('should return scope when found', async () => {
      const result = await repository.findById('scope-123');

      expect(result).toEqual(mockScope);
    });

    it('should return null when scope not found', async () => {
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

      await expect(repository.findById('scope-123')).rejects.toThrow(
        'Failed to fetch scope: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return scope when found', async () => {
      const result = await repository.findByIdOrThrow('scope-123');

      expect(result).toEqual(mockScope);
    });

    it('should throw NotFoundException when scope not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create scope successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        agent_slug: 'risk-analyst',
        name: 'New Scope',
        domain: 'investment' as const,
        analysis_config: { riskRadar: { enabled: true } },
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockScope);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          agent_slug: 'risk-analyst',
          name: 'New Scope',
          domain: 'investment',
          analysis_config: { riskRadar: { enabled: true } },
        }),
      ).rejects.toThrow('Create succeeded but no scope returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          organization_slug: 'test-org',
          agent_slug: 'risk-analyst',
          name: 'New Scope',
          domain: 'investment',
          analysis_config: { riskRadar: { enabled: true } },
        }),
      ).rejects.toThrow('Failed to create scope: Insert failed');
    });
  });

  describe('update', () => {
    it('should update scope successfully', async () => {
      const updatedScope = { ...mockScope, name: 'Updated Name' };
      const mockClient = createMockClient({
        update: { data: updatedScope, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('scope-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedScope);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('scope-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no scope returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('scope-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update scope: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete scope successfully', async () => {
      await expect(repository.delete('scope-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('scope-123')).rejects.toThrow(
        'Failed to delete scope: Delete failed',
      );
    });
  });

  describe('findAllActive', () => {
    it('should return all active scopes', async () => {
      const result = await repository.findAllActive();

      expect(result).toEqual([mockScope]);
    });

    it('should return empty array when no active scopes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAllActive()).rejects.toThrow(
        'Failed to fetch all active scopes: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: ScopeFilter = { includeTest: true };
      const result = await repository.findAllActive(filter);

      expect(result).toEqual([mockScope]);
    });
  });

  describe('findByAgentSlug', () => {
    it('should return scopes for agent', async () => {
      const result = await repository.findByAgentSlug('risk-analyst', 'test-org');

      expect(result).toEqual([mockScope]);
    });

    it('should return empty array when no scopes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByAgentSlug('unknown-agent', 'test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByAgentSlug('risk-analyst', 'test-org')).rejects.toThrow(
        'Failed to fetch scopes by agent: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: ScopeFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findByAgentSlug('risk-analyst', 'test-org', filter);

      expect(result).toEqual([mockScope]);
    });
  });

  describe('findByDomain', () => {
    it('should return scopes for domain', async () => {
      const result = await repository.findByDomain('investment', 'test-org');

      expect(result).toEqual([mockScope]);
    });

    it('should return empty array when no scopes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByDomain('personal', 'test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByDomain('investment', 'test-org')).rejects.toThrow(
        'Failed to fetch scopes by domain: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: ScopeFilter = { includeTest: true };
      const result = await repository.findByDomain('investment', 'test-org', filter);

      expect(result).toEqual([mockScope]);
    });
  });

  describe('domain types', () => {
    const domains = ['investment', 'business', 'project', 'personal'] as const;

    domains.forEach((domain) => {
      it(`should handle ${domain} domain`, async () => {
        const scopeWithDomain = { ...mockScope, domain };
        const mockClient = createMockClient({
          single: { data: scopeWithDomain, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('scope-123');

        expect(result?.domain).toBe(domain);
      });
    });
  });
});
