import { Test, TestingModule } from '@nestjs/testing';
import { DebateHandler } from '../debate.handler';
import { DebateService } from '../../../services/debate.service';
import { DebateRepository } from '../../../repositories/debate.repository';
import { CompositeScoreRepository } from '../../../repositories/composite-score.repository';
import { SubjectRepository } from '../../../repositories/subject.repository';
import { AssessmentRepository } from '../../../repositories/assessment.repository';
import { ScopeRepository } from '../../../repositories/scope.repository';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { DashboardRequestPayload } from '@orchestrator-ai/transport-types';
import {
  RiskDebate,
  BlueAssessment,
  RedChallenges,
  ArbiterSynthesis,
} from '../../../interfaces/debate.interface';
import { RiskSubject } from '../../../interfaces/subject.interface';
import { RiskCompositeScore } from '../../../interfaces/composite-score.interface';
import { RiskScope } from '../../../interfaces/scope.interface';

describe('DebateHandler', () => {
  let handler: DebateHandler;
  let debateService: jest.Mocked<DebateService>;
  let debateRepo: jest.Mocked<DebateRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let assessmentRepo: jest.Mocked<AssessmentRepository>;
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

  const mockDebate: RiskDebate = {
    id: 'debate-123',
    subject_id: 'subject-123',
    composite_score_id: 'score-123',
    task_id: 'task-123',
    blue_assessment: {
      summary: 'Test summary',
      key_findings: [],
      evidence_cited: [],
      confidence_explanation: 'Test',
    } as BlueAssessment,
    red_challenges: {
      challenges: [],
      blind_spots: [],
      alternative_scenarios: [],
      overstated_risks: [],
      understated_risks: [],
    } as RedChallenges,
    arbiter_synthesis: {
      final_assessment: 'Test',
      accepted_challenges: [],
      rejected_challenges: [],
      adjustment_reasoning: 'Test',
      confidence_level: 0.8,
      key_takeaways: [],
      recommended_adjustment: 5,
    } as ArbiterSynthesis,
    original_score: 65,
    final_score: 70,
    score_adjustment: 5,
    transcript: [],
    status: 'completed',
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    completed_at: '2026-01-15T01:00:00Z',
  };

  const mockSubject: RiskSubject = {
    id: 'subject-123',
    scope_id: 'scope-123',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    subject_type: 'stock',
    metadata: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockCompositeScore: RiskCompositeScore = {
    id: 'score-123',
    subject_id: 'subject-123',
    task_id: 'task-123',
    overall_score: 65,
    dimension_scores: { market: 70, fundamental: 60 },
    debate_id: null,
    debate_adjustment: 0,
    pre_debate_score: null,
    confidence: 0.8,
    status: 'active',
    valid_until: '2026-01-16T00:00:00Z',
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
  };

  const mockScope: RiskScope = {
    id: 'scope-123',
    organization_slug: 'finance',
    agent_slug: 'investment-risk-agent',
    name: 'Test Scope',
    description: null,
    domain: 'investment',
    llm_config: {},
    thresholds: {},
    analysis_config: {
      riskRadar: { enabled: true },
      redTeam: { enabled: true },
    },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  // Helper to create payloads with required action field
  const createPayload = (
    action: string,
    params?: Record<string, string | number | boolean | null>,
    pagination?: { page?: number; pageSize?: number },
  ): DashboardRequestPayload => ({
    action,
    params: params as DashboardRequestPayload['params'],
    pagination,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateHandler,
        {
          provide: DebateService,
          useValue: {
            runDebate: jest.fn(),
            getDebatesBySubject: jest.fn(),
            getLatestDebate: jest.fn(),
            getDebateById: jest.fn(),
          },
        },
        {
          provide: DebateRepository,
          useValue: {
            findBySubject: jest.fn(),
            findById: jest.fn(),
            findLatestBySubject: jest.fn(),
            findContextsByScope: jest.fn(),
            findActiveContextByRole: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            findActiveBySubject: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AssessmentRepository,
          useValue: {
            findByTask: jest.fn(),
          },
        },
        {
          provide: ScopeRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<DebateHandler>(DebateHandler);
    debateService = module.get(DebateService);
    debateRepo = module.get(DebateRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    subjectRepo = module.get(SubjectRepository);
    assessmentRepo = module.get(AssessmentRepository);
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
      expect(actions).toContain('view');
      expect(actions).toContain('trigger');
      expect(actions).toContain('getBySubject');
      expect(actions).toContain('getLatest');
      expect(actions).toContain('contexts.list');
      expect(actions).toContain('contexts.get');
    });
  });

  describe('execute - list', () => {
    it('should return debates for a subject', async () => {
      const debates = [mockDebate, { ...mockDebate, id: 'debate-456' }];
      debateRepo.findBySubject.mockResolvedValue(debates);

      const payload = createPayload('debates.list', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(debateRepo.findBySubject).toHaveBeenCalledWith('subject-123');
    });

    it('should return error when subjectId is missing', async () => {
      const payload = createPayload('debates.list');
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_FILTER');
    });

    it('should apply pagination', async () => {
      const debates = Array(25)
        .fill(null)
        .map((_, i) => ({ ...mockDebate, id: `debate-${i}` }));
      debateRepo.findBySubject.mockResolvedValue(debates);

      const payload = createPayload(
        'debates.list',
        { subjectId: 'subject-123' },
        { page: 2, pageSize: 10 },
      );
      const result = await handler.execute(
        'list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.metadata?.page).toBe(2);
      expect(result.metadata?.totalCount).toBe(25);
    });
  });

  describe('execute - get', () => {
    it('should return a debate by ID', async () => {
      debateRepo.findById.mockResolvedValue(mockDebate);

      const payload = createPayload('debates.get', { id: 'debate-123' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDebate);
      expect(debateRepo.findById).toHaveBeenCalledWith('debate-123');
    });

    it('should return error when debate not found', async () => {
      debateRepo.findById.mockResolvedValue(null);

      const payload = createPayload('debates.get', { id: 'nonexistent' });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should fall back to getLatest when only subjectId provided', async () => {
      debateRepo.findLatestBySubject.mockResolvedValue(mockDebate);

      const payload = createPayload('debates.get', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(debateRepo.findLatestBySubject).toHaveBeenCalledWith(
        'subject-123',
      );
    });
  });

  describe('execute - trigger', () => {
    it('should trigger a new debate successfully', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );
      assessmentRepo.findByTask.mockResolvedValue([]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      debateService.runDebate.mockResolvedValue({
        debate: mockDebate,
        adjustedScore: 70,
        adjustment: 5,
      });

      const payload = createPayload('debates.trigger', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'trigger',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('debateId', 'debate-123');
      expect(result.data).toHaveProperty('originalScore', 65);
      expect(result.data).toHaveProperty('adjustedScore', 70);
      expect(result.data).toHaveProperty('adjustment', 5);
      expect(debateService.runDebate).toHaveBeenCalled();
    });

    it('should return error when subject not found', async () => {
      subjectRepo.findById.mockResolvedValue(null);

      const payload = createPayload('debates.trigger', {
        subjectId: 'nonexistent',
      });
      const result = await handler.execute(
        'trigger',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should return error when no composite score exists', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(null);

      const payload = createPayload('debates.trigger', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'trigger',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_SCORE');
    });

    it('should handle debate service errors gracefully', async () => {
      subjectRepo.findById.mockResolvedValue(mockSubject);
      compositeScoreRepo.findActiveBySubject.mockResolvedValue(
        mockCompositeScore,
      );
      assessmentRepo.findByTask.mockResolvedValue([]);
      scopeRepo.findById.mockResolvedValue(mockScope);
      debateService.runDebate.mockRejectedValue(new Error('LLM unavailable'));

      const payload = createPayload('debates.trigger', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'trigger',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEBATE_FAILED');
      expect(result.error?.message).toBe('LLM unavailable');
    });
  });

  describe('execute - getLatest', () => {
    it('should return the latest debate for a subject', async () => {
      debateRepo.findLatestBySubject.mockResolvedValue(mockDebate);

      const payload = createPayload('debates.getLatest', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'getLatest',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockDebate);
    });

    it('should return null with message when no debates exist', async () => {
      debateRepo.findLatestBySubject.mockResolvedValue(null);

      const payload = createPayload('debates.getLatest', {
        subjectId: 'subject-123',
      });
      const result = await handler.execute(
        'getLatest',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.metadata?.message).toContain('No completed debates');
    });
  });

  describe('execute - contexts.list', () => {
    it('should return debate contexts for a scope', async () => {
      const contexts = [
        { id: 'ctx-1', role: 'blue', scope_id: 'scope-123' },
        { id: 'ctx-2', role: 'red', scope_id: 'scope-123' },
        { id: 'ctx-3', role: 'arbiter', scope_id: 'scope-123' },
      ];
      debateRepo.findContextsByScope.mockResolvedValue(contexts as never);

      const payload = createPayload('debates.contexts.list', {
        scopeId: 'scope-123',
      });
      const result = await handler.execute(
        'contexts.list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.metadata?.totalCount).toBe(3);
    });

    it('should return error when scopeId is missing', async () => {
      const payload = createPayload('debates.contexts.list');
      const result = await handler.execute(
        'contexts.list',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_SCOPE_ID');
    });
  });

  describe('execute - contexts.get', () => {
    it('should return a specific debate context by role', async () => {
      const context = { id: 'ctx-1', role: 'blue', scope_id: 'scope-123' };
      debateRepo.findActiveContextByRole.mockResolvedValue(context as never);

      const payload = createPayload('debates.contexts.get', {
        scopeId: 'scope-123',
        role: 'blue',
      });
      const result = await handler.execute(
        'contexts.get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(context);
    });

    it('should return error for invalid role', async () => {
      const payload = createPayload('debates.contexts.get', {
        scopeId: 'scope-123',
        role: 'invalid',
      });
      const result = await handler.execute(
        'contexts.get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ROLE');
    });

    it('should return error when context not found', async () => {
      debateRepo.findActiveContextByRole.mockResolvedValue(null);

      const payload = createPayload('debates.contexts.get', {
        scopeId: 'scope-123',
        role: 'blue',
      });
      const result = await handler.execute(
        'contexts.get',
        payload,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('execute - unsupported action', () => {
    it('should return error for unsupported action', async () => {
      const payload = createPayload('debates.unsupported');
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
