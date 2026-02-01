import { Test, TestingModule } from '@nestjs/testing';
import { AnalystPositionService } from '../analyst-position.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { ActiveAnalyst } from '../../interfaces/analyst.interface';
import { Target } from '../../interfaces/target.interface';
import { AnalystAssessmentResult } from '../../interfaces/ensemble.interface';
import {
  ForkType,
  PortfolioStatus,
  PositionDirection,
} from '../../interfaces/portfolio.interface';

describe('AnalystPositionService', () => {
  let service: AnalystPositionService;
  let mockPortfolioRepository: Partial<PortfolioRepository>;

  const mockTarget: Target = {
    id: 'target-456',
    universe_id: 'universe-123',
    name: 'Apple Inc',
    target_type: 'stock',
    symbol: 'AAPL',
    context: 'Large cap tech company',
    is_active: true,
    is_archived: false,
    llm_config_override: null,
    metadata: {},
    current_price: null,
    price_updated_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const createMockAnalyst = (
    overrides: Partial<ActiveAnalyst> = {},
  ): ActiveAnalyst => ({
    analyst_id: 'analyst-123',
    slug: 'technical-tina',
    name: 'Technical Tina',
    perspective: 'Technical analysis',
    effective_weight: 1.0,
    effective_tier: 'silver',
    tier_instructions: {},
    learned_patterns: [],
    scope_level: 'runner',
    ...overrides,
  });

  const createMockAssessment = (
    overrides: Partial<AnalystAssessmentResult> = {},
  ): AnalystAssessmentResult => ({
    analyst: createMockAnalyst(),
    tier: 'silver',
    direction: 'bullish',
    confidence: 0.8,
    reasoning: 'Strong buy signal',
    key_factors: ['momentum'],
    risks: ['volatility'],
    learnings_applied: [],
    fork_type: 'user',
    ...overrides,
  });

  const createMockPortfolio = (
    forkType: ForkType,
    overrides: Partial<any> = {},
  ) => ({
    id: `portfolio-${forkType}-001`,
    analyst_id: 'analyst-123',
    fork_type: forkType,
    initial_balance: 1000000,
    current_balance: 1000000,
    total_realized_pnl: 0,
    total_unrealized_pnl: 0,
    win_count: 0,
    loss_count: 0,
    status: 'active' as PortfolioStatus,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  const createMockPosition = (
    direction: PositionDirection,
    overrides: Partial<any> = {},
  ) => ({
    id: 'position-001',
    portfolio_id: 'portfolio-user-001',
    target_id: 'target-456',
    symbol: 'AAPL',
    direction,
    quantity: 571,
    entry_price: 150,
    current_price: 150,
    unrealized_pnl: 0,
    is_paper_only: false,
    status: 'open',
    opened_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(async () => {
    mockPortfolioRepository = {
      getAnalystPortfolio: jest.fn(),
      createAnalystPosition: jest.fn(),
      getOpenAnalystPositions: jest.fn().mockResolvedValue([]),
      getOpenPositionsByTarget: jest.fn(),
      updateAnalystPositionPrice: jest.fn(),
      closeAnalystPosition: jest.fn(),
      recordAnalystTradeResult: jest.fn(),
      calculatePnL: jest.fn((direction, entry, current, quantity) => {
        if (direction === 'long') {
          return (current - entry) * quantity;
        }
        return (entry - current) * quantity;
      }),
      getPositionPercentForConfidence: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystPositionService,
        {
          provide: PortfolioRepository,
          useValue: mockPortfolioRepository,
        },
      ],
    }).compile();

    service = module.get<AnalystPositionService>(AnalystPositionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =============================================================================
  // POSITION SIZE CALCULATION
  // =============================================================================

  describe('calculatePositionSize', () => {
    beforeEach(() => {
      // Mock the tiered position sizing from database
      // 60-70% = 5%, 70-80% = 10%, 80%+ = 15%
      (
        mockPortfolioRepository.getPositionPercentForConfidence as jest.Mock
      ).mockImplementation((confidence: number) => {
        if (confidence >= 0.8) return Promise.resolve(0.15);
        if (confidence >= 0.7) return Promise.resolve(0.1);
        if (confidence >= 0.6) return Promise.resolve(0.05);
        return Promise.resolve(0.05);
      });
    });

    it('should calculate position size using tiered confidence sizing', async () => {
      // $1M portfolio, $150 entry, 80% confidence
      // 80%+ confidence = 15% of portfolio = $150,000
      // Quantity = $150,000 / $150 = 1000
      const size = await service.calculatePositionSize(1000000, 150, 0.8);
      expect(size).toBe(1000);
    });

    it('should use medium tier for 70-80% confidence', async () => {
      // $1M portfolio, $150 entry, 75% confidence
      // 70-80% confidence = 10% of portfolio = $100,000
      // Quantity = $100,000 / $150 = 666
      const size = await service.calculatePositionSize(1000000, 150, 0.75);
      expect(size).toBe(666);
    });

    it('should use low tier for 60-70% confidence', async () => {
      // $1M portfolio, $150 entry, 65% confidence
      // 60-70% confidence = 5% of portfolio = $50,000
      // Quantity = $50,000 / $150 = 333
      const size = await service.calculatePositionSize(1000000, 150, 0.65);
      expect(size).toBe(333);
    });

    it('should return 0 when entry price is 0', async () => {
      const size = await service.calculatePositionSize(1000000, 0, 0.8);
      expect(size).toBe(0);
    });

    it('should return 0 when confidence is below minimum threshold', async () => {
      // Confidence below 60% should return 0
      const size = await service.calculatePositionSize(1000000, 150, 0.5);
      expect(size).toBe(0);
    });

    it('should scale position with confidence tiers', async () => {
      const highConfidenceSize = await service.calculatePositionSize(
        1000000,
        150,
        0.85, // High tier (15%)
      );
      const medConfidenceSize = await service.calculatePositionSize(
        1000000,
        150,
        0.75, // Medium tier (10%)
      );
      const lowConfidenceSize = await service.calculatePositionSize(
        1000000,
        150,
        0.65, // Low tier (5%)
      );

      expect(highConfidenceSize).toBeGreaterThan(medConfidenceSize);
      expect(medConfidenceSize).toBeGreaterThan(lowConfidenceSize);
    });

    it('should use default when database config fails', async () => {
      (
        mockPortfolioRepository.getPositionPercentForConfidence as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      // Should fall back to default 5%
      // $1M * 5% = $50,000 / $150 = 333
      const size = await service.calculatePositionSize(1000000, 150, 0.8);
      expect(size).toBe(333);
    });
  });

  // =============================================================================
  // POSITION CREATION FROM ASSESSMENT
  // =============================================================================

  describe('createPositionFromAssessment', () => {
    it('should create a long position for bullish assessment', async () => {
      const portfolio = createMockPortfolio('user');
      const position = createMockPosition('long');

      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(portfolio);
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(position);

      const result = await service.createPositionFromAssessment({
        assessment: createMockAssessment({
          direction: 'bullish',
          confidence: 0.8,
        }),
        target: mockTarget,
        entryPrice: 150,
        predictionId: 'prediction-123',
      });

      expect(result).not.toBeNull();
      expect(result!.position.direction).toBe('long');
      expect(
        mockPortfolioRepository.createAnalystPosition,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'long',
          symbol: 'AAPL',
        }),
      );
    });

    it('should create a short position for bearish assessment', async () => {
      const portfolio = createMockPortfolio('user');
      const position = createMockPosition('short');

      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(portfolio);
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(position);

      const result = await service.createPositionFromAssessment({
        assessment: createMockAssessment({
          direction: 'bearish',
          confidence: 0.8,
        }),
        target: mockTarget,
        entryPrice: 150,
      });

      expect(result).not.toBeNull();
      expect(
        mockPortfolioRepository.createAnalystPosition,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'short',
        }),
      );
    });

    it('should return null for neutral assessment', async () => {
      const portfolio = createMockPortfolio('user');
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(portfolio);

      const result = await service.createPositionFromAssessment({
        assessment: createMockAssessment({
          direction: 'neutral',
          confidence: 0.5,
        }),
        target: mockTarget,
        entryPrice: 150,
      });

      expect(result).toBeNull();
      expect(
        mockPortfolioRepository.createAnalystPosition,
      ).not.toHaveBeenCalled();
    });

    it('should return null when portfolio not found', async () => {
      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(null);

      const result = await service.createPositionFromAssessment({
        assessment: createMockAssessment(),
        target: mockTarget,
        entryPrice: 150,
      });

      expect(result).toBeNull();
    });

    it('should create paper-only position for suspended portfolio', async () => {
      const suspendedPortfolio = createMockPortfolio('ai', {
        status: 'suspended',
      });
      const paperPosition = createMockPosition('long', { is_paper_only: true });

      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(suspendedPortfolio);
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(paperPosition);

      const result = await service.createPositionFromAssessment({
        assessment: createMockAssessment({ fork_type: 'ai' }),
        target: mockTarget,
        entryPrice: 150,
      });

      expect(result).not.toBeNull();
      expect(
        mockPortfolioRepository.createAnalystPosition,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          is_paper_only: true,
        }),
      );
    });

    it('should use correct fork type from assessment', async () => {
      const aiPortfolio = createMockPortfolio('ai');
      const position = createMockPosition('long');

      (
        mockPortfolioRepository.getAnalystPortfolio as jest.Mock
      ).mockResolvedValue(aiPortfolio);
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(position);

      await service.createPositionFromAssessment({
        assessment: createMockAssessment({ fork_type: 'ai' }),
        target: mockTarget,
        entryPrice: 150,
      });

      expect(mockPortfolioRepository.getAnalystPortfolio).toHaveBeenCalledWith(
        'analyst-123',
        'ai',
      );
    });
  });

  // =============================================================================
  // DUAL-FORK POSITION CREATION
  // =============================================================================

  describe('createPositionsFromDualForkAssessments', () => {
    it('should create positions for both forks', async () => {
      const userPortfolio = createMockPortfolio('user');
      const aiPortfolio = createMockPortfolio('ai');
      const position = createMockPosition('long');

      (mockPortfolioRepository.getAnalystPortfolio as jest.Mock)
        .mockResolvedValueOnce(userPortfolio)
        .mockResolvedValueOnce(aiPortfolio);
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(position);

      const userAssessments = [createMockAssessment({ fork_type: 'user' })];
      const agentAssessments = [createMockAssessment({ fork_type: 'ai' })];

      const result = await service.createPositionsFromDualForkAssessments(
        userAssessments,
        agentAssessments,
        mockTarget,
        150,
        'prediction-123',
      );

      expect(result.userPositions).toHaveLength(1);
      expect(result.aiPositions).toHaveLength(1);
    });

    it('should continue if one assessment fails', async () => {
      const userPortfolio1 = createMockPortfolio('user', {
        analyst_id: 'analyst-1',
      });
      const userPortfolio2 = createMockPortfolio('user', {
        analyst_id: 'analyst-2',
      });
      const position = createMockPosition('long');

      // First user succeeds, second user succeeds, agent fails (no portfolio)
      (mockPortfolioRepository.getAnalystPortfolio as jest.Mock)
        .mockResolvedValueOnce(userPortfolio1) // user-1
        .mockResolvedValueOnce(userPortfolio2) // user-2
        .mockResolvedValueOnce(null); // agent-1
      (
        mockPortfolioRepository.createAnalystPosition as jest.Mock
      ).mockResolvedValue(position);

      const userAssessments = [
        createMockAssessment({
          analyst: createMockAnalyst({ analyst_id: 'analyst-1' }),
          fork_type: 'user',
        }),
        createMockAssessment({
          analyst: createMockAnalyst({ analyst_id: 'analyst-2' }),
          fork_type: 'user',
        }),
      ];
      const agentAssessments = [
        createMockAssessment({
          analyst: createMockAnalyst({ analyst_id: 'analyst-1' }),
          fork_type: 'ai',
        }),
      ];

      const result = await service.createPositionsFromDualForkAssessments(
        userAssessments,
        agentAssessments,
        mockTarget,
        150,
      );

      expect(result.userPositions).toHaveLength(2);
      expect(result.aiPositions).toHaveLength(0);
    });
  });

  // =============================================================================
  // POSITION CLOSING
  // =============================================================================

  describe('closePosition', () => {
    it('should close position and calculate profit', async () => {
      const openPosition = createMockPosition('long', {
        id: 'position-001',
        entry_price: 150,
        quantity: 571,
        status: 'open',
      });
      const closedPosition = createMockPosition('long', {
        ...openPosition,
        status: 'closed',
        exit_price: 165,
      });

      (
        mockPortfolioRepository.getOpenAnalystPositions as jest.Mock
      ).mockResolvedValue([openPosition]);
      (
        mockPortfolioRepository.closeAnalystPosition as jest.Mock
      ).mockResolvedValue(closedPosition);
      (
        mockPortfolioRepository.recordAnalystTradeResult as jest.Mock
      ).mockResolvedValue(createMockPortfolio('user'));

      const result = await service.closePosition('position-001', 165);

      // P&L = (165 - 150) * 571 = 8565
      expect(result.realizedPnl).toBe(8565);
      expect(result.isWin).toBe(true);
      expect(
        mockPortfolioRepository.recordAnalystTradeResult,
      ).toHaveBeenCalledWith(closedPosition.portfolio_id, 8565, true);
    });

    it('should record loss correctly', async () => {
      const openPosition = createMockPosition('long', {
        id: 'position-001',
        entry_price: 150,
        quantity: 571,
        status: 'open',
      });
      const closedPosition = createMockPosition('long', {
        ...openPosition,
        status: 'closed',
        exit_price: 140,
      });

      (
        mockPortfolioRepository.getOpenAnalystPositions as jest.Mock
      ).mockResolvedValue([openPosition]);
      (
        mockPortfolioRepository.closeAnalystPosition as jest.Mock
      ).mockResolvedValue(closedPosition);
      (
        mockPortfolioRepository.recordAnalystTradeResult as jest.Mock
      ).mockResolvedValue(createMockPortfolio('user'));

      const result = await service.closePosition('position-001', 140);

      // P&L = (140 - 150) * 571 = -5710
      expect(result.realizedPnl).toBe(-5710);
      expect(result.isWin).toBe(false);
    });

    it('should calculate short position P&L correctly', async () => {
      const openPosition = createMockPosition('short', {
        id: 'position-001',
        entry_price: 150,
        quantity: 571,
        status: 'open',
      });
      const closedPosition = createMockPosition('short', {
        ...openPosition,
        status: 'closed',
        exit_price: 140,
      });

      (
        mockPortfolioRepository.getOpenAnalystPositions as jest.Mock
      ).mockResolvedValue([openPosition]);
      (
        mockPortfolioRepository.closeAnalystPosition as jest.Mock
      ).mockResolvedValue(closedPosition);
      (
        mockPortfolioRepository.recordAnalystTradeResult as jest.Mock
      ).mockResolvedValue(createMockPortfolio('user'));

      const result = await service.closePosition('position-001', 140);

      // Short P&L = (150 - 140) * 571 = 5710
      expect(result.realizedPnl).toBe(5710);
      expect(result.isWin).toBe(true);
    });

    it('should throw error when position not found', async () => {
      (
        mockPortfolioRepository.getOpenAnalystPositions as jest.Mock
      ).mockResolvedValue([]);

      await expect(service.closePosition('position-001', 165)).rejects.toThrow(
        'Position position-001 not found or already closed',
      );
    });
  });

  // =============================================================================
  // PRICE UPDATES
  // =============================================================================

  describe('updateTargetPositionPrices', () => {
    it('should update all open positions for a target', async () => {
      const positions = [
        createMockPosition('long', { id: 'pos-1', entry_price: 150 }),
        createMockPosition('short', { id: 'pos-2', entry_price: 155 }),
      ];

      (
        mockPortfolioRepository.getOpenPositionsByTarget as jest.Mock
      ).mockResolvedValue(positions);
      (
        mockPortfolioRepository.updateAnalystPositionPrice as jest.Mock
      ).mockResolvedValue({});

      await service.updateTargetPositionPrices('target-456', 160);

      expect(
        mockPortfolioRepository.updateAnalystPositionPrice,
      ).toHaveBeenCalledTimes(2);
      // First position: long, (160-150)*571 = 5710 profit
      expect(
        mockPortfolioRepository.updateAnalystPositionPrice,
      ).toHaveBeenCalledWith('pos-1', 160, 5710);
      // Second position: short, (155-160)*571 = -2855 loss
      expect(
        mockPortfolioRepository.updateAnalystPositionPrice,
      ).toHaveBeenCalledWith('pos-2', 160, -2855);
    });
  });
});
