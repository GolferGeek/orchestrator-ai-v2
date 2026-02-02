import { Test, TestingModule } from '@nestjs/testing';
import { LearningLineageRepository } from '../learning-lineage.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { LearningLineage } from '../../interfaces/learning.interface';

describe('LearningLineageRepository', () => {
  let repository: LearningLineageRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockLineage: LearningLineage = {
    id: 'lineage-123',
    organization_slug: 'test-org',
    test_learning_id: 'test-learning-123',
    production_learning_id: 'prod-learning-123',
    scenario_runs: ['run-1', 'run-2'],
    validation_metrics: { accuracy: 0.85, total_tests: 10 },
    backtest_result: { pnl: 1500, win_rate: 0.6 },
    promoted_by: 'user-123',
    promoted_at: '2024-01-01T10:00:00Z',
    notes: 'Promoted after successful testing',
    created_at: '2024-01-01T10:00:00Z',
  };

  const mockLineageWithDetails = {
    ...mockLineage,
    promoter: {
      email: 'user@test.com',
      raw_user_meta_data: { full_name: 'Test User' },
    },
    test_learning: { title: 'Test Learning Title' },
    production_learning: { title: 'Production Learning Title' },
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockLineage,
      error: null,
    };
    const listResult = overrides?.list ?? { data: [mockLineage], error: null };
    const insertResult = overrides?.insert ?? {
      data: mockLineage,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockLineage,
      error: null,
    };
    const deleteResult = overrides?.delete ?? { error: null };

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
        LearningLineageRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<LearningLineageRepository>(
      LearningLineageRepository,
    );
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return lineage when found', async () => {
      const result = await repository.findById('lineage-123');

      expect(result).toEqual(mockLineage);
    });

    it('should return null when lineage not found', async () => {
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

      await expect(repository.findById('lineage-123')).rejects.toThrow(
        'Failed to fetch learning lineage: Database error',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return lineages for organization', async () => {
      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([mockLineage]);
    });

    it('should return empty array when no lineages found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByOrganization('test-org')).rejects.toThrow(
        'Failed to fetch learning lineage records: Query failed',
      );
    });
  });

  describe('findByTestLearning', () => {
    it('should return lineages for test learning', async () => {
      const result = await repository.findByTestLearning('test-learning-123');

      expect(result).toEqual([mockLineage]);
    });

    it('should return empty array when no promotions found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByTestLearning('test-learning-123');

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
        repository.findByTestLearning('test-learning-123'),
      ).rejects.toThrow(
        'Failed to fetch learning lineage by test learning: Query failed',
      );
    });
  });

  describe('findByProductionLearning', () => {
    it('should return lineages for production learning', async () => {
      const result =
        await repository.findByProductionLearning('prod-learning-123');

      expect(result).toEqual([mockLineage]);
    });

    it('should return empty array when no lineages found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result =
        await repository.findByProductionLearning('prod-learning-123');

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
        repository.findByProductionLearning('prod-learning-123'),
      ).rejects.toThrow(
        'Failed to fetch learning lineage by production learning: Query failed',
      );
    });
  });

  describe('findByPromoter', () => {
    it('should return lineages promoted by user', async () => {
      const result = await repository.findByPromoter('user-123');

      expect(result).toEqual([mockLineage]);
    });

    it('should return empty array when no promotions by user', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByPromoter('user-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByPromoter('user-123')).rejects.toThrow(
        'Failed to fetch learning lineage by promoter: Query failed',
      );
    });
  });

  describe('isTestLearningPromoted', () => {
    it('should return true when test learning has promotions', async () => {
      const mockClient = createMockClient({
        list: { data: [{ id: 'lineage-123' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result =
        await repository.isTestLearningPromoted('test-learning-123');

      expect(result).toBe(true);
    });

    it('should return false when test learning has no promotions', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result =
        await repository.isTestLearningPromoted('test-learning-123');

      expect(result).toBe(false);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.isTestLearningPromoted('test-learning-123'),
      ).rejects.toThrow(
        'Failed to check if test learning is promoted: Query failed',
      );
    });
  });

  describe('getPromotionHistory', () => {
    it('should return promotion history with details', async () => {
      const mockClient = createMockClient({
        list: { data: [mockLineageWithDetails], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getPromotionHistory('test-org');

      expect(result.length).toBe(1);
      expect(result[0]?.promoter_email).toBe('user@test.com');
      expect(result[0]?.promoter_name).toBe('Test User');
      expect(result[0]?.test_learning_title).toBe('Test Learning Title');
      expect(result[0]?.production_learning_title).toBe(
        'Production Learning Title',
      );
    });

    it('should return empty array when no history', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getPromotionHistory('test-org');

      expect(result).toEqual([]);
    });

    it('should handle missing promoter details', async () => {
      const lineageWithoutPromoter = {
        ...mockLineage,
        promoter: undefined,
        test_learning: undefined,
        production_learning: undefined,
      };
      const mockClient = createMockClient({
        list: { data: [lineageWithoutPromoter], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getPromotionHistory('test-org');

      expect(result.length).toBe(1);
      expect(result[0]?.promoter_email).toBeUndefined();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.getPromotionHistory('test-org')).rejects.toThrow(
        'Failed to fetch promotion history with details: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create lineage successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        test_learning_id: 'test-learning-123',
        production_learning_id: 'prod-learning-123',
        promoted_by: 'user-123',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockLineage);
    });

    it('should create with all optional fields', async () => {
      const createData = {
        organization_slug: 'test-org',
        test_learning_id: 'test-learning-123',
        production_learning_id: 'prod-learning-123',
        scenario_runs: ['run-1', 'run-2'],
        validation_metrics: { accuracy: 0.85 },
        backtest_result: { pnl: 1500 },
        promoted_by: 'user-123',
        promoted_at: '2024-01-01T10:00:00Z',
        notes: 'Test notes',
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
          test_learning_id: 'test-learning-123',
          production_learning_id: 'prod-learning-123',
          promoted_by: 'user-123',
        }),
      ).rejects.toThrow('Create succeeded but no learning lineage returned');
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
          test_learning_id: 'test-learning-123',
          production_learning_id: 'prod-learning-123',
          promoted_by: 'user-123',
        }),
      ).rejects.toThrow('Failed to create learning lineage: Insert failed');
    });
  });

  describe('update', () => {
    it('should update lineage successfully', async () => {
      const result = await repository.update('lineage-123', {
        notes: 'Updated notes',
      });

      expect(result).toEqual(mockLineage);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('lineage-123', { notes: 'Updated' }),
      ).rejects.toThrow('Update succeeded but no learning lineage returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('lineage-123', { notes: 'Updated' }),
      ).rejects.toThrow('Failed to update learning lineage: Update failed');
    });
  });

  describe('delete', () => {
    it('should delete lineage successfully', async () => {
      await expect(repository.delete('lineage-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('lineage-123')).rejects.toThrow(
        'Failed to delete learning lineage: Delete failed',
      );
    });
  });
});
