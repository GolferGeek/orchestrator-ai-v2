/**
 * Test Price Data Handler Tests
 *
 * Tests for the test price data dashboard handler, covering CRUD operations,
 * bulk operations, query operations, and count/delete operations.
 */

import { Test } from '@nestjs/testing';
import { TestPriceDataHandler } from '../test-price-data.handler';
import { TestPriceDataRepository } from '../../../repositories/test-price-data.repository';
import type {
  TestPriceData,
  BulkCreateResult,
} from '../../../repositories/test-price-data.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('TestPriceDataHandler', () => {
  let handler: TestPriceDataHandler;
  let mockRepository: jest.Mocked<TestPriceDataRepository>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: 'prediction-runner',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockPriceData: TestPriceData = {
    id: 'price-1',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    symbol: 'T_BTC',
    price_timestamp: '2024-01-01T12:00:00Z',
    open: 50000,
    high: 51000,
    low: 49500,
    close: 50500,
    volume: 1000000,
    created_at: '2024-01-01T10:00:00Z',
    metadata: {},
  };

  beforeEach(async () => {
    const mockTestPriceDataRepository = {
      findById: jest.fn(),
      findByFilter: jest.fn(),
      findByScenario: jest.fn(),
      findBySymbol: jest.fn(),
      findByDateRange: jest.fn(),
      findLatestPrice: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      bulkCreate: jest.fn(),
      countByScenario: jest.fn(),
      countBySymbol: jest.fn(),
      deleteByScenario: jest.fn(),
      deleteBySymbol: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TestPriceDataHandler,
        {
          provide: TestPriceDataRepository,
          useValue: mockTestPriceDataRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<TestPriceDataHandler>(TestPriceDataHandler);
    mockRepository = moduleRef.get(TestPriceDataRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();

      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('bulk-create');
      expect(actions).toContain('get-latest');
      expect(actions).toContain('get-by-date-range');
      expect(actions).toContain('count-by-scenario');
      expect(actions).toContain('count-by-symbol');
      expect(actions).toContain('delete-by-scenario');
      expect(actions).toContain('delete-by-symbol');
    });
  });

  describe('CRUD Operations', () => {
    describe('list', () => {
      it('should list all price data for organization', async () => {
        mockRepository.findByFilter.mockResolvedValue([mockPriceData]);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {},
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findByFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            organization_slug: 'test-org',
            offset: 0,
            limit: 100,
          }),
        );
        expect(result.data).toHaveLength(1);
        expect((result.data as TestPriceData[])[0]?.symbol).toBe('T_BTC');
      });

      it('should filter by scenario', async () => {
        mockRepository.findByFilter.mockResolvedValue([mockPriceData]);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findByFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            scenario_id: 'scenario-123',
          }),
        );
      });

      it('should filter by symbol', async () => {
        mockRepository.findByFilter.mockResolvedValue([mockPriceData]);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {
            filters: {
              symbol: 'T_BTC',
            },
          },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findByFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            symbol: 'T_BTC',
          }),
        );
      });

      it('should filter by date range', async () => {
        mockRepository.findByFilter.mockResolvedValue([mockPriceData]);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {
            filters: {
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findByFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: '2024-01-01T00:00:00Z',
            end_date: '2024-01-31T23:59:59Z',
          }),
        );
      });

      it('should handle pagination', async () => {
        // Return exactly pageSize items to indicate there might be more
        const priceDataList = Array.from({ length: 50 }, (_, i) => ({
          ...mockPriceData,
          id: `price-${i}`,
        }));
        mockRepository.findByFilter.mockResolvedValue(priceDataList);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {
            page: 2,
            pageSize: 50,
          },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findByFilter).toHaveBeenCalledWith(
          expect.objectContaining({
            offset: 50,
            limit: 50,
          }),
        );
        expect(result.metadata?.page).toBe(2);
        expect(result.metadata?.pageSize).toBe(50);
        expect(result.metadata?.hasMore).toBe(true);
      });

      it('should handle repository errors', async () => {
        mockRepository.findByFilter.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {},
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('LIST_FAILED');
        expect(result.error?.message).toContain('Database error');
      });
    });

    describe('get', () => {
      it('should get price data by ID', async () => {
        mockRepository.findById.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'get',
          params: { id: 'price-1' },
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.findById).toHaveBeenCalledWith('price-1');
        expect((result.data as TestPriceData).id).toBe('price-1');
        expect((result.data as TestPriceData).symbol).toBe('T_BTC');
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get',
          params: {},
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });

      it('should return error when price data not found', async () => {
        mockRepository.findById.mockResolvedValue(null);

        const payload: DashboardRequestPayload = {
          action: 'get',
          params: { id: 'nonexistent' },
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NOT_FOUND');
      });

      it('should handle repository errors', async () => {
        mockRepository.findById.mockRejectedValue(new Error('Database error'));

        const payload: DashboardRequestPayload = {
          action: 'get',
          params: { id: 'price-1' },
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GET_FAILED');
      });
    });

    describe('create', () => {
      it('should create new price data', async () => {
        mockRepository.create.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            symbol: 'T_BTC',
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
            volume: 1000000,
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            organization_slug: 'test-org',
            symbol: 'T_BTC',
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
            volume: 1000000,
          }),
        );
      });

      it('should create with scenario_id', async () => {
        mockRepository.create.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            scenario_id: 'scenario-123',
            symbol: 'T_BTC',
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            scenario_id: 'scenario-123',
          }),
        );
      });

      it('should return error when symbol is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
        expect(result.error?.message).toContain('symbol');
      });

      it('should return error when price_timestamp is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            symbol: 'T_BTC',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
        expect(result.error?.message).toContain('price_timestamp');
      });

      it('should return error when OHLCV prices are missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            symbol: 'T_BTC',
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            // Missing low and close
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
        expect(result.error?.message).toContain('open, high, low, and close');
      });

      it('should handle repository errors', async () => {
        mockRepository.create.mockRejectedValue(new Error('Database error'));

        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            symbol: 'T_BTC',
            price_timestamp: '2024-01-01T12:00:00Z',
            open: 50000,
            high: 51000,
            low: 49500,
            close: 50500,
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CREATE_FAILED');
      });
    });

    describe('update', () => {
      it('should update price data', async () => {
        const updatedPriceData = { ...mockPriceData, close: 51000 };
        mockRepository.update.mockResolvedValue(updatedPriceData);

        const payload: DashboardRequestPayload = {
          action: 'update',
          params: {
            id: 'price-1',
            close: 51000,
          },
        };

        const result = await handler.execute('update', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.update).toHaveBeenCalledWith('price-1', {
          close: 51000,
        });
        expect((result.data as TestPriceData).close).toBe(51000);
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'update',
          params: {
            close: 51000,
          },
        };

        const result = await handler.execute('update', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });

      it('should handle repository errors', async () => {
        mockRepository.update.mockRejectedValue(new Error('Database error'));

        const payload: DashboardRequestPayload = {
          action: 'update',
          params: {
            id: 'price-1',
            close: 51000,
          },
        };

        const result = await handler.execute('update', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('UPDATE_FAILED');
      });
    });

    describe('delete', () => {
      it('should delete price data', async () => {
        mockRepository.delete.mockResolvedValue(undefined);

        const payload: DashboardRequestPayload = {
          action: 'delete',
          params: { id: 'price-1' },
        };

        const result = await handler.execute('delete', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockRepository.delete).toHaveBeenCalledWith('price-1');
        expect((result.data as { deleted: boolean; id: string }).deleted).toBe(
          true,
        );
        expect((result.data as { deleted: boolean; id: string }).id).toBe(
          'price-1',
        );
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'delete',
          params: {},
        };

        const result = await handler.execute('delete', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });

      it('should handle repository errors', async () => {
        mockRepository.delete.mockRejectedValue(new Error('Database error'));

        const payload: DashboardRequestPayload = {
          action: 'delete',
          params: { id: 'price-1' },
        };

        const result = await handler.execute('delete', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('DELETE_FAILED');
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulk-create', () => {
      it('should bulk create price data', async () => {
        const bulkResult: BulkCreateResult = {
          created_count: 3,
          failed_count: 0,
          errors: [],
        };
        mockRepository.bulkCreate.mockResolvedValue(bulkResult);

        const payload: DashboardRequestPayload = {
          action: 'bulk-create',
          params: {
            priceData: [
              {
                symbol: 'T_BTC',
                price_timestamp: '2024-01-01T12:00:00Z',
                open: 50000,
                high: 51000,
                low: 49500,
                close: 50500,
              },
              {
                symbol: 'T_ETH',
                price_timestamp: '2024-01-01T12:00:00Z',
                open: 3000,
                high: 3100,
                low: 2950,
                close: 3050,
              },
              {
                symbol: 'T_BTC',
                price_timestamp: '2024-01-01T13:00:00Z',
                open: 50500,
                high: 51500,
                low: 50000,
                close: 51000,
              },
            ],
          },
        };

        const result = await handler.execute(
          'bulk-create',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.bulkCreate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              organization_slug: 'test-org',
              symbol: 'T_BTC',
            }),
            expect.objectContaining({
              organization_slug: 'test-org',
              symbol: 'T_ETH',
            }),
          ]),
        );
        expect((result.data as BulkCreateResult).created_count).toBe(3);
      });

      it('should handle case insensitivity for action name', async () => {
        const bulkResult: BulkCreateResult = {
          created_count: 1,
          failed_count: 0,
          errors: [],
        };
        mockRepository.bulkCreate.mockResolvedValue(bulkResult);

        const payload: DashboardRequestPayload = {
          action: 'bulkcreate',
          params: {
            priceData: [
              {
                symbol: 'T_BTC',
                price_timestamp: '2024-01-01T12:00:00Z',
                open: 50000,
                high: 51000,
                low: 49500,
                close: 50500,
              },
            ],
          },
        };

        const result = await handler.execute(
          'bulkcreate',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when priceData is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'bulk-create',
          params: {},
        };

        const result = await handler.execute(
          'bulk-create',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
        expect(result.error?.message).toContain('priceData array');
      });

      it('should return error when priceData is not an array', async () => {
        const payload: DashboardRequestPayload = {
          action: 'bulk-create',
          params: {
            priceData: 'not-an-array',
          },
        };

        const result = await handler.execute(
          'bulk-create',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
      });

      it('should handle repository errors', async () => {
        mockRepository.bulkCreate.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'bulk-create',
          params: {
            priceData: [
              {
                symbol: 'T_BTC',
                price_timestamp: '2024-01-01T12:00:00Z',
                open: 50000,
                high: 51000,
                low: 49500,
                close: 50500,
              },
            ],
          },
        };

        const result = await handler.execute(
          'bulk-create',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('BULK_CREATE_FAILED');
      });
    });
  });

  describe('Query Operations', () => {
    describe('get-latest', () => {
      it('should get latest price for symbol', async () => {
        mockRepository.findLatestPrice.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'get-latest',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'get-latest',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.findLatestPrice).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
        expect((result.data as TestPriceData).symbol).toBe('T_BTC');
      });

      it('should get symbol from filters', async () => {
        mockRepository.findLatestPrice.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'get-latest',
          params: {
            filters: {
              symbol: 'T_BTC',
            },
          },
        };

        const result = await handler.execute(
          'get-latest',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.findLatestPrice).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.findLatestPrice.mockResolvedValue(mockPriceData);

        const payload: DashboardRequestPayload = {
          action: 'getlatest',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute('getlatest', payload, mockContext);

        expect(result.success).toBe(true);
      });

      it('should return error when symbol is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-latest',
          params: {},
        };

        const result = await handler.execute(
          'get-latest',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_SYMBOL');
      });

      it('should return error when price data not found', async () => {
        mockRepository.findLatestPrice.mockResolvedValue(null);

        const payload: DashboardRequestPayload = {
          action: 'get-latest',
          params: {
            symbol: 'T_NONEXISTENT',
          },
        };

        const result = await handler.execute(
          'get-latest',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NOT_FOUND');
      });

      it('should handle repository errors', async () => {
        mockRepository.findLatestPrice.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'get-latest',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'get-latest',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GET_LATEST_FAILED');
      });
    });

    describe('get-by-date-range', () => {
      it('should get price data by date range', async () => {
        const priceDataList = [
          mockPriceData,
          {
            ...mockPriceData,
            id: 'price-2',
            price_timestamp: '2024-01-02T12:00:00Z',
          },
          {
            ...mockPriceData,
            id: 'price-3',
            price_timestamp: '2024-01-03T12:00:00Z',
          },
        ];
        mockRepository.findByDateRange.mockResolvedValue(priceDataList);

        const payload: DashboardRequestPayload = {
          action: 'get-by-date-range',
          params: {
            filters: {
              symbol: 'T_BTC',
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute(
          'get-by-date-range',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.findByDateRange).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
          '2024-01-01T00:00:00Z',
          '2024-01-31T23:59:59Z',
        );
        expect(result.data).toHaveLength(3);
        expect(result.metadata?.totalCount).toBe(3);
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.findByDateRange.mockResolvedValue([mockPriceData]);

        const payload: DashboardRequestPayload = {
          action: 'getbydaterange',
          params: {
            filters: {
              symbol: 'T_BTC',
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute(
          'getbydaterange',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when symbol is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-by-date-range',
          params: {
            filters: {
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute(
          'get-by-date-range',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAMS');
        expect(result.error?.message).toContain('symbol');
      });

      it('should return error when startDate is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-by-date-range',
          params: {
            filters: {
              symbol: 'T_BTC',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute(
          'get-by-date-range',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAMS');
        expect(result.error?.message).toContain('startDate');
      });

      it('should return error when endDate is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-by-date-range',
          params: {
            filters: {
              symbol: 'T_BTC',
              startDate: '2024-01-01T00:00:00Z',
            },
          },
        };

        const result = await handler.execute(
          'get-by-date-range',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_PARAMS');
      });

      it('should handle repository errors', async () => {
        mockRepository.findByDateRange.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'get-by-date-range',
          params: {
            filters: {
              symbol: 'T_BTC',
              startDate: '2024-01-01T00:00:00Z',
              endDate: '2024-01-31T23:59:59Z',
            },
          },
        };

        const result = await handler.execute(
          'get-by-date-range',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('GET_BY_DATE_RANGE_FAILED');
      });
    });
  });

  describe('Count Operations', () => {
    describe('count-by-scenario', () => {
      it('should count price data by scenario', async () => {
        mockRepository.countByScenario.mockResolvedValue(42);

        const payload: DashboardRequestPayload = {
          action: 'count-by-scenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'count-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.countByScenario).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect(
          (result.data as { scenario_id: string; count: number }).scenario_id,
        ).toBe('scenario-123');
        expect(
          (result.data as { scenario_id: string; count: number }).count,
        ).toBe(42);
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.countByScenario.mockResolvedValue(42);

        const payload: DashboardRequestPayload = {
          action: 'countbyscenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'countbyscenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when scenarioId is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'count-by-scenario',
          params: {},
        };

        const result = await handler.execute(
          'count-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_SCENARIO_ID');
      });

      it('should handle repository errors', async () => {
        mockRepository.countByScenario.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'count-by-scenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'count-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('COUNT_FAILED');
      });
    });

    describe('count-by-symbol', () => {
      it('should count price data by symbol', async () => {
        mockRepository.countBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'count-by-symbol',
          params: {
            filters: {
              symbol: 'T_BTC',
            },
          },
        };

        const result = await handler.execute(
          'count-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.countBySymbol).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
        expect((result.data as { symbol: string; count: number }).symbol).toBe(
          'T_BTC',
        );
        expect((result.data as { symbol: string; count: number }).count).toBe(
          100,
        );
      });

      it('should get symbol from params root', async () => {
        mockRepository.countBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'count-by-symbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'count-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.countBySymbol).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.countBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'countbysymbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'countbysymbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when symbol is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'count-by-symbol',
          params: {},
        };

        const result = await handler.execute(
          'count-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_SYMBOL');
      });

      it('should handle repository errors', async () => {
        mockRepository.countBySymbol.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'count-by-symbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'count-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('COUNT_FAILED');
      });
    });
  });

  describe('Bulk Delete Operations', () => {
    describe('delete-by-scenario', () => {
      it('should delete price data by scenario', async () => {
        mockRepository.deleteByScenario.mockResolvedValue(42);

        const payload: DashboardRequestPayload = {
          action: 'delete-by-scenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'delete-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.deleteByScenario).toHaveBeenCalledWith(
          'scenario-123',
        );
        const data = result.data as {
          deleted: boolean;
          scenario_id: string;
          deleted_count: number;
        };
        expect(data.deleted).toBe(true);
        expect(data.scenario_id).toBe('scenario-123');
        expect(data.deleted_count).toBe(42);
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.deleteByScenario.mockResolvedValue(42);

        const payload: DashboardRequestPayload = {
          action: 'deletebyscenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'deletebyscenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when scenarioId is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'delete-by-scenario',
          params: {},
        };

        const result = await handler.execute(
          'delete-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_SCENARIO_ID');
      });

      it('should handle repository errors', async () => {
        mockRepository.deleteByScenario.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'delete-by-scenario',
          params: {
            filters: {
              scenarioId: 'scenario-123',
            },
          },
        };

        const result = await handler.execute(
          'delete-by-scenario',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('DELETE_BY_SCENARIO_FAILED');
      });
    });

    describe('delete-by-symbol', () => {
      it('should delete price data by symbol', async () => {
        mockRepository.deleteBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'delete-by-symbol',
          params: {
            filters: {
              symbol: 'T_BTC',
            },
          },
        };

        const result = await handler.execute(
          'delete-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.deleteBySymbol).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
        const data = result.data as {
          deleted: boolean;
          symbol: string;
          deleted_count: number;
        };
        expect(data.deleted).toBe(true);
        expect(data.symbol).toBe('T_BTC');
        expect(data.deleted_count).toBe(100);
      });

      it('should get symbol from params root', async () => {
        mockRepository.deleteBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'delete-by-symbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'delete-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockRepository.deleteBySymbol).toHaveBeenCalledWith(
          'T_BTC',
          'test-org',
        );
      });

      it('should handle case insensitivity for action name', async () => {
        mockRepository.deleteBySymbol.mockResolvedValue(100);

        const payload: DashboardRequestPayload = {
          action: 'deletebysymbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'deletebysymbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
      });

      it('should return error when symbol is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'delete-by-symbol',
          params: {},
        };

        const result = await handler.execute(
          'delete-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_SYMBOL');
      });

      it('should handle repository errors', async () => {
        mockRepository.deleteBySymbol.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'delete-by-symbol',
          params: {
            symbol: 'T_BTC',
          },
        };

        const result = await handler.execute(
          'delete-by-symbol',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('DELETE_BY_SYMBOL_FAILED');
      });
    });
  });

  describe('Unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'unsupported',
        params: {},
      };

      const result = await handler.execute('unsupported', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
      expect(
        (result.error?.details?.supportedActions as string[]).length,
      ).toBeGreaterThan(0);
    });
  });
});
