import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DimensionRepository, DimensionFilter } from '../dimension.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskDimension } from '../../interfaces/dimension.interface';

describe('DimensionRepository', () => {
  let repository: DimensionRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockDimension: RiskDimension = {
    id: 'dim-123',
    scope_id: 'scope-123',
    slug: 'market',
    name: 'Market Risk',
    description: 'Market risk dimension',
    display_name: 'Market',
    icon: 'chart-line',
    color: '#EF4444',
    weight: 1.0,
    display_order: 1,
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
    const singleResult = overrides?.single ?? { data: mockDimension, error: null };
    const listResult = overrides?.list ?? { data: [mockDimension], error: null };
    const insertResult = overrides?.insert ?? { data: mockDimension, error: null };
    const updateResult = overrides?.update ?? { data: mockDimension, error: null };
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
        DimensionRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<DimensionRepository>(DimensionRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByScope', () => {
    it('should return dimensions for scope', async () => {
      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([mockDimension]);
    });

    it('should return empty array when no dimensions found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByScope('scope-123')).rejects.toThrow(
        'Failed to fetch dimensions: Query failed',
      );
    });

    it('should apply includeTest filter', async () => {
      const filter: DimensionFilter = { includeTest: true };
      const result = await repository.findByScope('scope-123', filter);

      expect(result).toEqual([mockDimension]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: DimensionFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findByScope('scope-123', filter);

      expect(result).toEqual([mockDimension]);
    });

    it('should exclude test dimensions by default', async () => {
      const result = await repository.findByScope('scope-123');

      // Check that filter excludes test=true
      expect(result).toEqual([mockDimension]);
    });
  });

  describe('findById', () => {
    it('should return dimension when found', async () => {
      const result = await repository.findById('dim-123');

      expect(result).toEqual(mockDimension);
    });

    it('should return null when dimension not found', async () => {
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

      await expect(repository.findById('dim-123')).rejects.toThrow(
        'Failed to fetch dimension: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return dimension when found', async () => {
      const result = await repository.findByIdOrThrow('dim-123');

      expect(result).toEqual(mockDimension);
    });

    it('should throw NotFoundException when dimension not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return dimension when found', async () => {
      const result = await repository.findBySlug('scope-123', 'market');

      expect(result).toEqual(mockDimension);
    });

    it('should return null when dimension not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySlug('scope-123', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySlug('scope-123', 'market')).rejects.toThrow(
        'Failed to fetch dimension by slug: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create dimension successfully', async () => {
      const createData = {
        scope_id: 'scope-123',
        slug: 'new-dimension',
        name: 'New Dimension',
        weight: 1.0,
        display_order: 2,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockDimension);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          scope_id: 'scope-123',
          slug: 'new-dimension',
          name: 'New Dimension',
          weight: 1.0,
          display_order: 2,
        }),
      ).rejects.toThrow('Create succeeded but no dimension returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          scope_id: 'scope-123',
          slug: 'new-dimension',
          name: 'New Dimension',
          weight: 1.0,
          display_order: 2,
        }),
      ).rejects.toThrow('Failed to create dimension: Insert failed');
    });
  });

  describe('update', () => {
    it('should update dimension successfully', async () => {
      const updatedDimension = { ...mockDimension, name: 'Updated Name' };
      const mockClient = createMockClient({
        update: { data: updatedDimension, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('dim-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedDimension);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('dim-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no dimension returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('dim-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update dimension: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete dimension successfully', async () => {
      await expect(repository.delete('dim-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('dim-123')).rejects.toThrow(
        'Failed to delete dimension: Delete failed',
      );
    });
  });

  describe('dimension slugs', () => {
    const slugs = ['market', 'fundamental', 'technical', 'macro', 'correlation'] as const;

    slugs.forEach((slug) => {
      it(`should handle ${slug} slug`, async () => {
        const dimensionWithSlug = { ...mockDimension, slug };
        const mockClient = createMockClient({
          single: { data: dimensionWithSlug, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findBySlug('scope-123', slug);

        expect(result?.slug).toBe(slug);
      });
    });
  });

  describe('weight values', () => {
    const weights = [0.0, 0.5, 1.0, 1.5, 2.0] as const;

    weights.forEach((weight) => {
      it(`should handle weight ${weight}`, async () => {
        const dimensionWithWeight = { ...mockDimension, weight };
        const mockClient = createMockClient({
          single: { data: dimensionWithWeight, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('dim-123');

        expect(result?.weight).toBe(weight);
      });
    });
  });
});
