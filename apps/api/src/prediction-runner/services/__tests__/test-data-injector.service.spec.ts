import { Test, TestingModule } from '@nestjs/testing';
import { TestDataInjectorService } from '../test-data-injector.service';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  TestScenario,
  CreateTestScenarioData,
} from '../../interfaces/test-data.interface';
import { CreateSignalData } from '../../interfaces/signal.interface';

interface MockClient {
  schema: jest.Mock;
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  not: jest.Mock;
  in: jest.Mock;
  single: jest.Mock;
}

describe('TestDataInjectorService', () => {
  let service: TestDataInjectorService;
  let mockTestScenarioRepository: Partial<TestScenarioRepository>;
  let mockSupabaseService: Partial<SupabaseService>;
  let mockClient: MockClient;

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    description: 'Test description',
    injection_points: ['signals', 'predictors'],
    target_id: 'target-123',
    organization_slug: 'test-org',
    config: {},
    created_by: 'test-user',
    status: 'active',
    results: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  beforeEach(async () => {
    // Create chainable mock client
    mockClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockTestScenarioRepository = {
      create: jest.fn().mockResolvedValue(mockScenario),
      findById: jest.fn().mockResolvedValue(mockScenario),
      findByOrganization: jest.fn().mockResolvedValue([mockScenario]),
      markRunning: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'running' }),
      markCompleted: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'completed' }),
      markFailed: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'failed' }),
      cleanupScenario: jest.fn().mockResolvedValue({
        tables_cleaned: [{ table_name: 'signals', rows_deleted: 5 }],
        total_deleted: 5,
      }),
      cleanupAllTestData: jest.fn().mockResolvedValue({
        tables_cleaned: [
          { table_name: 'signals', rows_deleted: 10 },
          { table_name: 'predictors', rows_deleted: 5 },
        ],
        total_deleted: 15,
      }),
    };

    mockSupabaseService = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDataInjectorService,
        {
          provide: TestScenarioRepository,
          useValue: mockTestScenarioRepository,
        },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<TestDataInjectorService>(TestDataInjectorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Scenario Management', () => {
    it('should create a new test scenario', async () => {
      const createData: CreateTestScenarioData = {
        name: 'Test Scenario',
        injection_points: ['signals'],
        organization_slug: 'test-org',
      };

      const result = await service.createScenario(createData);

      expect(mockTestScenarioRepository.create).toHaveBeenCalledWith(
        createData,
      );
      expect(result.name).toBe('Test Scenario');
    });

    it('should get a test scenario by ID', async () => {
      const result = await service.getScenario('scenario-123');

      expect(mockTestScenarioRepository.findById).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result?.id).toBe('scenario-123');
    });

    it('should list all scenarios for an organization', async () => {
      const result = await service.listScenarios('test-org');

      expect(
        mockTestScenarioRepository.findByOrganization,
      ).toHaveBeenCalledWith('test-org');
      expect(result).toHaveLength(1);
    });
  });

  describe('Generic Injection', () => {
    it('should inject data with test markers', async () => {
      const testSignals: CreateSignalData[] = [
        {
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Test signal content',
          direction: 'bullish',
        },
      ];

      // Mock successful insert
      mockClient.select.mockResolvedValueOnce({
        data: testSignals.map((s) => ({
          ...s,
          id: 'signal-1',
          is_test_data: true,
          test_scenario_id: 'scenario-123',
        })),
        error: null,
      });

      const result = await service.injectIntoTable(
        'signals',
        testSignals,
        'scenario-123',
      );

      expect(mockClient.schema).toHaveBeenCalledWith('prediction');
      expect(mockClient.from).toHaveBeenCalledWith('signals');
      expect(mockClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            is_test_data: true,
            test_scenario_id: 'scenario-123',
          }),
        ]),
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.is_test_data).toBe(true);
    });

    it('should return empty array when no data to inject', async () => {
      const result = await service.injectIntoTable(
        'signals',
        [],
        'scenario-123',
      );

      expect(result).toEqual([]);
      expect(mockClient.insert).not.toHaveBeenCalled();
    });

    it('should throw error on injection failure', async () => {
      mockClient.select.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        service.injectIntoTable(
          'signals',
          [{ content: 'test' }],
          'scenario-123',
        ),
      ).rejects.toThrow('Failed to inject into signals: Database error');
    });
  });

  describe('Tier-Specific Injectors', () => {
    beforeEach(() => {
      mockClient.select.mockResolvedValue({
        data: [
          {
            id: 'item-1',
            is_test_data: true,
            test_scenario_id: 'scenario-123',
          },
        ],
        error: null,
      });
    });

    it('should inject signals', async () => {
      const signals: CreateSignalData[] = [
        {
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Test signal',
          direction: 'bullish',
        },
      ];

      await service.injectSignals('scenario-123', signals);

      expect(mockClient.from).toHaveBeenCalledWith('signals');
    });

    it('should inject predictors', async () => {
      const predictors = [
        {
          signal_id: 'signal-123',
          target_id: 'target-123',
          direction: 'bullish' as const,
          strength: 7,
          confidence: 0.85,
          reasoning: 'Test predictor',
          analyst_slug: 'test-analyst',
          analyst_assessment: {
            direction: 'bullish' as const,
            confidence: 0.85,
            reasoning: 'Test assessment reasoning',
            key_factors: ['factor1', 'factor2'],
            risks: ['risk1'],
          },
          expires_at: new Date().toISOString(),
        },
      ];

      await service.injectPredictors('scenario-123', predictors);

      expect(mockClient.from).toHaveBeenCalledWith('predictors');
    });

    it('should inject predictions', async () => {
      const predictions = [
        {
          target_id: 'target-123',
          direction: 'up',
          confidence: 0.8,
        },
      ];

      await service.injectPredictions('scenario-123', predictions);

      expect(mockClient.from).toHaveBeenCalledWith('predictions');
    });
  });

  describe('Outcome Injection', () => {
    it('should inject outcomes for predictions', async () => {
      mockClient.eq.mockReturnThis();

      const outcomes = [
        {
          prediction_id: 'pred-1',
          outcome_value: 105.5,
          actual_direction: 'up' as const,
        },
        {
          prediction_id: 'pred-2',
          outcome_value: 95.0,
          actual_direction: 'down' as const,
        },
      ];

      await service.injectOutcomes('scenario-123', outcomes);

      expect(mockClient.update).toHaveBeenCalledTimes(2);
      expect(mockClient.from).toHaveBeenCalledWith('predictions');
    });
  });

  describe('Tier Runners', () => {
    // Create a chainable mock that properly resolves at the end of the chain
    const createChainableMock = (resolvedData: unknown) => {
      const chain = {
        schema: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        then: jest.fn((resolve: (value: unknown) => void) =>
          resolve(resolvedData),
        ),
      };
      // Make it thenable (Promise-like)
      Object.defineProperty(chain, 'then', {
        value: (resolve: (value: unknown) => void) =>
          Promise.resolve(resolvedData).then(resolve),
      });
      return chain;
    };

    describe('runSignalDetection', () => {
      it('should process test signals and create predictors', async () => {
        const testSignals = [
          {
            id: 'signal-1',
            target_id: 'target-123',
            source_id: 'source-123',
            content: 'Test signal content for analysis',
            direction: 'bullish',
            disposition: 'pending',
          },
        ];

        // Create separate mock chains for each query
        let callCount = 0;
        mockSupabaseService.getServiceClient = jest
          .fn()
          .mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // First call: fetch signals - returns signals
              return createChainableMock({ data: testSignals, error: null });
            } else if (callCount === 2) {
              // Second call: insert predictor
              return createChainableMock({ data: null, error: null });
            } else {
              // Third call: update signal disposition
              return createChainableMock({ data: null, error: null });
            }
          });

        const result = await service.runSignalDetection('scenario-123');

        expect(mockTestScenarioRepository.markRunning).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect(result.items_processed).toBe(1);
        expect(result.success).toBe(true);
      });

      it('should handle errors gracefully', async () => {
        mockSupabaseService.getServiceClient = jest.fn().mockReturnValue(
          createChainableMock({
            data: null,
            error: { message: 'Database error' },
          }),
        );

        const result = await service.runSignalDetection('scenario-123');

        expect(result.success).toBe(false);
        expect(result.errors).toContain(
          'Failed to fetch test signals: Database error',
        );
        expect(mockTestScenarioRepository.markFailed).toHaveBeenCalled();
      });
    });

    describe('runPredictionGeneration', () => {
      it('should process test predictors and create predictions', async () => {
        const testPredictors = [
          {
            id: 'pred-1',
            target_id: 'target-123',
            direction: 'bullish',
            confidence: 0.8,
            status: 'active',
          },
        ];

        let callCount = 0;
        mockSupabaseService.getServiceClient = jest
          .fn()
          .mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return createChainableMock({ data: testPredictors, error: null });
            } else {
              return createChainableMock({ data: null, error: null });
            }
          });

        const result = await service.runPredictionGeneration('scenario-123');

        expect(result.items_processed).toBe(1);
        expect(result.items_created).toBe(1);
      });
    });

    describe('runEvaluation', () => {
      it('should evaluate test predictions with outcomes', async () => {
        const testPredictions = [
          {
            id: 'prediction-1',
            direction: 'up',
            status: 'resolved',
            outcome_value: 105,
            resolution_notes: 'Test outcome: up',
          },
        ];

        let callCount = 0;
        mockSupabaseService.getServiceClient = jest
          .fn()
          .mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return createChainableMock({
                data: testPredictions,
                error: null,
              });
            } else {
              return createChainableMock({ data: null, error: null });
            }
          });

        const result = await service.runEvaluation('scenario-123');

        expect(result.items_processed).toBe(1);
        expect(result.items_created).toBe(1);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup a specific scenario', async () => {
      const result = await service.cleanupScenario('scenario-123');

      expect(mockTestScenarioRepository.cleanupScenario).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result.total_deleted).toBe(5);
    });

    it('should cleanup all test data', async () => {
      const result = await service.cleanupAllTestData();

      expect(mockTestScenarioRepository.cleanupAllTestData).toHaveBeenCalled();
      expect(result.total_deleted).toBe(15);
      expect(result.tables_cleaned).toHaveLength(2);
    });
  });

  describe('Helpers', () => {
    it('should get data counts for a scenario', async () => {
      // Mock count queries for each table
      mockClient.select = jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
      }));

      const counts = await service.getScenarioDataCounts('scenario-123');

      expect(counts).toHaveProperty('signals');
      expect(counts).toHaveProperty('predictions');
    });
  });
});
