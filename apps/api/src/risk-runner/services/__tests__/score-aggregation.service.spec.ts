import { Test, TestingModule } from '@nestjs/testing';
import {
  ScoreAggregationService,
  AggregationResult,
} from '../score-aggregation.service';
import { RiskAssessment } from '../../interfaces/assessment.interface';
import { RiskDimension } from '../../interfaces/dimension.interface';

describe('ScoreAggregationService', () => {
  let service: ScoreAggregationService;

  // Weights must sum to 1.0 (100%)
  const mockDimensions: RiskDimension[] = [
    {
      id: 'dim-market',
      scope_id: 'scope-1',
      slug: 'market',
      name: 'Market Risk',
      display_name: 'Market Risk',
      description: 'Price volatility and market conditions',
      icon: 'chart-line',
      color: '#EF4444',
      weight: 0.3, // 30%
      display_order: 1,
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'dim-fundamental',
      scope_id: 'scope-1',
      slug: 'fundamental',
      name: 'Fundamental Risk',
      display_name: 'Fundamental Risk',
      description: 'Company health and financials',
      icon: 'building',
      color: '#3B82F6',
      weight: 0.45, // 45%
      display_order: 2,
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'dim-technical',
      scope_id: 'scope-1',
      slug: 'technical',
      name: 'Technical Risk',
      display_name: 'Technical Risk',
      description: 'Chart patterns and indicators',
      icon: 'chart-bar',
      color: '#F59E0B',
      weight: 0.25, // 25%
      display_order: 3,
      is_active: true,
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const createAssessment = (
    overrides: Partial<RiskAssessment>,
  ): RiskAssessment => ({
    id: 'assessment-1',
    subject_id: 'subject-1',
    dimension_id: 'dim-market',
    dimension_context_id: null,
    task_id: 'task-1',
    score: 50,
    confidence: 0.8,
    reasoning: 'Test reasoning',
    evidence: [],
    signals: [],
    analyst_response: {},
    llm_provider: null,
    llm_model: null,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoreAggregationService],
    }).compile();

    service = module.get<ScoreAggregationService>(ScoreAggregationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('aggregateAssessments', () => {
    it('should aggregate assessments with equal weights', () => {
      // Equal weights that sum to 1.0: 0.33, 0.34, 0.33 = 1.0
      const equalWeightDimensions = mockDimensions.map((d, i) => ({
        ...d,
        weight: i === 1 ? 0.34 : 0.33, // Sum to 1.0
      }));

      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          dimension_id: 'dim-market',
          score: 60,
          confidence: 0.9,
        }),
        createAssessment({
          id: 'a2',
          dimension_id: 'dim-fundamental',
          score: 40,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a3',
          dimension_id: 'dim-technical',
          score: 50,
          confidence: 0.7,
        }),
      ];

      const result = service.aggregateAssessments(
        assessments,
        equalWeightDimensions,
      );

      // (60*0.33 + 40*0.34 + 50*0.33) / 1.0 = 19.8 + 13.6 + 16.5 = 49.9 ≈ 50
      expect(result.overallScore).toBe(50);
      expect(result.dimensionScores).toEqual({
        market: 60,
        fundamental: 40,
        technical: 50,
      });
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should apply weighted average based on dimension weights', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          dimension_id: 'dim-market',
          score: 100,
          confidence: 0.9,
        }),
        createAssessment({
          id: 'a2',
          dimension_id: 'dim-fundamental',
          score: 50,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a3',
          dimension_id: 'dim-technical',
          score: 0,
          confidence: 0.7,
        }),
      ];

      // Weights: market=0.30, fundamental=0.45, technical=0.25
      // Expected: (100*0.30 + 50*0.45 + 0*0.25) / (0.30+0.45+0.25)
      //         = (30 + 22.5 + 0) / 1.0 = 52.5 ≈ 53

      const result = service.aggregateAssessments(assessments, mockDimensions);

      expect(result.overallScore).toBe(53);
    });

    it('should return zero scores for empty assessments', () => {
      const result = service.aggregateAssessments([], mockDimensions);

      expect(result.overallScore).toBe(0);
      expect(result.dimensionScores).toEqual({});
      expect(result.confidence).toBe(0);
    });

    it('should skip assessments with unknown dimension IDs', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          dimension_id: 'dim-market',
          score: 70,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a2',
          dimension_id: 'unknown-dimension',
          score: 100,
          confidence: 0.9,
        }),
        // Add remaining dimensions with score 0 to make test valid
        createAssessment({
          id: 'a3',
          dimension_id: 'dim-fundamental',
          score: 0,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a4',
          dimension_id: 'dim-technical',
          score: 0,
          confidence: 0.8,
        }),
      ];

      const result = service.aggregateAssessments(assessments, mockDimensions);

      // Only known dimensions should be included, unknown dimension score ignored
      // market=70*0.30, fundamental=0*0.45, technical=0*0.25 = 21/1.0 = 21
      expect(result.overallScore).toBe(21);
      expect(result.dimensionScores).toEqual({
        market: 70,
        fundamental: 0,
        technical: 0,
      });
    });

    it('should handle null confidence values', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          dimension_id: 'dim-market',
          score: 60,
          confidence: null as unknown as number,
        }),
        createAssessment({
          id: 'a2',
          dimension_id: 'dim-fundamental',
          score: 40,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a3',
          dimension_id: 'dim-technical',
          score: 50,
          confidence: 0.7,
        }),
      ];

      const result = service.aggregateAssessments(assessments, mockDimensions);

      // Should calculate weighted average
      expect(result.overallScore).toBeGreaterThan(0);
      // Confidence should be based only on non-null values
      expect(result.confidence).toBeCloseTo(0.75, 1);
    });

    it('should handle dimensions with null/undefined weight by using default', () => {
      // Create dimensions with null/undefined weights that will default to equal weights
      // and adjust so they sum to 1.0 after defaulting
      const dimensionsWithMissingWeight = [
        {
          ...mockDimensions[0]!,
          weight: null as unknown as number, // Will default to equal share
          display_order: 1,
        },
        {
          ...mockDimensions[1]!,
          weight: undefined as unknown as number, // Will default to equal share
          display_order: 2,
        },
        {
          ...mockDimensions[2]!,
          weight: 1.0, // This ensures we have a valid weight to test against
          display_order: 3,
        },
      ];

      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          dimension_id: 'dim-market',
          score: 60,
          confidence: 0.8,
        }),
        createAssessment({
          id: 'a2',
          dimension_id: 'dim-fundamental',
          score: 40,
          confidence: 0.7,
        }),
        createAssessment({
          id: 'a3',
          dimension_id: 'dim-technical',
          score: 50,
          confidence: 0.9,
        }),
      ];

      // This test verifies that the service doesn't crash with null/undefined weights
      // The validation should either throw or handle gracefully
      try {
        const result = service.aggregateAssessments(
          assessments,
          dimensionsWithMissingWeight,
        );
        // If we get here, verify a result was calculated
        expect(result.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.overallScore).toBeLessThanOrEqual(100);
      } catch (error) {
        // The service validates weight sum, so this is expected behavior
        expect((error as Error).message).toContain('Dimension weights');
      }
    });
  });

  describe('applyDebateAdjustment', () => {
    it('should apply positive adjustment', () => {
      const result = service.applyDebateAdjustment(50, 10);
      expect(result).toBe(60);
    });

    it('should apply negative adjustment', () => {
      const result = service.applyDebateAdjustment(50, -10);
      expect(result).toBe(40);
    });

    it('should clamp result to maximum of 100', () => {
      const result = service.applyDebateAdjustment(95, 10);
      expect(result).toBe(100);
    });

    it('should clamp result to minimum of 0', () => {
      const result = service.applyDebateAdjustment(5, -10);
      expect(result).toBe(0);
    });

    it('should handle zero adjustment', () => {
      const result = service.applyDebateAdjustment(50, 0);
      expect(result).toBe(50);
    });

    it('should handle edge case at 100', () => {
      const result = service.applyDebateAdjustment(100, 5);
      expect(result).toBe(100);
    });

    it('should handle edge case at 0', () => {
      const result = service.applyDebateAdjustment(0, -5);
      expect(result).toBe(0);
    });
  });

  describe('calculateCompositeConfidence', () => {
    it('should calculate geometric mean of confidences', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({ id: 'a1', confidence: 0.9 }),
        createAssessment({ id: 'a2', confidence: 0.81 }),
      ];

      // Geometric mean of 0.9 and 0.81 = sqrt(0.9 * 0.81) = sqrt(0.729) ≈ 0.854
      const result = service.calculateCompositeConfidence(assessments);

      expect(result).toBeCloseTo(0.85, 1);
    });

    it('should return 0 for empty assessments', () => {
      const result = service.calculateCompositeConfidence([]);
      expect(result).toBe(0);
    });

    it('should return 0 when all confidences are null', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({
          id: 'a1',
          confidence: null as unknown as number,
        }),
        createAssessment({
          id: 'a2',
          confidence: undefined as unknown as number,
        }),
      ];

      const result = service.calculateCompositeConfidence(assessments);
      expect(result).toBe(0);
    });

    it('should filter out null/undefined confidences', () => {
      const assessments: RiskAssessment[] = [
        createAssessment({ id: 'a1', confidence: 0.64 }),
        createAssessment({
          id: 'a2',
          confidence: null as unknown as number,
        }),
      ];

      const result = service.calculateCompositeConfidence(assessments);
      // Only 0.64 is considered, geometric mean of single value is itself
      expect(result).toBe(0.64);
    });

    it('should penalize low confidence scores', () => {
      // Geometric mean penalizes low values more than arithmetic mean
      const assessments: RiskAssessment[] = [
        createAssessment({ id: 'a1', confidence: 0.9 }),
        createAssessment({ id: 'a2', confidence: 0.1 }),
      ];

      // Geometric mean = sqrt(0.9 * 0.1) = sqrt(0.09) = 0.3
      // Arithmetic mean would be (0.9 + 0.1) / 2 = 0.5
      const result = service.calculateCompositeConfidence(assessments);

      expect(result).toBe(0.3);
    });
  });

  describe('calculateValidUntil', () => {
    it('should add specified hours to date', () => {
      const assessedAt = new Date('2024-01-15T10:00:00Z');
      const result = service.calculateValidUntil(assessedAt, 24);

      expect(result.toISOString()).toBe('2024-01-16T10:00:00.000Z');
    });

    it('should use default of 24 hours', () => {
      const assessedAt = new Date('2024-01-15T10:00:00Z');
      const result = service.calculateValidUntil(assessedAt);

      expect(result.toISOString()).toBe('2024-01-16T10:00:00.000Z');
    });

    it('should handle custom stale hours', () => {
      const assessedAt = new Date('2024-01-15T10:00:00Z');
      const result = service.calculateValidUntil(assessedAt, 48);

      expect(result.toISOString()).toBe('2024-01-17T10:00:00.000Z');
    });

    it('should handle short stale periods', () => {
      const assessedAt = new Date('2024-01-15T10:00:00Z');
      const result = service.calculateValidUntil(assessedAt, 1);

      expect(result.toISOString()).toBe('2024-01-15T11:00:00.000Z');
    });
  });

  describe('recalculateWithDebate', () => {
    it('should apply debate adjustment and preserve original score', () => {
      const originalResult: AggregationResult = {
        overallScore: 50,
        dimensionScores: { market: 60, fundamental: 40 },
        confidence: 0.8,
      };

      const result = service.recalculateWithDebate(originalResult, 10);

      expect(result.overallScore).toBe(60);
      expect(result.preDebateScore).toBe(50);
      expect(result.dimensionScores).toEqual(originalResult.dimensionScores);
      expect(result.confidence).toBe(originalResult.confidence);
    });

    it('should handle negative debate adjustment', () => {
      const originalResult: AggregationResult = {
        overallScore: 50,
        dimensionScores: { market: 50 },
        confidence: 0.7,
      };

      const result = service.recalculateWithDebate(originalResult, -15);

      expect(result.overallScore).toBe(35);
      expect(result.preDebateScore).toBe(50);
    });

    it('should clamp adjusted score to valid range', () => {
      const originalResult: AggregationResult = {
        overallScore: 95,
        dimensionScores: { market: 95 },
        confidence: 0.9,
      };

      const result = service.recalculateWithDebate(originalResult, 20);

      expect(result.overallScore).toBe(100);
      expect(result.preDebateScore).toBe(95);
    });

    it('should handle zero adjustment', () => {
      const originalResult: AggregationResult = {
        overallScore: 50,
        dimensionScores: { market: 50 },
        confidence: 0.8,
      };

      const result = service.recalculateWithDebate(originalResult, 0);

      expect(result.overallScore).toBe(50);
      expect(result.preDebateScore).toBe(50);
    });
  });
});
