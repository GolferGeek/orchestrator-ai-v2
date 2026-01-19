import { Test, TestingModule } from '@nestjs/testing';
import { DebateService, DebateInput } from '../debate.service';
import { LLMService } from '@/llms/llm.service';
import { DebateRepository } from '../../repositories/debate.repository';
import { CompositeScoreRepository } from '../../repositories/composite-score.repository';
import { ScoreAggregationService } from '../score-aggregation.service';
import { RiskSubject } from '../../interfaces/subject.interface';
import { RiskCompositeScore } from '../../interfaces/composite-score.interface';
import { RiskAssessment } from '../../interfaces/assessment.interface';
import {
  RiskDebate,
  RiskDebateContext,
  BlueAssessment,
  RedChallenges,
  ArbiterSynthesis,
} from '../../interfaces/debate.interface';
import { ExecutionContext } from '@orchestrator-ai/transport-types';

describe('DebateService', () => {
  let service: DebateService;
  let llmService: jest.Mocked<LLMService>;
  let debateRepo: jest.Mocked<DebateRepository>;
  let compositeScoreRepo: jest.Mocked<CompositeScoreRepository>;
  let scoreAggregation: jest.Mocked<ScoreAggregationService>;

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

  const mockAssessments: RiskAssessment[] = [
    {
      id: 'assessment-1',
      subject_id: 'subject-123',
      dimension_id: 'dim-market',
      dimension_context_id: 'ctx-1',
      task_id: 'task-123',
      score: 70,
      confidence: 0.85,
      reasoning: 'Market volatility elevated',
      evidence: ['VIX at 25', 'Options flow bearish'],
      signals: [],
      analyst_response: {},
      llm_provider: 'anthropic',
      llm_model: 'claude-sonnet-4-20250514',
      is_test: false,
      test_scenario_id: null,
      created_at: '2026-01-15T00:00:00Z',
    },
    {
      id: 'assessment-2',
      subject_id: 'subject-123',
      dimension_id: 'dim-fundamental',
      dimension_context_id: 'ctx-2',
      task_id: 'task-123',
      score: 60,
      confidence: 0.75,
      reasoning: 'Solid fundamentals',
      evidence: ['PE ratio reasonable', 'Strong cash flow'],
      signals: [],
      analyst_response: {},
      llm_provider: 'anthropic',
      llm_model: 'claude-sonnet-4-20250514',
      is_test: false,
      test_scenario_id: null,
      created_at: '2026-01-15T00:00:00Z',
    },
  ];

  const mockBlueContext: RiskDebateContext = {
    id: 'ctx-blue',
    scope_id: 'scope-123',
    role: 'blue',
    version: 1,
    system_prompt: 'You are the Blue Team agent defending the risk assessment.',
    output_schema: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockRedContext: RiskDebateContext = {
    id: 'ctx-red',
    scope_id: 'scope-123',
    role: 'red',
    version: 1,
    system_prompt:
      'You are the Red Team agent challenging the risk assessment.',
    output_schema: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockArbiterContext: RiskDebateContext = {
    id: 'ctx-arbiter',
    scope_id: 'scope-123',
    role: 'arbiter',
    version: 1,
    system_prompt: 'You are the Arbiter agent providing final synthesis.',
    output_schema: {},
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const mockBlueAssessment: BlueAssessment = {
    summary:
      'The risk assessment is well-founded based on current market conditions.',
    key_findings: [
      'Market volatility is elevated',
      'Fundamentals remain solid',
    ],
    evidence_cited: ['VIX at 25', 'PE ratio reasonable'],
    confidence_explanation:
      'High confidence due to multiple confirming signals.',
  };

  const mockRedChallenges: RedChallenges = {
    challenges: [
      {
        dimension: 'market',
        challenge: 'VIX may be overstated as a risk signal',
        evidence: ['VIX historically mean-reverts'],
        suggested_adjustment: -5,
      },
    ],
    blind_spots: ['Earnings announcement in 2 weeks'],
    alternative_scenarios: [
      {
        name: 'Earnings surprise',
        description: 'Positive earnings could reduce risk significantly',
        probability: 0.3,
        impact_on_score: -15,
      },
    ],
    overstated_risks: ['Market volatility'],
    understated_risks: ['Event risk from earnings'],
  };

  const mockArbiterSynthesis: ArbiterSynthesis = {
    final_assessment: 'The risk score should be adjusted moderately higher.',
    accepted_challenges: ['Event risk from earnings is understated'],
    rejected_challenges: ['VIX overstatement claim'],
    adjustment_reasoning: 'Earnings event risk warrants +5 adjustment.',
    confidence_level: 0.75,
    key_takeaways: [
      'Monitor earnings date closely',
      'VIX remains valid signal',
    ],
    recommended_adjustment: 5,
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
    final_score: 70,
    score_adjustment: 5,
    transcript: [],
    status: 'completed',
    is_test: false,
    test_scenario_id: null,
    created_at: '2026-01-15T00:00:00Z',
    completed_at: '2026-01-15T01:00:00Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateService,
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
        {
          provide: DebateRepository,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            findById: jest.fn(),
            findBySubject: jest.fn(),
            findLatestBySubject: jest.fn(),
            findActiveContextByRole: jest.fn(),
          },
        },
        {
          provide: CompositeScoreRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: ScoreAggregationService,
          useValue: {
            applyDebateAdjustment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DebateService>(DebateService);
    llmService = module.get(LLMService);
    debateRepo = module.get(DebateRepository);
    compositeScoreRepo = module.get(CompositeScoreRepository);
    scoreAggregation = module.get(ScoreAggregationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runDebate', () => {
    const debateInput: DebateInput = {
      subject: mockSubject,
      compositeScore: mockCompositeScore,
      assessments: mockAssessments,
      scopeId: 'scope-123',
      context: mockExecutionContext,
    };

    it('should successfully run a complete debate cycle', async () => {
      // Setup mocks
      debateRepo.create.mockResolvedValue({
        ...mockDebate,
        status: 'pending',
        blue_assessment: {} as BlueAssessment,
        red_challenges: {} as RedChallenges,
        arbiter_synthesis: {} as ArbiterSynthesis,
      });
      debateRepo.update.mockResolvedValue(mockDebate);
      debateRepo.findActiveContextByRole.mockImplementation(
        async (scopeId, role) => {
          switch (role) {
            case 'blue':
              return mockBlueContext;
            case 'red':
              return mockRedContext;
            case 'arbiter':
              return mockArbiterContext;
            default:
              return null;
          }
        },
      );

      llmService.generateResponse
        .mockResolvedValueOnce(JSON.stringify(mockBlueAssessment))
        .mockResolvedValueOnce(JSON.stringify(mockRedChallenges))
        .mockResolvedValueOnce(JSON.stringify(mockArbiterSynthesis));

      scoreAggregation.applyDebateAdjustment.mockReturnValue(70);
      compositeScoreRepo.update.mockResolvedValue(mockCompositeScore);

      const result = await service.runDebate(debateInput);

      expect(result.debate).toBeDefined();
      expect(result.adjustedScore).toBe(70);
      expect(result.adjustment).toBe(5);
      expect(debateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subject_id: 'subject-123',
          composite_score_id: 'score-123',
          status: 'pending',
        }),
      );
      expect(llmService.generateResponse).toHaveBeenCalledTimes(3);
      expect(compositeScoreRepo.update).toHaveBeenCalled();
    });

    it('should throw error if debate contexts are missing', async () => {
      debateRepo.create.mockResolvedValue({
        ...mockDebate,
        status: 'pending',
      });
      debateRepo.update.mockResolvedValue(mockDebate);
      debateRepo.findActiveContextByRole.mockResolvedValue(null);

      await expect(service.runDebate(debateInput)).rejects.toThrow(
        'Missing debate contexts',
      );

      expect(debateRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should mark debate as failed on LLM error', async () => {
      debateRepo.create.mockResolvedValue({
        ...mockDebate,
        status: 'pending',
      });
      debateRepo.update.mockResolvedValue(mockDebate);
      debateRepo.findActiveContextByRole.mockImplementation(
        async (scopeId, role) => {
          switch (role) {
            case 'blue':
              return mockBlueContext;
            case 'red':
              return mockRedContext;
            case 'arbiter':
              return mockArbiterContext;
            default:
              return null;
          }
        },
      );

      llmService.generateResponse.mockRejectedValue(new Error('LLM error'));

      await expect(service.runDebate(debateInput)).rejects.toThrow('LLM error');

      expect(debateRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should clamp score adjustment to valid range (-30 to +30)', async () => {
      debateRepo.create.mockResolvedValue({
        ...mockDebate,
        status: 'pending',
      });
      debateRepo.update.mockResolvedValue(mockDebate);
      debateRepo.findActiveContextByRole.mockImplementation(
        async (scopeId, role) => {
          switch (role) {
            case 'blue':
              return mockBlueContext;
            case 'red':
              return mockRedContext;
            case 'arbiter':
              return mockArbiterContext;
            default:
              return null;
          }
        },
      );

      // Arbiter suggests extreme adjustment
      const extremeArbiter = {
        ...mockArbiterSynthesis,
        recommended_adjustment: 100, // Way above allowed range
      };

      llmService.generateResponse
        .mockResolvedValueOnce(JSON.stringify(mockBlueAssessment))
        .mockResolvedValueOnce(JSON.stringify(mockRedChallenges))
        .mockResolvedValueOnce(JSON.stringify(extremeArbiter));

      scoreAggregation.applyDebateAdjustment.mockImplementation(
        (original, adj) => Math.min(100, Math.max(0, original + adj)),
      );

      await service.runDebate(debateInput);

      // Should have clamped to 30
      expect(scoreAggregation.applyDebateAdjustment).toHaveBeenCalledWith(
        65,
        30, // Clamped from 100 to 30
      );
    });
  });

  describe('shouldTriggerDebate', () => {
    it('should return false when redTeam is disabled', () => {
      const result = service.shouldTriggerDebate(mockCompositeScore, {
        redTeam: { enabled: false },
      });
      expect(result).toBe(false);
    });

    it('should return true when score exceeds threshold', () => {
      const result = service.shouldTriggerDebate(mockCompositeScore, {
        redTeam: { enabled: true, threshold: 60 },
      });
      expect(result).toBe(true); // Score is 65, threshold is 60
    });

    it('should return false when score is below threshold', () => {
      const result = service.shouldTriggerDebate(mockCompositeScore, {
        redTeam: { enabled: true, threshold: 70 },
      });
      expect(result).toBe(false); // Score is 65, threshold is 70
    });

    it('should return true when confidence is below low confidence threshold', () => {
      const lowConfidenceScore = { ...mockCompositeScore, confidence: 0.3 };
      const result = service.shouldTriggerDebate(lowConfidenceScore, {
        redTeam: { enabled: true, threshold: 100, lowConfidenceThreshold: 0.5 },
      });
      expect(result).toBe(true); // Confidence 0.3 < 0.5
    });

    it('should use default threshold (50) when not specified', () => {
      const result = service.shouldTriggerDebate(mockCompositeScore, {
        redTeam: { enabled: true },
      });
      expect(result).toBe(true); // Score 65 > default 50
    });
  });

  describe('getDebatesBySubject', () => {
    it('should return all debates for a subject', async () => {
      const debates = [mockDebate, { ...mockDebate, id: 'debate-456' }];
      debateRepo.findBySubject.mockResolvedValue(debates);

      const result = await service.getDebatesBySubject('subject-123');

      expect(result).toEqual(debates);
      expect(debateRepo.findBySubject).toHaveBeenCalledWith('subject-123');
    });
  });

  describe('getLatestDebate', () => {
    it('should return the latest completed debate', async () => {
      debateRepo.findLatestBySubject.mockResolvedValue(mockDebate);

      const result = await service.getLatestDebate('subject-123');

      expect(result).toEqual(mockDebate);
      expect(debateRepo.findLatestBySubject).toHaveBeenCalledWith(
        'subject-123',
      );
    });

    it('should return null if no debates exist', async () => {
      debateRepo.findLatestBySubject.mockResolvedValue(null);

      const result = await service.getLatestDebate('subject-123');

      expect(result).toBeNull();
    });
  });

  describe('getDebateById', () => {
    it('should return a debate by ID', async () => {
      debateRepo.findById.mockResolvedValue(mockDebate);

      const result = await service.getDebateById('debate-123');

      expect(result).toEqual(mockDebate);
      expect(debateRepo.findById).toHaveBeenCalledWith('debate-123');
    });
  });
});
