/**
 * PredictionDbService Tests
 *
 * Tests for database operations for the prediction runner system.
 */

import { Logger } from '@nestjs/common';
import { PredictionDbService } from '../prediction-db.service';
import { SupabaseService } from '../../../../../../supabase/supabase.service';
import {
  Datapoint,
  Claim,
  TriageResult,
  SpecialistAnalysis,
  Recommendation,
} from '../../base-prediction.types';

// Mock Supabase client type for testing
interface MockSupabaseClient {
  from: jest.Mock;
  insert: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  contains: jest.Mock;
  gte: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
}

describe('PredictionDbService', () => {
  let service: PredictionDbService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    // Mock Supabase client
    mockClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    // Mock Supabase service
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    // Create service instance
    service = new PredictionDbService(supabaseService);

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeDatapoint', () => {
    const mockDatapoint: Datapoint = {
      id: 'test-datapoint-id',
      agentId: 'test-agent-id',
      timestamp: '2026-01-07T12:00:00Z',
      sources: [
        {
          tool: 'test-tool',
          fetchedAt: '2026-01-07T12:00:00Z',
          claims: [
            {
              type: 'price',
              instrument: 'AAPL',
              value: 178.5,
              confidence: 1.0,
              timestamp: '2026-01-07T12:00:00Z',
            },
          ],
        },
      ],
      allClaims: [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 178.5,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ],
      instruments: ['AAPL'],
      metadata: {
        durationMs: 100,
        toolsSucceeded: 1,
        toolsFailed: 0,
        toolStatus: { 'test-tool': 'success' },
      },
    };

    it('should insert data into correct table', async () => {
      mockClient.insert.mockResolvedValueOnce({ error: null });

      await service.storeDatapoint(mockDatapoint);

      expect(mockClient.from).toHaveBeenCalledWith('prediction_datapoints');
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-datapoint-id',
          agent_id: 'test-agent-id',
          timestamp: '2026-01-07T12:00:00Z',
          sources: mockDatapoint.sources,
          all_claims: mockDatapoint.allClaims,
          instruments: ['AAPL'],
          metadata: mockDatapoint.metadata,
        }),
      );
    });

    it('should include created_at timestamp', async () => {
      mockClient.insert.mockResolvedValueOnce({ error: null });

      await service.storeDatapoint(mockDatapoint);

      const insertCall = mockClient.insert.mock.calls[0][0];
      expect(insertCall.created_at).toBeDefined();
      expect(typeof insertCall.created_at).toBe('string');
    });

    it('should throw error when insert fails', async () => {
      mockClient.insert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await expect(service.storeDatapoint(mockDatapoint)).rejects.toThrow(
        'Failed to store datapoint: Insert failed',
      );
    });

    it('should log error on failure', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      mockClient.insert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await expect(service.storeDatapoint(mockDatapoint)).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to store datapoint'),
      );
    });
  });

  describe('getClaimsForInstrument', () => {
    const mockClaims: Claim[] = [
      {
        type: 'price',
        instrument: 'AAPL',
        value: 178.5,
        confidence: 1.0,
        timestamp: '2026-01-07T12:00:00Z',
      },
      {
        type: 'volume',
        instrument: 'AAPL',
        value: 1000000,
        confidence: 1.0,
        timestamp: '2026-01-07T12:00:00Z',
      },
    ];

    it('should query with correct parameters', async () => {
      mockClient.order.mockResolvedValueOnce({
        data: [{ all_claims: mockClaims }],
        error: null,
      });

      await service.getClaimsForInstrument('test-agent-id', 'AAPL', 24);

      expect(mockClient.from).toHaveBeenCalledWith('prediction_datapoints');
      expect(mockClient.select).toHaveBeenCalledWith('all_claims');
      expect(mockClient.eq).toHaveBeenCalledWith('agent_id', 'test-agent-id');
      expect(mockClient.contains).toHaveBeenCalledWith('instruments', ['AAPL']);
      expect(mockClient.gte).toHaveBeenCalledWith(
        'timestamp',
        expect.any(String),
      );
      expect(mockClient.order).toHaveBeenCalledWith('timestamp', {
        ascending: false,
      });
    });

    it('should calculate correct cutoff time', async () => {
      const lookbackHours = 48;
      const expectedCutoff = new Date(
        Date.now() - lookbackHours * 60 * 60 * 1000,
      ).toISOString();

      mockClient.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getClaimsForInstrument(
        'test-agent-id',
        'AAPL',
        lookbackHours,
      );

      const gteCall = mockClient.gte.mock.calls[0];
      const actualCutoff = gteCall[1];

      // Allow 1 second tolerance
      expect(new Date(actualCutoff).getTime()).toBeGreaterThanOrEqual(
        new Date(expectedCutoff).getTime() - 1000,
      );
      expect(new Date(actualCutoff).getTime()).toBeLessThanOrEqual(
        new Date(expectedCutoff).getTime() + 1000,
      );
    });

    it('should return empty array when no results', async () => {
      mockClient.order.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.getClaimsForInstrument(
        'test-agent-id',
        'AAPL',
        24,
      );

      expect(result).toEqual([]);
    });

    it('should filter claims to only matching instrument', async () => {
      const mixedClaims = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 178.5,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
        {
          type: 'price',
          instrument: 'MSFT',
          value: 420.0,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      mockClient.order.mockResolvedValueOnce({
        data: [{ all_claims: mixedClaims }],
        error: null,
      });

      const result = await service.getClaimsForInstrument(
        'test-agent-id',
        'AAPL',
        24,
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.instrument).toBe('AAPL');
    });

    it('should flatten claims from multiple datapoints', async () => {
      mockClient.order.mockResolvedValueOnce({
        data: [
          {
            all_claims: [
              {
                type: 'price',
                instrument: 'AAPL',
                value: 178.5,
                confidence: 1.0,
                timestamp: '2026-01-07T12:00:00Z',
              },
            ],
          },
          {
            all_claims: [
              {
                type: 'volume',
                instrument: 'AAPL',
                value: 1000000,
                confidence: 1.0,
                timestamp: '2026-01-07T11:00:00Z',
              },
            ],
          },
        ],
        error: null,
      });

      const result = await service.getClaimsForInstrument(
        'test-agent-id',
        'AAPL',
        24,
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.type).toBe('price');
      expect(result[1]?.type).toBe('volume');
    });

    it('should throw error when query fails', async () => {
      mockClient.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(
        service.getClaimsForInstrument('test-agent-id', 'AAPL', 24),
      ).rejects.toThrow('Failed to fetch claims: Query failed');
    });
  });

  describe('getClaimsDiff', () => {
    it('should correctly identify new claims', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 180,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
        {
          type: 'volume',
          instrument: 'AAPL',
          value: 1000000,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 178.5,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.newClaims).toHaveLength(1);
      expect(diff.newClaims[0]?.type).toBe('volume');
    });

    it('should correctly identify changed claims', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 180,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 178.5,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.changedClaims).toHaveLength(1);
      expect(diff.changedClaims[0]?.claim.value).toBe(180);
      expect(diff.changedClaims[0]?.previousValue).toBe(178.5);
    });

    it('should calculate change percentage for numeric values', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 180,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 100,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.changedClaims[0]?.changePercent).toBeCloseTo(80, 5);
    });

    it('should not calculate change percentage for non-numeric values', () => {
      const current: Claim[] = [
        {
          type: 'sentiment',
          instrument: 'AAPL',
          value: 'bullish',
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'sentiment',
          instrument: 'AAPL',
          value: 'bearish',
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.changedClaims[0]?.changePercent).toBeUndefined();
    });

    it('should correctly identify removed claims', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 180,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 178.5,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
        {
          type: 'volume',
          instrument: 'AAPL',
          value: 1000000,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.removedClaims).toHaveLength(1);
      expect(diff.removedClaims[0]?.type).toBe('volume');
    });

    it('should calculate significance score correctly', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 200,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
        {
          type: 'sentiment',
          instrument: 'AAPL',
          value: 'bullish',
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 100,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z',
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      // New claim (sentiment): 0.1
      // Changed claim (price 100% change): 0.1 (capped)
      // Total: ~0.2
      expect(diff.significanceScore).toBeGreaterThan(0);
      expect(diff.significanceScore).toBeLessThanOrEqual(1.0);
    });

    it('should cap significance score at 1.0', () => {
      // Create many new claims to potentially exceed 1.0
      const current: Claim[] = Array.from({ length: 20 }, (_, i) => ({
        type: 'custom' as const,
        instrument: 'AAPL',
        value: `claim-${i}`,
        confidence: 1.0,
        timestamp: '2026-01-07T12:00:00Z',
      }));

      const historical: Claim[] = [];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.significanceScore).toBeLessThanOrEqual(1.0);
    });

    it('should use most recent historical claim when duplicates exist', () => {
      const current: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 180,
          confidence: 1.0,
          timestamp: '2026-01-07T12:00:00Z',
        },
      ];

      const historical: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 170,
          confidence: 1.0,
          timestamp: '2026-01-07T10:00:00Z',
        },
        {
          type: 'price',
          instrument: 'AAPL',
          value: 175,
          confidence: 1.0,
          timestamp: '2026-01-07T11:00:00Z', // Most recent
        },
      ];

      const diff = service.getClaimsDiff(current, historical);

      expect(diff.changedClaims[0]?.previousValue).toBe(175);
    });
  });

  describe('storeTriageResult', () => {
    const mockTriageResult: TriageResult = {
      instrument: 'AAPL',
      proceed: true,
      urgency: 'high',
      specialistTeams: ['technical-analyst', 'fundamental-analyst'],
      rationale: 'Significant price movement detected',
      votes: [],
    };

    it('should insert with correct data', async () => {
      mockClient.insert.mockResolvedValueOnce({ error: null });

      await service.storeTriageResult(mockTriageResult, 'test-datapoint-id');

      expect(mockClient.from).toHaveBeenCalledWith('prediction_triage');
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          datapoint_id: 'test-datapoint-id',
          instrument: 'AAPL',
          proceed: true,
          urgency: 'high',
          specialist_teams: ['technical-analyst', 'fundamental-analyst'],
          rationale: 'Significant price movement detected',
          votes: [],
        }),
      );
    });

    it('should throw error when insert fails', async () => {
      mockClient.insert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await expect(
        service.storeTriageResult(mockTriageResult, 'test-datapoint-id'),
      ).rejects.toThrow('Failed to store triage result: Insert failed');
    });
  });

  describe('storeSpecialistAnalysis', () => {
    const mockAnalysis: SpecialistAnalysis = {
      specialist: 'technical-analyst',
      instrument: 'AAPL',
      conclusion: 'bullish',
      confidence: 0.85,
      analysis: 'Strong upward momentum',
      keyClaims: [],
      suggestedAction: 'buy',
      riskFactors: ['Market volatility'],
    };

    it('should insert with correct data', async () => {
      mockClient.insert.mockResolvedValueOnce({ error: null });

      await service.storeSpecialistAnalysis(mockAnalysis, 'test-datapoint-id');

      expect(mockClient.from).toHaveBeenCalledWith('prediction_specialists');
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          datapoint_id: 'test-datapoint-id',
          specialist: 'technical-analyst',
          instrument: 'AAPL',
          conclusion: 'bullish',
          confidence: 0.85,
          analysis: 'Strong upward momentum',
          key_claims: [],
          suggested_action: 'buy',
          risk_factors: ['Market volatility'],
        }),
      );
    });

    it('should throw error when insert fails', async () => {
      mockClient.insert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await expect(
        service.storeSpecialistAnalysis(mockAnalysis, 'test-datapoint-id'),
      ).rejects.toThrow('Failed to store specialist analysis: Insert failed');
    });
  });

  describe('storeRecommendation', () => {
    const mockRecommendation: Recommendation = {
      id: 'test-recommendation-id',
      instrument: 'AAPL',
      action: 'buy',
      confidence: 0.8,
      sizing: {
        size: 10,
        unit: 'percent',
        riskAdjustedSize: 8,
      },
      rationale: 'Strong technical and fundamental signals',
      timingWindow: {
        validFrom: '2026-01-07T12:00:00Z',
        validUntil: '2026-01-08T12:00:00Z',
      },
      entryStyle: 'limit',
      targetPrice: 185.0,
      evidence: [],
    };

    it('should insert with correct data', async () => {
      mockClient.insert.mockResolvedValueOnce({ error: null });

      await service.storeRecommendation(mockRecommendation, 'test-agent-id');

      expect(mockClient.from).toHaveBeenCalledWith(
        'prediction_recommendations',
      );
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-recommendation-id',
          agent_id: 'test-agent-id',
          instrument: 'AAPL',
          action: 'buy',
          confidence: 0.8,
          sizing: mockRecommendation.sizing,
          rationale: 'Strong technical and fundamental signals',
          timing_window: mockRecommendation.timingWindow,
          entry_style: 'limit',
          target_price: 185.0,
          evidence: [],
        }),
      );
    });

    it('should throw error when insert fails', async () => {
      mockClient.insert.mockResolvedValueOnce({
        error: { message: 'Insert failed' },
      });

      await expect(
        service.storeRecommendation(mockRecommendation, 'test-agent-id'),
      ).rejects.toThrow('Failed to store recommendation: Insert failed');
    });
  });
});
