import { Test, TestingModule } from '@nestjs/testing';
import { TestScenarioHandler } from '../test-scenario.handler';
import { TestDataInjectorService } from '../../../services/test-data-injector.service';
import { TestDataGeneratorService } from '../../../services/test-data-generator.service';
import { ScenarioGeneratorService } from '../../../services/scenario-generator.service';
import { ScenarioVariationService } from '../../../services/scenario-variation.service';
import { SourceRepository } from '../../../repositories/source.repository';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import {
  TestScenario,
  MockPredictionWithOutcome,
  MockArticle,
} from '../../../interfaces/test-data.interface';
import {
  CreateSignalData,
  SignalDirection,
} from '../../../interfaces/signal.interface';

describe('TestScenarioHandler', () => {
  let handler: TestScenarioHandler;
  let mockInjectorService: Partial<TestDataInjectorService>;
  let mockGeneratorService: Partial<TestDataGeneratorService>;
  let mockScenarioGeneratorService: Partial<ScenarioGeneratorService>;
  let mockScenarioVariationService: Partial<ScenarioVariationService>;
  let mockSourceRepository: Pick<SourceRepository, 'findAll'>;

  const mockContext: ExecutionContext = {
    userId: 'user-123',
    orgSlug: 'test-org',
    agentSlug: 'prediction-runner',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: 'plan-123',
    deliverableId: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    agentType: 'context',
  };

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    description: 'A test scenario for unit testing',
    injection_points: ['signals', 'predictors'],
    target_id: 'target-123',
    organization_slug: 'test-org',
    config: {},
    created_by: 'user-123',
    status: 'active',
    results: null,
    created_at: '2024-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  beforeEach(async () => {
    mockInjectorService = {
      createScenario: jest.fn().mockResolvedValue(mockScenario),
      getScenario: jest.fn().mockResolvedValue(mockScenario),
      listScenarios: jest.fn().mockResolvedValue([mockScenario]),
      injectIntoTable: jest.fn().mockResolvedValue([
        {
          id: 'item-1',
          is_test_data: true,
          test_scenario_id: 'scenario-123',
        },
      ]),
      injectSignals: jest.fn().mockResolvedValue([
        {
          id: 'signal-1',
          is_test_data: true,
          test_scenario_id: 'scenario-123',
        },
      ]),
      injectPredictions: jest.fn().mockResolvedValue([
        {
          id: 'pred-1',
          is_test_data: true,
          test_scenario_id: 'scenario-123',
        },
      ]),
      runSignalDetection: jest.fn().mockResolvedValue({
        success: true,
        items_processed: 5,
        items_created: 3,
        duration_ms: 1000,
        errors: [],
      }),
      runPredictionGeneration: jest.fn().mockResolvedValue({
        success: true,
        items_processed: 3,
        items_created: 2,
        duration_ms: 1500,
        errors: [],
      }),
      runEvaluation: jest.fn().mockResolvedValue({
        success: true,
        items_processed: 2,
        items_created: 2,
        duration_ms: 500,
        errors: [],
      }),
      cleanupScenario: jest.fn().mockResolvedValue({
        tables_cleaned: [{ table_name: 'signals', rows_deleted: 5 }],
        total_deleted: 5,
      }),
      cleanupAllTestData: jest.fn().mockResolvedValue({
        tables_cleaned: [
          { table_name: 'signals', rows_deleted: 10 },
          { table_name: 'predictions', rows_deleted: 5 },
        ],
        total_deleted: 15,
      }),
      getScenarioDataCounts: jest.fn().mockResolvedValue({
        signals: 10,
        predictors: 5,
        predictions: 3,
      }),
    };

    mockGeneratorService = {
      generateMockSignals: jest.fn().mockReturnValue([
        {
          target_id: 'target-123',
          source_id: 'source-123',
          content: 'Test signal content',
          direction: 'bullish' as SignalDirection,
        },
      ] as CreateSignalData[]),
      generateMockPredictionsWithOutcomes: jest.fn().mockReturnValue([
        {
          prediction: {
            target_id: 'target-123',
            direction: 'up',
            confidence: 0.8,
            magnitude: 'medium',
            reasoning: 'Test prediction',
            timeframe_hours: 24,
          },
          outcome: 'correct',
          actual_direction: 'up',
        },
      ] as MockPredictionWithOutcome[]),
      generateMockArticles: jest.fn().mockReturnValue([
        {
          title: 'Test Article',
          content: 'Test content',
          url: 'https://test.com/article',
          published_at: '2024-01-01T00:00:00Z',
        },
      ] as MockArticle[]),
    };

    mockScenarioGeneratorService = {
      generateFromMissedOpportunity: jest.fn().mockResolvedValue({
        name: 'Generated Scenario',
        description: 'Auto-generated from missed opportunity',
        injection_points: ['signals'],
        target_id: 'target-123',
        organization_slug: 'test-org',
        config: {},
      }),
      generateFromLearning: jest.fn().mockResolvedValue({
        name: 'Generated Scenario',
        description: 'Auto-generated from learning',
        injection_points: ['signals'],
        target_id: 'target-123',
        organization_slug: 'test-org',
        config: {},
      }),
    };

    mockScenarioVariationService = {
      generateVariations: jest.fn().mockResolvedValue([
        {
          name: 'Variation 1',
          description: 'First variation',
          injection_points: ['signals'],
          target_id: 'target-123',
          organization_slug: 'test-org',
          config: { modifier: 'bullish' },
        },
      ]),
    };

    mockSourceRepository = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'source-123', name: 'Mock Source' } as unknown as never,
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestScenarioHandler,
        { provide: TestDataInjectorService, useValue: mockInjectorService },
        { provide: TestDataGeneratorService, useValue: mockGeneratorService },
        {
          provide: ScenarioGeneratorService,
          useValue: mockScenarioGeneratorService,
        },
        {
          provide: ScenarioVariationService,
          useValue: mockScenarioVariationService,
        },
        { provide: SourceRepository, useValue: mockSourceRepository },
      ],
    }).compile();

    handler = module.get<TestScenarioHandler>(TestScenarioHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();

      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('create');
      expect(actions).toContain('update');
      expect(actions).toContain('delete');
      expect(actions).toContain('inject');
      expect(actions).toContain('generate');
      expect(actions).toContain('run-tier');
      expect(actions).toContain('cleanup');
      expect(actions).toContain('get-counts');
      expect(actions).toContain('get-summaries');
    });
  });

  describe('CRUD Operations', () => {
    describe('list', () => {
      it('should list all scenarios for organization', async () => {
        const payload: DashboardRequestPayload = {
          action: 'list',
          params: {},
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.listScenarios).toHaveBeenCalledWith(
          'test-org',
        );
        expect(result.data).toHaveLength(1);
      });

      it('should filter scenarios by status', async () => {
        const activeScenario = { ...mockScenario, status: 'active' as const };
        const runningScenario = {
          ...mockScenario,
          id: 'scenario-456',
          status: 'running' as const,
        };
        (mockInjectorService.listScenarios as jest.Mock).mockResolvedValue([
          activeScenario,
          runningScenario,
        ]);

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: { filters: { status: 'active' } },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect((result.data as TestScenario[])[0]?.status).toBe('active');
      });

      it('should paginate results', async () => {
        const scenarios = Array.from({ length: 25 }, (_, i) => ({
          ...mockScenario,
          id: `scenario-${i}`,
        }));
        (mockInjectorService.listScenarios as jest.Mock).mockResolvedValue(
          scenarios,
        );

        const payload: DashboardRequestPayload = {
          action: 'list',
          params: { page: 2, pageSize: 10 },
        };

        const result = await handler.execute('list', payload, mockContext);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(10);
        expect(result.metadata?.page).toBe(2);
        expect(result.metadata?.pageSize).toBe(10);
        expect(result.metadata?.totalCount).toBe(25);
        expect(result.metadata?.hasMore).toBe(true);
      });
    });

    describe('get', () => {
      it('should get scenario by ID', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get',
          params: { id: 'scenario-123' },
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.getScenario).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect((result.data as TestScenario).id).toBe('scenario-123');
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get',
          params: {},
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });

      it('should return error when scenario not found', async () => {
        (mockInjectorService.getScenario as jest.Mock).mockResolvedValue(null);

        const payload: DashboardRequestPayload = {
          action: 'get',
          params: { id: 'nonexistent' },
        };

        const result = await handler.execute('get', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('NOT_FOUND');
      });
    });

    describe('create', () => {
      it('should create a new scenario', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            name: 'New Test Scenario',
            injection_points: ['signals', 'predictors'],
            target_id: 'target-123',
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.createScenario).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Test Scenario',
            injection_points: ['signals', 'predictors'],
            organization_slug: 'test-org',
            created_by: 'user-123',
          }),
        );
      });

      it('should return error when name is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            injection_points: ['signals'],
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
      });

      it('should return error when injection_points is empty', async () => {
        const payload: DashboardRequestPayload = {
          action: 'create',
          params: {
            name: 'Test',
            injection_points: [],
          },
        };

        const result = await handler.execute('create', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
      });
    });

    describe('delete', () => {
      it('should delete a scenario and cleanup its data', async () => {
        const payload: DashboardRequestPayload = {
          action: 'delete',
          params: { id: 'scenario-123' },
        };

        const result = await handler.execute('delete', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.cleanupScenario).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect((result.data as { deleted: boolean }).deleted).toBe(true);
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'delete',
          params: {},
        };

        const result = await handler.execute('delete', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });
    });
  });

  describe('Test Data Operations', () => {
    describe('inject', () => {
      it('should inject data into specified table', async () => {
        const payload: DashboardRequestPayload = {
          action: 'inject',
          params: {
            scenarioId: 'scenario-123',
            table: 'signals',
            data: [{ content: 'test signal', direction: 'bullish' }],
          },
        };

        const result = await handler.execute('inject', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.injectIntoTable).toHaveBeenCalledWith(
          'signals',
          [{ content: 'test signal', direction: 'bullish' }],
          'scenario-123',
        );
        expect((result.data as { injected_count: number }).injected_count).toBe(
          1,
        );
      });

      it('should return error when required params are missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'inject',
          params: { scenarioId: 'scenario-123' },
        };

        const result = await handler.execute('inject', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
      });
    });

    describe('generate', () => {
      it('should generate and inject mock signals', async () => {
        const payload: DashboardRequestPayload = {
          action: 'generate',
          params: {
            scenarioId: 'scenario-123',
            type: 'signals',
            config: {
              count: 5,
              target_id: 'target-123',
              source_id: 'source-123',
              distribution: { bullish: 0.5, bearish: 0.3, neutral: 0.2 },
            },
          },
        };

        const result = await handler.execute('generate', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockGeneratorService.generateMockSignals).toHaveBeenCalled();
        expect(mockInjectorService.injectSignals).toHaveBeenCalled();
        expect((result.data as { type: string }).type).toBe('signals');
      });

      it('should generate mock predictions with outcomes', async () => {
        const payload: DashboardRequestPayload = {
          action: 'generate',
          params: {
            scenarioId: 'scenario-123',
            type: 'predictions',
            config: {
              count: 10,
              target_id: 'target-123',
              accuracy_rate: 0.7,
            },
          },
        };

        const result = await handler.execute('generate', payload, mockContext);

        expect(result.success).toBe(true);
        expect(
          mockGeneratorService.generateMockPredictionsWithOutcomes,
        ).toHaveBeenCalled();
        expect(mockInjectorService.injectPredictions).toHaveBeenCalled();
        expect((result.data as { outcomes: unknown[] }).outcomes).toBeDefined();
      });

      it('should generate mock articles (without injection)', async () => {
        const payload: DashboardRequestPayload = {
          action: 'generate',
          params: {
            scenarioId: 'scenario-123',
            type: 'articles',
            config: {
              count: 5,
              topic: 'Bitcoin',
              sentiment: 'bullish',
            },
          },
        };

        const result = await handler.execute('generate', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockGeneratorService.generateMockArticles).toHaveBeenCalled();
        expect((result.data as { type: string }).type).toBe('articles');
      });

      it('should return error for invalid type', async () => {
        const payload: DashboardRequestPayload = {
          action: 'generate',
          params: {
            scenarioId: 'scenario-123',
            type: 'invalid' as 'signals',
            config: {
              count: 5,
              target_id: 'target-123',
              source_id: 'source-123',
            },
          },
        };

        const result = await handler.execute('generate', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_TYPE');
      });
    });

    describe('run-tier', () => {
      it('should run signal detection tier', async () => {
        const payload: DashboardRequestPayload = {
          action: 'run-tier',
          params: {
            scenarioId: 'scenario-123',
            tier: 'signal-detection',
          },
        };

        const result = await handler.execute('run-tier', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.runSignalDetection).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect((result.data as { tier: string }).tier).toBe('signal-detection');
      });

      it('should run prediction generation tier', async () => {
        const payload: DashboardRequestPayload = {
          action: 'run-tier',
          params: {
            scenarioId: 'scenario-123',
            tier: 'prediction-generation',
          },
        };

        const result = await handler.execute('run-tier', payload, mockContext);

        expect(result.success).toBe(true);
        expect(
          mockInjectorService.runPredictionGeneration,
        ).toHaveBeenCalledWith('scenario-123');
      });

      it('should run evaluation tier', async () => {
        const payload: DashboardRequestPayload = {
          action: 'run-tier',
          params: {
            scenarioId: 'scenario-123',
            tier: 'evaluation',
          },
        };

        const result = await handler.execute('run-tier', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.runEvaluation).toHaveBeenCalledWith(
          'scenario-123',
        );
      });

      it('should return error for invalid tier', async () => {
        const payload: DashboardRequestPayload = {
          action: 'run-tier',
          params: {
            scenarioId: 'scenario-123',
            tier: 'invalid-tier' as 'signal-detection',
          },
        };

        const result = await handler.execute('run-tier', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_TIER');
      });
    });

    describe('cleanup', () => {
      it('should cleanup a specific scenario', async () => {
        const payload: DashboardRequestPayload = {
          action: 'cleanup',
          params: { scenarioId: 'scenario-123' },
        };

        const result = await handler.execute('cleanup', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.cleanupScenario).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect((result.data as { cleanup_type: string }).cleanup_type).toBe(
          'scenario',
        );
      });

      it('should cleanup all test data', async () => {
        const payload: DashboardRequestPayload = {
          action: 'cleanup',
          params: { cleanupAll: true },
        };

        const result = await handler.execute('cleanup', payload, mockContext);

        expect(result.success).toBe(true);
        expect(mockInjectorService.cleanupAllTestData).toHaveBeenCalled();
        expect((result.data as { cleanup_type: string }).cleanup_type).toBe(
          'all',
        );
      });

      it('should return error when no scenarioId or cleanupAll', async () => {
        const payload: DashboardRequestPayload = {
          action: 'cleanup',
          params: {},
        };

        const result = await handler.execute('cleanup', payload, mockContext);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_DATA');
      });
    });

    describe('get-counts', () => {
      it('should get data counts for a scenario', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-counts',
          params: { id: 'scenario-123' },
        };

        const result = await handler.execute(
          'get-counts',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockInjectorService.getScenarioDataCounts).toHaveBeenCalledWith(
          'scenario-123',
        );
        expect(
          (result.data as { counts: Record<string, number> }).counts.signals,
        ).toBe(10);
      });

      it('should return error when ID is missing', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-counts',
          params: {},
        };

        const result = await handler.execute(
          'get-counts',
          payload,
          mockContext,
        );

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MISSING_ID');
      });
    });

    describe('get-summaries', () => {
      it('should get scenario summaries with data counts', async () => {
        const payload: DashboardRequestPayload = {
          action: 'get-summaries',
          params: {},
        };

        const result = await handler.execute(
          'get-summaries',
          payload,
          mockContext,
        );

        expect(result.success).toBe(true);
        expect(mockInjectorService.listScenarios).toHaveBeenCalledWith(
          'test-org',
        );
        expect(mockInjectorService.getScenarioDataCounts).toHaveBeenCalled();

        const summaries = result.data as Array<{
          data_counts: Record<string, number>;
        }>;
        expect(summaries[0]?.data_counts).toBeDefined();
      });
    });
  });

  describe('Unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'unsupported',
        params: {},
      };

      const result = await handler.execute('unsupported', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });
});
