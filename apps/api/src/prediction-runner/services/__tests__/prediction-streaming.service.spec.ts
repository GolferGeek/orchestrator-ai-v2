import { Test, TestingModule } from '@nestjs/testing';
import { Subject } from 'rxjs';
import { take, toArray } from 'rxjs/operators';
import {
  PredictionStreamingService,
  PredictionProgressMetadata,
} from '../prediction-streaming.service';
import {
  ObservabilityEventsService,
  ObservabilityEventRecord,
} from '../../../observability/observability-events.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { Prediction } from '../../interfaces/prediction.interface';

describe('PredictionStreamingService', () => {
  let service: PredictionStreamingService;
  let observabilityEvents: jest.Mocked<ObservabilityEventsService>;
  let eventsSubject: Subject<ObservabilityEventRecord>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-456',
    taskId: 'task-789',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'prediction-runner',
    agentType: 'runner',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockPrediction: Prediction = {
    id: 'pred-123',
    target_id: 'target-456',
    task_id: 'task-789',
    direction: 'up',
    confidence: 0.85,
    magnitude: 'medium',
    reasoning: 'Test prediction reasoning',
    timeframe_hours: 24,
    predicted_at: '2026-01-09T12:00:00Z',
    expires_at: '2026-01-10T12:00:00Z',
    entry_price: 100,
    target_price: 105,
    stop_loss: 95,
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'active',
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: '2026-01-09T12:00:00Z',
    updated_at: '2026-01-09T12:00:00Z',
  };

  beforeEach(async () => {
    eventsSubject = new Subject<ObservabilityEventRecord>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionStreamingService,
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
            events$: eventsSubject.asObservable(),
          },
        },
      ],
    }).compile();

    service = module.get<PredictionStreamingService>(
      PredictionStreamingService,
    );
    observabilityEvents = module.get(ObservabilityEventsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitChunk', () => {
    it('should push event to observability service', () => {
      const metadata: PredictionProgressMetadata = {
        phase: 'signal_detection',
        step: 'started',
        progress: 0,
        status: 'in_progress',
        targetId: 'target-456',
        targetSymbol: 'AAPL',
      };

      service.emitChunk(mockContext, 'Starting signal detection', metadata);

      expect(observabilityEvents.push).toHaveBeenCalledTimes(1);

      const pushedEvent = (observabilityEvents.push as jest.Mock).mock
        .calls[0][0];
      expect(pushedEvent.context).toEqual(mockContext);
      expect(pushedEvent.source_app).toBe('prediction-runner');
      expect(pushedEvent.hook_event_type).toBe('agent.stream.chunk');
      expect(pushedEvent.message).toBe('Starting signal detection');
      expect(pushedEvent.progress).toBe(0);
      expect(pushedEvent.step).toBe('signal_detection.started');
      expect(pushedEvent.payload.phase).toBe('signal_detection');
      expect(pushedEvent.payload.targetSymbol).toBe('AAPL');
    });

    it('should include all metadata fields in payload', () => {
      const metadata: PredictionProgressMetadata = {
        phase: 'predictor_creation',
        step: 'analyst_evaluation',
        progress: 40,
        status: 'in_progress',
        targetId: 'target-456',
        targetSymbol: 'AAPL',
        predictionId: 'pred-123',
        direction: 'up',
        confidence: 0.85,
        predictorCount: 3,
        analystCount: 5,
        llmTiers: ['gold', 'silver'],
        metadata: { custom: 'data' },
      };

      service.emitChunk(mockContext, 'Analyst evaluation', metadata);

      const pushedEvent = (observabilityEvents.push as jest.Mock).mock
        .calls[0][0];
      expect(pushedEvent.payload.predictorCount).toBe(3);
      expect(pushedEvent.payload.analystCount).toBe(5);
      expect(pushedEvent.payload.llmTiers).toEqual(['gold', 'silver']);
      expect(pushedEvent.payload.custom).toBe('data');
    });
  });

  describe('phase-specific emit methods', () => {
    describe('signal detection phase', () => {
      it('should emit signal detection started', () => {
        service.emitSignalDetectionStarted(mockContext, 'target-456', 'AAPL');

        expect(observabilityEvents.push).toHaveBeenCalledTimes(1);
        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('signal_detection.started');
        expect(event.progress).toBe(0);
        expect(event.payload.targetSymbol).toBe('AAPL');
      });

      it('should emit signal detection progress', () => {
        service.emitSignalDetectionProgress(
          mockContext,
          'Processing signals',
          10,
          { targetId: 'target-456' },
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('signal_detection.processing');
        expect(event.progress).toBe(10);
      });

      it('should emit signal detection completed', () => {
        service.emitSignalDetectionCompleted(
          mockContext,
          'target-456',
          5,
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('signal_detection.completed');
        expect(event.progress).toBe(20);
        expect(event.message).toContain('5 signals');
      });
    });

    describe('predictor creation phase', () => {
      it('should emit predictor creation started', () => {
        service.emitPredictorCreationStarted(
          mockContext,
          'target-456',
          3,
          ['gold', 'silver'],
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('predictor_creation.started');
        expect(event.progress).toBe(25);
        expect(event.message).toContain('3 analysts');
        expect(event.message).toContain('2 LLM tiers');
      });

      it('should emit analyst evaluation', () => {
        service.emitAnalystEvaluation(
          mockContext,
          'technical-tina',
          'gold',
          35,
          'target-456',
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('predictor_creation.analyst_evaluation');
        expect(event.payload.analystSlug).toBe('technical-tina');
        expect(event.payload.tier).toBe('gold');
      });

      it('should emit predictor creation completed', () => {
        service.emitPredictorCreationCompleted(
          mockContext,
          'target-456',
          8,
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('predictor_creation.completed');
        expect(event.progress).toBe(50);
        expect(event.message).toContain('8 predictors');
      });
    });

    describe('threshold evaluation phase', () => {
      it('should emit threshold evaluation started', () => {
        service.emitThresholdEvaluationStarted(
          mockContext,
          'target-456',
          5,
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('threshold_evaluation.started');
        expect(event.progress).toBe(55);
      });

      it('should emit threshold not met', () => {
        service.emitThresholdNotMet(
          mockContext,
          'target-456',
          'Insufficient predictors (2/3)',
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('threshold_evaluation.not_met');
        expect(event.progress).toBe(100);
        expect(event.payload.thresholdMet).toBe(false);
      });

      it('should emit threshold met', () => {
        service.emitThresholdMet(mockContext, 'target-456', 'AAPL');

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('threshold_evaluation.met');
        expect(event.progress).toBe(60);
        expect(event.payload.thresholdMet).toBe(true);
      });
    });

    describe('prediction generation phase', () => {
      it('should emit prediction generation started', () => {
        service.emitPredictionGenerationStarted(
          mockContext,
          'target-456',
          'up',
          0.85,
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('prediction_generation.started');
        expect(event.progress).toBe(65);
        expect(event.message).toContain('UP');
        expect(event.message).toContain('85%');
      });

      it('should emit prediction generation completed', () => {
        service.emitPredictionGenerationCompleted(
          mockContext,
          mockPrediction,
          'AAPL',
        );

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('prediction_generation.completed');
        expect(event.progress).toBe(80);
        expect(event.payload.predictionId).toBe('pred-123');
        expect(event.payload.direction).toBe('up');
      });
    });

    describe('snapshot creation phase', () => {
      it('should emit snapshot creation started', () => {
        service.emitSnapshotCreationStarted(mockContext, 'pred-123');

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('snapshot_creation.started');
        expect(event.progress).toBe(85);
      });

      it('should emit snapshot creation completed', () => {
        service.emitSnapshotCreationCompleted(mockContext, 'pred-123');

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('snapshot_creation.completed');
        expect(event.progress).toBe(90);
      });
    });

    describe('notification phase', () => {
      it('should emit notification started (non-urgent)', () => {
        service.emitNotificationStarted(mockContext, 'pred-123', false);

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('notification.started');
        expect(event.progress).toBe(95);
        expect(event.message).toBe('Sending notification');
      });

      it('should emit notification started (urgent)', () => {
        service.emitNotificationStarted(mockContext, 'pred-123', true);

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.message).toBe('Sending urgent notification');
        expect(event.payload.isUrgent).toBe(true);
      });

      it('should emit notification sent', () => {
        service.emitNotificationSent(mockContext, 'pred-123', ['push', 'sse']);

        const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
        expect(event.step).toBe('notification.completed');
        expect(event.progress).toBe(98);
        expect(event.message).toContain('push, sse');
      });
    });
  });

  describe('emitComplete', () => {
    it('should emit completion event', () => {
      service.emitComplete(mockContext, mockPrediction);

      expect(observabilityEvents.push).toHaveBeenCalledTimes(1);

      const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
      expect(event.hook_event_type).toBe('agent.stream.complete');
      expect(event.status).toBe('completed');
      expect(event.progress).toBe(100);
      expect(event.payload.predictionId).toBe('pred-123');
      expect(event.payload.direction).toBe('up');
      expect(event.payload.confidence).toBe(0.85);
    });

    it('should include prediction details in message', () => {
      service.emitComplete(mockContext, mockPrediction);

      const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
      expect(event.message).toContain('pred-123');
      expect(event.message).toContain('UP');
      expect(event.message).toContain('85%');
    });
  });

  describe('emitError', () => {
    it('should emit error event', () => {
      service.emitError(
        mockContext,
        'Failed to generate prediction',
        'prediction_generation',
      );

      expect(observabilityEvents.push).toHaveBeenCalledTimes(1);

      const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
      expect(event.hook_event_type).toBe('agent.stream.error');
      expect(event.status).toBe('failed');
      expect(event.message).toBe('Failed to generate prediction');
      expect(event.step).toBe('prediction_generation.error');
      expect(event.payload.error).toBe('Failed to generate prediction');
    });

    it('should handle error without phase', () => {
      service.emitError(mockContext, 'Unknown error');

      const event = (observabilityEvents.push as jest.Mock).mock.calls[0][0];
      expect(event.step).toBe('error');
    });
  });

  describe('subscribeToTask', () => {
    it('should filter events by taskId', async () => {
      const receivedEvents: unknown[] = [];

      // Subscribe before emitting
      service
        .subscribeToTask('task-789')
        .pipe(take(2), toArray())
        .subscribe((events) => {
          receivedEvents.push(...events);
        });

      // Emit events for matching task
      eventsSubject.next({
        context: mockContext,
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Processing',
        progress: 50,
        step: 'signal_detection.processing',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      // Emit event for different task
      eventsSubject.next({
        context: { ...mockContext, taskId: 'different-task' },
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Other task',
        progress: 50,
        step: 'signal_detection.processing',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      // Emit another event for matching task
      eventsSubject.next({
        context: mockContext,
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.complete',
        status: 'completed',
        message: 'Done',
        progress: 100,
        step: 'complete',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEvents.length).toBe(2);
    });

    it('should filter events by source_app or mode', async () => {
      const receivedEvents: unknown[] = [];

      service
        .subscribeToTask('task-789')
        .pipe(take(1))
        .subscribe((event) => {
          receivedEvents.push(event);
        });

      // Emit event from different source without prediction mode
      eventsSubject.next({
        context: mockContext,
        source_app: 'other-app',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Other source',
        progress: 50,
        step: 'other.step',
        payload: { mode: 'other' },
        timestamp: Date.now(),
      });

      // Emit event with prediction mode (should match)
      eventsSubject.next({
        context: mockContext,
        source_app: 'other-app',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Prediction mode',
        progress: 50,
        step: 'signal_detection.processing',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEvents.length).toBe(1);
    });

    it('should map events to PredictionStreamEvent format', async () => {
      let receivedEvent: unknown;

      service
        .subscribeToTask('task-789')
        .pipe(take(1))
        .subscribe((event) => {
          receivedEvent = event;
        });

      eventsSubject.next({
        context: mockContext,
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Test message',
        progress: 50,
        step: 'signal_detection.processing',
        payload: {
          mode: 'prediction',
          phase: 'signal_detection',
          step: 'processing',
          status: 'in_progress',
          targetId: 'target-456',
          targetSymbol: 'AAPL',
        },
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEvent).toBeDefined();
      expect((receivedEvent as Record<string, unknown>).type).toBe(
        'agent.stream.chunk',
      );
      expect((receivedEvent as Record<string, unknown>).message).toBe(
        'Test message',
      );
      expect(
        (
          (receivedEvent as Record<string, unknown>).metadata as Record<
            string,
            unknown
          >
        )?.phase,
      ).toBe('signal_detection');
      expect(
        (
          (receivedEvent as Record<string, unknown>).metadata as Record<
            string,
            unknown
          >
        )?.targetSymbol,
      ).toBe('AAPL');
    });
  });

  describe('subscribeToOrganization', () => {
    it('should filter events by orgSlug', async () => {
      const receivedEvents: unknown[] = [];

      service
        .subscribeToOrganization('test-org')
        .pipe(take(1))
        .subscribe((event) => {
          receivedEvents.push(event);
        });

      // Emit event for different org
      eventsSubject.next({
        context: { ...mockContext, orgSlug: 'other-org' },
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Other org',
        progress: 50,
        step: 'signal_detection.processing',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      // Emit event for matching org
      eventsSubject.next({
        context: mockContext,
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.chunk',
        status: 'in_progress',
        message: 'Test org',
        progress: 50,
        step: 'signal_detection.processing',
        payload: { mode: 'prediction' },
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEvents.length).toBe(1);
    });
  });

  describe('error event mapping', () => {
    it('should map error events correctly', async () => {
      let receivedEvent: unknown;

      service
        .subscribeToTask('task-789')
        .pipe(take(1))
        .subscribe((event) => {
          receivedEvent = event;
        });

      eventsSubject.next({
        context: mockContext,
        source_app: 'prediction-runner',
        hook_event_type: 'agent.stream.error',
        status: 'failed',
        message: 'Failed to process',
        progress: null,
        step: 'signal_detection.error',
        payload: {
          mode: 'prediction',
          error: 'Detailed error message',
        },
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedEvent).toBeDefined();
      expect((receivedEvent as Record<string, unknown>).type).toBe(
        'agent.stream.error',
      );
      expect((receivedEvent as Record<string, unknown>).error).toBe(
        'Detailed error message',
      );
    });
  });

  describe('full processing flow', () => {
    it('should emit events in correct sequence', () => {
      // Simulate full processing flow
      service.emitSignalDetectionStarted(mockContext, 'target-456', 'AAPL');
      service.emitSignalDetectionCompleted(
        mockContext,
        'target-456',
        5,
        'AAPL',
      );
      service.emitPredictorCreationStarted(
        mockContext,
        'target-456',
        3,
        ['gold', 'silver'],
        'AAPL',
      );
      service.emitPredictorCreationCompleted(
        mockContext,
        'target-456',
        6,
        'AAPL',
      );
      service.emitThresholdEvaluationStarted(
        mockContext,
        'target-456',
        6,
        'AAPL',
      );
      service.emitThresholdMet(mockContext, 'target-456', 'AAPL');
      service.emitPredictionGenerationStarted(
        mockContext,
        'target-456',
        'up',
        0.85,
        'AAPL',
      );
      service.emitPredictionGenerationCompleted(
        mockContext,
        mockPrediction,
        'AAPL',
      );
      service.emitSnapshotCreationStarted(mockContext, 'pred-123');
      service.emitSnapshotCreationCompleted(mockContext, 'pred-123');
      service.emitNotificationStarted(mockContext, 'pred-123', false);
      service.emitNotificationSent(mockContext, 'pred-123', ['sse']);
      service.emitComplete(mockContext, mockPrediction);

      // Verify all events were pushed
      expect(observabilityEvents.push).toHaveBeenCalledTimes(13);

      // Verify progress increases
      const calls = (observabilityEvents.push as jest.Mock).mock.calls;
      const progressValues = calls
        .map((call) => call[0].progress)
        .filter((p: number | null): p is number => p !== null);

      // Progress should generally increase (with some phases at same level)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(
          progressValues[i - 1] as number,
        );
      }

      // Final event should be 100%
      expect(calls[calls.length - 1][0].progress).toBe(100);
    });
  });
});
