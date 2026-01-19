import { Test, TestingModule } from '@nestjs/testing';
import { AlertHandler } from '../alert.handler';
import { RiskAlertService } from '../../../services/risk-alert.service';
import { AlertRepository } from '../../../repositories/alert.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  RiskAlert,
  UnacknowledgedAlertView,
} from '../../../interfaces/alert.interface';

describe('AlertHandler', () => {
  let handler: AlertHandler;
  let alertService: jest.Mocked<RiskAlertService>;

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'investment-risk-agent',
    agentType: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockAlert: RiskAlert = {
    id: 'alert-123',
    subject_id: 'subject-123',
    composite_score_id: 'score-123',
    alert_type: 'threshold_breach',
    severity: 'warning',
    title: 'Elevated risk level for AAPL',
    message: 'Risk score 65 exceeds warning threshold 60',
    details: {
      threshold: 60,
      actual_score: 65,
    },
    acknowledged_at: null,
    acknowledged_by: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  const mockUnacknowledgedAlertView: UnacknowledgedAlertView = {
    ...mockAlert,
    subject_identifier: 'AAPL',
    subject_name: 'Apple Inc.',
    scope_name: 'US Tech Stocks',
  };

  const createPayload = (
    action: string,
    params?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number },
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
    pagination,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertHandler,
        {
          provide: RiskAlertService,
          useValue: {
            getAlertsBySubject: jest.fn(),
            getUnacknowledgedAlerts: jest.fn(),
            getUnacknowledgedBySubject: jest.fn(),
            getAlertById: jest.fn(),
            acknowledgeAlert: jest.fn(),
            countUnacknowledgedBySeverity: jest.fn(),
          },
        },
        {
          provide: AlertRepository,
          useValue: {
            findBySubject: jest.fn(),
            findUnacknowledged: jest.fn(),
            findById: jest.fn(),
            acknowledge: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<AlertHandler>(AlertHandler);
    alertService = module.get(RiskAlertService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('getBySubject');
      expect(actions).toContain('getUnacknowledged');
      expect(actions).toContain('acknowledge');
      expect(actions).toContain('countBySeverity');
    });
  });

  describe('execute - list', () => {
    it('should return unacknowledged alerts when no subjectId provided', async () => {
      alertService.getUnacknowledgedAlerts.mockResolvedValue([
        mockUnacknowledgedAlertView,
      ]);

      const payload = createPayload('alerts.list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(alertService.getUnacknowledgedAlerts).toHaveBeenCalled();
    });

    it('should return alerts for subject when subjectId provided', async () => {
      alertService.getAlertsBySubject.mockResolvedValue([mockAlert]);

      const payload = createPayload('alerts.list', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(alertService.getAlertsBySubject).toHaveBeenCalledWith(
        'subject-123',
        expect.any(Object),
      );
    });

    it('should apply pagination', async () => {
      const alerts = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockUnacknowledgedAlertView, id: `alert-${i}` }));
      alertService.getUnacknowledgedAlerts.mockResolvedValue(alerts);

      const payload = createPayload(
        'alerts.list',
        {},
        { page: 2, pageSize: 10 },
      );
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.totalCount).toBe(25);
    });

    it('should respect includeTest filter', async () => {
      alertService.getUnacknowledgedAlerts.mockResolvedValue([]);

      const payload = createPayload('alerts.list', { includeTest: true });
      await handler.execute('list', payload, mockExecutionContext);

      expect(alertService.getUnacknowledgedAlerts).toHaveBeenCalledWith({
        includeTest: true,
        testScenarioId: undefined,
      });
    });
  });

  describe('execute - get', () => {
    it('should return an alert by ID', async () => {
      alertService.getAlertById.mockResolvedValue(mockAlert);

      const payload = createPayload('alerts.get', { id: 'alert-123' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAlert);
      expect(alertService.getAlertById).toHaveBeenCalledWith('alert-123');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('alerts.get');
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when alert not found', async () => {
      alertService.getAlertById.mockResolvedValue(null);

      const payload = createPayload('alerts.get', { id: 'nonexistent' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - getBySubject', () => {
    it('should return alerts for a subject', async () => {
      alertService.getAlertsBySubject.mockResolvedValue([mockAlert]);

      const payload = createPayload('alerts.getBySubject', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'getBySubject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(alertService.getAlertsBySubject).toHaveBeenCalledWith(
        'subject-123',
        expect.any(Object),
      );
    });

    it('should return only unacknowledged when includeAcknowledged is false', async () => {
      alertService.getUnacknowledgedBySubject.mockResolvedValue([mockAlert]);

      const payload = createPayload('alerts.getBySubject', {
        subjectId: 'subject-123',
        includeAcknowledged: false,
      });
      const result = await handler.execute(
        'getBySubject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(alertService.getUnacknowledgedBySubject).toHaveBeenCalledWith(
        'subject-123',
        expect.any(Object),
      );
    });

    it('should return error when subjectId is missing', async () => {
      const payload = createPayload('alerts.getBySubject');
      const result = await handler.execute(
        'getBySubject',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SUBJECT_ID');
    });
  });

  describe('execute - getUnacknowledged', () => {
    it('should return all unacknowledged alerts', async () => {
      alertService.getUnacknowledgedAlerts.mockResolvedValue([
        mockUnacknowledgedAlertView,
      ]);

      const payload = createPayload('alerts.getUnacknowledged');
      const result = await handler.execute(
        'getUnacknowledged',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(alertService.getUnacknowledgedAlerts).toHaveBeenCalled();
    });

    it('should apply pagination to unacknowledged alerts', async () => {
      const alerts = Array(30)
        .fill(null)
        .map((_, i) => ({ ...mockUnacknowledgedAlertView, id: `alert-${i}` }));
      alertService.getUnacknowledgedAlerts.mockResolvedValue(alerts);

      const payload = createPayload(
        'alerts.getUnacknowledged',
        {},
        { page: 1, pageSize: 10 },
      );
      const result = await handler.execute(
        'getUnacknowledged',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(30);
      expect(result.metadata?.hasMore).toBe(true);
    });
  });

  describe('execute - acknowledge', () => {
    it('should acknowledge an alert', async () => {
      const acknowledgedAlert = {
        ...mockAlert,
        acknowledged_at: '2026-01-15T12:00:00Z',
        acknowledged_by: 'user-123',
      };
      alertService.acknowledgeAlert.mockResolvedValue(acknowledgedAlert);

      const payload = createPayload('alerts.acknowledge', { id: 'alert-123' });
      const result = await handler.execute(
        'acknowledge',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(acknowledgedAlert);
      expect(result.metadata?.message).toBe('Alert acknowledged successfully');
      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith(
        'alert-123',
        'user-123',
      );
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('alerts.acknowledge');
      const result = await handler.execute(
        'acknowledge',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when alert not found', async () => {
      alertService.acknowledgeAlert.mockRejectedValue(
        new Error('Alert not found: nonexistent'),
      );

      const payload = createPayload('alerts.acknowledge', {
        id: 'nonexistent',
      });
      const result = await handler.execute(
        'acknowledge',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should use userId from execution context', async () => {
      alertService.acknowledgeAlert.mockResolvedValue({
        ...mockAlert,
        acknowledged_at: '2026-01-15T12:00:00Z',
        acknowledged_by: 'user-123',
      });

      const payload = createPayload('alerts.acknowledge', { id: 'alert-123' });
      await handler.execute('acknowledge', payload, mockExecutionContext);

      expect(alertService.acknowledgeAlert).toHaveBeenCalledWith(
        'alert-123',
        mockExecutionContext.userId,
      );
    });
  });

  describe('execute - countBySeverity', () => {
    it('should return counts by severity', async () => {
      alertService.countUnacknowledgedBySeverity.mockResolvedValue({
        critical: 2,
        warning: 5,
        info: 3,
      });

      const payload = createPayload('alerts.countBySeverity');
      const result = await handler.execute(
        'countBySeverity',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ critical: 2, warning: 5, info: 3 });
      expect(result.metadata?.totalCount).toBe(10);
    });

    it('should pass includeTest filter', async () => {
      alertService.countUnacknowledgedBySeverity.mockResolvedValue({
        critical: 0,
        warning: 0,
        info: 0,
      });

      const payload = createPayload('alerts.countBySeverity', {
        includeTest: true,
      });
      await handler.execute('countBySeverity', payload, mockExecutionContext);

      expect(alertService.countUnacknowledgedBySeverity).toHaveBeenCalledWith({
        includeTest: true,
      });
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('alerts.unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });
});
