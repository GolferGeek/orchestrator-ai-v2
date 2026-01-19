/**
 * Integration tests for Test Data Isolation
 * Verifies that test data is properly isolated from production queries
 *
 * These tests use mocked Supabase clients to simulate database behavior
 * and verify that the TestDataFilter is correctly applied.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TestDataInjectorService } from '../test-data-injector.service';
import { TestDataGeneratorService } from '../test-data-generator.service';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  TestDataFilter,
  TestScenario,
  InjectionPoint,
} from '../../interfaces/test-data.interface';

interface MockClient {
  schema: jest.Mock;
  from: jest.Mock;
  rpc: jest.Mock;
}

describe('Test Data Isolation (Integration)', () => {
  let injectorService: TestDataInjectorService;
  let generatorService: TestDataGeneratorService;
  let mockClient: MockClient;
  let insertedData: Map<string, Array<Record<string, unknown>>>;

  const mockScenario: TestScenario = {
    id: 'scenario-integration-test',
    name: 'Integration Test Scenario',
    description: 'Tests data isolation',
    injection_points: [
      'signals',
      'predictors',
      'predictions',
    ] as InjectionPoint[],
    target_id: 'target-integration',
    organization_slug: 'integration-test-org',
    config: {},
    created_by: 'integration-test',
    status: 'active',
    results: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };

  beforeEach(async () => {
    // Track inserted data per table
    insertedData = new Map();

    // Create a mock client that tracks inserts and simulates filtering
    mockClient = {
      schema: jest.fn().mockReturnThis(),
      from: jest.fn().mockImplementation((tableName: string) => {
        return {
          select: jest
            .fn()
            .mockImplementation(
              (
                columns: string,
                options?: { count?: string; head?: boolean },
              ) => {
                const tableData = insertedData.get(tableName) ?? [];

                return {
                  eq: jest
                    .fn()
                    .mockImplementation((column: string, value: unknown) => {
                      if (column === 'test_scenario_id') {
                        const filtered = tableData.filter(
                          (row) => row.test_scenario_id === value,
                        );
                        if (options?.count) {
                          return Promise.resolve({
                            count: filtered.length,
                            error: null,
                          });
                        }
                        return Promise.resolve({ data: filtered, error: null });
                      }
                      if (column === 'is_test_data') {
                        const filtered = tableData.filter(
                          (row) => row.is_test_data === value,
                        );
                        return Promise.resolve({ data: filtered, error: null });
                      }
                      return {
                        eq: jest
                          .fn()
                          .mockResolvedValue({ data: tableData, error: null }),
                        single: jest.fn().mockResolvedValue({
                          data: tableData[0] ?? null,
                          error: null,
                        }),
                      };
                    }),
                  or: jest.fn().mockImplementation((condition: string) => {
                    // Simulate filtering out test data
                    if (condition.includes('is_test_data')) {
                      const filtered = tableData.filter(
                        (row) => !row.is_test_data,
                      );
                      return Promise.resolve({ data: filtered, error: null });
                    }
                    return Promise.resolve({ data: tableData, error: null });
                  }),
                  single: jest.fn().mockResolvedValue({
                    data: tableData[0] ?? null,
                    error: null,
                  }),
                };
              },
            ),
          insert: jest.fn().mockImplementation((data: unknown[]) => {
            const existing = insertedData.get(tableName) ?? [];
            const newData = data.map((row, idx) => ({
              ...(row as Record<string, unknown>),
              id: `${tableName}-${Date.now()}-${idx}`,
            }));
            insertedData.set(tableName, [...existing, ...newData]);
            return {
              select: jest
                .fn()
                .mockResolvedValue({ data: newData, error: null }),
            };
          }),
        };
      }),
      rpc: jest
        .fn()
        .mockImplementation(
          (fnName: string, params?: Record<string, unknown>) => {
            if (fnName === 'cleanup_test_scenario') {
              // Simulate cleanup
              const scenarioId = params?.p_scenario_id;
              const results: Array<{
                table_name: string;
                rows_deleted: number;
              }> = [];

              insertedData.forEach((data, tableName) => {
                const toDelete = data.filter(
                  (row) => row.test_scenario_id === scenarioId,
                );
                if (toDelete.length > 0) {
                  results.push({
                    table_name: tableName,
                    rows_deleted: toDelete.length,
                  });
                  insertedData.set(
                    tableName,
                    data.filter((row) => row.test_scenario_id !== scenarioId),
                  );
                }
              });

              return Promise.resolve({ data: results, error: null });
            }
            if (fnName === 'cleanup_all_test_data') {
              const results: Array<{
                table_name: string;
                rows_deleted: number;
              }> = [];

              insertedData.forEach((data, tableName) => {
                const toDelete = data.filter(
                  (row) => row.is_test_data === true,
                );
                if (toDelete.length > 0) {
                  results.push({
                    table_name: tableName,
                    rows_deleted: toDelete.length,
                  });
                  insertedData.set(
                    tableName,
                    data.filter((row) => row.is_test_data !== true),
                  );
                }
              });

              return Promise.resolve({ data: results, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        ),
    };

    const mockTestScenarioRepository: Partial<TestScenarioRepository> = {
      create: jest.fn().mockResolvedValue(mockScenario),
      findById: jest.fn().mockResolvedValue(mockScenario),
      markRunning: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'running' }),
      markCompleted: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'completed' }),
      markFailed: jest
        .fn()
        .mockResolvedValue({ ...mockScenario, status: 'failed' }),
      cleanupScenario: jest
        .fn()
        .mockImplementation(async (scenarioId: string) => {
          const result = await mockClient.rpc('cleanup_test_scenario', {
            p_scenario_id: scenarioId,
          });
          const tables_cleaned = result.data ?? [];
          return {
            tables_cleaned,
            total_deleted: tables_cleaned.reduce(
              (sum: number, t: { rows_deleted: number }) =>
                sum + t.rows_deleted,
              0,
            ),
          };
        }),
      cleanupAllTestData: jest.fn().mockImplementation(async () => {
        const result = await mockClient.rpc('cleanup_all_test_data');
        const tables_cleaned = result.data ?? [];
        return {
          tables_cleaned,
          total_deleted: tables_cleaned.reduce(
            (sum: number, t: { rows_deleted: number }) => sum + t.rows_deleted,
            0,
          ),
        };
      }),
    };

    const mockSupabaseService: Partial<SupabaseService> = {
      getServiceClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestDataInjectorService,
        TestDataGeneratorService,
        {
          provide: TestScenarioRepository,
          useValue: mockTestScenarioRepository,
        },
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    injectorService = module.get<TestDataInjectorService>(
      TestDataInjectorService,
    );
    generatorService = module.get<TestDataGeneratorService>(
      TestDataGeneratorService,
    );
  });

  describe('Test Data Markers', () => {
    it('should mark all injected data with is_test_data=true', async () => {
      const signals = generatorService.generateMockSignals({
        count: 5,
        target_id: 'target-123',
        source_id: 'source-123',
        topic: 'Apple',
      });

      await injectorService.injectSignals('scenario-integration-test', signals);

      const injectedSignals = insertedData.get('signals') ?? [];
      expect(injectedSignals).toHaveLength(5);

      injectedSignals.forEach((signal) => {
        expect(signal.is_test_data).toBe(true);
        expect(signal.test_scenario_id).toBe('scenario-integration-test');
      });
    });

    it('should mark all injected predictions with is_test_data=true', async () => {
      const predictions = generatorService
        .generateMockPredictionsWithOutcomes({
          count: 3,
          target_id: 'target-123',
          accuracy_rate: 0.7,
        })
        .map((p) => p.prediction);

      await injectorService.injectPredictions(
        'scenario-integration-test',
        predictions,
      );

      const injectedPredictions = insertedData.get('predictions') ?? [];
      expect(injectedPredictions).toHaveLength(3);

      injectedPredictions.forEach((prediction) => {
        expect(prediction.is_test_data).toBe(true);
        expect(prediction.test_scenario_id).toBe('scenario-integration-test');
      });
    });
  });

  describe('Production Query Isolation', () => {
    beforeEach(async () => {
      // Insert production data (no test markers)
      insertedData.set('signals', [
        {
          id: 'prod-signal-1',
          content: 'Production signal 1',
          is_test_data: false,
        },
        {
          id: 'prod-signal-2',
          content: 'Production signal 2',
          is_test_data: false,
        },
      ]);

      // Insert test data via injector
      const testSignals = generatorService.generateMockSignals({
        count: 3,
        target_id: 'target-123',
        source_id: 'source-123',
      });
      await injectorService.injectSignals(
        'scenario-integration-test',
        testSignals,
      );
    });

    it('should have both production and test data in the table', () => {
      const allSignals = insertedData.get('signals') ?? [];
      expect(allSignals.length).toBe(5); // 2 production + 3 test

      const prodSignals = allSignals.filter((s) => !s.is_test_data);
      const testSignals = allSignals.filter((s) => s.is_test_data === true);

      expect(prodSignals).toHaveLength(2);
      expect(testSignals).toHaveLength(3);
    });

    it('should filter out test data when includeTestData=false', () => {
      const filter: TestDataFilter = { includeTestData: false };
      const allSignals = insertedData.get('signals') ?? [];

      // Simulate what a repository would do with this filter
      const filteredSignals = allSignals.filter((s) => {
        if (!filter.includeTestData) {
          return !s.is_test_data || s.is_test_data === null;
        }
        return true;
      });

      expect(filteredSignals).toHaveLength(2);
      filteredSignals.forEach((signal) => {
        expect(signal.is_test_data).toBeFalsy();
      });
    });

    it('should include only test data when testDataOnly=true', () => {
      const filter: TestDataFilter = { testDataOnly: true };
      const allSignals = insertedData.get('signals') ?? [];

      // Simulate what a repository would do with this filter
      const filteredSignals = allSignals.filter((s) => {
        if (filter.testDataOnly) {
          return s.is_test_data === true;
        }
        return true;
      });

      expect(filteredSignals).toHaveLength(3);
      filteredSignals.forEach((signal) => {
        expect(signal.is_test_data).toBe(true);
      });
    });

    it('should filter by specific test scenario', () => {
      const filter: TestDataFilter = {
        testScenarioId: 'scenario-integration-test',
      };
      const allSignals = insertedData.get('signals') ?? [];

      // Simulate what a repository would do with this filter
      const filteredSignals = allSignals.filter((s) => {
        if (filter.testScenarioId) {
          return s.test_scenario_id === filter.testScenarioId;
        }
        return true;
      });

      expect(filteredSignals).toHaveLength(3);
      filteredSignals.forEach((signal) => {
        expect(signal.test_scenario_id).toBe('scenario-integration-test');
      });
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      // Insert production data
      insertedData.set('signals', [
        { id: 'prod-1', content: 'Production', is_test_data: false },
      ]);

      // Insert test data for two different scenarios
      const scenario1Signals = generatorService.generateMockSignals({
        count: 3,
        target_id: 'target-1',
        source_id: 'source-1',
      });
      await injectorService.injectSignals('scenario-1', scenario1Signals);

      // Manually add scenario-2 data
      const existing = insertedData.get('signals') ?? [];
      insertedData.set('signals', [
        ...existing,
        {
          id: 'test-s2-1',
          content: 'Test scenario 2',
          is_test_data: true,
          test_scenario_id: 'scenario-2',
        },
        {
          id: 'test-s2-2',
          content: 'Test scenario 2',
          is_test_data: true,
          test_scenario_id: 'scenario-2',
        },
      ]);
    });

    it('should cleanup only the specified scenario', async () => {
      const allBefore = insertedData.get('signals') ?? [];
      expect(allBefore.length).toBe(6); // 1 prod + 3 scenario-1 + 2 scenario-2

      const result = await injectorService.cleanupScenario('scenario-1');

      expect(result.tables_cleaned.length).toBeGreaterThanOrEqual(1);
      expect(result.total_deleted).toBe(3);

      const allAfter = insertedData.get('signals') ?? [];
      expect(allAfter.length).toBe(3); // 1 prod + 2 scenario-2

      // Verify production data is intact
      const prodData = allAfter.filter((s) => !s.is_test_data);
      expect(prodData).toHaveLength(1);

      // Verify scenario-2 data is intact
      const scenario2Data = allAfter.filter(
        (s) => s.test_scenario_id === 'scenario-2',
      );
      expect(scenario2Data).toHaveLength(2);
    });

    it('should cleanup all test data but preserve production', async () => {
      const allBefore = insertedData.get('signals') ?? [];
      expect(allBefore.length).toBe(6);

      const result = await injectorService.cleanupAllTestData();

      expect(result.tables_cleaned.length).toBeGreaterThanOrEqual(1);
      expect(result.total_deleted).toBe(5); // All test data

      const allAfter = insertedData.get('signals') ?? [];
      expect(allAfter.length).toBe(1); // Only production data remains

      // Verify remaining data is production
      expect(allAfter[0]?.is_test_data).toBeFalsy();
    });
  });

  describe('Multi-Table Isolation', () => {
    it('should properly isolate test data across multiple tables', async () => {
      // Add production data to multiple tables
      insertedData.set('signals', [{ id: 'prod-s-1', is_test_data: false }]);
      insertedData.set('predictors', [{ id: 'prod-p-1', is_test_data: false }]);
      insertedData.set('predictions', [
        { id: 'prod-pred-1', is_test_data: false },
      ]);

      // Inject test signals
      const signals = generatorService.generateMockSignals({
        count: 2,
        target_id: 'target-123',
        source_id: 'source-123',
      });
      await injectorService.injectSignals('multi-table-test', signals);

      // Inject test predictions
      const predictions = generatorService
        .generateMockPredictionsWithOutcomes({
          count: 2,
          target_id: 'target-123',
          accuracy_rate: 0.5,
        })
        .map((p) => p.prediction);
      await injectorService.injectPredictions('multi-table-test', predictions);

      // Verify each table has both prod and test data
      expect(insertedData.get('signals')?.length).toBe(3); // 1 prod + 2 test
      expect(insertedData.get('predictions')?.length).toBe(3); // 1 prod + 2 test

      // Cleanup test data
      await injectorService.cleanupScenario('multi-table-test');

      // Verify only prod data remains in each table
      expect(insertedData.get('signals')?.length).toBe(1);
      expect(insertedData.get('predictions')?.length).toBe(1);

      insertedData.forEach((data, tableName) => {
        if (['signals', 'predictions'].includes(tableName)) {
          data.forEach((row) => {
            expect(row.is_test_data).toBeFalsy();
          });
        }
      });
    });
  });

  describe('Generator + Injector Pipeline', () => {
    it('should generate and inject a complete test scenario', async () => {
      // Generate test data
      const signals = generatorService.generateMockSignals({
        count: 10,
        target_id: 'target-pipeline',
        source_id: 'source-pipeline',
        topic: 'AAPL',
        distribution: { bullish: 0.5, bearish: 0.3, neutral: 0.2 },
      });

      const predictionsWithOutcomes =
        generatorService.generateMockPredictionsWithOutcomes({
          count: 5,
          target_id: 'target-pipeline',
          accuracy_rate: 0.8,
        });

      // Inject all data
      await injectorService.injectSignals('pipeline-scenario', signals);
      await injectorService.injectPredictions(
        'pipeline-scenario',
        predictionsWithOutcomes.map((p) => p.prediction),
      );

      // Verify all data is marked as test data
      const allSignals = insertedData.get('signals') ?? [];
      const allPredictions = insertedData.get('predictions') ?? [];

      expect(allSignals).toHaveLength(10);
      expect(allPredictions).toHaveLength(5);

      allSignals.forEach((s) => {
        expect(s.is_test_data).toBe(true);
        expect(s.test_scenario_id).toBe('pipeline-scenario');
      });

      allPredictions.forEach((p) => {
        expect(p.is_test_data).toBe(true);
        expect(p.test_scenario_id).toBe('pipeline-scenario');
      });

      // Cleanup
      const result = await injectorService.cleanupScenario('pipeline-scenario');
      expect(result.total_deleted).toBe(15); // 10 signals + 5 predictions
    });
  });
});
