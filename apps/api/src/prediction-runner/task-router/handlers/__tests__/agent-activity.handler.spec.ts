/**
 * Agent Activity Handler Tests
 *
 * Tests the HITL notification system for agent self-modifications.
 */

import { Test } from '@nestjs/testing';
import { AgentActivityHandler } from '../agent-activity.handler';
import { PortfolioRepository } from '../../../repositories/portfolio.repository';
import { AnalystRepository } from '../../../repositories/analyst.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { AgentSelfModificationLog } from '../../../interfaces/portfolio.interface';
import type { Analyst } from '../../../interfaces/analyst.interface';

describe('AgentActivityHandler', () => {
  let handler: AgentActivityHandler;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let analystRepository: jest.Mocked<AnalystRepository>;

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

  const mockAnalysts: Analyst[] = [
    {
      id: 'analyst-1',
      slug: 'technical-tina',
      name: 'Technical Tina',
      perspective: 'Technical analyst',
      tier_instructions: {},
      default_weight: 1.0,
      is_enabled: true,
      scope_level: 'runner',
      domain: null,
      universe_id: null,
      target_id: null,
      agent_id: null,
      learned_patterns: [],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    {
      id: 'analyst-2',
      slug: 'sentiment-sam',
      name: 'Sentiment Sam',
      perspective: 'Sentiment analyst',
      tier_instructions: {},
      default_weight: 1.0,
      is_enabled: true,
      scope_level: 'runner',
      domain: null,
      universe_id: null,
      target_id: null,
      agent_id: null,
      learned_patterns: [],
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
  ];

  const mockModifications: AgentSelfModificationLog[] = [
    {
      id: 'mod-1',
      analyst_id: 'analyst-1',
      modification_type: 'rule_added',
      summary: 'Added rule: Avoid earnings week trades',
      details: { rule: 'avoid_earnings_week' },
      trigger_reason: '3 consecutive losses during earnings',
      performance_context: { drawdown: -15 },
      acknowledged: false,
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'mod-2',
      analyst_id: 'analyst-2',
      modification_type: 'weight_changed',
      summary: 'Increased volume confirmation weight to 1.3',
      details: { old_weight: 1.0, new_weight: 1.3 },
      trigger_reason: 'High success rate with volume confirmation',
      performance_context: { success_rate: 0.75 },
      acknowledged: false,
      created_at: '2024-01-14T10:00:00Z',
    },
    {
      id: 'mod-3',
      analyst_id: 'analyst-1',
      modification_type: 'status_change',
      summary: 'Entered probation status',
      details: { old_status: 'warning', new_status: 'probation' },
      trigger_reason: 'Balance dropped below 60% threshold',
      performance_context: { balance: 550000, drawdown: -45 },
      acknowledged: true,
      acknowledged_at: '2024-01-13T12:00:00Z',
      created_at: '2024-01-13T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    const mockPortfolioRepository = {
      getUnacknowledgedModifications: jest.fn(),
      acknowledgeModification: jest.fn(),
    };

    const mockAnalystRepository = {
      getActive: jest.fn(),
      findById: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentActivityHandler,
        {
          provide: PortfolioRepository,
          useValue: mockPortfolioRepository,
        },
        {
          provide: AnalystRepository,
          useValue: mockAnalystRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<AgentActivityHandler>(AgentActivityHandler);
    portfolioRepository = moduleRef.get(PortfolioRepository);
    analystRepository = moduleRef.get(AnalystRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toEqual(['list', 'get', 'acknowledge', 'stats']);
    });
  });

  describe('execute - list action', () => {
    it('should list all unacknowledged modifications', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = { action: 'list', params: {} };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(
        portfolioRepository.getUnacknowledgedModifications,
      ).toHaveBeenCalled();
      expect(analystRepository.getActive).toHaveBeenCalled();
    });

    it('should enrich modifications with analyst names', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = { action: 'list', params: {} };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Array<{
        analyst_name: string;
        analyst_slug: string;
      }>;
      expect(data[0]?.analyst_name).toBe('Technical Tina');
      expect(data[0]?.analyst_slug).toBe('technical-tina');
    });

    it('should filter by analyst ID', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { analystId: 'analyst-1' },
        },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      // Should only return mods for analyst-1
      const data = result.data as AgentSelfModificationLog[];
      expect(data.every((m) => m.analyst_id === 'analyst-1')).toBe(true);
    });

    it('should filter by modification type', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {
          filters: { modificationType: 'rule_added' },
        },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as AgentSelfModificationLog[];
      expect(data.every((m) => m.modification_type === 'rule_added')).toBe(
        true,
      );
    });

    it('should paginate results', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 1, pageSize: 2 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata?.totalCount).toBe(3);
    });
  });

  describe('execute - get action', () => {
    it('should return error if ID is missing', async () => {
      const payload: DashboardRequestPayload = { action: 'get', params: {} };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return modification by ID', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.findById.mockResolvedValue(mockAnalysts[0] ?? null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'mod-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as AgentSelfModificationLog & {
        analyst_name: string;
      };
      expect(data.id).toBe('mod-1');
      expect(data.analyst_name).toBe('Technical Tina');
    });

    it('should return error if modification not found', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - acknowledge action', () => {
    it('should return error if ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'acknowledge',
        params: {},
      };
      const result = await handler.execute('acknowledge', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should acknowledge a modification', async () => {
      portfolioRepository.acknowledgeModification.mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'acknowledge',
        params: { id: 'mod-1' },
      };
      const result = await handler.execute('acknowledge', payload, mockContext);

      expect(result.success).toBe(true);
      expect(portfolioRepository.acknowledgeModification).toHaveBeenCalledWith(
        'mod-1',
      );
      const data = result.data as { id: string; acknowledged: boolean };
      expect(data.acknowledged).toBe(true);
    });

    it('should handle acknowledge errors', async () => {
      portfolioRepository.acknowledgeModification.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'acknowledge',
        params: { id: 'mod-1' },
      };
      const result = await handler.execute('acknowledge', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACKNOWLEDGE_FAILED');
    });
  });

  describe('execute - stats action', () => {
    it('should return activity statistics', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue(
        mockModifications,
      );
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(true);
      const stats = result.data as {
        total: number;
        unacknowledged: number;
        byType: Record<string, number>;
        byAnalyst: Record<string, { name: string; count: number }>;
        recentActivity: AgentSelfModificationLog[];
      };

      expect(stats.total).toBe(3);
      expect(stats.unacknowledged).toBe(2); // mod-3 is acknowledged
      expect(stats.byType['rule_added']).toBe(1);
      expect(stats.byType['weight_changed']).toBe(1);
      expect(stats.byType['status_change']).toBe(1);
      expect(stats.byAnalyst['analyst-1']?.count).toBe(2);
      expect(stats.byAnalyst['analyst-2']?.count).toBe(1);
      expect(stats.recentActivity.length).toBeLessThanOrEqual(10);
    });

    it('should return empty stats when no modifications', async () => {
      portfolioRepository.getUnacknowledgedModifications.mockResolvedValue([]);
      analystRepository.getActive.mockResolvedValue(mockAnalysts);

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(true);
      const stats = result.data as { total: number; unacknowledged: number };
      expect(stats.total).toBe(0);
      expect(stats.unacknowledged).toBe(0);
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
});
