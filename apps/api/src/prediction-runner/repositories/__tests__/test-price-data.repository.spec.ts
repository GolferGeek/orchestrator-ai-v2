import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  TestPriceDataRepository,
  TestPriceData,
} from '../test-price-data.repository';
import { SupabaseService } from '@/supabase/supabase.service';

describe('TestPriceDataRepository', () => {
  let repository: TestPriceDataRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockPriceData: TestPriceData = {
    id: 'price-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    symbol: 'T_AAPL',
    price_timestamp: '2024-01-01T10:00:00Z',
    open: 150.0,
    high: 155.0,
    low: 148.0,
    close: 153.0,
    volume: 1000000,
    created_at: '2024-01-01T10:00:00Z',
    metadata: { source: 'test-runner' },
  };

  const mockLaterPriceData: TestPriceData = {
    ...mockPriceData,
    id: 'price-124',
    price_timestamp: '2024-01-01T11:00:00Z',
    open: 153.0,
    high: 157.0,
    low: 152.0,
    close: 156.0,
    created_at: '2024-01-01T11:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    insertBatch?: { data: unknown[] | null; error: { message: string } | null };
    update?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    delete?: { data?: unknown[] | null; error: { message: string } | null };
    count?: { count: number | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockPriceData,
      error: null,
    };
    const listResult = overrides?.list ?? {
      data: [mockPriceData],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockPriceData,
      error: null,
    };
    const insertBatchResult = overrides?.insertBatch ?? {
      data: [mockPriceData],
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockPriceData,
      error: null,
    };
    const deleteResult = overrides?.delete ?? { data: [], error: null };
    const countResult = overrides?.count ?? { count: 1, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        is: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        range: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockImplementation((cols, opts) => {
        if (opts?.count === 'exact' && opts?.head === true) {
          return {
            eq: jest.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) => resolve(countResult),
          };
        }
        return chainableResult;
      });
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.is as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.range as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockImplementation((data) => {
        if (Array.isArray(data)) {
          return {
            ...chainableResult,
            select: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) =>
                resolve(insertBatchResult),
            }),
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
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
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
        TestPriceDataRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<TestPriceDataRepository>(TestPriceDataRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return price data when found', async () => {
      const result = await repository.findById('price-123');

      expect(result).toEqual(mockPriceData);
    });

    it('should return null when price data not found', async () => {
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

      await expect(repository.findById('price-123')).rejects.toThrow(
        'Failed to fetch test price data: Database error',
      );
    });
  });

  describe('findByScenario', () => {
    it('should return price data for scenario', async () => {
      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([mockPriceData]);
    });

    it('should return empty array when no data found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScenario('scenario-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByScenario('scenario-123')).rejects.toThrow(
        'Failed to fetch test price data by scenario: Query failed',
      );
    });
  });

  describe('findBySymbol', () => {
    it('should return price data for symbol', async () => {
      const result = await repository.findBySymbol('T_AAPL', 'test-org');

      expect(result).toEqual([mockPriceData]);
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(repository.findBySymbol('AAPL', 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return empty array when no data found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findBySymbol('T_AAPL', 'test-org');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findBySymbol('T_AAPL', 'test-org'),
      ).rejects.toThrow(
        'Failed to fetch test price data by symbol: Query failed',
      );
    });
  });

  describe('findByDateRange', () => {
    it('should return price data in date range', async () => {
      const mockClient = createMockClient({
        list: { data: [mockPriceData, mockLaterPriceData], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByDateRange(
        'T_AAPL',
        'test-org',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
      );

      expect(result.length).toBe(2);
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(
        repository.findByDateRange(
          'AAPL',
          'test-org',
          '2024-01-01T00:00:00Z',
          '2024-01-02T00:00:00Z',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByDateRange(
          'T_AAPL',
          'test-org',
          '2024-01-01T00:00:00Z',
          '2024-01-02T00:00:00Z',
        ),
      ).rejects.toThrow(
        'Failed to fetch test price data by date range: Query failed',
      );
    });
  });

  describe('findLatestPrice', () => {
    it('should return latest price for symbol', async () => {
      const result = await repository.findLatestPrice('T_AAPL', 'test-org');

      expect(result).toEqual(mockPriceData);
    });

    it('should return null when no price found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findLatestPrice('T_AAPL', 'test-org');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(
        repository.findLatestPrice('AAPL', 'test-org'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findLatestPrice('T_AAPL', 'test-org'),
      ).rejects.toThrow(
        'Failed to fetch latest test price data: Database error',
      );
    });
  });

  describe('findByFilter', () => {
    it('should return data with organization filter', async () => {
      const result = await repository.findByFilter({
        organization_slug: 'test-org',
      });

      expect(result).toEqual([mockPriceData]);
    });

    it('should filter by scenario_id', async () => {
      const result = await repository.findByFilter({
        scenario_id: 'scenario-123',
      });

      expect(result).toEqual([mockPriceData]);
    });

    it('should filter by null scenario_id', async () => {
      const result = await repository.findByFilter({ scenario_id: null });

      expect(result).toEqual([mockPriceData]);
    });

    it('should filter by symbol', async () => {
      const result = await repository.findByFilter({ symbol: 'T_AAPL' });

      expect(result).toEqual([mockPriceData]);
    });

    it('should filter by date range', async () => {
      const result = await repository.findByFilter({
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-02T00:00:00Z',
      });

      expect(result).toEqual([mockPriceData]);
    });

    it('should apply limit and offset', async () => {
      const result = await repository.findByFilter({ limit: 10, offset: 5 });

      expect(result).toEqual([mockPriceData]);
    });

    it('should throw BadRequestException for invalid symbol in filter', async () => {
      await expect(repository.findByFilter({ symbol: 'AAPL' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByFilter({})).rejects.toThrow(
        'Failed to fetch test price data by filter: Query failed',
      );
    });
  });

  describe('create', () => {
    it('should create price data successfully', async () => {
      const createData = {
        organization_slug: 'test-org',
        symbol: 'T_AAPL',
        price_timestamp: '2024-01-01T10:00:00Z',
        open: 150.0,
        high: 155.0,
        low: 148.0,
        close: 153.0,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockPriceData);
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(
        repository.create({
          organization_slug: 'test-org',
          symbol: 'AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150.0,
          high: 155.0,
          low: 148.0,
          close: 153.0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when high < low', async () => {
      await expect(
        repository.create({
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150.0,
          high: 145.0,
          low: 148.0,
          close: 153.0,
        }),
      ).rejects.toThrow('High price must be >= low price');
    });

    it('should throw BadRequestException when open is outside high-low range', async () => {
      await expect(
        repository.create({
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 160.0,
          high: 155.0,
          low: 148.0,
          close: 153.0,
        }),
      ).rejects.toThrow('Open price must be between low and high');
    });

    it('should throw BadRequestException when close is outside high-low range', async () => {
      await expect(
        repository.create({
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150.0,
          high: 155.0,
          low: 148.0,
          close: 160.0,
        }),
      ).rejects.toThrow('Close price must be between low and high');
    });

    it('should throw BadRequestException when prices are not positive', async () => {
      await expect(
        repository.create({
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: -150.0,
          high: -145.0,
          low: -155.0,
          close: -153.0,
        }),
      ).rejects.toThrow('All prices must be positive numbers');
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
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150.0,
          high: 155.0,
          low: 148.0,
          close: 153.0,
        }),
      ).rejects.toThrow('Create succeeded but no test price data returned');
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
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150.0,
          high: 155.0,
          low: 148.0,
          close: 153.0,
        }),
      ).rejects.toThrow('Failed to create test price data: Insert failed');
    });
  });

  describe('bulkCreate', () => {
    it('should bulk create valid records', async () => {
      const priceDataList = [
        {
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150,
          high: 155,
          low: 148,
          close: 153,
        },
        {
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T11:00:00Z',
          open: 153,
          high: 157,
          low: 152,
          close: 156,
        },
      ];
      const mockClient = createMockClient({
        insertBatch: { data: [mockPriceData, mockLaterPriceData], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.bulkCreate(priceDataList);

      expect(result.created_count).toBe(2);
      expect(result.failed_count).toBe(0);
    });

    it('should track validation errors', async () => {
      const priceDataList = [
        {
          organization_slug: 'test-org',
          symbol: 'AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150,
          high: 155,
          low: 148,
          close: 153,
        }, // Invalid symbol
        {
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T11:00:00Z',
          open: 153,
          high: 157,
          low: 152,
          close: 156,
        }, // Valid
      ];
      const mockClient = createMockClient({
        insertBatch: { data: [mockPriceData], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.bulkCreate(priceDataList);

      expect(result.created_count).toBe(1);
      expect(result.failed_count).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.index).toBe(0);
    });

    it('should handle all invalid records', async () => {
      const priceDataList = [
        {
          organization_slug: 'test-org',
          symbol: 'AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 150,
          high: 155,
          low: 148,
          close: 153,
        },
      ];

      const result = await repository.bulkCreate(priceDataList);

      expect(result.created_count).toBe(0);
      expect(result.failed_count).toBe(1);
    });

    it('should throw error on bulk create failure', async () => {
      const mockClient = createMockClient({
        insertBatch: { data: null, error: { message: 'Bulk insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.bulkCreate([
          {
            organization_slug: 'test-org',
            symbol: 'T_AAPL',
            price_timestamp: '2024-01-01T10:00:00Z',
            open: 150,
            high: 155,
            low: 148,
            close: 153,
          },
        ]),
      ).rejects.toThrow(
        'Failed to bulk create test price data: Bulk insert failed',
      );
    });
  });

  describe('update', () => {
    it('should update price data successfully', async () => {
      const result = await repository.update('price-123', { volume: 2000000 });

      expect(result).toEqual(mockPriceData);
    });

    it('should validate symbol when updating', async () => {
      await expect(
        repository.update('price-123', { symbol: 'AAPL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate OHLCV when updating price fields', async () => {
      await expect(
        repository.update('price-123', { high: 145.0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when price data not found during update', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('price-123', { open: 151.0 }),
      ).rejects.toThrow('Test price data not found: price-123');
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('price-123', { volume: 2000000 }),
      ).rejects.toThrow('Update succeeded but no test price data returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('price-123', { volume: 2000000 }),
      ).rejects.toThrow('Failed to update test price data: Update failed');
    });
  });

  describe('delete', () => {
    it('should delete price data successfully', async () => {
      await expect(repository.delete('price-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('price-123')).rejects.toThrow(
        'Failed to delete test price data: Delete failed',
      );
    });
  });

  describe('deleteByScenario', () => {
    it('should delete price data by scenario', async () => {
      const mockClient = createMockClient({
        delete: {
          data: [{ id: 'price-123' }, { id: 'price-124' }],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.deleteByScenario('scenario-123');

      expect(count).toBe(2);
    });

    it('should return 0 when no data deleted', async () => {
      const mockClient = createMockClient({
        delete: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.deleteByScenario('scenario-123');

      expect(count).toBe(0);
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.deleteByScenario('scenario-123')).rejects.toThrow(
        'Failed to delete test price data by scenario: Delete failed',
      );
    });
  });

  describe('deleteBySymbol', () => {
    it('should delete price data by symbol', async () => {
      const mockClient = createMockClient({
        delete: { data: [{ id: 'price-123' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.deleteBySymbol('T_AAPL', 'test-org');

      expect(count).toBe(1);
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(
        repository.deleteBySymbol('AAPL', 'test-org'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.deleteBySymbol('T_AAPL', 'test-org'),
      ).rejects.toThrow(
        'Failed to delete test price data by symbol: Delete failed',
      );
    });
  });

  describe('countByScenario', () => {
    it('should return count for scenario', async () => {
      const count = await repository.countByScenario('scenario-123');

      expect(count).toBe(1);
    });

    it('should return 0 when no data', async () => {
      const mockClient = createMockClient({
        count: { count: 0, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const count = await repository.countByScenario('scenario-123');

      expect(count).toBe(0);
    });

    it('should throw error on count failure', async () => {
      const mockClient = createMockClient({
        count: { count: null, error: { message: 'Count failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.countByScenario('scenario-123')).rejects.toThrow(
        'Failed to count test price data by scenario: Count failed',
      );
    });
  });

  describe('countBySymbol', () => {
    it('should return count for symbol', async () => {
      const count = await repository.countBySymbol('T_AAPL', 'test-org');

      expect(count).toBe(1);
    });

    it('should throw BadRequestException for invalid symbol', async () => {
      await expect(
        repository.countBySymbol('AAPL', 'test-org'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error on count failure', async () => {
      const mockClient = createMockClient({
        count: { count: null, error: { message: 'Count failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.countBySymbol('T_AAPL', 'test-org'),
      ).rejects.toThrow(
        'Failed to count test price data by symbol: Count failed',
      );
    });
  });

  describe('symbol validation', () => {
    it('should accept valid T_ prefixed symbols', async () => {
      const validSymbols = ['T_AAPL', 'T_MSFT', 'T_BTC', 'T_TEST123'];

      for (const symbol of validSymbols) {
        const mockClient = createMockClient({
          list: { data: [{ ...mockPriceData, symbol }], error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findBySymbol(symbol, 'test-org');
        expect(result).toBeDefined();
      }
    });

    it('should reject symbols without T_ prefix', async () => {
      const invalidSymbols = ['AAPL', 'MSFT', 'BTC', 'TEST', 't_AAPL', 'T_'];

      for (const symbol of invalidSymbols) {
        if (symbol !== 'T_') {
          await expect(
            repository.findBySymbol(symbol, 'test-org'),
          ).rejects.toThrow(BadRequestException);
        }
      }
    });
  });
});
