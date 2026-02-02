import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LearningRepository } from '../learning.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Learning, ActiveLearning } from '../../interfaces/learning.interface';

describe('LearningRepository', () => {
  let repository: LearningRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockLearning: Learning = {
    id: 'learning-123',
    scope_level: 'runner',
    domain: null,
    universe_id: null,
    target_id: null,
    analyst_id: null,
    learning_type: 'pattern',
    title: 'Test Pattern Learning',
    description: 'A test pattern to recognize',
    config: {
      trigger_condition: 'market_open',
      action: 'increase_confidence',
    },
    source_type: 'human',
    source_evaluation_id: null,
    source_missed_opportunity_id: null,
    status: 'active',
    superseded_by: null,
    version: 1,
    times_applied: 10,
    times_helpful: 8,
    is_test: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockActiveLearning: ActiveLearning = {
    learning_id: 'learning-123',
    learning_type: 'pattern',
    title: 'Test Pattern Learning',
    description: 'A test pattern to recognize',
    config: {
      trigger_condition: 'market_open',
      action: 'increase_confidence',
    },
    scope_level: 'runner',
    times_applied: 10,
    times_helpful: 8,
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: { data: unknown; error: { message: string } | null };
    delete?: { error: { message: string } | null; count?: number };
    rpc?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockLearning,
      error: null,
    };
    const listResult = overrides?.list ?? { data: [mockLearning], error: null };
    const insertResult = overrides?.insert ?? {
      data: mockLearning,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockLearning,
      error: null,
    };
    const deleteResult = overrides?.delete ?? { error: null, count: 0 };
    const rpcResult = overrides?.rpc ?? {
      data: [mockActiveLearning],
      error: null,
    };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        contains: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.contains as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      });
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
        contains: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.contains as jest.Mock).mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      });
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
        LearningRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<LearningRepository>(LearningRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveLearnings', () => {
    it('should return active learnings for target', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockActiveLearning], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getActiveLearnings('target-123');

      expect(result).toEqual([mockActiveLearning]);
    });

    it('should filter by tier', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockActiveLearning], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getActiveLearnings('target-123', 'gold');

      expect(result).toBeDefined();
    });

    it('should filter by analyst', async () => {
      const mockClient = createMockClient({
        rpc: { data: [mockActiveLearning], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getActiveLearnings(
        'target-123',
        undefined,
        'analyst-123',
      );

      expect(result).toBeDefined();
    });

    it('should return empty array when no learnings', async () => {
      const mockClient = createMockClient({
        rpc: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getActiveLearnings('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.getActiveLearnings('target-123')).rejects.toThrow(
        'Failed to get active learnings: RPC failed',
      );
    });
  });

  describe('findById', () => {
    it('should return learning when found', async () => {
      const result = await repository.findById('learning-123');

      expect(result).toEqual(mockLearning);
    });

    it('should return null when learning not found', async () => {
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

      await expect(repository.findById('learning-123')).rejects.toThrow(
        'Failed to fetch learning: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return learning when found', async () => {
      const result = await repository.findByIdOrThrow('learning-123');

      expect(result).toEqual(mockLearning);
    });

    it('should throw NotFoundException when learning not found', async () => {
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
    it('should create learning successfully', async () => {
      const createData = {
        scope_level: 'runner' as const,
        learning_type: 'pattern' as const,
        title: 'New Learning',
        description: 'A new learning',
        config: {},
        source_type: 'human' as const,
        status: 'active' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockLearning);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.create({ title: 'Test' })).rejects.toThrow(
        'Create succeeded but no learning returned',
      );
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.create({ title: 'Test' })).rejects.toThrow(
        'Failed to create learning: Insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update learning successfully', async () => {
      const result = await repository.update('learning-123', {
        title: 'Updated Title',
      });

      expect(result).toEqual(mockLearning);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('learning-123', { title: 'Updated' }),
      ).rejects.toThrow('Update succeeded but no learning returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('learning-123', { title: 'Updated' }),
      ).rejects.toThrow('Failed to update learning: Update failed');
    });
  });

  describe('incrementApplication', () => {
    it('should increment application count', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.incrementApplication('learning-123'),
      ).resolves.toBeUndefined();
    });

    it('should track helpfulness', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.incrementApplication('learning-123', true),
      ).resolves.toBeUndefined();
    });

    it('should throw error on RPC failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.incrementApplication('learning-123'),
      ).rejects.toThrow('Failed to increment learning application: RPC failed');
    });
  });

  describe('findByScope', () => {
    it('should find learnings by scope', async () => {
      const result = await repository.findByScope('runner');

      expect(result).toEqual([mockLearning]);
    });

    it('should filter by domain', async () => {
      const result = await repository.findByScope('domain', 'stocks');

      expect(result).toBeDefined();
    });

    it('should filter by universe', async () => {
      const result = await repository.findByScope(
        'universe',
        undefined,
        'universe-123',
      );

      expect(result).toBeDefined();
    });

    it('should filter by target', async () => {
      const result = await repository.findByScope(
        'target',
        undefined,
        undefined,
        'target-123',
      );

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      const result = await repository.findByScope(
        'runner',
        undefined,
        undefined,
        undefined,
        'active',
      );

      expect(result).toBeDefined();
    });

    it('should return empty array when no learnings found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScope('runner');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByScope('runner')).rejects.toThrow(
        'Failed to find learnings by scope: Query failed',
      );
    });
  });

  describe('supersede', () => {
    it('should supersede learning', async () => {
      const result = await repository.supersede(
        'learning-123',
        'new-learning-456',
      );

      expect(result).toBeDefined();
    });
  });

  describe('getAllActiveLearnings', () => {
    it('should return all active learnings', async () => {
      const result = await repository.getAllActiveLearnings();

      expect(result).toEqual([mockLearning]);
    });

    it('should return empty array when no active learnings', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getAllActiveLearnings();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.getAllActiveLearnings()).rejects.toThrow(
        'Failed to get all active learnings: Query failed',
      );
    });
  });

  describe('createTestCopy', () => {
    it('should create test copy of learning', async () => {
      const result = await repository.createTestCopy(
        mockLearning,
        'scenario-123',
      );

      expect(result).toBeDefined();
    });
  });

  describe('deleteTestLearnings', () => {
    it('should delete test learnings', async () => {
      const mockClient = createMockClient({
        delete: { error: null, count: 5 },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.deleteTestLearnings('scenario-123');

      expect(result).toBe(5);
    });

    it('should return 0 when no test learnings deleted', async () => {
      const mockClient = createMockClient({
        delete: { error: null, count: 0 },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.deleteTestLearnings('scenario-123');

      expect(result).toBe(0);
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.deleteTestLearnings('scenario-123'),
      ).rejects.toThrow('Failed to delete test learnings: Delete failed');
    });
  });

  describe('learning types', () => {
    const learningTypes = [
      'rule',
      'pattern',
      'weight_adjustment',
      'threshold',
      'avoid',
    ] as const;

    learningTypes.forEach((learningType) => {
      it(`should handle ${learningType} learning type`, async () => {
        const learningWithType = {
          ...mockLearning,
          learning_type: learningType,
        };
        const mockClient = createMockClient({
          single: { data: learningWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('learning-123');

        expect(result?.learning_type).toBe(learningType);
      });
    });
  });

  describe('learning statuses', () => {
    const statuses = ['active', 'superseded', 'disabled'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const learningWithStatus = { ...mockLearning, status };
        const mockClient = createMockClient({
          single: { data: learningWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('learning-123');

        expect(result?.status).toBe(status);
      });
    });
  });
});
