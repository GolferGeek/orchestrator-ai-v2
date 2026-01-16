import { Test, TestingModule } from '@nestjs/testing';
import { SubjectHandler } from '../subject.handler';
import { SubjectRepository } from '../../../repositories/subject.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { RiskSubject } from '../../../interfaces/subject.interface';

describe('SubjectHandler', () => {
  let handler: SubjectHandler;
  let subjectRepo: jest.Mocked<SubjectRepository>;

  const mockExecutionContext: ExecutionContext = {
    orgSlug: 'finance',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    planId: '00000000-0000-0000-0000-000000000000',
    deliverableId: '00000000-0000-0000-0000-000000000000',
    agentSlug: 'investment-risk-agent',
    agentType: 'api',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-1',
    scope_id: 'scope-1',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: { sector: 'Technology' },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockSubjects: RiskSubject[] = [
    mockSubject,
    {
      ...mockSubject,
      id: 'subject-2',
      identifier: 'MSFT',
      name: 'Microsoft Corp.',
    },
    {
      ...mockSubject,
      id: 'subject-3',
      identifier: 'GOOGL',
      name: 'Alphabet Inc.',
    },
    {
      ...mockSubject,
      id: 'subject-4',
      identifier: 'AMZN',
      name: 'Amazon.com Inc.',
    },
    {
      ...mockSubject,
      id: 'subject-5',
      identifier: 'META',
      name: 'Meta Platforms Inc.',
    },
  ];

  const createPayload = (
    action: string,
    params?: Record<string, unknown>,
    pagination?: { page?: number; pageSize?: number },
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
    pagination,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubjectHandler,
        {
          provide: SubjectRepository,
          useValue: {
            findByScope: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<SubjectHandler>(SubjectHandler);
    subjectRepo = module.get(SubjectRepository);

    jest.clearAllMocks();
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
    });
  });

  describe('execute - list', () => {
    it('should list subjects for a scope', async () => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);

      const payload = createPayload('subjects.list', { scopeId: 'scope-1' });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(5);
      expect(subjectRepo.findByScope).toHaveBeenCalledWith('scope-1');
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('subjects.list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should apply pagination', async () => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);

      const payload = createPayload(
        'subjects.list',
        { scopeId: 'scope-1' },
        { page: 1, pageSize: 2 },
      );
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata?.totalCount).toBe(5);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(2);
    });

    it('should handle second page pagination', async () => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);

      const payload = createPayload(
        'subjects.list',
        { scopeId: 'scope-1' },
        { page: 2, pageSize: 2 },
      );
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      // Page 2 with pageSize 2 should get subjects 3-4
    });

    it('should handle last page with fewer items', async () => {
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);

      const payload = createPayload(
        'subjects.list',
        { scopeId: 'scope-1' },
        { page: 3, pageSize: 2 },
      );
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return empty array when scope has no subjects', async () => {
      subjectRepo.findByScope.mockResolvedValue([]);

      const payload = createPayload('subjects.list', {
        scopeId: 'empty-scope',
      });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('execute - get', () => {
    it('should get subject by ID', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);

      const payload = createPayload('subjects.get', { id: 'subject-1' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubject);
      expect(subjectRepo.findById).toHaveBeenCalledWith('subject-1');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('subjects.get');
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when subject not found', async () => {
      subjectRepo.findById.mockResolvedValue(null);

      const payload = createPayload('subjects.get', { id: 'nonexistent' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - create', () => {
    it('should create a new subject', async () => {
      subjectRepo.create.mockResolvedValue(mockSubject);

      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        identifier: 'AAPL',
        name: 'Apple Inc.',
        subject_type: 'stock',
        metadata: { sector: 'Technology' },
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubject);
      expect(subjectRepo.create).toHaveBeenCalledWith({
        scope_id: 'scope-1',
        identifier: 'AAPL',
        name: 'Apple Inc.',
        subject_type: 'stock',
        metadata: { sector: 'Technology' },
      });
    });

    it('should accept scopeId instead of scope_id', async () => {
      subjectRepo.create.mockResolvedValue(mockSubject);

      const payload = createPayload('subjects.create', {
        scopeId: 'scope-1',
        identifier: 'AAPL',
        subjectType: 'stock',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(subjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope_id: 'scope-1',
        }),
      );
    });

    it('should accept subjectType instead of subject_type', async () => {
      subjectRepo.create.mockResolvedValue(mockSubject);

      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        identifier: 'BTC',
        subjectType: 'crypto',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(subjectRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject_type: 'crypto',
        }),
      );
    });

    it('should return error when scope_id is missing', async () => {
      const payload = createPayload('subjects.create', {
        identifier: 'AAPL',
        subject_type: 'stock',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });

    it('should return error when identifier is missing', async () => {
      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        subject_type: 'stock',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_IDENTIFIER');
    });

    it('should return error when subject_type is missing', async () => {
      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        identifier: 'AAPL',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_TYPE');
    });

    it('should create subject with minimal required fields', async () => {
      const minimalSubject = {
        ...mockSubject,
        name: null,
        metadata: {},
      };
      subjectRepo.create.mockResolvedValue(minimalSubject);

      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        identifier: 'AAPL',
        subject_type: 'stock',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
    });

    it('should handle crypto subject type', async () => {
      const cryptoSubject = { ...mockSubject, subject_type: 'crypto' as const };
      subjectRepo.create.mockResolvedValue(cryptoSubject);

      const payload = createPayload('subjects.create', {
        scope_id: 'scope-1',
        identifier: 'BTC',
        name: 'Bitcoin',
        subject_type: 'crypto',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('execute - update', () => {
    it('should update subject', async () => {
      const updatedSubject = { ...mockSubject, name: 'Apple Inc. (Updated)' };
      subjectRepo.update.mockResolvedValue(updatedSubject);

      const payload = createPayload('subjects.update', {
        id: 'subject-1',
        name: 'Apple Inc. (Updated)',
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedSubject);
      expect(subjectRepo.update).toHaveBeenCalledWith('subject-1', {
        name: 'Apple Inc. (Updated)',
      });
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('subjects.update', {
        name: 'Updated Name',
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should update multiple fields', async () => {
      const updatedSubject = {
        ...mockSubject,
        name: 'New Name',
        metadata: { sector: 'Tech', updated: true },
      };
      subjectRepo.update.mockResolvedValue(updatedSubject);

      const payload = createPayload('subjects.update', {
        id: 'subject-1',
        name: 'New Name',
        metadata: { sector: 'Tech', updated: true },
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(subjectRepo.update).toHaveBeenCalledWith('subject-1', {
        name: 'New Name',
        metadata: { sector: 'Tech', updated: true },
      });
    });

    it('should toggle is_active status', async () => {
      const deactivatedSubject = { ...mockSubject, is_active: false };
      subjectRepo.update.mockResolvedValue(deactivatedSubject);

      const payload = createPayload('subjects.update', {
        id: 'subject-1',
        is_active: false,
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(subjectRepo.update).toHaveBeenCalledWith('subject-1', {
        is_active: false,
      });
    });
  });

  describe('execute - delete', () => {
    it('should delete subject', async () => {
      subjectRepo.delete.mockResolvedValue(undefined);

      const payload = createPayload('subjects.delete', { id: 'subject-1' });
      const result = await handler.execute(
        'delete',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ deleted: true, id: 'subject-1' });
      expect(subjectRepo.delete).toHaveBeenCalledWith('subject-1');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('subjects.delete');
      const result = await handler.execute(
        'delete',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('subjects.unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });

    it('should handle case-insensitive action names', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);

      const payload = createPayload('subjects.GET', { id: 'subject-1' });
      const result = await handler.execute(
        'GET',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
    });
  });
});
