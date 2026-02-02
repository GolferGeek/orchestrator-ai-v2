import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  TestPriceDataService,
  GeneratePriceHistoryParams,
  CSVPriceDataRow,
  JSONPriceDataRow,
} from '../test-price-data.service';
import {
  TestPriceDataRepository,
  TestPriceData,
  BulkCreateResult,
} from '../../repositories/test-price-data.repository';

describe('TestPriceDataService', () => {
  let service: TestPriceDataService;
  let repository: jest.Mocked<TestPriceDataRepository>;

  const mockPriceData: TestPriceData = {
    id: 'price-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    symbol: 'T_AAPL',
    price_timestamp: '2024-01-01T10:00:00Z',
    open: 100,
    high: 105,
    low: 98,
    close: 103,
    volume: 1000000,
    metadata: {},
    created_at: new Date().toISOString(),
  };

  const mockBulkResult: BulkCreateResult = {
    created_count: 10,
    failed_count: 0,
    errors: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestPriceDataService,
        {
          provide: TestPriceDataRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockPriceData),
            bulkCreate: jest.fn().mockResolvedValue(mockBulkResult),
            findLatestPrice: jest.fn().mockResolvedValue(mockPriceData),
            findByDateRange: jest.fn().mockResolvedValue([mockPriceData]),
            findBySymbol: jest.fn().mockResolvedValue([mockPriceData]),
            findByFilter: jest.fn().mockResolvedValue([mockPriceData]),
            deleteBySymbol: jest.fn().mockResolvedValue(5),
            deleteByScenario: jest.fn().mockResolvedValue(10),
            countBySymbol: jest.fn().mockResolvedValue(100),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestPriceDataService>(TestPriceDataService);
    repository = module.get(TestPriceDataRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSymbol', () => {
    it('should accept valid T_ prefixed symbol', () => {
      expect(() => service.validateSymbol('T_AAPL')).not.toThrow();
    });

    it('should accept T_ prefix with any suffix', () => {
      expect(() => service.validateSymbol('T_BTC_USD')).not.toThrow();
      expect(() => service.validateSymbol('T_TEST123')).not.toThrow();
    });

    it('should reject symbol without T_ prefix (INV-08)', () => {
      expect(() => service.validateSymbol('AAPL')).toThrow(BadRequestException);
      expect(() => service.validateSymbol('AAPL')).toThrow(
        'Test symbols must start with T_ prefix',
      );
    });

    it('should reject empty symbol', () => {
      expect(() => service.validateSymbol('')).toThrow(BadRequestException);
    });

    it('should reject symbol with lowercase t_', () => {
      expect(() => service.validateSymbol('t_AAPL')).toThrow(BadRequestException);
    });
  });

  describe('createPriceData', () => {
    it('should create price data for valid symbol', async () => {
      const data = {
        organization_slug: 'test-org',
        symbol: 'T_AAPL',
        price_timestamp: '2024-01-01T10:00:00Z',
        open: 100,
        high: 105,
        low: 98,
        close: 103,
        volume: 1000000,
      };

      const result = await service.createPriceData(data);

      expect(repository.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockPriceData);
    });

    it('should reject invalid symbol', async () => {
      const data = {
        organization_slug: 'test-org',
        symbol: 'AAPL', // Missing T_ prefix
        price_timestamp: '2024-01-01T10:00:00Z',
        open: 100,
        high: 105,
        low: 98,
        close: 103,
        volume: 1000000,
      };

      await expect(service.createPriceData(data)).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreatePriceData', () => {
    it('should bulk create price data', async () => {
      const records = [
        {
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
          volume: 1000000,
        },
        {
          organization_slug: 'test-org',
          symbol: 'T_MSFT',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 200,
          high: 210,
          low: 198,
          close: 205,
          volume: 500000,
        },
      ];

      const result = await service.bulkCreatePriceData(records);

      expect(repository.bulkCreate).toHaveBeenCalledWith(records);
      expect(result).toEqual(mockBulkResult);
    });

    it('should reject if any record has invalid symbol', async () => {
      const records = [
        {
          organization_slug: 'test-org',
          symbol: 'T_AAPL',
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
          volume: 1000000,
        },
        {
          organization_slug: 'test-org',
          symbol: 'INVALID', // Missing T_ prefix
          price_timestamp: '2024-01-01T10:00:00Z',
          open: 200,
          high: 210,
          low: 198,
          close: 205,
          volume: 500000,
        },
      ];

      await expect(service.bulkCreatePriceData(records)).rejects.toThrow(BadRequestException);
      expect(repository.bulkCreate).not.toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      repository.bulkCreate.mockResolvedValue({
        created_count: 0,
        failed_count: 0,
        errors: [],
      });

      const result = await service.bulkCreatePriceData([]);

      expect(repository.bulkCreate).toHaveBeenCalledWith([]);
      expect(result.created_count).toBe(0);
    });
  });

  describe('generatePriceHistory', () => {
    it('should generate price history with valid parameters', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
        volatility: 0.02,
        drift: 0.001,
      };
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');

      const result = await service.generatePriceHistory(
        'T_AAPL',
        startDate,
        endDate,
        'test-org',
        params,
      );

      expect(repository.bulkCreate).toHaveBeenCalled();
      expect(repository.findBySymbol).toHaveBeenCalledWith('T_AAPL', 'test-org');
      expect(result).toBeDefined();
    });

    it('should generate price history with scenario ID', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
      };

      await service.generatePriceHistory(
        'T_AAPL',
        new Date('2024-01-01'),
        new Date('2024-01-05'),
        'test-org',
        params,
        'scenario-123',
      );

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ scenario_id?: string }>;
      expect(bulkCreateCall?.[0]?.scenario_id).toBe('scenario-123');
    });

    it('should reject invalid symbol', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
      };

      await expect(
        service.generatePriceHistory(
          'AAPL', // Invalid
          new Date('2024-01-01'),
          new Date('2024-01-10'),
          'test-org',
          params,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative start price', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: -100,
      };

      await expect(
        service.generatePriceHistory(
          'T_AAPL',
          new Date('2024-01-01'),
          new Date('2024-01-10'),
          'test-org',
          params,
        ),
      ).rejects.toThrow('Start price must be positive');
    });

    it('should reject if start date is after end date', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
      };

      await expect(
        service.generatePriceHistory(
          'T_AAPL',
          new Date('2024-01-10'),
          new Date('2024-01-01'), // Before start
          'test-org',
          params,
        ),
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should use default parameters when not provided', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
      };

      await service.generatePriceHistory(
        'T_AAPL',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
        'test-org',
        params,
      );

      expect(repository.bulkCreate).toHaveBeenCalled();
    });

    it('should include metadata in generated records', async () => {
      const params: GeneratePriceHistoryParams = {
        startPrice: 100,
        volatility: 0.03,
        drift: 0.005,
        intradayVolatility: 0.4,
      };

      await service.generatePriceHistory(
        'T_AAPL',
        new Date('2024-01-01'),
        new Date('2024-01-02'),
        'test-org',
        params,
      );

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{
        metadata?: { generated?: boolean; generation_params?: { volatility?: number } };
      }>;
      expect(bulkCreateCall?.[0]?.metadata?.generated).toBe(true);
      expect(bulkCreateCall?.[0]?.metadata?.generation_params?.volatility).toBe(0.03);
    });
  });

  describe('importFromCSV', () => {
    it('should import price data from CSV', async () => {
      const csvData: CSVPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
          volume: 1000000,
        },
        {
          symbol: 'T_MSFT',
          timestamp: '2024-01-01T10:00:00Z',
          open: '200',
          high: '210',
          low: '198',
          close: '205',
          volume: '500000',
        },
      ];

      const result = await service.importFromCSV(csvData, 'test-org');

      expect(repository.bulkCreate).toHaveBeenCalled();
      expect(result).toEqual(mockBulkResult);
    });

    it('should include scenario ID when provided', async () => {
      const csvData: CSVPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await service.importFromCSV(csvData, 'test-org', 'scenario-123');

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ scenario_id?: string }>;
      expect(bulkCreateCall?.[0]?.scenario_id).toBe('scenario-123');
    });

    it('should reject CSV with invalid symbol', async () => {
      const csvData: CSVPriceDataRow[] = [
        {
          symbol: 'AAPL', // Invalid
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await expect(service.importFromCSV(csvData, 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim whitespace from symbol', async () => {
      const csvData: CSVPriceDataRow[] = [
        {
          symbol: '  T_AAPL  ',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await service.importFromCSV(csvData, 'test-org');

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ symbol?: string }>;
      expect(bulkCreateCall?.[0]?.symbol).toBe('T_AAPL');
    });

    it('should default volume to 0 when not provided', async () => {
      const csvData: CSVPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await service.importFromCSV(csvData, 'test-org');

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ volume?: number }>;
      expect(bulkCreateCall?.[0]?.volume).toBe(0);
    });
  });

  describe('importFromJSON', () => {
    it('should import price data from JSON', async () => {
      const jsonData: JSONPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
          volume: 1000000,
        },
      ];

      const result = await service.importFromJSON(jsonData, 'test-org');

      expect(repository.bulkCreate).toHaveBeenCalled();
      expect(result).toEqual(mockBulkResult);
    });

    it('should include scenario ID when provided', async () => {
      const jsonData: JSONPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await service.importFromJSON(jsonData, 'test-org', 'scenario-123');

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ scenario_id?: string }>;
      expect(bulkCreateCall?.[0]?.scenario_id).toBe('scenario-123');
    });

    it('should reject JSON with invalid symbol', async () => {
      const jsonData: JSONPriceDataRow[] = [
        {
          symbol: 'AAPL', // Invalid
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await expect(service.importFromJSON(jsonData, 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should default volume to 0 when not provided', async () => {
      const jsonData: JSONPriceDataRow[] = [
        {
          symbol: 'T_AAPL',
          timestamp: '2024-01-01T10:00:00Z',
          open: 100,
          high: 105,
          low: 98,
          close: 103,
        },
      ];

      await service.importFromJSON(jsonData, 'test-org');

      const bulkCreateCall = repository.bulkCreate.mock.calls[0]?.[0] as Array<{ volume?: number }>;
      expect(bulkCreateCall?.[0]?.volume).toBe(0);
    });
  });

  describe('getLatestPrice', () => {
    it('should get latest price for valid symbol', async () => {
      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(repository.findLatestPrice).toHaveBeenCalledWith('T_AAPL', 'test-org');
      expect(result).toEqual(mockPriceData);
    });

    it('should reject invalid symbol', async () => {
      await expect(service.getLatestPrice('AAPL', 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return null when no data found', async () => {
      repository.findLatestPrice.mockResolvedValue(null);

      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(result).toBeNull();
    });
  });

  describe('getPriceRange', () => {
    it('should get price data in date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await service.getPriceRange('T_AAPL', 'test-org', startDate, endDate);

      expect(repository.findByDateRange).toHaveBeenCalledWith(
        'T_AAPL',
        'test-org',
        startDate.toISOString(),
        endDate.toISOString(),
      );
      expect(result).toEqual([mockPriceData]);
    });

    it('should reject invalid symbol', async () => {
      await expect(
        service.getPriceRange('AAPL', 'test-org', new Date(), new Date()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllPriceData', () => {
    it('should get all price data for symbol', async () => {
      const result = await service.getAllPriceData('T_AAPL', 'test-org');

      expect(repository.findBySymbol).toHaveBeenCalledWith('T_AAPL', 'test-org');
      expect(result).toEqual([mockPriceData]);
    });

    it('should reject invalid symbol', async () => {
      await expect(service.getAllPriceData('AAPL', 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPriceDataByFilter', () => {
    it('should get price data by filter', async () => {
      const filter = { symbol: 'T_AAPL', organization_slug: 'test-org' };

      const result = await service.getPriceDataByFilter(filter);

      expect(repository.findByFilter).toHaveBeenCalledWith(filter);
      expect(result).toEqual([mockPriceData]);
    });

    it('should reject filter with invalid symbol', async () => {
      const filter = { symbol: 'AAPL' };

      await expect(service.getPriceDataByFilter(filter)).rejects.toThrow(BadRequestException);
    });

    it('should allow filter without symbol', async () => {
      const filter = { organization_slug: 'test-org' };

      const result = await service.getPriceDataByFilter(filter);

      expect(repository.findByFilter).toHaveBeenCalledWith(filter);
      expect(result).toBeDefined();
    });
  });

  describe('deletePriceData', () => {
    it('should delete price data for symbol', async () => {
      const result = await service.deletePriceData('T_AAPL', 'test-org');

      expect(repository.deleteBySymbol).toHaveBeenCalledWith('T_AAPL', 'test-org');
      expect(result).toBe(5);
    });

    it('should reject invalid symbol', async () => {
      await expect(service.deletePriceData('AAPL', 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deletePriceDataByScenario', () => {
    it('should delete price data for scenario', async () => {
      const result = await service.deletePriceDataByScenario('scenario-123');

      expect(repository.deleteByScenario).toHaveBeenCalledWith('scenario-123');
      expect(result).toBe(10);
    });
  });

  describe('countPriceData', () => {
    it('should count price data for symbol', async () => {
      const result = await service.countPriceData('T_AAPL', 'test-org');

      expect(repository.countBySymbol).toHaveBeenCalledWith('T_AAPL', 'test-org');
      expect(result).toBe(100);
    });

    it('should reject invalid symbol', async () => {
      await expect(service.countPriceData('AAPL', 'test-org')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
