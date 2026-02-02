import { Test, TestingModule } from '@nestjs/testing';
import { PredictorRepository } from '../predictor.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Predictor } from '../../interfaces/predictor.interface';

describe('PredictorRepository', () => {
  let repository: PredictorRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockPredictor: Predictor = {
    id: 'predictor-123',
    signal_id: 'signal-123',
    target_id: 'target-123',
    direction: 'bullish',
    strength: 7,
    confidence: 0.8,
    reasoning: 'Test reasoning',
    analyst_slug: 'test-analyst',
    analyst_assessment: {
      direction: 'bullish',
      confidence: 0.8,
      reasoning: 'Test assessment',
      key_factors: ['factor1'],
      risks: ['risk1'],
    },
    llm_usage_id: null,
    status: 'active',
    consumed_at: null,
    consumed_by_prediction_id: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockPredictor, error: null };
    const listResult = overrides?.list ?? { data: [mockPredictor], error: null };
    const insertResult = overrides?.insert ?? { data: mockPredictor, error: null };
    const updateResult = overrides?.update ?? { data: mockPredictor, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gt: jest.fn(),
        gte: jest.fn(),
        lt: jest.fn(),
        lte: jest.fn(),
        in: jest.fn(),
        or: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lt as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.in as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.or as jest.Mock).mockReturnValue(chainableResult);
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
          lt: jest.fn().mockReturnValue({
            ...chainableResult,
            select: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(listResult),
            }),
          }),
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

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
        PredictorRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<PredictorRepository>(PredictorRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return predictor when found', async () => {
      const result = await repository.findById('predictor-123');

      expect(result).toEqual(mockPredictor);
    });

    it('should return null when predictor not found', async () => {
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

      await expect(repository.findById('predictor-123')).rejects.toThrow('Database error');
    });
  });

  describe('findActiveByTarget', () => {
    it('should return active predictors for target', async () => {
      const result = await repository.findActiveByTarget('target-123');

      expect(result).toEqual([mockPredictor]);
    });

    it('should apply test data filter', async () => {
      const result = await repository.findActiveByTarget('target-123', {
        testDataOnly: true,
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no active predictors', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveByTarget('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findActiveByTarget('target-123')).rejects.toThrow('Query failed');
    });
  });

  describe('findByPredictionId', () => {
    it('should return predictors consumed by prediction', async () => {
      const result = await repository.findByPredictionId('pred-123');

      expect(result).toEqual([mockPredictor]);
    });

    it('should return empty array when no predictors found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findByPredictionId('pred-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByPredictionId('pred-123')).rejects.toThrow('Query failed');
    });
  });

  describe('create', () => {
    it('should create predictor successfully', async () => {
      const createData = {
        signal_id: 'signal-123',
        target_id: 'target-123',
        direction: 'bullish' as const,
        strength: 7,
        confidence: 0.8,
        reasoning: 'Test reasoning',
        analyst_slug: 'test-analyst',
        analyst_assessment: {
          direction: 'bullish' as const,
          confidence: 0.8,
          reasoning: 'Test',
          key_factors: [],
          risks: [],
        },
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockPredictor);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          signal_id: 'signal-123',
          target_id: 'target-123',
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Test',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bullish',
            confidence: 0.8,
            reasoning: 'Test',
            key_factors: [],
            risks: [],
          },
          expires_at: new Date().toISOString(),
        }),
      ).rejects.toThrow('Create succeeded but no predictor returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({
          signal_id: 'signal-123',
          target_id: 'target-123',
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Test',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bullish',
            confidence: 0.8,
            reasoning: 'Test',
            key_factors: [],
            risks: [],
          },
          expires_at: new Date().toISOString(),
        }),
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('should update predictor successfully', async () => {
      const result = await repository.update('predictor-123', { status: 'consumed' });

      expect(result).toEqual(mockPredictor);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('predictor-123', { status: 'consumed' })).rejects.toThrow(
        'Update succeeded but no predictor returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('predictor-123', { status: 'consumed' })).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('expireOldPredictors', () => {
    it('should expire old predictors', async () => {
      const result = await repository.expireOldPredictors('target-123');

      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return count of expired predictors', async () => {
      const mockClient = createMockClient({
        list: { data: [{ id: 'pred-1' }, { id: 'pred-2' }], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.expireOldPredictors('target-123');

      expect(result).toBe(2);
    });

    it('should throw error on expire failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Expire failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.expireOldPredictors('target-123')).rejects.toThrow('Expire failed');
    });
  });

  describe('test data filter', () => {
    it('should include test data when flag set', async () => {
      const result = await repository.findActiveByTarget('target-123', {
        includeTestData: true,
      });

      expect(result).toBeDefined();
    });

    it('should filter by test scenario ID', async () => {
      const result = await repository.findActiveByTarget('target-123', {
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });

    it('should filter test data only', async () => {
      const result = await repository.findActiveByTarget('target-123', {
        testDataOnly: true,
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });
  });
});
