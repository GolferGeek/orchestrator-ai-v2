import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TargetRepository } from '../target.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Target } from '../../interfaces/target.interface';

describe('TargetRepository', () => {
  let repository: TargetRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Tech company',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-01T10:00:00Z',
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
    const singleResult = overrides?.single ?? { data: mockTarget, error: null };
    const listResult = overrides?.list ?? { data: [mockTarget], error: null };
    const insertResult = overrides?.insert ?? { data: mockTarget, error: null };
    const updateResult = overrides?.update ?? { data: mockTarget, error: null };
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
        TargetRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TargetRepository>(TargetRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return targets for universe', async () => {
      const result = await repository.findAll('universe-123');

      expect(result).toEqual([mockTarget]);
    });

    it('should return empty array when no targets found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAll('universe-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAll('universe-123')).rejects.toThrow(
        'Failed to fetch targets: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return target when found', async () => {
      const result = await repository.findById('target-123');

      expect(result).toEqual(mockTarget);
    });

    it('should return null when target not found', async () => {
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

      await expect(repository.findById('target-123')).rejects.toThrow(
        'Failed to fetch target: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return target when found', async () => {
      const result = await repository.findByIdOrThrow('target-123');

      expect(result).toEqual(mockTarget);
    });

    it('should throw NotFoundException when target not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySymbol', () => {
    it('should return target when found', async () => {
      const result = await repository.findBySymbol('universe-123', 'AAPL');

      expect(result).toEqual(mockTarget);
    });

    it('should return null when target not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySymbol('universe-123', 'INVALID');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySymbol('universe-123', 'AAPL')).rejects.toThrow(
        'Failed to fetch target by symbol: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create target successfully', async () => {
      const createData = {
        universe_id: 'universe-123',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        target_type: 'stock' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockTarget);
    });

    it('should create target with optional fields', async () => {
      const createData = {
        universe_id: 'universe-123',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        target_type: 'stock' as const,
        context: 'Tech company',
        metadata: { industry: 'technology' },
        is_active: true,
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
          universe_id: 'universe-123',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          target_type: 'stock',
        }),
      ).rejects.toThrow('Create succeeded but no target returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          universe_id: 'universe-123',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          target_type: 'stock',
        }),
      ).rejects.toThrow('Failed to create target: Insert failed');
    });
  });

  describe('update', () => {
    it('should update target successfully', async () => {
      const result = await repository.update('target-123', { name: 'Updated Name' });

      expect(result).toEqual(mockTarget);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'Updated Name',
        context: 'Updated context',
        is_active: false,
      };

      const result = await repository.update('target-123', updateData);

      expect(result).toBeDefined();
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('target-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no target returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('target-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update target: Update failed',
      );
    });
  });

  describe('updateCurrentPrice', () => {
    it('should update current price successfully', async () => {
      const result = await repository.updateCurrentPrice('target-123', 155.0);

      expect(result).toEqual(mockTarget);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.updateCurrentPrice('target-123', 155.0)).rejects.toThrow(
        'Update succeeded but no target returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.updateCurrentPrice('target-123', 155.0)).rejects.toThrow(
        'Failed to update target current price: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete target successfully', async () => {
      await expect(repository.delete('target-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('target-123')).rejects.toThrow(
        'Failed to delete target: Delete failed',
      );
    });
  });

  describe('findActiveByUniverse', () => {
    it('should return active targets for universe', async () => {
      const result = await repository.findActiveByUniverse('universe-123');

      expect(result).toEqual([mockTarget]);
    });

    it('should return empty array when no active targets', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveByUniverse('universe-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findActiveByUniverse('universe-123')).rejects.toThrow(
        'Failed to fetch active targets: Query failed',
      );
    });
  });

  describe('findAllActive', () => {
    it('should return all active targets', async () => {
      const result = await repository.findAllActive();

      expect(result).toEqual([mockTarget]);
    });

    it('should return empty array when no active targets', async () => {
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
        'Failed to fetch all active targets: Query failed',
      );
    });
  });

  describe('target types', () => {
    const targetTypes = ['stock', 'crypto', 'election', 'polymarket'] as const;

    targetTypes.forEach((targetType) => {
      it(`should handle ${targetType} target type`, async () => {
        const targetWithType = { ...mockTarget, target_type: targetType };
        const mockClient = createMockClient({
          single: { data: targetWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('target-123');

        expect(result?.target_type).toBe(targetType);
      });
    });
  });
});
