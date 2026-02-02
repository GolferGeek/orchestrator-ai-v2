/**
 * Audit Log Handler Tests
 *
 * Tests for the audit log dashboard handler, including:
 * - List action for audit logs with filtering
 * - Get action for individual audit log records
 * - Summary action for aggregated audit statistics
 */

import { Test } from '@nestjs/testing';
import { AuditLogHandler } from '../audit-log.handler';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('AuditLogHandler', () => {
  let handler: AuditLogHandler;
  let supabaseService: jest.Mocked<SupabaseService>;
  let mockQueryBuilder: {
    select: jest.Mock;
    eq: jest.Mock;
    gte: jest.Mock;
    lte: jest.Mock;
    order: jest.Mock;
    range: jest.Mock;
    single: jest.Mock;
  };

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

  const mockAuditLog = {
    id: 'audit-1',
    action: 'create',
    resource_type: 'prediction',
    resource_id: 'pred-1',
    user_id: 'user-1',
    org_slug: 'test-org',
    changes: { direction: { from: null, to: 'up' } },
    metadata: { ip: '127.0.0.1' },
    created_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    const mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue({
        schema: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue(mockQueryBuilder),
        }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogHandler,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    handler = moduleRef.get<AuditLogHandler>(AuditLogHandler);
    supabaseService = moduleRef.get(SupabaseService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('summary');
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
    it('should list audit logs successfully', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply action filter', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { action: 'create' } },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('action', 'create');
    });

    it('should apply resourceType filter', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { resourceType: 'prediction' } },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
        'resource_type',
        'prediction',
      );
    });

    it('should apply resourceId filter', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { resourceId: 'pred-1' } },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('resource_id', 'pred-1');
    });

    it('should apply userId filter', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { userId: 'user-1' } },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should apply date range filters', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'created_at',
        '2024-01-01',
      );
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
        'created_at',
        '2024-01-31',
      );
    });

    it('should apply pagination', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [mockAuditLog],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 25 },
      };
      await handler.execute('list', payload, mockContext);

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(25, 49);
    });

    it('should handle list database error', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
    });

    it('should handle list service error', async () => {
      mockQueryBuilder.range.mockRejectedValue(new Error('Service error'));

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
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

    it('should get audit log by id', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: mockAuditLog,
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'audit-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'audit-1');
    });

    it('should return NOT_FOUND error if audit log does not exist', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      mockQueryBuilder.single.mockRejectedValue(new Error('Service error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'audit-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - summary action', () => {
    // Use a recent timestamp that will pass the default 24-hour filter
    const recentTime = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour ago
    const mockLogs = [
      {
        action: 'create',
        resource_type: 'prediction',
        created_at: recentTime,
      },
      {
        action: 'create',
        resource_type: 'prediction',
        created_at: recentTime,
      },
      {
        action: 'update',
        resource_type: 'signal',
        created_at: recentTime,
      },
      {
        action: 'delete',
        resource_type: 'prediction',
        created_at: recentTime,
      },
    ];

    it('should return summary statistics', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        totalLogs: number;
        byAction: Record<string, number>;
        byResourceType: Record<string, number>;
        byHour: Record<string, number>;
      };
      expect(data.totalLogs).toBe(4);
      expect(data.byAction.create).toBe(2);
      expect(data.byAction.update).toBe(1);
      expect(data.byAction.delete).toBe(1);
      expect(data.byResourceType.prediction).toBe(3);
      expect(data.byResourceType.signal).toBe(1);
    });

    it('should apply startDate filter to summary', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: mockLogs,
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: { filters: { startDate: '2024-01-15T10:30:00Z' } },
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(true);
      // The filtering happens in code based on startDate
      const data = result.data as { timeRange: { start: string } };
      expect(data.timeRange.start).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle summary database error', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUMMARY_FAILED');
    });

    it('should handle summary service error', async () => {
      mockQueryBuilder.select.mockRejectedValue(new Error('Service error'));

      const payload: DashboardRequestPayload = {
        action: 'summary',
        params: {},
      };
      const result = await handler.execute('summary', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SUMMARY_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      mockQueryBuilder.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const payload: DashboardRequestPayload = {
        action: 'Summary',
        params: {},
      };
      const result = await handler.execute('Summary', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
