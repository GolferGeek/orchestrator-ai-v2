/**
 * Runner Handler Tests
 *
 * Tests for the runner dashboard handler, including:
 * - getSupportedActions returns correct actions
 * - fetchPrices action for fetching prices for active targets
 * - createBaselines action for creating baseline predictions
 * - resolveOutcomes action for triggering outcome tracking
 * - processSignals action for processing pending signals
 * - status action for getting runner status
 * - runAll action for running complete daily flow
 * - Error handling for unsupported actions
 * - Error handling for service failures
 * - Case insensitivity for action names
 */

import { Test } from '@nestjs/testing';
import { RunnerHandler } from '../runner.handler';
import { OutcomeTrackingRunner } from '../../../runners/outcome-tracking.runner';
import { BaselinePredictionRunner } from '../../../runners/baseline-prediction.runner';
import { BatchSignalProcessorRunner } from '../../../runners/batch-signal-processor.runner';
import { ArticleProcessorService } from '../../../services/article-processor.service';
import { TargetSnapshotService } from '../../../services/target-snapshot.service';
import { TargetRepository } from '../../../repositories/target.repository';
import { UniverseRepository } from '../../../repositories/universe.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('RunnerHandler', () => {
  let handler: RunnerHandler;
  let outcomeTrackingRunner: jest.Mocked<OutcomeTrackingRunner>;
  let baselinePredictionRunner: jest.Mocked<BaselinePredictionRunner>;
  let articleProcessorService: jest.Mocked<ArticleProcessorService>;
  let targetSnapshotService: jest.Mocked<TargetSnapshotService>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;

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

  const mockTarget = {
    id: 'target-1',
    symbol: 'AAPL',
    name: 'Apple Inc',
    universe_id: 'universe-1',
    target_type: 'stock' as const,
    context: 'Tech company',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-15T00:00:00Z',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockSnapshot = {
    id: 'snapshot-1',
    target_id: 'target-1',
    value: 150.0,
    value_type: 'price' as const,
    captured_at: '2024-01-15T00:00:00Z',
    source: 'polygon' as const,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
  };

  const mockUniverse = {
    id: 'universe-1',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'US Stocks',
    description: 'US Stock Market',
    domain: 'stocks' as const,
    strategy_id: null,
    llm_config: null,
    thresholds: null,
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['sse' as const],
    },
    is_active: true,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const mockOutcomeTrackingRunner = {
      runOutcomeTracking: jest.fn(),
    };

    const mockBaselinePredictionRunner = {
      manualRun: jest.fn(),
      getStatus: jest.fn(),
    };

    const mockBatchSignalProcessorRunner = {
      runBatchProcessing: jest.fn(),
      processTargetManually: jest.fn(),
    };

    const mockTargetSnapshotService = {
      fetchAndCaptureValue: jest.fn(),
    };

    const mockTargetRepository = {
      findAllActive: jest.fn(),
      findActiveByUniverse: jest.fn(),
    };

    const mockUniverseRepository = {
      findByDomain: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RunnerHandler,
        {
          provide: OutcomeTrackingRunner,
          useValue: mockOutcomeTrackingRunner,
        },
        {
          provide: BaselinePredictionRunner,
          useValue: mockBaselinePredictionRunner,
        },
        {
          provide: BatchSignalProcessorRunner,
          useValue: mockBatchSignalProcessorRunner,
        },
        {
          provide: ArticleProcessorService,
          useValue: {
            processAllTargets: jest.fn(),
          },
        },
        {
          provide: TargetSnapshotService,
          useValue: mockTargetSnapshotService,
        },
        {
          provide: TargetRepository,
          useValue: mockTargetRepository,
        },
        {
          provide: UniverseRepository,
          useValue: mockUniverseRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<RunnerHandler>(RunnerHandler);
    outcomeTrackingRunner = moduleRef.get(OutcomeTrackingRunner);
    baselinePredictionRunner = moduleRef.get(BaselinePredictionRunner);
    articleProcessorService = moduleRef.get(ArticleProcessorService);
    targetSnapshotService = moduleRef.get(TargetSnapshotService);
    targetRepository = moduleRef.get(TargetRepository);
    universeRepository = moduleRef.get(UniverseRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('fetchPrices');
      expect(actions).toContain('createBaselines');
      expect(actions).toContain('resolveOutcomes');
      expect(actions).toContain('processSignals');
      expect(actions).toContain('status');
      expect(actions).toContain('runAll');
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
      expect(result.error?.message).toContain('Unsupported action');
    });
  });

  describe('execute - fetchPrices action', () => {
    it('should fetch prices for all active targets', async () => {
      targetRepository.findAllActive.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: {},
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findAllActive).toHaveBeenCalled();
      expect(targetSnapshotService.fetchAndCaptureValue).toHaveBeenCalledWith(
        'target-1',
      );
      const data = result.data as {
        action: string;
        captured: number;
        errors: number;
        totalTargets: number;
      };
      expect(data.action).toBe('fetchPrices');
      expect(data.captured).toBe(1);
      expect(data.errors).toBe(0);
      expect(data.totalTargets).toBe(1);
    });

    it('should fetch prices for targets in a specific universe', async () => {
      targetRepository.findActiveByUniverse.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
        'universe-1',
      );
      const data = result.data as { totalTargets: number };
      expect(data.totalTargets).toBe(1);
    });

    it('should fetch prices for targets by domain', async () => {
      universeRepository.findByDomain.mockResolvedValue([mockUniverse]);
      targetRepository.findActiveByUniverse.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: { domain: 'stocks' },
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeRepository.findByDomain).toHaveBeenCalledWith('stocks');
      expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
        'universe-1',
      );
      const data = result.data as { totalTargets: number };
      expect(data.totalTargets).toBe(1);
    });

    it('should handle price fetch errors gracefully', async () => {
      targetRepository.findAllActive.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockRejectedValue(
        new Error('Price API error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: {},
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { captured: number; errors: number };
      expect(data.captured).toBe(0);
      expect(data.errors).toBe(1);
    });

    it('should handle null snapshots', async () => {
      targetRepository.findAllActive.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: {},
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { captured: number };
      expect(data.captured).toBe(0);
    });

    it('should handle fetch prices service error', async () => {
      targetRepository.findAllActive.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'fetchPrices',
        params: {},
      };
      const result = await handler.execute('fetchPrices', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FETCH_PRICES_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('execute - createBaselines action', () => {
    it('should create baseline predictions with default date', async () => {
      const mockResult = {
        created: 5,
        skipped: 2,
        errors: 0,
        targets: ['target-1', 'target-2'],
      };
      baselinePredictionRunner.manualRun.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'createBaselines',
        params: {},
      };
      const result = await handler.execute(
        'createBaselines',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalled();
      const data = result.data as {
        action: string;
        date: string;
        created: number;
        skipped: number;
      };
      expect(data.action).toBe('createBaselines');
      expect(data.created).toBe(5);
      expect(data.skipped).toBe(2);
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should create baseline predictions with specific date', async () => {
      const mockResult = {
        created: 5,
        skipped: 2,
        errors: 0,
        targets: ['target-1'],
      };
      baselinePredictionRunner.manualRun.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'createBaselines',
        params: { date: '2024-01-15' },
      };
      const result = await handler.execute(
        'createBaselines',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalledWith(
        '2024-01-15',
        undefined,
      );
      const data = result.data as { date: string };
      expect(data.date).toBe('2024-01-15');
    });

    it('should create baseline predictions for specific universe', async () => {
      const mockResult = {
        created: 3,
        skipped: 1,
        errors: 0,
        targets: ['target-1'],
      };
      baselinePredictionRunner.manualRun.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'createBaselines',
        params: { date: '2024-01-15', universeId: 'universe-1' },
      };
      const result = await handler.execute(
        'createBaselines',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalledWith(
        '2024-01-15',
        'universe-1',
      );
    });

    it('should return error if runner is busy', async () => {
      baselinePredictionRunner.manualRun.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'createBaselines',
        params: {},
      };
      const result = await handler.execute(
        'createBaselines',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RUNNER_BUSY');
      expect(result.error?.message).toContain('already running');
    });

    it('should handle create baselines service error', async () => {
      baselinePredictionRunner.manualRun.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'createBaselines',
        params: {},
      };
      const result = await handler.execute(
        'createBaselines',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_BASELINES_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('execute - resolveOutcomes action', () => {
    it('should resolve outcomes successfully', async () => {
      const mockResult = {
        snapshotsCaptured: 10,
        predictionsResolved: 5,
        predictionsExpired: 2,
        errors: 0,
      };
      outcomeTrackingRunner.runOutcomeTracking.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'resolveOutcomes',
        params: {},
      };
      const result = await handler.execute(
        'resolveOutcomes',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(outcomeTrackingRunner.runOutcomeTracking).toHaveBeenCalled();
      const data = result.data as {
        action: string;
        snapshotsCaptured: number;
        predictionsResolved: number;
        predictionsExpired: number;
      };
      expect(data.action).toBe('resolveOutcomes');
      expect(data.snapshotsCaptured).toBe(10);
      expect(data.predictionsResolved).toBe(5);
      expect(data.predictionsExpired).toBe(2);
    });

    it('should handle resolve outcomes service error', async () => {
      outcomeTrackingRunner.runOutcomeTracking.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'resolveOutcomes',
        params: {},
      };
      const result = await handler.execute(
        'resolveOutcomes',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESOLVE_OUTCOMES_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('execute - processSignals action', () => {
    it('should process signals for all targets', async () => {
      // processSignals now redirects to processArticles
      const mockResult = {
        articles_processed: 10,
        predictors_created: 5,
        targets_affected: 3,
        errors: [],
      };
      articleProcessorService.processAllTargets.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'processSignals',
        params: {},
      };
      const result = await handler.execute(
        'processSignals',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(articleProcessorService.processAllTargets).toHaveBeenCalled();
      const data = result.data as {
        action: string;
        articlesProcessed: number;
        predictorsCreated: number;
      };
      expect(data.action).toBe('processArticles');
      expect(data.articlesProcessed).toBe(10);
      expect(data.predictorsCreated).toBe(5);
    });

    it('should process signals for specific target', async () => {
      // processSignals no longer supports targetId, it processes all targets
      // This test verifies that it still works (ignores the targetId param)
      const mockResult = {
        articles_processed: 10,
        predictors_created: 5,
        targets_affected: 3,
        errors: [],
      };
      articleProcessorService.processAllTargets.mockResolvedValue(mockResult);

      const payload: DashboardRequestPayload = {
        action: 'processSignals',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute(
        'processSignals',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(articleProcessorService.processAllTargets).toHaveBeenCalled();
      const data = result.data as {
        action: string;
        articlesProcessed: number;
        predictorsCreated: number;
      };
      expect(data.action).toBe('processArticles');
      expect(data.articlesProcessed).toBe(10);
      expect(data.predictorsCreated).toBe(5);
    });

    it('should handle process signals service error', async () => {
      articleProcessorService.processAllTargets.mockRejectedValue(
        new Error('Processing error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'processSignals',
        params: {},
      };
      const result = await handler.execute(
        'processSignals',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROCESS_ARTICLES_FAILED');
      expect(result.error?.message).toContain('Processing error');
    });
  });

  describe('execute - status action', () => {
    it('should get runner status successfully', async () => {
      baselinePredictionRunner.getStatus.mockReturnValue({ isRunning: false });

      const payload: DashboardRequestPayload = {
        action: 'status',
        params: {},
      };
      const result = await handler.execute('status', payload, mockContext);

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.getStatus).toHaveBeenCalled();
      const data = result.data as {
        action: string;
        runners: {
          baselinePrediction: { isRunning: boolean };
          outcomeTracking: { isRunning: boolean };
        };
      };
      expect(data.action).toBe('status');
      expect(data.runners.baselinePrediction.isRunning).toBe(false);
      expect(data.runners.outcomeTracking.isRunning).toBe(false);
    });

    it('should handle status service error', async () => {
      baselinePredictionRunner.getStatus.mockImplementation(() => {
        throw new Error('Status error');
      });

      const payload: DashboardRequestPayload = {
        action: 'status',
        params: {},
      };
      const result = await handler.execute('status', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STATUS_FAILED');
      expect(result.error?.message).toContain('Status error');
    });
  });

  describe('execute - runAll action', () => {
    beforeEach(() => {
      // Setup successful mocks for all steps
      targetRepository.findAllActive.mockResolvedValue([mockTarget]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );
      baselinePredictionRunner.manualRun.mockResolvedValue({
        created: 5,
        skipped: 2,
        errors: 0,
        targets: ['target-1'],
      });
      outcomeTrackingRunner.runOutcomeTracking.mockResolvedValue({
        snapshotsCaptured: 10,
        predictionsResolved: 5,
        predictionsExpired: 2,
        errors: 0,
      });
    });

    it('should run complete daily flow successfully', async () => {
      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findAllActive).toHaveBeenCalled();
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalled();
      expect(outcomeTrackingRunner.runOutcomeTracking).toHaveBeenCalled();

      const data = result.data as {
        action: string;
        date: string;
        fetchPrices: { captured: number; totalTargets: number };
        createBaselines: { created: number; skipped: number };
        resolveOutcomes: { predictionsResolved: number };
        errors: string[];
      };
      expect(data.action).toBe('runAll');
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.fetchPrices.captured).toBe(1);
      expect(data.createBaselines.created).toBe(5);
      expect(data.resolveOutcomes.predictionsResolved).toBe(5);
      expect(data.errors).toHaveLength(0);
    });

    it('should run daily flow with specific date', async () => {
      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: { date: '2024-01-15' },
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalledWith(
        '2024-01-15',
        undefined,
      );
      const data = result.data as { date: string };
      expect(data.date).toBe('2024-01-15');
    });

    it('should continue on fetch prices error and record it', async () => {
      targetRepository.findAllActive.mockRejectedValue(
        new Error('Fetch error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      expect(baselinePredictionRunner.manualRun).toHaveBeenCalled();
      expect(outcomeTrackingRunner.runOutcomeTracking).toHaveBeenCalled();

      const data = result.data as {
        fetchPrices?: { captured: number };
        errors: string[];
      };
      expect(data.fetchPrices).toBeUndefined();
      expect(data.errors).toContain('Price fetch: Fetch error');
    });

    it('should continue on baseline creation error and record it', async () => {
      baselinePredictionRunner.manualRun.mockRejectedValue(
        new Error('Baseline error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      expect(outcomeTrackingRunner.runOutcomeTracking).toHaveBeenCalled();

      const data = result.data as {
        createBaselines?: { created: number };
        errors: string[];
      };
      expect(data.createBaselines).toBeUndefined();
      expect(data.errors).toContain('Baseline creation: Baseline error');
    });

    it('should continue on outcome resolution error and record it', async () => {
      outcomeTrackingRunner.runOutcomeTracking.mockRejectedValue(
        new Error('Outcome error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        resolveOutcomes?: { predictionsResolved: number };
        errors: string[];
      };
      expect(data.resolveOutcomes).toBeUndefined();
      expect(data.errors).toContain('Outcome resolution: Outcome error');
    });

    it('should handle complete failure and return partial results', async () => {
      targetRepository.findAllActive.mockRejectedValue(new Error('Fatal'));
      baselinePredictionRunner.manualRun.mockRejectedValue(new Error('Fatal'));
      outcomeTrackingRunner.runOutcomeTracking.mockRejectedValue(
        new Error('Fatal'),
      );

      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as { errors: string[] };
      expect(data.errors).toHaveLength(3);
    });

    it('should handle errors from individual steps in errors array', async () => {
      targetRepository.findAllActive.mockRejectedValue(
        new Error('Unexpected error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'runAll',
        params: {},
      };
      const result = await handler.execute('runAll', payload, mockContext);

      // runAll catches errors from individual steps and continues
      // Individual step errors are added to errors array, but overall result is success
      expect(result.success).toBe(true);
      const data = result.data as { errors: string[] };
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0]).toContain('Price fetch: Unexpected error');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      baselinePredictionRunner.getStatus.mockReturnValue({ isRunning: false });

      const payload: DashboardRequestPayload = {
        action: 'STATUS',
        params: {},
      };
      const result = await handler.execute('STATUS', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      targetRepository.findAllActive.mockResolvedValue([]);
      targetSnapshotService.fetchAndCaptureValue.mockResolvedValue(
        mockSnapshot,
      );

      const payload: DashboardRequestPayload = {
        action: 'FetchPrices',
        params: {},
      };
      const result = await handler.execute('FetchPrices', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
