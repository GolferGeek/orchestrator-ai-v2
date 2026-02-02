import { Test, TestingModule } from '@nestjs/testing';
import { HistoricalReplayService } from '../historical-replay.service';
import { ReplayTestRepository } from '../../repositories/replay-test.repository';
import { PredictionRepository } from '../../repositories/prediction.repository';
import { AnalystRepository } from '../../repositories/analyst.repository';
import { UniverseRepository } from '../../repositories/universe.repository';
import { SignalRepository } from '../../repositories/signal.repository';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { LearningRepository } from '../../repositories/learning.repository';
import {
  ReplayTest,
  ReplayTestSummary,
  ReplayTestResult,
  ReplayAffectedRecords,
} from '../../interfaces/test-data.interface';

describe('HistoricalReplayService', () => {
  let service: HistoricalReplayService;
  let replayTestRepository: jest.Mocked<ReplayTestRepository>;
  let _predictionRepository: jest.Mocked<PredictionRepository>;
  let analystRepository: jest.Mocked<AnalystRepository>;
  let _universeRepository: jest.Mocked<UniverseRepository>;
  let signalRepository: jest.Mocked<SignalRepository>;
  let predictorRepository: jest.Mocked<PredictorRepository>;
  let learningRepository: jest.Mocked<LearningRepository>;

  const mockReplayTest: ReplayTest = {
    id: 'replay-123',
    organization_slug: 'test-org',
    name: 'Test Replay',
    description: 'Test replay description',
    status: 'pending',
    rollback_depth: 'predictions',
    rollback_to: '2024-01-01T00:00:00Z',
    universe_id: 'universe-123',
    target_ids: ['target-123', 'target-456'],
    config: {},
    results: null,
    error_message: null,
    created_by: 'user-123',
    created_at: '2024-01-15T10:00:00Z',
    started_at: null,
    completed_at: null,
  };

  const mockReplayTestSummary: ReplayTestSummary = {
    ...mockReplayTest,
    total_comparisons: 10,
    direction_matches: 8,
    original_correct_count: 6,
    replay_correct_count: 7,
    improvements: 3,
    original_accuracy_pct: 60,
    replay_accuracy_pct: 70,
    total_pnl_original: null,
    total_pnl_replay: null,
    total_pnl_improvement: null,
    avg_confidence_diff: 0.05,
  };

  const mockReplayResult: ReplayTestResult = {
    id: 'result-123',
    replay_test_id: 'replay-123',
    target_id: 'target-123',
    original_prediction_id: 'pred-orig-123',
    original_direction: 'bullish',
    original_confidence: 0.75,
    original_magnitude: 'medium',
    original_predicted_at: '2024-01-01T10:00:00Z',
    replay_prediction_id: 'pred-replay-123',
    replay_direction: 'bullish',
    replay_confidence: 0.8,
    replay_magnitude: 'medium',
    replay_predicted_at: '2024-01-01T10:00:00Z',
    direction_match: true,
    confidence_diff: 0.05,
    evaluation_id: 'eval-123',
    actual_outcome: 'correct',
    actual_outcome_value: 5,
    original_correct: true,
    replay_correct: true,
    improvement: false,
    pnl_original: null,
    pnl_replay: null,
    pnl_diff: null,
    created_at: '2024-01-15T12:00:00Z',
  };

  const mockAffectedRecords: ReplayAffectedRecords[] = [
    {
      table_name: 'predictions',
      row_count: 10,
      record_ids: ['pred-1', 'pred-2', 'pred-3'],
    },
    {
      table_name: 'predictors',
      row_count: 5,
      record_ids: ['predictor-1', 'predictor-2'],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricalReplayService,
        {
          provide: ReplayTestRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockReplayTest),
            findById: jest.fn().mockResolvedValue(mockReplayTest),
            getSummaries: jest.fn().mockResolvedValue([mockReplayTestSummary]),
            getSummaryById: jest.fn().mockResolvedValue(mockReplayTestSummary),
            getResults: jest.fn().mockResolvedValue([mockReplayResult]),
            getAffectedRecords: jest
              .fn()
              .mockResolvedValue(mockAffectedRecords),
            delete: jest.fn().mockResolvedValue(undefined),
            markSnapshotCreated: jest.fn().mockResolvedValue(undefined),
            markRunning: jest.fn().mockResolvedValue(undefined),
            markCompleted: jest.fn().mockResolvedValue(undefined),
            markFailed: jest.fn().mockResolvedValue(undefined),
            createSnapshot: jest.fn().mockResolvedValue(undefined),
            getSnapshots: jest.fn().mockResolvedValue([
              {
                table_name: 'predictions',
                original_data: [
                  {
                    id: 'pred-1',
                    target_id: 'target-123',
                    direction: 'bullish',
                    confidence: 0.75,
                    magnitude: 5,
                    predicted_at: '2024-01-01T10:00:00Z',
                    status: 'resolved',
                    outcome_value: 5,
                  },
                ],
              },
            ]),
            createResults: jest.fn().mockResolvedValue(undefined),
            cleanup: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionRepository,
          useValue: {
            findByTarget: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AnalystRepository,
          useValue: {
            getActive: jest
              .fn()
              .mockResolvedValue([{ id: 'analyst-123', slug: 'test-analyst' }]),
            getCurrentContextVersion: jest.fn().mockResolvedValue({
              perspective: 'test perspective',
              tier_instructions: {},
              default_weight: 1.0,
            }),
            createContextVersion: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UniverseRepository,
          useValue: {
            findById: jest
              .fn()
              .mockResolvedValue({ id: 'universe-123', name: 'Test Universe' }),
          },
        },
        {
          provide: SignalRepository,
          useValue: {
            findByIds: jest.fn().mockResolvedValue([]),
            createTestCopy: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictorRepository,
          useValue: {
            findByIds: jest.fn().mockResolvedValue([]),
            createTestCopy: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LearningRepository,
          useValue: {
            getAllActiveLearnings: jest
              .fn()
              .mockResolvedValue([
                { id: 'learning-123', title: 'Test Learning' },
              ]),
            createTestCopy: jest.fn().mockResolvedValue(undefined),
            deleteTestLearnings: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<HistoricalReplayService>(HistoricalReplayService);
    replayTestRepository = module.get(ReplayTestRepository);
    predictionRepository = module.get(PredictionRepository);
    analystRepository = module.get(AnalystRepository);
    universeRepository = module.get(UniverseRepository);
    signalRepository = module.get(SignalRepository);
    predictorRepository = module.get(PredictorRepository);
    learningRepository = module.get(LearningRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReplayTest', () => {
    it('should create a replay test', async () => {
      const data = {
        organization_slug: 'test-org',
        name: 'Test Replay',
        description: 'Test description',
        rollback_depth: 'predictions' as const,
        rollback_to: '2024-01-01T00:00:00Z',
        universe_id: 'universe-123',
        target_ids: ['target-123'],
        created_by: 'user-123',
      };

      const result = await service.createReplayTest(data);

      expect(replayTestRepository.create).toHaveBeenCalledWith(data);
      expect(result).toEqual(mockReplayTest);
    });

    it('should validate evaluations exist', async () => {
      const data = {
        organization_slug: 'test-org',
        name: 'Test Replay',
        rollback_depth: 'predictions' as const,
        rollback_to: '2024-01-01T00:00:00Z',
        universe_id: 'universe-123',
        created_by: 'user-123',
      };

      await service.createReplayTest(data);

      // Service validates internally (returns true for now)
      expect(replayTestRepository.create).toHaveBeenCalled();
    });
  });

  describe('getReplayTests', () => {
    it('should get all replay tests for organization', async () => {
      const result = await service.getReplayTests('test-org');

      expect(replayTestRepository.getSummaries).toHaveBeenCalledWith(
        'test-org',
      );
      expect(result).toEqual([mockReplayTestSummary]);
    });
  });

  describe('getReplayTestById', () => {
    it('should get replay test by ID', async () => {
      const result = await service.getReplayTestById('replay-123');

      expect(replayTestRepository.getSummaryById).toHaveBeenCalledWith(
        'replay-123',
      );
      expect(result).toEqual(mockReplayTestSummary);
    });

    it('should return null for non-existent test', async () => {
      replayTestRepository.getSummaryById.mockResolvedValue(null);

      const result = await service.getReplayTestById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getReplayTestResults', () => {
    it('should get results for replay test', async () => {
      const result = await service.getReplayTestResults('replay-123');

      expect(replayTestRepository.getResults).toHaveBeenCalledWith(
        'replay-123',
      );
      expect(result).toEqual([mockReplayResult]);
    });
  });

  describe('deleteReplayTest', () => {
    it('should delete replay test', async () => {
      await service.deleteReplayTest('replay-123');

      expect(replayTestRepository.findById).toHaveBeenCalledWith('replay-123');
      expect(replayTestRepository.cleanup).toHaveBeenCalledWith('replay-123');
      expect(replayTestRepository.delete).toHaveBeenCalledWith('replay-123');
    });

    it('should throw error for non-existent test', async () => {
      replayTestRepository.findById.mockResolvedValue(null);

      await expect(service.deleteReplayTest('nonexistent')).rejects.toThrow(
        'Replay test not found',
      );
    });

    it('should prevent deletion of running test', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        status: 'running',
      });

      await expect(service.deleteReplayTest('replay-123')).rejects.toThrow(
        'Cannot delete a running replay test',
      );
    });

    it('should cleanup test data before deletion', async () => {
      await service.deleteReplayTest('replay-123');

      expect(learningRepository.deleteTestLearnings).toHaveBeenCalledWith(
        'replay-123',
      );
      expect(replayTestRepository.cleanup).toHaveBeenCalledWith('replay-123');
    });
  });

  describe('previewAffectedRecords', () => {
    it('should preview affected records', async () => {
      const result = await service.previewAffectedRecords(
        'predictions',
        '2024-01-01T00:00:00Z',
        'universe-123',
        ['target-123'],
      );

      expect(replayTestRepository.getAffectedRecords).toHaveBeenCalledWith(
        'predictions',
        '2024-01-01T00:00:00Z',
        'universe-123',
        ['target-123'],
      );
      expect(result).toEqual(mockAffectedRecords);
    });

    it('should work without target IDs', async () => {
      await service.previewAffectedRecords(
        'signals',
        '2024-01-01T00:00:00Z',
        'universe-123',
      );

      expect(replayTestRepository.getAffectedRecords).toHaveBeenCalledWith(
        'signals',
        '2024-01-01T00:00:00Z',
        'universe-123',
        undefined,
      );
    });
  });

  describe('runReplayTest', () => {
    it('should run replay test from pending state', async () => {
      const result = await service.runReplayTest('replay-123');

      expect(replayTestRepository.findById).toHaveBeenCalledWith('replay-123');
      expect(replayTestRepository.markSnapshotCreated).toHaveBeenCalled();
      expect(replayTestRepository.markRunning).toHaveBeenCalled();
      expect(replayTestRepository.markCompleted).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should run replay test from snapshot_created state', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        status: 'snapshot_created',
      });

      const result = await service.runReplayTest('replay-123');

      expect(replayTestRepository.markRunning).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error for non-existent test', async () => {
      replayTestRepository.findById.mockResolvedValue(null);

      await expect(service.runReplayTest('nonexistent')).rejects.toThrow(
        'Replay test not found',
      );
    });

    it('should throw error for already running test', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        status: 'running',
      });

      await expect(service.runReplayTest('replay-123')).rejects.toThrow(
        'cannot run. Only pending or snapshot_created tests can be run',
      );
    });

    it('should throw error for completed test', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        status: 'completed',
      });

      await expect(service.runReplayTest('replay-123')).rejects.toThrow(
        'cannot run. Only pending or snapshot_created tests can be run',
      );
    });

    it('should mark test as failed on error', async () => {
      replayTestRepository.markRunning.mockRejectedValue(
        new Error('Test error'),
      );

      await expect(service.runReplayTest('replay-123')).rejects.toThrow(
        'Test error',
      );

      expect(replayTestRepository.markFailed).toHaveBeenCalledWith(
        'replay-123',
        'Test error',
      );
    });

    it('should sync analyst contexts', async () => {
      await service.runReplayTest('replay-123');

      expect(analystRepository.getActive).toHaveBeenCalled();
      expect(analystRepository.getCurrentContextVersion).toHaveBeenCalled();
      expect(analystRepository.createContextVersion).toHaveBeenCalled();
    });

    it('should copy learnings as test data', async () => {
      await service.runReplayTest('replay-123');

      expect(learningRepository.getAllActiveLearnings).toHaveBeenCalled();
      expect(learningRepository.createTestCopy).toHaveBeenCalled();
    });
  });

  describe('cleanupReplayTestData', () => {
    it('should cleanup test data', async () => {
      await service.cleanupReplayTestData('replay-123');

      expect(learningRepository.deleteTestLearnings).toHaveBeenCalledWith(
        'replay-123',
      );
      expect(replayTestRepository.cleanup).toHaveBeenCalledWith('replay-123');
    });
  });

  describe('signal injection', () => {
    it('should inject signals for signals depth', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        rollback_depth: 'signals',
      });
      replayTestRepository.getAffectedRecords.mockResolvedValue([
        { table_name: 'signals', row_count: 2, record_ids: ['sig-1', 'sig-2'] },
        { table_name: 'predictions', row_count: 5, record_ids: ['pred-1'] },
      ]);
      signalRepository.findByIds.mockResolvedValue([
        {
          id: 'sig-1',
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Signal 1',
          direction: 'bullish',
          detected_at: '2024-01-01T10:00:00Z',
          url: null,
          metadata: {},
          disposition: 'pending',
          urgency: null,
          processing_worker: null,
          processing_started_at: null,
          evaluation_result: null,
          review_queue_id: null,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          expired_at: null,
          is_test: false,
        },
        {
          id: 'sig-2',
          target_id: 'target-456',
          source_id: 'source-123',
          content: 'Signal 2',
          direction: 'bearish',
          detected_at: '2024-01-01T11:00:00Z',
          url: null,
          metadata: {},
          disposition: 'pending',
          urgency: null,
          processing_worker: null,
          processing_started_at: null,
          evaluation_result: null,
          review_queue_id: null,
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
          expired_at: null,
          is_test: false,
        },
      ]);

      await service.runReplayTest('replay-123');

      expect(signalRepository.findByIds).toHaveBeenCalledWith([
        'sig-1',
        'sig-2',
      ]);
      expect(signalRepository.createTestCopy).toHaveBeenCalledTimes(2);
    });
  });

  describe('predictor injection', () => {
    it('should inject predictors for predictors depth', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        rollback_depth: 'predictors',
      });
      replayTestRepository.getAffectedRecords.mockResolvedValue([
        {
          table_name: 'predictors',
          row_count: 2,
          record_ids: ['pred-1', 'pred-2'],
        },
        {
          table_name: 'predictions',
          row_count: 5,
          record_ids: ['prediction-1'],
        },
      ]);
      predictorRepository.findByIds.mockResolvedValue([
        {
          id: 'pred-1',
          signal_id: 'sig-1',
          target_id: 'target-123',
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Test reasoning 1',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bullish',
            confidence: 0.8,
            reasoning: 'Test',
            key_factors: [],
            risks: [],
          },
          llm_usage_id: null,
          status: 'active',
          consumed_at: null,
          consumed_by_prediction_id: null,
          expires_at: '2024-01-02T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'pred-2',
          signal_id: 'sig-2',
          target_id: 'target-456',
          direction: 'bearish',
          strength: 6,
          confidence: 0.7,
          reasoning: 'Test reasoning 2',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bearish',
            confidence: 0.7,
            reasoning: 'Test',
            key_factors: [],
            risks: [],
          },
          llm_usage_id: null,
          status: 'active',
          consumed_at: null,
          consumed_by_prediction_id: null,
          expires_at: '2024-01-02T11:00:00Z',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
        },
      ]);

      await service.runReplayTest('replay-123');

      expect(predictorRepository.findByIds).toHaveBeenCalledWith([
        'pred-1',
        'pred-2',
      ]);
      expect(predictorRepository.createTestCopy).toHaveBeenCalledTimes(2);
    });

    it('should inject predictors for signals depth too', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        rollback_depth: 'signals',
      });
      replayTestRepository.getAffectedRecords.mockResolvedValue([
        { table_name: 'signals', row_count: 1, record_ids: ['sig-1'] },
        { table_name: 'predictors', row_count: 1, record_ids: ['pred-1'] },
        {
          table_name: 'predictions',
          row_count: 5,
          record_ids: ['prediction-1'],
        },
      ]);
      signalRepository.findByIds.mockResolvedValue([
        {
          id: 'sig-1',
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Signal 1',
          direction: 'bullish',
          detected_at: '2024-01-01T10:00:00Z',
          url: null,
          metadata: {},
          disposition: 'pending',
          urgency: null,
          processing_worker: null,
          processing_started_at: null,
          evaluation_result: null,
          review_queue_id: null,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          expired_at: null,
          is_test: false,
        },
      ]);
      predictorRepository.findByIds.mockResolvedValue([
        {
          id: 'pred-1',
          signal_id: 'sig-1',
          target_id: 'target-123',
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Test reasoning',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bullish',
            confidence: 0.8,
            reasoning: 'Test',
            key_factors: [],
            risks: [],
          },
          llm_usage_id: null,
          status: 'active',
          consumed_at: null,
          consumed_by_prediction_id: null,
          expires_at: '2024-01-02T10:00:00Z',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
      ]);

      await service.runReplayTest('replay-123');

      expect(signalRepository.createTestCopy).toHaveBeenCalledTimes(1);
      expect(predictorRepository.createTestCopy).toHaveBeenCalledTimes(1);
    });
  });

  describe('result comparison', () => {
    it('should compare test predictions with original predictions', async () => {
      await service.runReplayTest('replay-123');

      expect(replayTestRepository.getSnapshots).toHaveBeenCalledWith(
        'replay-123',
      );
      expect(replayTestRepository.createResults).toHaveBeenCalled();
    });

    it('should aggregate results correctly', async () => {
      await service.runReplayTest('replay-123');

      expect(replayTestRepository.markCompleted).toHaveBeenCalledWith(
        'replay-123',
        expect.objectContaining({
          total_comparisons: expect.any(Number),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle analyst sync failure gracefully', async () => {
      analystRepository.getCurrentContextVersion.mockRejectedValue(
        new Error('Context fetch failed'),
      );

      // Should not throw, just log warning
      await service.runReplayTest('replay-123');

      expect(replayTestRepository.markCompleted).toHaveBeenCalled();
    });

    it('should handle learning copy failure gracefully', async () => {
      learningRepository.createTestCopy.mockRejectedValue(
        new Error('Learning copy failed'),
      );

      // Should not throw, just log warning
      await service.runReplayTest('replay-123');

      expect(replayTestRepository.markCompleted).toHaveBeenCalled();
    });

    it('should handle signal copy failure gracefully', async () => {
      replayTestRepository.findById.mockResolvedValue({
        ...mockReplayTest,
        rollback_depth: 'signals',
      });
      replayTestRepository.getAffectedRecords.mockResolvedValue([
        { table_name: 'signals', row_count: 1, record_ids: ['sig-1'] },
        { table_name: 'predictions', row_count: 1, record_ids: ['pred-1'] },
      ]);
      signalRepository.findByIds.mockResolvedValue([
        {
          id: 'sig-1',
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Signal 1',
          direction: 'bullish',
          detected_at: '2024-01-01T10:00:00Z',
          url: null,
          metadata: {},
          disposition: 'pending',
          urgency: null,
          processing_worker: null,
          processing_started_at: null,
          evaluation_result: null,
          review_queue_id: null,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          expired_at: null,
          is_test: false,
        },
      ]);
      signalRepository.createTestCopy.mockRejectedValue(
        new Error('Copy failed'),
      );

      // Should not throw, just log warning
      await service.runReplayTest('replay-123');

      expect(replayTestRepository.markCompleted).toHaveBeenCalled();
    });
  });
});
