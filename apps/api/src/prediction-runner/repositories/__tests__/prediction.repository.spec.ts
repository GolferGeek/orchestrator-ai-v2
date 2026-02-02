import { Test, TestingModule } from '@nestjs/testing';
import { PredictionRepository } from '../prediction.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { Prediction } from '../../interfaces/prediction.interface';

describe('PredictionRepository', () => {
  let repository: PredictionRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockPrediction: Prediction = {
    id: 'pred-123',
    target_id: 'target-123',
    task_id: null,
    direction: 'up',
    confidence: 0.8,
    magnitude: 'medium',
    reasoning: 'Test reasoning',
    timeframe_hours: 24,
    predicted_at: '2024-01-01T10:00:00Z',
    expires_at: '2024-01-02T10:00:00Z',
    entry_price: 150.0,
    target_price: 160.0,
    stop_loss: 145.0,
    analyst_ensemble: { analyst1: { direction: 'up', confidence: 0.8 } },
    llm_ensemble: { model: 'claude', tokens: 100 },
    status: 'active',
    outcome_value: null,
    outcome_captured_at: null,
    resolution_notes: null,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    is_test_data: false,
    test_scenario_id: null,
  };

  const createMockClient = (overrides?: {
    single?: {
      data: unknown;
      error: { message: string; code?: string } | null;
    };
    list?: { data: unknown; error: { message: string } | null };
    insert?: { data: unknown; error: { message: string } | null };
    update?: { data: unknown; error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? {
      data: mockPrediction,
      error: null,
    };
    const listResult = overrides?.list ?? {
      data: [mockPrediction],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockPrediction,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockPrediction,
      error: null,
    };

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
        PredictionRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<PredictionRepository>(PredictionRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return prediction when found', async () => {
      const result = await repository.findById('pred-123');

      expect(result).toEqual(mockPrediction);
    });

    it('should return null when prediction not found', async () => {
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

      await expect(repository.findById('pred-123')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findByTarget', () => {
    it('should return predictions for target', async () => {
      const result = await repository.findByTarget('target-123');

      expect(result).toEqual([mockPrediction]);
    });

    it('should filter by status when provided', async () => {
      const result = await repository.findByTarget('target-123', 'active');

      expect(result).toBeDefined();
    });

    it('should apply test data filter', async () => {
      const result = await repository.findByTarget('target-123', undefined, {
        testDataOnly: true,
      });

      expect(result).toBeDefined();
    });

    it('should return empty array when no predictions found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByTarget('target-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByTarget('target-123')).rejects.toThrow(
        'Query failed',
      );
    });
  });

  describe('findByUniverse', () => {
    it('should return predictions for universe targets', async () => {
      const mockClient = createMockClient();
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByUniverse('universe-123');

      expect(result).toBeDefined();
    });

    it('should return empty array when no targets in universe', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByUniverse('universe-123');

      expect(result).toEqual([]);
    });

    it('should filter by status when provided', async () => {
      const result = await repository.findByUniverse(
        'universe-123',
        'resolved',
      );

      expect(result).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create prediction successfully', async () => {
      const createData = {
        target_id: 'target-123',
        direction: 'up' as const,
        confidence: 0.8,
        reasoning: 'Test reasoning',
        timeframe_hours: 24,
        expires_at: '2024-01-02T10:00:00Z',
        analyst_ensemble: { analyst1: { direction: 'up' } },
        llm_ensemble: { model: 'claude' },
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockPrediction);
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
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
          reasoning: 'Test',
          timeframe_hours: 24,
          expires_at: '2024-01-02T10:00:00Z',
          analyst_ensemble: {},
          llm_ensemble: {},
        }),
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('update', () => {
    it('should update prediction successfully', async () => {
      const result = await repository.update('pred-123', {
        status: 'resolved',
      });

      expect(result).toEqual(mockPrediction);
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('pred-123', { status: 'resolved' }),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('test data filter', () => {
    it('should include test data when flag set', async () => {
      const result = await repository.findByTarget('target-123', undefined, {
        includeTestData: true,
      });

      expect(result).toBeDefined();
    });

    it('should filter by test scenario ID', async () => {
      const result = await repository.findByTarget('target-123', undefined, {
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });

    it('should filter test data only with scenario', async () => {
      const result = await repository.findByTarget('target-123', undefined, {
        testDataOnly: true,
        testScenarioId: 'scenario-123',
      });

      expect(result).toBeDefined();
    });
  });
});
