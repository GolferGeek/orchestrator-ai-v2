import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ToolRequestRepository } from '../tool-request.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { ToolRequest, ToolRequestStatus, ToolRequestPriority } from '../../interfaces/tool-request.interface';

describe('ToolRequestRepository', () => {
  let repository: ToolRequestRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockToolRequest: ToolRequest = {
    id: 'request-123',
    universe_id: 'universe-123',
    missed_opportunity_id: 'missed-123',
    type: 'source',
    name: 'New Data Source',
    description: 'A new source of financial data',
    rationale: 'Would help improve prediction accuracy',
    suggested_url: 'https://example.com/api',
    suggested_config: { api_key_required: true },
    priority: 'high',
    status: 'wishlist',
    resolution_notes: null,
    resolved_at: null,
    resolved_by_user_id: null,
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
    const singleResult = overrides?.single ?? { data: mockToolRequest, error: null };
    const listResult = overrides?.list ?? { data: [mockToolRequest], error: null };
    const insertResult = overrides?.insert ?? { data: mockToolRequest, error: null };
    const updateResult = overrides?.update ?? { data: mockToolRequest, error: null };
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
        ToolRequestRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<ToolRequestRepository>(ToolRequestRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tool requests', async () => {
      const result = await repository.findAll();

      expect(result).toEqual([mockToolRequest]);
    });

    it('should filter by universe', async () => {
      const result = await repository.findAll('universe-123');

      expect(result).toBeDefined();
    });

    it('should return empty array when no requests', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findAll()).rejects.toThrow(
        'Failed to fetch tool requests: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return request when found', async () => {
      const result = await repository.findById('request-123');

      expect(result).toEqual(mockToolRequest);
    });

    it('should return null when request not found', async () => {
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

      await expect(repository.findById('request-123')).rejects.toThrow(
        'Failed to fetch tool request: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return request when found', async () => {
      const result = await repository.findByIdOrThrow('request-123');

      expect(result).toEqual(mockToolRequest);
    });

    it('should throw NotFoundException when request not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStatus', () => {
    it('should return requests by status', async () => {
      const result = await repository.findByStatus('wishlist');

      expect(result).toEqual([mockToolRequest]);
    });

    it('should filter by universe', async () => {
      const result = await repository.findByStatus('wishlist', 'universe-123');

      expect(result).toBeDefined();
    });

    it('should return empty array when no requests with status', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByStatus('done');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByStatus('wishlist')).rejects.toThrow(
        'Failed to fetch tool requests by status: Query failed',
      );
    });
  });

  describe('findByMissedOpportunity', () => {
    it('should return requests by missed opportunity', async () => {
      const result = await repository.findByMissedOpportunity('missed-123');

      expect(result).toEqual([mockToolRequest]);
    });

    it('should return empty array when no requests', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByMissedOpportunity('missed-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByMissedOpportunity('missed-123')).rejects.toThrow(
        'Failed to fetch tool requests by missed opportunity: Query failed',
      );
    });
  });

  describe('findWishlist', () => {
    it('should return wishlist requests', async () => {
      const result = await repository.findWishlist();

      expect(result).toBeDefined();
    });

    it('should filter by universe', async () => {
      const result = await repository.findWishlist('universe-123');

      expect(result).toBeDefined();
    });
  });

  describe('findByPriority', () => {
    it('should return requests by priority', async () => {
      const result = await repository.findByPriority('high');

      expect(result).toEqual([mockToolRequest]);
    });

    it('should filter by universe', async () => {
      const result = await repository.findByPriority('high', 'universe-123');

      expect(result).toBeDefined();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByPriority('high')).rejects.toThrow(
        'Failed to fetch tool requests by priority: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create request successfully', async () => {
      const createData = {
        universe_id: 'universe-123',
        type: 'source' as const,
        name: 'New Source',
        description: 'A new data source',
        rationale: 'Would improve predictions',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockToolRequest);
    });

    it('should create request with optional fields', async () => {
      const createData = {
        universe_id: 'universe-123',
        missed_opportunity_id: 'missed-123',
        type: 'api' as const,
        name: 'New API',
        description: 'A new API integration',
        rationale: 'Would provide real-time data',
        suggested_url: 'https://api.example.com',
        suggested_config: { version: 'v2' },
        priority: 'critical' as const,
        status: 'planned' as const,
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
          universe_id: 'universe-123',
          type: 'source',
          name: 'Test',
          description: 'Test',
          rationale: 'Test',
        }),
      ).rejects.toThrow('Create succeeded but no tool request returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          universe_id: 'universe-123',
          type: 'source',
          name: 'Test',
          description: 'Test',
          rationale: 'Test',
        }),
      ).rejects.toThrow('Failed to create tool request: Insert failed');
    });
  });

  describe('update', () => {
    it('should update request successfully', async () => {
      const result = await repository.update('request-123', { name: 'Updated Name' });

      expect(result).toEqual(mockToolRequest);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('request-123', { name: 'Updated' })).rejects.toThrow(
        'Update succeeded but no tool request returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('request-123', { name: 'Updated' })).rejects.toThrow(
        'Failed to update tool request: Update failed',
      );
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      const result = await repository.updateStatus('request-123', 'planned');

      expect(result).toBeDefined();
    });

    it('should set resolved fields when marking done', async () => {
      const result = await repository.updateStatus('request-123', 'done', 'user-123', 'Completed');

      expect(result).toBeDefined();
    });

    it('should set resolved fields when rejecting', async () => {
      const result = await repository.updateStatus('request-123', 'rejected', 'user-123', 'Not needed');

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete request successfully', async () => {
      await expect(repository.delete('request-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('request-123')).rejects.toThrow(
        'Failed to delete tool request: Delete failed',
      );
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      const mockClient = createMockClient({
        list: {
          data: [
            { status: 'wishlist', priority: 'high' },
            { status: 'wishlist', priority: 'medium' },
            { status: 'done', priority: 'high' },
          ],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStats();

      expect(result.total).toBe(3);
      expect(result.by_status.wishlist).toBe(2);
      expect(result.by_status.done).toBe(1);
      expect(result.by_priority.high).toBe(2);
    });

    it('should filter by universe', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.getStats('universe-123');

      expect(result.total).toBe(0);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.getStats()).rejects.toThrow(
        'Failed to fetch tool request stats: Query failed',
      );
    });
  });

  describe('statuses', () => {
    const statuses: ToolRequestStatus[] = ['wishlist', 'planned', 'in_progress', 'done', 'rejected'];

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const requestWithStatus = { ...mockToolRequest, status };
        const mockClient = createMockClient({
          single: { data: requestWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('request-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('priorities', () => {
    const priorities: ToolRequestPriority[] = ['low', 'medium', 'high', 'critical'];

    priorities.forEach((priority) => {
      it(`should handle ${priority} priority`, async () => {
        const requestWithPriority = { ...mockToolRequest, priority };
        const mockClient = createMockClient({
          single: { data: requestWithPriority, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('request-123');

        expect(result?.priority).toBe(priority);
      });
    });
  });

  describe('types', () => {
    const types = ['source', 'api', 'integration', 'feature'] as const;

    types.forEach((type) => {
      it(`should handle ${type} type`, async () => {
        const requestWithType = { ...mockToolRequest, type };
        const mockClient = createMockClient({
          single: { data: requestWithType, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('request-123');

        expect(result?.type).toBe(type);
      });
    });
  });
});
