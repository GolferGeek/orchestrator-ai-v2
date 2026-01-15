import { Test, TestingModule } from '@nestjs/testing';
import { BatchPredictionGeneratorRunner } from '../batch-prediction-generator.runner';
import { TargetRepository } from '../../repositories/target.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { PredictionGenerationService } from '../../services/prediction-generation.service';
import { PredictorManagementService } from '../../services/predictor-management.service';
import { StrategyService } from '../../services/strategy.service';

describe('BatchPredictionGeneratorRunner', () => {
  let runner: BatchPredictionGeneratorRunner;
  let targetRepository: jest.Mocked<TargetRepository>;
  let universeRepository: jest.Mocked<UniverseRepository>;
  let predictionGenerationService: jest.Mocked<PredictionGenerationService>;
  let predictorManagementService: jest.Mocked<PredictorManagementService>;
  let strategyService: jest.Mocked<StrategyService>;

  const mockUniverse = {
    id: 'universe-1',
    name: 'Test Universe',
    domain: 'stocks',
    organization_slug: 'test-org',
    agent_slug: 'test-agent',
    strategy_id: 'strategy-1',
    config: {},
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTarget = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    target_type: 'stock',
    context: 'Apple technology company',
    config: {},
    is_active: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPrediction = {
    id: 'prediction-1',
    target_id: 'target-1',
    task_id: null,
    direction: 'up' as const,
    magnitude: 'medium' as const,
    confidence: 0.75,
    timeframe_hours: 24,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    predicted_at: new Date().toISOString(),
    reasoning: 'Strong bullish signals',
    analyst_ensemble: {},
    llm_ensemble: {},
    status: 'active' as const,
    entry_price: null,
    target_price: null,
    stop_loss: null,
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockStrategy = {
    id: 'strategy-1',
    slug: 'balanced',
    name: 'Balanced',
    description: 'Balanced strategy',
    risk_level: 'medium' as const,
    parameters: {
      min_predictors: 3,
      min_combined_strength: 15,
      min_direction_consensus: 0.6,
      predictor_ttl_hours: 48,
      urgent_threshold: 0.9,
      notable_threshold: 0.75,
      tier_preference: 'ensemble' as const,
      analyst_weights: {},
    },
    is_system: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockAppliedStrategy = {
    strategy: mockStrategy,
    effective_parameters: {
      ...mockStrategy.parameters,
      custom_rules: [],
    },
    source: 'strategy' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchPredictionGeneratorRunner,
        {
          provide: TargetRepository,
          useValue: {
            findActiveByUniverse: jest.fn(),
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findAllActive: jest.fn(),
          },
        },
        {
          provide: PredictionGenerationService,
          useValue: {
            attemptPredictionGeneration: jest.fn(),
          },
        },
        {
          provide: PredictorManagementService,
          useValue: {
            evaluateThreshold: jest.fn(),
            getPredictorStats: jest.fn(),
          },
        },
        {
          provide: StrategyService,
          useValue: {
            findById: jest.fn(),
            getAppliedStrategy: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<BatchPredictionGeneratorRunner>(
      BatchPredictionGeneratorRunner,
    );
    targetRepository = module.get(TargetRepository);
    universeRepository = module.get(UniverseRepository);
    predictionGenerationService = module.get(PredictionGenerationService);
    predictorManagementService = module.get(PredictorManagementService);
    strategyService = module.get(StrategyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runBatchGeneration', () => {
    it('should generate prediction when threshold is met', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      strategyService.getAppliedStrategy.mockResolvedValue(mockAppliedStrategy);
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        meetsThreshold: true,
        activeCount: 5,
        combinedStrength: 25,
        directionConsensus: 0.8,
        dominantDirection: 'bullish',
        details: {
          bullishCount: 4,
          bearishCount: 1,
          neutralCount: 0,
          avgConfidence: 0.75,
        },
      });
      predictionGenerationService.attemptPredictionGeneration.mockResolvedValue(
        mockPrediction,
      );

      const result = await runner.runBatchGeneration();

      expect(result.targetsEvaluated).toBe(1);
      expect(result.predictionsCreated).toBe(1);
      expect(result.thresholdsNotMet).toBe(0);
    });

    it('should not generate prediction when threshold is not met', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      strategyService.getAppliedStrategy.mockResolvedValue(mockAppliedStrategy);
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        meetsThreshold: false,
        activeCount: 2,
        combinedStrength: 10,
        directionConsensus: 0.5,
        dominantDirection: 'neutral',
        details: {
          bullishCount: 1,
          bearishCount: 1,
          neutralCount: 0,
          avgConfidence: 0.5,
        },
      });

      const result = await runner.runBatchGeneration();

      expect(result.targetsEvaluated).toBe(1);
      expect(result.predictionsCreated).toBe(0);
      expect(result.thresholdsNotMet).toBe(1);
      expect(
        predictionGenerationService.attemptPredictionGeneration,
      ).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      universeRepository.findAllActive.mockResolvedValue([
        mockUniverse as never,
      ]);
      targetRepository.findActiveByUniverse.mockResolvedValue([
        mockTarget as never,
      ]);
      strategyService.getAppliedStrategy.mockResolvedValue(mockAppliedStrategy);
      predictorManagementService.evaluateThreshold.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await runner.runBatchGeneration();

      expect(result.errors).toBe(1);
    });
  });

  describe('generateForTargetManually', () => {
    it('should generate prediction for a specific target', async () => {
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget as never);
      predictionGenerationService.attemptPredictionGeneration.mockResolvedValue(
        mockPrediction,
      );

      const result = await runner.generateForTargetManually('target-1');

      expect(result.success).toBe(true);
      expect(result.predictionId).toBe('prediction-1');
    });

    it('should return error when threshold not met', async () => {
      targetRepository.findByIdOrThrow.mockResolvedValue(mockTarget as never);
      predictionGenerationService.attemptPredictionGeneration.mockResolvedValue(
        null,
      );

      const result = await runner.generateForTargetManually('target-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Threshold not met');
    });
  });

  describe('getTargetStats', () => {
    it('should return predictor stats for a target', async () => {
      predictorManagementService.getPredictorStats.mockResolvedValue({
        activeCount: 5,
        totalStrength: 25,
        avgConfidence: 0.75,
        byDirection: { bullish: 4, bearish: 1, neutral: 0 },
      });
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        meetsThreshold: true,
        activeCount: 5,
        combinedStrength: 25,
        directionConsensus: 0.8,
        dominantDirection: 'bullish',
        details: {
          bullishCount: 4,
          bearishCount: 1,
          neutralCount: 0,
          avgConfidence: 0.75,
        },
      });

      const result = await runner.getTargetStats('target-1');

      expect(result.activeCount).toBe(5);
      expect(result.meetsThreshold).toBe(true);
    });
  });
});
