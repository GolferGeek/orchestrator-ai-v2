import { Test, TestingModule } from '@nestjs/testing';
import { PositionResolutionService } from '../position-resolution.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { AnalystPositionService } from '../analyst-position.service';
import { UserPositionService } from '../user-position.service';

describe('PositionResolutionService', () => {
  let service: PositionResolutionService;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let analystPositionService: jest.Mocked<AnalystPositionService>;
  let userPositionService: jest.Mocked<UserPositionService>;

  const mockAnalystPosition = {
    id: 'analyst-position-123',
    portfolio_id: 'portfolio-123',
    analyst_assessment_id: 'assessment-123',
    prediction_id: 'pred-123',
    target_id: 'target-123',
    symbol: 'AAPL',
    direction: 'long' as const,
    quantity: 10,
    entry_price: 100,
    current_price: 105,
    unrealized_pnl: 50,
    is_paper_only: true,
    status: 'open' as const,
    opened_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockUserPosition = {
    id: 'user-position-123',
    portfolio_id: 'portfolio-123',
    prediction_id: 'pred-123',
    target_id: 'target-123',
    symbol: 'AAPL',
    direction: 'long' as const,
    quantity: 5,
    entry_price: 100,
    current_price: 105,
    unrealized_pnl: 25,
    status: 'open' as const,
    opened_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionResolutionService,
        {
          provide: PortfolioRepository,
          useValue: {
            getOpenAnalystPositionsByPrediction: jest.fn().mockResolvedValue([mockAnalystPosition]),
            getOpenUserPositionsByPrediction: jest.fn().mockResolvedValue([mockUserPosition]),
          },
        },
        {
          provide: AnalystPositionService,
          useValue: {
            closePosition: jest.fn().mockResolvedValue({ realizedPnl: 100, isWin: true }),
          },
        },
        {
          provide: UserPositionService,
          useValue: {
            closePosition: jest.fn().mockResolvedValue({ realizedPnl: 50, isWin: true }),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<PositionResolutionService>(PositionResolutionService);
    portfolioRepository = module.get(PortfolioRepository);
    analystPositionService = module.get(AnalystPositionService);
    userPositionService = module.get(UserPositionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('closePositionsForPrediction', () => {
    it('should close all positions for a prediction', async () => {
      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(portfolioRepository.getOpenAnalystPositionsByPrediction).toHaveBeenCalledWith('pred-123');
      expect(portfolioRepository.getOpenUserPositionsByPrediction).toHaveBeenCalledWith('pred-123');
      expect(analystPositionService.closePosition).toHaveBeenCalledWith('analyst-position-123', 110);
      expect(userPositionService.closePosition).toHaveBeenCalledWith('user-position-123', 110);
      expect(result.predictionId).toBe('pred-123');
      expect(result.exitPrice).toBe(110);
      expect(result.analystPositionsClosed).toBe(1);
      expect(result.userPositionsClosed).toBe(1);
      expect(result.totalAnalystPnl).toBe(100);
      expect(result.totalUserPnl).toBe(50);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle no open positions', async () => {
      portfolioRepository.getOpenAnalystPositionsByPrediction.mockResolvedValue([]);
      portfolioRepository.getOpenUserPositionsByPrediction.mockResolvedValue([]);

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.analystPositionsClosed).toBe(0);
      expect(result.userPositionsClosed).toBe(0);
      expect(result.totalAnalystPnl).toBe(0);
      expect(result.totalUserPnl).toBe(0);
    });

    it('should handle multiple analyst positions', async () => {
      portfolioRepository.getOpenAnalystPositionsByPrediction.mockResolvedValue([
        { ...mockAnalystPosition, id: 'ap-1' },
        { ...mockAnalystPosition, id: 'ap-2' },
        { ...mockAnalystPosition, id: 'ap-3' },
      ]);

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(analystPositionService.closePosition).toHaveBeenCalledTimes(3);
      expect(result.analystPositionsClosed).toBe(3);
      expect(result.totalAnalystPnl).toBe(300); // 100 * 3
    });

    it('should handle multiple user positions', async () => {
      portfolioRepository.getOpenUserPositionsByPrediction.mockResolvedValue([
        { ...mockUserPosition, id: 'up-1' },
        { ...mockUserPosition, id: 'up-2' },
      ]);

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(userPositionService.closePosition).toHaveBeenCalledTimes(2);
      expect(result.userPositionsClosed).toBe(2);
      expect(result.totalUserPnl).toBe(100); // 50 * 2
    });

    it('should handle analyst position close errors', async () => {
      analystPositionService.closePosition.mockRejectedValue(new Error('Close failed'));

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.analystPositionsClosed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to close analyst position');
    });

    it('should handle user position close errors', async () => {
      userPositionService.closePosition.mockRejectedValue(new Error('Close failed'));

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.userPositionsClosed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to close user position');
    });

    it('should continue closing other positions after error', async () => {
      portfolioRepository.getOpenAnalystPositionsByPrediction.mockResolvedValue([
        { ...mockAnalystPosition, id: 'ap-1' },
        { ...mockAnalystPosition, id: 'ap-2' },
      ]);
      analystPositionService.closePosition
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({ realizedPnl: 100, isWin: true });

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.analystPositionsClosed).toBe(1);
      expect(result.totalAnalystPnl).toBe(100);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle portfolio repository error for analyst positions', async () => {
      portfolioRepository.getOpenAnalystPositionsByPrediction.mockRejectedValue(
        new Error('Repository error'),
      );

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to get analyst positions');
    });

    it('should handle portfolio repository error for user positions', async () => {
      portfolioRepository.getOpenUserPositionsByPrediction.mockRejectedValue(
        new Error('Repository error'),
      );

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to get user positions');
    });

    it('should calculate total P&L correctly', async () => {
      portfolioRepository.getOpenAnalystPositionsByPrediction.mockResolvedValue([
        { ...mockAnalystPosition, id: 'ap-1' },
        { ...mockAnalystPosition, id: 'ap-2' },
      ]);
      portfolioRepository.getOpenUserPositionsByPrediction.mockResolvedValue([
        { ...mockUserPosition, id: 'up-1' },
        { ...mockUserPosition, id: 'up-2' },
        { ...mockUserPosition, id: 'up-3' },
      ]);
      analystPositionService.closePosition.mockResolvedValue({ realizedPnl: 50, isWin: true });
      userPositionService.closePosition.mockResolvedValue({ realizedPnl: 25, isWin: true });

      const result = await service.closePositionsForPrediction('pred-123', 110);

      expect(result.totalAnalystPnl).toBe(100); // 50 * 2
      expect(result.totalUserPnl).toBe(75); // 25 * 3
    });

    it('should handle negative P&L', async () => {
      analystPositionService.closePosition.mockResolvedValue({ realizedPnl: -100, isWin: false });
      userPositionService.closePosition.mockResolvedValue({ realizedPnl: -50, isWin: false });

      const result = await service.closePositionsForPrediction('pred-123', 90);

      expect(result.totalAnalystPnl).toBe(-100);
      expect(result.totalUserPnl).toBe(-50);
    });
  });
});
