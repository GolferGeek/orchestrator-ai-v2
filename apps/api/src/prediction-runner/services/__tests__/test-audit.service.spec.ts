import { Test, TestingModule } from '@nestjs/testing';
import { TestAuditService } from '../test-audit.service';
import { TestAuditLogRepository } from '../../repositories/test-audit-log.repository';
import {
  TestAuditLogEntry,
  TestScenario,
  ScenarioRun,
} from '../../interfaces/test-data.interface';
import { LearningLineage } from '../../interfaces/learning.interface';

describe('TestAuditService', () => {
  let service: TestAuditService;
  let auditLogRepository: jest.Mocked<TestAuditLogRepository>;

  const mockAuditLogEntry: TestAuditLogEntry = {
    id: 'audit-123',
    organization_slug: 'test-org',
    user_id: 'user-123',
    action: 'scenario_created',
    resource_type: 'test_scenario',
    resource_id: 'scenario-123',
    details: { scenario_name: 'Test Scenario' },
    created_at: new Date().toISOString(),
  };

  const mockScenario: TestScenario = {
    id: 'scenario-123',
    organization_slug: 'test-org',
    name: 'Bull Flag Test Scenario',
    description: 'Test scenario for bull flag patterns',
    injection_points: ['signals', 'predictors'],
    target_id: 'target-123',
    config: { tier_config: {} },
    status: 'active',
    results: null,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };

  const mockScenarioRun: ScenarioRun = {
    id: 'run-123',
    organization_slug: 'test-org',
    scenario_id: 'scenario-123',
    status: 'completed',
    triggered_by: 'user-123',
    version_info: { code_version: '1.0.0' },
    outcome_expected: { signals_expected: 3 },
    outcome_actual: { signals_generated: 3 },
    outcome_match: true,
    error_message: null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestAuditService,
        {
          provide: TestAuditLogRepository,
          useValue: {
            log: jest.fn().mockResolvedValue(mockAuditLogEntry),
            getAuditTrail: jest.fn().mockResolvedValue([mockAuditLogEntry]),
            findByUser: jest.fn().mockResolvedValue([mockAuditLogEntry]),
            getRecent: jest.fn().mockResolvedValue([mockAuditLogEntry]),
            find: jest.fn().mockResolvedValue([mockAuditLogEntry]),
            findByResource: jest.fn().mockResolvedValue([mockAuditLogEntry]),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<TestAuditService>(TestAuditService);
    auditLogRepository = module.get(TestAuditLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log a generic audit entry', async () => {
      const result = await service.log(
        'test-org',
        'user-123',
        'custom_action',
        'custom_resource',
        'resource-456',
        { custom: 'detail' },
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'custom_action',
        resource_type: 'custom_resource',
        resource_id: 'resource-456',
        details: { custom: 'detail' },
      });
      expect(result).toEqual(mockAuditLogEntry);
    });

    it('should use empty details when not provided', async () => {
      await service.log(
        'test-org',
        'user-123',
        'action',
        'resource_type',
        'resource-id',
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          details: {},
        }),
      );
    });
  });

  describe('logScenarioCreated', () => {
    it('should log scenario created event', async () => {
      const result = await service.logScenarioCreated(mockScenario, 'user-123');

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_created',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: expect.objectContaining({
          scenario_name: 'Bull Flag Test Scenario',
          injection_points: ['signals', 'predictors'],
          target_id: 'target-123',
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logScenarioUpdated', () => {
    it('should log scenario updated event', async () => {
      const changes = { name: 'New Name', description: 'New Description' };

      const result = await service.logScenarioUpdated(
        mockScenario,
        'user-123',
        changes,
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_updated',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: expect.objectContaining({
          scenario_name: 'Bull Flag Test Scenario',
          changes,
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logScenarioDeleted', () => {
    it('should log scenario deleted event', async () => {
      const result = await service.logScenarioDeleted(
        'scenario-123',
        'test-org',
        'user-123',
        'Deleted Scenario',
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_deleted',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: { scenario_name: 'Deleted Scenario' },
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logScenarioRunStarted', () => {
    it('should log scenario run started event', async () => {
      const result = await service.logScenarioRunStarted(
        mockScenarioRun,
        'user-123',
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_run_started',
        resource_type: 'scenario_run',
        resource_id: 'run-123',
        details: expect.objectContaining({
          scenario_id: 'scenario-123',
          version_info: { code_version: '1.0.0' },
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logScenarioRunCompleted', () => {
    it('should log scenario run completed event', async () => {
      const result = await service.logScenarioRunCompleted(
        mockScenarioRun,
        'user-123',
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_run_completed',
        resource_type: 'scenario_run',
        resource_id: 'run-123',
        details: expect.objectContaining({
          scenario_id: 'scenario-123',
          outcome_match: true,
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });

    it('should calculate duration when timestamps are available', async () => {
      await service.logScenarioRunCompleted(mockScenarioRun, 'user-123');

      expect(auditLogRepository.log).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            duration_ms: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('logScenarioRunFailed', () => {
    it('should log scenario run failed event', async () => {
      const failedRun = {
        ...mockScenarioRun,
        status: 'failed' as const,
        error_message: 'Test error',
      };

      const result = await service.logScenarioRunFailed(failedRun, 'user-123');

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'scenario_run_failed',
        resource_type: 'scenario_run',
        resource_id: 'run-123',
        details: expect.objectContaining({
          error_message: 'Test error',
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logLearningPromoted', () => {
    it('should log learning promoted event', async () => {
      const lineage: LearningLineage = {
        id: 'lineage-123',
        organization_slug: 'test-org',
        test_learning_id: 'test-learning-123',
        production_learning_id: 'prod-learning-456',
        scenario_runs: ['run-1', 'run-2'],
        validation_metrics: { accuracy: 0.85 },
        backtest_result: { status: 'pass', accuracy: 0.85 },
        promoted_by: 'user-123',
        promoted_at: new Date().toISOString(),
        notes: 'Promoting after successful validation',
        created_at: new Date().toISOString(),
      };

      const result = await service.logLearningPromoted(lineage, 'user-123');

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'learning_promoted',
        resource_type: 'learning',
        resource_id: 'test-learning-123',
        details: expect.objectContaining({
          production_learning_id: 'prod-learning-456',
          lineage_id: 'lineage-123',
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logLearningRejected', () => {
    it('should log learning rejected event', async () => {
      const result = await service.logLearningRejected(
        'learning-123',
        'test-org',
        'user-123',
        'Validation failed',
        { accuracy: 0.45 },
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'learning_rejected',
        resource_type: 'learning',
        resource_id: 'learning-123',
        details: expect.objectContaining({
          reason: 'Validation failed',
          accuracy: 0.45,
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logDataInjected', () => {
    it('should log data injection event', async () => {
      const result = await service.logDataInjected(
        'scenario-123',
        'test-org',
        'user-123',
        {
          injection_points: ['signals', 'predictors'],
          items_injected: { signals: 5, predictors: 3 },
        },
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'data_injected',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: {
          injection_points: ['signals', 'predictors'],
          items_injected: { signals: 5, predictors: 3 },
        },
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('logDataCleaned', () => {
    it('should log data cleanup event', async () => {
      const result = await service.logDataCleaned(
        'scenario-123',
        'test-org',
        'user-123',
        {
          tables_cleaned: [
            { table_name: 'signals', rows_deleted: 10 },
            { table_name: 'predictors', rows_deleted: 5 },
          ],
          total_deleted: 15,
        },
      );

      expect(auditLogRepository.log).toHaveBeenCalledWith({
        organization_slug: 'test-org',
        user_id: 'user-123',
        action: 'data_cleaned',
        resource_type: 'test_scenario',
        resource_id: 'scenario-123',
        details: expect.objectContaining({
          total_deleted: 15,
        }),
      });
      expect(result).toEqual(mockAuditLogEntry);
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for a resource', async () => {
      const result = await service.getAuditTrail(
        'test_scenario',
        'scenario-123',
      );

      expect(auditLogRepository.getAuditTrail).toHaveBeenCalledWith(
        'test_scenario',
        'scenario-123',
      );
      expect(result).toEqual([mockAuditLogEntry]);
    });
  });

  describe('getUserActions', () => {
    it('should return user actions', async () => {
      const result = await service.getUserActions('user-123', 'test-org');

      expect(auditLogRepository.findByUser).toHaveBeenCalledWith(
        'user-123',
        'test-org',
        {
          start_date: undefined,
          end_date: undefined,
          limit: undefined,
        },
      );
      expect(result).toEqual([mockAuditLogEntry]);
    });

    it('should pass date range when provided', async () => {
      await service.getUserActions('user-123', 'test-org', {
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

      expect(auditLogRepository.findByUser).toHaveBeenCalledWith(
        'user-123',
        'test-org',
        {
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          limit: undefined,
        },
      );
    });

    it('should pass limit when provided', async () => {
      await service.getUserActions('user-123', 'test-org', undefined, 100);

      expect(auditLogRepository.findByUser).toHaveBeenCalledWith(
        'user-123',
        'test-org',
        {
          start_date: undefined,
          end_date: undefined,
          limit: 100,
        },
      );
    });
  });

  describe('getRecentActions', () => {
    it('should return recent actions with default limit', async () => {
      const result = await service.getRecentActions('test-org');

      expect(auditLogRepository.getRecent).toHaveBeenCalledWith('test-org', 50);
      expect(result).toEqual([mockAuditLogEntry]);
    });

    it('should use custom limit when provided', async () => {
      await service.getRecentActions('test-org', 100);

      expect(auditLogRepository.getRecent).toHaveBeenCalledWith(
        'test-org',
        100,
      );
    });
  });

  describe('findAuditEntries', () => {
    it('should find audit entries with filter', async () => {
      const filter = { action: 'scenario_created' };
      const result = await service.findAuditEntries('test-org', filter);

      expect(auditLogRepository.find).toHaveBeenCalledWith('test-org', filter);
      expect(result).toEqual([mockAuditLogEntry]);
    });

    it('should find entries without filter', async () => {
      await service.findAuditEntries('test-org');

      expect(auditLogRepository.find).toHaveBeenCalledWith(
        'test-org',
        undefined,
      );
    });
  });

  describe('getScenarioAuditTrail', () => {
    it('should return scenario and run events', async () => {
      auditLogRepository.find.mockResolvedValue([
        {
          ...mockAuditLogEntry,
          resource_type: 'scenario_run',
          details: { scenario_id: 'scenario-123' },
        },
      ]);

      const result = await service.getScenarioAuditTrail(
        'scenario-123',
        'test-org',
      );

      expect(result.scenario_events).toBeDefined();
      expect(result.run_events).toBeDefined();
      expect(auditLogRepository.findByResource).toHaveBeenCalledWith(
        'test_scenario',
        'scenario-123',
      );
      expect(auditLogRepository.find).toHaveBeenCalledWith('test-org', {
        resource_type: 'scenario_run',
      });
    });

    it('should filter run events by scenario_id', async () => {
      auditLogRepository.find.mockResolvedValue([
        {
          ...mockAuditLogEntry,
          resource_type: 'scenario_run',
          details: { scenario_id: 'scenario-123' },
        },
        {
          ...mockAuditLogEntry,
          resource_type: 'scenario_run',
          details: { scenario_id: 'other-scenario' },
        },
      ]);

      const result = await service.getScenarioAuditTrail(
        'scenario-123',
        'test-org',
      );

      expect(result.run_events).toHaveLength(1);
    });
  });

  describe('getAuditStatistics', () => {
    it('should return statistics about audit activity', async () => {
      auditLogRepository.find.mockResolvedValue([
        {
          ...mockAuditLogEntry,
          action: 'scenario_created',
          resource_type: 'test_scenario',
          user_id: 'user-1',
        },
        {
          ...mockAuditLogEntry,
          action: 'scenario_created',
          resource_type: 'test_scenario',
          user_id: 'user-2',
        },
        {
          ...mockAuditLogEntry,
          action: 'scenario_run_started',
          resource_type: 'scenario_run',
          user_id: 'user-1',
        },
      ]);

      const result = await service.getAuditStatistics('test-org');

      expect(result.total_events).toBe(3);
      expect(result.events_by_action['scenario_created']).toBe(2);
      expect(result.events_by_action['scenario_run_started']).toBe(1);
      expect(result.events_by_resource_type['test_scenario']).toBe(2);
      expect(result.unique_users).toBe(2);
      expect(result.recent_activity).toHaveLength(3);
    });

    it('should pass date range to find', async () => {
      await service.getAuditStatistics('test-org', {
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });

      expect(auditLogRepository.find).toHaveBeenCalledWith('test-org', {
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        limit: 1000,
      });
    });
  });
});
