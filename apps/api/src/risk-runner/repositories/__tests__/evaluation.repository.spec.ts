import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  EvaluationRepository,
  EvaluationFilter,
} from '../evaluation.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  RiskEvaluation,
  ActualOutcome,
  DimensionAccuracy,
} from '../../interfaces/evaluation.interface';

describe('EvaluationRepository', () => {
  let repository: EvaluationRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockActualOutcome: ActualOutcome = {
    price_change_percent: -15.5,
    max_drawdown_percent: -22.3,
    volatility_realized: 0.35,
    volatility_predicted: 0.28,
    outcome_type: 'significant_decline',
    outcome_date: '2024-01-15T00:00:00Z',
    adverse_events: [
      {
        type: 'earnings_miss',
        description: 'Company missed earnings expectations',
        severity: 'high',
        date: '2024-01-14T00:00:00Z',
        impact: '-10% stock price',
      },
    ],
  };

  const mockDimensionAccuracy: DimensionAccuracy = {
    market: {
      predicted_score: 70,
      contribution_to_accuracy: 0.3,
      was_helpful: true,
      notes: 'Correctly predicted volatility increase',
    },
    fundamental: {
      predicted_score: 55,
      contribution_to_accuracy: -0.1,
      was_helpful: false,
      notes: 'Failed to anticipate earnings miss',
    },
  };

  const mockEvaluation: RiskEvaluation = {
    id: 'eval-123',
    composite_score_id: 'score-123',
    subject_id: 'subject-123',
    evaluation_window: '7d',
    actual_outcome: mockActualOutcome,
    outcome_severity: 65,
    score_accuracy: 0.72,
    dimension_accuracy: mockDimensionAccuracy,
    calibration_error: 0.08,
    learnings_suggested: [
      'Improve earnings anticipation',
      'Weight fundamental higher',
    ],
    notes: 'Model underestimated fundamental risk',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-22T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: { data: unknown; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockEvaluation,
      error: null,
    };
    const listResult = overrides?.list ?? {
      data: [mockEvaluation],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockEvaluation,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockEvaluation,
      error: null,
    };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<EvaluationRepository>(EvaluationRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findBySubject', () => {
    it('should return evaluations for subject', async () => {
      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([mockEvaluation]);
    });

    it('should return empty array when no evaluations found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch evaluations: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: EvaluationFilter = { includeTest: true };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockEvaluation]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: EvaluationFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockEvaluation]);
    });
  });

  describe('findByCompositeScore', () => {
    it('should return evaluations for composite score', async () => {
      const result = await repository.findByCompositeScore('score-123');

      expect(result).toEqual([mockEvaluation]);
    });

    it('should return empty array when no evaluations found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByCompositeScore('score-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByCompositeScore('score-123'),
      ).rejects.toThrow('Failed to fetch evaluations by score: Query failed');
    });

    it('should apply filter', async () => {
      const filter: EvaluationFilter = { includeTest: true };
      const result = await repository.findByCompositeScore('score-123', filter);

      expect(result).toEqual([mockEvaluation]);
    });
  });

  describe('findById', () => {
    it('should return evaluation when found', async () => {
      const result = await repository.findById('eval-123');

      expect(result).toEqual(mockEvaluation);
    });

    it('should return null when evaluation not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findById('eval-123')).rejects.toThrow(
        'Failed to fetch evaluation: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return evaluation when found', async () => {
      const result = await repository.findByIdOrThrow('eval-123');

      expect(result).toEqual(mockEvaluation);
    });

    it('should throw NotFoundException when evaluation not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByScoreAndWindow', () => {
    it('should return evaluation for score and window', async () => {
      const result = await repository.findByScoreAndWindow('score-123', '7d');

      expect(result).toEqual(mockEvaluation);
    });

    it('should return null when no evaluation found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByScoreAndWindow('score-123', '30d');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.findByScoreAndWindow('score-123', '7d'),
      ).rejects.toThrow(
        'Failed to fetch evaluation by score and window: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create evaluation successfully', async () => {
      const createData = {
        composite_score_id: 'score-123',
        subject_id: 'subject-123',
        evaluation_window: '7d' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockEvaluation);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          composite_score_id: 'score-123',
          subject_id: 'subject-123',
          evaluation_window: '7d',
        }),
      ).rejects.toThrow('Create succeeded but no evaluation returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          composite_score_id: 'score-123',
          subject_id: 'subject-123',
          evaluation_window: '7d',
        }),
      ).rejects.toThrow('Failed to create evaluation: Insert failed');
    });
  });

  describe('update', () => {
    it('should update evaluation successfully', async () => {
      const updatedEvaluation = { ...mockEvaluation, score_accuracy: 0.85 };
      const mockClient = createMockClient({
        update: { data: updatedEvaluation, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.update('eval-123', {
        score_accuracy: 0.85,
      });

      expect(result).toEqual(updatedEvaluation);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('eval-123', { score_accuracy: 0.85 }),
      ).rejects.toThrow('Update succeeded but no evaluation returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('eval-123', { score_accuracy: 0.85 }),
      ).rejects.toThrow('Failed to update evaluation: Update failed');
    });
  });

  describe('delete', () => {
    it('should delete evaluation successfully', async () => {
      await expect(repository.delete('eval-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('eval-123')).rejects.toThrow(
        'Failed to delete evaluation: Delete failed',
      );
    });
  });

  describe('findAllByWindow', () => {
    it('should return evaluations by window', async () => {
      const result = await repository.findAllByWindow('7d');

      expect(result).toEqual([mockEvaluation]);
    });

    it('should return empty array when no evaluations', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findAllByWindow('30d');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findAllByWindow('7d')).rejects.toThrow(
        'Failed to fetch evaluations by window: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: EvaluationFilter = { includeTest: true };
      const result = await repository.findAllByWindow('7d', filter);

      expect(result).toEqual([mockEvaluation]);
    });
  });

  describe('calculateAverageAccuracy', () => {
    it('should calculate average accuracy for window', async () => {
      const evaluations = [
        { ...mockEvaluation, score_accuracy: 0.8 },
        { ...mockEvaluation, id: 'eval-456', score_accuracy: 0.6 },
      ];
      const mockClient = createMockClient({
        list: { data: evaluations, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.calculateAverageAccuracy('7d');

      expect(result).toBe(0.7);
    });

    it('should calculate average accuracy without window', async () => {
      const evaluations = [
        { ...mockEvaluation, score_accuracy: 0.9 },
        { ...mockEvaluation, id: 'eval-456', score_accuracy: 0.7 },
      ];
      const mockClient = createMockClient({
        list: { data: evaluations, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.calculateAverageAccuracy();

      expect(result).toBe(0.8);
    });

    it('should return null when no evaluations with accuracy', async () => {
      const evaluations = [{ ...mockEvaluation, score_accuracy: null }];
      const mockClient = createMockClient({
        list: { data: evaluations, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.calculateAverageAccuracy('7d');

      expect(result).toBeNull();
    });

    it('should return null when no evaluations', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.calculateAverageAccuracy('7d');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.calculateAverageAccuracy()).rejects.toThrow(
        'Failed to fetch evaluations: Query failed',
      );
    });
  });

  describe('evaluation windows', () => {
    const windows = ['7d', '30d', '90d'] as const;

    windows.forEach((window) => {
      it(`should handle ${window} evaluation window`, async () => {
        const evalWithWindow = { ...mockEvaluation, evaluation_window: window };
        const mockClient = createMockClient({
          single: { data: evalWithWindow, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('eval-123');

        expect(result?.evaluation_window).toBe(window);
      });
    });
  });

  describe('outcome types', () => {
    const outcomeTypes = [
      'no_event',
      'minor_decline',
      'significant_decline',
      'major_event',
    ] as const;

    outcomeTypes.forEach((outcomeType) => {
      it(`should handle ${outcomeType} outcome type`, async () => {
        const evalWithOutcome = {
          ...mockEvaluation,
          actual_outcome: { ...mockActualOutcome, outcome_type: outcomeType },
        };
        const mockClient = createMockClient({
          single: { data: evalWithOutcome, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('eval-123');

        expect(result?.actual_outcome.outcome_type).toBe(outcomeType);
      });
    });
  });

  describe('adverse event severities', () => {
    const severities = ['low', 'medium', 'high', 'critical'] as const;

    severities.forEach((severity) => {
      it(`should handle ${severity} adverse event severity`, async () => {
        const evalWithSeverity = {
          ...mockEvaluation,
          actual_outcome: {
            ...mockActualOutcome,
            adverse_events: [
              {
                type: 'test_event',
                description: 'Test',
                severity,
                date: '2024-01-01',
              },
            ],
          },
        };
        const mockClient = createMockClient({
          single: { data: evalWithSeverity, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('eval-123');

        expect(result?.actual_outcome?.adverse_events?.[0]?.severity).toBe(
          severity,
        );
      });
    });
  });

  describe('dimension accuracy', () => {
    it('should handle evaluation with multiple dimension accuracies', async () => {
      const result = await repository.findById('eval-123');

      expect(Object.keys(result?.dimension_accuracy ?? {}).length).toBe(2);
      expect(result?.dimension_accuracy?.market?.was_helpful).toBe(true);
      expect(result?.dimension_accuracy?.fundamental?.was_helpful).toBe(false);
    });

    it('should handle evaluation with empty dimension accuracy', async () => {
      const evalWithEmptyAccuracy = {
        ...mockEvaluation,
        dimension_accuracy: {},
      };
      const mockClient = createMockClient({
        single: { data: evalWithEmptyAccuracy, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('eval-123');

      expect(result?.dimension_accuracy).toEqual({});
    });
  });

  describe('learnings suggested', () => {
    it('should handle evaluation with learnings', async () => {
      const result = await repository.findById('eval-123');

      expect(result?.learnings_suggested?.length).toBe(2);
    });

    it('should handle evaluation with no learnings', async () => {
      const evalWithNoLearnings = {
        ...mockEvaluation,
        learnings_suggested: null,
      };
      const mockClient = createMockClient({
        single: { data: evalWithNoLearnings, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('eval-123');

      expect(result?.learnings_suggested).toBeNull();
    });
  });
});
