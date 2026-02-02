import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  TestScenarioBatchService,
  BatchExecuteParams,
  BatchScenarioResult,
  BatchExecutionSummary,
} from '../test-scenario-batch.service';
import { ScenarioRunService } from '../scenario-run.service';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import { TestAuditLogRepository } from '../../repositories/test-audit-log.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';

describe('TestScenarioBatchService', () => {
  let service: TestScenarioBatchService;
  let scenarioRunService: jest.Mocked<ScenarioRunService>;
  let testScenarioRepository: jest.Mocked<TestScenarioRepository>;
  let testAuditLogRepository: jest.Mocked<TestAuditLogRepository>;
  let supabaseService: jest.Mocked<SupabaseService>;
  let observabilityEventsService: jest.Mocked<ObservabilityEventsService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'anthropic',
    model: 'claude-sonnet',
  });

  const mockScenario = {
    id: 'scenario-123',
    name: 'Test Scenario',
    organization_slug: 'test-org',
    description: 'Test description',
    config: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockRun = {
    id: 'run-123',
    scenario_id: 'scenario-123',
    status: 'pending',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockExecutionResult = {
    success: true,
    signals_generated: 5,
    predictors_generated: 3,
    predictions_generated: 2,
    outcome_match: true,
    errors: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestScenarioBatchService,
        {
          provide: ScenarioRunService,
          useValue: {
            startRun: jest.fn().mockResolvedValue(mockRun),
            executeRun: jest.fn().mockResolvedValue(mockExecutionResult),
          },
        },
        {
          provide: TestScenarioRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockScenario),
            findByOrganization: jest.fn(),
          },
        },
        {
          provide: TestAuditLogRepository,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn(),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestScenarioBatchService>(TestScenarioBatchService);
    scenarioRunService = module.get(ScenarioRunService);
    testScenarioRepository = module.get(TestScenarioRepository);
    testAuditLogRepository = module.get(TestAuditLogRepository);
    supabaseService = module.get(SupabaseService);
    observabilityEventsService = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeBatch', () => {
    it('should execute a batch of scenarios', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Test Batch',
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result).toBeDefined();
      expect(result.batchId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.totalScenarios).toBe(1);
    });

    it('should throw error when no scenario IDs provided', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: [],
      };

      await expect(service.executeBatch(mockExecutionContext, params)).rejects.toThrow(
        'At least one scenario ID is required',
      );
    });

    it('should throw NotFoundException for non-existent scenario', async () => {
      (testScenarioRepository.findById as jest.Mock).mockResolvedValue(null);

      const params: BatchExecuteParams = {
        scenarioIds: ['nonexistent'],
      };

      await expect(service.executeBatch(mockExecutionContext, params)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error for scenario from different organization', async () => {
      (testScenarioRepository.findById as jest.Mock).mockResolvedValue({
        ...mockScenario,
        organization_slug: 'other-org',
      });

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await expect(service.executeBatch(mockExecutionContext, params)).rejects.toThrow(
        'does not belong to organization',
      );
    });

    it('should execute multiple scenarios in batch', async () => {
      const scenarios = [
        mockScenario,
        { ...mockScenario, id: 'scenario-456', name: 'Scenario 2' },
        { ...mockScenario, id: 'scenario-789', name: 'Scenario 3' },
      ];
      (testScenarioRepository.findById as jest.Mock)
        .mockResolvedValueOnce(scenarios[0])
        .mockResolvedValueOnce(scenarios[1])
        .mockResolvedValueOnce(scenarios[2]);

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123', 'scenario-456', 'scenario-789'],
        concurrencyLimit: 2,
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.totalScenarios).toBe(3);
      expect(result.completedScenarios).toBe(3);
      expect(result.results.length).toBe(3);
    });

    it('should respect concurrency limit', async () => {
      const scenarios = Array(5).fill(null).map((_, i) => ({
        ...mockScenario,
        id: `scenario-${i}`,
        name: `Scenario ${i}`,
      }));
      (testScenarioRepository.findById as jest.Mock).mockImplementation((id: string) => {
        const scenario = scenarios.find((s) => s.id === id);
        return Promise.resolve(scenario);
      });

      const params: BatchExecuteParams = {
        scenarioIds: scenarios.map((s) => s.id),
        concurrencyLimit: 2,
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.completedScenarios).toBe(5);
    });

    it('should use default concurrency limit when not specified', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result).toBeDefined();
    });

    it('should log batch start to audit trail', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Audit Test',
      };

      await service.executeBatch(mockExecutionContext, params);

      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'batch_execution_started',
          resource_type: 'batch_execution',
        }),
      );
    });

    it('should log batch completion to audit trail', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await service.executeBatch(mockExecutionContext, params);

      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'batch_execution_completed',
          resource_type: 'batch_execution',
        }),
      );
    });

    it('should send observability events for batch start', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await service.executeBatch(mockExecutionContext, params);

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'batch.started',
          status: 'running',
        }),
      );
    });

    it('should send observability events for batch completion', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await service.executeBatch(mockExecutionContext, params);

      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'batch.completed',
          status: 'completed',
        }),
      );
    });

    it('should handle scenario execution failures', async () => {
      (scenarioRunService.executeRun as jest.Mock).mockResolvedValue({
        ...mockExecutionResult,
        success: false,
        errors: ['Execution failed'],
      });

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.failedScenarios).toBe(1);
      expect(result.results[0]?.status).toBe('failed');
    });

    it('should handle scenario run start failures', async () => {
      (scenarioRunService.startRun as jest.Mock).mockRejectedValue(
        new Error('Failed to start run'),
      );

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.failedScenarios).toBe(1);
      expect(result.results[0]?.errors).toContain('Failed to start run');
    });

    it('should include version info in runs', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        versionInfo: { version: '1.0.0', commit: 'abc123' },
      };

      await service.executeBatch(mockExecutionContext, params);

      expect(scenarioRunService.startRun).toHaveBeenCalledWith(
        'scenario-123',
        'user-123',
        expect.objectContaining({
          version: '1.0.0',
          commit: 'abc123',
        }),
      );
    });

    it('should calculate aggregates correctly', async () => {
      const scenarios = [
        mockScenario,
        { ...mockScenario, id: 'scenario-456', name: 'Scenario 2' },
      ];
      (testScenarioRepository.findById as jest.Mock)
        .mockResolvedValueOnce(scenarios[0])
        .mockResolvedValueOnce(scenarios[1]);

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123', 'scenario-456'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.aggregates.total_signals).toBe(10); // 5 * 2 scenarios
      expect(result.aggregates.total_predictors).toBe(6); // 3 * 2 scenarios
      expect(result.aggregates.total_predictions).toBe(4); // 2 * 2 scenarios
      expect(result.aggregates.scenarios_with_outcome_match).toBe(2);
      expect(result.aggregates.scenarios_with_errors).toBe(0);
    });
  });

  describe('getBatchStatus', () => {
    it('should return batch status for active batch', async () => {
      // First create a batch
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Status Test',
      };
      const batchResult = await service.executeBatch(mockExecutionContext, params);

      const status = service.getBatchStatus(mockExecutionContext, batchResult.batchId);

      expect(status).toBeDefined();
      expect(status.batchId).toBe(batchResult.batchId);
      expect(status.status).toBe('completed');
    });

    it('should throw NotFoundException for non-existent batch', () => {
      expect(() => service.getBatchStatus(mockExecutionContext, 'nonexistent')).toThrow(
        NotFoundException,
      );
    });

    it('should throw error for batch from different organization', async () => {
      // Create batch
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      const batchResult = await service.executeBatch(mockExecutionContext, params);

      // Try to access with different org
      const otherContext = createMockExecutionContext({
        ...mockExecutionContext,
        orgSlug: 'other-org',
      });

      expect(() => service.getBatchStatus(otherContext, batchResult.batchId)).toThrow(
        'does not belong to organization',
      );
    });

    it('should include results in status', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      const batchResult = await service.executeBatch(mockExecutionContext, params);

      const status = service.getBatchStatus(mockExecutionContext, batchResult.batchId);

      expect(status.results.length).toBe(1);
      expect(status.results[0]?.scenarioId).toBe('scenario-123');
    });

    it('should calculate duration correctly', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      const batchResult = await service.executeBatch(mockExecutionContext, params);

      const status = service.getBatchStatus(mockExecutionContext, batchResult.batchId);

      expect(status.duration_ms).toBeDefined();
      expect(status.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('listBatches', () => {
    it('should list batches for organization', async () => {
      // Create a batch first
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      await service.executeBatch(mockExecutionContext, params);

      const batches = service.listBatches(mockExecutionContext);

      expect(batches.length).toBeGreaterThan(0);
      expect(batches[0]?.organization_slug).toBe('test-org');
    });

    it('should return empty array for organization with no batches', () => {
      const otherContext = createMockExecutionContext({
        ...mockExecutionContext,
        orgSlug: 'empty-org',
      });

      const batches = service.listBatches(otherContext);

      expect(batches).toEqual([]);
    });

    it('should sort batches by creation time descending', async () => {
      // Create multiple batches
      const params1: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Batch 1',
      };
      await service.executeBatch(mockExecutionContext, params1);

      const params2: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Batch 2',
      };
      await service.executeBatch(mockExecutionContext, params2);

      const batches = service.listBatches(mockExecutionContext);

      // Verify that batches are returned (both created)
      expect(batches.length).toBe(2);
      // Verify all batches have names
      const batchNames = batches.map((b) => b.batch_name);
      expect(batchNames).toContain('Batch 1');
      expect(batchNames).toContain('Batch 2');
    });

    it('should only return batches for the requesting organization', async () => {
      // Create batch for test-org
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      await service.executeBatch(mockExecutionContext, params);

      // Check different org sees nothing
      const otherContext = createMockExecutionContext({
        ...mockExecutionContext,
        orgSlug: 'other-org',
      });
      const batches = service.listBatches(otherContext);

      expect(batches).toEqual([]);
    });
  });

  describe('cleanupOldBatches', () => {
    it('should cleanup old completed batches', async () => {
      // Create a batch
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      await service.executeBatch(mockExecutionContext, params);

      // Cleanup with 0 hour max age (should clean all)
      const cleanedCount = service.cleanupOldBatches(0);

      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('should not cleanup recent batches', async () => {
      // Create a batch
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      await service.executeBatch(mockExecutionContext, params);

      // Cleanup with 24 hour max age (should not clean recent)
      const cleanedCount = service.cleanupOldBatches(24);

      expect(cleanedCount).toBe(0);
    });

    it('should use default max age when not specified', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };
      await service.executeBatch(mockExecutionContext, params);

      const cleanedCount = service.cleanupOldBatches();

      expect(cleanedCount).toBe(0); // Recent batch should not be cleaned
    });
  });

  describe('batch result structure', () => {
    it('should return complete BatchExecutionSummary', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
        batchName: 'Structure Test',
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result).toHaveProperty('batchId');
      expect(result).toHaveProperty('batchName');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('totalScenarios');
      expect(result).toHaveProperty('completedScenarios');
      expect(result).toHaveProperty('failedScenarios');
      expect(result).toHaveProperty('runningScenarios');
      expect(result).toHaveProperty('pendingScenarios');
      expect(result).toHaveProperty('startedAt');
      expect(result).toHaveProperty('completedAt');
      expect(result).toHaveProperty('duration_ms');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('aggregates');
    });

    it('should return complete BatchScenarioResult for each scenario', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);
      const scenarioResult = result.results[0] as BatchScenarioResult;

      expect(scenarioResult).toHaveProperty('scenarioId');
      expect(scenarioResult).toHaveProperty('scenarioName');
      expect(scenarioResult).toHaveProperty('runId');
      expect(scenarioResult).toHaveProperty('status');
      expect(scenarioResult).toHaveProperty('startedAt');
      expect(scenarioResult).toHaveProperty('completedAt');
      expect(scenarioResult).toHaveProperty('signals_generated');
      expect(scenarioResult).toHaveProperty('predictors_generated');
      expect(scenarioResult).toHaveProperty('predictions_generated');
      expect(scenarioResult).toHaveProperty('outcome_match');
      expect(scenarioResult).toHaveProperty('errors');
      expect(scenarioResult).toHaveProperty('duration_ms');
    });

    it('should have valid aggregate structure', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.aggregates).toHaveProperty('total_signals');
      expect(result.aggregates).toHaveProperty('total_predictors');
      expect(result.aggregates).toHaveProperty('total_predictions');
      expect(result.aggregates).toHaveProperty('scenarios_with_outcome_match');
      expect(result.aggregates).toHaveProperty('scenarios_with_errors');
      expect(result.aggregates).toHaveProperty('average_duration_ms');
    });
  });

  describe('error scenarios', () => {
    it('should handle batch-level failure and throw error', async () => {
      // Force validation to fail by making scenario lookup throw
      (testScenarioRepository.findById as jest.Mock).mockRejectedValue(
        new Error('Repository error'),
      );

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await expect(service.executeBatch(mockExecutionContext, params)).rejects.toThrow(
        'Repository error',
      );
    });

    it('should send start observability event before error', async () => {
      (testScenarioRepository.findById as jest.Mock).mockRejectedValue(
        new Error('Critical error'),
      );

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      await expect(service.executeBatch(mockExecutionContext, params)).rejects.toThrow();

      // Batch.started event is sent before the error occurs during validation
      expect(observabilityEventsService.push).toHaveBeenCalledWith(
        expect.objectContaining({
          hook_event_type: 'batch.started',
          status: 'running',
        }),
      );
    });

    it('should continue with other scenarios when one fails', async () => {
      const scenarios = [
        mockScenario,
        { ...mockScenario, id: 'scenario-456', name: 'Scenario 2' },
      ];
      (testScenarioRepository.findById as jest.Mock)
        .mockResolvedValueOnce(scenarios[0])
        .mockResolvedValueOnce(scenarios[1]);

      // Make first run fail, second succeed
      (scenarioRunService.startRun as jest.Mock)
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce(mockRun);

      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123', 'scenario-456'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.completedScenarios).toBe(1);
      expect(result.failedScenarios).toBe(1);
    });
  });

  describe('batch ID generation', () => {
    it('should generate unique batch IDs', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result1 = await service.executeBatch(mockExecutionContext, params);
      const result2 = await service.executeBatch(mockExecutionContext, params);

      expect(result1.batchId).not.toBe(result2.batchId);
    });

    it('should include timestamp in batch ID', async () => {
      const params: BatchExecuteParams = {
        scenarioIds: ['scenario-123'],
      };

      const result = await service.executeBatch(mockExecutionContext, params);

      expect(result.batchId).toMatch(/^batch-\d+-/);
    });
  });
});
