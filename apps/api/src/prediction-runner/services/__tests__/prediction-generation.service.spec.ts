import { Test, TestingModule } from '@nestjs/testing';
import { PredictionGenerationService } from '../prediction-generation.service';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { PortfolioRepository } from '../../repositories/portfolio.repository';
import { TargetSnapshotRepository } from '../../repositories/target-snapshot.repository';
import { PredictorManagementService } from '../predictor-management.service';
import { SnapshotService } from '../snapshot.service';
import { AnalystEnsembleService } from '../analyst-ensemble.service';
import { TargetService } from '../target.service';
import { AnalystPositionService } from '../analyst-position.service';
import { TestPriceDataRouterService } from '../test-price-data-router.service';
import { TestTargetMirrorService } from '../test-target-mirror.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { Prediction } from '../../interfaces/prediction.interface';
import { Predictor } from '../../interfaces/predictor.interface';
import { Target } from '../../interfaces/target.interface';
import {
  ThresholdEvaluationResult,
  ThresholdConfig,
} from '../../interfaces/threshold-evaluation.interface';

describe('PredictionGenerationService', () => {
  let service: PredictionGenerationService;
  let predictionRepository: jest.Mocked<PredictionRepository>;
  let portfolioRepository: jest.Mocked<PortfolioRepository>;
  let predictorManagementService: jest.Mocked<PredictorManagementService>;
  let snapshotService: jest.Mocked<SnapshotService>;
  let ensembleService: jest.Mocked<AnalystEnsembleService>;
  let targetService: jest.Mocked<TargetService>;

  const mockContext: ExecutionContext = {
    userId: 'user-123',
    orgSlug: 'test-org',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: '',
    agentSlug: 'prediction-runner',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    name: 'Apple Inc',
    target_type: 'stock',
    symbol: 'AAPL',
    context: 'Large cap tech company',
    is_active: true,
    is_archived: false,
    llm_config_override: null,
    metadata: {},
    current_price: 150.0,
    price_updated_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockPredictor: Predictor = {
    id: 'predictor-123',
    target_id: 'target-123',
    article_id: 'article-123',
    analyst_slug: 'technical-analyst',
    direction: 'bullish',
    strength: 8,
    confidence: 0.85,
    reasoning: 'Strong technical indicators',
    analyst_assessment: {
      direction: 'bullish',
      confidence: 0.85,
      reasoning: 'Strong technical indicators',
      key_factors: ['volume spike', 'RSI breakout'],
      risks: ['market volatility'],
    },
      fork_type: null,
    llm_usage_id: null,
    status: 'active',
    consumed_at: null,
    consumed_by_prediction_id: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockPrediction: Prediction = {
    id: 'prediction-123',
    target_id: 'target-123',
    task_id: null,
    direction: 'up',
    magnitude: 'medium',
    confidence: 0.75,
    timeframe_hours: 24,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    predicted_at: new Date().toISOString(),
    reasoning: 'Strong bullish signals from technical analysis',
    analyst_ensemble: {
      predictor_count: 3,
      combined_strength: 22,
      direction_consensus: 0.85,
    },
    llm_ensemble: {
      direction: 'bullish',
      confidence: 0.78,
    },
    status: 'active',
    entry_price: null,
    target_price: null,
    stop_loss: null,
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockThresholdResult: ThresholdEvaluationResult = {
    meetsThreshold: true,
    activeCount: 3,
    combinedStrength: 22,
    directionConsensus: 0.85,
    dominantDirection: 'bullish',
    details: {
      bullishCount: 3,
      bearishCount: 0,
      neutralCount: 0,
      avgConfidence: 0.8,
      weightedBullish: 3.0,
      weightedBearish: 0,
      weightedNeutral: 0,
      totalWeight: 3.0,
    },
  };

  const mockEnsembleResult = {
    assessments: [
      {
        analyst: {
          analyst_id: 'analyst-1',
          slug: 'technical-analyst',
          name: 'Technical Analyst',
          perspective: 'Chart patterns and indicators',
          effective_weight: 1.0,
          effective_tier: 'gold' as const,
          tier_instructions: {},
          learned_patterns: [],
          scope_level: 'runner' as const,
        },
        direction: 'bullish',
        confidence: 0.85,
        reasoning: 'Strong technical breakout pattern',
        key_factors: ['RSI above 70', 'Volume spike'],
        risks: ['Overbought conditions'],
        tier: 'gold' as const,
        learnings_applied: [],
      },
    ],
    aggregated: {
      direction: 'bullish',
      confidence: 0.85,
      reasoning: 'Consensus bullish from technical analysis',
      consensus_strength: 0.9,
    },
  };

  const mockForkAggregatedResult = {
    direction: 'bullish',
    confidence: 0.85,
    reasoning: 'Consensus bullish from technical analysis',
    consensus_strength: 0.9,
  };

  const mockThreeWayResult = {
    userForkAssessments: mockEnsembleResult.assessments,
    aiForkAssessments: mockEnsembleResult.assessments,
    arbitratorForkAssessments: mockEnsembleResult.assessments,
    userForkAggregated: mockForkAggregatedResult,
    aiForkAggregated: mockForkAggregatedResult,
    arbitratorForkAggregated: mockForkAggregatedResult,
    final: mockEnsembleResult,
    metadata: {
      totalAnalysts: 1,
      userVsAiAgreement: 1.0,
      arbitratorAgreesWithUser: 1.0,
      arbitratorAgreesWithAi: 1.0,
    },
  };

  const mockThresholdConfig: ThresholdConfig = {
    min_predictors: 3,
    min_combined_strength: 15,
    min_direction_consensus: 0.6,
    predictor_ttl_hours: 24,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionGenerationService,
        {
          provide: PredictionRepository,
          useValue: {
            findByTarget: jest.fn(),
            findByTargetAndAnalyst: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
            updateAnalystEnsemble: jest.fn(),
          },
        },
        {
          provide: PortfolioRepository,
          useValue: {
            getUserPortfolio: jest.fn(),
            getCurrentRunnerContextVersion: jest.fn(),
            getCurrentUniverseContextVersion: jest.fn(),
            getCurrentTargetContextVersion: jest.fn(),
            getAllCurrentAnalystContextVersions: jest.fn(),
          },
        },
        {
          provide: TargetSnapshotRepository,
          useValue: {},
        },
        {
          provide: PredictorManagementService,
          useValue: {
            evaluateThreshold: jest.fn(),
            getActivePredictors: jest.fn(),
            consumePredictors: jest.fn(),
          },
        },
        {
          provide: SnapshotService,
          useValue: {
            buildSnapshotData: jest.fn().mockReturnValue({}),
            createSnapshot: jest.fn(),
          },
        },
        {
          provide: AnalystEnsembleService,
          useValue: {
            runThreeWayForkEnsemble: jest.fn(),
          },
        },
        {
          provide: TargetService,
          useValue: {
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AnalystPositionService,
          useValue: {
            createPositionFromAssessment: jest.fn(),
          },
        },
        {
          provide: TestPriceDataRouterService,
          useValue: {
            getLatestPrice: jest.fn().mockResolvedValue({ data: null }),
          },
        },
        {
          provide: TestTargetMirrorService,
          useValue: {
            getTestSymbol: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<PredictionGenerationService>(
      PredictionGenerationService,
    );
    predictionRepository = module.get(PredictionRepository);
    portfolioRepository = module.get(PortfolioRepository);
    predictorManagementService = module.get(PredictorManagementService);
    snapshotService = module.get(SnapshotService);
    ensembleService = module.get(AnalystEnsembleService);
    targetService = module.get(TargetService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('attemptPredictionGeneration', () => {
    it('should return null when threshold is not met', async () => {
      predictionRepository.findByTarget.mockResolvedValue([]);
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        ...mockThresholdResult,
        meetsThreshold: false,
      });

      const result = await service.attemptPredictionGeneration(
        mockContext,
        'target-123',
      );

      expect(result).toBeNull();
    });


    it('should refresh prediction when confidence shifts significantly', async () => {
      const existingPrediction: Prediction = {
        ...mockPrediction,
        is_arbitrator: false,
        analyst_slug: 'technical-analyst',
        confidence: 0.5, // Low confidence, will trigger refresh
      };
      predictionRepository.findByTarget.mockResolvedValue([existingPrediction]);
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        ...mockThresholdResult,
        directionConsensus: 0.95, // High consensus will cause confidence shift
        details: {
          ...mockThresholdResult.details,
          avgConfidence: 0.9,
        },
      });
      targetService.findByIdOrThrow.mockResolvedValue(mockTarget);
      predictorManagementService.getActivePredictors.mockResolvedValue([
        mockPredictor,
      ]);
      ensembleService.runThreeWayForkEnsemble.mockResolvedValue(
        mockThreeWayResult,
      );
      predictionRepository.update.mockResolvedValue({
        ...existingPrediction,
        confidence: 0.85,
      });

      const result = await service.attemptPredictionGeneration(
        mockContext,
        'target-123',
      );

      expect(result).toBeDefined();
      expect(predictionRepository.update).toHaveBeenCalled();
    });

    it('should refresh prediction when direction changes', async () => {
      const existingPrediction: Prediction = {
        ...mockPrediction,
        is_arbitrator: false,
        analyst_slug: 'technical-analyst',
        direction: 'down', // Existing direction is down
      };
      predictionRepository.findByTarget.mockResolvedValue([existingPrediction]);
      predictorManagementService.evaluateThreshold.mockResolvedValue({
        ...mockThresholdResult,
        dominantDirection: 'bullish', // New direction is bullish (up)
      });
      targetService.findByIdOrThrow.mockResolvedValue(mockTarget);
      predictorManagementService.getActivePredictors.mockResolvedValue([
        mockPredictor,
      ]);
      ensembleService.runThreeWayForkEnsemble.mockResolvedValue(
        mockThreeWayResult,
      );
      predictionRepository.update.mockResolvedValue({
        ...existingPrediction,
        direction: 'up',
      });

      const result = await service.attemptPredictionGeneration(
        mockContext,
        'target-123',
      );

      expect(result).toBeDefined();
      expect(predictionRepository.update).toHaveBeenCalled();
    });
  });

});
