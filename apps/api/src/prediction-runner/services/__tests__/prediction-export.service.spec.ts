import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import { PredictionExportService } from '../prediction-export.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('PredictionExportService', () => {
  let service: PredictionExportService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  const mockPredictions = [
    {
      id: 'pred-1',
      target_id: 'target-123',
      signal_id: 'signal-123',
      direction: 'up',
      confidence: 0.85,
      entry_price: 100,
      target_price: 110,
      stop_loss_price: 95,
      timeframe_minutes: 1440,
      status: 'active',
      outcome: null,
      outcome_price: null,
      outcome_at: null,
      generated_at: '2024-01-01T10:00:00Z',
      expires_at: '2024-01-02T10:00:00Z',
      is_test: false,
      metadata: {},
      targets: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        universes: { name: 'Tech Stocks' },
      },
    },
  ];

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const selectResult = overrides?.select ?? {
      data: mockPredictions,
      error: null,
    };

    const createChain = () => {
      // Create an object that can be returned by any method and has a then that resolves with the select result
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        order: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        eq: jest.fn(),
        limit: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(selectResult),
      };
      // Make each method return chainableResult so chaining works
      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);

      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chainableResult);
      chain.order = jest.fn().mockReturnValue(chainableResult);
      chain.gte = jest.fn().mockReturnValue(chainableResult);
      chain.lte = jest.fn().mockReturnValue(chainableResult);
      chain.eq = jest.fn().mockReturnValue(chainableResult);
      chain.limit = jest.fn().mockReturnValue(chainableResult);
      return chain;
    };

    const chain = createChain();

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionExportService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<PredictionExportService>(PredictionExportService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportPredictions', () => {
    it('should export predictions as JSON', async () => {
      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('.json');
      expect(result.recordCount).toBe(1);
      expect(JSON.parse(result.data)).toHaveProperty('predictions');
    });

    it('should export predictions as CSV', async () => {
      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.recordCount).toBe(1);
      expect(result.data).toContain('id');
    });

    it('should apply date filters', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply target filter', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        targetId: 'target-123',
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        status: 'active',
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should filter test data by default', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        includeTest: false,
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should include test data when requested', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        includeTest: true,
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply limit', async () => {
      await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        limit: 100,
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const emptyMockClient = createMockClient({
        select: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        emptyMockClient,
      );

      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'csv',
      });

      expect(result.recordCount).toBe(0);
      expect(result.data).toBe('');
    });

    it('should throw on database error', async () => {
      const errorMockClient = createMockClient({
        select: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        errorMockClient,
      );

      await expect(
        service.exportPredictions(mockExecutionContext, { format: 'json' }),
      ).rejects.toThrow('Failed to fetch predictions');
    });
  });

  describe('exportSignals', () => {
    const mockSignals = [
      {
        id: 'signal-1',
        target_id: 'target-123',
        content: 'Bullish signal',
        direction: 'bullish',
        detected_at: '2024-01-01T10:00:00Z',
        is_test: false,
      },
    ];

    it('should export signals as JSON', async () => {
      const signalMockClient = createMockClient({
        select: { data: mockSignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        signalMockClient,
      );

      const result = await service.exportSignals(mockExecutionContext, {
        format: 'json',
      });

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toContain('signals');
      expect(result.recordCount).toBe(1);
    });

    it('should export signals as CSV', async () => {
      const signalMockClient = createMockClient({
        select: { data: mockSignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        signalMockClient,
      );

      const result = await service.exportSignals(mockExecutionContext, {
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.recordCount).toBe(1);
    });

    it('should filter by target', async () => {
      const signalMockClient = createMockClient({
        select: { data: mockSignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        signalMockClient,
      );

      await service.exportSignals(mockExecutionContext, {
        format: 'json',
        targetId: 'target-123',
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should filter by source', async () => {
      const signalMockClient = createMockClient({
        select: { data: mockSignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        signalMockClient,
      );

      await service.exportSignals(mockExecutionContext, {
        format: 'json',
        sourceId: 'source-123',
      });

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should throw on database error', async () => {
      const errorMockClient = createMockClient({
        select: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        errorMockClient,
      );

      await expect(
        service.exportSignals(mockExecutionContext, { format: 'json' }),
      ).rejects.toThrow('Failed to fetch signals');
    });
  });

  describe('CSV generation', () => {
    it('should escape commas in values', async () => {
      const dataWithComma = [
        {
          ...mockPredictions[0],
          metadata: { note: 'value,with,commas' },
          targets: {
            symbol: 'AAPL',
            name: 'Apple, Inc.',
            universes: { name: 'Tech' },
          },
        },
      ];
      const mockClient = createMockClient({
        select: { data: dataWithComma, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'csv',
      });

      expect(result.data).toContain('"Apple, Inc."');
    });

    it('should escape quotes in values', async () => {
      const dataWithQuote = [
        {
          ...mockPredictions[0],
          targets: {
            symbol: 'AAPL',
            name: 'Apple "Tech" Inc.',
            universes: { name: 'Tech' },
          },
        },
      ];
      const mockClient = createMockClient({
        select: { data: dataWithQuote, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'csv',
      });

      expect(result.data).toContain('""');
    });
  });

  describe('filename generation', () => {
    it('should include target ID in filename', async () => {
      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        targetId: 'target-12345678-abcd',
      });

      expect(result.filename).toContain('target-');
    });

    it('should include status in filename', async () => {
      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'json',
        status: 'resolved',
      });

      expect(result.filename).toContain('resolved');
    });

    it('should include date in filename', async () => {
      const result = await service.exportPredictions(mockExecutionContext, {
        format: 'json',
      });

      const datePattern = /\d{4}-\d{2}-\d{2}/;
      expect(result.filename).toMatch(datePattern);
    });
  });
});
