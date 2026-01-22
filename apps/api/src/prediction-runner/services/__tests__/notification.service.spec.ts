import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../notification.service';
import {
  NotificationType,
  NotificationPriority,
  UserNotificationConfig,
} from '../../interfaces/notification.interface';
import { Prediction } from '../../interfaces/prediction.interface';

describe('NotificationService', () => {
  let service: NotificationService;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notify', () => {
    it('should create a notification with correct type and priority', async () => {
      const result = await service.notify({
        type: 'urgent_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
        context: {
          targetId: mockPrediction.target_id,
          targetSymbol: 'AAPL',
        },
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('urgent_prediction');
      expect(result.priority).toBe('critical');
      expect(result.userId).toBe('user-123');
      expect(result.organizationSlug).toBe('test-org');
      expect(result.data.prediction?.id).toBe('pred-123');
    });

    it('should use default priority mapping for each notification type', async () => {
      const types: [NotificationType, NotificationPriority][] = [
        ['urgent_prediction', 'critical'],
        ['new_prediction', 'high'],
        ['prediction_resolved', 'medium'],
        ['review_pending', 'high'],
        ['learning_suggested', 'medium'],
        ['missed_opportunity', 'low'],
      ];

      for (const [type, expectedPriority] of types) {
        const result = await service.notify({
          type,
          userId: 'user-123',
          organizationSlug: 'test-org',
        });

        expect(result.priority).toBe(expectedPriority);
      }
    });

    it('should allow priority override', async () => {
      const result = await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
        priorityOverride: 'critical',
      });

      expect(result.priority).toBe('critical');
    });

    it('should generate correct title and message for urgent_prediction', async () => {
      const result = await service.notify({
        type: 'urgent_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
        context: { targetSymbol: 'AAPL' },
      });

      expect(result.title).toBe('Urgent Prediction');
      expect(result.message).toContain('UP');
      expect(result.message).toContain('AAPL');
      expect(result.message).toContain('85%');
    });

    it('should generate correct title and message for prediction_resolved', async () => {
      const resolvedPrediction = {
        ...mockPrediction,
        status: 'resolved' as const,
        outcome_value: 5.5,
      };

      const result = await service.notify({
        type: 'prediction_resolved',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: resolvedPrediction,
        context: { targetSymbol: 'AAPL' },
      });

      expect(result.title).toBe('Prediction Resolved');
      expect(result.message).toContain('AAPL');
      expect(result.message).toContain('+5.50%');
    });

    it('should generate correct action URL based on notification type', async () => {
      const result = await service.notify({
        type: 'urgent_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
      });

      expect(result.data.actionUrl).toBe(`/predictions/${mockPrediction.id}`);
    });

    it('should use custom message when provided', async () => {
      const customMessage = 'This is a custom notification message';

      const result = await service.notify({
        type: 'urgent_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        customMessage,
      });

      expect(result.message).toBe(customMessage);
    });

    it('should deliver to SSE subscribers', async () => {
      const received: unknown[] = [];
      const unsubscribe = service.subscribeSSE('user-123', (notification) => {
        received.push(notification);
      });

      await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
      });

      expect(received.length).toBe(1);

      unsubscribe();
    });

    it('should filter channels by user preferences', async () => {
      // Set user config to only enable SSE
      service.updateUserConfig({
        userId: 'user-123',
        channels: {
          push: { enabled: false },
          sms: { enabled: false },
          email: { enabled: false },
          sse: { enabled: true },
        },
      });

      const result = await service.notify({
        type: 'urgent_prediction', // Would normally use push, sms, sse
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
      });

      // Only SSE should be in delivery results
      const channels = result.deliveryResults.map((r) => r.channel);
      expect(channels).toContain('sse');
      expect(channels).not.toContain('push');
      expect(channels).not.toContain('sms');
    });
  });

  describe('notifyUrgentPrediction', () => {
    it('should create urgent prediction notification with critical priority', async () => {
      const result = await service.notifyUrgentPrediction(
        'user-123',
        'test-org',
        mockPrediction,
        'AAPL',
      );

      expect(result.type).toBe('urgent_prediction');
      expect(result.priority).toBe('critical');
      expect(result.data.context?.targetSymbol).toBe('AAPL');
    });
  });

  describe('notifyNewPrediction', () => {
    it('should create new prediction notification', async () => {
      const result = await service.notifyNewPrediction(
        'user-123',
        'test-org',
        mockPrediction,
        'BTC',
      );

      expect(result.type).toBe('new_prediction');
      expect(result.priority).toBe('high');
      expect(result.data.context?.targetSymbol).toBe('BTC');
    });
  });

  describe('notifyPredictionResolved', () => {
    it('should create prediction resolved notification', async () => {
      const resolvedPrediction = {
        ...mockPrediction,
        status: 'resolved' as const,
        outcome_value: -2.5,
      };

      const result = await service.notifyPredictionResolved(
        'user-123',
        'test-org',
        resolvedPrediction,
        'ETH',
      );

      expect(result.type).toBe('prediction_resolved');
      expect(result.message).toContain('-2.50%');
    });
  });

  describe('notifyReviewPending', () => {
    it('should create review pending notification', async () => {
      const reviewItem = {
        id: 'review-123',
        signalId: 'signal-456',
        signalSummary: 'Breaking news about earnings',
        confidence: 0.55,
      };

      const result = await service.notifyReviewPending(
        'user-123',
        'test-org',
        reviewItem,
      );

      expect(result.type).toBe('review_pending');
      expect(result.priority).toBe('high');
      expect(result.data.reviewItem?.id).toBe('review-123');
      expect(result.data.actionUrl).toBe(
        '/predictions/review-queue/review-123',
      );
    });
  });

  describe('notifyLearningSuggested', () => {
    it('should create learning suggested notification', async () => {
      const learningSuggestion = {
        id: 'learning-123',
        type: 'pattern',
        content: 'System tends to underestimate magnitude for tech stocks',
        sourceType: 'evaluation',
      };

      const result = await service.notifyLearningSuggested(
        'user-123',
        'test-org',
        learningSuggestion,
      );

      expect(result.type).toBe('learning_suggested');
      expect(result.priority).toBe('medium');
      expect(result.data.learningSuggestion?.id).toBe('learning-123');
    });
  });

  describe('notifyMissedOpportunity', () => {
    it('should create missed opportunity notification', async () => {
      const missedOpportunity = {
        id: 'miss-123',
        targetId: 'target-456',
        targetSymbol: 'NVDA',
        movePercent: 15.5,
        direction: 'up',
        detectedAt: '2026-01-09T12:00:00Z',
      };

      const result = await service.notifyMissedOpportunity(
        'user-123',
        'test-org',
        missedOpportunity,
      );

      expect(result.type).toBe('missed_opportunity');
      expect(result.priority).toBe('low');
      expect(result.message).toContain('+15.50%');
      expect(result.data.missedOpportunity?.targetSymbol).toBe('NVDA');
    });
  });

  describe('SSE subscriptions', () => {
    it('should allow multiple subscribers for same user', async () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      const unsub1 = service.subscribeSSE('user-123', (n) => received1.push(n));
      const unsub2 = service.subscribeSSE('user-123', (n) => received2.push(n));

      await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(received1.length).toBe(1);
      expect(received2.length).toBe(1);

      unsub1();
      unsub2();
    });

    it('should not deliver to other users', async () => {
      const receivedUser1: unknown[] = [];
      const receivedUser2: unknown[] = [];

      const unsub1 = service.subscribeSSE('user-123', (n) =>
        receivedUser1.push(n),
      );
      const unsub2 = service.subscribeSSE('user-456', (n) =>
        receivedUser2.push(n),
      );

      await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(receivedUser1.length).toBe(1);
      expect(receivedUser2.length).toBe(0);

      unsub1();
      unsub2();
    });

    it('should properly unsubscribe', async () => {
      const received: unknown[] = [];

      const unsubscribe = service.subscribeSSE('user-123', (n) =>
        received.push(n),
      );

      await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(received.length).toBe(1);

      unsubscribe();

      await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(received.length).toBe(1); // Still 1, no new notifications
    });
  });

  describe('user config management', () => {
    it('should store and retrieve user config', () => {
      const config: UserNotificationConfig = {
        userId: 'user-123',
        channels: {
          push: { enabled: true },
          sms: { enabled: false },
          email: { enabled: true },
          sse: { enabled: true },
        },
        timezone: 'America/New_York',
      };

      service.updateUserConfig(config);

      const retrieved = service.getUserConfig('user-123');
      expect(retrieved).toEqual(config);
    });

    it('should return undefined for unknown user', () => {
      const result = service.getUserConfig('unknown-user');
      expect(result).toBeUndefined();
    });
  });

  describe('delivery status', () => {
    it('should report delivered status when all channels succeed', async () => {
      const result = await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
        prediction: mockPrediction,
      });

      // All placeholders return success
      expect(result.status).toBe('delivered');
      expect(result.deliveryResults.every((r) => r.success)).toBe(true);
    });

    it('should include delivery timestamps', async () => {
      const result = await service.notify({
        type: 'new_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      for (const delivery of result.deliveryResults) {
        expect(delivery.deliveredAt).toBeDefined();
        expect(delivery.messageId).toBeDefined();
      }
    });
  });

  describe('channel override', () => {
    it('should use channel override when provided', async () => {
      const result = await service.notify({
        type: 'urgent_prediction', // Default: push, sms, sse
        userId: 'user-123',
        organizationSlug: 'test-org',
        channelOverrides: ['email'], // Override to only email
      });

      expect(result.deliveryResults.length).toBe(1);
      expect(result.deliveryResults[0]?.channel).toBe('email');
    });
  });

  describe('expiration', () => {
    it('should not set expiration for critical priority', async () => {
      const result = await service.notify({
        type: 'urgent_prediction',
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(result.expiresAt).toBeUndefined();
    });

    it('should set expiration for non-critical priority', async () => {
      const result = await service.notify({
        type: 'missed_opportunity', // low priority
        userId: 'user-123',
        organizationSlug: 'test-org',
      });

      expect(result.expiresAt).toBeDefined();
    });
  });
});
