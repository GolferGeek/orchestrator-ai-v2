/**
 * Tool Request Handler Tests
 *
 * Tests for the tool request dashboard handler, including:
 * - List action with filtering, sorting, and pagination
 * - Get action for individual tool requests
 * - Create action for new tool requests
 * - UpdateStatus action for workflow progression
 */

import { Test } from '@nestjs/testing';
import { ToolRequestHandler } from '../tool-request.handler';
import { ToolRequestService } from '../../../services/tool-request.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type {
  ToolRequest,
  ToolRequestStatus as _ToolRequestStatus,
  ToolRequestPriority as _ToolRequestPriority,
  ToolRequestType as _ToolRequestType,
} from '../../../interfaces/tool-request.interface';

describe('ToolRequestHandler', () => {
  let handler: ToolRequestHandler;
  let toolRequestService: jest.Mocked<ToolRequestService>;

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

  const mockToolRequest: ToolRequest = {
    id: 'tool-request-1',
    universe_id: 'universe-1',
    missed_opportunity_id: 'miss-1',
    type: 'source' as const,
    name: 'Earnings Calendar Integration',
    description: 'Add earnings calendar to track upcoming reports',
    rationale: 'Missed opportunity due to surprise earnings',
    suggested_url: 'https://api.earningscalendar.com',
    suggested_config: { api_key: 'placeholder' },
    priority: 'high' as const,
    status: 'wishlist' as const,
    resolution_notes: null,
    resolved_at: null,
    resolved_by_user_id: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(async () => {
    const mockToolRequestService = {
      findAll: jest.fn(),
      findByStatus: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ToolRequestHandler,
        {
          provide: ToolRequestService,
          useValue: mockToolRequestService,
        },
      ],
    }).compile();

    handler = moduleRef.get<ToolRequestHandler>(ToolRequestHandler);
    toolRequestService = moduleRef.get(ToolRequestService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('updateStatus');
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
    it('should list all tool requests without filters', async () => {
      toolRequestService.findAll.mockResolvedValue([mockToolRequest]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.findAll).toHaveBeenCalledWith(undefined);
      const data = result.data as ToolRequest[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('tool-request-1');
    });

    it('should filter by universeId', async () => {
      toolRequestService.findAll.mockResolvedValue([mockToolRequest]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.findAll).toHaveBeenCalledWith('universe-1');
    });

    it('should filter by universeId from filters', async () => {
      toolRequestService.findAll.mockResolvedValue([mockToolRequest]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { universeId: 'universe-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.findAll).toHaveBeenCalledWith('universe-1');
    });

    it('should filter by status using findByStatus', async () => {
      const wishlistRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'wishlist' as const,
      };
      toolRequestService.findByStatus.mockResolvedValue([wishlistRequest]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { status: 'wishlist' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.findByStatus).toHaveBeenCalledWith(
        'wishlist',
        undefined,
      );
      const data = result.data as ToolRequest[];
      expect(data).toHaveLength(1);
      expect(data[0]?.status).toBe('wishlist');
    });

    it('should filter by type', async () => {
      const requests: ToolRequest[] = [
        { ...mockToolRequest, type: 'source' as const },
        { ...mockToolRequest, id: 'tool-request-2', type: 'api' as const },
      ];
      toolRequestService.findAll.mockResolvedValue(requests);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { type: 'source' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ToolRequest[];
      expect(data).toHaveLength(1);
      expect(data[0]?.type).toBe('source');
    });

    it('should filter by priority', async () => {
      const requests: ToolRequest[] = [
        { ...mockToolRequest, priority: 'high' as const },
        { ...mockToolRequest, id: 'tool-request-2', priority: 'low' as const },
      ];
      toolRequestService.findAll.mockResolvedValue(requests);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { priority: 'high' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ToolRequest[];
      expect(data).toHaveLength(1);
      expect(data[0]?.priority).toBe('high');
    });

    it('should sort by priority and created date', async () => {
      const requests: ToolRequest[] = [
        {
          ...mockToolRequest,
          id: 'tool-1',
          priority: 'medium' as const,
          created_at: '2024-01-10T10:00:00Z',
        },
        {
          ...mockToolRequest,
          id: 'tool-2',
          priority: 'critical' as const,
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          ...mockToolRequest,
          id: 'tool-3',
          priority: 'high' as const,
          created_at: '2024-01-12T10:00:00Z',
        },
        {
          ...mockToolRequest,
          id: 'tool-4',
          priority: 'high' as const,
          created_at: '2024-01-14T10:00:00Z',
        },
      ];
      toolRequestService.findAll.mockResolvedValue(requests);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ToolRequest[];
      // Should be sorted: critical, high (newer), high (older), medium
      expect(data[0]?.id).toBe('tool-2'); // critical
      expect(data[1]?.id).toBe('tool-4'); // high, newer
      expect(data[2]?.id).toBe('tool-3'); // high, older
      expect(data[3]?.id).toBe('tool-1'); // medium
    });

    it('should paginate results', async () => {
      const requests: ToolRequest[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockToolRequest,
          id: `tool-request-${i}`,
          priority: 'medium' as const,
        }));
      toolRequestService.findAll.mockResolvedValue(requests);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ToolRequest[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      toolRequestService.findAll.mockResolvedValue([mockToolRequest]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle list service error', async () => {
      toolRequestService.findAll.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in list', async () => {
      toolRequestService.findAll.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list tool requests');
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

    it('should get tool request by id', async () => {
      toolRequestService.findById.mockResolvedValue(mockToolRequest);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'tool-request-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.findById).toHaveBeenCalledWith(
        'tool-request-1',
      );
      const data = result.data as ToolRequest;
      expect(data.id).toBe('tool-request-1');
      expect(data.name).toBe('Earnings Calendar Integration');
    });

    it('should return NOT_FOUND error if request does not exist', async () => {
      toolRequestService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('non-existent');
    });

    it('should handle get service error', async () => {
      toolRequestService.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'tool-request-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      toolRequestService.findById.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'tool-request-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get tool request');
    });
  });

  describe('execute - create action', () => {
    it('should return error if universe_id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test Tool',
          description: 'Test description',
          rationale: 'Test rationale',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('universe_id');
    });

    it('should return error if name is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          description: 'Test description',
          rationale: 'Test rationale',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('name');
    });

    it('should return error if description is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Test Tool',
          rationale: 'Test rationale',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('description');
    });

    it('should return error if rationale is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Test Tool',
          description: 'Test description',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('rationale');
    });

    it('should return error if type is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Test Tool',
          description: 'Test description',
          rationale: 'Test rationale',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('type');
    });

    it('should create tool request with required fields only', async () => {
      toolRequestService.create.mockResolvedValue(mockToolRequest);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Earnings Calendar Integration',
          description: 'Add earnings calendar to track upcoming reports',
          rationale: 'Missed opportunity due to surprise earnings',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.create).toHaveBeenCalledWith({
        universe_id: 'universe-1',
        name: 'Earnings Calendar Integration',
        description: 'Add earnings calendar to track upcoming reports',
        rationale: 'Missed opportunity due to surprise earnings',
        type: 'source',
        missed_opportunity_id: undefined,
        suggested_url: undefined,
        suggested_config: undefined,
        priority: 'medium',
        status: 'wishlist',
      });
      const data = result.data as ToolRequest;
      expect(data.id).toBe('tool-request-1');
    });

    it('should create tool request with all fields', async () => {
      toolRequestService.create.mockResolvedValue(mockToolRequest);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          missed_opportunity_id: 'miss-1',
          name: 'Earnings Calendar Integration',
          description: 'Add earnings calendar to track upcoming reports',
          rationale: 'Missed opportunity due to surprise earnings',
          type: 'source',
          suggested_url: 'https://api.earningscalendar.com',
          suggested_config: { api_key: 'placeholder' },
          priority: 'high',
          status: 'planned',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(toolRequestService.create).toHaveBeenCalledWith({
        universe_id: 'universe-1',
        missed_opportunity_id: 'miss-1',
        name: 'Earnings Calendar Integration',
        description: 'Add earnings calendar to track upcoming reports',
        rationale: 'Missed opportunity due to surprise earnings',
        type: 'source',
        suggested_url: 'https://api.earningscalendar.com',
        suggested_config: { api_key: 'placeholder' },
        priority: 'high',
        status: 'planned',
      });
    });

    it('should handle create service error', async () => {
      toolRequestService.create.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Test Tool',
          description: 'Test description',
          rationale: 'Test rationale',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in create', async () => {
      toolRequestService.create.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universe_id: 'universe-1',
          name: 'Test Tool',
          description: 'Test description',
          rationale: 'Test rationale',
          type: 'source',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Failed to create tool request');
    });
  });

  describe('execute - updateStatus action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { status: 'planned' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('id');
    });

    it('should return error if status is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('status');
    });

    it('should return error for invalid status', async () => {
      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'invalid' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_STATUS');
      expect(result.error?.message).toContain('invalid');
      expect(result.error?.message).toContain('wishlist');
      expect(result.error?.message).toContain('planned');
      expect(result.error?.message).toContain('in_progress');
      expect(result.error?.message).toContain('done');
      expect(result.error?.message).toContain('rejected');
    });

    it('should update status to planned', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'planned' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'planned' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalledWith(
        'tool-request-1',
        'planned',
        'test-user',
        undefined,
      );
      const data = result.data as {
        request: ToolRequest;
        message: string;
      };
      expect(data.request.status).toBe('planned');
      expect(data.message).toContain('planned');
    });

    it('should update status to in_progress', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'in_progress' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'in_progress' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalledWith(
        'tool-request-1',
        'in_progress',
        'test-user',
        undefined,
      );
    });

    it('should update status to done', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'done' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'done' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalledWith(
        'tool-request-1',
        'done',
        'test-user',
        undefined,
      );
    });

    it('should update status to rejected', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'rejected' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'rejected' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalledWith(
        'tool-request-1',
        'rejected',
        'test-user',
        undefined,
      );
    });

    it('should update status with notes', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'done' as const,
        resolution_notes: 'Implemented successfully',
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: {
          id: 'tool-request-1',
          status: 'done',
          notes: 'Implemented successfully',
        },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalledWith(
        'tool-request-1',
        'done',
        'test-user',
        'Implemented successfully',
      );
    });

    it('should handle update-status action (kebab-case)', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'planned' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'update-status',
        params: { id: 'tool-request-1', status: 'planned' },
      };
      const result = await handler.execute(
        'update-status',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(toolRequestService.updateStatus).toHaveBeenCalled();
    });

    it('should handle updateStatus service error', async () => {
      toolRequestService.updateStatus.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'planned' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_STATUS_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in updateStatus', async () => {
      toolRequestService.updateStatus.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'updateStatus',
        params: { id: 'tool-request-1', status: 'planned' },
      };
      const result = await handler.execute(
        'updateStatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_STATUS_FAILED');
      expect(result.error?.message).toBe(
        'Failed to update tool request status',
      );
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      toolRequestService.findAll.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      toolRequestService.findById.mockResolvedValue(mockToolRequest);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'tool-request-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle updatestatus (lowercase)', async () => {
      const updatedRequest: ToolRequest = {
        ...mockToolRequest,
        status: 'planned' as const,
      };
      toolRequestService.updateStatus.mockResolvedValue(updatedRequest);

      const payload: DashboardRequestPayload = {
        action: 'updatestatus',
        params: { id: 'tool-request-1', status: 'planned' },
      };
      const result = await handler.execute(
        'updatestatus',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
    });
  });
});
