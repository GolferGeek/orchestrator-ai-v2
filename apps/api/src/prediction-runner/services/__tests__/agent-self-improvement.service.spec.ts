import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentSelfImprovementService,
  PatternDetectionResult,
} from '../agent-self-improvement.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { AnalystRepository } from '../../repositories/analyst.repository';
import { AnalystMotivationService } from '../analyst-motivation.service';
import { EvaluationResult } from '../evaluation.service';
import {
  AnalystPortfolio,
  AnalystPosition,
} from '../../interfaces/portfolio.interface';

describe('AgentSelfImprovementService', () => {
  let service: AgentSelfImprovementService;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let _analystRepository: jest.Mocked<AnalystRepository>;
  let motivationService: jest.Mocked<AnalystMotivationService>;

  const mockPortfolio: AnalystPortfolio = {
    id: 'portfolio-123',
    analyst_id: 'analyst-123',
    fork_type: 'ai',
    initial_balance: 100000,
    current_balance: 95000,
    total_realized_pnl: -5000,
    total_unrealized_pnl: 0,
    win_count: 3,
    loss_count: 7,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  };

  // Helper function to create position with overrides
  const createPosition = (
    index: number,
    overrides: Partial<AnalystPosition> = {},
  ): AnalystPosition => {
    const symbols = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'META'];
    return {
      id: `pos-${index}`,
      portfolio_id: 'portfolio-123',
      target_id: `target-${index}`,
      symbol: symbols[index % symbols.length] ?? 'AAPL',
      direction: 'long',
      quantity: 10,
      entry_price: 100,
      current_price: 95,
      exit_price: 95,
      unrealized_pnl: 0,
      realized_pnl: -50,
      is_paper_only: true,
      status: 'closed',
      opened_at: `2024-01-0${index + 1}T10:00:00Z`,
      closed_at: `2024-01-0${index + 1}T14:00:00Z`,
      created_at: `2024-01-0${index + 1}T10:00:00Z`,
      updated_at: `2024-01-0${index + 1}T14:00:00Z`,
      ...overrides,
    };
  };

  const mockPositions: AnalystPosition[] = [
    createPosition(1, { realized_pnl: -50, closed_at: '2024-01-05T10:00:00Z' }),
    createPosition(2, { realized_pnl: -50, closed_at: '2024-01-04T10:00:00Z' }),
    createPosition(3, { realized_pnl: -40, closed_at: '2024-01-03T10:00:00Z' }),
    createPosition(4, { realized_pnl: 50, closed_at: '2024-01-06T10:00:00Z' }),
    createPosition(5, { realized_pnl: 75, closed_at: '2024-01-07T10:00:00Z' }),
  ];

  const mockEvaluationResult: EvaluationResult = {
    predictionId: 'pred-123',
    directionCorrect: false,
    magnitudeAccuracy: 0.3,
    timingAccuracy: 0.5,
    overallScore: 0.3,
    actualDirection: 'down',
    actualMagnitude: 5,
    details: {
      predictedDirection: 'up',
      predictedMagnitude: 3,
      predictedConfidence: 0.8,
      horizonHours: 24,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentSelfImprovementService,
        {
          provide: PortfolioRepository,
          useValue: {
            getAnalystPortfolio: jest.fn().mockResolvedValue(mockPortfolio),
            getClosedPositionsForAnalyst: jest
              .fn()
              .mockResolvedValue(mockPositions),
            getAllAnalystPortfolios: jest
              .fn()
              .mockResolvedValue([mockPortfolio]),
          },
        },
        {
          provide: AnalystRepository,
          useValue: {
            findBySlug: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: AnalystMotivationService,
          useValue: {
            recordAgentSelfAdaptation: jest.fn().mockResolvedValue(undefined),
            recordAgentJournalEntry: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<AgentSelfImprovementService>(
      AgentSelfImprovementService,
    );
    portfolioRepository = module.get(PortfolioRepository);
    analystRepository = module.get(AnalystRepository);
    motivationService = module.get(AnalystMotivationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeAndAdapt', () => {
    it('should analyze and return patterns', async () => {
      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      expect(portfolioRepository.getAnalystPortfolio).toHaveBeenCalledWith(
        'analyst-123',
        'ai',
      );
      expect(
        portfolioRepository.getClosedPositionsForAnalyst,
      ).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array when no portfolio found', async () => {
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.analyzeAndAdapt(
        'nonexistent',
        mockEvaluationResult,
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when not enough positions for analysis', async () => {
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue([mockPositions[0], mockPositions[1]]);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      expect(result).toEqual([]);
    });

    it('should detect consecutive losses pattern', async () => {
      const losingPositions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: 50,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(losingPositions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const consecutiveLossPattern = result.find(
        (p) => p.patternType === 'consecutive_losses',
      );
      expect(consecutiveLossPattern).toBeDefined();
      expect(consecutiveLossPattern?.evidenceCount).toBeGreaterThanOrEqual(3);
    });

    it('should apply adaptations for detected patterns', async () => {
      const losingPositions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: -100,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(losingPositions);

      await service.analyzeAndAdapt('analyst-123', mockEvaluationResult);

      expect(motivationService.recordAgentSelfAdaptation).toHaveBeenCalled();
    });

    it('should handle adaptation errors gracefully', async () => {
      const losingPositions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: -100,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(losingPositions);
      (
        motivationService.recordAgentSelfAdaptation as jest.Mock
      ).mockRejectedValue(new Error('Adaptation error'));

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('runPeriodicAnalysis', () => {
    it('should run periodic analysis for all AI portfolios', async () => {
      const result = await service.runPeriodicAnalysis();

      expect(portfolioRepository.getAllAnalystPortfolios).toHaveBeenCalledWith(
        'ai',
      );
      expect(result).toBeDefined();
      expect(result instanceof Map).toBe(true);
    });

    it('should return results map with analyst IDs as keys', async () => {
      const losingPositions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: -100,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(losingPositions);

      const result = await service.runPeriodicAnalysis();

      if (result.size > 0) {
        expect(result.has('analyst-123')).toBe(true);
        const patterns = result.get('analyst-123');
        expect(Array.isArray(patterns)).toBe(true);
      }
    });

    it('should handle errors for individual analysts gracefully', async () => {
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockRejectedValue(
        new Error('Portfolio fetch error'),
      );

      const result = await service.runPeriodicAnalysis();

      expect(result.size).toBe(0);
    });

    it('should analyze multiple portfolios', async () => {
      const portfolios = [
        mockPortfolio,
        { ...mockPortfolio, id: 'portfolio-456', analyst_id: 'analyst-456' },
      ];
      (
        portfolioRepository.getAllAnalystPortfolios as jest.Mock
      ).mockResolvedValue(portfolios);

      const result = await service.runPeriodicAnalysis();

      expect(portfolioRepository.getAnalystPortfolio).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });
  });

  describe('recordReflection', () => {
    it('should record a reflection journal entry', async () => {
      await service.recordReflection(
        'analyst-123',
        'Reflecting on recent performance',
      );

      expect(motivationService.recordAgentJournalEntry).toHaveBeenCalledWith(
        'analyst-123',
        'Reflecting on recent performance',
        undefined,
      );
    });

    it('should include context in journal entry', async () => {
      const context = { trade_count: 10, win_rate: 0.6 };

      await service.recordReflection(
        'analyst-123',
        'Performance review',
        context,
      );

      expect(motivationService.recordAgentJournalEntry).toHaveBeenCalledWith(
        'analyst-123',
        'Performance review',
        context,
      );
    });
  });

  describe('pattern detection - consecutive losses', () => {
    it('should not detect consecutive losses below threshold', async () => {
      const positions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: 50,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: 50,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(positions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const consecutiveLossPattern = result.find(
        (p) => p.patternType === 'consecutive_losses',
      );
      expect(consecutiveLossPattern).toBeUndefined();
    });

    it('should detect exactly 3 consecutive losses', async () => {
      const positions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: 50,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(positions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const consecutiveLossPattern = result.find(
        (p) => p.patternType === 'consecutive_losses',
      );
      expect(consecutiveLossPattern).toBeDefined();
      expect(consecutiveLossPattern?.evidenceCount).toBe(3);
    });
  });

  describe('pattern detection - confidence calibration', () => {
    it('should detect confidence calibration issues with high loss rate', async () => {
      const highLossPositions: AnalystPosition[] = Array(10)
        .fill(null)
        .map((_, i) =>
          createPosition(i, {
            realized_pnl: i < 7 ? -100 : 100,
            closed_at: `2024-01-${String(10 - i).padStart(2, '0')}T10:00:00Z`,
          }),
        );
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(highLossPositions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const calibrationPattern = result.find(
        (p) => p.patternType === 'confidence_calibration',
      );
      expect(calibrationPattern).toBeDefined();
    });

    it('should not detect calibration issues with acceptable loss rate', async () => {
      const balancedPositions: AnalystPosition[] = Array(10)
        .fill(null)
        .map((_, i) =>
          createPosition(i, {
            realized_pnl: i < 5 ? -100 : 100,
            closed_at: `2024-01-${String(10 - i).padStart(2, '0')}T10:00:00Z`,
          }),
        );
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(balancedPositions);
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue({
        ...mockPortfolio,
        win_count: 5,
        loss_count: 5,
      });

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      // With 50% win rate (above 40% threshold) and 50% losses (below 60% threshold)
      // there should be no confidence calibration pattern
      const calibrationPattern = result.find(
        (p) => p.patternType === 'confidence_calibration',
      );
      expect(calibrationPattern).toBeUndefined();
    });
  });

  describe('pattern detection - low win rate', () => {
    it('should detect low win rate below threshold', async () => {
      const lowWinRatePortfolio: AnalystPortfolio = {
        ...mockPortfolio,
        win_count: 3,
        loss_count: 7,
      };
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        lowWinRatePortfolio,
      );

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const winRatePattern = result.find((p) =>
        p.description.includes('Win rate'),
      );
      expect(winRatePattern).toBeDefined();
    });

    it('should not detect low win rate when above threshold', async () => {
      const goodWinRatePortfolio: AnalystPortfolio = {
        ...mockPortfolio,
        win_count: 6,
        loss_count: 4,
      };
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        goodWinRatePortfolio,
      );
      const goodPositions: AnalystPosition[] = Array(10)
        .fill(null)
        .map((_, i) =>
          createPosition(i, {
            realized_pnl: i < 4 ? -100 : 100,
            closed_at: `2024-01-${String(10 - i).padStart(2, '0')}T10:00:00Z`,
          }),
        );
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(goodPositions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const winRatePattern = result.find((p) =>
        p.description.includes('Win rate'),
      );
      expect(winRatePattern).toBeUndefined();
    });

    it('should not detect low win rate with insufficient trades', async () => {
      const lowTradePortfolio: AnalystPortfolio = {
        ...mockPortfolio,
        win_count: 1,
        loss_count: 3,
      };
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        lowTradePortfolio,
      );

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const winRatePattern = result.find((p) =>
        p.description.includes('Win rate'),
      );
      expect(winRatePattern).toBeUndefined();
    });
  });

  describe('pattern detection - significant drawdown', () => {
    it('should detect significant drawdown', async () => {
      const drawdownPortfolio: AnalystPortfolio = {
        ...mockPortfolio,
        initial_balance: 100000,
        current_balance: 75000,
        win_count: 5,
        loss_count: 5,
      };
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        drawdownPortfolio,
      );

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const drawdownPattern = result.find((p) =>
        p.description.includes('drawdown'),
      );
      expect(drawdownPattern).toBeDefined();
    });

    it('should not detect drawdown below threshold', async () => {
      const smallDrawdownPortfolio: AnalystPortfolio = {
        ...mockPortfolio,
        initial_balance: 100000,
        current_balance: 90000,
        win_count: 6,
        loss_count: 4,
      };
      (portfolioRepository.getAnalystPortfolio as jest.Mock).mockResolvedValue(
        smallDrawdownPortfolio,
      );
      const goodPositions: AnalystPosition[] = Array(10)
        .fill(null)
        .map((_, i) =>
          createPosition(i, {
            realized_pnl: i < 4 ? -100 : 100,
            closed_at: `2024-01-${String(10 - i).padStart(2, '0')}T10:00:00Z`,
          }),
        );
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(goodPositions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      const drawdownPattern = result.find((p) =>
        p.description.includes('drawdown'),
      );
      expect(drawdownPattern).toBeUndefined();
    });
  });

  describe('pattern result structure', () => {
    it('should return valid pattern detection result structure', async () => {
      const losingPositions: AnalystPosition[] = [
        createPosition(1, {
          realized_pnl: -100,
          closed_at: '2024-01-05T10:00:00Z',
        }),
        createPosition(2, {
          realized_pnl: -100,
          closed_at: '2024-01-04T10:00:00Z',
        }),
        createPosition(3, {
          realized_pnl: -100,
          closed_at: '2024-01-03T10:00:00Z',
        }),
        createPosition(4, {
          realized_pnl: -100,
          closed_at: '2024-01-02T10:00:00Z',
        }),
        createPosition(5, {
          realized_pnl: 50,
          closed_at: '2024-01-01T10:00:00Z',
        }),
      ];
      (
        portfolioRepository.getClosedPositionsForAnalyst as jest.Mock
      ).mockResolvedValue(losingPositions);

      const result = await service.analyzeAndAdapt(
        'analyst-123',
        mockEvaluationResult,
      );

      expect(result.length).toBeGreaterThan(0);
      const pattern = result[0] as PatternDetectionResult;
      expect(pattern).toHaveProperty('patternType');
      expect(pattern).toHaveProperty('analystId');
      expect(pattern).toHaveProperty('description');
      expect(pattern).toHaveProperty('evidenceCount');
      expect(pattern).toHaveProperty('suggestedAdaptation');
      expect(pattern.suggestedAdaptation).toHaveProperty('ruleType');
      expect(pattern.suggestedAdaptation).toHaveProperty('ruleSummary');
      expect(pattern.suggestedAdaptation).toHaveProperty('ruleDetails');
    });
  });
});
