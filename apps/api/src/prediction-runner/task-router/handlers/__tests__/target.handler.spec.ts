/**
 * Target Handler Tests
 *
 * Tests for the target dashboard handler, including:
 * - List action for targets by universe
 * - Get action for individual targets
 * - Create action for new targets
 * - Update action for modifying targets
 * - Delete action for removing targets
 */

import { Test } from '@nestjs/testing';
import { TargetHandler } from '../target.handler';
import { TargetService } from '../../../services/target.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('TargetHandler', () => {
  let handler: TargetHandler;
  let targetService: jest.Mocked<TargetService>;

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

  const mockLlmConfig = {
    gold: { provider: 'anthropic', model: 'claude-opus-4' },
    silver: { provider: 'anthropic', model: 'claude-sonnet-4' },
    bronze: { provider: 'anthropic', model: 'claude-haiku-3' },
  };

  beforeEach(async () => {
    const mockTargetService = {
      findByUniverse: jest.fn(),
      findActiveByUniverse: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getEffectiveLlmConfig: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TargetHandler,
        {
          provide: TargetService,
          useValue: mockTargetService,
        },
      ],
    }).compile();

    handler = moduleRef.get<TargetHandler>(TargetHandler);
    targetService = moduleRef.get(TargetService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
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
    });
  });

  describe('execute - list action', () => {
    it('should return error if universeId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_UNIVERSE_ID');
    });

    it('should list active targets by universe', async () => {
      targetService.findActiveByUniverse.mockResolvedValue([mockTarget]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.findActiveByUniverse).toHaveBeenCalledWith(
        'universe-1',
      );
    });

    it('should accept universeId from filters', async () => {
      targetService.findActiveByUniverse.mockResolvedValue([mockTarget]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { universeId: 'universe-1' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should list all targets when isActive is false', async () => {
      targetService.findByUniverse.mockResolvedValue([mockTarget]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1', filters: { isActive: false } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.findByUniverse).toHaveBeenCalledWith('universe-1');
    });

    it('should filter by targetType', async () => {
      const targets = [
        { ...mockTarget, target_type: 'stock' as const },
        { ...mockTarget, id: 'target-2', target_type: 'crypto' as const },
      ];
      targetService.findActiveByUniverse.mockResolvedValue(targets);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1', filters: { targetType: 'stock' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof targets;
      expect(data).toHaveLength(1);
      expect(data[0]?.target_type).toBe('stock');
    });

    it('should paginate results', async () => {
      const targets = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockTarget, id: `target-${i}` }));
      targetService.findActiveByUniverse.mockResolvedValue(targets);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1', page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof targets;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
    });

    it('should handle list service error', async () => {
      targetService.findActiveByUniverse.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { universeId: 'universe-1' },
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

    it('should get target by id with effective LLM config', async () => {
      targetService.findById.mockResolvedValue(mockTarget);
      targetService.getEffectiveLlmConfig.mockResolvedValue(mockLlmConfig);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'target-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.findById).toHaveBeenCalledWith('target-1');
      expect(targetService.getEffectiveLlmConfig).toHaveBeenCalledWith(
        mockTarget,
      );
      const data = result.data as {
        id: string;
        effectiveLlmConfig: typeof mockLlmConfig;
      };
      expect(data.effectiveLlmConfig).toBeDefined();
    });

    it('should return NOT_FOUND error if target does not exist', async () => {
      targetService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      targetService.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'target-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - create action', () => {
    it('should return error if required fields are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should create target successfully', async () => {
      targetService.create.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universeId: 'universe-1',
          symbol: 'AAPL',
          name: 'Apple Inc',
          targetType: 'stock',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.create).toHaveBeenCalledWith({
        universe_id: 'universe-1',
        symbol: 'AAPL',
        name: 'Apple Inc',
        target_type: 'stock',
        context: undefined,
        is_active: true,
        llm_config_override: undefined,
        metadata: undefined,
      });
    });

    it('should create target with all optional fields', async () => {
      targetService.create.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universeId: 'universe-1',
          symbol: 'AAPL',
          name: 'Apple Inc',
          targetType: 'stock',
          context: 'Tech company',
          isActive: false,
          llmConfigOverride: mockLlmConfig,
          metadata: { sector: 'technology' },
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.create).toHaveBeenCalledWith({
        universe_id: 'universe-1',
        symbol: 'AAPL',
        name: 'Apple Inc',
        target_type: 'stock',
        context: 'Tech company',
        is_active: false,
        llm_config_override: mockLlmConfig,
        metadata: { sector: 'technology' },
      });
    });

    it('should handle create service error', async () => {
      targetService.create.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          universeId: 'universe-1',
          symbol: 'AAPL',
          name: 'Apple Inc',
          targetType: 'stock',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
    });
  });

  describe('execute - update action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should update target successfully', async () => {
      const updatedTarget = { ...mockTarget, name: 'New Name' };
      targetService.update.mockResolvedValue(updatedTarget);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'target-1', name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.update).toHaveBeenCalledWith('target-1', {
        name: 'New Name',
      });
    });

    it('should update target with multiple fields', async () => {
      targetService.update.mockResolvedValue(mockTarget);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'target-1',
          name: 'New Name',
          context: 'New context',
          isActive: false,
          llmConfigOverride: mockLlmConfig,
          metadata: { updated: true },
        },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.update).toHaveBeenCalledWith('target-1', {
        name: 'New Name',
        context: 'New context',
        is_active: false,
        llm_config_override: mockLlmConfig,
        metadata: { updated: true },
      });
    });

    it('should handle update service error', async () => {
      targetService.update.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'target-1', name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_FAILED');
    });
  });

  describe('execute - delete action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: {},
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should delete target successfully', async () => {
      targetService.delete.mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'target-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetService.delete).toHaveBeenCalledWith('target-1');
      const data = result.data as { deleted: boolean; id: string };
      expect(data.deleted).toBe(true);
      expect(data.id).toBe('target-1');
    });

    it('should handle delete service error', async () => {
      targetService.delete.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'target-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      targetService.findActiveByUniverse.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
