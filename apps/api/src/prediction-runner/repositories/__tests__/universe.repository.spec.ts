import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UniverseRepository } from '../universe.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Universe } from '../../interfaces/universe.interface';

describe('UniverseRepository', () => {
  let repository: UniverseRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockUniverse: Universe = {
    id: 'universe-123',
    organization_slug: 'test-org',
    agent_slug: 'prediction-agent',
    name: 'Test Universe',
    description: 'A test universe',
    domain: 'stocks',
    strategy_id: 'strategy-123',
    llm_config: {
      gold: { provider: 'anthropic', model: 'claude-3-opus' },
    },
    thresholds: {
      min_predictors: 3,
      min_combined_strength: 15,
    },
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['push', 'email'],
    },
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: { data: unknown; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockUniverse,
      error: null,
    };
    const listResult = overrides?.list ?? { data: [mockUniverse], error: null };
    const insertResult = overrides?.insert ?? {
      data: mockUniverse,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockUniverse,
      error: null,
    };
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
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniverseRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<UniverseRepository>(UniverseRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return universes for organization', async () => {
      const result = await repository.findAll('test-org');

      expect(result).toEqual([mockUniverse]);
    });

    it('should return empty array when no universes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findAll('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findAll('test-org')).rejects.toThrow(
        'Failed to fetch universes: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return universe when found', async () => {
      const result = await repository.findById('universe-123');

      expect(result).toEqual(mockUniverse);
    });

    it('should return null when universe not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findById('universe-123')).rejects.toThrow(
        'Failed to fetch universe: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return universe when found', async () => {
      const result = await repository.findByIdOrThrow('universe-123');

      expect(result).toEqual(mockUniverse);
    });

    it('should throw NotFoundException when universe not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create universe successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        agent_slug: 'prediction-agent',
        name: 'Test Universe',
        domain: 'stocks' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockUniverse);
    });

    it('should create universe with optional fields', async () => {
      const createData = {
        organization_slug: 'test-org',
        agent_slug: 'prediction-agent',
        name: 'Test Universe',
        domain: 'crypto' as const,
        description: 'Test description',
        strategy_id: 'strategy-123',
        llm_config: {
          gold: { provider: 'anthropic', model: 'claude-3-opus' },
        },
        notification_config: {
          urgent_enabled: true,
          new_prediction_enabled: true,
          outcome_enabled: false,
          channels: ['push'] as ('push' | 'sms' | 'email' | 'sse')[],
        },
        is_active: true,
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          organization_slug: 'test-org',
          agent_slug: 'prediction-agent',
          name: 'Test Universe',
          domain: 'stocks',
        }),
      ).rejects.toThrow('Create succeeded but no universe returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          organization_slug: 'test-org',
          agent_slug: 'prediction-agent',
          name: 'Test Universe',
          domain: 'stocks',
        }),
      ).rejects.toThrow('Failed to create universe: Insert failed');
    });
  });

  describe('update', () => {
    it('should update universe successfully', async () => {
      const result = await repository.update('universe-123', {
        name: 'Updated Name',
      });

      expect(result).toEqual(mockUniverse);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        is_active: false,
      };

      const result = await repository.update('universe-123', updateData);

      expect(result).toBeDefined();
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('universe-123', { name: 'Updated' }),
      ).rejects.toThrow('Update succeeded but no universe returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('universe-123', { name: 'Updated' }),
      ).rejects.toThrow('Failed to update universe: Update failed');
    });
  });

  describe('delete', () => {
    it('should delete universe successfully', async () => {
      await expect(repository.delete('universe-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('universe-123')).rejects.toThrow(
        'Failed to delete universe: Delete failed',
      );
    });
  });

  describe('findAllActive', () => {
    it('should return all active universes', async () => {
      const result = await repository.findAllActive();

      expect(result).toEqual([mockUniverse]);
    });

    it('should return empty array when no active universes', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findAllActive()).rejects.toThrow(
        'Failed to fetch all active universes: Query failed',
      );
    });
  });

  describe('findByAgentSlug', () => {
    it('should return universes for agent', async () => {
      const result = await repository.findByAgentSlug(
        'prediction-agent',
        'test-org',
      );

      expect(result).toEqual([mockUniverse]);
    });

    it('should return empty array when no universes found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByAgentSlug(
        'nonexistent-agent',
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
        repository.findByAgentSlug('prediction-agent', 'test-org'),
      ).rejects.toThrow('Failed to fetch universes by agent: Query failed');
    });
  });

  describe('findByDomain', () => {
    it('should return universes for domain', async () => {
      const result = await repository.findByDomain('stocks');

      expect(result).toEqual([mockUniverse]);
    });

    const domains = ['stocks', 'crypto', 'polymarket', 'elections'] as const;

    domains.forEach((domain) => {
      it(`should filter by ${domain} domain`, async () => {
        const universeWithDomain = { ...mockUniverse, domain };
        const mockClient = createMockClient({
          list: { data: [universeWithDomain], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findByDomain(domain);

        expect(result[0]?.domain).toBe(domain);
      });
    });

    it('should return empty array when no universes in domain', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByDomain('crypto');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByDomain('stocks')).rejects.toThrow(
        'Failed to fetch universes by domain: Query failed',
      );
    });
  });

  describe('notification config', () => {
    it('should handle various channel configurations', async () => {
      const channels: ('push' | 'sms' | 'email' | 'sse')[][] = [
        ['push'],
        ['email', 'sms'],
        ['push', 'email', 'sse'],
      ];

      for (const channelSet of channels) {
        const universeWithChannels = {
          ...mockUniverse,
          notification_config: {
            ...mockUniverse.notification_config,
            channels: channelSet,
          },
        };
        const mockClient = createMockClient({
          single: { data: universeWithChannels, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('universe-123');

        expect(result?.notification_config.channels).toEqual(channelSet);
      }
    });
  });
});
