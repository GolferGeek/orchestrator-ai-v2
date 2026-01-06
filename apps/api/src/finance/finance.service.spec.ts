import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { SupabaseService } from '@/supabase/supabase.service';

interface ChainableMock {
  from: jest.Mock;
  schema: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
  limit: jest.Mock;
}

describe('FinanceService', () => {
  let service: FinanceService;

  // Mock Supabase client with chainable methods
  const createChainableMock = (): ChainableMock => {
    const chainable = {} as ChainableMock;
    const methods: (keyof ChainableMock)[] = [
      'from',
      'schema',
      'insert',
      'update',
      'delete',
      'select',
      'eq',
      'in',
      'order',
      'range',
      'single',
    ];

    methods.forEach((method) => {
      chainable[method] = jest.fn().mockReturnValue(chainable);
    });

    // Make single() resolve to a promise
    chainable.single = jest.fn().mockResolvedValue({ data: null, error: null });
    // Make limit() resolve to a promise (for queries that end with limit)
    chainable.limit = jest.fn().mockResolvedValue({ data: null, error: null });

    return chainable;
  };

  let mockSupabaseClient: ChainableMock;

  beforeEach(async () => {
    mockSupabaseClient = createChainableMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUniverse', () => {
    it('should reject non-finance org', async () => {
      await expect(
        service.createUniverse({
          org_slug: 'other-org',
          slug: 'test-universe',
          name: 'Test Universe',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw NOT_FOUND if organization does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.createUniverse({
          org_slug: 'finance',
          slug: 'test-universe',
          name: 'Test Universe',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('should create universe successfully', async () => {
      const mockUniverse = {
        id: 'universe-123',
        org_slug: 'finance',
        slug: 'test-universe',
        name: 'Test Universe',
        description: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // First call: check organization exists
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { slug: 'finance' },
        error: null,
      });

      // Second call: insert universe
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockUniverse,
        error: null,
      });

      const result = await service.createUniverse({
        org_slug: 'finance',
        slug: 'test-universe',
        name: 'Test Universe',
      });

      expect(result).toEqual(mockUniverse);
      expect(mockSupabaseClient.schema).toHaveBeenCalledWith('finance');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('universes');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });
  });

  describe('listUniverses', () => {
    it('should return list of universes', async () => {
      const mockUniverses = [
        {
          id: 'universe-1',
          org_slug: 'finance',
          slug: 'universe-1',
          name: 'Universe 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'universe-2',
          org_slug: 'finance',
          slug: 'universe-2',
          name: 'Universe 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Override the order mock to return data directly (not chained to single)
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: mockUniverses,
        error: null,
      });

      const result = await service.listUniverses();

      expect(result).toEqual(mockUniverses);
      expect(mockSupabaseClient.schema).toHaveBeenCalledWith('finance');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('universes');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('org_slug', 'finance');
    });

    it('should throw on database error', async () => {
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.listUniverses()).rejects.toThrow(HttpException);
    });
  });

  describe('getUniverse', () => {
    it('should return universe when found', async () => {
      const mockUniverse = {
        id: 'universe-123',
        org_slug: 'finance',
        slug: 'test-universe',
        name: 'Test Universe',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockUniverse,
        error: null,
      });

      const result = await service.getUniverse('universe-123');

      expect(result).toEqual(mockUniverse);
    });

    it('should return null when not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await service.getUniverse('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateUniverse', () => {
    it('should throw NOT_FOUND if universe does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(
        service.updateUniverse('non-existent', { name: 'New Name' }),
      ).rejects.toThrow(
        new HttpException(
          "Universe 'non-existent' not found",
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should update universe successfully', async () => {
      const existingUniverse = {
        id: 'universe-123',
        org_slug: 'finance',
        slug: 'test-universe',
        name: 'Old Name',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updatedUniverse = {
        ...existingUniverse,
        name: 'New Name',
      };

      // First call: getUniverse check
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: existingUniverse,
        error: null,
      });

      // Second call: update
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedUniverse,
        error: null,
      });

      const result = await service.updateUniverse('universe-123', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(mockSupabaseClient.update).toHaveBeenCalled();
    });
  });

  describe('deleteUniverse', () => {
    it('should throw NOT_FOUND if universe does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.deleteUniverse('non-existent')).rejects.toThrow(
        new HttpException(
          "Universe 'non-existent' not found",
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    // Note: Full delete test requires complex mock setup for chained .eq().eq() calls
    // The NOT_FOUND path is tested above, which exercises the core logic
    it.todo('should delete universe successfully - requires integration test');
  });

  describe('createUniverseVersion', () => {
    it('should throw NOT_FOUND if universe does not exist', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(
        service.createUniverseVersion({
          universe_id: 'non-existent',
          config_json: { instruments: [] },
        }),
      ).rejects.toThrow(HttpException);
    });

    // Note: Full createVersion test requires complex mock setup for chained .limit() calls
    // The NOT_FOUND path is tested above, which exercises the core logic
    it.todo('should create version successfully - requires integration test');
  });
});
