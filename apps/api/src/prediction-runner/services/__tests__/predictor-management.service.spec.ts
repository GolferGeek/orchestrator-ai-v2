import { Test, TestingModule } from '@nestjs/testing';
import { PredictorManagementService } from '../predictor-management.service';
import { PredictorRepository } from '../../repositories/predictor.repository';
import { Predictor } from '../../interfaces/predictor.interface';

describe('PredictorManagementService', () => {
  let service: PredictorManagementService;
  let predictorRepository: jest.Mocked<PredictorRepository>;

  const createMockPredictor = (
    overrides: Partial<Predictor> = {},
  ): Predictor => ({
    id: `pred-${Math.random().toString(36).substr(2, 9)}`,
    signal_id: 'signal-123',
    target_id: 'target-456',
    direction: 'bullish',
    strength: 7,
    confidence: 0.75,
    reasoning: 'Test predictor',
    analyst_slug: 'test-analyst',
    analyst_assessment: {
      direction: 'bullish',
      confidence: 0.75,
      reasoning: 'Test assessment',
      key_factors: ['factor1'],
      risks: ['risk1'],
    },
    llm_usage_id: null,
    status: 'active',
    consumed_at: null,
    consumed_by_prediction_id: null,
    expires_at: '2026-01-10T12:00:00Z',
    created_at: '2026-01-08T12:00:00Z',
    updated_at: '2026-01-08T12:00:00Z',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictorManagementService,
        {
          provide: PredictorRepository,
          useValue: {
            findActiveByTarget: jest.fn(),
            expireOldPredictors: jest.fn(),
            consumePredictor: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PredictorManagementService>(
      PredictorManagementService,
    );
    predictorRepository = module.get(PredictorRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActivePredictors', () => {
    it('should expire old predictors before returning active ones', async () => {
      const mockPredictors = [createMockPredictor()];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(mockPredictors);

      const result = await service.getActivePredictors('target-456');

      expect(predictorRepository.expireOldPredictors).toHaveBeenCalledWith(
        'target-456',
      );
      expect(predictorRepository.findActiveByTarget).toHaveBeenCalledWith(
        'target-456',
      );
      expect(result).toEqual(mockPredictors);
    });

    it('should return empty array when no active predictors', async () => {
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue([]);

      const result = await service.getActivePredictors('target-456');

      expect(result).toEqual([]);
    });
  });

  describe('evaluateThreshold', () => {
    it('should return meetsThreshold=false when too few predictors', async () => {
      // Only 2 predictors, need 3
      const predictors = [createMockPredictor(), createMockPredictor()];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.meetsThreshold).toBe(false);
      expect(result.activeCount).toBe(2);
    });

    it('should return meetsThreshold=false when combined strength is too low', async () => {
      // 3 predictors with low strength (3 each = 9 total, need 15)
      const predictors = [
        createMockPredictor({ strength: 3 }),
        createMockPredictor({ strength: 3 }),
        createMockPredictor({ strength: 3 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.meetsThreshold).toBe(false);
      expect(result.combinedStrength).toBe(9);
    });

    it('should return meetsThreshold=false when consensus is too low', async () => {
      // 3 predictors with no consensus (1 each direction)
      const predictors = [
        createMockPredictor({ direction: 'bullish', strength: 6 }),
        createMockPredictor({ direction: 'bearish', strength: 6 }),
        createMockPredictor({ direction: 'neutral', strength: 6 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.meetsThreshold).toBe(false);
      expect(result.directionConsensus).toBeCloseTo(0.333, 2);
    });

    it('should return meetsThreshold=true when all criteria are met', async () => {
      // 3 bullish predictors with strength 6 each = 18 total, 100% consensus
      const predictors = [
        createMockPredictor({ direction: 'bullish', strength: 6 }),
        createMockPredictor({ direction: 'bullish', strength: 6 }),
        createMockPredictor({ direction: 'bullish', strength: 6 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.meetsThreshold).toBe(true);
      expect(result.activeCount).toBe(3);
      expect(result.combinedStrength).toBe(18);
      expect(result.directionConsensus).toBe(1.0);
      expect(result.dominantDirection).toBe('bullish');
    });

    it('should correctly identify dominant direction as bearish', async () => {
      const predictors = [
        createMockPredictor({ direction: 'bearish', strength: 6 }),
        createMockPredictor({ direction: 'bearish', strength: 6 }),
        createMockPredictor({ direction: 'bullish', strength: 6 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.dominantDirection).toBe('bearish');
      expect(result.directionConsensus).toBeCloseTo(0.667, 2);
      expect(result.details.bearishCount).toBe(2);
      expect(result.details.bullishCount).toBe(1);
    });

    it('should use custom config when provided', async () => {
      // Only need 1 predictor with custom config
      const predictors = [
        createMockPredictor({ direction: 'bullish', strength: 5 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const customConfig = {
        min_predictors: 1,
        min_combined_strength: 5,
        min_direction_consensus: 0.5,
        predictor_ttl_hours: 12,
      };

      const result = await service.evaluateThreshold(
        'target-456',
        customConfig,
      );

      expect(result.meetsThreshold).toBe(true);
    });

    it('should calculate correct average confidence', async () => {
      const predictors = [
        createMockPredictor({ confidence: 0.6 }),
        createMockPredictor({ confidence: 0.8 }),
        createMockPredictor({ confidence: 1.0 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.evaluateThreshold('target-456');

      expect(result.details.avgConfidence).toBeCloseTo(0.8, 2);
    });
  });

  describe('consumePredictors', () => {
    it('should consume all active predictors for a target', async () => {
      const predictors = [
        createMockPredictor({ id: 'pred-1' }),
        createMockPredictor({ id: 'pred-2' }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);
      predictorRepository.consumePredictor.mockImplementation(
        async (predId: string) => ({
          ...predictors.find((p) => p.id === predId)!,
          status: 'consumed' as const,
          consumed_by_prediction_id: 'prediction-123',
        }),
      );

      const result = await service.consumePredictors(
        'target-456',
        'prediction-123',
      );

      expect(result.length).toBe(2);
      expect(predictorRepository.consumePredictor).toHaveBeenCalledTimes(2);
      expect(predictorRepository.consumePredictor).toHaveBeenCalledWith(
        'pred-1',
        'prediction-123',
      );
      expect(predictorRepository.consumePredictor).toHaveBeenCalledWith(
        'pred-2',
        'prediction-123',
      );
    });

    it('should return empty array when no active predictors', async () => {
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue([]);

      const result = await service.consumePredictors(
        'target-456',
        'prediction-123',
      );

      expect(result).toEqual([]);
      expect(predictorRepository.consumePredictor).not.toHaveBeenCalled();
    });
  });

  describe('getPredictorStats', () => {
    it('should return correct statistics', async () => {
      const predictors = [
        createMockPredictor({
          direction: 'bullish',
          strength: 6,
          confidence: 0.7,
        }),
        createMockPredictor({
          direction: 'bullish',
          strength: 8,
          confidence: 0.9,
        }),
        createMockPredictor({
          direction: 'bearish',
          strength: 5,
          confidence: 0.6,
        }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const stats = await service.getPredictorStats('target-456');

      expect(stats.activeCount).toBe(3);
      expect(stats.totalStrength).toBe(19);
      expect(stats.avgConfidence).toBeCloseTo(0.733, 2);
      expect(stats.byDirection.bullish).toBe(2);
      expect(stats.byDirection.bearish).toBe(1);
      expect(stats.byDirection.neutral).toBe(0);
    });

    it('should handle empty predictor set', async () => {
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue([]);

      const stats = await service.getPredictorStats('target-456');

      expect(stats.activeCount).toBe(0);
      expect(stats.totalStrength).toBe(0);
      expect(stats.avgConfidence).toBe(0);
      expect(stats.byDirection.bullish).toBe(0);
      expect(stats.byDirection.bearish).toBe(0);
      expect(stats.byDirection.neutral).toBe(0);
    });
  });

  describe('wouldMeetThreshold', () => {
    it('should return false if still below min_predictors', async () => {
      // Only 1 existing predictor, adding 1 more = 2, need 3
      const predictors = [createMockPredictor()];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.wouldMeetThreshold(
        'target-456',
        5,
        'bullish',
      );

      expect(result).toBe(false);
    });

    it('should return false if combined strength still too low', async () => {
      // 2 existing predictors with strength 3 each, adding strength 3 = 9, need 15
      const predictors = [
        createMockPredictor({ strength: 3 }),
        createMockPredictor({ strength: 3 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.wouldMeetThreshold(
        'target-456',
        3,
        'bullish',
      );

      expect(result).toBe(false);
    });

    it('should return true if adding predictor would meet threshold', async () => {
      // 2 existing bullish with strength 6 each, adding bullish strength 6 = 18
      const predictors = [
        createMockPredictor({ direction: 'bullish', strength: 6 }),
        createMockPredictor({ direction: 'bullish', strength: 6 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.wouldMeetThreshold(
        'target-456',
        6,
        'bullish',
      );

      expect(result).toBe(true);
    });

    it('should return false if consensus would drop below threshold', async () => {
      // 2 bullish predictors, adding bearish would make 2/3 = 66% consensus = passes
      // But 1 bullish, 1 bearish, adding neutral = 1/3 = 33% = fails
      const predictors = [
        createMockPredictor({ direction: 'bullish', strength: 6 }),
        createMockPredictor({ direction: 'bearish', strength: 6 }),
      ];
      predictorRepository.expireOldPredictors.mockResolvedValue(0);
      predictorRepository.findActiveByTarget.mockResolvedValue(predictors);

      const result = await service.wouldMeetThreshold(
        'target-456',
        6,
        'neutral',
      );

      expect(result).toBe(false);
    });
  });
});
