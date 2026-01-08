/**
 * LearningContextBuilderService Tests
 *
 * Tests for learning context building functionality.
 */

import { Logger } from '@nestjs/common';
import {
  LearningContextBuilderService,
  LearningContext,
} from '../learning-context.service';
import { SupabaseService } from '../../../../../../supabase/supabase.service';

// Mock Supabase client
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  rpc: jest.Mock;
}

describe('LearningContextBuilderService', () => {
  let service: LearningContextBuilderService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    // Mock Supabase client
    mockClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    // Mock Supabase service
    supabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    } as unknown as jest.Mocked<SupabaseService>;

    service = new LearningContextBuilderService(supabaseService);

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildContext', () => {
    it('should build comprehensive learning context', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: {
          agentId: 'agent-123',
          instrument: null,
          lookbackDays: 30,
          generatedAt: '2026-01-07T12:00:00Z',
          postmortems: [
            {
              instrument: 'AAPL',
              action: 'buy',
              outcome: 'correct',
              returnPercent: 5.0,
              whatWorked: ['Technical analysis'],
              whatFailed: [],
              rootCause: null,
              keyLearnings: ['Momentum signals work'],
              missingContext: [],
              createdAt: '2026-01-06T12:00:00Z',
            },
          ],
          missedOpportunities: [
            {
              instrument: 'TSLA',
              type: 'price_move',
              description: '7% move missed',
              movePercent: 7.0,
              failureReason: 'below_threshold',
              whatWouldHaveHelped: ['Lower threshold'],
              suggestedThresholds: { minPriceChangePercent: 3.5 },
              createdAt: '2026-01-05T12:00:00Z',
            },
          ],
          userInsights: [],
          specialistStats: [
            {
              specialist: 'technical-analyst',
              instrument: null,
              accuracyPercent: 75.0,
              avgConfidence: 0.8,
              totalAnalyses: 100,
              confidenceWhenCorrect: 0.85,
              confidenceWhenIncorrect: 0.7,
            },
          ],
        },
        error: null,
      });

      const context = await service.buildContext('agent-123', null, {
        maxPostmortems: 5,
        maxMissed: 3,
        maxInsights: 5,
        lookbackDays: 30,
      });

      expect(context.agentId).toBe('agent-123');
      expect(context.postmortems).toHaveLength(1);
      expect(context.missedOpportunities).toHaveLength(1);
      expect(context.specialistStats).toHaveLength(1);
    });

    it('should call RPC with correct parameters', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: {
          agentId: 'agent-123',
          instrument: 'AAPL',
          lookbackDays: 30,
          generatedAt: '2026-01-07T12:00:00Z',
          postmortems: [],
          missedOpportunities: [],
          userInsights: [],
          specialistStats: [],
        },
        error: null,
      });

      await service.buildContext('agent-123', 'AAPL', {
        maxPostmortems: 10,
        maxMissed: 5,
        maxInsights: 8,
        lookbackDays: 60,
      });

      expect(mockClient.rpc).toHaveBeenCalledWith('build_learning_context', {
        p_prediction_agent_id: 'agent-123',
        p_instrument: 'AAPL',
        p_max_postmortems: 10,
        p_max_missed: 5,
        p_max_insights: 8,
        p_lookback_days: 60,
      });
    });

    it('should use default options when not provided', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: {
          agentId: 'agent-123',
          instrument: null,
          lookbackDays: 30,
          generatedAt: '2026-01-07T12:00:00Z',
          postmortems: [],
          missedOpportunities: [],
          userInsights: [],
          specialistStats: [],
        },
        error: null,
      });

      await service.buildContext('agent-123');

      expect(mockClient.rpc).toHaveBeenCalledWith('build_learning_context', {
        p_prediction_agent_id: 'agent-123',
        p_instrument: null,
        p_max_postmortems: 5,
        p_max_missed: 3,
        p_max_insights: 5,
        p_lookback_days: 30,
      });
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.buildContext('agent-123')).rejects.toThrow(
        'Failed to build learning context: RPC failed',
      );
    });
  });

  describe('getPostmortems', () => {
    it('should retrieve postmortems via RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [
          {
            instrument: 'AAPL',
            action: 'buy',
            outcome: 'correct',
            actual_return_percent: 5.0,
            what_worked: ['Good analysis'],
            what_failed: [],
            root_cause: 'Market momentum',
            key_learnings: ['Learning 1'],
            missing_context: [],
            created_at: '2026-01-06T12:00:00Z',
          },
        ],
        error: null,
      });

      const results = await service.getPostmortems('agent-123', 'AAPL', 10);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_postmortems_with_instrument',
        {
          p_prediction_agent_id: 'agent-123',
          p_instrument: 'AAPL',
          p_outcome: null,
          p_limit: 10,
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.instrument).toBe('AAPL');
      expect(results[0]?.returnPercent).toBe(5.0);
    });

    it('should handle null instrument', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getPostmortems('agent-123', null, 10);

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_postmortems_with_instrument',
        {
          p_prediction_agent_id: 'agent-123',
          p_instrument: '',
          p_outcome: null,
          p_limit: 10,
        },
      );
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.getPostmortems('agent-123')).rejects.toThrow(
        'Failed to get postmortems: RPC failed',
      );
    });
  });

  describe('getMissedOpportunities', () => {
    it('should retrieve missed opportunities via RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [
          {
            instrument: 'TSLA',
            missed_type: 'price_move',
            description: 'Missed 7% move',
            move_percent: 7.0,
            detection_failure_reason: 'below_threshold',
            what_would_have_helped: ['Lower threshold'],
            suggested_threshold_changes: { minPriceChangePercent: 3.5 },
            created_at: '2026-01-05T12:00:00Z',
          },
        ],
        error: null,
      });

      const results = await service.getMissedOpportunities(
        'agent-123',
        'TSLA',
        5.0,
        10,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('get_missed_opportunities', {
        p_prediction_agent_id: 'agent-123',
        p_instrument: 'TSLA',
        p_min_move_percent: 5.0,
        p_limit: 10,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.movePercent).toBe(7.0);
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.getMissedOpportunities('agent-123')).rejects.toThrow(
        'Failed to get missed opportunities: RPC failed',
      );
    });
  });

  describe('getSpecialistStats', () => {
    it('should retrieve specialist stats via RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [
          {
            specialist: 'technical-analyst',
            instrument: null,
            accuracy_percent: 75.0,
            avg_confidence: 0.8,
            total_analyses: 100,
            confidence_when_correct: 0.85,
            confidence_when_incorrect: 0.7,
          },
        ],
        error: null,
      });

      const results = await service.getSpecialistStats(
        'agent-123',
        null,
        null,
        30,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('get_specialist_accuracy', {
        p_prediction_agent_id: 'agent-123',
        p_specialist: '',
        p_instrument: null,
        p_lookback_days: 30,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.specialist).toBe('technical-analyst');
      expect(results[0]?.accuracyPercent).toBe(75.0);
    });

    it('should filter by specialist when provided', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getSpecialistStats(
        'agent-123',
        'technical-analyst',
        null,
        30,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('get_specialist_accuracy', {
        p_prediction_agent_id: 'agent-123',
        p_specialist: 'technical-analyst',
        p_instrument: null,
        p_lookback_days: 30,
      });
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.getSpecialistStats('agent-123')).rejects.toThrow(
        'Failed to get specialist stats: RPC failed',
      );
    });
  });

  describe('getUserInsights', () => {
    it('should retrieve user insights via RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [
          {
            insight_type: 'domain_knowledge',
            instrument: 'AAPL',
            insight_text: 'Apple tends to rally in January',
            structured_insight: null,
            effectiveness_score: 0.8,
            created_at: '2026-01-05T12:00:00Z',
          },
        ],
        error: null,
      });

      const results = await service.getUserInsights(
        'agent-123',
        'AAPL',
        true,
        20,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith('get_user_insights', {
        p_prediction_agent_id: 'agent-123',
        p_instrument: 'AAPL',
        p_validated_only: true,
        p_limit: 20,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.type).toBe('domain_knowledge');
      expect(results[0]?.insight).toBe('Apple tends to rally in January');
    });

    it('should include unvalidated insights when requested', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await service.getUserInsights('agent-123', null, false, 20);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_user_insights', {
        p_prediction_agent_id: 'agent-123',
        p_instrument: null,
        p_validated_only: false,
        p_limit: 20,
      });
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(service.getUserInsights('agent-123')).rejects.toThrow(
        'Failed to get user insights: RPC failed',
      );
    });
  });

  describe('getAgentLearningSummary', () => {
    it('should retrieve agent learning summary', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [
          {
            total_recommendations: 100,
            total_outcomes: 80,
            overall_accuracy_percent: 70.0,
            total_postmortems: 50,
            unapplied_postmortems: 5,
            total_missed_opportunities: 10,
            unapplied_missed_opportunities: 3,
            total_user_insights: 20,
            validated_insights: 15,
            unapplied_insights: 8,
            active_conversations: 2,
            last_learning_update: '2026-01-07T10:00:00Z',
          },
        ],
        error: null,
      });

      const summary = await service.getAgentLearningSummary('agent-123');

      expect(mockClient.rpc).toHaveBeenCalledWith(
        'get_agent_learning_summary',
        {
          p_prediction_agent_id: 'agent-123',
        },
      );

      expect(summary.totalRecommendations).toBe(100);
      expect(summary.totalOutcomes).toBe(80);
      expect(summary.overallAccuracyPercent).toBe(70.0);
      expect(summary.unappliedPostmortems).toBe(5);
    });

    it('should handle empty result with defaults', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const summary = await service.getAgentLearningSummary('agent-123');

      expect(summary.totalRecommendations).toBe(0);
      expect(summary.totalOutcomes).toBe(0);
      expect(summary.overallAccuracyPercent).toBeUndefined();
    });

    it('should throw error when RPC fails', async () => {
      mockClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(
        service.getAgentLearningSummary('agent-123'),
      ).rejects.toThrow('Failed to get learning summary: RPC failed');
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format comprehensive context as prompt', () => {
      const context: LearningContext = {
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [
          {
            instrument: 'AAPL',
            action: 'buy',
            outcome: 'correct',
            returnPercent: 5.0,
            whatWorked: ['Technical analysis'],
            whatFailed: [],
            rootCause: 'Market momentum',
            keyLearnings: ['Momentum signals work well'],
            missingContext: [],
            createdAt: '2026-01-06T12:00:00Z',
          },
        ],
        missedOpportunities: [
          {
            instrument: 'TSLA',
            type: 'price_move',
            description: 'Missed 7% move',
            movePercent: 7.0,
            failureReason: 'below_threshold',
            whatWouldHaveHelped: ['Lower threshold to 3.5%'],
            suggestedThresholds: { minPriceChangePercent: 3.5 },
            createdAt: '2026-01-05T12:00:00Z',
          },
        ],
        userInsights: [
          {
            type: 'domain_knowledge',
            instrument: 'AAPL',
            insight: 'Apple rallies in January',
            structured: null,
            effectivenessScore: 0.8,
            createdAt: '2026-01-04T12:00:00Z',
          },
        ],
        specialistStats: [
          {
            specialist: 'technical-analyst',
            instrument: null,
            accuracyPercent: 75.0,
            avgConfidence: 0.8,
            totalAnalyses: 100,
            confidenceWhenCorrect: 0.85,
            confidenceWhenIncorrect: 0.7,
          },
        ],
      };

      const formatted = service.formatContextForPrompt(context);

      expect(formatted).toContain('Recent Learnings');
      expect(formatted).toContain('AAPL');
      expect(formatted).toContain('5.00%');
      expect(formatted).toContain('Momentum signals work well');
      expect(formatted).toContain('Missed Opportunities');
      expect(formatted).toContain('TSLA');
      expect(formatted).toContain('User Insights');
      expect(formatted).toContain('Specialist Performance');
      expect(formatted).toContain('technical-analyst');
      expect(formatted).toContain('75.0%');
    });

    it('should handle empty context gracefully', () => {
      const context: LearningContext = {
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [],
        missedOpportunities: [],
        userInsights: [],
        specialistStats: [],
      };

      const formatted = service.formatContextForPrompt(context);

      expect(formatted).toBe('');
    });

    it('should include root cause when available', () => {
      const context: LearningContext = {
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [
          {
            instrument: 'AAPL',
            action: 'buy',
            outcome: 'incorrect',
            returnPercent: -3.0,
            whatWorked: [],
            whatFailed: ['Ignored earnings warning'],
            rootCause: 'Earnings miss',
            keyLearnings: [],
            missingContext: [],
            createdAt: '2026-01-06T12:00:00Z',
          },
        ],
        missedOpportunities: [],
        userInsights: [],
        specialistStats: [],
      };

      const formatted = service.formatContextForPrompt(context);

      expect(formatted).toContain('Root cause: Earnings miss');
    });

    it('should show effectiveness scores for insights', () => {
      const context: LearningContext = {
        agentId: 'agent-123',
        instrument: null,
        lookbackDays: 30,
        generatedAt: '2026-01-07T12:00:00Z',
        postmortems: [],
        missedOpportunities: [],
        userInsights: [
          {
            type: 'domain_knowledge',
            instrument: null,
            insight: 'Test insight',
            structured: null,
            effectivenessScore: 0.95,
            createdAt: '2026-01-04T12:00:00Z',
          },
        ],
        specialistStats: [],
      };

      const formatted = service.formatContextForPrompt(context);

      expect(formatted).toContain('95%');
    });
  });
});
