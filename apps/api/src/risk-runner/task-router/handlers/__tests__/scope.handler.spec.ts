import { Test, TestingModule } from '@nestjs/testing';
import { ScopeHandler } from '../scope.handler';
import { ScopeRepository } from '../../../repositories/scope.repository';
import { RiskAnalysisService } from '../../../services/risk-analysis.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import { RiskScope } from '../../../interfaces/scope.interface';

describe('ScopeHandler', () => {
  let handler: ScopeHandler;
  let scopeRepo: jest.Mocked<ScopeRepository>;

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

  const mockScope: RiskScope = {
    id: 'scope-1',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'US Tech Stocks',
    description: 'Technology sector risk analysis',
    domain: 'investment',
    llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } },
    thresholds: { critical_threshold: 70 },
    analysis_config: { riskRadar: { enabled: true } },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockScopes: RiskScope[] = [
    mockScope,
    {
      ...mockScope,
      id: 'scope-2',
      name: 'Crypto Portfolio',
      domain: 'investment',
    },
    {
      ...mockScope,
      id: 'scope-3',
      name: 'European Markets',
      domain: 'investment',
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
        ScopeHandler,
        {
          provide: ScopeRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: RiskAnalysisService,
          useValue: {
            analyzeSubject: jest.fn(),
            reanalyzeScope: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<ScopeHandler>(ScopeHandler);
    scopeRepo = module.get(ScopeRepository);

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
    it('should list scopes for organization', async () => {
      scopeRepo.findAll.mockResolvedValue(mockScopes);

      const payload = createPayload('scopes.list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(scopeRepo.findAll).toHaveBeenCalledWith('finance');
    });

    it('should apply pagination', async () => {
      scopeRepo.findAll.mockResolvedValue(mockScopes);

      const payload = createPayload('scopes.list', undefined, {
        page: 1,
        pageSize: 2,
      });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata?.totalCount).toBe(3);
      expect(result.metadata?.page).toBe(1);
      expect(result.metadata?.pageSize).toBe(2);
    });

    it('should handle second page pagination', async () => {
      scopeRepo.findAll.mockResolvedValue(mockScopes);

      const payload = createPayload('scopes.list', undefined, {
        page: 2,
        pageSize: 2,
      });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return error when orgSlug is missing', async () => {
      const contextWithoutOrg = { ...mockExecutionContext, orgSlug: '' };

      const payload = createPayload('scopes.list');
      const result = await handler.execute('list', payload, contextWithoutOrg);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ORG');
    });

    it('should return empty array when no scopes exist', async () => {
      scopeRepo.findAll.mockResolvedValue([]);

      const payload = createPayload('scopes.list');
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
    it('should get scope by ID', async () => {
      scopeRepo.findById.mockResolvedValue(mockScope);

      const payload = createPayload('scopes.get', { id: 'scope-1' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockScope);
      expect(scopeRepo.findById).toHaveBeenCalledWith('scope-1');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('scopes.get');
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ID');
    });

    it('should return error when scope not found', async () => {
      scopeRepo.findById.mockResolvedValue(null);

      const payload = createPayload('scopes.get', { id: 'nonexistent' });
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
    it('should create a new scope', async () => {
      scopeRepo.create.mockResolvedValue(mockScope);

      const payload = createPayload('scopes.create', {
        name: 'US Tech Stocks',
        domain: 'investment',
        description: 'Technology sector risk analysis',
        llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } },
        thresholds: { critical_threshold: 70 },
        analysis_config: { riskRadar: { enabled: true } },
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockScope);
      expect(scopeRepo.create).toHaveBeenCalledWith({
        organization_slug: 'finance',
        agent_slug: 'investment-risk-agent',
        name: 'US Tech Stocks',
        domain: 'investment',
        description: 'Technology sector risk analysis',
        llm_config: { gold: { provider: 'anthropic', model: 'claude-3' } },
        thresholds: { critical_threshold: 70 },
        analysis_config: { riskRadar: { enabled: true } },
      });
    });

    it('should return error when name is missing', async () => {
      const payload = createPayload('scopes.create', {
        domain: 'investment',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_NAME');
    });

    it('should return error when domain is missing', async () => {
      const payload = createPayload('scopes.create', {
        name: 'US Tech Stocks',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_DOMAIN');
    });

    it('should create scope with minimal required fields', async () => {
      scopeRepo.create.mockResolvedValue({
        ...mockScope,
        description: null,
        llm_config: {},
        thresholds: {},
        analysis_config: {},
      });

      const payload = createPayload('scopes.create', {
        name: 'Minimal Scope',
        domain: 'investment',
      });
      const result = await handler.execute(
        'create',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(scopeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Minimal Scope',
          domain: 'investment',
        }),
      );
    });
  });

  describe('execute - update', () => {
    it('should update scope', async () => {
      const updatedScope = { ...mockScope, name: 'Updated Name' };
      scopeRepo.update.mockResolvedValue(updatedScope);

      const payload = createPayload('scopes.update', {
        id: 'scope-1',
        name: 'Updated Name',
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedScope);
      expect(scopeRepo.update).toHaveBeenCalledWith('scope-1', {
        name: 'Updated Name',
      });
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('scopes.update', {
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
      const updatedScope = {
        ...mockScope,
        name: 'New Name',
        description: 'New Description',
      };
      scopeRepo.update.mockResolvedValue(updatedScope);

      const payload = createPayload('scopes.update', {
        id: 'scope-1',
        name: 'New Name',
        description: 'New Description',
        thresholds: { critical_threshold: 80 },
      });
      const result = await handler.execute(
        'update',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(scopeRepo.update).toHaveBeenCalledWith('scope-1', {
        name: 'New Name',
        description: 'New Description',
        thresholds: { critical_threshold: 80 },
      });
    });
  });

  describe('execute - delete', () => {
    it('should delete scope', async () => {
      scopeRepo.delete.mockResolvedValue(undefined);

      const payload = createPayload('scopes.delete', { id: 'scope-1' });
      const result = await handler.execute(
        'delete',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ deleted: true, id: 'scope-1' });
      expect(scopeRepo.delete).toHaveBeenCalledWith('scope-1');
    });

    it('should return error when ID is missing', async () => {
      const payload = createPayload('scopes.delete');
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
      const payload = createPayload('scopes.unsupported');
      const result = await handler.execute(
        'unsupported',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
      expect(result.error?.details?.supportedActions).toBeDefined();
    });
  });
});
