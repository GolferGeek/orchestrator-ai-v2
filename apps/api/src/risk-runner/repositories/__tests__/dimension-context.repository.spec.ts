import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  DimensionContextRepository,
  DimensionContextFilter,
} from '../dimension-context.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskDimensionContext } from '../../interfaces/dimension.interface';

describe('DimensionContextRepository', () => {
  let repository: DimensionContextRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockDimensionContext: RiskDimensionContext = {
    id: 'context-123',
    dimension_id: 'dim-123',
    version: 1,
    system_prompt: 'Analyze market risk for this subject...',
    output_schema: {
      type: 'object',
      properties: {
        score: { type: 'number' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
    examples: [
      {
        input: {
          subject: 'Stock with high volatility',
          data: { volatility: 0.4 },
        },
        output: {
          score: 70,
          confidence: 0.85,
          reasoning: 'High volatility indicates higher risk',
          evidence: ['Historical volatility data'],
        },
      },
    ],
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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
      data: mockDimensionContext,
      error: null,
    };
    const listResult = overrides?.list ?? {
      data: [mockDimensionContext],
      error: null,
    };
    const insertResult = overrides?.insert ?? {
      data: mockDimensionContext,
      error: null,
    };
    const updateResult = overrides?.update ?? {
      data: mockDimensionContext,
      error: null,
    };
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
        DimensionContextRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<DimensionContextRepository>(
      DimensionContextRepository,
    );
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByDimension', () => {
    it('should return contexts for dimension', async () => {
      const result = await repository.findByDimension('dim-123');

      expect(result).toEqual([mockDimensionContext]);
    });

    it('should return empty array when no contexts found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByDimension('dim-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByDimension('dim-123')).rejects.toThrow(
        'Failed to fetch dimension contexts: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: DimensionContextFilter = { includeTest: true };
      const result = await repository.findByDimension('dim-123', filter);

      expect(result).toEqual([mockDimensionContext]);
    });

    it('should apply testScenarioId filter', async () => {
      const filter: DimensionContextFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findByDimension('dim-123', filter);

      expect(result).toEqual([mockDimensionContext]);
    });
  });

  describe('findActiveForDimension', () => {
    it('should return active context for dimension', async () => {
      const result = await repository.findActiveForDimension('dim-123');

      expect(result).toEqual(mockDimensionContext);
    });

    it('should return null when no active context found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findActiveForDimension('dim-123');

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
        repository.findActiveForDimension('dim-123'),
      ).rejects.toThrow(
        'Failed to fetch active dimension context: Database error',
      );
    });

    it('should apply filter', async () => {
      const filter: DimensionContextFilter = { includeTest: true };
      const result = await repository.findActiveForDimension('dim-123', filter);

      expect(result).toEqual(mockDimensionContext);
    });
  });

  describe('findById', () => {
    it('should return context when found', async () => {
      const result = await repository.findById('context-123');

      expect(result).toEqual(mockDimensionContext);
    });

    it('should return null when context not found', async () => {
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

      await expect(repository.findById('context-123')).rejects.toThrow(
        'Failed to fetch dimension context: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return context when found', async () => {
      const result = await repository.findByIdOrThrow('context-123');

      expect(result).toEqual(mockDimensionContext);
    });

    it('should throw NotFoundException when context not found', async () => {
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

  describe('findByVersion', () => {
    it('should return context for dimension and version', async () => {
      const result = await repository.findByVersion('dim-123', 1);

      expect(result).toEqual(mockDimensionContext);
    });

    it('should return null when version not found', async () => {
      const mockClient = createMockClient({
        single: {
          data: null,
          error: { message: 'Not found', code: 'PGRST116' },
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findByVersion('dim-123', 99);

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.findByVersion('dim-123', 1)).rejects.toThrow(
        'Failed to fetch dimension context by version: Database error',
      );
    });
  });

  describe('create', () => {
    it('should create context successfully', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: mockDimensionContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const createData = {
        dimension_id: 'dim-123',
        system_prompt: 'New prompt',
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockDimensionContext);
    });

    it('should auto-increment version when not specified', async () => {
      const existingContexts = [
        { ...mockDimensionContext, version: 1 },
        { ...mockDimensionContext, id: 'context-456', version: 2 },
      ];
      const mockClient = createMockClient({
        list: { data: existingContexts, error: null },
        insert: { data: { ...mockDimensionContext, version: 3 }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.create({
        dimension_id: 'dim-123',
        system_prompt: 'New prompt',
      });

      expect(result.version).toBe(3);
    });

    it('should use provided version if specified', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: { ...mockDimensionContext, version: 5 }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.create({
        dimension_id: 'dim-123',
        system_prompt: 'New prompt',
        version: 5,
      });

      expect(result.version).toBe(5);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          dimension_id: 'dim-123',
          system_prompt: 'Test',
        }),
      ).rejects.toThrow('Create succeeded but no dimension context returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.create({
          dimension_id: 'dim-123',
          system_prompt: 'Test',
        }),
      ).rejects.toThrow('Failed to create dimension context: Insert failed');
    });
  });

  describe('update', () => {
    it('should update context successfully', async () => {
      const updatedContext = { ...mockDimensionContext, is_active: false };
      const mockClient = createMockClient({
        update: { data: updatedContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.update('context-123', {
        is_active: false,
      });

      expect(result).toEqual(updatedContext);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('context-123', { is_active: false }),
      ).rejects.toThrow('Update succeeded but no dimension context returned');
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(
        repository.update('context-123', { is_active: false }),
      ).rejects.toThrow('Failed to update dimension context: Update failed');
    });
  });

  describe('delete', () => {
    it('should delete context successfully', async () => {
      await expect(repository.delete('context-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      await expect(repository.delete('context-123')).rejects.toThrow(
        'Failed to delete dimension context: Delete failed',
      );
    });
  });

  describe('getLatestVersion', () => {
    it('should return latest version number', async () => {
      const contexts = [
        { ...mockDimensionContext, version: 1 },
        { ...mockDimensionContext, id: 'context-456', version: 3 },
        { ...mockDimensionContext, id: 'context-789', version: 2 },
      ];
      const mockClient = createMockClient({
        list: { data: contexts, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getLatestVersion('dim-123');

      expect(result).toBe(3);
    });

    it('should return 0 when no contexts exist', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.getLatestVersion('dim-123');

      expect(result).toBe(0);
    });
  });

  describe('version handling', () => {
    const versions = [1, 2, 3, 5, 10] as const;

    versions.forEach((version) => {
      it(`should handle version ${version}`, async () => {
        const contextWithVersion = { ...mockDimensionContext, version };
        const mockClient = createMockClient({
          single: { data: contextWithVersion, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
          mockClient,
        );

        const result = await repository.findById('context-123');

        expect(result?.version).toBe(version);
      });
    });
  });

  describe('output schema handling', () => {
    it('should handle context with complex output schema', async () => {
      const contextWithSchema = {
        ...mockDimensionContext,
        output_schema: {
          type: 'object',
          required: ['score', 'confidence'],
          properties: {
            score: { type: 'number', minimum: 0, maximum: 100 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string', maxLength: 1000 },
            evidence: { type: 'array', items: { type: 'string' } },
          },
        },
      };
      const mockClient = createMockClient({
        single: { data: contextWithSchema, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('context-123');

      expect(result?.output_schema.type).toBe('object');
      expect(result?.output_schema.required).toContain('score');
    });

    it('should handle context with empty output schema', async () => {
      const contextWithEmptySchema = {
        ...mockDimensionContext,
        output_schema: {},
      };
      const mockClient = createMockClient({
        single: { data: contextWithEmptySchema, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('context-123');

      expect(result?.output_schema).toEqual({});
    });
  });

  describe('few shot examples handling', () => {
    it('should handle context with multiple few shot examples', async () => {
      const contextWithExamples = {
        ...mockDimensionContext,
        examples: [
          {
            input: { subject: 'Example 1', data: {} },
            output: {
              score: 70,
              confidence: 0.8,
              reasoning: 'High risk',
              evidence: [],
            },
          },
          {
            input: { subject: 'Example 2', data: {} },
            output: {
              score: 30,
              confidence: 0.9,
              reasoning: 'Low risk',
              evidence: [],
            },
          },
          {
            input: { subject: 'Example 3', data: {} },
            output: {
              score: 50,
              confidence: 0.7,
              reasoning: 'Medium risk',
              evidence: [],
            },
          },
        ],
      };
      const mockClient = createMockClient({
        single: { data: contextWithExamples, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('context-123');

      expect(result?.examples?.length).toBe(3);
    });

    it('should handle context with no few shot examples', async () => {
      const contextWithNoExamples = { ...mockDimensionContext, examples: null };
      const mockClient = createMockClient({
        single: { data: contextWithNoExamples, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await repository.findById('context-123');

      expect(result?.examples).toBeNull();
    });
  });
});
