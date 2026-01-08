/**
 * OutcomeEvaluationService Tests
 *
 * Tests for outcome evaluation functionality in the prediction learning loop.
 */

import { Logger } from '@nestjs/common';
import {
  OutcomeEvaluationService,
  OutcomeClassification,
} from '../outcome-evaluation.service';
import { SupabaseService } from '../../../../../../supabase/supabase.service';
import type { Recommendation } from '../../base-prediction.types';

// Mock Supabase client type
interface MockSupabaseClient {
  from: jest.Mock;
  insert: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  lt: jest.Mock;
  not: jest.Mock;
  single: jest.Mock;
}

describe('OutcomeEvaluationService', () => {
  let service: OutcomeEvaluationService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockClient: MockSupabaseClient;

  const mockRecommendation: Recommendation = {
    id: 'rec-123',
    instrument: 'AAPL',
    action: 'buy',
    confidence: 0.85,
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

  beforeEach(() => {
    // Mock Supabase client
    mockClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };

    // Mock Supabase service
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    // Create service instance
    service = new OutcomeEvaluationService(supabaseService);

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateOutcome', () => {
    it('should evaluate a correct buy recommendation', async () => {
      const entryPrice = { price: 180, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 185, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      expect(result.outcome).toBe('correct');
      expect(result.actualReturnPercent).toBeCloseTo(2.78, 1);
      expect(result.benchmarkReturnPercent).toBeCloseTo(2.78, 1);
      expect(result.entryPrice).toBe(180);
      expect(result.exitPrice).toBe(185);
    });

    it('should evaluate an incorrect buy recommendation', async () => {
      const entryPrice = { price: 180, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 175, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      expect(result.outcome).toBe('incorrect');
      expect(result.actualReturnPercent).toBeCloseTo(-2.78, 1);
    });

    it('should evaluate a sell recommendation correctly', async () => {
      const sellRec: Recommendation = {
        ...mockRecommendation,
        action: 'sell',
      };

      const entryPrice = { price: 180, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 175, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        sellRec,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      // For sell, we want price to go down - so negative price change is positive return
      expect(result.actualReturnPercent).toBeCloseTo(2.78, 1);
      expect(result.outcome).toBe('correct');
    });

    it('should classify partial outcome when return is near threshold', async () => {
      const entryPrice = { price: 180, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 180.5, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      expect(result.outcome).toBe('partial');
    });

    it('should generate evaluation notes', async () => {
      const entryPrice = { price: 180, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 185, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      expect(result.evaluationNotes).toContain('buy');
      expect(result.evaluationNotes).toContain('85%');
      expect(result.evaluationNotes).toContain('correct');
    });
  });

  describe('evaluatePredictionMarketOutcome', () => {
    it('should evaluate correct bet_yes prediction', async () => {
      const betYesRec: Recommendation = {
        ...mockRecommendation,
        action: 'bet_yes',
        confidence: 0.75,
      };

      const result = await service.evaluatePredictionMarketOutcome(
        betYesRec,
        'yes',
        '2026-01-08T12:00:00Z',
      );

      expect(result.outcome).toBe('correct');
      expect(result.actualReturnPercent).toBeGreaterThan(0);
      expect(result.resolutionValue).toBe('yes');
    });

    it('should evaluate incorrect bet_yes prediction', async () => {
      const betYesRec: Recommendation = {
        ...mockRecommendation,
        action: 'bet_yes',
        confidence: 0.75,
      };

      const result = await service.evaluatePredictionMarketOutcome(
        betYesRec,
        'no',
        '2026-01-08T12:00:00Z',
      );

      expect(result.outcome).toBe('incorrect');
      expect(result.actualReturnPercent).toBe(-100);
    });

    it('should evaluate correct bet_no prediction', async () => {
      const betNoRec: Recommendation = {
        ...mockRecommendation,
        action: 'bet_no',
        confidence: 0.65,
      };

      const result = await service.evaluatePredictionMarketOutcome(
        betNoRec,
        'no',
        '2026-01-08T12:00:00Z',
      );

      expect(result.outcome).toBe('correct');
      expect(result.actualReturnPercent).toBeGreaterThan(0);
    });

    it('should set evaluation method to market_close', async () => {
      const betYesRec: Recommendation = {
        ...mockRecommendation,
        action: 'bet_yes',
      };

      const result = await service.evaluatePredictionMarketOutcome(
        betYesRec,
        'yes',
        '2026-01-08T12:00:00Z',
      );

      expect(result.evaluationMethod).toBe('market_close');
    });
  });

  describe('calculateActualReturn', () => {
    it('should calculate positive return for buy action', () => {
      const result = service.calculateActualReturn('buy', 100, 110);
      expect(result).toBe(10);
    });

    it('should calculate negative return for buy action', () => {
      const result = service.calculateActualReturn('buy', 100, 95);
      expect(result).toBe(-5);
    });

    it('should calculate return for sell action (inverted)', () => {
      const result = service.calculateActualReturn('sell', 100, 95);
      expect(result).toBe(5); // Price went down, so sell made money
    });

    it('should return 0 for hold action', () => {
      const result = service.calculateActualReturn('hold', 100, 110);
      expect(result).toBe(0);
    });

    it('should return 0 for wait action', () => {
      const result = service.calculateActualReturn('wait', 100, 110);
      expect(result).toBe(0);
    });
  });

  describe('calculateBenchmarkReturn', () => {
    it('should calculate benchmark buy-and-hold return', () => {
      const result = service.calculateBenchmarkReturn(100, 110);
      expect(result).toBe(10);
    });

    it('should calculate negative benchmark return', () => {
      const result = service.calculateBenchmarkReturn(100, 90);
      expect(result).toBe(-10);
    });
  });

  describe('storeOutcome', () => {
    it('should insert outcome with correct data', async () => {
      mockClient.single.mockResolvedValueOnce({
        data: { id: 'outcome-123' },
        error: null,
      });

      const outcomeResult = {
        recommendationId: 'rec-123',
        instrument: 'AAPL',
        outcome: 'correct' as OutcomeClassification,
        actualReturnPercent: 2.78,
        benchmarkReturnPercent: 2.78,
        entryPrice: 180,
        exitPrice: 185,
        entryTimestamp: '2026-01-07T12:00:00Z',
        exitTimestamp: '2026-01-07T14:00:00Z',
        evaluationMethod: 'auto' as const,
        evaluationNotes: 'Test notes',
      };

      const id = await service.storeOutcome(outcomeResult);

      expect(id).toBe('outcome-123');
      expect(mockClient.from).toHaveBeenCalledWith('predictions.outcomes');
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          recommendation_id: 'rec-123',
          instrument: 'AAPL',
          outcome: 'correct',
          actual_return_percent: 2.78,
          benchmark_return_percent: 2.78,
          entry_price: 180,
          exit_price: 185,
          evaluation_method: 'auto',
        }),
      );
    });

    it('should throw error when insert fails', async () => {
      mockClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      const outcomeResult = {
        recommendationId: 'rec-123',
        instrument: 'AAPL',
        outcome: 'correct' as OutcomeClassification,
        actualReturnPercent: 2.78,
        benchmarkReturnPercent: 2.78,
        entryPrice: 180,
        exitPrice: 185,
        entryTimestamp: '2026-01-07T12:00:00Z',
        exitTimestamp: '2026-01-07T14:00:00Z',
        evaluationMethod: 'auto' as const,
        evaluationNotes: 'Test notes',
      };

      await expect(service.storeOutcome(outcomeResult)).rejects.toThrow(
        'Failed to store outcome: Insert failed',
      );
    });
  });

  describe('getPendingEvaluations', () => {
    it('should query for pending evaluations with correct filters', async () => {
      mockClient.not.mockResolvedValueOnce({
        data: [
          {
            id: 'rec-1',
            instrument: 'AAPL',
            action: 'buy',
            confidence: 0.8,
            sizing: {},
            rationale: 'Test',
            timing_window: {},
            entry_style: 'market',
            evidence: [],
          },
        ],
        error: null,
      });

      const _cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await service.getPendingEvaluations('agent-123', 24);

      expect(mockClient.from).toHaveBeenCalledWith(
        'predictions.recommendations',
      );
      expect(mockClient.eq).toHaveBeenCalledWith(
        'prediction_agent_id',
        'agent-123',
      );
      expect(mockClient.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockClient.lt).toHaveBeenCalledWith(
        'created_at',
        expect.any(String),
      );
    });

    it('should use custom lookback hours', async () => {
      mockClient.not.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getPendingEvaluations('agent-123', 48);

      const ltCall = mockClient.lt.mock.calls.find(
        (call) => call[0] === 'created_at',
      );
      expect(ltCall).toBeDefined();
    });

    it('should map database rows to Recommendation objects', async () => {
      mockClient.not.mockResolvedValueOnce({
        data: [
          {
            id: 'rec-1',
            instrument: 'AAPL',
            action: 'buy',
            confidence: 0.8,
            sizing: { size: 10 },
            rationale: 'Test rationale',
            timing_window: { validFrom: '2026-01-07T12:00:00Z' },
            entry_style: 'market',
            target_price: 185.0,
            evidence: [],
          },
        ],
        error: null,
      });

      const results = await service.getPendingEvaluations('agent-123');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'rec-1',
        instrument: 'AAPL',
        action: 'buy',
        confidence: 0.8,
        rationale: 'Test rationale',
      });
    });

    it('should throw error when query fails', async () => {
      mockClient.not.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      await expect(service.getPendingEvaluations('agent-123')).rejects.toThrow(
        'Failed to get pending evaluations: Query failed',
      );
    });

    it('should return empty array when no pending evaluations', async () => {
      mockClient.not.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const results = await service.getPendingEvaluations('agent-123');

      expect(results).toEqual([]);
    });
  });

  describe('domain-specific thresholds', () => {
    it('should use stricter thresholds for stock-predictor', async () => {
      const entryPrice = { price: 100, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 100.8, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      // 0.8% return is below 1% threshold for stocks
      expect(result.outcome).toBe('partial');
    });

    it('should use looser thresholds for crypto-predictor', async () => {
      const entryPrice = { price: 100, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 102, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        mockRecommendation,
        'crypto-predictor',
        entryPrice,
        exitPrice,
      );

      // 2% return is below 3% threshold for crypto
      expect(result.outcome).toBe('partial');
    });

    it('should evaluate hold correctly for stocks', async () => {
      const holdRec: Recommendation = {
        ...mockRecommendation,
        action: 'hold',
      };

      const entryPrice = { price: 100, timestamp: '2026-01-07T12:00:00Z' };
      const exitPrice = { price: 100.5, timestamp: '2026-01-07T14:00:00Z' };

      const result = await service.evaluateOutcome(
        holdRec,
        'stock-predictor',
        entryPrice,
        exitPrice,
      );

      // 0.5% is within 1.5% hold threshold
      expect(result.outcome).toBe('correct');
    });
  });
});
