import { Test, TestingModule } from '@nestjs/testing';
import { AnalystPerformanceService } from '../analyst-performance.service';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { AnalystRepository } from '../../repositories/analyst.repository';
import {
  AnalystPerformanceMetrics,
  AnalystPortfolio,
  AnalystPosition,
} from '../../interfaces/portfolio.interface';
import { AnalystAssessmentResult } from '../../interfaces/ensemble.interface';
import { Analyst, ActiveAnalyst } from '../../interfaces/analyst.interface';

describe('AnalystPerformanceService', () => {
  let service: AnalystPerformanceService;
  let mockPortfolioRepository: jest.Mocked<PortfolioRepository>;
  let mockAnalystRepository: jest.Mocked<AnalystRepository>;

  const mockAnalyst1: Analyst = {
    id: 'analyst-1',
    slug: 'technical-tina',
    name: 'Technical Tina',
    perspective: 'Technical analysis',
    scope_level: 'runner',
    domain: null,
    universe_id: null,
    target_id: null,
    tier_instructions: {},
    default_weight: 1.0,
    learned_patterns: [],
    agent_id: null,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockAnalyst2: Analyst = {
    id: 'analyst-2',
    slug: 'sentiment-sam',
    name: 'Sentiment Sam',
    perspective: 'Sentiment analysis',
    scope_level: 'runner',
    domain: null,
    universe_id: null,
    target_id: null,
    tier_instructions: {},
    default_weight: 0.8,
    learned_patterns: [],
    agent_id: null,
    is_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockPortfolio: AnalystPortfolio = {
    id: 'portfolio-1',
    analyst_id: 'analyst-1',
    fork_type: 'user',
    initial_balance: 1000000,
    current_balance: 1050000,
    total_realized_pnl: 50000,
    total_unrealized_pnl: 0,
    win_count: 5,
    loss_count: 2,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockClosedPositions: AnalystPosition[] = [
    {
      id: 'pos-1',
      portfolio_id: 'portfolio-1',
      target_id: 'target-1',
      symbol: 'AAPL',
      direction: 'long',
      quantity: 100,
      entry_price: 150,
      current_price: 160,
      exit_price: 160,
      unrealized_pnl: 0,
      realized_pnl: 1000,
      is_paper_only: false,
      status: 'closed',
      opened_at: '2024-01-01T00:00:00Z',
      closed_at: '2024-01-02T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'pos-2',
      portfolio_id: 'portfolio-1',
      target_id: 'target-2',
      symbol: 'GOOGL',
      direction: 'long',
      quantity: 50,
      entry_price: 100,
      current_price: 110,
      exit_price: 110,
      unrealized_pnl: 0,
      realized_pnl: 500,
      is_paper_only: false,
      status: 'closed',
      opened_at: '2024-01-01T00:00:00Z',
      closed_at: '2024-01-02T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  // Helper function to get today's date string
  function getToday(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  beforeEach(async () => {
    mockPortfolioRepository = {
      getAnalystPortfolio: jest.fn(),
      getClosedPositionsForAnalyst: jest.fn(),
      upsertPerformanceMetrics: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      getLatestPerformanceMetricsForAllAnalysts: jest.fn(),
    } as unknown as jest.Mocked<PortfolioRepository>;

    mockAnalystRepository = {
      getActive: jest.fn(),
    } as unknown as jest.Mocked<AnalystRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalystPerformanceService,
        { provide: PortfolioRepository, useValue: mockPortfolioRepository },
        { provide: AnalystRepository, useValue: mockAnalystRepository },
      ],
    }).compile();

    service = module.get<AnalystPerformanceService>(AnalystPerformanceService);
  });

  afterEach(() => {
    service.clearDissentRecords();
  });

  describe('calculateSoloPnl', () => {
    it('should calculate total P&L from closed positions', async () => {
      mockPortfolioRepository.getAnalystPortfolio.mockResolvedValue(
        mockPortfolio,
      );
      mockPortfolioRepository.getClosedPositionsForAnalyst.mockResolvedValue(
        mockClosedPositions,
      );

      const result = await service.calculateSoloPnl('analyst-1', 'user');

      expect(result).toBe(1500); // 1000 + 500
      expect(mockPortfolioRepository.getAnalystPortfolio).toHaveBeenCalledWith(
        'analyst-1',
        'user',
      );
      expect(
        mockPortfolioRepository.getClosedPositionsForAnalyst,
      ).toHaveBeenCalledWith('portfolio-1', undefined, undefined);
    });

    it('should return 0 when no portfolio found', async () => {
      mockPortfolioRepository.getAnalystPortfolio.mockResolvedValue(null);

      const result = await service.calculateSoloPnl('analyst-1', 'user');

      expect(result).toBe(0);
    });

    it('should return 0 when no closed positions', async () => {
      mockPortfolioRepository.getAnalystPortfolio.mockResolvedValue(
        mockPortfolio,
      );
      mockPortfolioRepository.getClosedPositionsForAnalyst.mockResolvedValue(
        [],
      );

      const result = await service.calculateSoloPnl('analyst-1', 'user');

      expect(result).toBe(0);
    });

    it('should handle date range parameters', async () => {
      mockPortfolioRepository.getAnalystPortfolio.mockResolvedValue(
        mockPortfolio,
      );
      mockPortfolioRepository.getClosedPositionsForAnalyst.mockResolvedValue(
        mockClosedPositions,
      );

      await service.calculateSoloPnl(
        'analyst-1',
        'user',
        '2024-01-01',
        '2024-01-31',
      );

      expect(
        mockPortfolioRepository.getClosedPositionsForAnalyst,
      ).toHaveBeenCalledWith('portfolio-1', '2024-01-01', '2024-01-31');
    });
  });

  describe('calculateContributionPnl', () => {
    it('should calculate positive contribution when analyst agrees with winning ensemble', () => {
      const result = service.calculateContributionPnl(1.0, 3, 3000, true);

      // (1.0 / 3) * 3000 = 1000
      expect(result).toBe(1000);
    });

    it('should calculate negative contribution when analyst agrees with losing ensemble', () => {
      const result = service.calculateContributionPnl(1.0, 3, -3000, true);

      expect(result).toBe(-1000);
    });

    it('should calculate negative contribution when analyst disagrees with winning ensemble', () => {
      const result = service.calculateContributionPnl(1.0, 3, 3000, false);

      // Dissenter hurt the team when ensemble was right
      expect(result).toBe(-1000);
    });

    it('should calculate positive contribution when analyst disagrees with losing ensemble', () => {
      const result = service.calculateContributionPnl(1.0, 3, -3000, false);

      // Dissenter was right when ensemble was wrong
      expect(result).toBe(1000);
    });

    it('should return 0 when totalAnalysts is 0', () => {
      const result = service.calculateContributionPnl(1.0, 0, 3000, true);

      expect(result).toBe(0);
    });

    it('should scale by analyst weight', () => {
      const fullWeight = service.calculateContributionPnl(1.0, 2, 2000, true);
      const halfWeight = service.calculateContributionPnl(0.5, 2, 2000, true);

      expect(fullWeight).toBe(1000);
      expect(halfWeight).toBe(500);
    });
  });

  describe('trackDissent', () => {
    it('should track dissent when analyst disagrees with ensemble', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bullish',
      });

      const today = getToday();
      const { accuracy, count } = service.calculateDissentAccuracy(
        'analyst-1',
        'user',
        today,
      );

      expect(count).toBe(1);
      expect(accuracy).toBe(1); // Analyst was correct
    });

    it('should not track when analyst agrees with ensemble', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bullish',
        actualDirection: 'bullish',
      });

      const today = getToday();
      const { count } = service.calculateDissentAccuracy(
        'analyst-1',
        'user',
        today,
      );

      expect(count).toBe(0);
    });

    it('should track incorrect dissent', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bearish',
      });

      const today = getToday();
      const { accuracy, count } = service.calculateDissentAccuracy(
        'analyst-1',
        'user',
        today,
      );

      expect(count).toBe(1);
      expect(accuracy).toBe(0); // Analyst was wrong
    });

    it('should track multiple dissents and calculate accuracy', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bullish', // Correct
      });

      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bearish',
        ensembleDirection: 'bullish',
        actualDirection: 'bullish', // Wrong
      });

      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bullish', // Correct
      });

      const today = getToday();
      const { accuracy, count } = service.calculateDissentAccuracy(
        'analyst-1',
        'user',
        today,
      );

      expect(count).toBe(3);
      expect(accuracy).toBeCloseTo(0.667, 2); // 2/3 correct
    });

    it('should track separately by fork type', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bullish',
      });

      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'ai',
        analystDirection: 'bearish',
        ensembleDirection: 'bullish',
        actualDirection: 'bullish',
      });

      const today = getToday();
      const userResult = service.calculateDissentAccuracy(
        'analyst-1',
        'user',
        today,
      );
      const agentResult = service.calculateDissentAccuracy(
        'analyst-1',
        'ai',
        today,
      );

      expect(userResult.count).toBe(1);
      expect(userResult.accuracy).toBe(1);
      expect(agentResult.count).toBe(1);
      expect(agentResult.accuracy).toBe(0);
    });
  });

  describe('calculateAndSaveDailyMetrics', () => {
    beforeEach(() => {
      mockAnalystRepository.getActive.mockResolvedValue([
        mockAnalyst1,
        mockAnalyst2,
      ]);
      mockPortfolioRepository.getAnalystPortfolio.mockResolvedValue(
        mockPortfolio,
      );
      mockPortfolioRepository.getClosedPositionsForAnalyst.mockResolvedValue(
        mockClosedPositions,
      );
    });

    it('should calculate and save metrics for all active analysts', async () => {
      mockPortfolioRepository.upsertPerformanceMetrics.mockImplementation(
        async (analystId, forkType, metricDate, metrics) => ({
          id: 'metric-1',
          analyst_id: analystId,
          fork_type: forkType,
          metric_date: metricDate,
          solo_pnl: metrics.solo_pnl,
          contribution_pnl: metrics.contribution_pnl,
          dissent_accuracy: metrics.dissent_accuracy,
          dissent_count: metrics.dissent_count,
          rank_in_portfolio: metrics.rank_in_portfolio,
          total_analysts: metrics.total_analysts,
          created_at: '2024-01-01T00:00:00Z',
        }),
      );

      const results = await service.calculateAndSaveDailyMetrics(
        'user',
        '2024-01-01',
        10000,
      );

      expect(results).toHaveLength(2);
      expect(
        mockPortfolioRepository.upsertPerformanceMetrics,
      ).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no active analysts', async () => {
      mockAnalystRepository.getActive.mockResolvedValue([]);

      const results = await service.calculateAndSaveDailyMetrics(
        'user',
        '2024-01-01',
        10000,
      );

      expect(results).toHaveLength(0);
    });

    it('should calculate correct rankings based on solo P&L', async () => {
      // First analyst has more P&L
      const pos1 = { ...mockClosedPositions[0]!, realized_pnl: 2000 };
      const pos2 = { ...mockClosedPositions[0]!, realized_pnl: 1000 };
      mockPortfolioRepository.getClosedPositionsForAnalyst
        .mockResolvedValueOnce([pos1])
        .mockResolvedValueOnce([pos2]);

      const savedMetrics: Array<{
        analystId: string;
        rank: number | undefined;
      }> = [];
      mockPortfolioRepository.upsertPerformanceMetrics.mockImplementation(
        async (analystId, _forkType, _metricDate, metrics) => {
          savedMetrics.push({ analystId, rank: metrics.rank_in_portfolio });
          return {
            id: 'metric-1',
            analyst_id: analystId,
            fork_type: 'user',
            metric_date: '2024-01-01',
            solo_pnl: metrics.solo_pnl,
            contribution_pnl: metrics.contribution_pnl,
            dissent_count: metrics.dissent_count,
            created_at: '2024-01-01T00:00:00Z',
          } as AnalystPerformanceMetrics;
        },
      );

      await service.calculateAndSaveDailyMetrics('user', '2024-01-01', 10000);

      // Analyst 1 (with $2000 P&L) should be rank 1
      const analyst1Metrics = savedMetrics.find(
        (m) => m.analystId === 'analyst-1',
      );
      const analyst2Metrics = savedMetrics.find(
        (m) => m.analystId === 'analyst-2',
      );

      expect(analyst1Metrics?.rank).toBe(1);
      expect(analyst2Metrics?.rank).toBe(2);
    });
  });

  describe('getAnalystPerformanceSummary', () => {
    it('should return aggregated metrics for an analyst', async () => {
      const mockMetrics: AnalystPerformanceMetrics[] = [
        {
          id: 'metric-1',
          analyst_id: 'analyst-1',
          fork_type: 'user',
          metric_date: '2024-01-01',
          solo_pnl: 1000,
          contribution_pnl: 500,
          dissent_accuracy: 0.8,
          dissent_count: 5,
          rank_in_portfolio: 1,
          total_analysts: 3,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'metric-2',
          analyst_id: 'analyst-1',
          fork_type: 'user',
          metric_date: '2024-01-02',
          solo_pnl: 500,
          contribution_pnl: 300,
          dissent_accuracy: 0.6,
          dissent_count: 5,
          rank_in_portfolio: 2,
          total_analysts: 3,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockPortfolioRepository.getPerformanceMetrics.mockResolvedValue(
        mockMetrics,
      );

      const result = await service.getAnalystPerformanceSummary(
        'analyst-1',
        'user',
        30,
      );

      expect(result.totalSoloPnl).toBe(1500);
      expect(result.totalContributionPnl).toBe(800);
      expect(result.totalDissentCount).toBe(10);
      // Weighted average: (0.8 * 5 + 0.6 * 5) / 10 = 0.7
      expect(result.avgDissentAccuracy).toBeCloseTo(0.7, 2);
      // Average rank: (1 + 2) / 2 = 1.5
      expect(result.avgRank).toBe(1.5);
      expect(result.metrics).toHaveLength(2);
    });

    it('should return zeros when no metrics found', async () => {
      mockPortfolioRepository.getPerformanceMetrics.mockResolvedValue([]);

      const result = await service.getAnalystPerformanceSummary(
        'analyst-1',
        'user',
        30,
      );

      expect(result.totalSoloPnl).toBe(0);
      expect(result.totalContributionPnl).toBe(0);
      expect(result.totalDissentCount).toBe(0);
      expect(result.avgDissentAccuracy).toBeUndefined();
      expect(result.avgRank).toBeUndefined();
      expect(result.metrics).toHaveLength(0);
    });

    it('should handle metrics without dissent data', async () => {
      const mockMetrics: AnalystPerformanceMetrics[] = [
        {
          id: 'metric-1',
          analyst_id: 'analyst-1',
          fork_type: 'user',
          metric_date: '2024-01-01',
          solo_pnl: 1000,
          contribution_pnl: 500,
          dissent_count: 0, // No dissents
          rank_in_portfolio: 1,
          total_analysts: 3,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockPortfolioRepository.getPerformanceMetrics.mockResolvedValue(
        mockMetrics,
      );

      const result = await service.getAnalystPerformanceSummary(
        'analyst-1',
        'user',
        30,
      );

      expect(result.avgDissentAccuracy).toBeUndefined();
    });
  });

  describe('getLeaderboard', () => {
    it('should return sorted leaderboard with analyst details', async () => {
      mockPortfolioRepository.getLatestPerformanceMetricsForAllAnalysts.mockResolvedValue(
        [
          {
            id: 'metric-1',
            analyst_id: 'analyst-1',
            fork_type: 'user',
            metric_date: '2024-01-01',
            solo_pnl: 2000,
            contribution_pnl: 1000,
            dissent_accuracy: 0.8,
            dissent_count: 5,
            rank_in_portfolio: 1,
            total_analysts: 2,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'metric-2',
            analyst_id: 'analyst-2',
            fork_type: 'user',
            metric_date: '2024-01-01',
            solo_pnl: 1000,
            contribution_pnl: 500,
            dissent_accuracy: 0.6,
            dissent_count: 3,
            rank_in_portfolio: 2,
            total_analysts: 2,
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      );

      mockAnalystRepository.getActive.mockResolvedValue([
        mockAnalyst1,
        mockAnalyst2,
      ]);

      const result = await service.getLeaderboard('user');

      expect(result).toHaveLength(2);
      expect(result[0]!.slug).toBe('technical-tina');
      expect(result[0]!.soloPnl).toBe(2000);
      expect(result[0]!.rank).toBe(1);
      expect(result[1]!.slug).toBe('sentiment-sam');
      expect(result[1]!.rank).toBe(2);
    });

    it('should return empty array when no metrics', async () => {
      mockPortfolioRepository.getLatestPerformanceMetricsForAllAnalysts.mockResolvedValue(
        [],
      );
      mockAnalystRepository.getActive.mockResolvedValue([]);

      const result = await service.getLeaderboard('user');

      expect(result).toHaveLength(0);
    });
  });

  describe('processPredictionOutcome', () => {
    it('should track dissents for both user and agent forks', async () => {
      const createActiveAnalyst = (
        id: string,
        slug: string,
        name: string,
        weight: number,
      ): ActiveAnalyst => ({
        analyst_id: id,
        slug,
        name,
        perspective: 'Test',
        effective_weight: weight,
        effective_tier: 'bronze',
        tier_instructions: {},
        learned_patterns: [],
        scope_level: 'runner',
      });

      const userAssessments: AnalystAssessmentResult[] = [
        {
          analyst: createActiveAnalyst(
            'analyst-1',
            'technical-tina',
            'Technical Tina',
            1.0,
          ),
          tier: 'bronze',
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Test',
          key_factors: [],
          risks: [],
          learnings_applied: [],
        },
        {
          analyst: createActiveAnalyst(
            'analyst-2',
            'sentiment-sam',
            'Sentiment Sam',
            0.8,
          ),
          tier: 'bronze',
          direction: 'bearish', // Dissenting
          confidence: 0.7,
          reasoning: 'Test',
          key_factors: [],
          risks: [],
          learnings_applied: [],
        },
      ];

      const agentAssessments: AnalystAssessmentResult[] = [
        {
          analyst: createActiveAnalyst(
            'analyst-1',
            'technical-tina',
            'Technical Tina',
            1.0,
          ),
          tier: 'bronze',
          direction: 'bearish', // Different from user fork
          confidence: 0.85,
          reasoning: 'Test',
          key_factors: [],
          risks: [],
          learnings_applied: [],
        },
      ];

      service.processPredictionOutcome(
        'prediction-1',
        'bullish',
        1000,
        userAssessments,
        agentAssessments,
      );

      const today = getToday();

      // User fork: analyst-2 dissented (bearish when majority was bullish)
      const userDissent = service.calculateDissentAccuracy(
        'analyst-2',
        'user',
        today,
      );
      expect(userDissent.count).toBe(1);
      expect(userDissent.accuracy).toBe(0); // Was wrong (bearish when actual was bullish)

      // Agent fork: analyst-1 had bearish (sole voter, so no dissent from their own vote)
      // But since there's only one assessment, the majority IS bearish
      const agentDissent = service.calculateDissentAccuracy(
        'analyst-1',
        'ai',
        today,
      );
      expect(agentDissent.count).toBe(0); // No dissent when agreeing with self
    });
  });

  describe('clearDissentRecords', () => {
    it('should clear all dissent records', () => {
      service.trackDissent({
        analystId: 'analyst-1',
        forkType: 'user',
        analystDirection: 'bullish',
        ensembleDirection: 'bearish',
        actualDirection: 'bullish',
      });

      const today = getToday();
      let result = service.calculateDissentAccuracy('analyst-1', 'user', today);
      expect(result.count).toBe(1);

      service.clearDissentRecords();

      result = service.calculateDissentAccuracy('analyst-1', 'user', today);
      expect(result.count).toBe(0);
    });
  });
});
