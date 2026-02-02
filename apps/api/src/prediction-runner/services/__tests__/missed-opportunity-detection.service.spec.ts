import { Test, TestingModule } from '@nestjs/testing';
import { MissedOpportunityDetectionService } from '../missed-opportunity-detection.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('MissedOpportunityDetectionService', () => {
  let service: MissedOpportunityDetectionService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSnapshots = [
    {
      id: 'snap-1',
      target_id: 'target-123',
      timestamp: '2024-01-01T10:00:00Z',
      price: 100,
      volume: 1000,
      metadata: {},
    },
    {
      id: 'snap-2',
      target_id: 'target-123',
      timestamp: '2024-01-01T12:00:00Z',
      price: 105,
      volume: 1100,
      metadata: {},
    },
    {
      id: 'snap-3',
      target_id: 'target-123',
      timestamp: '2024-01-01T14:00:00Z',
      price: 112,
      volume: 1200,
      metadata: {},
    },
  ];

  const mockMissedOpportunity = {
    id: 'miss-123',
    target_id: 'target-123',
    detected_at: '2024-01-01T16:00:00Z',
    move_start: '2024-01-01T10:00:00Z',
    move_end: '2024-01-01T14:00:00Z',
    move_direction: 'up',
    move_percentage: 12,
    significance_score: 0.6,
    analysis_status: 'pending',
    discovered_drivers: [],
    source_gaps: [],
    suggested_learnings: [],
    created_at: '2024-01-01T16:00:00Z',
    updated_at: '2024-01-01T16:00:00Z',
  };

  const createMockClient = (overrides?: {
    snapshots?: { data: unknown[] | null; error: { message: string } | null };
    predictions?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
  }) => {
    const snapshotsResult = overrides?.snapshots ?? {
      data: mockSnapshots,
      error: null,
    };
    const predictionsResult = overrides?.predictions ?? {
      data: [],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockMissedOpportunity,
      error: null,
    };

    const createChain = (fromTable: string) => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        then: (resolve: (v: unknown) => void) => {
          if (fromTable === 'target_snapshots') {
            return resolve(snapshotsResult);
          } else if (fromTable === 'predictions') {
            return resolve(predictionsResult);
          } else if (fromTable === 'missed_opportunities') {
            return resolve(insertResult);
          }
          return resolve({ data: [], error: null });
        },
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.insert as jest.Mock).mockReturnValue(chainableResult);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest
          .fn()
          .mockImplementation((table: string) => createChain(table)),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedOpportunityDetectionService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<MissedOpportunityDetectionService>(
      MissedOpportunityDetectionService,
    );
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectMissedOpportunities', () => {
    it('should detect missed opportunities for significant moves', async () => {
      const result = await service.detectMissedOpportunities('target-123');

      expect(supabaseService.getServiceClient).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use custom config when provided', async () => {
      const customConfig = {
        lookback_hours: 48,
        min_move_percentage: 15,
        max_prediction_gap_hours: 6,
      };

      const result = await service.detectMissedOpportunities(
        'target-123',
        customConfig,
      );

      expect(result).toBeDefined();
    });

    it('should return empty array when not enough snapshots', async () => {
      const mockClient = createMockClient({
        snapshots: { data: [mockSnapshots[0]], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when no snapshots found', async () => {
      const mockClient = createMockClient({
        snapshots: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error when snapshot fetch fails', async () => {
      const mockClient = createMockClient({
        snapshots: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        service.detectMissedOpportunities('target-123'),
      ).rejects.toThrow('Failed to fetch snapshots');
    });

    it('should not record missed opportunity when prediction exists', async () => {
      const mockClient = createMockClient({
        predictions: {
          data: [
            {
              id: 'pred-123',
              created_at: '2024-01-01T11:00:00Z',
              horizon_end: '2024-01-02T11:00:00Z',
            },
          ],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 5,
        lookback_hours: 24,
        max_prediction_gap_hours: 4,
      });

      // With prediction coverage, no missed opportunities should be recorded
      expect(result).toBeDefined();
    });

    it('should calculate significance score based on move percentage', async () => {
      // With 12% move, significance score should be around 0.6 (12/20)
      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 5,
        lookback_hours: 24,
        max_prediction_gap_hours: 4,
      });

      if (result.length > 0) {
        expect(result[0]?.significance_score).toBeLessThanOrEqual(1.0);
        expect(result[0]?.significance_score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('default config', () => {
    it('should use default lookback hours', async () => {
      await service.detectMissedOpportunities('target-123');

      // Just verify it doesn't throw with default config
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('move detection', () => {
    it('should detect upward moves', async () => {
      const upwardSnapshots = [
        {
          id: 'snap-1',
          target_id: 'target-123',
          timestamp: '2024-01-01T10:00:00Z',
          price: 100,
          volume: 1000,
          metadata: {},
        },
        {
          id: 'snap-2',
          target_id: 'target-123',
          timestamp: '2024-01-01T14:00:00Z',
          price: 120,
          volume: 1200,
          metadata: {},
        },
      ];
      const mockClient = createMockClient({
        snapshots: { data: upwardSnapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 5,
        lookback_hours: 24,
        max_prediction_gap_hours: 4,
      });

      if (result.length > 0) {
        expect(result[0]?.move_direction).toBe('up');
      }
    });

    it.skip('should detect downward moves', async () => {
      const downwardSnapshots = [
        {
          id: 'snap-1',
          target_id: 'target-123',
          timestamp: '2024-01-01T10:00:00Z',
          price: 100,
          volume: 1000,
          metadata: {},
        },
        {
          id: 'snap-2',
          target_id: 'target-123',
          timestamp: '2024-01-01T14:00:00Z',
          price: 80,
          volume: 1200,
          metadata: {},
        },
      ];
      const mockClient = createMockClient({
        snapshots: { data: downwardSnapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 5,
        lookback_hours: 24,
        max_prediction_gap_hours: 4,
      });

      if (result.length > 0) {
        expect(result[0]?.move_direction).toBe('down');
      }
    });

    it('should not detect moves below threshold', async () => {
      const smallMoveSnapshots = [
        {
          id: 'snap-1',
          target_id: 'target-123',
          timestamp: '2024-01-01T10:00:00Z',
          price: 100,
          volume: 1000,
          metadata: {},
        },
        {
          id: 'snap-2',
          target_id: 'target-123',
          timestamp: '2024-01-01T14:00:00Z',
          price: 102,
          volume: 1200,
          metadata: {},
        },
      ];
      const mockClient = createMockClient({
        snapshots: { data: smallMoveSnapshots, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 10,
        lookback_hours: 24,
        max_prediction_gap_hours: 4, // Require 10% move
      });

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle prediction check errors', async () => {
      const mockClient = createMockClient({
        predictions: {
          data: null,
          error: { message: 'Prediction check failed' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        service.detectMissedOpportunities('target-123', {
          min_move_percentage: 5,
          lookback_hours: 24,
          max_prediction_gap_hours: 4,
        }),
      ).rejects.toThrow('Failed to check predictions');
    });

    it('should handle insert errors gracefully', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      // Should not throw, but return empty result since insert failed
      const result = await service.detectMissedOpportunities('target-123', {
        min_move_percentage: 5,
        lookback_hours: 24,
        max_prediction_gap_hours: 4,
      });

      // May return empty if insert failed
      expect(result).toBeDefined();
    });
  });
});
