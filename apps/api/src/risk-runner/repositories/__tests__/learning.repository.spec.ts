import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LearningRepository, LearningFilter } from '../learning.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  RiskLearning,
  RiskLearningQueueItem,
  PendingLearningView,
  LearningConfig,
} from '../../interfaces/learning.interface';

describe('LearningRepository', () => {
  let repository: LearningRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockLearningConfig: LearningConfig = {
    rule_condition: 'volatility > 0.3',
    rule_action: 'increase_weight_by_0.2',
    applies_to: ['market', 'fundamental'],
  };

  const mockLearning: RiskLearning = {
    id: 'learning-123',
    scope_level: 'domain',
    domain: 'investment',
    scope_id: null,
    subject_id: null,
    dimension_id: null,
    learning_type: 'rule',
    title: 'High volatility adjustment',
    description: 'Increase weight when volatility exceeds threshold',
    config: mockLearningConfig,
    times_applied: 15,
    times_helpful: 12,
    effectiveness_score: 0.8,
    status: 'active',
    is_test: false,
    source_type: 'ai_approved',
    parent_learning_id: null,
    is_production: true,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockQueueItem: RiskLearningQueueItem = {
    id: 'queue-123',
    scope_id: 'scope-123',
    subject_id: null,
    evaluation_id: 'eval-123',
    suggested_scope_level: 'scope',
    suggested_learning_type: 'pattern',
    suggested_title: 'New pattern detected',
    suggested_description: 'Market drops often follow this pattern',
    suggested_config: { pattern_signals: ['price_drop', 'volume_spike'] },
    ai_reasoning: 'Observed in 10 out of 12 evaluations',
    ai_confidence: 0.85,
    status: 'pending',
    reviewed_by_user_id: null,
    reviewer_notes: null,
    reviewed_at: null,
    learning_id: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-15T00:00:00Z',
  };

  const mockPendingView: PendingLearningView = {
    ...mockQueueItem,
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'Tech Portfolio',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockLearning, error: null };
    const listResult = overrides?.list ?? { data: [mockLearning], error: null };
    const insertResult = overrides?.insert ?? { data: mockLearning, error: null };
    const updateResult = overrides?.update ?? { data: mockLearning, error: null };
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

  // ─── LEARNINGS ────────────────────────────────────────────────────────

  describe('findAllLearnings', () => {
    it('should return all active learnings', async () => {
      const result = await repository.findAllLearnings();

      expect(result).toEqual([mockLearning]);
    });

    it('should return empty array when no learnings found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllLearnings();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAllLearnings()).rejects.toThrow(
        'Failed to fetch learnings: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: LearningFilter = { includeTest: true };
      const result = await repository.findAllLearnings(filter);

      expect(result).toEqual([mockLearning]);
    });
  });

  describe('findLearningsByScope', () => {
    it('should return learnings for scope', async () => {
      const result = await repository.findLearningsByScope('scope-123');

      expect(result).toEqual([mockLearning]);
    });

    it('should return empty array when no learnings found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningsByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findLearningsByScope('scope-123')).rejects.toThrow(
        'Failed to fetch learnings by scope: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: LearningFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findLearningsByScope('scope-123', filter);

      expect(result).toEqual([mockLearning]);
    });
  });

  describe('findProductionLearnings', () => {
    it('should return production learnings', async () => {
      const result = await repository.findProductionLearnings();

      expect(result).toEqual([mockLearning]);
    });

    it('should filter by scope level', async () => {
      const result = await repository.findProductionLearnings('domain');

      expect(result).toEqual([mockLearning]);
    });

    it('should filter by domain', async () => {
      const result = await repository.findProductionLearnings(undefined, 'investment');

      expect(result).toEqual([mockLearning]);
    });

    it('should filter by both scope level and domain', async () => {
      const result = await repository.findProductionLearnings('domain', 'investment');

      expect(result).toEqual([mockLearning]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findProductionLearnings()).rejects.toThrow(
        'Failed to fetch production learnings: Query failed',
      );
    });
  });

  describe('findLearningById', () => {
    it('should return learning when found', async () => {
      const result = await repository.findLearningById('learning-123');

      expect(result).toEqual(mockLearning);
    });

    it('should return null when learning not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findLearningById('learning-123')).rejects.toThrow(
        'Failed to fetch learning: Database error',
      );
    });
  });

  describe('findLearningByIdOrThrow', () => {
    it('should return learning when found', async () => {
      const result = await repository.findLearningByIdOrThrow('learning-123');

      expect(result).toEqual(mockLearning);
    });

    it('should throw NotFoundException when learning not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findLearningByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createLearning', () => {
    it('should create learning successfully', async () => {
      const createData = {
        scope_level: 'domain' as const,
        learning_type: 'rule' as const,
        title: 'New Learning',
      };

      const result = await repository.createLearning(createData);

      expect(result).toEqual(mockLearning);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createLearning({
          scope_level: 'domain',
          learning_type: 'rule',
          title: 'New Learning',
        }),
      ).rejects.toThrow('Create succeeded but no learning returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createLearning({
          scope_level: 'domain',
          learning_type: 'rule',
          title: 'New Learning',
        }),
      ).rejects.toThrow('Failed to create learning: Insert failed');
    });
  });

  describe('updateLearning', () => {
    it('should update learning successfully', async () => {
      const updatedLearning = { ...mockLearning, title: 'Updated Title' };
      const mockClient = createMockClient({
        update: { data: updatedLearning, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.updateLearning('learning-123', { title: 'Updated Title' });

      expect(result).toEqual(updatedLearning);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.updateLearning('learning-123', { title: 'Updated' }),
      ).rejects.toThrow('Update succeeded but no learning returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.updateLearning('learning-123', { title: 'Updated' }),
      ).rejects.toThrow('Failed to update learning: Update failed');
    });
  });

  describe('incrementApplied', () => {
    it('should increment times_applied counter', async () => {
      const updatedLearning = { ...mockLearning, times_applied: 16 };
      const mockClient = createMockClient({
        single: { data: mockLearning, error: null },
        update: { data: updatedLearning, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.incrementApplied('learning-123')).resolves.toBeUndefined();
    });
  });

  describe('incrementHelpful', () => {
    it('should increment times_helpful counter', async () => {
      const updatedLearning = { ...mockLearning, times_helpful: 13 };
      const mockClient = createMockClient({
        single: { data: mockLearning, error: null },
        update: { data: updatedLearning, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.incrementHelpful('learning-123')).resolves.toBeUndefined();
    });
  });

  describe('deleteLearning', () => {
    it('should delete learning successfully', async () => {
      await expect(repository.deleteLearning('learning-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.deleteLearning('learning-123')).rejects.toThrow(
        'Failed to delete learning: Delete failed',
      );
    });
  });

  // ─── LEARNING QUEUE ────────────────────────────────────────────────────────

  describe('findPendingQueue', () => {
    it('should return pending queue items from view', async () => {
      const mockClient = createMockClient({
        list: { data: [mockPendingView], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingQueue();

      expect(result).toEqual([mockPendingView]);
    });

    it('should return empty array when no pending items', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingQueue();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findPendingQueue()).rejects.toThrow(
        'Failed to fetch pending learnings: Query failed',
      );
    });
  });

  describe('findQueueByScope', () => {
    it('should return queue items for scope', async () => {
      const mockClient = createMockClient({
        list: { data: [mockQueueItem], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findQueueByScope('scope-123');

      expect(result).toEqual([mockQueueItem]);
    });

    it('should return empty array when no items found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findQueueByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findQueueByScope('scope-123')).rejects.toThrow(
        'Failed to fetch learning queue: Query failed',
      );
    });
  });

  describe('findQueueItemById', () => {
    it('should return queue item when found', async () => {
      const mockClient = createMockClient({
        single: { data: mockQueueItem, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findQueueItemById('queue-123');

      expect(result).toEqual(mockQueueItem);
    });

    it('should return null when item not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findQueueItemById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findQueueItemById('queue-123')).rejects.toThrow(
        'Failed to fetch queue item: Database error',
      );
    });
  });

  describe('findQueueItemByIdOrThrow', () => {
    it('should return queue item when found', async () => {
      const mockClient = createMockClient({
        single: { data: mockQueueItem, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findQueueItemByIdOrThrow('queue-123');

      expect(result).toEqual(mockQueueItem);
    });

    it('should throw NotFoundException when item not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findQueueItemByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createQueueItem', () => {
    it('should create queue item successfully', async () => {
      const mockClient = createMockClient({
        insert: { data: mockQueueItem, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const createData = {
        suggested_title: 'New pattern',
      };

      const result = await repository.createQueueItem(createData);

      expect(result).toEqual(mockQueueItem);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createQueueItem({ suggested_title: 'Test' }),
      ).rejects.toThrow('Create succeeded but no queue item returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createQueueItem({ suggested_title: 'Test' }),
      ).rejects.toThrow('Failed to create queue item: Insert failed');
    });
  });

  describe('updateQueueItem', () => {
    it('should update queue item successfully', async () => {
      const updatedItem = { ...mockQueueItem, status: 'approved' as const };
      const mockClient = createMockClient({
        update: { data: updatedItem, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.updateQueueItem('queue-123', { status: 'approved' });

      expect(result).toEqual(updatedItem);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.updateQueueItem('queue-123', { status: 'approved' }),
      ).rejects.toThrow('Update succeeded but no queue item returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.updateQueueItem('queue-123', { status: 'approved' }),
      ).rejects.toThrow('Failed to update queue item: Update failed');
    });
  });

  describe('deleteQueueItem', () => {
    it('should delete queue item successfully', async () => {
      await expect(repository.deleteQueueItem('queue-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.deleteQueueItem('queue-123')).rejects.toThrow(
        'Failed to delete queue item: Delete failed',
      );
    });
  });

  describe('countPending', () => {
    it('should count pending queue items', async () => {
      const pendingItems = [mockPendingView, mockPendingView, mockPendingView];
      const mockClient = createMockClient({
        list: { data: pendingItems, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.countPending();

      expect(result).toBe(3);
    });

    it('should return 0 when no pending items', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.countPending();

      expect(result).toBe(0);
    });
  });

  // ─── TYPE TESTS ────────────────────────────────────────────────────────

  describe('scope levels', () => {
    const scopeLevels = ['runner', 'domain', 'scope', 'subject', 'dimension'] as const;

    scopeLevels.forEach((scopeLevel) => {
      it(`should handle ${scopeLevel} scope level`, async () => {
        const learningWithScopeLevel = { ...mockLearning, scope_level: scopeLevel };
        const mockClient = createMockClient({
          single: { data: learningWithScopeLevel, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findLearningById('learning-123');

        expect(result?.scope_level).toBe(scopeLevel);
      });
    });
  });

  describe('learning types', () => {
    const learningTypes = ['rule', 'pattern', 'avoid', 'weight_adjustment', 'threshold'] as const;

    learningTypes.forEach((learningType) => {
      it(`should handle ${learningType} learning type`, async () => {
        const learningWithType = { ...mockLearning, learning_type: learningType };
        const mockClient = createMockClient({
          single: { data: learningWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findLearningById('learning-123');

        expect(result?.learning_type).toBe(learningType);
      });
    });
  });

  describe('learning statuses', () => {
    const statuses = ['active', 'testing', 'retired', 'superseded'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const learningWithStatus = { ...mockLearning, status };
        const mockClient = createMockClient({
          single: { data: learningWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findLearningById('learning-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('queue item statuses', () => {
    const statuses = ['pending', 'approved', 'rejected', 'modified'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} queue status`, async () => {
        const itemWithStatus = { ...mockQueueItem, status };
        const mockClient = createMockClient({
          single: { data: itemWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findQueueItemById('queue-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('source types', () => {
    const sourceTypes = ['human', 'ai_suggested', 'ai_approved', null] as const;

    sourceTypes.forEach((sourceType) => {
      it(`should handle ${sourceType ?? 'null'} source type`, async () => {
        const learningWithSourceType = { ...mockLearning, source_type: sourceType };
        const mockClient = createMockClient({
          single: { data: learningWithSourceType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findLearningById('learning-123');

        expect(result?.source_type).toBe(sourceType);
      });
    });
  });

  describe('learning config handling', () => {
    it('should handle rule config', async () => {
      const ruleConfig: LearningConfig = {
        rule_condition: 'volatility > 0.5',
        rule_action: 'increase_risk_score',
        applies_to: ['market'],
      };
      const learningWithConfig = { ...mockLearning, config: ruleConfig };
      const mockClient = createMockClient({
        single: { data: learningWithConfig, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('learning-123');

      expect(result?.config.rule_condition).toBe('volatility > 0.5');
    });

    it('should handle pattern config', async () => {
      const patternConfig: LearningConfig = {
        pattern_signals: ['price_drop', 'volume_spike', 'news_sentiment_negative'],
        pattern_effect: 'high_risk_indicator',
      };
      const learningWithConfig = { ...mockLearning, config: patternConfig };
      const mockClient = createMockClient({
        single: { data: learningWithConfig, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('learning-123');

      expect(result?.config.pattern_signals?.length).toBe(3);
    });

    it('should handle weight adjustment config', async () => {
      const weightConfig: LearningConfig = {
        dimension_slug: 'market',
        weight_modifier: 0.15,
      };
      const learningWithConfig = { ...mockLearning, config: weightConfig };
      const mockClient = createMockClient({
        single: { data: learningWithConfig, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('learning-123');

      expect(result?.config.dimension_slug).toBe('market');
      expect(result?.config.weight_modifier).toBe(0.15);
    });

    it('should handle threshold config', async () => {
      const thresholdConfig: LearningConfig = {
        threshold_name: 'volatility_warning',
        threshold_value: 0.4,
        threshold_direction: 'increase',
      };
      const learningWithConfig = { ...mockLearning, config: thresholdConfig };
      const mockClient = createMockClient({
        single: { data: learningWithConfig, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('learning-123');

      expect(result?.config.threshold_direction).toBe('increase');
    });

    it('should handle empty config', async () => {
      const learningWithEmptyConfig = { ...mockLearning, config: {} };
      const mockClient = createMockClient({
        single: { data: learningWithEmptyConfig, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLearningById('learning-123');

      expect(result?.config).toEqual({});
    });
  });
});
