/**
 * Signals Handler Tests
 *
 * Tests for the signals dashboard handler, including:
 * - List action for signals by target with filtering and pagination
 * - Get action for individual signals
 * - Process action for manually triggering signal-to-predictor conversion
 */

import { Test } from '@nestjs/testing';
import { SignalsHandler } from '../signals.handler';
import { SignalRepository } from '../../../repositories/signal.repository';
import { TargetRepository } from '../../../repositories/target.repository';
import { UniverseRepository } from '../../../repositories/universe.repository';
import { SignalDetectionService } from '../../../services/signal-detection.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
  NIL_UUID as _NIL_UUID,
} from '@orchestrator-ai/transport-types';
import type { Signal } from '../../../interfaces/signal.interface';
import type { Target } from '../../../interfaces/target.interface';
import type { Universe } from '../../../interfaces/universe.interface';

describe('SignalsHandler', () => {
  let handler: SignalsHandler;
  let signalRepository: jest.Mocked<SignalRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;
  let signalDetectionService: jest.Mocked<SignalDetectionService>;

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

  const mockSignal: Signal = {
    id: 'signal-1',
    target_id: 'target-1',
    source_id: 'source-1',
    content: 'Breaking news about company earnings',
    direction: 'bullish',
    detected_at: '2024-01-15T09:00:00Z',
    url: 'https://example.com/news/1',
    metadata: { source: 'reuters' },
    disposition: 'pending',
    urgency: null,
    processing_worker: null,
    processing_started_at: null,
    evaluation_result: null,
    review_queue_id: null,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
    expired_at: null,
    is_test: false,
    scenario_run_id: null,
  };

  const mockTarget: Target = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc',
    target_type: 'stock' as const,
    context: 'Tech company',
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-15T00:00:00Z',
    llm_config_override: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockUniverse: Universe = {
    id: 'universe-1',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Test Universe',
    description: 'Test universe for predictions',
    domain: 'stocks' as const,
    strategy_id: null,
    is_active: true,
    llm_config: {
      gold: { provider: 'anthropic', model: 'claude-opus-4' },
      silver: { provider: 'anthropic', model: 'claude-sonnet-4' },
      bronze: { provider: 'anthropic', model: 'claude-haiku-3' },
    },
    thresholds: null,
    notification_config: {
      urgent_enabled: true,
      new_prediction_enabled: true,
      outcome_enabled: true,
      channels: ['sse'],
    },
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockSignalDetectionResult = {
    signal: {
      ...mockSignal,
      disposition: 'predictor_created' as const,
      urgency: 'notable' as const,
      evaluation_result: {
        confidence: 0.75,
        analyst_slug: 'manual-signal-processor',
        reasoning: 'Strong bullish indicators detected',
      },
    },
    shouldCreatePredictor: true,
    urgency: 'notable' as const,
    confidence: 0.75,
    reasoning: 'Strong bullish indicators detected',
    analystSlug: 'manual-signal-processor',
    key_factors: ['earnings beat', 'positive guidance'],
    risks: ['market volatility'],
  };

  beforeEach(async () => {
    const mockSignalRepository = {
      findById: jest.fn(),
      findPendingSignals: jest.fn(),
      findByTargetAndDisposition: jest.fn(),
      claimSignal: jest.fn(),
      update: jest.fn(),
    };

    const mockTargetRepository = {
      findActiveByUniverse: jest.fn(),
    };

    const mockUniverseRepository = {
      findByAgentSlug: jest.fn(),
    };

    const mockSignalDetectionService = {
      processSignal: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SignalsHandler,
        {
          provide: SignalRepository,
          useValue: mockSignalRepository,
        },
        {
          provide: TargetRepository,
          useValue: mockTargetRepository,
        },
        {
          provide: UniverseRepository,
          useValue: mockUniverseRepository,
        },
        {
          provide: SignalDetectionService,
          useValue: mockSignalDetectionService,
        },
      ],
    }).compile();

    handler = moduleRef.get<SignalsHandler>(SignalsHandler);
    signalRepository = moduleRef.get(SignalRepository);
    targetRepository = moduleRef.get(TargetRepository);
    universeRepository = moduleRef.get(UniverseRepository);
    signalDetectionService = moduleRef.get(SignalDetectionService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('process');
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

  describe('execute - list action', () => {
    it('should return error if targetId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_TARGET_ID');
    });

    it('should list pending signals by default when no disposition provided', async () => {
      signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(signalRepository.findPendingSignals).toHaveBeenCalledWith(
        'target-1',
        1000,
        { includeTestData: false },
      );
      const data = result.data as Signal[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('signal-1');
    });

    it('should list signals by disposition when provided', async () => {
      const processedSignal = {
        ...mockSignal,
        disposition: 'predictor_created' as const,
      };
      signalRepository.findByTargetAndDisposition.mockResolvedValue([
        processedSignal,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1', disposition: 'predictor_created' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(signalRepository.findByTargetAndDisposition).toHaveBeenCalledWith(
        'target-1',
        'predictor_created',
        { includeTestData: false },
      );
      const data = result.data as Signal[];
      expect(data).toHaveLength(1);
      expect(data[0]?.disposition).toBe('predictor_created');
    });

    it('should include test data when includeTest is true', async () => {
      signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1', includeTest: true },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(signalRepository.findPendingSignals).toHaveBeenCalledWith(
        'target-1',
        1000,
        { includeTestData: true },
      );
    });

    it('should paginate results', async () => {
      const signals = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockSignal, id: `signal-${i}` }));
      signalRepository.findPendingSignals.mockResolvedValue(signals);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1', page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Signal[];
      expect(data).toHaveLength(10);
      expect(data[0]?.id).toBe('signal-10');
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
    });

    it('should use offset instead of page when provided', async () => {
      const signals = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockSignal, id: `signal-${i}` }));
      signalRepository.findPendingSignals.mockResolvedValue(signals);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1', offset: 5, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Signal[];
      expect(data).toHaveLength(10);
      expect(data[0]?.id).toBe('signal-5');
    });

    it('should use default page and pageSize when not provided', async () => {
      const signals = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockSignal, id: `signal-${i}` }));
      signalRepository.findPendingSignals.mockResolvedValue(signals);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Signal[];
      expect(data).toHaveLength(20);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle list service error', async () => {
      signalRepository.findPendingSignals.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('execute - get action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get signal by id', async () => {
      signalRepository.findById.mockResolvedValue(mockSignal);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'signal-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(signalRepository.findById).toHaveBeenCalledWith('signal-1');
      const data = result.data as Signal;
      expect(data.id).toBe('signal-1');
    });

    it('should return NOT_FOUND error if signal does not exist', async () => {
      signalRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('Signal not found');
    });

    it('should handle get service error', async () => {
      signalRepository.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'signal-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toContain('Database error');
    });
  });

  describe('execute - process action', () => {
    describe('validation', () => {
      it('should return error if neither targetId nor universeId provided', async () => {
        universeRepository.findByAgentSlug.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: {},
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_TARGET_OR_UNIVERSE');
      });

      it('should auto-detect universeId from agent context when available', async () => {
        universeRepository.findByAgentSlug.mockResolvedValue([mockUniverse]);
        targetRepository.findActiveByUniverse.mockResolvedValue([mockTarget]);
        signalRepository.findPendingSignals.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: {},
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        expect(universeRepository.findByAgentSlug).toHaveBeenCalledWith(
          'prediction-runner',
          'test-org',
        );
        expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
          'universe-1',
        );
      });

      it('should fail if no universeId can be auto-detected', async () => {
        universeRepository.findByAgentSlug.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: {},
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_TARGET_OR_UNIVERSE');
      });
    });

    describe('single target processing', () => {
      it('should process signals for a single target', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
        signalRepository.claimSignal.mockResolvedValue({
          ...mockSignal,
          disposition: 'processing' as const,
          processing_worker: 'test-worker',
        });
        signalDetectionService.processSignal.mockResolvedValue(
          mockSignalDetectionResult,
        );

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        expect(signalRepository.findPendingSignals).toHaveBeenCalledWith(
          'target-1',
          10,
          { includeTestData: false },
        );
        expect(signalRepository.claimSignal).toHaveBeenCalledWith(
          'signal-1',
          expect.any(String),
        );
        expect(signalDetectionService.processSignal).toHaveBeenCalled();

        const data = result.data as {
          processed: number;
          predictorsCreated: number;
          rejected: number;
          errors: number;
        };
        expect(data.processed).toBe(1);
        expect(data.predictorsCreated).toBe(1);
        expect(data.rejected).toBe(0);
        expect(data.errors).toBe(0);
      });

      it('should handle rejected signals', async () => {
        const rejectedResult = {
          ...mockSignalDetectionResult,
          shouldCreatePredictor: false,
        };
        signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
        signalRepository.claimSignal.mockResolvedValue({
          ...mockSignal,
          disposition: 'processing' as const,
        });
        signalDetectionService.processSignal.mockResolvedValue(rejectedResult);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as {
          processed: number;
          predictorsCreated: number;
          rejected: number;
        };
        expect(data.processed).toBe(1);
        expect(data.predictorsCreated).toBe(0);
        expect(data.rejected).toBe(1);
      });

      it('should skip already claimed signals', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
        signalRepository.claimSignal.mockResolvedValue(null);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as { processed: number };
        expect(data.processed).toBe(0);
        expect(signalDetectionService.processSignal).not.toHaveBeenCalled();
      });

      it('should handle no pending signals', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as { processed: number; message: string };
        expect(data.processed).toBe(0);
        expect(data.message).toContain('No pending signals');
      });

      it('should use custom batchSize', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1', batchSize: 5 },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        expect(signalRepository.findPendingSignals).toHaveBeenCalledWith(
          'target-1',
          5,
          { includeTestData: false },
        );
      });

      it('should include test data when includeTest is true', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1', includeTest: true },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        expect(signalRepository.findPendingSignals).toHaveBeenCalledWith(
          'target-1',
          10,
          { includeTestData: true },
        );
      });

      it('should handle processing errors', async () => {
        signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
        signalRepository.claimSignal.mockResolvedValue({
          ...mockSignal,
          disposition: 'processing' as const,
        });
        signalDetectionService.processSignal.mockRejectedValue(
          new Error('Processing failed'),
        );

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as {
          processed: number;
          predictorsCreated: number;
          rejected: number;
          errors: number;
        };
        expect(data.processed).toBe(0);
        expect(data.errors).toBe(1);
      });

      it('should handle process service error', async () => {
        signalRepository.findPendingSignals.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { targetId: 'target-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PROCESS_FAILED');
        expect(result.error?.message).toContain('Database error');
      });
    });

    describe('universe processing', () => {
      it('should process signals for all targets in a universe', async () => {
        const target2 = { ...mockTarget, id: 'target-2', symbol: 'GOOGL' };
        targetRepository.findActiveByUniverse.mockResolvedValue([
          mockTarget,
          target2,
        ]);
        signalRepository.findPendingSignals.mockResolvedValue([mockSignal]);
        signalRepository.claimSignal.mockResolvedValue({
          ...mockSignal,
          disposition: 'processing' as const,
        });
        signalDetectionService.processSignal.mockResolvedValue(
          mockSignalDetectionResult,
        );

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { universeId: 'universe-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        expect(targetRepository.findActiveByUniverse).toHaveBeenCalledWith(
          'universe-1',
        );
        expect(signalRepository.findPendingSignals).toHaveBeenCalledTimes(2);

        const data = result.data as {
          targetsProcessed: number;
          totalProcessed: number;
          totalPredictorsCreated: number;
          targetResults: Array<{ targetId: string; targetSymbol: string }>;
        };
        expect(data.targetsProcessed).toBe(2);
        expect(data.totalProcessed).toBe(2);
        expect(data.totalPredictorsCreated).toBe(2);
        expect(data.targetResults).toHaveLength(2);
        expect(data.targetResults[0]?.targetSymbol).toBe('AAPL');
        expect(data.targetResults[1]?.targetSymbol).toBe('GOOGL');
      });

      it('should handle universe with no active targets', async () => {
        targetRepository.findActiveByUniverse.mockResolvedValue([]);

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { universeId: 'universe-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as {
          targetsProcessed: number;
          totalProcessed: number;
          message: string;
        };
        expect(data.targetsProcessed).toBe(0);
        expect(data.totalProcessed).toBe(0);
        expect(data.message).toContain('No active targets');
      });

      it('should aggregate results across multiple targets', async () => {
        const target2 = { ...mockTarget, id: 'target-2', symbol: 'GOOGL' };
        const signal2 = {
          ...mockSignal,
          id: 'signal-2',
          target_id: 'target-2',
        };

        targetRepository.findActiveByUniverse.mockResolvedValue([
          mockTarget,
          target2,
        ]);

        signalRepository.findPendingSignals
          .mockResolvedValueOnce([mockSignal])
          .mockResolvedValueOnce([signal2]);

        signalRepository.claimSignal.mockResolvedValue({
          ...mockSignal,
          disposition: 'processing' as const,
        });

        signalDetectionService.processSignal
          .mockResolvedValueOnce(mockSignalDetectionResult)
          .mockResolvedValueOnce({
            ...mockSignalDetectionResult,
            shouldCreatePredictor: false,
          });

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { universeId: 'universe-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(true);
        const data = result.data as {
          totalProcessed: number;
          totalPredictorsCreated: number;
          totalRejected: number;
          totalErrors: number;
        };
        expect(data.totalProcessed).toBe(2);
        expect(data.totalPredictorsCreated).toBe(1);
        expect(data.totalRejected).toBe(1);
        expect(data.totalErrors).toBe(0);
      });

      it('should handle universe processing error', async () => {
        targetRepository.findActiveByUniverse.mockRejectedValue(
          new Error('Database error'),
        );

        const payload: DashboardRequestPayload = {
          action: 'process',
          params: { universeId: 'universe-1' },
        };
        const result = await handler.execute('process', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PROCESS_FAILED');
        expect(result.error?.message).toContain('Database error');
      });
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      signalRepository.findPendingSignals.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      signalRepository.findById.mockResolvedValue(mockSignal);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'signal-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase process action', async () => {
      signalRepository.findPendingSignals.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'PROCESS',
        params: { targetId: 'target-1' },
      };
      const result = await handler.execute('PROCESS', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
