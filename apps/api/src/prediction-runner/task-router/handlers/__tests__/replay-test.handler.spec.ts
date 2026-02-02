/**
 * Replay Test Handler Tests
 *
 * Tests for the replay test dashboard handler, including:
 * - CRUD operations (list, get, create, delete)
 * - Preview action for affected records
 * - Run action for replay test execution
 * - Results action for comparison results
 * - Error handling for missing required params
 * - Service error handling
 * - Case insensitivity for action names
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ReplayTestHandler } from '../replay-test.handler';
import { HistoricalReplayService } from '../../../services/historical-replay.service';
import {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';
import type {
  ReplayTest,
  ReplayTestResult,
  ReplayAffectedRecords,
  RollbackDepth,
} from '../../../interfaces/test-data.interface';

describe('ReplayTestHandler', () => {
  let handler: ReplayTestHandler;
  let mockHistoricalReplayService: Partial<HistoricalReplayService>;

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

  const mockReplayTest: ReplayTest = {
    id: 'replay-123',
    organization_slug: 'test-org',
    name: 'Test Replay',
    description: 'A test replay test',
    status: 'pending',
    rollback_depth: 'predictions',
    rollback_to: '2024-01-01T00:00:00Z',
    universe_id: 'universe-123',
    target_ids: ['target-1', 'target-2'],
    config: { auto_run: false },
    results: null,
    error_message: null,
    created_by: 'user-123',
    created_at: '2024-01-15T00:00:00Z',
    started_at: null,
    completed_at: null,
  };

  const mockReplayTestWithResults: ReplayTest = {
    ...mockReplayTest,
    id: 'replay-456',
    status: 'completed',
    results: {
      total_comparisons: 10,
      direction_matches: 8,
      original_correct_count: 6,
      replay_correct_count: 7,
      improvements: 1,
      original_accuracy_pct: 60,
      replay_accuracy_pct: 70,
      accuracy_delta: 10,
      total_pnl_original: 1000,
      total_pnl_replay: 1200,
      pnl_delta: 200,
      avg_confidence_diff: 0.05,
    },
    started_at: '2024-01-15T01:00:00Z',
    completed_at: '2024-01-15T02:00:00Z',
  };

  const mockReplayTestResult: ReplayTestResult = {
    id: 'result-1',
    replay_test_id: 'replay-123',
    target_id: 'target-1',
    original_prediction_id: 'pred-orig-1',
    original_direction: 'up',
    original_confidence: 0.75,
    original_magnitude: 'medium',
    original_predicted_at: '2024-01-10T00:00:00Z',
    replay_prediction_id: 'pred-replay-1',
    replay_direction: 'up',
    replay_confidence: 0.8,
    replay_magnitude: 'medium',
    replay_predicted_at: '2024-01-15T00:00:00Z',
    direction_match: true,
    confidence_diff: 0.05,
    evaluation_id: 'eval-1',
    actual_outcome: 'up',
    actual_outcome_value: 1.5,
    original_correct: true,
    replay_correct: true,
    improvement: false,
    pnl_original: 100,
    pnl_replay: 120,
    pnl_diff: 20,
    created_at: '2024-01-15T02:00:00Z',
  };

  const mockAffectedRecords: ReplayAffectedRecords[] = [
    {
      table_name: 'predictions',
      record_ids: ['pred-1', 'pred-2', 'pred-3'],
      row_count: 3,
    },
    {
      table_name: 'predictors',
      record_ids: ['predictor-1', 'predictor-2'],
      row_count: 2,
    },
  ];

  beforeEach(async () => {
    mockHistoricalReplayService = {
      getReplayTests: jest.fn().mockResolvedValue([mockReplayTest]),
      getReplayTestById: jest.fn().mockResolvedValue(mockReplayTest),
      createReplayTest: jest.fn().mockResolvedValue(mockReplayTest),
      deleteReplayTest: jest.fn().mockResolvedValue(undefined),
      previewAffectedRecords: jest.fn().mockResolvedValue(mockAffectedRecords),
      runReplayTest: jest.fn().mockResolvedValue(mockReplayTestWithResults),
      getReplayTestResults: jest.fn().mockResolvedValue([mockReplayTestResult]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplayTestHandler,
        {
          provide: HistoricalReplayService,
          useValue: mockHistoricalReplayService,
        },
      ],
    }).compile();

    handler = module.get<ReplayTestHandler>(ReplayTestHandler);
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
      expect(actions).toContain('delete');
      expect(actions).toContain('preview');
      expect(actions).toContain('run');
      expect(actions).toContain('results');
      expect(actions).toHaveLength(7);
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'unsupported',
        params: {},
      };

      const result = await handler.execute('unsupported', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.message).toContain('unsupported');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });

  describe('execute - list action', () => {
    it('should list all replay tests for organization', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.getReplayTests).toHaveBeenCalledWith(
        'test-org',
      );
      const data = result.data as ReplayTest[];
      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe('replay-123');
    });

    it('should paginate replay test results', async () => {
      const tests = Array.from({ length: 25 }, (_, i) => ({
        ...mockReplayTest,
        id: `replay-${i}`,
      }));
      (
        mockHistoricalReplayService.getReplayTests as jest.Mock
      ).mockResolvedValue(tests);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as ReplayTest[];
      expect(data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.hasMore).toBe(true);
    });

    it('should use default pagination values', async () => {
      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(20);
    });

    it('should handle list service error', async () => {
      (
        mockHistoricalReplayService.getReplayTests as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in list', async () => {
      (
        mockHistoricalReplayService.getReplayTests as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };

      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Failed to list replay tests');
    });
  });

  describe('execute - get action', () => {
    it('should get replay test by ID', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.getReplayTestById,
      ).toHaveBeenCalledWith('replay-123');
      const data = result.data as ReplayTest;
      expect(data.id).toBe('replay-123');
      expect(data.name).toBe('Test Replay');
    });

    it('should return error when ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
      expect(result.error?.message).toBe('Replay test ID is required');
    });

    it('should return error when replay test not found', async () => {
      (
        mockHistoricalReplayService.getReplayTestById as jest.Mock
      ).mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'nonexistent' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.message).toContain('nonexistent');
    });

    it('should handle get service error', async () => {
      (
        mockHistoricalReplayService.getReplayTestById as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in get', async () => {
      (
        mockHistoricalReplayService.getReplayTestById as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
      expect(result.error?.message).toBe('Failed to get replay test');
    });
  });

  describe('execute - create action', () => {
    it('should create a new replay test', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'New Replay Test',
          description: 'Testing replay functionality',
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
          targetIds: ['target-1'],
          config: { auto_run: true },
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.createReplayTest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Replay Test',
          description: 'Testing replay functionality',
          rollback_depth: 'predictions',
          rollback_to: '2024-01-01T00:00:00Z',
          universe_id: 'universe-123',
          target_ids: ['target-1'],
          config: { auto_run: true },
          organization_slug: 'test-org',
          created_by: 'user-123',
        }),
      );
      const data = result.data as ReplayTest;
      expect(data.id).toBe('replay-123');
    });

    it('should create replay test without optional fields', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Minimal Replay Test',
          rollbackDepth: 'signals' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.createReplayTest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Replay Test',
          rollback_depth: 'signals',
          rollback_to: '2024-01-01T00:00:00Z',
          universe_id: 'universe-123',
          organization_slug: 'test-org',
          created_by: 'user-123',
        }),
      );
    });

    it('should return error when name is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('name');
      expect(result.error?.message).toContain('required');
    });

    it('should return error when rollbackDepth is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test',
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('rollbackDepth');
    });

    it('should return error when rollbackTo is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test',
          rollbackDepth: 'predictions' as RollbackDepth,
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('rollbackTo');
    });

    it('should return error when universeId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test',
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('universeId');
    });

    it('should handle create service error', async () => {
      (
        mockHistoricalReplayService.createReplayTest as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test',
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in create', async () => {
      (
        mockHistoricalReplayService.createReplayTest as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          name: 'Test',
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
      expect(result.error?.message).toBe('Failed to create replay test');
    });
  });

  describe('execute - delete action', () => {
    it('should delete a replay test', async () => {
      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.deleteReplayTest).toHaveBeenCalledWith(
        'replay-123',
      );
      const data = result.data as { deleted: boolean; id: string };
      expect(data.deleted).toBe(true);
      expect(data.id).toBe('replay-123');
    });

    it('should return error when ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: {},
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
      expect(result.error?.message).toBe('Replay test ID is required');
    });

    it('should handle delete service error', async () => {
      (
        mockHistoricalReplayService.deleteReplayTest as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in delete', async () => {
      (
        mockHistoricalReplayService.deleteReplayTest as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
      expect(result.error?.message).toBe('Failed to delete replay test');
    });
  });

  describe('execute - preview action', () => {
    it('should preview affected records', async () => {
      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
          targetIds: ['target-1', 'target-2'],
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.previewAffectedRecords,
      ).toHaveBeenCalledWith(
        'predictions',
        '2024-01-01T00:00:00Z',
        'universe-123',
        ['target-1', 'target-2'],
      );
      const data = result.data as {
        rollback_depth: RollbackDepth;
        rollback_to: string;
        universe_id: string;
        target_ids: string[];
        total_records: number;
        by_table: ReplayAffectedRecords[];
      };
      expect(data.rollback_depth).toBe('predictions');
      expect(data.total_records).toBe(5); // 3 + 2 from mockAffectedRecords
      expect(data.by_table).toHaveLength(2);
    });

    it('should preview without target IDs', async () => {
      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'signals' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.previewAffectedRecords,
      ).toHaveBeenCalledWith(
        'signals',
        '2024-01-01T00:00:00Z',
        'universe-123',
        undefined,
      );
    });

    it('should return error when rollbackDepth is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('rollbackDepth');
    });

    it('should return error when rollbackTo is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('rollbackTo');
    });

    it('should return error when universeId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
      expect(result.error?.message).toContain('universeId');
    });

    it('should handle preview service error', async () => {
      (
        mockHistoricalReplayService.previewAffectedRecords as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREVIEW_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in preview', async () => {
      (
        mockHistoricalReplayService.previewAffectedRecords as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'preview',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('preview', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PREVIEW_FAILED');
      expect(result.error?.message).toBe('Failed to preview affected records');
    });
  });

  describe('execute - run action', () => {
    it('should run a replay test', async () => {
      const payload: DashboardRequestPayload = {
        action: 'run',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('run', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.runReplayTest).toHaveBeenCalledWith(
        'replay-123',
      );
      const data = result.data as ReplayTest;
      expect(data.id).toBe('replay-456');
      expect(data.status).toBe('completed');
      expect(data.results).toBeDefined();
      expect(data.results?.total_comparisons).toBe(10);
    });

    it('should return error when ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'run',
        params: {},
      };

      const result = await handler.execute('run', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
      expect(result.error?.message).toBe('Replay test ID is required');
    });

    it('should handle run service error', async () => {
      (
        mockHistoricalReplayService.runReplayTest as jest.Mock
      ).mockRejectedValue(new Error('Execution failed'));

      const payload: DashboardRequestPayload = {
        action: 'run',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('run', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RUN_FAILED');
      expect(result.error?.message).toBe('Execution failed');
    });

    it('should handle non-Error throws in run', async () => {
      (
        mockHistoricalReplayService.runReplayTest as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'run',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('run', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RUN_FAILED');
      expect(result.error?.message).toBe('Failed to run replay test');
    });
  });

  describe('execute - results action', () => {
    it('should get replay test results', async () => {
      const payload: DashboardRequestPayload = {
        action: 'results',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('results', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.getReplayTestResults,
      ).toHaveBeenCalledWith('replay-123');
      const data = result.data as {
        replay_test_id: string;
        count: number;
        results: ReplayTestResult[];
      };
      expect(data.replay_test_id).toBe('replay-123');
      expect(data.count).toBe(1);
      expect(data.results).toHaveLength(1);
      expect(data.results[0]?.id).toBe('result-1');
    });

    it('should return empty results when no results exist', async () => {
      (
        mockHistoricalReplayService.getReplayTestResults as jest.Mock
      ).mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'results',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('results', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as {
        replay_test_id: string;
        count: number;
        results: ReplayTestResult[];
      };
      expect(data.count).toBe(0);
      expect(data.results).toHaveLength(0);
    });

    it('should return error when ID is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'results',
        params: {},
      };

      const result = await handler.execute('results', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
      expect(result.error?.message).toBe('Replay test ID is required');
    });

    it('should handle results service error', async () => {
      (
        mockHistoricalReplayService.getReplayTestResults as jest.Mock
      ).mockRejectedValue(new Error('Database error'));

      const payload: DashboardRequestPayload = {
        action: 'results',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('results', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESULTS_FAILED');
      expect(result.error?.message).toBe('Database error');
    });

    it('should handle non-Error throws in results', async () => {
      (
        mockHistoricalReplayService.getReplayTestResults as jest.Mock
      ).mockRejectedValue('String error');

      const payload: DashboardRequestPayload = {
        action: 'results',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('results', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RESULTS_FAILED');
      expect(result.error?.message).toBe('Failed to get replay test results');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };

      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.getReplayTests).toHaveBeenCalled();
    });

    it('should handle mixed case action names', async () => {
      const payload: DashboardRequestPayload = {
        action: 'Get',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('Get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.getReplayTestById,
      ).toHaveBeenCalledWith('replay-123');
    });

    it('should handle uppercase CREATE action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'CREATE',
        params: {
          name: 'Test',
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('CREATE', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.createReplayTest).toHaveBeenCalled();
    });

    it('should handle mixed case DELETE action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'Delete',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('Delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.deleteReplayTest).toHaveBeenCalledWith(
        'replay-123',
      );
    });

    it('should handle uppercase PREVIEW action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'PREVIEW',
        params: {
          rollbackDepth: 'predictions' as RollbackDepth,
          rollbackTo: '2024-01-01T00:00:00Z',
          universeId: 'universe-123',
        },
      };

      const result = await handler.execute('PREVIEW', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.previewAffectedRecords,
      ).toHaveBeenCalled();
    });

    it('should handle mixed case RUN action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'Run',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('Run', payload, mockContext);

      expect(result.success).toBe(true);
      expect(mockHistoricalReplayService.runReplayTest).toHaveBeenCalledWith(
        'replay-123',
      );
    });

    it('should handle uppercase RESULTS action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'RESULTS',
        params: { id: 'replay-123' },
      };

      const result = await handler.execute('RESULTS', payload, mockContext);

      expect(result.success).toBe(true);
      expect(
        mockHistoricalReplayService.getReplayTestResults,
      ).toHaveBeenCalledWith('replay-123');
    });
  });
});
