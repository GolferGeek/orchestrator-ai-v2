import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StrategyRepository } from '../strategy.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Strategy } from '../../interfaces/strategy.interface';

describe('StrategyRepository', () => {
  let repository: StrategyRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockStrategy: Strategy = {
    id: 'strategy-123',
    slug: 'test-strategy',
    name: 'Test Strategy',
    description: 'A test strategy',
    risk_level: 'medium',
    parameters: {
      min_predictors: 3,
      min_combined_strength: 15,
      min_direction_consensus: 0.6,
      predictor_ttl_hours: 24,
    },
    is_system: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSystemStrategy: Strategy = {
    ...mockStrategy,
    id: 'system-strategy-123',
    slug: 'default',
    name: 'Default Strategy',
    is_system: true,
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockStrategy, error: null };
    const listResult = overrides?.list ?? { data: [mockStrategy], error: null };
    const insertResult = overrides?.insert ?? { data: mockStrategy, error: null };
    const updateResult = overrides?.update ?? { data: mockStrategy, error: null };
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
        StrategyRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<StrategyRepository>(StrategyRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active strategies', async () => {
      const result = await repository.findAll();

      expect(result).toEqual([mockStrategy]);
    });

    it('should return empty array when no strategies found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAll()).rejects.toThrow('Failed to fetch strategies: Query failed');
    });
  });

  describe('findById', () => {
    it('should return strategy when found', async () => {
      const result = await repository.findById('strategy-123');

      expect(result).toEqual(mockStrategy);
    });

    it('should return null when strategy not found', async () => {
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

      await expect(repository.findById('strategy-123')).rejects.toThrow(
        'Failed to fetch strategy: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return strategy when found', async () => {
      const result = await repository.findByIdOrThrow('strategy-123');

      expect(result).toEqual(mockStrategy);
    });

    it('should throw NotFoundException when strategy not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return strategy when found', async () => {
      const result = await repository.findBySlug('test-strategy');

      expect(result).toEqual(mockStrategy);
    });

    it('should return null when strategy not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySlug('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySlug('test-strategy')).rejects.toThrow(
        'Failed to fetch strategy by slug: Database error',
      );
    });
  });

  describe('findBySlugOrThrow', () => {
    it('should return strategy when found', async () => {
      const result = await repository.findBySlugOrThrow('test-strategy');

      expect(result).toEqual(mockStrategy);
    });

    it('should throw NotFoundException when strategy not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySlugOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findSystemStrategies', () => {
    it('should return system strategies', async () => {
      const mockClient = createMockClient({
        list: { data: [mockSystemStrategy], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findSystemStrategies();

      expect(result).toEqual([mockSystemStrategy]);
    });

    it('should return empty array when no system strategies', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findSystemStrategies();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findSystemStrategies()).rejects.toThrow(
        'Failed to fetch system strategies: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create strategy successfully', async () => {
      const createData = {
        slug: 'new-strategy',
        name: 'New Strategy',
        risk_level: 'low' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockStrategy);
    });

    it('should create strategy with all fields', async () => {
      const createData = {
        slug: 'full-strategy',
        name: 'Full Strategy',
        description: 'A comprehensive strategy',
        risk_level: 'high' as const,
        parameters: {
          min_predictors: 5,
          min_combined_strength: 25,
        },
        is_system: false,
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
          slug: 'test',
          name: 'Test',
          risk_level: 'low',
        }),
      ).rejects.toThrow('Create succeeded but no strategy returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          slug: 'test',
          name: 'Test',
          risk_level: 'low',
        }),
      ).rejects.toThrow('Failed to create strategy: Insert failed');
    });
  });

  describe('update', () => {
    it('should update non-system strategy', async () => {
      const result = await repository.update('strategy-123', { name: 'Updated Name' });

      expect(result).toEqual(mockStrategy);
    });

    it('should only allow is_active update for system strategy', async () => {
      const mockClient = createMockClient({
        single: { data: mockSystemStrategy, error: null },
        update: { data: mockSystemStrategy, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('system-strategy-123', {
        name: 'New Name',
        is_active: false,
      });

      expect(result).toBeDefined();
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('strategy-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no strategy returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('strategy-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update strategy: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete non-system strategy', async () => {
      await expect(repository.delete('strategy-123')).resolves.toBeUndefined();
    });

    it('should not delete system strategy', async () => {
      const mockClient = createMockClient({
        single: { data: mockSystemStrategy, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('system-strategy-123')).rejects.toThrow(
        'Cannot delete system strategies',
      );
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('strategy-123')).rejects.toThrow(
        'Failed to delete strategy: Delete failed',
      );
    });
  });

  describe('risk levels', () => {
    const riskLevels = ['low', 'medium', 'high'] as const;

    riskLevels.forEach((riskLevel) => {
      it(`should handle ${riskLevel} risk level`, async () => {
        const strategyWithRisk = { ...mockStrategy, risk_level: riskLevel };
        const mockClient = createMockClient({
          single: { data: strategyWithRisk, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('strategy-123');

        expect(result?.risk_level).toBe(riskLevel);
      });
    });
  });

  describe('strategy parameters', () => {
    it('should handle complete parameters', async () => {
      const strategyWithParams = {
        ...mockStrategy,
        parameters: {
          min_predictors: 5,
          min_combined_strength: 25,
          min_direction_consensus: 0.8,
          predictor_ttl_hours: 48,
          urgent_threshold: 0.95,
          notable_threshold: 0.75,
          analyst_weights: { fred: 1.2, tina: 0.9 },
          tier_preference: 'gold' as const,
          custom_rules: [
            {
              name: 'Rule 1',
              description: 'First rule',
              condition: 'condition1',
              action: 'action1',
              priority: 1,
            },
          ],
        },
      };
      const mockClient = createMockClient({
        single: { data: strategyWithParams, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('strategy-123');

      expect(result?.parameters.min_predictors).toBe(5);
      expect(result?.parameters.analyst_weights?.fred).toBe(1.2);
    });

    it('should handle minimal parameters', async () => {
      const strategyWithMinParams = {
        ...mockStrategy,
        parameters: {},
      };
      const mockClient = createMockClient({
        single: { data: strategyWithMinParams, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('strategy-123');

      expect(result?.parameters).toEqual({});
    });
  });
});
