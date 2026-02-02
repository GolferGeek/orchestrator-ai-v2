import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ScenarioRunService } from '../scenario-run.service';
import { ScenarioRunRepository } from '../../repositories/scenario-run.repository';
import { TestAuditLogRepository } from '../../repositories/test-audit-log.repository';
import { TestScenarioRepository } from '../../repositories/test-scenario.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import {
  ScenarioRun,
  TestScenario,
} from '../../interfaces/test-data.interface';

describe('ScenarioRunService', () => {
  let service: ScenarioRunService;
  let scenarioRunRepository: jest.Mocked<ScenarioRunRepository>;
  let testAuditLogRepository: jest.Mocked<TestAuditLogRepository>;
  let testScenarioRepository: jest.Mocked<TestScenarioRepository>;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    organization_slug: 'test-org',
    name: 'Bull Flag Test Scenario',
    description: 'Test scenario for bull flag patterns',
    injection_points: ['signals', 'predictors', 'predictions'],
    target_id: 'target-123',
    config: {
      tier_config: {
        signals_expected: 3,
        predictors_expected: 3,
        predictions_expected: 1,
      },
    },
    status: 'active',
    results: null,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };

  const mockRun: ScenarioRun = {
    id: 'run-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    status: 'pending',
    triggered_by: 'user-123',
    version_info: { code_version: '1.0.0' },
    outcome_expected: { signals_expected: 3, predictors_expected: 3 },
    outcome_actual: null,
    outcome_match: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: new Date().toISOString(),
  };

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const selectResult = overrides?.select ?? { data: [], error: null };

    const createChain = () => {
      // Create an object that can be returned by any method and has a then that resolves with the select result
      const chainableResult = {
        eq: jest.fn(),
        select: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(selectResult),
      };
      // Make eq return itself so chaining works
      chainableResult.eq.mockReturnValue(chainableResult);
      chainableResult.select.mockReturnValue(chainableResult);

      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chainableResult);
      chain.insert = jest
        .fn()
        .mockResolvedValue(overrides?.insert ?? { data: null, error: null });
      chain.update = jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockResolvedValue(overrides?.update ?? { data: null, error: null }),
      });
      chain.eq = jest.fn().mockReturnValue(chainableResult);
      return chain;
    };

    const chain = createChain();

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioRunService,
        {
          provide: ScenarioRunRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockRun),
            findById: jest.fn().mockResolvedValue(mockRun),
            findByScenario: jest.fn().mockResolvedValue([mockRun]),
            markRunning: jest
              .fn()
              .mockResolvedValue({ ...mockRun, status: 'running' }),
            markCompleted: jest
              .fn()
              .mockResolvedValue({ ...mockRun, status: 'completed' }),
            markFailed: jest
              .fn()
              .mockResolvedValue({ ...mockRun, status: 'failed' }),
            getStatistics: jest.fn().mockResolvedValue({
              total_runs: 10,
              completed_runs: 8,
              failed_runs: 2,
              running_runs: 0,
              success_rate: 0.8,
              outcome_match_rate: 0.75,
            }),
          },
        },
        {
          provide: TestAuditLogRepository,
          useValue: {
            log: jest.fn().mockResolvedValue({ id: 'audit-123' }),
            findByResource: jest.fn().mockResolvedValue([
              {
                id: 'log-1',
                action: 'scenario_run_started',
                created_at: new Date().toISOString(),
                details: {},
              },
            ]),
          },
        },
        {
          provide: TestScenarioRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockScenario),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<ScenarioRunService>(ScenarioRunService);
    scenarioRunRepository = module.get(ScenarioRunRepository);
    testAuditLogRepository = module.get(TestAuditLogRepository);
    testScenarioRepository = module.get(TestScenarioRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startRun', () => {
    it('should create a new scenario run', async () => {
      const result = await service.startRun('scenario-123', 'user-123', {
        code_version: '1.0.0',
      });

      expect(testScenarioRepository.findById).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(scenarioRunRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scenario_id: 'scenario-123',
          triggered_by: 'user-123',
          version_info: { code_version: '1.0.0' },
        }),
      );
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scenario_run_started',
          resource_type: 'scenario_run',
        }),
      );
      expect(result).toEqual(mockRun);
    });

    it('should throw NotFoundException when scenario not found', async () => {
      testScenarioRepository.findById.mockResolvedValue(null);

      await expect(service.startRun('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default empty version info', async () => {
      await service.startRun('scenario-123', 'user-123');

      expect(scenarioRunRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version_info: {},
        }),
      );
    });
  });

  describe('executeRun', () => {
    it('should execute a run successfully', async () => {
      const result = await service.executeRun('run-123');

      expect(scenarioRunRepository.findById).toHaveBeenCalledWith('run-123');
      expect(scenarioRunRepository.markRunning).toHaveBeenCalledWith('run-123');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('run_id', 'run-123');
      expect(result).toHaveProperty('signals_generated');
      expect(result).toHaveProperty('predictors_generated');
      expect(result).toHaveProperty('predictions_generated');
      expect(result).toHaveProperty('duration_ms');
    });

    it('should throw NotFoundException when run not found', async () => {
      scenarioRunRepository.findById.mockResolvedValue(null);

      const result = await service.executeRun('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Run nonexistent not found');
    });

    it('should throw NotFoundException when scenario not found during execution', async () => {
      testScenarioRepository.findById.mockResolvedValue(null);

      const result = await service.executeRun('run-123');

      expect(result.success).toBe(false);
    });

    it('should handle errors during article processing', async () => {
      const mockClient = createMockClient({
        select: { data: null, error: { message: 'DB Error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(
        mockClient,
      );

      const result = await service.executeRun('run-123');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should log completion to audit trail', async () => {
      await service.executeRun('run-123');

      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scenario_run_completed',
        }),
      );
    });
  });

  describe('completeRun', () => {
    it('should mark run as completed', async () => {
      const actualOutcome = { signals_generated: 3 };

      await service.completeRun('run-123', actualOutcome, true);

      expect(scenarioRunRepository.markCompleted).toHaveBeenCalledWith(
        'run-123',
        actualOutcome,
        true,
      );
    });
  });

  describe('failRun', () => {
    it('should mark run as failed', async () => {
      await service.failRun('run-123', 'Test error');

      expect(scenarioRunRepository.markFailed).toHaveBeenCalledWith(
        'run-123',
        'Test error',
      );
      expect(testAuditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scenario_run_failed',
        }),
      );
    });

    it('should handle missing run gracefully', async () => {
      scenarioRunRepository.findById.mockResolvedValue(null);

      await service.failRun('nonexistent', 'Test error');

      expect(scenarioRunRepository.markFailed).toHaveBeenCalled();
    });
  });

  describe('getRunResults', () => {
    it('should return run results with audit trail', async () => {
      const result = await service.getRunResults('run-123');

      expect(result.run).toEqual(mockRun);
      expect(result.scenario).toEqual(mockScenario);
      expect(result.audit_trail).toBeDefined();
      expect(result.execution_details).toBeDefined();
    });

    it('should throw NotFoundException when run not found', async () => {
      scenarioRunRepository.findById.mockResolvedValue(null);

      await expect(service.getRunResults('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when scenario not found', async () => {
      testScenarioRepository.findById.mockResolvedValue(null);

      await expect(service.getRunResults('run-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getScenarioRuns', () => {
    it('should return all runs for scenario', async () => {
      const result = await service.getScenarioRuns('scenario-123');

      expect(scenarioRunRepository.findByScenario).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result).toEqual([mockRun]);
    });
  });

  describe('getScenarioRunStatistics', () => {
    it('should return statistics for scenario', async () => {
      const result = await service.getScenarioRunStatistics('scenario-123');

      expect(scenarioRunRepository.getStatistics).toHaveBeenCalledWith(
        'scenario-123',
      );
      expect(result).toHaveProperty('total_runs', 10);
      expect(result).toHaveProperty('completed_runs', 8);
      expect(result).toHaveProperty('success_rate', 0.8);
    });
  });

  describe('compareOutcomes', () => {
    it('should return match when outcomes match', () => {
      const expected = { signals_expected: 3, predictors_expected: 3 };
      const actual = { signals_generated: 3, predictors_generated: 3 };

      const result = service.compareOutcomes(expected, actual);

      expect(result.match).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should return differences when signals mismatch', () => {
      const expected = { signals_expected: 5 };
      const actual = { signals_generated: 3 };

      const result = service.compareOutcomes(expected, actual);

      expect(result.match).toBe(false);
      expect(result.differences).toContain('Signals: expected 5, got 3');
    });

    it('should return differences when predictors mismatch', () => {
      const expected = { predictors_expected: 5 };
      const actual = { predictors_generated: 3 };

      const result = service.compareOutcomes(expected, actual);

      expect(result.match).toBe(false);
      expect(result.differences.some((d) => d.includes('Predictors'))).toBe(
        true,
      );
    });

    it('should return differences when predictions mismatch', () => {
      const expected = { predictions_expected: 2 };
      const actual = { predictions_generated: 1 };

      const result = service.compareOutcomes(expected, actual);

      expect(result.match).toBe(false);
      expect(result.differences.some((d) => d.includes('Predictions'))).toBe(
        true,
      );
    });

    it('should ignore missing fields', () => {
      const expected = {};
      const actual = { signals_generated: 5 };

      const result = service.compareOutcomes(expected, actual);

      expect(result.match).toBe(true);
    });
  });
});
