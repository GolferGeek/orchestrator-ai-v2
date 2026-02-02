/**
 * Test Target Mirror Handler Tests
 *
 * Tests for the test target mirror dashboard handler, including:
 * - List action for mirrors
 * - List with targets action (enriched)
 * - Get action for individual mirrors
 * - Get by real target
 * - Get by test target
 * - Create action for new mirrors
 * - Delete action for removing mirrors
 */

import { Test } from '@nestjs/testing';
import { TestTargetMirrorHandler } from '../test-target-mirror.handler';
import { TestTargetMirrorRepository } from '../../../repositories/test-target-mirror.repository';
import { TargetRepository } from '../../../repositories/target.repository';
import type {
  ExecutionContext,
  DashboardRequestPayload,
} from '@orchestrator-ai/transport-types';

describe('TestTargetMirrorHandler', () => {
  let handler: TestTargetMirrorHandler;
  let testTargetMirrorRepository: jest.Mocked<TestTargetMirrorRepository>;
  let targetRepository: jest.Mocked<TargetRepository>;

  const mockContext: ExecutionContext = {
    orgSlug: 'test-org',
    userId: 'test-user',
    conversationId: 'test-conversation',
    taskId: 'test-task',
    planId: 'test-plan',
    deliverableId: '',
    agentSlug: 'prediction-runner',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-sonnet-4',
  };

  const mockMirror = {
    id: 'mirror-1',
    real_target_id: 'target-1',
    test_target_id: 'target-t-1',
    created_at: '2024-01-15T00:00:00Z',
  };

  const mockRealTarget = {
    id: 'target-1',
    universe_id: 'universe-1',
    symbol: 'AAPL',
    name: 'Apple Inc',
    target_type: 'stock' as const,
    context: 'Tech company',
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-15T00:00:00Z',
    llm_config_override: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  const mockTestTarget = {
    id: 'target-t-1',
    universe_id: 'universe-1',
    symbol: 'T_AAPL',
    name: 'Test Apple Inc',
    target_type: 'stock' as const,
    context: 'Test tech company',
    is_active: true,
    is_archived: false,
    current_price: 150.0,
    price_updated_at: '2024-01-15T00:00:00Z',
    llm_config_override: null,
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const mockTestTargetMirrorRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByRealTarget: jest.fn(),
      findByTestTarget: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      getTestTargetId: jest.fn(),
      getRealTargetId: jest.fn(),
    };

    const mockTargetRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByIdOrThrow: jest.fn(),
      findBySymbol: jest.fn(),
      findActiveByUniverse: jest.fn(),
      findAllActive: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateCurrentPrice: jest.fn(),
      delete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TestTargetMirrorHandler,
        {
          provide: TestTargetMirrorRepository,
          useValue: mockTestTargetMirrorRepository,
        },
        {
          provide: TargetRepository,
          useValue: mockTargetRepository,
        },
      ],
    }).compile();

    handler = moduleRef.get<TestTargetMirrorHandler>(TestTargetMirrorHandler);
    testTargetMirrorRepository = moduleRef.get(TestTargetMirrorRepository);
    targetRepository = moduleRef.get(TargetRepository);
  });

  describe('getSupportedActions', () => {
    it('should return all supported actions', () => {
      const actions = handler.getSupportedActions();
      expect(actions).toContain('list');
      expect(actions).toContain('get');
      expect(actions).toContain('get-by-real-target');
      expect(actions).toContain('get-by-test-target');
      expect(actions).toContain('create');
      expect(actions).toContain('delete');
      expect(actions).toContain('list-with-targets');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload: DashboardRequestPayload = {
        action: 'invalid',
        params: {},
      };
      const result = await handler.execute('invalid', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
    });
  });

  describe('execute - list action', () => {
    it('should list all mirrors', async () => {
      testTargetMirrorRepository.findAll.mockResolvedValue([mockMirror]);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findAll).toHaveBeenCalled();
      expect(result.data).toEqual([mockMirror]);
    });

    it('should paginate results', async () => {
      const mirrors = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockMirror, id: `mirror-${i}` }));
      testTargetMirrorRepository.findAll.mockResolvedValue(mirrors);

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(true);
      const data = result.data as typeof mirrors;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.pageSize).toBe(10);
    });

    it('should handle list service error', async () => {
      testTargetMirrorRepository.findAll.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list',
        params: {},
      };
      const result = await handler.execute('list', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_FAILED');
      expect(result.error?.message).toBe('Database error');
    });
  });

  describe('execute - list-with-targets action', () => {
    it('should list mirrors with target details', async () => {
      testTargetMirrorRepository.findAll.mockResolvedValue([mockMirror]);
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(mockTestTarget);

      const payload: DashboardRequestPayload = {
        action: 'list-with-targets',
        params: {},
      };
      const result = await handler.execute(
        'list-with-targets',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(targetRepository.findById).toHaveBeenCalledWith('target-1');
      expect(targetRepository.findById).toHaveBeenCalledWith('target-t-1');
      const data = result.data as Array<{
        id: string;
        real_target?: { id: string; name: string; symbol: string };
        test_target?: { id: string; name: string; symbol: string };
      }>;
      expect(data[0]?.real_target).toBeDefined();
      expect(data[0]?.test_target).toBeDefined();
      expect(data[0]?.real_target?.symbol).toBe('AAPL');
      expect(data[0]?.test_target?.symbol).toBe('T_AAPL');
    });

    it('should handle case insensitive action name', async () => {
      testTargetMirrorRepository.findAll.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'listwithtargets',
        params: {},
      };
      const result = await handler.execute(
        'listwithtargets',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findAll).toHaveBeenCalled();
    });

    it('should handle target fetch errors gracefully', async () => {
      testTargetMirrorRepository.findAll.mockResolvedValue([mockMirror]);
      targetRepository.findById.mockRejectedValue(
        new Error('Target not found'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list-with-targets',
        params: {},
      };
      const result = await handler.execute(
        'list-with-targets',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as (typeof mockMirror)[];
      expect(data[0]).toEqual(mockMirror);
    });

    it('should paginate enriched results', async () => {
      const mirrors = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockMirror, id: `mirror-${i}` }));
      testTargetMirrorRepository.findAll.mockResolvedValue(mirrors);
      targetRepository.findById.mockResolvedValue(mockRealTarget);

      const payload: DashboardRequestPayload = {
        action: 'list-with-targets',
        params: { page: 2, pageSize: 10 },
      };
      const result = await handler.execute(
        'list-with-targets',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      const data = result.data as typeof mirrors;
      expect(data).toHaveLength(10);
      expect(result.metadata?.totalCount).toBe(25);
      expect(result.metadata?.page).toBe(2);
    });

    it('should handle list-with-targets service error', async () => {
      testTargetMirrorRepository.findAll.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'list-with-targets',
        params: {},
      };
      const result = await handler.execute(
        'list-with-targets',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LIST_WITH_TARGETS_FAILED');
    });
  });

  describe('execute - get action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get',
        params: {},
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should get mirror by id', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'mirror-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findById).toHaveBeenCalledWith(
        'mirror-1',
      );
      expect(result.data).toEqual(mockMirror);
    });

    it('should get mirror with target details when includeTargetDetails is true', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(mockMirror);
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(mockTestTarget);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'mirror-1', includeTargetDetails: true },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(true);
      expect(targetRepository.findById).toHaveBeenCalledWith('target-1');
      expect(targetRepository.findById).toHaveBeenCalledWith('target-t-1');
      const data = result.data as {
        id: string;
        real_target?: { id: string; name: string; symbol: string };
        test_target?: { id: string; name: string; symbol: string };
      };
      expect(data.real_target).toBeDefined();
      expect(data.test_target).toBeDefined();
    });

    it('should return NOT_FOUND error if mirror does not exist', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle get service error', async () => {
      testTargetMirrorRepository.findById.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get',
        params: { id: 'mirror-1' },
      };
      const result = await handler.execute('get', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_FAILED');
    });
  });

  describe('execute - get-by-real-target action', () => {
    it('should return error if realTargetId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get-by-real-target',
        params: {},
      };
      const result = await handler.execute(
        'get-by-real-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_REAL_TARGET_ID');
    });

    it('should get mirror by real target id', async () => {
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'get-by-real-target',
        params: { realTargetId: 'target-1' },
      };
      const result = await handler.execute(
        'get-by-real-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findByRealTarget).toHaveBeenCalledWith(
        'target-1',
      );
      expect(result.data).toEqual(mockMirror);
    });

    it('should handle case insensitive action name', async () => {
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'getbyrealtarget',
        params: { realTargetId: 'target-1' },
      };
      const result = await handler.execute(
        'getbyrealtarget',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findByRealTarget).toHaveBeenCalledWith(
        'target-1',
      );
    });

    it('should return NOT_FOUND error if no mirror found', async () => {
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get-by-real-target',
        params: { realTargetId: 'non-existent' },
      };
      const result = await handler.execute(
        'get-by-real-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle service error', async () => {
      testTargetMirrorRepository.findByRealTarget.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get-by-real-target',
        params: { realTargetId: 'target-1' },
      };
      const result = await handler.execute(
        'get-by-real-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_BY_REAL_TARGET_FAILED');
    });
  });

  describe('execute - get-by-test-target action', () => {
    it('should return error if testTargetId is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'get-by-test-target',
        params: {},
      };
      const result = await handler.execute(
        'get-by-test-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_TEST_TARGET_ID');
    });

    it('should get mirror by test target id', async () => {
      testTargetMirrorRepository.findByTestTarget.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'get-by-test-target',
        params: { testTargetId: 'target-t-1' },
      };
      const result = await handler.execute(
        'get-by-test-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findByTestTarget).toHaveBeenCalledWith(
        'target-t-1',
      );
      expect(result.data).toEqual(mockMirror);
    });

    it('should handle case insensitive action name', async () => {
      testTargetMirrorRepository.findByTestTarget.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'getbytesttarget',
        params: { testTargetId: 'target-t-1' },
      };
      const result = await handler.execute(
        'getbytesttarget',
        payload,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.findByTestTarget).toHaveBeenCalledWith(
        'target-t-1',
      );
    });

    it('should return NOT_FOUND error if no mirror found', async () => {
      testTargetMirrorRepository.findByTestTarget.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'get-by-test-target',
        params: { testTargetId: 'non-existent' },
      };
      const result = await handler.execute(
        'get-by-test-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should handle service error', async () => {
      testTargetMirrorRepository.findByTestTarget.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'get-by-test-target',
        params: { testTargetId: 'target-t-1' },
      };
      const result = await handler.execute(
        'get-by-test-target',
        payload,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GET_BY_TEST_TARGET_FAILED');
    });
  });

  describe('execute - create action', () => {
    it('should return error if required fields are missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'create',
        params: { real_target_id: 'target-1' },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_DATA');
    });

    it('should return error if real target does not exist', async () => {
      targetRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REAL_TARGET_NOT_FOUND');
    });

    it('should return error if test target does not exist', async () => {
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(null);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TEST_TARGET_NOT_FOUND');
    });

    it('should return error if test target symbol does not have T_ prefix', async () => {
      const invalidTestTarget = { ...mockTestTarget, symbol: 'INVALID' };
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(invalidTestTarget);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_TEST_TARGET');
    });

    it('should return error if mirror already exists for real target', async () => {
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(mockTestTarget);
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MIRROR_EXISTS');
      expect(result.error?.details?.existing_mirror).toEqual(mockMirror);
    });

    it('should create mirror successfully', async () => {
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(mockTestTarget);
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(null);
      testTargetMirrorRepository.create.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.create).toHaveBeenCalledWith({
        real_target_id: 'target-1',
        test_target_id: 'target-t-1',
      });
      expect(result.data).toEqual(mockMirror);
    });

    it('should handle create service error', async () => {
      targetRepository.findById
        .mockResolvedValueOnce(mockRealTarget)
        .mockResolvedValueOnce(mockTestTarget);
      testTargetMirrorRepository.findByRealTarget.mockResolvedValue(null);
      testTargetMirrorRepository.create.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'create',
        params: {
          real_target_id: 'target-1',
          test_target_id: 'target-t-1',
        },
      };
      const result = await handler.execute('create', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_FAILED');
    });
  });

  describe('execute - delete action', () => {
    it('should return error if id is missing', async () => {
      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: {},
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error if mirror does not exist', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(null);

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'non-existent' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should delete mirror successfully', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(mockMirror);
      testTargetMirrorRepository.delete.mockResolvedValue(undefined);

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'mirror-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(true);
      expect(testTargetMirrorRepository.delete).toHaveBeenCalledWith(
        'mirror-1',
      );
      const data = result.data as {
        deleted: boolean;
        id: string;
        real_target_id: string;
        test_target_id: string;
      };
      expect(data.deleted).toBe(true);
      expect(data.id).toBe('mirror-1');
      expect(data.real_target_id).toBe('target-1');
      expect(data.test_target_id).toBe('target-t-1');
    });

    it('should handle delete service error', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(mockMirror);
      testTargetMirrorRepository.delete.mockRejectedValue(
        new Error('Database error'),
      );

      const payload: DashboardRequestPayload = {
        action: 'delete',
        params: { id: 'mirror-1' },
      };
      const result = await handler.execute('delete', payload, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DELETE_FAILED');
    });
  });

  describe('execute - case insensitivity', () => {
    it('should handle uppercase action names', async () => {
      testTargetMirrorRepository.findAll.mockResolvedValue([]);

      const payload: DashboardRequestPayload = {
        action: 'LIST',
        params: {},
      };
      const result = await handler.execute('LIST', payload, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle mixed case action names', async () => {
      testTargetMirrorRepository.findById.mockResolvedValue(mockMirror);

      const payload: DashboardRequestPayload = {
        action: 'GeT',
        params: { id: 'mirror-1' },
      };
      const result = await handler.execute('GeT', payload, mockContext);

      expect(result.success).toBe(true);
    });
  });
});
