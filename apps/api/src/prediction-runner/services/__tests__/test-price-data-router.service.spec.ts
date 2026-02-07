import { Test, TestingModule } from '@nestjs/testing';
import {
  TestPriceDataRouterService,
  ExternalPriceFetcher,
  PriceDataPoint,
} from '../test-price-data-router.service';
import { TestPriceDataService } from '../test-price-data.service';
import {
  TestPriceDataRepository,
  TestPriceData,
} from '../../repositories/test-price-data.repository';

describe('TestPriceDataRouterService', () => {
  let service: TestPriceDataRouterService;
  let testPriceDataService: jest.Mocked<TestPriceDataService>;
  let _testPriceDataRepository: jest.Mocked<TestPriceDataRepository>;

  const mockTestPriceData: TestPriceData = {
    id: 'price-123',
    symbol: 'T_AAPL',
    price_timestamp: '2024-01-01T10:00:00Z',
    open: 150.0,
    high: 155.0,
    low: 148.0,
    close: 153.0,
    volume: 1000000,
    organization_slug: 'test-org',
    scenario_id: null,
    created_at: '2024-01-01T10:00:00Z',
    metadata: {},
  };

  const mockPriceDataPoint: PriceDataPoint = {
    symbol: 'AAPL',
    timestamp: '2024-01-01T10:00:00Z',
    open: 150.0,
    high: 155.0,
    low: 148.0,
    close: 153.0,
    volume: 1000000,
    is_test: false,
    source: 'external_api',
  };

  const mockExternalFetcher: ExternalPriceFetcher = {
    getLatestPrice: jest.fn(),
    getPriceRange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestPriceDataRouterService,
        {
          provide: TestPriceDataService,
          useValue: {
            getLatestPrice: jest.fn().mockResolvedValue(mockTestPriceData),
            getPriceRange: jest.fn().mockResolvedValue([mockTestPriceData]),
            generatePriceHistory: jest
              .fn()
              .mockResolvedValue([mockTestPriceData]),
            importFromJSON: jest.fn().mockResolvedValue({
              created_count: 10,
              failed_count: 0,
              errors: [],
            }),
          },
        },
        {
          provide: TestPriceDataRepository,
          useValue: {
            findLatest: jest.fn(),
            findByRange: jest.fn(),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestPriceDataRouterService>(
      TestPriceDataRouterService,
    );
    testPriceDataService = module.get(TestPriceDataService);
    _testPriceDataRepository = module.get(TestPriceDataRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isTestSymbol', () => {
    it('should return true for T_ prefixed symbols', () => {
      expect(service.isTestSymbol('T_AAPL')).toBe(true);
      expect(service.isTestSymbol('T_MSFT')).toBe(true);
      expect(service.isTestSymbol('T_GOOG')).toBe(true);
    });

    it('should return false for regular symbols', () => {
      expect(service.isTestSymbol('AAPL')).toBe(false);
      expect(service.isTestSymbol('MSFT')).toBe(false);
      expect(service.isTestSymbol('TEST')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(service.isTestSymbol('t_AAPL')).toBe(false);
      expect(service.isTestSymbol('T_aapl')).toBe(true);
    });
  });

  describe('getRealSymbol', () => {
    it('should remove T_ prefix from test symbols', () => {
      expect(service.getRealSymbol('T_AAPL')).toBe('AAPL');
      expect(service.getRealSymbol('T_MSFT')).toBe('MSFT');
    });

    it('should return regular symbols unchanged', () => {
      expect(service.getRealSymbol('AAPL')).toBe('AAPL');
      expect(service.getRealSymbol('MSFT')).toBe('MSFT');
    });
  });

  describe('getTestSymbol', () => {
    it('should add T_ prefix to regular symbols', () => {
      expect(service.getTestSymbol('AAPL')).toBe('T_AAPL');
      expect(service.getTestSymbol('MSFT')).toBe('T_MSFT');
    });

    it('should return test symbols unchanged', () => {
      expect(service.getTestSymbol('T_AAPL')).toBe('T_AAPL');
      expect(service.getTestSymbol('T_MSFT')).toBe('T_MSFT');
    });
  });

  describe('setExternalFetcher', () => {
    it('should set the external fetcher', () => {
      service.setExternalFetcher(mockExternalFetcher);

      // Verify by attempting to use it
      expect(() =>
        service.setExternalFetcher(mockExternalFetcher),
      ).not.toThrow();
    });
  });

  describe('getLatestPrice', () => {
    it('should route test symbols to test price data', async () => {
      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(testPriceDataService.getLatestPrice).toHaveBeenCalledWith(
        'T_AAPL',
        'test-org',
      );
      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should route regular symbols to external API', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getLatestPrice as jest.Mock).mockResolvedValue(
        mockPriceDataPoint,
      );

      const result = await service.getLatestPrice('AAPL', 'test-org');

      expect(mockExternalFetcher.getLatestPrice).toHaveBeenCalledWith('AAPL');
      expect(result.is_test_route).toBe(false);
      expect(result.data).toEqual(mockPriceDataPoint);
    });

    it('should return error when no external fetcher configured', async () => {
      const result = await service.getLatestPrice('AAPL', 'test-org');

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('No external price fetcher configured');
    });

    it('should return error when test price data not found', async () => {
      (testPriceDataService.getLatestPrice as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toContain('No test price data found');
    });

    it('should handle test price data fetch errors', async () => {
      (testPriceDataService.getLatestPrice as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Database error');
    });

    it('should handle external API fetch errors', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getLatestPrice as jest.Mock).mockRejectedValue(
        new Error('API error'),
      );

      const result = await service.getLatestPrice('AAPL', 'test-org');

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('API error');
    });

    it('should handle external API returning null', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getLatestPrice as jest.Mock).mockResolvedValue(null);

      const result = await service.getLatestPrice('AAPL', 'test-org');

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('No price data available');
    });
  });

  describe('getPriceRange', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should route test symbols to test price data', async () => {
      const result = await service.getPriceRange(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(testPriceDataService.getPriceRange).toHaveBeenCalledWith(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
      );
      expect(result.is_test_route).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should route regular symbols to external API', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue([
        mockPriceDataPoint,
      ]);

      const result = await service.getPriceRange(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(mockExternalFetcher.getPriceRange).toHaveBeenCalledWith(
        'AAPL',
        startDate,
        endDate,
      );
      expect(result.is_test_route).toBe(false);
      expect(result.data).toEqual([mockPriceDataPoint]);
    });

    it('should return error when no external fetcher configured for range', async () => {
      const result = await service.getPriceRange(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('No external price fetcher configured');
    });

    it('should return empty array with error when test price range not found', async () => {
      (testPriceDataService.getPriceRange as jest.Mock).mockResolvedValue([]);

      const result = await service.getPriceRange(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.error).toContain('No test price data found');
    });

    it('should handle test price range fetch errors', async () => {
      (testPriceDataService.getPriceRange as jest.Mock).mockRejectedValue(
        new Error('Range fetch error'),
      );

      const result = await service.getPriceRange(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Range fetch error');
    });

    it('should handle external API range fetch errors', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockRejectedValue(
        new Error('External range error'),
      );

      const result = await service.getPriceRange(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('External range error');
    });
  });

  describe('generateTestPriceHistory', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const params = { startPrice: 150, volatility: 0.02, drift: 0.001 };

    it('should generate test price history for test symbols', async () => {
      const result = await service.generateTestPriceHistory(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
        params,
      );

      expect(testPriceDataService.generatePriceHistory).toHaveBeenCalledWith(
        'T_AAPL',
        startDate,
        endDate,
        'test-org',
        params,
        undefined,
      );
      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should include scenario ID when provided', async () => {
      await service.generateTestPriceHistory(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
        params,
        'scenario-123',
      );

      expect(testPriceDataService.generatePriceHistory).toHaveBeenCalledWith(
        'T_AAPL',
        startDate,
        endDate,
        'test-org',
        params,
        'scenario-123',
      );
    });

    it('should return error for non-test symbols', async () => {
      const result = await service.generateTestPriceHistory(
        'AAPL',
        'test-org',
        startDate,
        endDate,
        params,
      );

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain(
        'Cannot generate test prices for non-test symbol',
      );
      expect(result.error).toContain('Use T_AAPL instead');
    });

    it('should handle generation errors', async () => {
      (
        testPriceDataService.generatePriceHistory as jest.Mock
      ).mockRejectedValue(new Error('Generation failed'));

      const result = await service.generateTestPriceHistory(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
        params,
      );

      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Generation failed');
    });

    it('should convert test price data to data points', async () => {
      const result = await service.generateTestPriceHistory(
        'T_AAPL',
        'test-org',
        startDate,
        endDate,
        params,
      );

      expect(result.data).toBeDefined();
      const dataArray = result.data as PriceDataPoint[];
      expect(dataArray[0]?.is_test).toBe(true);
      expect(dataArray[0]?.source).toBe('test_db');
    });
  });

  describe('seedTestPriceFromReal', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should return error when no external fetcher configured', async () => {
      const result = await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('No external price fetcher configured');
    });

    it('should seed test price data from real data', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue([
        mockPriceDataPoint,
      ]);

      const result = await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(mockExternalFetcher.getPriceRange).toHaveBeenCalledWith(
        'AAPL',
        startDate,
        endDate,
      );
      expect(testPriceDataService.importFromJSON).toHaveBeenCalled();
      expect(result.is_test_route).toBe(true);
    });

    it('should return error when real data not available', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue(null);

      const result = await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.data).toBeNull();
      expect(result.error).toContain('No price data available');
    });

    it('should handle real data fetch errors', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockRejectedValue(
        new Error('External API error'),
      );

      const result = await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.error).toBe('External API error');
    });

    it('should handle import errors', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue([
        mockPriceDataPoint,
      ]);
      (testPriceDataService.importFromJSON as jest.Mock).mockRejectedValue(
        new Error('Import failed'),
      );

      const result = await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      expect(result.is_test_route).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Import failed');
    });

    it('should include scenario ID when provided', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue([
        mockPriceDataPoint,
      ]);

      await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
        'scenario-123',
      );

      expect(testPriceDataService.importFromJSON).toHaveBeenCalledWith(
        expect.any(Array),
        'test-org',
        'scenario-123',
      );
    });

    it('should transform real symbol to test symbol during import', async () => {
      service.setExternalFetcher(mockExternalFetcher);
      (mockExternalFetcher.getPriceRange as jest.Mock).mockResolvedValue([
        mockPriceDataPoint,
      ]);

      await service.seedTestPriceFromReal(
        'AAPL',
        'test-org',
        startDate,
        endDate,
      );

      const importCall = (testPriceDataService.importFromJSON as jest.Mock).mock
        .calls[0];
      expect(importCall[0][0].symbol).toBe('T_AAPL');
    });
  });

  describe('price data point conversion', () => {
    it('should convert test price data to price data point format', async () => {
      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(result.data).toBeDefined();
      const point = result.data as PriceDataPoint;
      expect(point.symbol).toBe('T_AAPL');
      expect(point.timestamp).toBe('2024-01-01T10:00:00Z');
      expect(point.open).toBe(150.0);
      expect(point.high).toBe(155.0);
      expect(point.low).toBe(148.0);
      expect(point.close).toBe(153.0);
      expect(point.volume).toBe(1000000);
      expect(point.is_test).toBe(true);
      expect(point.source).toBe('test_db');
    });

    it('should handle volume in test price data', async () => {
      const priceWithVolume: TestPriceData = {
        ...mockTestPriceData,
        volume: 500000,
      };
      (testPriceDataService.getLatestPrice as jest.Mock).mockResolvedValue(
        priceWithVolume,
      );

      const result = await service.getLatestPrice('T_AAPL', 'test-org');

      expect(result.data).toBeDefined();
      const point = result.data as PriceDataPoint;
      expect(point.volume).toBe(500000);
    });
  });
});
