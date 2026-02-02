import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import { FastPathService } from '../fast-path.service';
import { SnapshotService } from '../snapshot.service';
import { ObservabilityWebhookService } from '../../../observability/observability-webhook.service';
import { Signal, SignalUrgency } from '../../interfaces/signal.interface';

describe('FastPathService', () => {
  let service: FastPathService;
  let _snapshotService: jest.Mocked<SnapshotService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'anthropic',
    model: 'claude-sonnet',
  });

  const mockSignal: Signal = {
    id: 'signal-123',
    source_id: 'source-123',
    target_id: 'target-123',
    url: 'https://example.com/article',
    content: 'Very bullish signal',
    direction: 'bullish',
    urgency: 'urgent' as SignalUrgency,
    metadata: {},
    detected_at: new Date().toISOString(),
    expired_at: null,
    disposition: 'pending',
    processing_worker: null,
    processing_started_at: null,
    review_queue_id: null,
    evaluation_result: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_test: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FastPathService,
        {
          provide: SnapshotService,
          useValue: {
            buildSnapshotData: jest.fn().mockReturnValue({
              prediction_id: 'pred-123',
              predictors: [],
              rejected_signals: [],
              analyst_assessments: [],
              llm_ensemble: {},
              learnings_applied: [],
              threshold_evaluation: {},
              timeline: [],
            }),
            createSnapshot: jest.fn().mockResolvedValue({ id: 'snapshot-123' }),
          },
        },
        {
          provide: ObservabilityWebhookService,
          useValue: null, // Optional service
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<FastPathService>(FastPathService);
    snapshotService = module.get(SnapshotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldUseFastPath', () => {
    it('should return true for confidence >= 0.90', () => {
      expect(service.shouldUseFastPath(mockSignal, 0.9)).toBe(true);
      expect(service.shouldUseFastPath(mockSignal, 0.95)).toBe(true);
      expect(service.shouldUseFastPath(mockSignal, 1.0)).toBe(true);
    });

    it('should return false for confidence < 0.90', () => {
      expect(service.shouldUseFastPath(mockSignal, 0.89)).toBe(false);
      expect(service.shouldUseFastPath(mockSignal, 0.5)).toBe(false);
      expect(service.shouldUseFastPath(mockSignal, 0.0)).toBe(false);
    });

    it('should work with boundary confidence of 0.90', () => {
      expect(service.shouldUseFastPath(mockSignal, 0.9)).toBe(true);
    });

    it('should work with very high confidence', () => {
      expect(service.shouldUseFastPath(mockSignal, 0.99)).toBe(true);
    });

    it('should work with very low confidence', () => {
      expect(service.shouldUseFastPath(mockSignal, 0.1)).toBe(false);
    });
  });

  describe('processFastPath', () => {
    it('should return null when predictor creation fails', async () => {
      // processFastPath returns null because createPredictorFromSignal is not implemented
      const result = await service.processFastPath(
        mockExecutionContext,
        mockSignal,
      );
      expect(result).toBeNull();
    });

    it('should not throw during execution', async () => {
      await expect(
        service.processFastPath(mockExecutionContext, mockSignal),
      ).resolves.not.toThrow();
    });

    it('should accept execution context', async () => {
      // Should not throw with valid context
      const result = await service.processFastPath(
        mockExecutionContext,
        mockSignal,
      );
      expect(result).toBeNull();
    });

    it('should accept signal parameter', async () => {
      // Should not throw with valid signal
      const result = await service.processFastPath(
        mockExecutionContext,
        mockSignal,
      );
      expect(result).toBeNull();
    });

    it('should handle missing observability service gracefully', async () => {
      // Service was created with null observability - should not throw
      const result = await service.processFastPath(
        mockExecutionContext,
        mockSignal,
      );
      expect(result).toBeNull();
    });

    it('should handle missing snapshot service gracefully', async () => {
      // Create service without snapshot service
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FastPathService,
          {
            provide: SnapshotService,
            useValue: null,
          },
          {
            provide: ObservabilityWebhookService,
            useValue: null,
          },
        ],
      }).compile();

      const serviceWithoutSnap = module.get<FastPathService>(FastPathService);

      // Should not throw
      const result = await serviceWithoutSnap.processFastPath(
        mockExecutionContext,
        mockSignal,
      );
      expect(result).toBeNull();
    });
  });

  describe('FAST_PATH_THRESHOLD', () => {
    it('should use 0.90 as threshold boundary', () => {
      // Just below threshold
      expect(service.shouldUseFastPath(mockSignal, 0.8999)).toBe(false);
      // At threshold
      expect(service.shouldUseFastPath(mockSignal, 0.9)).toBe(true);
      // Just above threshold
      expect(service.shouldUseFastPath(mockSignal, 0.9001)).toBe(true);
    });
  });

  describe('signal handling', () => {
    it('should handle various signal states', async () => {
      const signals: Signal[] = [
        { ...mockSignal, disposition: 'pending' },
        { ...mockSignal, id: 'signal-2', disposition: 'processing' },
        { ...mockSignal, id: 'signal-3', disposition: 'predictor_created' },
      ];

      for (const signal of signals) {
        const result = await service.processFastPath(
          mockExecutionContext,
          signal,
        );
        expect(result).toBeNull(); // All return null since createPredictorFromSignal not implemented
      }
    });

    it('should handle different urgency levels', () => {
      const urgentSignal: Signal = { ...mockSignal, urgency: 'urgent' };
      const notableSignal: Signal = { ...mockSignal, urgency: 'notable' };
      const routineSignal: Signal = { ...mockSignal, urgency: 'routine' };

      // shouldUseFastPath is based on confidence, not urgency
      expect(service.shouldUseFastPath(urgentSignal, 0.95)).toBe(true);
      expect(service.shouldUseFastPath(notableSignal, 0.95)).toBe(true);
      expect(service.shouldUseFastPath(routineSignal, 0.95)).toBe(true);
    });

    it('should handle different signal directions', () => {
      const bullishSignal: Signal = { ...mockSignal, direction: 'bullish' };
      const bearishSignal: Signal = { ...mockSignal, direction: 'bearish' };
      const neutralSignal: Signal = { ...mockSignal, direction: 'neutral' };

      // shouldUseFastPath is based on confidence, not direction
      expect(service.shouldUseFastPath(bullishSignal, 0.95)).toBe(true);
      expect(service.shouldUseFastPath(bearishSignal, 0.95)).toBe(true);
      expect(service.shouldUseFastPath(neutralSignal, 0.95)).toBe(true);
    });
  });
});
