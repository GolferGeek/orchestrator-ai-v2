/**
 * Universe Handler Tests
 *
 * Tests for the universe dashboard handler, including:
 * - List action for universes by agent
 * - Get action for individual universes
 * - Create action for new universes
 * - Update action for modifying universes
 * - Delete action for removing universes
 */

import { Test } from '@nestjs/testing';
import { UniverseHandler } from '../universe.handler';
import { UniverseService } from '../../../services/universe.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('UniverseHandler', () => {
  let handler: UniverseHandler;
  let universeService: jest.Mocked<UniverseService>;

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

  const mockLlmConfig = {
    gold: { provider: 'anthropic', model: 'claude-opus-4' },
    silver: { provider: 'anthropic', model: 'claude-sonnet-4' },
    bronze: { provider: 'anthropic', model: 'claude-haiku-3' },
  };

  const mockThresholds = {
    min_predictors: 3,
    min_combined_strength: 15,
    min_direction_consensus: 0.6,
    predictor_ttl_hours: 24,
  };

  const mockNotificationConfig = {
    urgent_enabled: true,
    new_prediction_enabled: true,
    outcome_enabled: true,
    channels: ['push', 'email', 'sse'] as ('push' | 'sms' | 'email' | 'sse')[],
  };

  const mockUniverse = {
    id: 'universe-1',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Tech Stocks',
    description: 'Technology sector stocks',
    domain: 'stocks' as const,
    strategy_id: 'strategy-1',
    is_active: true,
    thresholds: mockThresholds,
    llm_config: mockLlmConfig,
    notification_config: mockNotificationConfig,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockCryptoUniverse = {
    id: 'universe-2',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Crypto Markets',
    description: 'Cryptocurrency markets',
    domain: 'crypto' as const,
    strategy_id: 'strategy-2',
    is_active: true,
    thresholds: mockThresholds,
    llm_config: null,
    notification_config: mockNotificationConfig,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockInactiveUniverse = {
    id: 'universe-3',
    organization_slug: 'test-org',
    agent_slug: 'prediction-runner',
    name: 'Inactive Universe',
    description: 'Test inactive universe',
    domain: 'elections' as const,
    strategy_id: null,
    is_active: false,
    thresholds: null,
    llm_config: null,
    notification_config: mockNotificationConfig,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const mockUniverseService = {
      findByAgent: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UniverseHandler,
        {
          provide: UniverseService,
          useValue: mockUniverseService,
        },
      ],
    }).compile();

    handler = moduleRef.get<UniverseHandler>(UniverseHandler);
    universeService = moduleRef.get(UniverseService);
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
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('execute - list action', () => {
    it('should list universes for agent', async () => {
      universeService.findByAgent.mockResolvedValue([
        mockUniverse,
        mockCryptoUniverse,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.findByAgent).toHaveBeenCalledWith(
        'prediction-runner',
        'test-org',
      );
      const data = result.data as (typeof mockUniverse)[];
      expect(data).toHaveLength(2);
    });

    it('should filter by domain', async () => {
      universeService.findByAgent.mockResolvedValue([
        mockUniverse,
        mockCryptoUniverse,
        mockInactiveUniverse,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { domain: 'stocks' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as (typeof mockUniverse)[];
      expect(data).toHaveLength(1);
      expect(data[0]?.domain).toBe('stocks');
    });

    it('should paginate results with default page and pageSize', async () => {
      const universes = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockUniverse,
          id: `universe-${i}`,
          name: `Universe ${i}`,
        }));
      universeService.findByAgent.mockResolvedValue(universes);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof universes;
      expect(data).toHaveLength(20);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should paginate results with custom page and pageSize', async () => {
      const universes = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockUniverse,
          id: `universe-${i}`,
          name: `Universe ${i}`,
        }));
      universeService.findByAgent.mockResolvedValue(universes);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof universes;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should return empty array when no universes found', async () => {
      universeService.findByAgent.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as (typeof mockUniverse)[];
      expect(data).toHaveLength(0);
    });

    it('should handle list service error', async () => {
      universeService.findByAgent.mockRejectedValue(
        new Error('Database error'),
      );

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
      universeService.findByAgent.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list universes');
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
      expect(result.error?.message).toBe('Universe ID is required');
    });

    it('should get universe by id', async () => {
      universeService.findById.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.findById).toHaveBeenCalledWith('universe-1');
      const data = result.data as typeof mockUniverse;
      expect(data.id).toBe('universe-1');
      expect(data.name).toBe('Tech Stocks');
    });

    it('should return NOT_FOUND error if universe does not exist', async () => {
      universeService.findById.mockResolvedValue(null);

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
      universeService.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      universeService.findById.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get universe');
    });
  });

  describe('execute - create action', () => {
    it('should return error if name is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: { domain: 'stocks' },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toBe('Name and domain are required');
    });

    it('should return error if domain is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: { name: 'Test Universe' },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toBe('Name and domain are required');
    });

    it('should create universe with required fields only', async () => {
      universeService.create.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.create).toHaveBeenCalledWith({
        name: 'Tech Stocks',
        domain: 'stocks',
        organization_slug: 'test-org',
        agent_slug: 'prediction-runner',
        description: undefined,
        strategy_id: undefined,
        is_active: true,
        thresholds: undefined,
        llm_config: undefined,
        notification_config: undefined,
      });
      const data = result.data as typeof mockUniverse;
      expect(data.id).toBe('universe-1');
    });

    it('should create universe with all optional fields', async () => {
      universeService.create.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
          description: 'Technology sector stocks',
          agentSlug: 'custom-agent',
          strategyId: 'strategy-1',
          isActive: false,
          thresholds: mockThresholds,
          llmConfig: mockLlmConfig,
          notificationConfig: mockNotificationConfig,
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.create).toHaveBeenCalledWith({
        name: 'Tech Stocks',
        domain: 'stocks',
        organization_slug: 'test-org',
        agent_slug: 'custom-agent',
        description: 'Technology sector stocks',
        strategy_id: 'strategy-1',
        is_active: false,
        thresholds: mockThresholds,
        llm_config: mockLlmConfig,
        notification_config: mockNotificationConfig,
      });
    });

    it('should use context.agentSlug when agentSlug not provided in params', async () => {
      universeService.create.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_slug: 'prediction-runner',
        }),
      );
    });

    it('should default isActive to true when not provided', async () => {
      universeService.create.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        }),
      );
    });

    it('should handle create service error', async () => {
      universeService.create.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in create', async () => {
      universeService.create.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Tech Stocks',
          domain: 'stocks',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Failed to create universe');
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
      expect(result.error?.message).toBe('Universe ID is required');
    });

    it('should update universe with name only', async () => {
      const updatedUniverse = { ...mockUniverse, name: 'New Name' };
      universeService.update.mockResolvedValue(updatedUniverse);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'universe-1', name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.update).toHaveBeenCalledWith('universe-1', {
        name: 'New Name',
      });
      const data = result.data as typeof updatedUniverse;
      expect(data.name).toBe('New Name');
    });

    it('should update universe with multiple fields', async () => {
      universeService.update.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: {
          id: 'universe-1',
          name: 'Updated Name',
          description: 'Updated description',
          domain: 'crypto',
          strategyId: 'strategy-2',
          isActive: false,
          thresholds: { min_predictors: 5 },
          llmConfig: { gold: { provider: 'openai', model: 'gpt-4' } },
          notificationConfig: {
            urgent_enabled: false,
            new_prediction_enabled: false,
            outcome_enabled: false,
            channels: ['email'],
          },
        },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.update).toHaveBeenCalledWith('universe-1', {
        name: 'Updated Name',
        description: 'Updated description',
        domain: 'crypto',
        strategy_id: 'strategy-2',
        is_active: false,
        thresholds: { min_predictors: 5 },
        llm_config: { gold: { provider: 'openai', model: 'gpt-4' } },
        notification_config: {
          urgent_enabled: false,
          new_prediction_enabled: false,
          outcome_enabled: false,
          channels: ['email'],
        },
      });
    });

    it('should only include fields that are explicitly provided', async () => {
      universeService.update.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'universe-1', description: 'New description' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.update).toHaveBeenCalledWith('universe-1', {
        description: 'New description',
      });
    });

    it('should handle update service error', async () => {
      universeService.update.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'universe-1', name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in update', async () => {
      universeService.update.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'update',
        params: { id: 'universe-1', name: 'New Name' },
      };
      const result = await handler.execute('update', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPDATE_FAILED');
      expect(result.error?.message).toBe('Failed to update universe');
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
      expect(result.error?.message).toBe('Universe ID is required');
    });

    it('should delete universe successfully', async () => {
      universeService.delete.mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(universeService.delete).toHaveBeenCalledWith('universe-1');
      const data = result.data as { deleted: boolean; id: string };
      expect(data.deleted).toBe(true);
      expect(data.id).toBe('universe-1');
    });

    it('should handle delete service error', async () => {
      universeService.delete.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in delete', async () => {
      universeService.delete.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
      expect(result.error?.message).toBe('Failed to delete universe');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      universeService.findByAgent.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      universeService.findById.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase CREATE action', async () => {
      universeService.create.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'CREATE',
        params: { name: 'Test', domain: 'stocks' },
      };
      const result = await handler.execute('CREATE', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase UPDATE action', async () => {
      universeService.update.mockResolvedValue(mockUniverse);

      const payload: DashboardRequestPayload = {
        action: 'UPDATE',
        params: { id: 'universe-1', name: 'New Name' },
      };
      const result = await handler.execute('UPDATE', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle uppercase DELETE action', async () => {
      universeService.delete.mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'DELETE',
        params: { id: 'universe-1' },
      };
      const result = await handler.execute('DELETE', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
