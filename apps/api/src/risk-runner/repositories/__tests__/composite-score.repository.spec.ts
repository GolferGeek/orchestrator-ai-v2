import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompositeScoreRepository, CompositeScoreFilter } from '../composite-score.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskCompositeScore, ActiveCompositeScoreView } from '../../interfaces/composite-score.interface';

describe('CompositeScoreRepository', () => {
  let repository: CompositeScoreRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-123',
    subject_id: 'subject-123',
    task_id: 'task-123',
    overall_score: 65,
    dimension_scores: {
      market: 70,
      fundamental: 55,
      technical: 72,
    },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.85,
    status: 'active',
    valid_until: '2024-02-01T00:00:00Z',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockActiveView: ActiveCompositeScoreView = {
    ...mockCompositeScore,
    scope_id: 'scope-123',
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    subject_type: 'stock',
    scope_name: 'Tech Portfolio',
    scope_domain: 'investment',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockCompositeScore, error: null };
    const listResult = overrides?.list ?? { data: [mockCompositeScore], error: null };
    const insertResult = overrides?.insert ?? { data: mockCompositeScore, error: null };
    const updateResult = overrides?.update ?? { data: mockCompositeScore, error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        lt: jest.fn(),
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
      (chainableResult.lt as jest.Mock).mockReturnValue(chainableResult);
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
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
            then: (resolve: (v: unknown) => void) => resolve(listResult),
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
        CompositeScoreRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<CompositeScoreRepository>(CompositeScoreRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findBySubject', () => {
    it('should return composite scores for subject', async () => {
      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([mockCompositeScore]);
    });

    it('should return empty array when no scores found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch composite scores: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: CompositeScoreFilter = { includeTest: true };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockCompositeScore]);
    });
  });

  describe('findActiveBySubject', () => {
    it('should return active composite score for subject', async () => {
      const result = await repository.findActiveBySubject('subject-123');

      expect(result).toEqual(mockCompositeScore);
    });

    it('should return null when no active score found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveBySubject('subject-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findActiveBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch active composite score: Database error',
      );
    });

    it('should apply filter', async () => {
      const filter: CompositeScoreFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findActiveBySubject('subject-123', filter);

      expect(result).toEqual(mockCompositeScore);
    });
  });

  describe('findAllActiveView', () => {
    it('should return all active scores from view', async () => {
      const mockClient = createMockClient({
        list: { data: [mockActiveView], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllActiveView();

      expect(result).toEqual([mockActiveView]);
    });

    it('should return empty array when no active scores', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllActiveView();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAllActiveView()).rejects.toThrow(
        'Failed to fetch active composite scores view: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return composite score when found', async () => {
      const result = await repository.findById('score-123');

      expect(result).toEqual(mockCompositeScore);
    });

    it('should return null when score not found', async () => {
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

      await expect(repository.findById('score-123')).rejects.toThrow(
        'Failed to fetch composite score: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return composite score when found', async () => {
      const result = await repository.findByIdOrThrow('score-123');

      expect(result).toEqual(mockCompositeScore);
    });

    it('should throw NotFoundException when score not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTask', () => {
    it('should return composite score for task', async () => {
      const result = await repository.findByTask('task-123');

      expect(result).toEqual(mockCompositeScore);
    });

    it('should return null when no score for task', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByTask('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByTask('task-123')).rejects.toThrow(
        'Failed to fetch composite score by task: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create composite score successfully', async () => {
      const createData = {
        subject_id: 'subject-123',
        overall_score: 65,
        dimension_scores: { market: 70, fundamental: 55 },
        confidence: 0.85,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockCompositeScore);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          overall_score: 65,
          dimension_scores: {},
          confidence: 0.85,
        }),
      ).rejects.toThrow('Create succeeded but no composite score returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          overall_score: 65,
          dimension_scores: {},
          confidence: 0.85,
        }),
      ).rejects.toThrow('Failed to create composite score: Insert failed');
    });
  });

  describe('update', () => {
    it('should update composite score successfully', async () => {
      const updatedScore = { ...mockCompositeScore, overall_score: 75 };
      const mockClient = createMockClient({
        update: { data: updatedScore, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('score-123', { overall_score: 75 });

      expect(result).toEqual(updatedScore);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('score-123', { overall_score: 75 })).rejects.toThrow(
        'Update succeeded but no composite score returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('score-123', { overall_score: 75 })).rejects.toThrow(
        'Failed to update composite score: Update failed',
      );
    });
  });

  describe('supersedeForSubject', () => {
    it('should supersede active scores for subject', async () => {
      const mockClient = createMockClient({
        list: { data: [mockCompositeScore, mockCompositeScore], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.supersedeForSubject('subject-123');

      expect(result).toBe(2);
    });

    it('should return 0 when no scores to supersede', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.supersedeForSubject('subject-123');

      expect(result).toBe(0);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.supersedeForSubject('subject-123')).rejects.toThrow(
        'Failed to supersede composite scores: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete composite score successfully', async () => {
      await expect(repository.delete('score-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('score-123')).rejects.toThrow(
        'Failed to delete composite score: Delete failed',
      );
    });
  });

  describe('findScoresOlderThan', () => {
    it('should return old active scores', async () => {
      const result = await repository.findScoresOlderThan(new Date('2024-06-01'));

      expect(result).toEqual([mockCompositeScore]);
    });

    it('should return empty array when no old scores', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findScoresOlderThan(new Date('2024-06-01'));

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findScoresOlderThan(new Date('2024-06-01'))).rejects.toThrow(
        'Failed to fetch old composite scores: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: CompositeScoreFilter = { includeTest: true };
      const result = await repository.findScoresOlderThan(new Date('2024-06-01'), filter);

      expect(result).toEqual([mockCompositeScore]);
    });
  });

  describe('findHistory', () => {
    it('should return score history for subject', async () => {
      const result = await repository.findHistory('subject-123');

      expect(result).toEqual([mockCompositeScore]);
    });

    it('should accept custom limit', async () => {
      const result = await repository.findHistory('subject-123', 10);

      expect(result).toEqual([mockCompositeScore]);
    });

    it('should return empty array when no history', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findHistory('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findHistory('subject-123')).rejects.toThrow(
        'Failed to fetch score history: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: CompositeScoreFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findHistory('subject-123', 30, filter);

      expect(result).toEqual([mockCompositeScore]);
    });
  });

  describe('score statuses', () => {
    const statuses = ['active', 'superseded', 'expired'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const scoreWithStatus = { ...mockCompositeScore, status };
        const mockClient = createMockClient({
          single: { data: scoreWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('score-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('dimension scores', () => {
    it('should handle empty dimension scores', async () => {
      const scoreWithEmptyDimensions = { ...mockCompositeScore, dimension_scores: {} };
      const mockClient = createMockClient({
        single: { data: scoreWithEmptyDimensions, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('score-123');

      expect(result?.dimension_scores).toEqual({});
    });

    it('should handle multiple dimension scores', async () => {
      const scoreWithDimensions = {
        ...mockCompositeScore,
        dimension_scores: {
          market: 70,
          fundamental: 55,
          technical: 72,
          macro: 60,
          correlation: 45,
        },
      };
      const mockClient = createMockClient({
        single: { data: scoreWithDimensions, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('score-123');

      expect(Object.keys(result?.dimension_scores ?? {}).length).toBe(5);
    });
  });

  describe('debate adjustment', () => {
    it('should handle score with debate adjustment', async () => {
      const scoreWithDebate = {
        ...mockCompositeScore,
        debate_id: 'debate-123',
        debate_adjustment: -5,
        pre_debate_score: 70,
      };
      const mockClient = createMockClient({
        single: { data: scoreWithDebate, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('score-123');

      expect(result?.debate_id).toBe('debate-123');
      expect(result?.debate_adjustment).toBe(-5);
      expect(result?.pre_debate_score).toBe(70);
    });
  });
});
