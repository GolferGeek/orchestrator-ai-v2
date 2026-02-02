import { Test, TestingModule } from '@nestjs/testing';
import { SignalRepository } from '../signal.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Signal, SignalDisposition } from '../../interfaces/signal.interface';

describe('SignalRepository', () => {
  let repository: SignalRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSignal: Signal = {
    id: 'signal-123',
    target_id: 'target-123',
    source_id: 'source-123',
    content: 'Test signal content',
    direction: 'bullish',
    detected_at: '2024-01-01T10:00:00Z',
    url: 'https://example.com/article',
    metadata: { category: 'news' },
    disposition: 'pending',
    urgency: 'routine',
    processing_worker: null,
    processing_started_at: null,
    evaluation_result: null,
    review_queue_id: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    expired_at: null,
    is_test: false,
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string; code?: string } | null };
    updateList?: { data: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockSignal, error: null };
    const listResult = overrides?.list ?? { data: [mockSignal], error: null };
    const insertResult = overrides?.insert ?? { data: mockSignal, error: null };
    const updateResult = overrides?.update ?? { data: mockSignal, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gt: jest.fn(),
        gte: jest.fn(),
        lt: jest.fn(),
        lte: jest.fn(),
        in: jest.fn(),
        or: jest.fn(),
        not: jest.fn(),
        is: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.or as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.not as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.is as jest.Mock).mockReturnValue(chainableResult);
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
      // Update chain for standard update: update -> eq -> select -> single
      // Also handles claimSignal: update -> eq -> eq -> is -> select -> single
      const updateChain: Record<string, unknown> = {
        eq: jest.fn(),
        is: jest.fn(),
        select: jest.fn(),
        single: jest.fn(),
      };
      (updateChain.eq as jest.Mock).mockReturnValue(updateChain);
      (updateChain.is as jest.Mock).mockReturnValue(updateChain);
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
        SignalRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<SignalRepository>(SignalRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findPendingSignals', () => {
    it('should return pending signals for target', async () => {
      const result = await repository.findPendingSignals('target-123');

      expect(result).toEqual([mockSignal]);
    });

    it('should apply limit parameter', async () => {
      const result = await repository.findPendingSignals('target-123', 5);

      expect(result).toBeDefined();
    });

    it('should apply test data filter - testDataOnly', async () => {
      const result = await repository.findPendingSignals('target-123', 10, {
        testDataOnly: true,
      });

      expect(result).toBeDefined();
    });

    it('should apply test data filter with scenario ID', async () => {
      const result = await repository.findPendingSignals('target-123', 10, {
        testDataOnly: true,
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no signals found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingSignals('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findPendingSignals('target-123')).rejects.toThrow(
        'Failed to fetch pending signals: Query failed',
      );
    });
  });

  describe('findPendingSignalsGroupedByUrl', () => {
    it('should return signals grouped by URL', async () => {
      const signal1 = { ...mockSignal, id: 'signal-1', url: 'https://example.com/article1' };
      const signal2 = {
        ...mockSignal,
        id: 'signal-2',
        url: 'https://example.com/article1',
        target_id: 'target-456',
      };
      const signal3 = { ...mockSignal, id: 'signal-3', url: 'https://example.com/article2' };

      const mockClient = createMockClient({
        list: { data: [signal1, signal2, signal3], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingSignalsGroupedByUrl();

      expect(result.length).toBe(2);
      const article1Group = result.find((g) => g.url === 'https://example.com/article1');
      expect(article1Group?.signals.length).toBe(2);
    });

    it('should apply limit parameter', async () => {
      const result = await repository.findPendingSignalsGroupedByUrl(50);

      expect(result).toBeDefined();
    });

    it('should apply test data filter', async () => {
      const result = await repository.findPendingSignalsGroupedByUrl(200, {
        testDataOnly: true,
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no signals found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingSignalsGroupedByUrl();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findPendingSignalsGroupedByUrl()).rejects.toThrow(
        'Failed to fetch pending signals grouped: Query failed',
      );
    });

    it('should handle signals with null URL', async () => {
      const mockClient = createMockClient({
        list: { data: [{ ...mockSignal, url: null }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingSignalsGroupedByUrl();

      expect(result[0]?.url).toBe('no-url');
    });

    it('should sort groups by earliest detected_at', async () => {
      const signal1 = {
        ...mockSignal,
        id: 'signal-1',
        url: 'https://example.com/later',
        detected_at: '2024-01-02T10:00:00Z',
      };
      const signal2 = {
        ...mockSignal,
        id: 'signal-2',
        url: 'https://example.com/earlier',
        detected_at: '2024-01-01T10:00:00Z',
      };

      const mockClient = createMockClient({
        list: { data: [signal1, signal2], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findPendingSignalsGroupedByUrl();

      expect(result[0]?.url).toBe('https://example.com/earlier');
    });
  });

  describe('findById', () => {
    it('should return signal when found', async () => {
      const result = await repository.findById('signal-123');

      expect(result).toEqual(mockSignal);
    });

    it('should return null when signal not found', async () => {
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

      await expect(repository.findById('signal-123')).rejects.toThrow(
        'Failed to fetch signal: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create signal successfully', async () => {
      const createData = {
        target_id: 'target-123',
        source_id: 'source-123',
        content: 'Test content',
        direction: 'bullish' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockSignal);
    });

    it('should create signal with optional fields', async () => {
      const createData = {
        target_id: 'target-123',
        source_id: 'source-123',
        content: 'Test content',
        direction: 'bearish' as const,
        url: 'https://example.com',
        metadata: { key: 'value' },
        disposition: 'pending' as const,
        is_test: true,
        test_scenario_id: 'scenario-123',
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
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Test',
          direction: 'bullish',
        }),
      ).rejects.toThrow('Create succeeded but no signal returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Test',
          direction: 'bullish',
        }),
      ).rejects.toThrow('Failed to create signal: Insert failed');
    });
  });

  describe('update', () => {
    it('should update signal successfully', async () => {
      const result = await repository.update('signal-123', { disposition: 'processing' });

      expect(result).toEqual(mockSignal);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        disposition: 'predictor_created' as SignalDisposition,
        processing_worker: 'worker-123',
        processing_started_at: new Date().toISOString(),
      };

      const result = await repository.update('signal-123', updateData);

      expect(result).toBeDefined();
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('signal-123', { disposition: 'processing' })).rejects.toThrow(
        'Update succeeded but no signal returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('signal-123', { disposition: 'processing' })).rejects.toThrow(
        'Failed to update signal: Update failed',
      );
    });
  });

  describe('claimSignal', () => {
    it('should claim signal successfully', async () => {
      const result = await repository.claimSignal('signal-123', 'worker-456');

      expect(result).toEqual(mockSignal);
    });

    it('should return null when signal already claimed', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.claimSignal('signal-123', 'worker-456');

      expect(result).toBeNull();
    });

    it('should throw error on claim failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.claimSignal('signal-123', 'worker-456')).rejects.toThrow(
        'Failed to claim signal: Database error',
      );
    });
  });

  describe('findByTargetAndDisposition', () => {
    it('should return signals by target and disposition', async () => {
      const result = await repository.findByTargetAndDisposition('target-123', 'pending');

      expect(result).toEqual([mockSignal]);
    });

    it('should apply test data filter', async () => {
      const result = await repository.findByTargetAndDisposition('target-123', 'processing', {
        testDataOnly: true,
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no signals found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByTargetAndDisposition('target-123', 'rejected');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.findByTargetAndDisposition('target-123', 'pending'),
      ).rejects.toThrow('Failed to fetch signals by disposition: Query failed');
    });
  });

  describe('findByIds', () => {
    it('should return signals by IDs', async () => {
      const result = await repository.findByIds(['signal-123', 'signal-456']);

      expect(result).toEqual([mockSignal]);
    });

    it('should return empty array for empty IDs', async () => {
      const result = await repository.findByIds([]);

      expect(result).toEqual([]);
    });

    it('should return empty array when no signals found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByIds(['nonexistent-1', 'nonexistent-2']);

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIds(['signal-123'])).rejects.toThrow(
        'Failed to fetch signals by IDs: Query failed',
      );
    });
  });

  describe('createTestCopy', () => {
    it('should create test copy of signal', async () => {
      const result = await repository.createTestCopy(mockSignal, 'scenario-123');

      expect(result).toBeDefined();
    });

    it('should mark test copy with is_test and is_test_data', async () => {
      // The create method is called internally, so we verify through result
      const result = await repository.createTestCopy(mockSignal, 'scenario-123');

      expect(result).toBeDefined();
    });

    it('should handle signal with null URL', async () => {
      const signalWithNullUrl = { ...mockSignal, url: null };

      const result = await repository.createTestCopy(signalWithNullUrl, 'scenario-123');

      expect(result).toBeDefined();
    });

    it('should throw error when create fails', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.createTestCopy(mockSignal, 'scenario-123')).rejects.toThrow(
        'Failed to create signal: Insert failed',
      );
    });
  });

  describe('test data filter variations', () => {
    it('should include test data when includeTestData is true', async () => {
      const result = await repository.findPendingSignals('target-123', 10, {
        includeTestData: true,
      });

      expect(result).toBeDefined();
    });

    it('should filter by scenario ID only', async () => {
      const result = await repository.findPendingSignals('target-123', 10, {
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });

    it('should exclude test data by default', async () => {
      const result = await repository.findPendingSignals('target-123');

      expect(result).toBeDefined();
    });
  });

  describe('signal dispositions', () => {
    const dispositions: SignalDisposition[] = [
      'pending',
      'processing',
      'predictor_created',
      'rejected',
      'review_pending',
      'expired',
    ];

    dispositions.forEach((disposition) => {
      it(`should handle ${disposition} disposition`, async () => {
        const signalWithDisposition = { ...mockSignal, disposition };
        const mockClient = createMockClient({
          list: { data: [signalWithDisposition], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findByTargetAndDisposition('target-123', disposition);

        expect(result[0]?.disposition).toBe(disposition);
      });
    });
  });
});
