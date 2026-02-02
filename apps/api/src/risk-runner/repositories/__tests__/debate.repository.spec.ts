import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DebateRepository, DebateFilter } from '../debate.repository';
import { SupabaseService } from '@/supabase/supabase.service';
import { RiskDebate, RiskDebateContext, BlueAssessment, RedChallenges, ArbiterSynthesis } from '../../interfaces/debate.interface';

describe('DebateRepository', () => {
  let repository: DebateRepository;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockBlueAssessment: BlueAssessment = {
    summary: 'Market risk is moderate due to current economic conditions',
    key_findings: ['Earnings stable', 'Market volatility increasing'],
    evidence_cited: ['Q3 earnings report', 'Market analysis'],
    confidence_explanation: 'Strong historical data supports this assessment',
  };

  const mockRedChallenges: RedChallenges = {
    challenges: [
      {
        dimension: 'market',
        challenge: 'Underestimated impact of interest rate changes',
        evidence: ['Fed minutes', 'Bond yields'],
        suggested_adjustment: 10,
      },
    ],
    blind_spots: ['Supply chain disruptions'],
    alternative_scenarios: [
      {
        name: 'Recession scenario',
        description: 'Economic downturn leads to demand collapse',
        probability: 0.2,
        impact_on_score: 25,
      },
    ],
    overstated_risks: ['Competition risk'],
    understated_risks: ['Regulatory risk'],
  };

  const mockArbiterSynthesis: ArbiterSynthesis = {
    final_assessment: 'After debate, risk is moderately higher than initially assessed',
    accepted_challenges: ['Interest rate impact'],
    rejected_challenges: ['Competition risk overstatement'],
    adjustment_reasoning: 'Valid points raised about interest rate sensitivity',
    confidence_level: 0.8,
    key_takeaways: ['Monitor Fed policy closely', 'Reassess in 30 days'],
    recommended_adjustment: 8,
  };

  const mockDebate: RiskDebate = {
    id: 'debate-123',
    subject_id: 'subject-123',
    composite_score_id: 'score-123',
    task_id: 'task-123',
    blue_assessment: mockBlueAssessment,
    red_challenges: mockRedChallenges,
    arbiter_synthesis: mockArbiterSynthesis,
    original_score: 65,
    final_score: 73,
    score_adjustment: 8,
    transcript: [
      { role: 'blue', timestamp: '2024-01-01T10:00:00Z', content: 'Initial assessment' },
      { role: 'red', timestamp: '2024-01-01T10:05:00Z', content: 'Challenges raised' },
      { role: 'arbiter', timestamp: '2024-01-01T10:10:00Z', content: 'Final synthesis' },
    ],
    status: 'completed',
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T10:00:00Z',
    completed_at: '2024-01-01T10:10:00Z',
  };

  const mockDebateContext: RiskDebateContext = {
    id: 'context-123',
    scope_id: 'scope-123',
    role: 'blue',
    version: 1,
    system_prompt: 'You are the Blue Agent defending the risk assessment...',
    output_schema: { type: 'object', properties: {} },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const createMockClient = (overrides?: {
    single?: { data: unknown | null; error: { message: string; code?: string } | null };
    list?: { data: unknown[] | null; error: { message: string } | null };
    insert?: { data: unknown | null; error: { message: string } | null };
    update?: { data: unknown | null; error: { message: string } | null };
    delete?: { error: { message: string } | null };
  }) => {
    const singleResult = overrides?.single ?? { data: mockDebate, error: null };
    const listResult = overrides?.list ?? { data: [mockDebate], error: null };
    const insertResult = overrides?.insert ?? { data: mockDebate, error: null };
    const updateResult = overrides?.update ?? { data: mockDebate, error: null };
    const deleteResult = overrides?.delete ?? { error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(listResult),
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.limit as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(singleResult),
      });
      (chainableResult.insert as jest.Mock).mockReturnValue({
        ...chainableResult,
        select: jest.fn().mockReturnValue({
          ...chainableResult,
          single: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(insertResult),
          }),
        }),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          ...chainableResult,
          select: jest.fn().mockReturnValue({
            ...chainableResult,
            single: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(updateResult),
            }),
          }),
        }),
      });

      const deleteChain: Record<string, unknown> = {
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(deleteResult),
      };
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      (chainableResult.delete as jest.Mock).mockReturnValue(deleteChain);

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => createChain()),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    repository = module.get<DebateRepository>(DebateRepository);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── DEBATES ────────────────────────────────────────────────────────

  describe('findBySubject', () => {
    it('should return debates for subject', async () => {
      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([mockDebate]);
    });

    it('should return empty array when no debates found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findBySubject('subject-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch debates: Query failed',
      );
    });

    it('should apply filter', async () => {
      const filter: DebateFilter = { includeTest: true };
      const result = await repository.findBySubject('subject-123', filter);

      expect(result).toEqual([mockDebate]);
    });
  });

  describe('findLatestBySubject', () => {
    it('should return latest completed debate', async () => {
      const result = await repository.findLatestBySubject('subject-123');

      expect(result).toEqual(mockDebate);
    });

    it('should return null when no completed debate found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findLatestBySubject('subject-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findLatestBySubject('subject-123')).rejects.toThrow(
        'Failed to fetch latest debate: Database error',
      );
    });

    it('should apply filter', async () => {
      const filter: DebateFilter = { testScenarioId: 'scenario-123' };
      const result = await repository.findLatestBySubject('subject-123', filter);

      expect(result).toEqual(mockDebate);
    });
  });

  describe('findById', () => {
    it('should return debate when found', async () => {
      const result = await repository.findById('debate-123');

      expect(result).toEqual(mockDebate);
    });

    it('should return null when debate not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findById('debate-123')).rejects.toThrow(
        'Failed to fetch debate: Database error',
      );
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return debate when found', async () => {
      const result = await repository.findByIdOrThrow('debate-123');

      expect(result).toEqual(mockDebate);
    });

    it('should throw NotFoundException when debate not found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create debate successfully', async () => {
      const createData = {
        subject_id: 'subject-123',
        status: 'pending' as const,
      };

      const result = await repository.create(createData);

      expect(result).toEqual(mockDebate);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({ subject_id: 'subject-123' }),
      ).rejects.toThrow('Create succeeded but no debate returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.create({ subject_id: 'subject-123' }),
      ).rejects.toThrow('Failed to create debate: Insert failed');
    });
  });

  describe('update', () => {
    it('should update debate successfully', async () => {
      const updatedDebate = { ...mockDebate, status: 'completed' as const };
      const mockClient = createMockClient({
        update: { data: updatedDebate, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.update('debate-123', { status: 'completed' });

      expect(result).toEqual(updatedDebate);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('debate-123', { status: 'completed' })).rejects.toThrow(
        'Update succeeded but no debate returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.update('debate-123', { status: 'completed' })).rejects.toThrow(
        'Failed to update debate: Update failed',
      );
    });
  });

  describe('delete', () => {
    it('should delete debate successfully', async () => {
      await expect(repository.delete('debate-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.delete('debate-123')).rejects.toThrow(
        'Failed to delete debate: Delete failed',
      );
    });
  });

  // ─── DEBATE CONTEXTS ────────────────────────────────────────────────────────

  describe('findContextsByScope', () => {
    it('should return contexts for scope', async () => {
      const mockClient = createMockClient({
        list: { data: [mockDebateContext], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findContextsByScope('scope-123');

      expect(result).toEqual([mockDebateContext]);
    });

    it('should return empty array when no contexts found', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findContextsByScope('scope-123');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        list: { data: null, error: { message: 'Query failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findContextsByScope('scope-123')).rejects.toThrow(
        'Failed to fetch debate contexts: Query failed',
      );
    });
  });

  describe('findActiveContextByRole', () => {
    it('should return active context for role', async () => {
      const mockClient = createMockClient({
        single: { data: mockDebateContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveContextByRole('scope-123', 'blue');

      expect(result).toEqual(mockDebateContext);
    });

    it('should return null when no active context found', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findActiveContextByRole('scope-123', 'red');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const mockClient = createMockClient({
        single: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.findActiveContextByRole('scope-123', 'blue')).rejects.toThrow(
        'Failed to fetch active debate context: Database error',
      );
    });

    it('should apply filter', async () => {
      const mockClient = createMockClient({
        single: { data: mockDebateContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const filter: DebateFilter = { includeTest: true };
      const result = await repository.findActiveContextByRole('scope-123', 'arbiter', filter);

      expect(result).toEqual(mockDebateContext);
    });
  });

  describe('createContext', () => {
    it('should create context successfully', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: mockDebateContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const createData = {
        scope_id: 'scope-123',
        role: 'blue' as const,
        system_prompt: 'You are the Blue Agent...',
      };

      const result = await repository.createContext(createData);

      expect(result).toEqual(mockDebateContext);
    });

    it('should auto-increment version when not specified', async () => {
      const existingContexts = [
        { ...mockDebateContext, version: 1 },
        { ...mockDebateContext, id: 'context-456', version: 2 },
      ];
      const mockClient = createMockClient({
        list: { data: existingContexts, error: null },
        insert: { data: { ...mockDebateContext, version: 3 }, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.createContext({
        scope_id: 'scope-123',
        role: 'blue',
        system_prompt: 'New prompt',
      });

      expect(result.version).toBe(3);
    });

    it('should throw error when create returns no data', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createContext({
          scope_id: 'scope-123',
          role: 'blue',
          system_prompt: 'Test',
        }),
      ).rejects.toThrow('Create succeeded but no debate context returned');
    });

    it('should throw error on create failure', async () => {
      const mockClient = createMockClient({
        list: { data: [], error: null },
        insert: { data: null, error: { message: 'Insert failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        repository.createContext({
          scope_id: 'scope-123',
          role: 'blue',
          system_prompt: 'Test',
        }),
      ).rejects.toThrow('Failed to create debate context: Insert failed');
    });
  });

  describe('updateContext', () => {
    it('should update context successfully', async () => {
      const updatedContext = { ...mockDebateContext, is_active: false };
      const mockClient = createMockClient({
        update: { data: updatedContext, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.updateContext('context-123', { is_active: false });

      expect(result).toEqual(updatedContext);
    });

    it('should throw error when update returns no data', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.updateContext('context-123', { is_active: false })).rejects.toThrow(
        'Update succeeded but no debate context returned',
      );
    });

    it('should throw error on update failure', async () => {
      const mockClient = createMockClient({
        update: { data: null, error: { message: 'Update failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.updateContext('context-123', { is_active: false })).rejects.toThrow(
        'Failed to update debate context: Update failed',
      );
    });
  });

  describe('deleteContext', () => {
    it('should delete context successfully', async () => {
      await expect(repository.deleteContext('context-123')).resolves.toBeUndefined();
    });

    it('should throw error on delete failure', async () => {
      const mockClient = createMockClient({
        delete: { error: { message: 'Delete failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(repository.deleteContext('context-123')).rejects.toThrow(
        'Failed to delete debate context: Delete failed',
      );
    });
  });

  // ─── TYPE TESTS ────────────────────────────────────────────────────────

  describe('debate statuses', () => {
    const statuses = ['pending', 'in_progress', 'completed', 'failed'] as const;

    statuses.forEach((status) => {
      it(`should handle ${status} status`, async () => {
        const debateWithStatus = { ...mockDebate, status };
        const mockClient = createMockClient({
          single: { data: debateWithStatus, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findById('debate-123');

        expect(result?.status).toBe(status);
      });
    });
  });

  describe('context roles', () => {
    const roles = ['blue', 'red', 'arbiter'] as const;

    roles.forEach((role) => {
      it(`should handle ${role} role`, async () => {
        const contextWithRole = { ...mockDebateContext, role };
        const mockClient = createMockClient({
          single: { data: contextWithRole, error: null },
        });
        (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

        const result = await repository.findActiveContextByRole('scope-123', role);

        expect(result?.role).toBe(role);
      });
    });
  });

  describe('transcript handling', () => {
    it('should handle debate with full transcript', async () => {
      const result = await repository.findById('debate-123');

      expect(result?.transcript.length).toBe(3);
      expect(result?.transcript?.[0]?.role).toBe('blue');
      expect(result?.transcript?.[1]?.role).toBe('red');
      expect(result?.transcript?.[2]?.role).toBe('arbiter');
    });

    it('should handle debate with empty transcript', async () => {
      const debateWithEmptyTranscript = { ...mockDebate, transcript: [] };
      const mockClient = createMockClient({
        single: { data: debateWithEmptyTranscript, error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      const result = await repository.findById('debate-123');

      expect(result?.transcript).toEqual([]);
    });
  });
});
