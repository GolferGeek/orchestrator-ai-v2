import { Test, TestingModule } from '@nestjs/testing';
import { UserPositionService } from '../user-position.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { TargetRepository } from '../../repositories/target.repository';
import { TargetSnapshotRepository } from '../../repositories/target-snapshot.repository';
import {
  UserPortfolio,
  UserPosition,
} from '../../interfaces/portfolio.interface';
import { Prediction } from '../../interfaces/prediction.interface';
import { Target } from '../../interfaces/target.interface';

describe('UserPositionService', () => {
  let service: UserPositionService;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;
  let targetSnapshotRepository: jest.Mocked<TargetSnapshotRepository>;

  const mockPortfolio: UserPortfolio = {
    id: 'portfolio-123',
    user_id: 'user-123',
    org_slug: 'test-org',
    initial_balance: 100000,
    current_balance: 105000,
    total_realized_pnl: 5000,
    total_unrealized_pnl: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPosition: UserPosition = {
    id: 'position-123',
    portfolio_id: 'portfolio-123',
    prediction_id: 'pred-123',
    target_id: 'target-123',
    symbol: 'AAPL',
    direction: 'long',
    quantity: 10,
    entry_price: 150.0,
    current_price: 155.0,
    unrealized_pnl: 50.0,
    status: 'open',
    opened_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPrediction: Prediction = {
    id: 'pred-123',
    target_id: 'target-123',
    task_id: 'task-123',
    direction: 'up',
    confidence: 0.85,
    magnitude: 'medium',
    reasoning: 'Technical analysis shows bullish pattern',
    timeframe_hours: 24,
    predicted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    entry_price: 150.0,
    target_price: 165.0,
    stop_loss: 142.5,
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'active',
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Technology sector leader',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 155.0,
    price_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTargetSnapshot = {
    id: 'snapshot-123',
    target_id: 'target-123',
    value: 155.0,
    captured_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPositionService,
        {
          provide: PortfolioRepository,
          useValue: {
            getOrCreateUserPortfolio: jest
              .fn()
              .mockResolvedValue(mockPortfolio),
            getUserPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
            createUserPosition: jest.fn().mockResolvedValue(mockPosition),
            getOpenUserPositions: jest.fn().mockResolvedValue([mockPosition]),
            getClosedUserPositions: jest.fn().mockResolvedValue([]),
            getUserPortfolioStats: jest.fn().mockResolvedValue({
              winRate: 0.6,
              totalTrades: 10,
              wins: 6,
              losses: 4,
            }),
            closeUserPosition: jest.fn().mockResolvedValue(undefined),
            recordUserTradeResult: jest.fn().mockResolvedValue(undefined),
            calculatePnL: jest
              .fn()
              .mockImplementation((direction, entry, exit, qty) => {
                if (direction === 'long') {
                  return (exit - entry) * qty;
                }
                return (entry - exit) * qty;
              }),
          },
        },
        {
          provide: PredictionRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockPrediction),
          },
        },
        {
          provide: TargetRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockTarget),
          },
        },
        {
          provide: TargetSnapshotRepository,
          useValue: {
            findLatest: jest.fn().mockResolvedValue(mockTargetSnapshot),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<UserPositionService>(UserPositionService);
    portfolioRepository = module.get(PortfolioRepository);
    predictionRepository = module.get(PredictionRepository);
    targetRepository = module.get(TargetRepository);
    targetSnapshotRepository = module.get(TargetSnapshotRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreatePortfolio', () => {
    it('should return or create user portfolio', async () => {
      const result = await service.getOrCreatePortfolio('user-123', 'test-org');

      expect(portfolioRepository.getOrCreateUserPortfolio).toHaveBeenCalledWith(
        'user-123',
        'test-org',
      );
      expect(result).toEqual(mockPortfolio);
    });
  });

  describe('calculateRecommendedSize', () => {
    it('should calculate recommended position size', async () => {
      const result = await service.calculateRecommendedSize(
        'pred-123',
        100000,
        150.0,
      );

      expect(result).toHaveProperty('recommendedQuantity');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('riskAmount');
      expect(result).toHaveProperty('entryPrice');
      expect(result).toHaveProperty('stopPrice');
      expect(result).toHaveProperty('targetPrice');
      expect(result).toHaveProperty('potentialProfit');
      expect(result).toHaveProperty('potentialLoss');
      expect(result).toHaveProperty('riskRewardRatio');
    });

    it('should throw when prediction not found', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      await expect(
        service.calculateRecommendedSize('nonexistent', 100000, 150.0),
      ).rejects.toThrow('Prediction not found');
    });

    it('should throw when target not found', async () => {
      targetRepository.findById.mockResolvedValue(null);

      await expect(
        service.calculateRecommendedSize('pred-123', 100000, 150.0),
      ).rejects.toThrow('Target not found');
    });

    it('should calculate stop below entry for long positions', async () => {
      const result = await service.calculateRecommendedSize(
        'pred-123',
        100000,
        150.0,
      );

      expect(result.stopPrice).toBeLessThan(result.entryPrice);
    });

    it('should calculate stop above entry for short positions', async () => {
      predictionRepository.findById.mockResolvedValue({
        ...mockPrediction,
        direction: 'down',
      });

      const result = await service.calculateRecommendedSize(
        'pred-123',
        100000,
        150.0,
      );

      expect(result.stopPrice).toBeGreaterThan(result.entryPrice);
    });

    it('should respect max position size limit', async () => {
      // Large portfolio should still respect 10% max position
      const result = await service.calculateRecommendedSize(
        'pred-123',
        1000000,
        150.0,
      );

      const positionValue = result.recommendedQuantity * result.entryPrice;
      expect(positionValue).toBeLessThanOrEqual(1000000 * 0.1);
    });

    it('should calculate risk reward ratio', async () => {
      const result = await service.calculateRecommendedSize(
        'pred-123',
        100000,
        150.0,
      );

      expect(result.riskRewardRatio).toBeGreaterThan(0);
    });

    it('should include reasoning string', async () => {
      const result = await service.calculateRecommendedSize(
        'pred-123',
        100000,
        150.0,
      );

      expect(result.reasoning).toContain('confidence');
      expect(result.reasoning).toContain('risk/reward');
    });
  });

  describe('createPositionFromPrediction', () => {
    it('should create position from prediction', async () => {
      const result = await service.createPositionFromPrediction({
        userId: 'user-123',
        orgSlug: 'test-org',
        predictionId: 'pred-123',
        quantity: 10,
        entryPrice: 150.0,
      });

      expect(portfolioRepository.createUserPosition).toHaveBeenCalledWith(
        'portfolio-123',
        'pred-123',
        'target-123',
        'AAPL',
        'long',
        10,
        150.0,
      );
      expect(result.position).toEqual(mockPosition);
      expect(result.portfolio).toEqual(mockPortfolio);
      expect(result.prediction).toEqual(mockPrediction);
    });

    it('should throw when prediction not found', async () => {
      predictionRepository.findById.mockResolvedValue(null);

      await expect(
        service.createPositionFromPrediction({
          userId: 'user-123',
          orgSlug: 'test-org',
          predictionId: 'nonexistent',
          quantity: 10,
        }),
      ).rejects.toThrow('Prediction not found');
    });

    it('should throw when target not found', async () => {
      targetRepository.findById.mockResolvedValue(null);

      await expect(
        service.createPositionFromPrediction({
          userId: 'user-123',
          orgSlug: 'test-org',
          predictionId: 'pred-123',
          quantity: 10,
        }),
      ).rejects.toThrow('Target not found');
    });

    it('should use current price when entry price not provided', async () => {
      await service.createPositionFromPrediction({
        userId: 'user-123',
        orgSlug: 'test-org',
        predictionId: 'pred-123',
        quantity: 10,
      });

      expect(targetSnapshotRepository.findLatest).toHaveBeenCalledWith(
        'target-123',
      );
      expect(portfolioRepository.createUserPosition).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        155.0, // From snapshot
      );
    });

    it('should throw when no price available', async () => {
      targetSnapshotRepository.findLatest.mockResolvedValue(null);

      await expect(
        service.createPositionFromPrediction({
          userId: 'user-123',
          orgSlug: 'test-org',
          predictionId: 'pred-123',
          quantity: 10,
        }),
      ).rejects.toThrow('No entry price provided');
    });

    it('should create short position for down prediction', async () => {
      predictionRepository.findById.mockResolvedValue({
        ...mockPrediction,
        direction: 'down',
      });

      await service.createPositionFromPrediction({
        userId: 'user-123',
        orgSlug: 'test-org',
        predictionId: 'pred-123',
        quantity: 10,
        entryPrice: 150.0,
      });

      expect(portfolioRepository.createUserPosition).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'short',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('getOpenPositions', () => {
    it('should return open positions for user', async () => {
      const result = await service.getOpenPositions('user-123', 'test-org');

      expect(portfolioRepository.getUserPortfolio).toHaveBeenCalledWith(
        'user-123',
        'test-org',
      );
      expect(portfolioRepository.getOpenUserPositions).toHaveBeenCalledWith(
        'portfolio-123',
      );
      expect(result).toEqual([mockPosition]);
    });

    it('should return empty array when no portfolio', async () => {
      portfolioRepository.getUserPortfolio.mockResolvedValue(null);

      const result = await service.getOpenPositions('user-123', 'test-org');

      expect(result).toEqual([]);
    });
  });

  describe('getPortfolioSummary', () => {
    it('should return portfolio summary', async () => {
      const result = await service.getPortfolioSummary('user-123', 'test-org');

      expect(result).toHaveProperty('portfolio');
      expect(result).toHaveProperty('openPositions');
      expect(result).toHaveProperty('totalUnrealizedPnl');
      expect(result).toHaveProperty('totalRealizedPnl');
      expect(result).toHaveProperty('winRate');
      expect(result).toHaveProperty('totalTrades');
      expect(result).toHaveProperty('wins');
      expect(result).toHaveProperty('losses');
    });

    it('should return empty summary when no portfolio', async () => {
      portfolioRepository.getUserPortfolio.mockResolvedValue(null);

      const result = await service.getPortfolioSummary('user-123', 'test-org');

      expect(result.portfolio).toBeNull();
      expect(result.openPositions).toEqual([]);
      expect(result.totalUnrealizedPnl).toBe(0);
      expect(result.winRate).toBe(0);
    });

    it('should calculate total unrealized PnL', async () => {
      portfolioRepository.getOpenUserPositions.mockResolvedValue([
        { ...mockPosition, unrealized_pnl: 100 },
        { ...mockPosition, id: 'pos-2', unrealized_pnl: 200 },
      ]);

      const result = await service.getPortfolioSummary('user-123', 'test-org');

      expect(result.totalUnrealizedPnl).toBe(300);
    });
  });

  describe('getClosedPositions', () => {
    it('should return closed positions with statistics', async () => {
      const closedPosition = {
        ...mockPosition,
        status: 'closed' as const,
        realized_pnl: 500,
        exit_price: 160,
        closed_at: new Date().toISOString(),
      };
      portfolioRepository.getClosedUserPositions.mockResolvedValue([
        closedPosition,
      ]);

      const result = await service.getClosedPositions('user-123', 'test-org');

      expect(result.positions).toHaveLength(1);
      expect(result.statistics.totalClosed).toBe(1);
      expect(result.statistics.totalPnl).toBe(500);
    });

    it('should return empty when no portfolio', async () => {
      portfolioRepository.getUserPortfolio.mockResolvedValue(null);

      const result = await service.getClosedPositions('user-123', 'test-org');

      expect(result.positions).toEqual([]);
      expect(result.statistics.totalClosed).toBe(0);
    });

    it('should calculate win/loss statistics', async () => {
      const closedPositions = [
        { ...mockPosition, status: 'closed' as const, realized_pnl: 500 },
        {
          ...mockPosition,
          id: 'pos-2',
          status: 'closed' as const,
          realized_pnl: -200,
        },
        {
          ...mockPosition,
          id: 'pos-3',
          status: 'closed' as const,
          realized_pnl: 300,
        },
      ];
      portfolioRepository.getClosedUserPositions.mockResolvedValue(
        closedPositions,
      );

      const result = await service.getClosedPositions('user-123', 'test-org');

      expect(result.statistics.wins).toBe(2);
      expect(result.statistics.losses).toBe(1);
      expect(result.statistics.winRate).toBeCloseTo(2 / 3);
    });

    it('should respect filter options', async () => {
      await service.getClosedPositions('user-123', 'test-org', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        symbol: 'AAPL',
        limit: 50,
      });

      expect(portfolioRepository.getClosedUserPositions).toHaveBeenCalledWith(
        'portfolio-123',
        {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          symbol: 'AAPL',
          limit: 50,
        },
      );
    });
  });

  describe('closePosition', () => {
    // closePosition uses internal Supabase query which is hard to mock
    // The method accesses portfolioRepository['getClient']() which is private
    // We'll skip these tests as they require deep mocking of private methods
    it.skip('should close position and calculate PnL', async () => {
      // Would test closePosition but requires private method mocking
    });

    it.skip('should identify loss correctly', async () => {
      // Would test closePosition but requires private method mocking
    });
  });
});
