/**
 * Strategy Handler Tests
 *
 * Tests for the strategy dashboard handler, including:
 * - List action for strategies with filtering
 * - Get action for individual strategies by ID or slug
 * - Recommend action for strategy recommendations
 */

import { Test } from '@nestjs/testing';
import { StrategyHandler } from '../strategy.handler';
import { StrategyService } from '../../../services/strategy.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

import type { Strategy, StrategyParameters } from '../../../interfaces/strategy.interface';

describe('StrategyHandler', () => {
  let handler: StrategyHandler;
  let strategyService: jest.Mocked<StrategyService>;

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

  const mockParameters: StrategyParameters = {
    min_predictors: 3,
    min_combined_strength: 15,
    min_direction_consensus: 0.6,
    predictor_ttl_hours: 24,
    urgent_threshold: 0.9,
    notable_threshold: 0.7,
    analyst_weights: {
      'technical-tina': 1.0,
      'sentiment-sam': 0.8,
    },
    tier_preference: 'ensemble',
    custom_rules: [],
  };

  const mockStrategy: Strategy = {
    id: 'strategy-1',
    slug: 'conservative',
    name: 'Conservative Strategy',
    description: 'Low risk, steady returns',
    risk_level: 'low',
    parameters: mockParameters,
    is_system: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockAggressiveStrategy: Strategy = {
    id: 'strategy-2',
    slug: 'aggressive',
    name: 'Aggressive Strategy',
    description: 'High risk, high reward',
    risk_level: 'high',
    parameters: {
      ...mockParameters,
      analyst_weights: {
        'technical-tina': 1.2,
        'sentiment-sam': 1.1,
      },
    },
    is_system: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockCustomStrategy: Strategy = {
    id: 'strategy-3',
    slug: 'custom-balanced',
    name: 'Custom Balanced',
    description: 'User-defined balanced approach',
    risk_level: 'medium',
    parameters: {
      ...mockParameters,
      analyst_weights: {},
    },
    is_system: false,
    is_active: false,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockRecommendation = {
    recommended: mockStrategy,
    reasoning: 'Based on universe domain and historical performance',
    alternatives: [mockAggressiveStrategy],
  };

  beforeEach(async () => {
    const mockStrategyService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      findSystemStrategies: jest.fn(),
      recommendStrategy: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StrategyHandler,
        {
          provide: StrategyService,
          useValue: mockStrategyService,
        },
      ],
    }).compile();

    handler = moduleRef.get<StrategyHandler>(StrategyHandler);
    strategyService = moduleRef.get(StrategyService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('recommend');
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
    it('should list all strategies without filters', async () => {
      strategyService.findAll.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
        mockCustomStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.findAll).toHaveBeenCalled();
      const data = result.data as Strategy[];
      expect(data).toHaveLength(3);
    });

    it('should list only system strategies when isSystem filter is true', async () => {
      strategyService.findSystemStrategies.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { isSystem: true } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.findSystemStrategies).toHaveBeenCalled();
      expect(strategyService.findAll).not.toHaveBeenCalled();
      const data = result.data as Strategy[];
      expect(data).toHaveLength(2);
    });

    it('should filter by riskLevel', async () => {
      strategyService.findAll.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
        mockCustomStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { riskLevel: 'low' } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Strategy[];
      expect(data).toHaveLength(1);
      expect(data[0]?.risk_level).toBe('low');
    });

    it('should filter by isActive true', async () => {
      strategyService.findAll.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
        mockCustomStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { isActive: true } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Strategy[];
      expect(data).toHaveLength(2);
      expect(data.every((s) => s.is_active)).toBe(true);
    });

    it('should filter by isActive false', async () => {
      strategyService.findAll.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
        mockCustomStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { isActive: false } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Strategy[];
      expect(data).toHaveLength(1);
      expect(data[0]?.is_active).toBe(false);
    });

    it('should combine multiple filters', async () => {
      strategyService.findSystemStrategies.mockResolvedValue([
        mockStrategy,
        mockAggressiveStrategy,
      ]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { filters: { isSystem: true, riskLevel: 'high', isActive: true } },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Strategy[];
      expect(data).toHaveLength(1);
      expect(data[0]?.slug).toBe('aggressive');
    });

    it('should paginate results', async () => {
      const strategies = Array(25)
        .fill(null)
        .map((_, i) => ({
          ...mockStrategy,
          id: `strategy-${i}`,
          slug: `strategy-${i}`,
        }));
      strategyService.findAll.mockResolvedValue(strategies);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Strategy[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      strategyService.findAll.mockResolvedValue([mockStrategy]);

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
      strategyService.findAll.mockRejectedValue(new Error('Database error'));

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
      strategyService.findAll.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list strategies');
    });
  });

  describe('execute - get action', () => {
    it('should return error if neither id nor slug is provided', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get strategy by id', async () => {
      strategyService.findById.mockResolvedValue(mockStrategy);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'strategy-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.findById).toHaveBeenCalledWith('strategy-1');
      const data = result.data as Strategy;
      expect(data.slug).toBe('conservative');
    });

    it('should get strategy by slug', async () => {
      strategyService.findBySlug.mockResolvedValue(mockStrategy);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { slug: 'conservative' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.findBySlug).toHaveBeenCalledWith('conservative');
      const data = result.data as Strategy;
      expect(data.id).toBe('strategy-1');
    });

    it('should prefer id over slug when both provided', async () => {
      strategyService.findById.mockResolvedValue(mockStrategy);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'strategy-1', slug: 'conservative' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.findById).toHaveBeenCalledWith('strategy-1');
      expect(strategyService.findBySlug).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND error if strategy with id does not exist', async () => {
      strategyService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('non-existent');
    });

    it('should return NOT_FOUND error if strategy with slug does not exist', async () => {
      strategyService.findBySlug.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { slug: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('non-existent');
    });

    it('should handle get service error', async () => {
      strategyService.findById.mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'strategy-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      strategyService.findById.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'strategy-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get strategy');
    });
  });

  describe('execute - recommend action', () => {
    it('should return error if universeId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'recommend',
        params: {},
      };
      const result = await handler.execute('recommend', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_UNIVERSE_ID');
    });

    it('should recommend strategy for universe', async () => {
      strategyService.recommendStrategy.mockResolvedValue(mockRecommendation);

      const payload: DashboardRequestPayload = {
        action: 'recommend',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('recommend', payload, mockContext);

      expect(result.success).toBe(true);
      expect(strategyService.recommendStrategy).toHaveBeenCalledWith(
        'universe-1',
      );
      const data = result.data as {
        universeId: string;
        recommended: Strategy;
        reasoning: string;
        alternatives: Strategy[];
      };
      expect(data.universeId).toBe('universe-1');
      expect(data.recommended.slug).toBe('conservative');
      expect(data.reasoning).toContain('historical performance');
      expect(data.alternatives).toHaveLength(1);
      expect(data.alternatives[0]?.slug).toBe('aggressive');
    });

    it('should handle recommend service error', async () => {
      strategyService.recommendStrategy.mockRejectedValue(
        new Error('Recommendation failed'),
      );

      const payload: DashboardRequestPayload = {
        action: 'recommend',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('recommend', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RECOMMEND_FAILED');
      expect(result.error?.message).toBe('Recommendation failed');
    });

    it('should handle non-Error throws in recommend', async () => {
      strategyService.recommendStrategy.mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'recommend',
        params: { universeId: 'universe-1' },
      };
      const result = await handler.execute('recommend', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RECOMMEND_FAILED');
      expect(result.error?.message).toBe('Failed to recommend strategy');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      strategyService.findAll.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      strategyService.findById.mockResolvedValue(mockStrategy);

      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'strategy-1' },
      };
      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
