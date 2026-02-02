import { Test, TestingModule } from '@nestjs/testing';
import {
  TestTargetMirrorRepository,
  TestTargetMirror,
} from '../test-target-mirror.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('TestTargetMirrorRepository', () => {
  let repository: TestTargetMirrorRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockMirror: TestTargetMirror = {
    id: 'mirror-123',
    real_target_id: 'target-real-123',
    test_target_id: 'target-test-123',
    created_at: '2024-01-01T10:00:00Z',
  };

  const mockOtherMirror: TestTargetMirror = {
    id: 'mirror-456',
    real_target_id: 'target-real-456',
    test_target_id: 'target-test-456',
    created_at: '2024-01-01T11:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockMirror, error: null };
    const listResult = overrides?.list ?? { data: [mockMirror], error: null };
    const insertResult = overrides?.insert ?? { data: mockMirror, error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
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
        TestTargetMirrorRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TestTargetMirrorRepository>(
      TestTargetMirrorRepository,
    );
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return mirror when found', async () => {
      const result = await repository.findById('mirror-123');

      expect(result).toEqual(mockMirror);
    });

    it('should return null when mirror not found', async () => {
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

      await expect(repository.findById('mirror-123')).rejects.toThrow(
        'Failed to fetch test target mirror: Database error',
      );
    });
  });

  describe('findAll', () => {
    it('should return all mirrors', async () => {
      const mockClient = createMockClient({
        list: { data: [mockMirror, mockOtherMirror], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findAll();

      expect(result.length).toBe(2);
    });

    it('should return empty array when no mirrors found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findAll()).rejects.toThrow(
        'Failed to fetch test target mirrors: Query failed',
      );
    });
  });

  describe('findByRealTarget', () => {
    it('should return mirror when found', async () => {
      const result = await repository.findByRealTarget('target-real-123');

      expect(result).toEqual(mockMirror);
    });

    it('should return null when mirror not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByRealTarget('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByRealTarget('target-real-123'),
      ).rejects.toThrow(
        'Failed to fetch test target mirror by real target: Database error',
      );
    });
  });

  describe('findByTestTarget', () => {
    it('should return mirror when found', async () => {
      const result = await repository.findByTestTarget('target-test-123');

      expect(result).toEqual(mockMirror);
    });

    it('should return null when mirror not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByTestTarget('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByTestTarget('target-test-123'),
      ).rejects.toThrow(
        'Failed to fetch test target mirror by test target: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create mirror successfully', async () => {
      const createData = {
        real_target_id: 'target-real-123',
        test_target_id: 'target-test-123',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockMirror);
    });

    it('should create mirror with provided ID', async () => {
      const createData = {
        id: 'custom-mirror-id',
        real_target_id: 'target-real-123',
        test_target_id: 'target-test-123',
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
          real_target_id: 'target-real-123',
          test_target_id: 'target-test-123',
        }),
      ).rejects.toThrow('Create succeeded but no test target mirror returned');
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
          real_target_id: 'target-real-123',
          test_target_id: 'target-test-123',
        }),
      ).rejects.toThrow('Failed to create test target mirror: Insert failed');
    });
  });

  describe('delete', () => {
    it('should delete mirror successfully', async () => {
      await expect(repository.delete('mirror-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('mirror-123')).rejects.toThrow(
        'Failed to delete test target mirror: Delete failed',
      );
    });
  });

  describe('getTestTargetId', () => {
    it('should return test target ID when mirror exists', async () => {
      const result = await repository.getTestTargetId('target-real-123');

      expect(result).toBe('target-test-123');
    });

    it('should return null when mirror not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getTestTargetId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRealTargetId', () => {
    it('should return real target ID when mirror exists', async () => {
      const result = await repository.getRealTargetId('target-test-123');

      expect(result).toBe('target-real-123');
    });

    it('should return null when mirror not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getRealTargetId('nonexistent');

      expect(result).toBeNull();
    });
  });
});
