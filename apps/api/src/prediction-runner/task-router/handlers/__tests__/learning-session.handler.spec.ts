/**
 * Learning Session Handler Tests
 *
 * Tests for bidirectional learning between user and agent forks.
 */

import { Test } from '@nestjs/testing';
import { LearningSessionHandler } from '../learning-session.handler';
import { PortfolioRepository } from '../../../repositories/portfolio.repository';
import { AnalystService } from '../../../services/analyst.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type { Analyst } from '../../../interfaces/analyst.interface';
import type {
  AnalystPortfolio,
  AnalystContextVersion,
  ForkLearningExchange,
} from '../../../interfaces/portfolio.interface';

describe('LearningSessionHandler', () => {
  let handler: LearningSessionHandler;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let analystService: jest.Mocked<AnalystService>;

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
    tier_instructions: {},
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
    perspective: 'Technical analysis expert with momentum focus',
    tier_instructions: { tier1: 'Focus on volume' },
    default_weight: 1.2,
    agent_journal: 'Momentum strategy working well',
    changed_by: 'agent_self',
    is_current: true,
    created_at: '2024-01-10',
  };

  const mockExchanges: ForkLearningExchange[] = [
    {
      id: 'exchange-1',
      analyst_id: 'analyst-1',
      initiated_by: 'user',
      question: 'Why did you increase your weight?',
      response: 'Momentum trades have been successful',
      context_diff: { weight: { old: 1.0, new: 1.2 } },
      performance_evidence: { winRate: 0.75 },
      outcome: 'adopted',
      adoption_details: { adopted_weight: true },
      created_at: '2024-01-12T10:00:00Z',
    },
    {
      id: 'exchange-2',
      analyst_id: 'analyst-1',
      initiated_by: 'agent',
      question: 'Why did you take 2x position on AAPL?',
      outcome: 'pending',
      created_at: '2024-01-14T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    const mockPortfolioRepository = {
      getAnalystPortfolio: jest.fn(),
      getCurrentAnalystContextVersion: jest.fn(),
      getLearningExchanges: jest.fn(),
      getLearningExchangeById: jest.fn(),
      createLearningExchange: jest.fn(),
      updateLearningExchange: jest.fn(),
      getPendingLearningExchanges: jest.fn(),
    };

    const mockAnalystService = {
      findById: jest.fn(),
      findRunnerLevel: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LearningSessionHandler,
        {
          provide: PortfolioRepository,
          useValue: mockPortfolioRepository,
        },
        {
          provide: AnalystService,
          useValue: mockAnalystService,
        },
      ],
    }).compile();

    handler = moduleRef.get<LearningSessionHandler>(LearningSessionHandler);
    portfolioRepository = moduleRef.get(PortfolioRepository);
    analystService = moduleRef.get(AnalystService);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('start');
      expect(actions).toContain('askAgent');
      expect(actions).toContain('askUser');
      expect(actions).toContain('respond');
      expect(actions).toContain('pending');
      expect(actions).toContain('stats');
    });
  });

  describe('execute - list action', () => {
    it('should return error if analyst ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ANALYST_ID');
    });

    it('should list learning exchanges for an analyst', async () => {
      portfolioRepository.getLearningExchanges.mockResolvedValue(mockExchanges);
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { analystId: 'analyst-1' },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        analyst: { name: string };
        exchanges: ForkLearningExchange[];
      };
      expect(data.analyst.name).toBe('Technical Tina');
      expect(data.exchanges).toHaveLength(2);
    });
  });

  describe('execute - get action', () => {
    it('should return error if exchange ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get a specific exchange by ID', async () => {
      portfolioRepository.getLearningExchangeById.mockResolvedValue(
        mockExchanges[0] ?? null,
      );
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'exchange-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        exchange: ForkLearningExchange;
        analyst: { name: string };
      };
      expect(data.exchange.id).toBe('exchange-1');
      expect(data.analyst.name).toBe('Technical Tina');
    });

    it('should return error if exchange not found', async () => {
      portfolioRepository.getLearningExchangeById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - start action', () => {
    it('should return error if analyst ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'start',
        params: {},
      };
      const result = await handler.execute('start', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ANALYST_ID');
    });

    it('should start a learning session with comparison report', async () => {
      analystService.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.getAnalystPortfolio
        .mockResolvedValueOnce(mockUserPortfolio)
        .mockResolvedValueOnce(mockAgentPortfolio);
      portfolioRepository.getCurrentAnalystContextVersion
        .mockResolvedValueOnce(mockUserContext)
        .mockResolvedValueOnce(mockAgentContext);
      portfolioRepository.getLearningExchanges.mockResolvedValue(mockExchanges);

      const payload: DashboardRequestPayload = {
        action: 'start',
        params: { analystId: 'analyst-1' },
      };
      const result = await handler.execute('start', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        sessionStarted: boolean;
        analyst: { name: string };
        report: {
          performanceDiff: { agentOutperforming: boolean };
          contextDiff: { perspectiveChanged: boolean };
          suggestions: string[];
        };
      };

      expect(data.sessionStarted).toBe(true);
      expect(data.analyst.name).toBe('Technical Tina');
      expect(data.report.performanceDiff.agentOutperforming).toBe(true);
      expect(data.report.contextDiff.perspectiveChanged).toBe(true);
      expect(data.report.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('execute - askAgent action', () => {
    it('should return error if params are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'askAgent',
        params: {},
      };
      const result = await handler.execute('askAgent', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('should create a user-initiated exchange', async () => {
      portfolioRepository.getAnalystPortfolio
        .mockResolvedValueOnce(mockUserPortfolio)
        .mockResolvedValueOnce(mockAgentPortfolio);
      const newExchange: ForkLearningExchange = {
        id: 'exchange-new',
        analyst_id: 'analyst-1',
        initiated_by: 'user',
        question: 'Why did you change your perspective?',
        outcome: 'pending',
        created_at: new Date().toISOString(),
      };
      portfolioRepository.createLearningExchange.mockResolvedValue(newExchange);

      const payload: DashboardRequestPayload = {
        action: 'askAgent',
        params: {
          analystId: 'analyst-1',
          question: 'Why did you change your perspective?',
        },
      };
      const result = await handler.execute('askAgent', payload, mockContext);

      expect(result.success).toBe(true);
      expect(portfolioRepository.createLearningExchange).toHaveBeenCalledWith(
        'analyst-1',
        'user',
        'Why did you change your perspective?',
        undefined,
        expect.any(Object),
      );
    });
  });

  describe('execute - askUser action', () => {
    it('should create an agent-initiated exchange', async () => {
      portfolioRepository.getCurrentAnalystContextVersion
        .mockResolvedValueOnce(mockUserContext)
        .mockResolvedValueOnce(mockAgentContext);
      const newExchange: ForkLearningExchange = {
        id: 'exchange-agent',
        analyst_id: 'analyst-1',
        initiated_by: 'agent',
        question: 'Why did you take 2x on this trade?',
        outcome: 'pending',
        created_at: new Date().toISOString(),
      };
      portfolioRepository.createLearningExchange.mockResolvedValue(newExchange);

      const payload: DashboardRequestPayload = {
        action: 'askUser',
        params: {
          analystId: 'analyst-1',
          question: 'Why did you take 2x on this trade?',
        },
      };
      const result = await handler.execute('askUser', payload, mockContext);

      expect(result.success).toBe(true);
      expect(portfolioRepository.createLearningExchange).toHaveBeenCalledWith(
        'analyst-1',
        'agent',
        'Why did you take 2x on this trade?',
        expect.any(Object),
        undefined,
      );
    });
  });

  describe('execute - respond action', () => {
    it('should return error if params are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {},
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('should update exchange with response and outcome', async () => {
      const updatedExchange: ForkLearningExchange = {
        ...mockExchanges[1]!,
        response: 'I saw strong volume confirmation',
        outcome: 'noted',
      };
      portfolioRepository.updateLearningExchange.mockResolvedValue(
        updatedExchange,
      );

      const payload: DashboardRequestPayload = {
        action: 'respond',
        params: {
          exchangeId: 'exchange-2',
          response: 'I saw strong volume confirmation',
          outcome: 'noted',
        },
      };
      const result = await handler.execute('respond', payload, mockContext);

      expect(result.success).toBe(true);
      expect(portfolioRepository.updateLearningExchange).toHaveBeenCalledWith(
        'exchange-2',
        'I saw strong volume confirmation',
        'noted',
        undefined,
      );
    });
  });

  describe('execute - pending action', () => {
    it('should return pending exchanges', async () => {
      const pendingExchanges = mockExchanges.filter(
        (e) => e.outcome === 'pending',
      );
      portfolioRepository.getPendingLearningExchanges.mockResolvedValue(
        pendingExchanges,
      );
      analystService.findById.mockResolvedValue(mockAnalyst);

      const payload: DashboardRequestPayload = {
        action: 'pending',
        params: {},
      };
      const result = await handler.execute('pending', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        pending: Array<ForkLearningExchange & { analyst_name: string }>;
        totalPending: number;
      };
      expect(data.totalPending).toBe(1);
      expect(data.pending[0]?.analyst_name).toBe('Technical Tina');
    });
  });

  describe('execute - stats action', () => {
    it('should return learning session statistics', async () => {
      portfolioRepository.getPendingLearningExchanges.mockResolvedValue([
        mockExchanges[1]!,
      ]);
      analystService.findRunnerLevel.mockResolvedValue([mockAnalyst]);
      portfolioRepository.getLearningExchanges.mockResolvedValue(mockExchanges);

      const payload: DashboardRequestPayload = {
        action: 'stats',
        params: {},
      };
      const result = await handler.execute('stats', payload, mockContext);

      expect(result.success).toBe(true);
      const stats = result.data as {
        totalExchanges: number;
        pendingCount: number;
        outcomes: Record<string, number>;
        initiators: Record<string, number>;
        adoptionRate: string;
      };

      expect(stats.totalExchanges).toBe(2);
      expect(stats.pendingCount).toBe(1);
      expect(stats.outcomes.adopted).toBe(1);
      expect(stats.outcomes.pending).toBe(1);
      expect(stats.initiators.user).toBe(1);
      expect(stats.initiators.agent).toBe(1);
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
