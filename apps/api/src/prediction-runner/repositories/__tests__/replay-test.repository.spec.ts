import { Test, TestingModule } from '@nestjs/testing';
import { ReplayTestRepository } from '../replay-test.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { ReplayTest, ReplayTestSnapshot, ReplayTestResult, ReplayTestSummary } from '../../interfaces/test-data.interface';

describe('ReplayTestRepository', () => {
  let repository: ReplayTestRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockReplayTest: ReplayTest = {
    id: 'replay-123',
    organization_slug: 'test-org',
    name: 'Test Replay',
    description: 'A test replay scenario',
    status: 'pending',
    rollback_depth: 'predictions',
    rollback_to: '2024-01-01T00:00:00Z',
    universe_id: 'universe-123',
    target_ids: ['target-1', 'target-2'],
    config: { auto_run: true, skip_confirmation: false },
    results: null,
    error_message: null,
    created_by: 'user-123',
    created_at: '2024-01-01T10:00:00Z',
    started_at: null,
    completed_at: null,
  };

  const mockCompletedTest: ReplayTest = {
    ...mockReplayTest,
    id: 'replay-456',
    status: 'completed',
    started_at: '2024-01-01T11:00:00Z',
    completed_at: '2024-01-01T12:00:00Z',
    results: {
      total_comparisons: 100,
      direction_matches: 85,
      original_correct_count: 60,
      replay_correct_count: 70,
      improvements: 10,
      original_accuracy_pct: 60,
      replay_accuracy_pct: 70,
      accuracy_delta: 10,
      total_pnl_original: 1000,
      total_pnl_replay: 1500,
      pnl_delta: 500,
      avg_confidence_diff: 0.05,
    },
  };

  const mockSnapshot: ReplayTestSnapshot = {
    id: 'snapshot-123',
    replay_test_id: 'replay-123',
    table_name: 'predictions',
    original_data: [{ id: 'pred-1' }, { id: 'pred-2' }],
    record_ids: ['pred-1', 'pred-2'],
    row_count: 2,
    created_at: '2024-01-01T10:30:00Z',
  };

  const mockResult: ReplayTestResult = {
    id: 'result-123',
    replay_test_id: 'replay-123',
    target_id: 'target-1',
    original_prediction_id: 'pred-1',
    original_direction: 'up',
    original_confidence: 0.75,
    original_magnitude: 'medium',
    original_predicted_at: '2024-01-01T08:00:00Z',
    replay_prediction_id: 'pred-new-1',
    replay_direction: 'up',
    replay_confidence: 0.85,
    replay_magnitude: 'medium',
    replay_predicted_at: '2024-01-01T11:30:00Z',
    direction_match: true,
    confidence_diff: 0.1,
    evaluation_id: 'eval-1',
    actual_outcome: 'up',
    actual_outcome_value: 5.5,
    original_correct: true,
    replay_correct: true,
    improvement: false,
    pnl_original: 100,
    pnl_replay: 150,
    pnl_diff: 50,
    created_at: '2024-01-01T12:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    insertBatch?: { error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string; code?: string } | null };
    delete?: { error: { message: string } | null; count?: number };
    rpc?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockReplayTest, error: null };
    const listResult = overrides?.list ?? { data: [mockReplayTest], error: null };
    const insertResult = overrides?.insert ?? { data: mockReplayTest, error: null };
    const insertBatchResult = overrides?.insertBatch ?? { error: null };
    const updateResult = overrides?.update ?? { data: mockReplayTest, error: null };
    const deleteResult = overrides?.delete ?? { error: null, count: 0 };
    const rpcResult = overrides?.rpc ?? { data: 'snapshot-id', error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockImplementation((data) => {
        if (Array.isArray(data)) {
          return {
            then: (resolve: (v: unknown) => void) => resolve(insertBatchResult),
          };
        }
        return {
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(insertResult),
            }),
          }),
        };
      });

      const updateChain: Record<string, unknown> = {
        eq: jest.fn(),
        in: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve({ error: null, count: 1 }),
      };
      (updateChain.eq as jest.Mock).mockReturnValue(updateChain);
      (updateChain.in as jest.Mock).mockReturnValue(updateChain);
      (updateChain.select as jest.Mock).mockReturnValue(updateChain);
      (updateChain.single as jest.Mock).mockReturnValue({
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
      });
      (chainableResult.update as jest.Mock).mockReturnValue(updateChain);

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        in: jest.fn(),
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.in as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.select as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
        rpc: jest.fn().mockReturnValue(rpcResult),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayTestRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<ReplayTestRepository>(ReplayTestRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return replay test when found', async () => {
      const result = await repository.findById('replay-123');

      expect(result).toEqual(mockReplayTest);
    });

    it('should return null when replay test not found', async () => {
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

      await expect(repository.findById('replay-123')).rejects.toThrow(
        'Failed to fetch replay test: Database error',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return replay tests for organization', async () => {
      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([mockReplayTest]);
    });

    it('should return empty array when no tests found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByOrganization('test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByOrganization('test-org')).rejects.toThrow(
        'Failed to fetch replay tests: Query failed',
      );
    });
  });

  describe('findByUniverse', () => {
    it('should return replay tests for universe', async () => {
      const result = await repository.findByUniverse('universe-123');

      expect(result).toEqual([mockReplayTest]);
    });

    it('should return empty array when no tests found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByUniverse('universe-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByUniverse('universe-123')).rejects.toThrow(
        'Failed to fetch replay tests by universe: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create replay test successfully', async () => {
      const createData = {
        name: 'New Replay Test',
        organization_slug: 'test-org',
        rollback_depth: 'predictions' as const,
        rollback_to: '2024-01-01T00:00:00Z',
        universe_id: 'universe-123',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockReplayTest);
    });

    it('should create with all optional fields', async () => {
      const createData = {
        name: 'Full Replay Test',
        description: 'A comprehensive test',
        organization_slug: 'test-org',
        rollback_depth: 'signals' as const,
        rollback_to: '2024-01-01T00:00:00Z',
        universe_id: 'universe-123',
        target_ids: ['target-1', 'target-2'],
        config: { auto_run: true, skip_confirmation: true },
        created_by: 'user-123',
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
          name: 'Test',
          organization_slug: 'test-org',
          rollback_depth: 'predictions',
          rollback_to: '2024-01-01T00:00:00Z',
          universe_id: 'universe-123',
        }),
      ).rejects.toThrow('Create succeeded but no replay test returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          name: 'Test',
          organization_slug: 'test-org',
          rollback_depth: 'predictions',
          rollback_to: '2024-01-01T00:00:00Z',
          universe_id: 'universe-123',
        }),
      ).rejects.toThrow('Failed to create replay test: Insert failed');
    });
  });

  describe('update', () => {
    it('should update replay test successfully', async () => {
      const result = await repository.update('replay-123', { name: 'Updated Name' });

      expect(result).toEqual(mockReplayTest);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('replay-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no replay test returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('replay-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update replay test: Update failed',
      );
    });
  });

  describe('status transitions', () => {
    it('should mark as snapshot_created', async () => {
      const snapshotCreatedTest = { ...mockReplayTest, status: 'snapshot_created' as const };
      const mockClient = createMockClient({
        update: { data: snapshotCreatedTest, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markSnapshotCreated('replay-123');

      expect(result.status).toBe('snapshot_created');
    });

    it('should mark as running', async () => {
      const runningTest = { ...mockReplayTest, status: 'running' as const };
      const mockClient = createMockClient({
        update: { data: runningTest, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markRunning('replay-123');

      expect(result.status).toBe('running');
    });

    it('should mark as completed with results', async () => {
      const mockClient = createMockClient({
        update: { data: mockCompletedTest, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markCompleted('replay-123', mockCompletedTest.results);

      expect(result.status).toBe('completed');
      expect(result.results).toBeDefined();
    });

    it('should mark as failed with error message', async () => {
      const failedTest = { ...mockReplayTest, status: 'failed' as const, error_message: 'Test failed' };
      const mockClient = createMockClient({
        update: { data: failedTest, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markFailed('replay-123', 'Test failed');

      expect(result.status).toBe('failed');
      expect(result.error_message).toBe('Test failed');
    });

    it('should mark as restored', async () => {
      const restoredTest = { ...mockReplayTest, status: 'restored' as const };
      const mockClient = createMockClient({
        update: { data: restoredTest, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.markRestored('replay-123');

      expect(result.status).toBe('restored');
    });
  });

  describe('delete', () => {
    it('should delete replay test successfully', async () => {
      await expect(repository.delete('replay-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('replay-123')).rejects.toThrow(
        'Failed to delete replay test: Delete failed',
      );
    });
  });

  describe('snapshots', () => {
    it('should create snapshot using RPC', async () => {
      const result = await repository.createSnapshot('replay-123', 'predictions', ['pred-1', 'pred-2']);

      expect(result).toBe('snapshot-id');
    });

    it('should throw error on snapshot creation failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createSnapshot('replay-123', 'predictions', ['pred-1']),
      ).rejects.toThrow('Failed to create snapshot: RPC failed');
    });

    it('should get snapshots for replay test', async () => {
      const mockClient = createMockClient({
        list: { data: [mockSnapshot], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSnapshots('replay-123');

      expect(result).toEqual([mockSnapshot]);
    });

    it('should throw error on get snapshots failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getSnapshots('replay-123')).rejects.toThrow(
        'Failed to fetch snapshots: Query failed',
      );
    });

    it('should restore snapshot using RPC', async () => {
      const mockClient = createMockClient({
        rpc: { data: 5, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.restoreSnapshot('snapshot-123');

      expect(result).toBe(5);
    });

    it('should throw error on restore failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'Restore failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.restoreSnapshot('snapshot-123')).rejects.toThrow(
        'Failed to restore snapshot: Restore failed',
      );
    });
  });

  describe('results', () => {
    it('should create single result', async () => {
      const mockClient = createMockClient({
        insert: { data: mockResult, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const resultData = { ...mockResult };
      delete (resultData as Record<string, unknown>).id;
      delete (resultData as Record<string, unknown>).created_at;

      const result = await repository.createResult(resultData as Omit<ReplayTestResult, 'id' | 'created_at'>);

      expect(result).toEqual(mockResult);
    });

    it('should throw error when create result returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createResult({
          replay_test_id: 'replay-123',
          target_id: 'target-1',
        } as Omit<ReplayTestResult, 'id' | 'created_at'>),
      ).rejects.toThrow('Create succeeded but no result returned');
    });

    it('should bulk create results', async () => {
      const results = [
        { replay_test_id: 'replay-123', target_id: 'target-1' },
        { replay_test_id: 'replay-123', target_id: 'target-2' },
      ] as Array<Omit<ReplayTestResult, 'id' | 'created_at'>>;

      const count = await repository.createResults(results);

      expect(count).toBe(2);
    });

    it('should return 0 for empty results array', async () => {
      const count = await repository.createResults([]);

      expect(count).toBe(0);
    });

    it('should throw error on bulk create failure', async () => {
      const mockClient = createMockClient({
        insertBatch: { error: { message: 'Bulk insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createResults([{ replay_test_id: 'replay-123' }] as Array<Omit<ReplayTestResult, 'id' | 'created_at'>>),
      ).rejects.toThrow('Failed to bulk create results: Bulk insert failed');
    });

    it('should get results for replay test', async () => {
      const mockClient = createMockClient({
        list: { data: [mockResult], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const results = await repository.getResults('replay-123');

      expect(results).toEqual([mockResult]);
    });

    it('should throw error on get results failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getResults('replay-123')).rejects.toThrow(
        'Failed to fetch results: Query failed',
      );
    });
  });

  describe('summaries', () => {
    it('should get summaries for organization', async () => {
      const mockSummary: ReplayTestSummary = {
        ...mockCompletedTest,
        total_comparisons: 100,
        direction_matches: 85,
        original_correct_count: 60,
        replay_correct_count: 70,
        improvements: 10,
        original_accuracy_pct: 60,
        replay_accuracy_pct: 70,
        total_pnl_original: 1000,
        total_pnl_replay: 1500,
        total_pnl_improvement: 500,
        avg_confidence_diff: 0.05,
      };
      const mockClient = createMockClient({
        list: { data: [mockSummary], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSummaries('test-org');

      expect(result.length).toBe(1);
    });

    it('should throw error on get summaries failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getSummaries('test-org')).rejects.toThrow(
        'Failed to fetch summaries: Query failed',
      );
    });

    it('should get summary by ID', async () => {
      const mockSummary: ReplayTestSummary = {
        ...mockCompletedTest,
        total_comparisons: 100,
        direction_matches: 85,
        original_correct_count: 60,
        replay_correct_count: 70,
        improvements: 10,
        original_accuracy_pct: 60,
        replay_accuracy_pct: 70,
        total_pnl_original: 1000,
        total_pnl_replay: 1500,
        total_pnl_improvement: 500,
        avg_confidence_diff: 0.05,
      };
      const mockClient = createMockClient({
        single: { data: mockSummary, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSummaryById('replay-123');

      expect(result).toBeDefined();
    });

    it('should return null when summary not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getSummaryById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('affected records', () => {
    it('should get affected records using RPC', async () => {
      const mockRecords = [
        { table_name: 'predictions', record_ids: ['pred-1'], row_count: 1 },
        { table_name: 'predictors', record_ids: ['predictor-1'], row_count: 1 },
      ];
      const mockClient = createMockClient({
        rpc: { data: mockRecords, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getAffectedRecords(
        'predictions',
        '2024-01-01T00:00:00Z',
        'universe-123',
      );

      expect(result).toEqual(mockRecords);
    });

    it('should get affected records with target filter', async () => {
      const mockRecords = [{ table_name: 'predictions', record_ids: ['pred-1'], row_count: 1 }];
      const mockClient = createMockClient({
        rpc: { data: mockRecords, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getAffectedRecords(
        'predictions',
        '2024-01-01T00:00:00Z',
        'universe-123',
        ['target-1'],
      );

      expect(result).toEqual(mockRecords);
    });

    it('should throw error on get affected records failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'RPC failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.getAffectedRecords('predictions', '2024-01-01T00:00:00Z', 'universe-123'),
      ).rejects.toThrow('Failed to get affected records: RPC failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup using RPC', async () => {
      const mockClient = createMockClient({
        rpc: { data: { cleaned: true }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.cleanup('replay-123');

      expect(result).toEqual({ cleaned: true });
    });

    it('should throw error on cleanup failure', async () => {
      const mockClient = createMockClient({
        rpc: { data: null, error: { message: 'Cleanup failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.cleanup('replay-123')).rejects.toThrow(
        'Failed to cleanup replay test: Cleanup failed',
      );
    });
  });

  describe('data deletion', () => {
    it('should delete records from table', async () => {
      const mockClient = createMockClient({
        delete: { error: null, count: 5 },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const count = await repository.deleteRecords('predictions', ['pred-1', 'pred-2']);

      expect(count).toBe(5);
    });

    it('should return 0 for empty record IDs', async () => {
      const count = await repository.deleteRecords('predictions', []);

      expect(count).toBe(0);
    });

    it('should throw error on delete records failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.deleteRecords('predictions', ['pred-1'])).rejects.toThrow(
        'Failed to delete records from predictions: Delete failed',
      );
    });
  });

  describe('mark replay predictions as test', () => {
    it('should mark predictions as test data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      // Override to return count
      const updateChain = {
        in: jest.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ error: null, count: 3 }),
      };
      mockClient.schema = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnValue(updateChain),
        }),
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const count = await repository.markReplayPredictionsAsTest('replay-123', ['pred-1', 'pred-2', 'pred-3']);

      expect(count).toBe(3);
    });

    it('should return 0 for empty prediction IDs', async () => {
      const count = await repository.markReplayPredictionsAsTest('replay-123', []);

      expect(count).toBe(0);
    });

    it('should throw error on mark as test failure', async () => {
      const updateChain = {
        in: jest.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ error: { message: 'Update failed' }, count: null }),
      };
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnValue(updateChain),
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.markReplayPredictionsAsTest('replay-123', ['pred-1']),
      ).rejects.toThrow('Failed to mark predictions as test: Update failed');
    });
  });

  describe('rollback depths', () => {
    const depths = ['predictions', 'predictors', 'signals'] as const;

    depths.forEach((depth) => {
      it(`should handle ${depth} rollback depth`, async () => {
        const testWithDepth = { ...mockReplayTest, rollback_depth: depth };
        const mockClient = createMockClient({
          single: { data: testWithDepth, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('replay-123');

        expect(result?.rollback_depth).toBe(depth);
      });
    });
  });

  describe('status values', () => {
    const statuses = ['pending', 'snapshot_created', 'running', 'completed', 'failed', 'restored'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const testWithStatus = { ...mockReplayTest, status };
        const mockClient = createMockClient({
          single: { data: testWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('replay-123');

        expect(result?.status).toBe(status);
      });
    });
  });
});
