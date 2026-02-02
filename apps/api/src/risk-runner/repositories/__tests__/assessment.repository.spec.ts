import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentRepository, AssessmentFilter } from '../assessment.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskAssessment, AssessmentSignal, AssessmentAnalystResponse } from '../../interfaces/assessment.interface';

describe('AssessmentRepository', () => {
  let repository: AssessmentRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockSignal: AssessmentSignal = {
    name: 'price_momentum',
    value: 0.75,
    impact: 'positive',
    weight: 0.3,
    source: 'technical_analysis',
  };

  const mockAnalystResponse: AssessmentAnalystResponse = {
    raw_response: 'Risk analysis complete',
    parsed_output: { score: 65, confidence: 0.85 },
    prompt_tokens: 100,
    completion_tokens: 50,
    latency_ms: 1500,
  };

  const mockAssessment: RiskAssessment = {
    id: 'assessment-123',
    subject_id: 'subject-123',
    dimension_id: 'dim-123',
    dimension_context_id: 'context-123',
    task_id: 'task-123',
    score: 65,
    confidence: 0.85,
    reasoning: 'Market conditions indicate moderate risk',
    evidence: ['Rising interest rates', 'Strong earnings'],
    signals: [mockSignal],
    analyst_response: mockAnalystResponse,
    llm_provider: 'anthropic',
    llm_model: 'claude-3-opus-20240229',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockAssessmentWithDimensions = {
    ...mockAssessment,
    dimensions: {
      slug: 'market',
      name: 'Market Risk',
      display_name: 'Market',
      weight: 1.0,
    },
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    upsert?: { data: unknown[] | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockAssessment, error: null };
    const listResult = overrides?.list ?? { data: [mockAssessmentWithDimensions], error: null };
    const insertResult = overrides?.insert ?? { data: mockAssessment, error: null };
    const updateResult = overrides?.update ?? { data: mockAssessment, error: null };
    const upsertResult = overrides?.upsert ?? { data: [mockAssessment], error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
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
      (chainableResult.upsert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) => resolve(upsertResult),
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
        AssessmentRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<AssessmentRepository>(AssessmentRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findBySubject', () => {
    it('should return assessments for subject with dimension info', async () => {
      const result = await repository.findBySubject('subject-123');

      expect(result.length).toBe(1);
      expect(result?.[0]?.dimension_slug).toBe('market');
      expect(result?.[0]?.dimension_name).toBe('Market');
    });

    it('should return empty array when no assessments found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch assessments: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: AssessmentFilter = { includeTest: true };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result.length).toBe(1);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: AssessmentFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result.length).toBe(1);
    });
  });

  describe('findLatestBySubjectAndDimension', () => {
    it('should return latest assessment for subject-dimension pair', async () => {
      const result = await repository.findLatestBySubjectAndDimension('subject-123', 'dim-123');

      expect(result).toEqual(mockAssessment);
    });

    it('should return null when no assessment found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLatestBySubjectAndDimension('subject-123', 'dim-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.findLatestBySubjectAndDimension('subject-123', 'dim-123'),
      ).rejects.toThrow('Failed to fetch latest assessment: Database error');
    });

    it('should apply filter', async () => {
      const filter: AssessmentFilter = { includeTest: true };
      const result = await repository.findLatestBySubjectAndDimension('subject-123', 'dim-123', filter);

      expect(result).toEqual(mockAssessment);
    });
  });

  describe('findByTask', () => {
    it('should return assessments for task', async () => {
      const mockClient = createMockClient({
        list: { data: [mockAssessment], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByTask('task-123');

      expect(result).toEqual([mockAssessment]);
    });

    it('should return empty array when no assessments for task', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByTask('task-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByTask('task-123')).rejects.toThrow(
        'Failed to fetch assessments by task: Query failed',
      );
    });
  });

  describe('findById', () => {
    it('should return assessment when found', async () => {
      const result = await repository.findById('assessment-123');

      expect(result).toEqual(mockAssessment);
    });

    it('should return null when assessment not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('assessment-123')).rejects.toThrow(
        'Failed to fetch assessment: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return assessment when found', async () => {
      const result = await repository.findByIdOrThrow('assessment-123');

      expect(result).toEqual(mockAssessment);
    });

    it('should throw NotFoundException when assessment not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create assessment successfully', async () => {
      const createData = {
        subject_id: 'subject-123',
        dimension_id: 'dim-123',
        score: 65,
        confidence: 0.85,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockAssessment);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          dimension_id: 'dim-123',
          score: 65,
          confidence: 0.85,
        }),
      ).rejects.toThrow('Create succeeded but no assessment returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          subject_id: 'subject-123',
          dimension_id: 'dim-123',
          score: 65,
          confidence: 0.85,
        }),
      ).rejects.toThrow('Failed to create assessment: Insert failed');
    });
  });

  describe('createBatch', () => {
    it('should create batch of assessments successfully', async () => {
      const result = await repository.createBatch([
        { subject_id: 'subject-123', dimension_id: 'dim-1', score: 65, confidence: 0.85 },
        { subject_id: 'subject-123', dimension_id: 'dim-2', score: 70, confidence: 0.9 },
      ]);

      expect(result).toEqual([mockAssessment]);
    });

    it('should return empty array for empty input', async () => {
      const result = await repository.createBatch([]);

      expect(result).toEqual([]);
    });

    it('should throw error on batch create failure', async () => {
      const mockClient = createMockClient({
        upsert: { data: null, error: { message: 'Batch insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createBatch([
          { subject_id: 'subject-123', dimension_id: 'dim-1', score: 65, confidence: 0.85 },
        ]),
      ).rejects.toThrow('Failed to create assessments batch: Batch insert failed');
    });
  });

  describe('delete', () => {
    it('should delete assessment successfully', async () => {
      await expect(repository.delete('assessment-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('assessment-123')).rejects.toThrow(
        'Failed to delete assessment: Delete failed',
      );
    });
  });

  describe('upsertWithMerge', () => {
    it('should create new assessment when none exists', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
        insert: { data: mockAssessment, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.upsertWithMerge({
        subject_id: 'subject-123',
        dimension_id: 'dim-123',
        score: 65,
        confidence: 0.85,
      });

      expect(result).toEqual(mockAssessment);
    });

    it('should merge with existing assessment', async () => {
      const existingAssessment = {
        ...mockAssessment,
        evidence: ['Old evidence'],
        signals: [],
        reasoning: 'Old reasoning',
        llm_model: 'old-model',
      };
      const mergedAssessment = {
        ...mockAssessment,
        evidence: ['Old evidence', 'New evidence'],
        reasoning: '[new-model] New reasoning\n\n---\n\n[old-model] Old reasoning',
      };

      const mockClient = createMockClient({
        single: { data: existingAssessment, error: null },
        update: { data: mergedAssessment, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.upsertWithMerge({
        subject_id: 'subject-123',
        dimension_id: 'dim-123',
        score: 70,
        confidence: 0.9,
        evidence: ['New evidence'],
        reasoning: 'New reasoning',
        llm_model: 'new-model',
      });

      expect(result).toBeDefined();
    });

    it('should throw error on update failure', async () => {
      const existingAssessment = { ...mockAssessment };

      const mockClient = createMockClient({
        single: { data: existingAssessment, error: null },
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.upsertWithMerge({
          subject_id: 'subject-123',
          dimension_id: 'dim-123',
          score: 70,
          confidence: 0.9,
        }),
      ).rejects.toThrow('Failed to update assessment: Update failed');
    });
  });

  describe('findRecentBySubject', () => {
    it('should return recent assessments for subject', async () => {
      const result = await repository.findRecentBySubject('subject-123');

      expect(result.length).toBe(1);
    });

    it('should accept custom limit', async () => {
      const result = await repository.findRecentBySubject('subject-123', 5);

      expect(result.length).toBe(1);
    });

    it('should return empty array when no recent assessments', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findRecentBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findRecentBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch recent assessments: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: AssessmentFilter = { includeTest: true };
      const result = await repository.findRecentBySubject('subject-123', 10, filter);

      expect(result.length).toBe(1);
    });
  });

  describe('signal handling', () => {
    it('should handle assessment with multiple signals', async () => {
      const assessmentWithSignals = {
        ...mockAssessment,
        signals: [
          { name: 'signal1', value: 0.5, impact: 'positive' as const, weight: 0.3 },
          { name: 'signal2', value: -0.2, impact: 'negative' as const, weight: 0.4 },
          { name: 'signal3', value: 0, impact: 'neutral' as const, weight: 0.3 },
        ],
      };
      const mockClient = createMockClient({
        single: { data: assessmentWithSignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('assessment-123');

      expect(result?.signals.length).toBe(3);
    });

    it('should handle assessment with empty signals', async () => {
      const assessmentWithEmptySignals = { ...mockAssessment, signals: [] };
      const mockClient = createMockClient({
        single: { data: assessmentWithEmptySignals, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('assessment-123');

      expect(result?.signals).toEqual([]);
    });
  });

  describe('analyst response handling', () => {
    it('should handle assessment with full analyst response', async () => {
      const result = await repository.findById('assessment-123');

      expect(result?.analyst_response.prompt_tokens).toBe(100);
      expect(result?.analyst_response.completion_tokens).toBe(50);
      expect(result?.analyst_response.latency_ms).toBe(1500);
    });

    it('should handle assessment with empty analyst response', async () => {
      const assessmentWithEmptyResponse = { ...mockAssessment, analyst_response: {} };
      const mockClient = createMockClient({
        single: { data: assessmentWithEmptyResponse, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('assessment-123');

      expect(result?.analyst_response).toEqual({});
    });
  });

  describe('evidence handling', () => {
    it('should handle assessment with multiple evidence items', async () => {
      const assessmentWithEvidence = {
        ...mockAssessment,
        evidence: ['Evidence 1', 'Evidence 2', 'Evidence 3'],
      };
      const mockClient = createMockClient({
        single: { data: assessmentWithEvidence, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('assessment-123');

      expect(result?.evidence.length).toBe(3);
    });

    it('should handle assessment with empty evidence', async () => {
      const assessmentWithEmptyEvidence = { ...mockAssessment, evidence: [] };
      const mockClient = createMockClient({
        single: { data: assessmentWithEmptyEvidence, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('assessment-123');

      expect(result?.evidence).toEqual([]);
    });
  });
});
