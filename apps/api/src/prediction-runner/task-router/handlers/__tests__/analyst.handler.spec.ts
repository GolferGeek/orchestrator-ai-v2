/**
 * Analyst Handler Tests
 *
 * Tests for the analyst dashboard handler, including fork comparison functionality.
 */

import { Test } from '@nestjs/testing';
import { AnalystHandler } from '../analyst.handler';
import { AnalystService } from '../../../services/analyst.service';
import { PortfolioRepository } from '../../../repositories/portfolio.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { Analyst } from '../../../interfaces/analyst.interface';
import type {
  AnalystPortfolio,
  AnalystContextVersion,
  AnalystForkComparison,
} from '../../../interfaces/portfolio.interface';

describe('AnalystHandler', () => {
  let handler: AnalystHandler;
  let analystService: jest.Mocked<AnalystService>;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;

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

  const mockAnalyst: Analyst = {
    id: 'analyst-1',
    slug: 'technical-tina',
    name: 'Technical Tina',
    perspective: 'Technical analysis expert',
    tier_instructions: { tier1: 'Be conservative' },
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
  };

  const mockUserPortfolio: AnalystPortfolio = {
    id: 'portfolio-user-1',
    analyst_id: 'analyst-1',
    fork_type: 'user',
    initial_balance: 1000000,
    current_balance: 1050000,
    total_realized_pnl: 50000,
    total_unrealized_pnl: 0,
    win_count: 10,
    loss_count: 5,
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-15',
  };

  const mockAgentPortfolio: AnalystPortfolio = {
    id: 'portfolio-agent-1',
    analyst_id: 'analyst-1',
    fork_type: 'agent',
    initial_balance: 1000000,
    current_balance: 1080000,
    total_realized_pnl: 80000,
    total_unrealized_pnl: 0,
    win_count: 12,
    loss_count: 4,
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-15',
  };

  const mockUserContext: AnalystContextVersion = {
    id: 'context-user-1',
    analyst_id: 'analyst-1',
    fork_type: 'user',
    version_number: 1,
    perspective: 'Technical analysis expert',
    tier_instructions: { tier1: 'Be conservative' },
    default_weight: 1.0,
    changed_by: 'system',
    is_current: true,
    created_at: '2024-01-01',
  };

  const mockAgentContext: AnalystContextVersion = {
    id: 'context-agent-1',
    analyst_id: 'analyst-1',
    fork_type: 'agent',
    version_number: 3,
    perspective: 'Technical analysis expert with enhanced momentum focus',
    tier_instructions: { tier1: 'Be conservative', tier2: 'Focus on volume' },
    default_weight: 1.2,
    agent_journal: 'Increased weight after successful momentum trades',
    changed_by: 'agent_self',
    is_current: true,
    created_at: '2024-01-10',
  };

  const mockForkComparisons: AnalystForkComparison[] = [
    {
      analyst_id: 'analyst-1',
      slug: 'technical-tina',
      name: 'Technical Tina',
      perspective: 'Technical analyst',
      user_balance: 1050000,
      user_realized_pnl: 50000,
      user_unrealized_pnl: 0,
      user_wins: 10,
      user_losses: 5,
      agent_balance: 1080000,
      agent_realized_pnl: 80000,
      agent_unrealized_pnl: 0,
      agent_wins: 12,
      agent_losses: 4,
      agent_status: 'active',
      balance_diff: 30000,
      balance_diff_percent: 2.86,
    },
    {
      analyst_id: 'analyst-2',
      slug: 'sentiment-sam',
      name: 'Sentiment Sam',
      perspective: 'Sentiment analyst',
      user_balance: 980000,
      user_realized_pnl: -20000,
      user_unrealized_pnl: 0,
      user_wins: 5,
      user_losses: 8,
      agent_balance: 920000,
      agent_realized_pnl: -80000,
      agent_unrealized_pnl: 0,
      agent_wins: 4,
      agent_losses: 10,
      agent_status: 'warning',
      balance_diff: -60000,
      balance_diff_percent: -6.12,
    },
  ];

  beforeEach(async () => {
    const mockAnalystService = {
      findById: jest.fn(),
      findRunnerLevel: jest.fn(),
      findByDomain: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockPortfolioRepository = {
      getAnalystPortfolio: jest.fn(),
      getCurrentAnalystContextVersion: jest.fn(),
      getAnalystContextVersionHistory: jest.fn(),
      getAnalystForkComparisons: jest.fn(),
      createAnalystContextVersion: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalystHandler,
        {
          provide: AnalystService,
          useValue: mockAnalystService,
        },
        {
          provide: PortfolioRepository,
          useValue: mockPortfolioRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<AnalystHandler>(AnalystHandler);
    analystService = moduleRef.get(AnalystService);
    portfolioRepository = moduleRef.get(PortfolioRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions including fork comparison', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('compareForks');
      expect(actions).toContain('forksSummary');
      expect(actions).toContain('getForkHistory');
      expect(actions).toContain('adoptChange');
    });
  });

  describe('execute - compareForks action', () => {
    it('should return error if analyst ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'compareForks',
        params: {},
      };
      const result = await handler.execute(
        'compareForks',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error if analyst not found', async () => {
      analystService.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'compareForks',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute(
        'compareForks',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should compare user and agent forks successfully', async () => {
      analystService.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.getAnalystPortfolio
        .mockResolvedValueOnce(mockUserPortfolio)
        .mockResolvedValueOnce(mockAgentPortfolio);
      portfolioRepository.getCurrentAnalystContextVersion
        .mockResolvedValueOnce(mockUserContext)
        .mockResolvedValueOnce(mockAgentContext);

      const payload: DashboardRequestPayload = {
        action: 'compareForks',
        params: { id: 'analyst-1' },
      };
      const result = await handler.execute(
        'compareForks',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as {
        analyst: { id: string; name: string };
        userFork: { pnl: number; winRate: number };
        agentFork: { pnl: number; winRate: number; status: string };
        comparison: {
          agentOutperforming: boolean;
          contextDiff: { perspectiveChanged: boolean };
        };
      };

      expect(data.analyst.id).toBe('analyst-1');
      expect(data.analyst.name).toBe('Technical Tina');
      expect(data.userFork.pnl).toBe(50000);
      expect(data.agentFork.pnl).toBe(80000);
      expect(data.comparison.agentOutperforming).toBe(true);
      expect(data.comparison.contextDiff.perspectiveChanged).toBe(true);
    });

    it('should calculate win rate correctly', async () => {
      analystService.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.getAnalystPortfolio
        .mockResolvedValueOnce(mockUserPortfolio)
        .mockResolvedValueOnce(mockAgentPortfolio);
      portfolioRepository.getCurrentAnalystContextVersion
        .mockResolvedValueOnce(mockUserContext)
        .mockResolvedValueOnce(mockAgentContext);

      const payload: DashboardRequestPayload = {
        action: 'compareForks',
        params: { id: 'analyst-1' },
      };
      const result = await handler.execute(
        'compareForks',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as {
        userFork: { winRate: number };
        agentFork: { winRate: number };
      };

      // User: 10 wins / 15 total = 0.667
      expect(data.userFork.winRate).toBeCloseTo(0.667, 2);
      // Agent: 12 wins / 16 total = 0.75
      expect(data.agentFork.winRate).toBe(0.75);
    });
  });

  describe('execute - forksSummary action', () => {
    it('should return summary of all analyst fork comparisons', async () => {
      portfolioRepository.getAnalystForkComparisons.mockResolvedValue(
        mockForkComparisons,
      );

      const payload: DashboardRequestPayload = {
        action: 'forksSummary',
        params: {},
      };
      const result = await handler.execute(
        'forksSummary',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as {
        comparisons: AnalystForkComparison[];
        summary: {
          totalAnalysts: number;
          agentOutperforming: number;
          userOutperforming: number;
          statusBreakdown: Record<string, number>;
        };
      };

      expect(data.comparisons).toHaveLength(2);
      expect(data.summary.totalAnalysts).toBe(2);
      expect(data.summary.agentOutperforming).toBe(1);
      expect(data.summary.userOutperforming).toBe(1);
      expect(data.summary.statusBreakdown.active).toBe(1);
      expect(data.summary.statusBreakdown.warning).toBe(1);
    });

    it('should paginate results', async () => {
      portfolioRepository.getAnalystForkComparisons.mockResolvedValue(
        mockForkComparisons,
      );

      const payload: DashboardRequestPayload = {
        action: 'forksSummary',
        params: { page: 1, pageSize: 1 },
      };
      const result = await handler.execute(
        'forksSummary',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as { comparisons: AnalystForkComparison[] };
      expect(data.comparisons).toHaveLength(1);
      expect(result.metadata?.totalCount).toBe(2);
    });
  });

  describe('execute - getForkHistory action', () => {
    it('should return error if analyst ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'getForkHistory',
        params: {},
      };
      const result = await handler.execute(
        'getForkHistory',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return version history for user fork by default', async () => {
      const mockHistory: AnalystContextVersion[] = [
        mockUserContext,
        { ...mockUserContext, id: 'v0', version_number: 0, is_current: false },
      ];
      portfolioRepository.getAnalystContextVersionHistory.mockResolvedValue(
        mockHistory,
      );
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'getForkHistory',
        params: { id: 'analyst-1' },
      };
      const result = await handler.execute(
        'getForkHistory',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(
        portfolioRepository.getAnalystContextVersionHistory,
      ).toHaveBeenCalledWith('analyst-1', 'user');

      const data = result.data as {
        forkType: string;
        versionCount: number;
        versions: AnalystContextVersion[];
      };
      expect(data.forkType).toBe('user');
      expect(data.versionCount).toBe(2);
    });

    it('should return version history for agent fork when specified', async () => {
      const mockHistory: AnalystContextVersion[] = [mockAgentContext];
      portfolioRepository.getAnalystContextVersionHistory.mockResolvedValue(
        mockHistory,
      );
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'getForkHistory',
        params: { id: 'analyst-1', forkType: 'agent' },
      };
      const result = await handler.execute(
        'getForkHistory',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(
        portfolioRepository.getAnalystContextVersionHistory,
      ).toHaveBeenCalledWith('analyst-1', 'agent');

      const data = result.data as {
        forkType: string;
        versions: AnalystContextVersion[];
      };
      expect(data.forkType).toBe('agent');
      expect(data.versions[0]?.agent_journal).toBeDefined();
    });
  });

  describe('execute - adoptChange action', () => {
    it('should return error if analyst ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'adoptChange',
        params: {},
      };
      const result = await handler.execute('adoptChange', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error if changes are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'adoptChange',
        params: { id: 'analyst-1' },
      };
      const result = await handler.execute('adoptChange', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_CHANGES');
    });

    it('should return error if user context does not exist', async () => {
      portfolioRepository.getCurrentAnalystContextVersion.mockResolvedValue(
        null,
      );

      const payload: DashboardRequestPayload = {
        action: 'adoptChange',
        params: {
          id: 'analyst-1',
          changes: { defaultWeight: 1.2 },
        },
      };
      const result = await handler.execute('adoptChange', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_USER_CONTEXT');
    });

    it('should adopt changes and create new user context version', async () => {
      portfolioRepository.getCurrentAnalystContextVersion.mockResolvedValue(
        mockUserContext,
      );
      const newVersion: AnalystContextVersion = {
        ...mockUserContext,
        id: 'context-user-2',
        version_number: 2,
        default_weight: 1.2,
        change_reason: 'Adopted weight change from agent fork',
      };
      portfolioRepository.createAnalystContextVersion.mockResolvedValue(
        newVersion,
      );

      const payload: DashboardRequestPayload = {
        action: 'adoptChange',
        params: {
          id: 'analyst-1',
          changes: { defaultWeight: 1.2 },
          reason: 'Adopted weight change from agent fork',
        },
      };
      const result = await handler.execute('adoptChange', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        portfolioRepository.createAnalystContextVersion,
      ).toHaveBeenCalledWith({
        analyst_id: 'analyst-1',
        fork_type: 'user',
        perspective: mockUserContext.perspective,
        tier_instructions: mockUserContext.tier_instructions,
        default_weight: 1.2,
        change_reason: 'Adopted weight change from agent fork',
        changed_by: 'user',
      });

      const data = result.data as {
        adopted: boolean;
        previousVersion: number;
        newVersion: number;
      };
      expect(data.adopted).toBe(true);
      expect(data.previousVersion).toBe(1);
      expect(data.newVersion).toBe(2);
    });
  });

  describe('execute - basic CRUD actions', () => {
    it('should list analysts', async () => {
      analystService.findRunnerLevel.mockResolvedValue([mockAnalyst]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Analyst[];
      expect(data).toHaveLength(1);
      expect(data[0]?.slug).toBe('technical-tina');
    });

    it('should get analyst by ID', async () => {
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'analyst-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as Analyst;
      expect(data.id).toBe('analyst-1');
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
