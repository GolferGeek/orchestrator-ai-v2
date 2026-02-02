import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubjectRepository, SubjectFilter } from '../subject.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskSubject } from '../../interfaces/subject.interface';

describe('SubjectRepository', () => {
  let repository: SubjectRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSubject: RiskSubject = {
    id: 'subject-123',
    scope_id: 'scope-123',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: {
      exchange: 'NASDAQ',
      sector: 'Technology',
      market_cap: 3000000000000,
    },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockSubject, error: null };
    const listResult = overrides?.list ?? { data: [mockSubject], error: null };
    const insertResult = overrides?.insert ?? { data: mockSubject, error: null };
    const updateResult = overrides?.update ?? { data: mockSubject, error: null };
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
        SubjectRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<SubjectRepository>(SubjectRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByScope', () => {
    it('should return subjects for scope', async () => {
      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([mockSubject]);
    });

    it('should return empty array when no subjects found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByScope('scope-123')).rejects.toThrow(
        'Failed to fetch subjects: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: SubjectFilter = { includeTest: true };
      const result = await repository.findByScope('scope-123', filter);

      expect(result).toEqual([mockSubject]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: SubjectFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findByScope('scope-123', filter);

      expect(result).toEqual([mockSubject]);
    });
  });

  describe('findById', () => {
    it('should return subject when found', async () => {
      const result = await repository.findById('subject-123');

      expect(result).toEqual(mockSubject);
    });

    it('should return null when subject not found', async () => {
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

      await expect(repository.findById('subject-123')).rejects.toThrow(
        'Failed to fetch subject: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return subject when found', async () => {
      const result = await repository.findByIdOrThrow('subject-123');

      expect(result).toEqual(mockSubject);
    });

    it('should throw NotFoundException when subject not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdentifier', () => {
    it('should return subject when found', async () => {
      const result = await repository.findByIdentifier('scope-123', 'AAPL');

      expect(result).toEqual(mockSubject);
    });

    it('should return null when subject not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByIdentifier('scope-123', 'UNKNOWN');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdentifier('scope-123', 'AAPL')).rejects.toThrow(
        'Failed to fetch subject by identifier: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create subject successfully', async () => {
      const createData = {
        scope_id: 'scope-123',
        identifier: 'MSFT',
        subject_type: 'stock' as const,
        metadata: { exchange: 'NASDAQ' },
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockSubject);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          scope_id: 'scope-123',
          identifier: 'MSFT',
          subject_type: 'stock',
          metadata: {},
        }),
      ).rejects.toThrow('Create succeeded but no subject returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          scope_id: 'scope-123',
          identifier: 'MSFT',
          subject_type: 'stock',
          metadata: {},
        }),
      ).rejects.toThrow('Failed to create subject: Insert failed');
    });
  });

  describe('update', () => {
    it('should update subject successfully', async () => {
      const updatedSubject = { ...mockSubject, name: 'Updated Name' };
      const mockClient = createMockClient({
        update: { data: updatedSubject, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('subject-123', { name: 'Updated Name' });

      expect(result).toEqual(updatedSubject);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('subject-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no subject returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('subject-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update subject: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete subject successfully', async () => {
      await expect(repository.delete('subject-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('subject-123')).rejects.toThrow(
        'Failed to delete subject: Delete failed',
      );
    });
  });

  describe('findAllActive', () => {
    it('should return all active subjects', async () => {
      const result = await repository.findAllActive();

      expect(result).toEqual([mockSubject]);
    });

    it('should return empty array when no active subjects found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAllActive();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAllActive()).rejects.toThrow(
        'Failed to fetch all active subjects: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: SubjectFilter = { includeTest: true };
      const result = await repository.findAllActive(filter);

      expect(result).toEqual([mockSubject]);
    });
  });

  describe('findByType', () => {
    it('should return subjects by type', async () => {
      const result = await repository.findByType('scope-123', 'stock');

      expect(result).toEqual([mockSubject]);
    });

    it('should return empty array when no subjects found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByType('scope-123', 'crypto');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByType('scope-123', 'stock')).rejects.toThrow(
        'Failed to fetch subjects by type: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: SubjectFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findByType('scope-123', 'stock', filter);

      expect(result).toEqual([mockSubject]);
    });
  });

  describe('subject types', () => {
    const subjectTypes = ['stock', 'crypto', 'decision', 'project'] as const;

    subjectTypes.forEach((subjectType) => {
      it(`should handle ${subjectType} subject type`, async () => {
        const subjectWithType = { ...mockSubject, subject_type: subjectType };
        const mockClient = createMockClient({
          single: { data: subjectWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('subject-123');

        expect(result?.subject_type).toBe(subjectType);
      });
    });
  });

  describe('metadata handling', () => {
    it('should handle stock metadata', async () => {
      const stockSubject = {
        ...mockSubject,
        metadata: { exchange: 'NYSE', sector: 'Finance', market_cap: 100000000 },
      };
      const mockClient = createMockClient({
        single: { data: stockSubject, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('subject-123');

      expect(result?.metadata.exchange).toBe('NYSE');
      expect(result?.metadata.sector).toBe('Finance');
    });

    it('should handle crypto metadata', async () => {
      const cryptoSubject = {
        ...mockSubject,
        subject_type: 'crypto' as const,
        metadata: { blockchain: 'Ethereum', token_type: 'ERC-20' },
      };
      const mockClient = createMockClient({
        single: { data: cryptoSubject, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('subject-123');

      expect(result?.metadata.blockchain).toBe('Ethereum');
    });

    it('should handle empty metadata', async () => {
      const subjectWithEmptyMetadata = { ...mockSubject, metadata: {} };
      const mockClient = createMockClient({
        single: { data: subjectWithEmptyMetadata, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('subject-123');

      expect(result?.metadata).toEqual({});
    });
  });
});
