import { Test, TestingModule } from '@nestjs/testing';
import { SnapshotService } from '../snapshot.service';
import { SnapshotRepository } from '../../repositories/snapshot.repository';
import {
  PredictionSnapshot,
  SnapshotBuildInput,
  PredictorSnapshot,
  RejectedSignalSnapshot,
  LlmEnsembleSnapshot,
  ThresholdEvaluationSnapshot,
  TimelineEvent,
  LearningSnapshot,
} from '../../interfaces/snapshot.interface';

describe('SnapshotService', () => {
  let service: SnapshotService;
  let snapshotRepository: jest.Mocked<SnapshotRepository>;

  const mockPredictorSnapshot: PredictorSnapshot = {
    predictor_id: 'predictor-1',
    signal_content: 'Strong bullish signal',
    direction: 'up',
    strength: 8,
    confidence: 0.85,
    analyst_slug: 'test-analyst',
    created_at: new Date().toISOString(),
  };

  const mockRejectedSignal: RejectedSignalSnapshot = {
    signal_id: 'signal-2',
    content: 'Weak signal content',
    rejection_reason: 'Low confidence',
    confidence: 0.3,
    rejected_at: new Date().toISOString(),
  };

  const mockLlmEnsemble: LlmEnsembleSnapshot = {
    tiers_used: ['gold', 'silver'],
    tier_results: {
      gold: {
        direction: 'up',
        confidence: 0.9,
        model: 'gpt-4',
        provider: 'openai',
      },
      silver: {
        direction: 'up',
        confidence: 0.85,
        model: 'claude',
        provider: 'anthropic',
      },
    },
    agreement_level: 0.95,
  };

  const mockThresholdEval: ThresholdEvaluationSnapshot = {
    min_predictors: 3,
    actual_predictors: 5,
    min_combined_strength: 15,
    actual_combined_strength: 25,
    min_consensus: 0.6,
    actual_consensus: 0.8,
    passed: true,
  };

  const mockTimelineEvent: TimelineEvent = {
    timestamp: new Date().toISOString(),
    event_type: 'signal_received',
    details: { signal_id: 'signal-1' },
  };

  const mockSnapshot: PredictionSnapshot = {
    id: 'snapshot-123',
    prediction_id: 'pred-123',
    captured_at: new Date().toISOString(),
    predictors: [mockPredictorSnapshot],
    rejected_signals: [mockRejectedSignal],
    analyst_assessments: [],
    llm_ensemble: mockLlmEnsemble,
    learnings_applied: [],
    threshold_evaluation: mockThresholdEval,
    timeline: [mockTimelineEvent],
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnapshotService,
        {
          provide: SnapshotRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockSnapshot),
            findByPredictionId: jest.fn().mockResolvedValue(mockSnapshot),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<SnapshotService>(SnapshotService);
    snapshotRepository = module.get(SnapshotRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create a prediction snapshot', async () => {
      const createData = {
        prediction_id: 'pred-123',
        predictors: [mockPredictorSnapshot],
        rejected_signals: [mockRejectedSignal],
        analyst_assessments: [],
        llm_ensemble: mockLlmEnsemble,
        learnings_applied: [],
        threshold_evaluation: mockThresholdEval,
        timeline: [mockTimelineEvent],
      };

      const result = await service.createSnapshot(createData);

      expect(snapshotRepository.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockSnapshot);
    });

    it('should create snapshot with minimal data', async () => {
      const minimalData = {
        prediction_id: 'pred-456',
        predictors: [],
        rejected_signals: [],
        analyst_assessments: [],
        llm_ensemble: { tiers_used: [], tier_results: {}, agreement_level: 0 },
        learnings_applied: [],
        threshold_evaluation: {
          min_predictors: 0,
          actual_predictors: 0,
          min_combined_strength: 0,
          actual_combined_strength: 0,
          min_consensus: 0,
          actual_consensus: 0,
          passed: false,
        },
        timeline: [],
      };

      await service.createSnapshot(minimalData);

      expect(snapshotRepository.create).toHaveBeenCalledWith(minimalData);
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot for prediction', async () => {
      const result = await service.getSnapshot('pred-123');

      expect(snapshotRepository.findByPredictionId).toHaveBeenCalledWith(
        'pred-123',
      );
      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when not found', async () => {
      snapshotRepository.findByPredictionId.mockResolvedValue(null);

      const result = await service.getSnapshot('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('buildSnapshotData', () => {
    it('should build snapshot data from input', () => {
      const mockLearning: LearningSnapshot = {
        learning_id: 'learning-1',
        type: 'pattern',
        content: 'Test learning',
        scope: 'target',
        applied_to: 'analyst-1',
      };

      const input: SnapshotBuildInput = {
        predictionId: 'pred-123',
        predictorSnapshots: [mockPredictorSnapshot],
        rejectedSignals: [mockRejectedSignal],
        analystAssessments: [],
        llmEnsemble: mockLlmEnsemble,
        learnings: [mockLearning],
        thresholdEval: mockThresholdEval,
        timeline: [mockTimelineEvent],
      };

      const result = service.buildSnapshotData(input);

      expect(result.prediction_id).toBe('pred-123');
      expect(result.predictors).toEqual([mockPredictorSnapshot]);
      expect(result.rejected_signals).toEqual([mockRejectedSignal]);
      expect(result.analyst_assessments).toEqual([]);
      expect(result.llm_ensemble).toEqual(mockLlmEnsemble);
      expect(result.learnings_applied).toEqual([mockLearning]);
      expect(result.threshold_evaluation).toEqual(mockThresholdEval);
      expect(result.timeline).toEqual([mockTimelineEvent]);
    });

    it('should handle empty arrays', () => {
      const input: SnapshotBuildInput = {
        predictionId: 'pred-456',
        predictorSnapshots: [],
        rejectedSignals: [],
        analystAssessments: [],
        llmEnsemble: { tiers_used: [], tier_results: {}, agreement_level: 0 },
        learnings: [],
        thresholdEval: {
          min_predictors: 0,
          actual_predictors: 0,
          min_combined_strength: 0,
          actual_combined_strength: 0,
          min_consensus: 0,
          actual_consensus: 0,
          passed: false,
        },
        timeline: [],
      };

      const result = service.buildSnapshotData(input);

      expect(result.prediction_id).toBe('pred-456');
      expect(result.predictors).toEqual([]);
      expect(result.rejected_signals).toEqual([]);
    });

    it('should preserve all predictor snapshot fields', () => {
      const input: SnapshotBuildInput = {
        predictionId: 'pred-789',
        predictorSnapshots: [
          {
            predictor_id: 'pred-1',
            signal_content: 'Very strong bearish signal',
            direction: 'down',
            strength: 9,
            confidence: 0.95,
            analyst_slug: 'bear-analyst',
            created_at: new Date().toISOString(),
          },
        ],
        rejectedSignals: [],
        analystAssessments: [],
        llmEnsemble: mockLlmEnsemble,
        learnings: [],
        thresholdEval: mockThresholdEval,
        timeline: [],
      };

      const result = service.buildSnapshotData(input);

      expect(result.predictors[0]).toMatchObject({
        predictor_id: 'pred-1',
        direction: 'down',
        strength: 9,
        confidence: 0.95,
      });
    });
  });
});
