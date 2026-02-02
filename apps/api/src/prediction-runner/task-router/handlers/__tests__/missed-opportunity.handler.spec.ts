/**
 * Missed Opportunity Handler Tests
 *
 * Tests for the missed opportunity dashboard handler, including:
 * - Legacy detect action (deprecated)
 * - Analyze action for deep analysis
 * - Identify action for baseline-based miss identification
 * - Investigate action for hierarchical investigation
 */

import { Test } from '@nestjs/testing';
import { MissedOpportunityHandler } from '../missed-opportunity.handler';
import { MissedOpportunityDetectionService } from '../../../services/missed-opportunity-detection.service';
import { MissedOpportunityAnalysisService } from '../../../services/missed-opportunity-analysis.service';
import { MissInvestigationService } from '../../../services/miss-investigation.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type {
  MissedOpportunity,
  MissAnalysisResult,
} from '../../../interfaces/missed-opportunity.interface';
import type {
  MissInvestigation,
  PredictionWithChain,
} from '../../../interfaces/miss-investigation.interface';

describe('MissedOpportunityHandler', () => {
  let handler: MissedOpportunityHandler;
  let detectionService: jest.Mocked<MissedOpportunityDetectionService>;
  let analysisService: jest.Mocked<MissedOpportunityAnalysisService>;
  let missInvestigationService: jest.Mocked<MissInvestigationService>;

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

  const mockMissedOpportunity: MissedOpportunity = {
    id: 'miss-1',
    target_id: 'target-1',
    detected_at: '2024-01-02T00:00:00Z',
    move_start: '2024-01-01T10:00:00Z',
    move_end: '2024-01-01T16:00:00Z',
    move_direction: 'up',
    move_percentage: 10,
    significance_score: 0.85,
    analysis_status: 'pending',
    discovered_drivers: [],
    source_gaps: [],
    suggested_learnings: [],
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  const mockPrediction: PredictionWithChain = {
    id: 'pred-1',
    target_id: 'target-1',
    task_id: null,
    direction: 'flat',
    confidence: 0.6,
    magnitude: 'medium',
    reasoning: 'Technical indicators suggest sideways movement',
    timeframe_hours: 24,
    predicted_at: '2024-01-01T09:00:00Z',
    expires_at: '2024-01-02T09:00:00Z',
    entry_price: 185.50,
    target_price: 186.00,
    stop_loss: 184.00,
    analyst_ensemble: { 'technical-tina': 0.5, 'sentiment-sam': 0.5 },
    llm_ensemble: { claude: 0.6, gpt: 0.4 },
    status: 'resolved',
    outcome_value: 8.5,
    outcome_captured_at: '2024-01-02T09:00:00Z',
    resolution_notes: 'Price moved up significantly',
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-02T09:00:00Z',
    target: {
      id: 'target-1',
      symbol: 'AAPL',
      name: 'Apple Inc',
      target_type: 'stock',
    },
  };

  const mockMissIdentification = {
    prediction: mockPrediction,
    missType: 'direction_wrong' as const,
    actualDirection: 'up' as const,
    actualMagnitude: 8.5,
  };

  const mockInvestigation: MissInvestigation = {
    id: 'investigation-1',
    prediction: mockPrediction,
    missType: 'direction_wrong',
    predicted: {
      direction: 'flat',
      magnitude: 'medium',
      confidence: 0.6,
    },
    actual: {
      direction: 'up',
      magnitude: 8.5,
    },
    investigationLevel: 'predictor',
    unusedPredictors: [],
    misreadSignals: [],
    investigatedAt: '2024-01-02T10:00:00Z',
  };

  const mockAnalysis: MissAnalysisResult = {
    missedOpportunityId: 'miss-1',
    discoveredDrivers: ['Strong earnings report'],
    signalsWeHad: ['signal-1'],
    signalGaps: ['momentum_indicator'],
    sourceGaps: ['earnings_transcript'],
    suggestedLearnings: [
      {
        type: 'prompt_adjustment',
        content: 'Adjust momentum threshold',
        scope: 'runner',
      },
    ],
    toolSuggestions: [
      {
        tool_type: 'momentum_scanner',
        description: 'Add real-time momentum scanner',
        rationale: 'Would have detected the breakout',
      },
    ],
  };

  beforeEach(async () => {
    const mockDetectionService = {
      detectMissedOpportunities: jest.fn(),
    };

    const mockAnalysisService = {
      analyzeMissedOpportunity: jest.fn(),
    };

    const mockMissInvestigationService = {
      identifyMisses: jest.fn(),
      investigateMissById: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MissedOpportunityHandler,
        {
          provide: MissedOpportunityDetectionService,
          useValue: mockDetectionService,
        },
        {
          provide: MissedOpportunityAnalysisService,
          useValue: mockAnalysisService,
        },
        {
          provide: MissInvestigationService,
          useValue: mockMissInvestigationService,
        },
      ],
    }).compile();

    handler = moduleRef.get<MissedOpportunityHandler>(MissedOpportunityHandler);
    detectionService = moduleRef.get(MissedOpportunityDetectionService);
    analysisService = moduleRef.get(MissedOpportunityAnalysisService);
    missInvestigationService = moduleRef.get(MissInvestigationService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('detect');
      expect(actions).toContain('analyze');
      expect(actions).toContain('investigate');
      expect(actions).toContain('identify');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'invalid',
        params: {},
      };
      const result = await handler.execute('invalid', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('execute - detect/list action', () => {
    it('should return error if targetId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: {},
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_TARGET_ID');
    });

    it('should return error if targetId is missing from filters', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: {} },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_TARGET_ID');
    });

    it('should detect missed opportunities successfully with targetId in params', async () => {
      detectionService.detectMissedOpportunities.mockResolvedValue([
        mockMissedOpportunity,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      expect(detectionService.detectMissedOpportunities).toHaveBeenCalledWith(
        'target-1',
        undefined,
      );
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(1);
      expect(data[0]?.target_id).toBe('target-1');
    });

    it('should detect missed opportunities with targetId in filters', async () => {
      detectionService.detectMissedOpportunities.mockResolvedValue([
        mockMissedOpportunity,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { filters: { targetId: 'target-1' } },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      expect(detectionService.detectMissedOpportunities).toHaveBeenCalledWith(
        'target-1',
        undefined,
      );
    });

    it('should filter by status', async () => {
      const opportunities: MissedOpportunity[] = [
        { ...mockMissedOpportunity, analysis_status: 'pending' },
        { ...mockMissedOpportunity, id: 'miss-2', analysis_status: 'completed' },
      ];
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: {
          targetId: 'target-1',
          filters: { status: 'pending' },
        },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(1);
      expect(data[0]?.analysis_status).toBe('pending');
    });

    it('should filter by fromDate', async () => {
      const opportunities: MissedOpportunity[] = [
        { ...mockMissedOpportunity, move_start: '2024-01-15T10:00:00Z' },
        {
          ...mockMissedOpportunity,
          id: 'miss-2',
          move_start: '2024-01-01T10:00:00Z',
        },
      ];
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: {
          targetId: 'target-1',
          filters: { fromDate: '2024-01-10' },
        },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(1);
      expect(data[0]?.move_start).toBe('2024-01-15T10:00:00Z');
    });

    it('should filter by toDate', async () => {
      const opportunities: MissedOpportunity[] = [
        { ...mockMissedOpportunity, move_start: '2024-01-05T10:00:00Z' },
        {
          ...mockMissedOpportunity,
          id: 'miss-2',
          move_start: '2024-01-15T10:00:00Z',
        },
      ];
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: {
          targetId: 'target-1',
          filters: { toDate: '2024-01-10' },
        },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(1);
      expect(data[0]?.move_start).toBe('2024-01-05T10:00:00Z');
    });

    it('should filter by minMovePercent', async () => {
      const opportunities: MissedOpportunity[] = [
        { ...mockMissedOpportunity, move_percentage: 15 },
        { ...mockMissedOpportunity, id: 'miss-2', move_percentage: 5 },
      ];
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: {
          targetId: 'target-1',
          filters: { minMovePercent: 10 },
        },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(1);
      expect(data[0]?.move_percentage).toBe(15);
    });

    it('should sort by significance score descending', async () => {
      const opportunities: MissedOpportunity[] = [
        { ...mockMissedOpportunity, significance_score: 0.5 },
        { ...mockMissedOpportunity, id: 'miss-2', significance_score: 0.9 },
        { ...mockMissedOpportunity, id: 'miss-3', significance_score: 0.7 },
      ];
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data[0]?.significance_score).toBe(0.9);
      expect(data[1]?.significance_score).toBe(0.7);
      expect(data[2]?.significance_score).toBe(0.5);
    });

    it('should paginate results', async () => {
      const opportunities: MissedOpportunity[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockMissedOpportunity,
          id: `miss-${i}`,
          significance_score: 0.9 - i * 0.01,
        }));
      detectionService.detectMissedOpportunities.mockResolvedValue(
        opportunities,
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1', page: 2, pageSize: 10 },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as MissedOpportunity[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should pass detection config to service', async () => {
      detectionService.detectMissedOpportunities.mockResolvedValue([]);

      const detectionConfig = {
        minMovePercent: 5,
        lookbackDays: 7,
      };
      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1', detectionConfig },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(true);
      expect(detectionService.detectMissedOpportunities).toHaveBeenCalledWith(
        'target-1',
        detectionConfig,
      );
    });

    it('should handle detect service error', async () => {
      detectionService.detectMissedOpportunities.mockRejectedValue(
        new Error('Detection failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DETECT_FAILED');
      expect(result.error?.message).toBe('Detection failed');
    });

    it('should handle non-Error throws in detect', async () => {
      detectionService.detectMissedOpportunities.mockRejectedValue(
        'String error',
      );

      const payload: DashboardRequestPayload = {
        action: 'detect',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('detect', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DETECT_FAILED');
      expect(result.error?.message).toBe(
        'Failed to detect missed opportunities',
      );
    });
  });

  describe('execute - analyze action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'analyze',
        params: {},
      };
      const result = await handler.execute('analyze', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should analyze missed opportunity successfully', async () => {
      analysisService.analyzeMissedOpportunity.mockResolvedValue(mockAnalysis);

      const payload: DashboardRequestPayload = {
        action: 'analyze',
        params: { id: 'miss-1' },
      };
      const result = await handler.execute('analyze', payload, mockContext);

      expect(result.success).toBe(true);
      expect(analysisService.analyzeMissedOpportunity).toHaveBeenCalledWith(
        'miss-1',
        mockContext,
      );
      const data = result.data as {
        missedOpportunityId: string;
        analysis: MissAnalysisResult;
      };
      expect(data.missedOpportunityId).toBe('miss-1');
      expect(data.analysis.discoveredDrivers).toContain('Strong earnings report');
    });

    it('should handle analysis service error', async () => {
      analysisService.analyzeMissedOpportunity.mockRejectedValue(
        new Error('Analysis failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'analyze',
        params: { id: 'miss-1' },
      };
      const result = await handler.execute('analyze', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ANALYZE_FAILED');
      expect(result.error?.message).toBe('Analysis failed');
    });

    it('should handle non-Error throws in analysis', async () => {
      analysisService.analyzeMissedOpportunity.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'analyze',
        params: { id: 'miss-1' },
      };
      const result = await handler.execute('analyze', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ANALYZE_FAILED');
      expect(result.error?.message).toBe('Failed to analyze missed opportunity');
    });
  });

  describe('execute - identify action', () => {
    it('should identify misses using default date', async () => {
      missInvestigationService.identifyMisses.mockResolvedValue([
        mockMissIdentification,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: {},
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(true);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalled();
      const data = result.data as (typeof mockMissIdentification)[];
      expect(data).toHaveLength(1);
      expect(data[0]?.prediction.target?.symbol).toBe('AAPL');
    });

    it('should identify misses with specific date', async () => {
      missInvestigationService.identifyMisses.mockResolvedValue([
        mockMissIdentification,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: { date: '2024-01-15' },
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(true);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalledWith(
        '2024-01-15',
        undefined,
      );
    });

    it('should identify misses with universeId filter', async () => {
      missInvestigationService.identifyMisses.mockResolvedValue([
        mockMissIdentification,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: { date: '2024-01-15', universeId: 'universe-1' },
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(true);
      expect(missInvestigationService.identifyMisses).toHaveBeenCalledWith(
        '2024-01-15',
        'universe-1',
      );
    });

    it('should paginate identify results', async () => {
      const misses = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockMissIdentification,
          prediction: { ...mockPrediction, id: `pred-${i}` },
        }));
      missInvestigationService.identifyMisses.mockResolvedValue(misses);

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as (typeof mockMissIdentification)[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should handle identify service error', async () => {
      missInvestigationService.identifyMisses.mockRejectedValue(
        new Error('Identify failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: {},
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDENTIFY_FAILED');
      expect(result.error?.message).toBe('Identify failed');
    });

    it('should handle non-Error throws in identify', async () => {
      missInvestigationService.identifyMisses.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'identify',
        params: {},
      };
      const result = await handler.execute('identify', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDENTIFY_FAILED');
      expect(result.error?.message).toBe('Failed to identify misses');
    });
  });

  describe('execute - investigate action', () => {
    it('should return error if predictionId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'investigate',
        params: {},
      };
      const result = await handler.execute('investigate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PREDICTION_ID');
    });

    it('should investigate miss successfully', async () => {
      missInvestigationService.investigateMissById.mockResolvedValue(
        mockInvestigation,
      );

      const payload: DashboardRequestPayload = {
        action: 'investigate',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('investigate', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        missInvestigationService.investigateMissById,
      ).toHaveBeenCalledWith('pred-1');
      const data = result.data as MissInvestigation;
      expect(data.prediction.id).toBe('pred-1');
      expect(data.missType).toBe('direction_wrong');
      expect(data.investigationLevel).toBe('predictor');
    });

    it('should return NOT_A_MISS error if investigation returns null', async () => {
      missInvestigationService.investigateMissById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'investigate',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('investigate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_A_MISS');
    });

    it('should handle investigate service error', async () => {
      missInvestigationService.investigateMissById.mockRejectedValue(
        new Error('Investigation failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'investigate',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('investigate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVESTIGATE_FAILED');
      expect(result.error?.message).toBe('Investigation failed');
    });

    it('should handle non-Error throws in investigate', async () => {
      missInvestigationService.investigateMissById.mockRejectedValue(
        'String error',
      );

      const payload: DashboardRequestPayload = {
        action: 'investigate',
        params: { predictionId: 'pred-1' },
      };
      const result = await handler.execute('investigate', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVESTIGATE_FAILED');
      expect(result.error?.message).toBe('Failed to investigate miss');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      detectionService.detectMissedOpportunities.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'DETECT',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('DETECT', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      missInvestigationService.identifyMisses.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'Identify',
        params: {},
      };
      const result = await handler.execute('Identify', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
