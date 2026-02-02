import { Test, TestingModule } from '@nestjs/testing';
import { TargetSnapshotRepository } from '../target-snapshot.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { TargetSnapshot } from '../../interfaces/target-snapshot.interface';

describe('TargetSnapshotRepository', () => {
  let repository: TargetSnapshotRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSnapshot: TargetSnapshot = {
    id: 'snapshot-123',
    target_id: 'target-123',
    value: 150.25,
    value_type: 'price',
    captured_at: '2024-01-01T10:00:00Z',
    source: 'polygon',
    metadata: {
      high: 152.0,
      low: 148.5,
      open: 149.0,
      close: 150.25,
      volume: 1000000,
    },
    created_at: '2024-01-01T10:00:00Z',
  };

  const mockEarlierSnapshot: TargetSnapshot = {
    ...mockSnapshot,
    id: 'snapshot-122',
    value: 145.0,
    captured_at: '2024-01-01T06:00:00Z',
    created_at: '2024-01-01T06:00:00Z',
  };

  const mockLaterSnapshot: TargetSnapshot = {
    ...mockSnapshot,
    id: 'snapshot-124',
    value: 155.5,
    captured_at: '2024-01-01T14:00:00Z',
    created_at: '2024-01-01T14:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    insertBatch?: { data: unknown[] | null; error: { message: string } | null };
    delete?: { data?: unknown[] | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockSnapshot, error: null };
    const listResult = overrides?.list ?? { data: [mockSnapshot], error: null };
    const insertResult = overrides?.insert ?? { data: mockSnapshot, error: null };
    const insertBatchResult = overrides?.insertBatch ?? { data: [mockSnapshot], error: null };
    const deleteResult = overrides?.delete ?? { data: [], error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        lte: jest.fn(),
        gte: jest.fn(),
        lt: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockImplementation((data) => {
        // If it's a batch insert (array), return batch result
        if (Array.isArray(data)) {
          return {
            ...chainableResult,
            select: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(insertBatchResult),
            }),
          };
        }
        // Single insert
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

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        lt: jest.fn(),
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.lt as jest.Mock).mockReturnValue(deleteChain);
      (deleteChain.select as jest.Mock).mockReturnValue(deleteChain);
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
        TargetSnapshotRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TargetSnapshotRepository>(TargetSnapshotRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return snapshot when found', async () => {
      const result = await repository.findById('snapshot-123');

      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when snapshot not found', async () => {
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

      await expect(repository.findById('snapshot-123')).rejects.toThrow(
        'Failed to fetch target snapshot: Database error',
      );
    });
  });

  describe('findLatest', () => {
    it('should return most recent snapshot for target', async () => {
      const result = await repository.findLatest('target-123');

      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when no snapshots found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLatest('target-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findLatest('target-123')).rejects.toThrow(
        'Failed to fetch latest snapshot: Database error',
      );
    });
  });

  describe('findAtTime', () => {
    it('should return snapshot closest to specified time', async () => {
      const result = await repository.findAtTime('target-123', '2024-01-01T10:00:00Z');

      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when no snapshot before time', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAtTime('target-123', '2020-01-01T00:00:00Z');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAtTime('target-123', '2024-01-01T10:00:00Z')).rejects.toThrow(
        'Failed to fetch snapshot at time: Database error',
      );
    });
  });

  describe('findClosestToTime', () => {
    it('should delegate to findAtTime with ISO string', async () => {
      const date = new Date('2024-01-01T10:00:00Z');
      const result = await repository.findClosestToTime('target-123', date);

      expect(result).toEqual(mockSnapshot);
    });
  });

  describe('findInRange', () => {
    it('should return snapshots within time range', async () => {
      const mockClient = createMockClient({
        list: { data: [mockEarlierSnapshot, mockSnapshot, mockLaterSnapshot], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findInRange(
        'target-123',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no snapshots in range', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findInRange(
        'target-123',
        '2020-01-01T00:00:00Z',
        '2020-01-02T00:00:00Z',
      );

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.findInRange('target-123', '2024-01-01T00:00:00Z', '2024-01-02T00:00:00Z'),
      ).rejects.toThrow('Failed to fetch snapshots in range: Query failed');
    });
  });

  describe('findRecent', () => {
    it('should return snapshots from last N hours', async () => {
      const mockClient = createMockClient({
        list: { data: [mockSnapshot], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findRecent('target-123', 24);

      expect(result).toEqual([mockSnapshot]);
    });

    it('should return empty array when no recent snapshots', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findRecent('target-123', 1);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create snapshot successfully', async () => {
      const createData = {
        target_id: 'target-123',
        value: 150.25,
        source: 'polygon' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockSnapshot);
    });

    it('should create snapshot with all optional fields', async () => {
      const createData = {
        target_id: 'target-123',
        value: 150.25,
        value_type: 'price' as const,
        captured_at: '2024-01-01T10:00:00Z',
        source: 'polygon' as const,
        metadata: {
          high: 152.0,
          low: 148.5,
          volume: 1000000,
        },
      };

      const result = await repository.create(createData);

      expect(result).toBeDefined();
    });

    it('should default value_type to price', async () => {
      const createData = {
        target_id: 'target-123',
        value: 150.25,
        source: 'polygon' as const,
      };

      const result = await repository.create(createData);

      expect(result.value_type).toBe('price');
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          target_id: 'target-123',
          value: 100,
          source: 'polygon',
        }),
      ).rejects.toThrow('Create succeeded but no target snapshot returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          target_id: 'target-123',
          value: 100,
          source: 'polygon',
        }),
      ).rejects.toThrow('Failed to create target snapshot: Insert failed');
    });
  });

  describe('createBatch', () => {
    it('should create multiple snapshots', async () => {
      const snapshots = [
        { target_id: 'target-123', value: 150, source: 'polygon' as const },
        { target_id: 'target-123', value: 151, source: 'polygon' as const },
      ];
      const mockClient = createMockClient({
        insertBatch: { data: [mockSnapshot, { ...mockSnapshot, id: 'snapshot-124' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.createBatch(snapshots);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no data returned', async () => {
      const mockClient = createMockClient({
        insertBatch: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.createBatch([
        { target_id: 'target-123', value: 150, source: 'polygon' },
      ]);

      expect(result).toEqual([]);
    });

    it('should throw error on batch create failure', async () => {
      const mockClient = createMockClient({
        insertBatch: { data: null, error: { message: 'Batch insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createBatch([{ target_id: 'target-123', value: 150, source: 'polygon' }]),
      ).rejects.toThrow('Failed to create target snapshots: Batch insert failed');
    });
  });

  describe('detectMoves', () => {
    it('should detect significant price moves', async () => {
      // Create snapshots with significant price change
      const snapshots = [
        { ...mockSnapshot, value: 100, captured_at: '2024-01-01T00:00:00Z' },
        { ...mockSnapshot, value: 110, captured_at: '2024-01-01T06:00:00Z' },
      ];
      const mockClient = createMockClient({
        list: { data: snapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const config = {
        min_change_percent: 5,
        lookback_hours: 24,
        min_duration_hours: 4,
      };

      const result = await repository.detectMoves('target-123', config);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.direction).toBe('up');
      expect(result[0]?.change_percent).toBe(10);
    });

    it('should return empty array when less than 2 snapshots', async () => {
      const mockClient = createMockClient({
        list: { data: [mockSnapshot], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const config = {
        min_change_percent: 5,
        lookback_hours: 24,
        min_duration_hours: 1,
      };

      const result = await repository.detectMoves('target-123', config);

      expect(result).toEqual([]);
    });

    it('should return empty array when no significant moves', async () => {
      const snapshots = [
        { ...mockSnapshot, value: 100, captured_at: '2024-01-01T00:00:00Z' },
        { ...mockSnapshot, value: 101, captured_at: '2024-01-01T06:00:00Z' },
      ];
      const mockClient = createMockClient({
        list: { data: snapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const config = {
        min_change_percent: 10,
        lookback_hours: 24,
        min_duration_hours: 4,
      };

      const result = await repository.detectMoves('target-123', config);

      expect(result).toEqual([]);
    });

    it('should detect downward moves', async () => {
      const snapshots = [
        { ...mockSnapshot, value: 100, captured_at: '2024-01-01T00:00:00Z' },
        { ...mockSnapshot, value: 85, captured_at: '2024-01-01T06:00:00Z' },
      ];
      const mockClient = createMockClient({
        list: { data: snapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const config = {
        min_change_percent: 10,
        lookback_hours: 24,
        min_duration_hours: 4,
      };

      const result = await repository.detectMoves('target-123', config);

      expect(result.length).toBe(1);
      expect(result[0]?.direction).toBe('down');
      expect(result[0]?.change_percent).toBe(-15);
    });

    it('should skip moves with duration less than min_duration_hours', async () => {
      const snapshots = [
        { ...mockSnapshot, value: 100, captured_at: '2024-01-01T00:00:00Z' },
        { ...mockSnapshot, value: 120, captured_at: '2024-01-01T01:00:00Z' }, // Only 1 hour
      ];
      const mockClient = createMockClient({
        list: { data: snapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const config = {
        min_change_percent: 10,
        lookback_hours: 24,
        min_duration_hours: 4, // Requires 4 hours
      };

      const result = await repository.detectMoves('target-123', config);

      expect(result).toEqual([]);
    });
  });

  describe('getValueAtTime', () => {
    it('should return value at specified time', async () => {
      const result = await repository.getValueAtTime('target-123', '2024-01-01T10:00:00Z');

      expect(result).toBe(150.25);
    });

    it('should return null when no snapshot found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getValueAtTime('target-123', '2020-01-01T00:00:00Z');

      expect(result).toBeNull();
    });
  });

  describe('calculateChange', () => {
    it('should calculate change between two times', async () => {
      // Mock findAtTime to return different values for different timestamps
      let callCount = 0;
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockImplementation(() => {
            const chain: Record<string, unknown> = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) => {
                  callCount++;
                  if (callCount === 1) {
                    resolve({ data: { ...mockSnapshot, value: 100 }, error: null });
                  } else {
                    resolve({ data: { ...mockSnapshot, value: 110 }, error: null });
                  }
                },
              }),
            };
            (chain.select as jest.Mock).mockReturnValue(chain);
            (chain.eq as jest.Mock).mockReturnValue(chain);
            (chain.lte as jest.Mock).mockReturnValue(chain);
            (chain.order as jest.Mock).mockReturnValue(chain);
            (chain.limit as jest.Mock).mockReturnValue(chain);
            return chain;
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.calculateChange(
        'target-123',
        '2024-01-01T00:00:00Z',
        '2024-01-01T12:00:00Z',
      );

      expect(result.start_value).toBe(100);
      expect(result.end_value).toBe(110);
      expect(result.change_absolute).toBe(10);
      expect(result.change_percent).toBe(10);
    });

    it('should return null values when start snapshot not found', async () => {
      let callCount = 0;
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockImplementation(() => {
            const chain: Record<string, unknown> = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) => {
                  callCount++;
                  if (callCount === 1) {
                    resolve({ data: null, error: { message: 'Not found', code: 'PGRST116' } });
                  } else {
                    resolve({ data: mockSnapshot, error: null });
                  }
                },
              }),
            };
            (chain.select as jest.Mock).mockReturnValue(chain);
            (chain.eq as jest.Mock).mockReturnValue(chain);
            (chain.lte as jest.Mock).mockReturnValue(chain);
            (chain.order as jest.Mock).mockReturnValue(chain);
            (chain.limit as jest.Mock).mockReturnValue(chain);
            return chain;
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.calculateChange(
        'target-123',
        '2020-01-01T00:00:00Z',
        '2024-01-01T12:00:00Z',
      );

      expect(result.start_value).toBeNull();
      expect(result.end_value).toBe(150.25);
      expect(result.change_absolute).toBeNull();
      expect(result.change_percent).toBeNull();
    });

    it('should return null values when end snapshot not found', async () => {
      let callCount = 0;
      const mockClient = {
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockImplementation(() => {
            const chain: Record<string, unknown> = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              lte: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              single: jest.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) => {
                  callCount++;
                  if (callCount === 1) {
                    resolve({ data: mockSnapshot, error: null });
                  } else {
                    resolve({ data: null, error: { message: 'Not found', code: 'PGRST116' } });
                  }
                },
              }),
            };
            (chain.select as jest.Mock).mockReturnValue(chain);
            (chain.eq as jest.Mock).mockReturnValue(chain);
            (chain.lte as jest.Mock).mockReturnValue(chain);
            (chain.order as jest.Mock).mockReturnValue(chain);
            (chain.limit as jest.Mock).mockReturnValue(chain);
            return chain;
          }),
        }),
      };
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.calculateChange(
        'target-123',
        '2024-01-01T00:00:00Z',
        '2030-01-01T12:00:00Z',
      );

      expect(result.start_value).toBe(150.25);
      expect(result.end_value).toBeNull();
      expect(result.change_absolute).toBeNull();
      expect(result.change_percent).toBeNull();
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should delete old snapshots and return count', async () => {
      const mockClient = createMockClient({
        delete: { data: [{ id: 'old-1' }, { id: 'old-2' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.cleanupOldSnapshots('target-123', 90);

      expect(result).toBe(2);
    });

    it('should use default retention of 90 days', async () => {
      const mockClient = createMockClient({
        delete: { data: [{ id: 'old-1' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.cleanupOldSnapshots('target-123');

      expect(result).toBe(1);
    });

    it('should return 0 when no snapshots deleted', async () => {
      const mockClient = createMockClient({
        delete: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.cleanupOldSnapshots('target-123', 90);

      expect(result).toBe(0);
    });

    it('should return 0 when null data returned', async () => {
      const mockClient = createMockClient({
        delete: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.cleanupOldSnapshots('target-123', 90);

      expect(result).toBe(0);
    });

    it('should throw error on cleanup failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.cleanupOldSnapshots('target-123', 90)).rejects.toThrow(
        'Failed to cleanup snapshots: Delete failed',
      );
    });
  });

  describe('value types', () => {
    const valueTypes = ['price', 'probability', 'index', 'other'] as const;

    valueTypes.forEach((valueType) => {
      it(`should handle ${valueType} value type`, async () => {
        const snapshotWithType = { ...mockSnapshot, value_type: valueType };
        const mockClient = createMockClient({
          single: { data: snapshotWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('snapshot-123');

        expect(result?.value_type).toBe(valueType);
      });
    });
  });

  describe('snapshot sources', () => {
    const sources = ['polygon', 'coingecko', 'polymarket', 'manual', 'other'] as const;

    sources.forEach((source) => {
      it(`should handle ${source} source`, async () => {
        const snapshotWithSource = { ...mockSnapshot, source };
        const mockClient = createMockClient({
          single: { data: snapshotWithSource, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('snapshot-123');

        expect(result?.source).toBe(source);
      });
    });
  });

  describe('metadata handling', () => {
    it('should handle complete metadata', async () => {
      const snapshotWithFullMetadata = {
        ...mockSnapshot,
        metadata: {
          high: 155.0,
          low: 145.0,
          open: 148.0,
          close: 152.0,
          volume: 2000000,
          market_cap: 50000000000,
          change_24h: 3.5,
          raw_response: { provider: 'polygon', timestamp: 1704067200 },
        },
      };
      const mockClient = createMockClient({
        single: { data: snapshotWithFullMetadata, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('snapshot-123');

      expect(result?.metadata.high).toBe(155.0);
      expect(result?.metadata.market_cap).toBe(50000000000);
      expect(result?.metadata.raw_response).toEqual({ provider: 'polygon', timestamp: 1704067200 });
    });

    it('should handle empty metadata', async () => {
      const snapshotWithEmptyMetadata = { ...mockSnapshot, metadata: {} };
      const mockClient = createMockClient({
        single: { data: snapshotWithEmptyMetadata, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('snapshot-123');

      expect(result?.metadata).toEqual({});
    });
  });
});
