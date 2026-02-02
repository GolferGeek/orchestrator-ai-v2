import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LearningQueueRepository } from '../learning-queue.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { LearningQueue } from '../../interfaces/learning.interface';

describe('LearningQueueRepository', () => {
  let repository: LearningQueueRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockQueueItem: LearningQueue = {
    id: 'queue-123',
    suggested_scope_level: 'target',
    suggested_domain: 'stocks',
    suggested_universe_id: null,
    suggested_target_id: 'target-123',
    suggested_analyst_id: null,
    suggested_learning_type: 'pattern',
    suggested_title: 'Test Pattern',
    suggested_description: 'A test learning pattern',
    suggested_config: { trigger_condition: 'price > 100' },
    source_evaluation_id: 'eval-123',
    source_missed_opportunity_id: null,
    ai_reasoning: 'Pattern detected from historical data',
    ai_confidence: 0.85,
    status: 'pending',
    reviewed_at: null,
    reviewed_by_user_id: null,
    reviewer_notes: null,
    final_scope_level: null,
    final_domain: null,
    final_universe_id: null,
    final_target_id: null,
    final_analyst_id: null,
    learning_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockApprovedItem: LearningQueue = {
    ...mockQueueItem,
    id: 'queue-456',
    status: 'approved',
    reviewed_at: '2024-01-02T00:00:00Z',
    reviewed_by_user_id: 'user-123',
    final_scope_level: 'target',
    final_target_id: 'target-123',
    learning_id: 'learning-123',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string; code?: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockQueueItem, error: null };
    const listResult = overrides?.list ?? { data: [mockQueueItem], error: null };
    const insertResult = overrides?.insert ?? { data: mockQueueItem, error: null };
    const updateResult = overrides?.update ?? { data: mockQueueItem, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
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
        LearningQueueRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<LearningQueueRepository>(LearningQueueRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return queue item when found', async () => {
      const result = await repository.findById('queue-123');

      expect(result).toEqual(mockQueueItem);
    });

    it('should return null when queue item not found', async () => {
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

      await expect(repository.findById('queue-123')).rejects.toThrow(
        'Failed to fetch learning queue item: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return queue item when found', async () => {
      const result = await repository.findByIdOrThrow('queue-123');

      expect(result).toEqual(mockQueueItem);
    });

    it('should throw NotFoundException when queue item not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create queue item successfully', async () => {
      const createData = {
        suggested_scope_level: 'target' as const,
        suggested_title: 'New Pattern',
        suggested_description: 'A new pattern',
        ai_confidence: 0.9,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockQueueItem);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          suggested_scope_level: 'target',
          suggested_title: 'Test',
        }),
      ).rejects.toThrow('Create succeeded but no learning queue item returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          suggested_scope_level: 'target',
          suggested_title: 'Test',
        }),
      ).rejects.toThrow('Failed to create learning queue item: Insert failed');
    });
  });

  describe('update', () => {
    it('should update queue item successfully', async () => {
      const result = await repository.update('queue-123', { status: 'approved' });

      expect(result).toEqual(mockQueueItem);
    });

    it('should update with review details', async () => {
      const mockClient = createMockClient({
        update: { data: mockApprovedItem, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('queue-123', {
        status: 'approved',
        reviewed_at: '2024-01-02T00:00:00Z',
        reviewed_by_user_id: 'user-123',
        final_scope_level: 'target',
        final_target_id: 'target-123',
        learning_id: 'learning-123',
      });

      expect(result.status).toBe('approved');
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('queue-123', { status: 'approved' })).rejects.toThrow(
        'Update succeeded but no learning queue item returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('queue-123', { status: 'approved' })).rejects.toThrow(
        'Failed to update learning queue item: Update failed',
      );
    });
  });

  describe('findByStatus', () => {
    it('should return items with specified status', async () => {
      const result = await repository.findByStatus('pending');

      expect(result).toEqual([mockQueueItem]);
    });

    it('should return approved items', async () => {
      const mockClient = createMockClient({
        list: { data: [mockApprovedItem], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('approved');

      expect(result).toEqual([mockApprovedItem]);
    });

    it('should return empty array when no items found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('rejected');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByStatus('pending')).rejects.toThrow(
        'Failed to find learning queue items by status: Query failed',
      );
    });
  });

  describe('findPending', () => {
    it('should return pending items', async () => {
      const result = await repository.findPending();

      expect(result).toEqual([mockQueueItem]);
    });

    it('should return limited results when limit specified', async () => {
      const items = [mockQueueItem, { ...mockQueueItem, id: 'queue-456' }];
      const mockClient = createMockClient({
        list: { data: items, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPending(5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no pending items', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPending();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findPending()).rejects.toThrow(
        'Failed to find pending learning queue items: Query failed',
      );
    });
  });

  describe('findBySourceEvaluation', () => {
    it('should return items for evaluation', async () => {
      const result = await repository.findBySourceEvaluation('eval-123');

      expect(result).toEqual([mockQueueItem]);
    });

    it('should return empty array when no items found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySourceEvaluation('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySourceEvaluation('eval-123')).rejects.toThrow(
        'Failed to find learning queue items by evaluation: Query failed',
      );
    });
  });

  describe('findBySourceMissedOpportunity', () => {
    it('should return items for missed opportunity', async () => {
      const itemWithMissedOpp = {
        ...mockQueueItem,
        source_evaluation_id: null,
        source_missed_opportunity_id: 'missed-123',
      };
      const mockClient = createMockClient({
        list: { data: [itemWithMissedOpp], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySourceMissedOpportunity('missed-123');

      expect(result).toEqual([itemWithMissedOpp]);
    });

    it('should return empty array when no items found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySourceMissedOpportunity('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySourceMissedOpportunity('missed-123')).rejects.toThrow(
        'Failed to find learning queue items by missed opportunity: Query failed',
      );
    });
  });

  describe('status values', () => {
    const statuses = ['pending', 'approved', 'rejected', 'modified'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const itemWithStatus = { ...mockQueueItem, status };
        const mockClient = createMockClient({
          single: { data: itemWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('queue-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('scope levels', () => {
    const scopeLevels = ['runner', 'domain', 'universe', 'target', 'analyst'] as const;

    scopeLevels.forEach((scopeLevel) => {
      it(`should handle ${scopeLevel} scope level`, async () => {
        const itemWithScope = { ...mockQueueItem, suggested_scope_level: scopeLevel };
        const mockClient = createMockClient({
          single: { data: itemWithScope, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('queue-123');

        expect(result?.suggested_scope_level).toBe(scopeLevel);
      });
    });
  });

  describe('learning types', () => {
    const learningTypes = ['rule', 'pattern', 'weight_adjustment', 'threshold', 'avoid'] as const;

    learningTypes.forEach((learningType) => {
      it(`should handle ${learningType} learning type`, async () => {
        const itemWithType = { ...mockQueueItem, suggested_learning_type: learningType };
        const mockClient = createMockClient({
          single: { data: itemWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('queue-123');

        expect(result?.suggested_learning_type).toBe(learningType);
      });
    });
  });
});
