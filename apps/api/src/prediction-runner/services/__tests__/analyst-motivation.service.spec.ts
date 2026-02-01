import { Test, TestingModule } from '@nestjs/testing';
import {
  AnalystMotivationService,
  DEFAULT_STATUS_THRESHOLDS,
} from '../analyst-motivation.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { AnalystRepository } from '../../repositories/analyst.repository';
import {
  AnalystPortfolio,
  ForkType,
  PortfolioStatus,
} from '../../interfaces/portfolio.interface';
import { Analyst } from '../../interfaces/analyst.interface';

describe('AnalystMotivationService', () => {
  let service: AnalystMotivationService;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let analystRepository: jest.Mocked<AnalystRepository>;

  const mockAnalyst: Analyst = {
    id: 'analyst-1',
    slug: 'technical-tina',
    name: 'Technical Tina',
    perspective: 'Technical analysis focused',
    tier_instructions: {},
    default_weight: 1.0,
    scope_level: 'universe',
    domain: 'stock',
    universe_id: 'universe-1',
    target_id: null,
    learned_patterns: [],
    agent_id: null,
    is_enabled: true,
    analyst_type: 'personality',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const createMockPortfolio = (
    overrides: Partial<AnalystPortfolio> = {},
  ): AnalystPortfolio => ({
    id: 'portfolio-1',
    analyst_id: 'analyst-1',
    fork_type: 'ai' as ForkType,
    initial_balance: 1000000,
    current_balance: 1000000,
    total_realized_pnl: 0,
    total_unrealized_pnl: 0,
    win_count: 0,
    loss_count: 0,
    status: 'active' as PortfolioStatus,
    status_changed_at: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(async () => {
    // Mock Supabase client chain
    const mockSupabaseChain = {
      from: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const mockPortfolioRepository = {
      getAnalystPortfolio: jest.fn(),
      updatePortfolioStatus: jest.fn(),
      getAllAnalystPortfolios: jest.fn(),
      logAgentSelfModification: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        schema: jest.fn().mockReturnValue(mockSupabaseChain),
      }),
      schema: 'prediction',
    };

    const mockAnalystRepository = {
      findById: jest.fn(),
      getActive: jest.fn(),
      createContextVersion: jest.fn().mockResolvedValue({
        id: 'version-1',
        analyst_id: 'analyst-1',
        fork_type: 'ai',
        version_number: 2,
        perspective: 'Test perspective',
        tier_instructions: {},
        default_weight: 1.0,
        change_reason: 'Boss feedback',
        changed_by: 'system',
        is_current: true,
        created_at: new Date().toISOString(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystMotivationService,
        { provide: PortfolioRepository, useValue: mockPortfolioRepository },
        { provide: AnalystRepository, useValue: mockAnalystRepository },
      ],
    }).compile();

    service = module.get<AnalystMotivationService>(AnalystMotivationService);
    portfolioRepository = module.get(PortfolioRepository);
    analystRepository = module.get(AnalystRepository);
  });

  describe('determineStatus', () => {
    it('should return active when balance is above 80% of initial', () => {
      const status = service.determineStatus(850000, 1000000);
      expect(status).toBe('active');
    });

    it('should return active when balance equals 80% threshold', () => {
      const status = service.determineStatus(800000, 1000000);
      expect(status).toBe('active');
    });

    it('should return warning when balance is between 60-80% of initial', () => {
      const status = service.determineStatus(700000, 1000000);
      expect(status).toBe('warning');
    });

    it('should return probation when balance is between 40-60% of initial', () => {
      const status = service.determineStatus(500000, 1000000);
      expect(status).toBe('probation');
    });

    it('should return suspended when balance is below 40% of initial', () => {
      const status = service.determineStatus(350000, 1000000);
      expect(status).toBe('suspended');
    });

    it('should return suspended when balance equals 40% threshold', () => {
      const status = service.determineStatus(400000, 1000000);
      expect(status).toBe('probation');
    });

    it('should return suspended when balance is zero', () => {
      const status = service.determineStatus(0, 1000000);
      expect(status).toBe('suspended');
    });

    it('should return active when balance exceeds initial', () => {
      const status = service.determineStatus(1500000, 1000000);
      expect(status).toBe('active');
    });
  });

  describe('evaluateAndUpdateStatus', () => {
    it('should return null if no agent portfolio exists', async () => {
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(null);

      const result = await service.evaluateAndUpdateStatus('analyst-1');

      expect(result).toBeNull();
    });

    it('should return null if status has not changed', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 900000,
        status: 'active',
      });
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);

      const result = await service.evaluateAndUpdateStatus('analyst-1');

      expect(result).toBeNull();
    });

    it('should update status and return event when status changes', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 700000,
        status: 'active',
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      const result = await service.evaluateAndUpdateStatus('analyst-1');

      expect(result).not.toBeNull();
      expect(result!.analystId).toBe('analyst-1');
      expect(result!.previousStatus).toBe('active');
      expect(result!.newStatus).toBe('warning');
    });

    it('should log modification when status changes to probation', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 500000,
        status: 'warning',
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      const result = await service.evaluateAndUpdateStatus('analyst-1');

      expect(result).not.toBeNull();
      expect(result!.newStatus).toBe('probation');
      expect(portfolioRepository.logAgentSelfModification).toHaveBeenCalled();
    });

    it('should apply boss feedback context modification when entering probation', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 500000,
        status: 'warning',
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      await service.evaluateAndUpdateStatus('analyst-1');

      // Boss feedback should create a new context version for probation
      expect(analystRepository.createContextVersion).toHaveBeenCalledWith(
        'analyst-1',
        'ai',
        expect.any(String),
        expect.objectContaining({
          silver: expect.stringContaining('IMPORTANT'),
        }),
        expect.any(Number),
        expect.stringContaining('probation'),
        'system',
      );
    });

    it('should apply boss feedback context modification when entering suspended', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 350000,
        status: 'probation',
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      await service.evaluateAndUpdateStatus('analyst-1');

      // Boss feedback should create a new context version for suspended
      expect(analystRepository.createContextVersion).toHaveBeenCalledWith(
        'analyst-1',
        'ai',
        expect.any(String),
        expect.objectContaining({
          silver: expect.stringContaining('CRITICAL'),
        }),
        expect.any(Number),
        expect.stringContaining('suspended'),
        'system',
      );
    });

    it('should NOT apply boss feedback when entering warning (no context modification)', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 700000,
        status: 'active',
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);
      analystRepository.createContextVersion.mockClear();

      await service.evaluateAndUpdateStatus('analyst-1');

      // Warning status should NOT create a context modification
      expect(analystRepository.createContextVersion).not.toHaveBeenCalled();
    });
  });

  describe('evaluateAllAiPortfolios', () => {
    it('should evaluate all agent portfolios and return status changes', async () => {
      const portfolios = [
        createMockPortfolio({
          id: 'portfolio-1',
          analyst_id: 'analyst-1',
          current_balance: 700000,
          status: 'active',
        }),
        createMockPortfolio({
          id: 'portfolio-2',
          analyst_id: 'analyst-2',
          current_balance: 900000,
          status: 'active',
        }),
      ];

      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue(portfolios);
      portfolioRepository.getAnalystPortfolio.mockImplementation(
        async (analystId) => {
          return portfolios.find((p) => p.analyst_id === analystId) || null;
        },
      );
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);
      analystRepository.findById.mockResolvedValue(mockAnalyst);

      const results = await service.evaluateAllAiPortfolios();

      // Only analyst-1 should have a status change (700K -> warning)
      expect(results.length).toBe(1);
      expect(results[0]!.analystId).toBe('analyst-1');
      expect(results[0]!.newStatus).toBe('warning');
    });

    it('should return empty array when no status changes occur', async () => {
      const portfolio = createMockPortfolio({
        analyst_id: 'analyst-1',
        current_balance: 900000,
        status: 'active',
      });

      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        portfolio,
      ]);
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);

      const results = await service.evaluateAllAiPortfolios();

      expect(results).toEqual([]);
    });
  });

  describe('buildPerformanceContext', () => {
    it('should return null if no portfolio exists', async () => {
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(null);

      const result = await service.buildPerformanceContext('analyst-1', 'ai');

      expect(result).toBeNull();
    });

    it('should build performance context with correct calculations', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 1150000,
        total_realized_pnl: 100000,
        total_unrealized_pnl: 50000,
        win_count: 15,
        loss_count: 5,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        portfolio,
      ]);
      analystRepository.getActive.mockResolvedValue([mockAnalyst]);

      const result = await service.buildPerformanceContext('analyst-1', 'ai');

      expect(result).not.toBeNull();
      expect(result!.currentBalance).toBe(1150000);
      expect(result!.pnlAmount).toBe(150000);
      expect(result!.pnlPercent).toBeCloseTo(15, 1);
      expect(result!.winRate).toBeCloseTo(0.75, 2);
    });

    it('should calculate win rate correctly', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 1100000,
        win_count: 10,
        loss_count: 2,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        portfolio,
      ]);
      analystRepository.getActive.mockResolvedValue([mockAnalyst]);

      const result = await service.buildPerformanceContext('analyst-1', 'ai');

      expect(result).not.toBeNull();
      // Win rate = 10 / 12 = 0.833...
      expect(result!.winRate).toBeCloseTo(0.833, 2);
    });

    it('should include peer comparison for agent fork', async () => {
      const portfolio = createMockPortfolio({
        current_balance: 1100000,
        win_count: 10,
        loss_count: 2,
      });

      const portfolio2 = createMockPortfolio({
        id: 'portfolio-2',
        analyst_id: 'analyst-2',
        current_balance: 900000,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        portfolio,
        portfolio2,
      ]);
      analystRepository.getActive.mockResolvedValue([
        mockAnalyst,
        { ...mockAnalyst, id: 'analyst-2', slug: 'sentiment-sam' },
      ]);

      const result = await service.buildPerformanceContext('analyst-1', 'ai');

      expect(result).not.toBeNull();
      expect(result!.peerComparison).toBeDefined();
      expect(result!.rank).toBe(1);
      expect(result!.totalAnalysts).toBe(2);
    });
  });

  describe('generateBossFeedback', () => {
    it('should generate warning feedback', () => {
      const feedback = service.generateBossFeedback(mockAnalyst, 'warning', 25);

      expect(feedback.status).toBe('warning');
      expect(feedback.message).toContain('25%');
      expect(feedback.contextModification).toBeUndefined();
    });

    it('should generate probation feedback with context modification', () => {
      const feedback = service.generateBossFeedback(
        mockAnalyst,
        'probation',
        45,
      );

      expect(feedback.status).toBe('probation');
      expect(feedback.message).toContain('45%');
      expect(feedback.contextModification).toBeDefined();
      expect(feedback.contextModification).toContain('IMPORTANT');
    });

    it('should generate suspended feedback', () => {
      const feedback = service.generateBossFeedback(
        mockAnalyst,
        'suspended',
        65,
      );

      expect(feedback.status).toBe('suspended');
      expect(feedback.message).toContain('suspended');
      expect(feedback.message).toContain('paper-only');
    });
  });

  describe('formatPerformanceContextForPrompt', () => {
    it('should format active status context correctly', () => {
      const context = {
        currentBalance: 1150000,
        initialBalance: 1000000,
        pnlAmount: 150000,
        pnlPercent: 15,
        winRate: 0.75,
        winCount: 15,
        lossCount: 5,
        rank: 1,
        totalAnalysts: 5,
        status: 'active' as PortfolioStatus,
        peerComparison: [
          {
            rank: 1,
            slug: 'technical-tina',
            pnlAmount: 150000,
            isCurrentAnalyst: true,
          },
          {
            rank: 2,
            slug: 'sentiment-sam',
            pnlAmount: 50000,
            isCurrentAnalyst: false,
          },
        ],
      };

      const formatted = service.formatPerformanceContextForPrompt(context);

      expect(formatted).toContain('1,150,000');
      expect(formatted).toContain('+$150,000');
      expect(formatted).toContain('+15.0%');
      expect(formatted).toContain('Win Rate: 75%');
      expect(formatted).toContain('#1 of 5');
      expect(formatted).toContain('technical-tina');
      expect(formatted).not.toContain('Performance Notice');
    });

    it('should include performance notice for warning status', () => {
      const context = {
        currentBalance: 700000,
        initialBalance: 1000000,
        pnlAmount: -300000,
        pnlPercent: -30,
        winRate: 0.4,
        winCount: 4,
        lossCount: 6,
        rank: 4,
        totalAnalysts: 5,
        status: 'warning' as PortfolioStatus,
        statusMessage:
          'Your recent performance has triggered a warning. Consider being more selective.',
        peerComparison: [],
      };

      const formatted = service.formatPerformanceContextForPrompt(context);

      expect(formatted).toContain('Performance Notice');
      expect(formatted).toContain('more selective');
    });

    it('should include probation notice for probation status', () => {
      const context = {
        currentBalance: 500000,
        initialBalance: 1000000,
        pnlAmount: -500000,
        pnlPercent: -50,
        winRate: 0.3,
        winCount: 3,
        lossCount: 7,
        rank: 5,
        totalAnalysts: 5,
        status: 'probation' as PortfolioStatus,
        statusMessage:
          'PROBATION: Your account is under review. Your ensemble weight has been reduced.',
        peerComparison: [],
      };

      const formatted = service.formatPerformanceContextForPrompt(context);

      expect(formatted).toContain('PROBATION');
      expect(formatted).toContain('weight has been reduced');
    });
  });

  describe('getEffectiveWeight', () => {
    it('should return full weight for active status', () => {
      const weight = service.getEffectiveWeight(1.0, 'active');
      expect(weight).toBe(1.0);
    });

    it('should return full weight for warning status', () => {
      const weight = service.getEffectiveWeight(1.0, 'warning');
      expect(weight).toBe(1.0);
    });

    it('should return 50% weight for probation status', () => {
      const weight = service.getEffectiveWeight(1.0, 'probation');
      expect(weight).toBe(0.5);
    });

    it('should return 0 weight for suspended status', () => {
      const weight = service.getEffectiveWeight(1.0, 'suspended');
      expect(weight).toBe(0);
    });

    it('should apply multiplier correctly to non-1.0 weights', () => {
      const weight = service.getEffectiveWeight(1.5, 'probation');
      expect(weight).toBe(0.75);
    });
  });

  describe('shouldIncludeInEnsemble', () => {
    it('should include active analysts', () => {
      expect(service.shouldIncludeInEnsemble('active')).toBe(true);
    });

    it('should include warning analysts', () => {
      expect(service.shouldIncludeInEnsemble('warning')).toBe(true);
    });

    it('should include probation analysts', () => {
      expect(service.shouldIncludeInEnsemble('probation')).toBe(true);
    });

    it('should exclude suspended analysts', () => {
      expect(service.shouldIncludeInEnsemble('suspended')).toBe(false);
    });
  });

  describe('checkRecoveryEligibility', () => {
    it('should return not eligible if portfolio does not exist', async () => {
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(null);

      const result = await service.checkRecoveryEligibility('analyst-1');

      expect(result.eligible).toBe(false);
      expect(result.message).toContain('Not in suspended status');
    });

    it('should return not eligible if status is not suspended', async () => {
      const portfolio = createMockPortfolio({ status: 'probation' });
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);

      const result = await service.checkRecoveryEligibility('analyst-1');

      expect(result.eligible).toBe(false);
      expect(result.message).toContain('Not in suspended status');
    });

    it('should check portfolio balance for recovery eligibility', async () => {
      // Suspended with balance still below initial - not enough improvement
      const portfolio = createMockPortfolio({
        status: 'suspended',
        current_balance: 350000,
        initial_balance: 1000000,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);

      const result = await service.checkRecoveryEligibility('analyst-1');

      // P&L = (350000 - 1000000) / 1000000 = -65%
      // Not enough for 20% recovery threshold
      expect(result.eligible).toBe(false);
      expect(result.paperPnlPercent).toBe(-65);
    });

    it('should be eligible when paper P&L exceeds 20%', async () => {
      // Balance has improved to show 20% gain from initial
      const portfolio = createMockPortfolio({
        status: 'suspended',
        current_balance: 1200000, // 20% above initial
        initial_balance: 1000000,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);

      const result = await service.checkRecoveryEligibility('analyst-1');

      expect(result.eligible).toBe(true);
      expect(result.paperPnlPercent).toBe(20);
      expect(result.message).toContain('eligible');
    });
  });

  describe('processRecovery', () => {
    it('should return null if analyst is not eligible', async () => {
      const portfolio = createMockPortfolio({
        status: 'suspended',
        current_balance: 350000, // Not enough for recovery
        initial_balance: 1000000,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);

      const result = await service.processRecovery('analyst-1');

      expect(result).toBeNull();
    });

    it('should upgrade to probation if eligible', async () => {
      const portfolio = createMockPortfolio({
        id: 'portfolio-1',
        status: 'suspended',
        current_balance: 1200000, // 20% above initial
        initial_balance: 1000000,
      });

      portfolioRepository.getAnalystPortfolio.mockResolvedValue(portfolio);
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      const result = await service.processRecovery('analyst-1');

      expect(result).not.toBeNull();
      expect(result!.previousStatus).toBe('suspended');
      expect(result!.newStatus).toBe('probation');
      expect(result!.triggerReason).toContain('Recovery');
      expect(portfolioRepository.logAgentSelfModification).toHaveBeenCalled();
    });
  });

  describe('processAllRecoveries', () => {
    it('should process all suspended portfolios', async () => {
      const suspendedPortfolio = createMockPortfolio({
        id: 'portfolio-1',
        analyst_id: 'analyst-1',
        status: 'suspended',
        current_balance: 1200000, // Eligible for recovery
        initial_balance: 1000000,
      });

      const activePortfolio = createMockPortfolio({
        id: 'portfolio-2',
        analyst_id: 'analyst-2',
        status: 'active',
        current_balance: 1000000,
        initial_balance: 1000000,
      });

      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        suspendedPortfolio,
        activePortfolio,
      ]);
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(
        suspendedPortfolio,
      );
      analystRepository.findById.mockResolvedValue(mockAnalyst);
      portfolioRepository.logAgentSelfModification.mockResolvedValue({} as any);

      const results = await service.processAllRecoveries();

      // Only the suspended portfolio should be processed
      expect(results.length).toBe(1);
      expect(results[0]!.analystId).toBe('analyst-1');
    });

    it('should return empty array when no recoveries occur', async () => {
      const suspendedPortfolio = createMockPortfolio({
        status: 'suspended',
        current_balance: 350000, // Not eligible
        initial_balance: 1000000,
      });

      portfolioRepository.getAllAnalystPortfolios.mockResolvedValue([
        suspendedPortfolio,
      ]);
      portfolioRepository.getAnalystPortfolio.mockResolvedValue(
        suspendedPortfolio,
      );

      const results = await service.processAllRecoveries();

      expect(results).toEqual([]);
    });
  });

  describe('status thresholds', () => {
    it('should have correct default thresholds', () => {
      expect(DEFAULT_STATUS_THRESHOLDS.active.minBalance).toBe(800000);
      expect(DEFAULT_STATUS_THRESHOLDS.warning.minBalance).toBe(600000);
      expect(DEFAULT_STATUS_THRESHOLDS.warning.maxBalance).toBe(800000);
      expect(DEFAULT_STATUS_THRESHOLDS.probation.minBalance).toBe(400000);
      expect(DEFAULT_STATUS_THRESHOLDS.probation.maxBalance).toBe(600000);
      expect(DEFAULT_STATUS_THRESHOLDS.probation.weightMultiplier).toBe(0.5);
      expect(DEFAULT_STATUS_THRESHOLDS.suspended.maxBalance).toBe(400000);
    });
  });
});
