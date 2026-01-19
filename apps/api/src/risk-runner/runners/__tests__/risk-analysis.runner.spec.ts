import { Test, TestingModule } from '@nestjs/testing';
import { RiskAnalysisRunner } from '../risk-analysis.runner';
import { ScopeRepository } from '../../repositories/scope.repository';
import { SubjectRepository } from '../../repositories/subject.repository';
import {
  RiskAnalysisService,
  AnalysisResult,
} from '../../services/risk-analysis.service';
import { RiskScope } from '../../interfaces/scope.interface';
import { RiskSubject } from '../../interfaces/subject.interface';

describe('RiskAnalysisRunner', () => {
  let runner: RiskAnalysisRunner;
  let scopeRepo: jest.Mocked<ScopeRepository>;
  let subjectRepo: jest.Mocked<SubjectRepository>;
  let riskAnalysisService: jest.Mocked<RiskAnalysisService>;

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

  const mockScopeDisabled: RiskScope = {
    ...mockScope,
    id: 'scope-2',
    name: 'Disabled Scope',
    analysis_config: { riskRadar: { enabled: false } },
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
  ];

  const mockAnalysisResult: AnalysisResult = {
    subject: mockSubject,
    compositeScore: {
      id: 'composite-1',
      subject_id: 'subject-1',
      task_id: 'task-1',
      overall_score: 45,
      confidence: 0.85,
      dimension_scores: { market: 50, fundamental: 40 },
      pre_debate_score: null,
      debate_id: null,
      debate_adjustment: 0,
      status: 'active',
      valid_until: '2024-01-02T00:00:00Z',
      is_test: false,
      test_scenario_id: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    assessmentCount: 3,
    debateTriggered: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAnalysisRunner,
        {
          provide: ScopeRepository,
          useValue: {
            findAllActive: jest.fn(),
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: SubjectRepository,
          useValue: {
            findByScope: jest.fn(),
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: RiskAnalysisService,
          useValue: {
            analyzeSubject: jest.fn(),
          },
        },
      ],
    }).compile();

    runner = module.get<RiskAnalysisRunner>(RiskAnalysisRunner);
    scopeRepo = module.get(ScopeRepository);
    subjectRepo = module.get(SubjectRepository);
    riskAnalysisService = module.get(RiskAnalysisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(runner).toBeDefined();
  });

  describe('isProcessing', () => {
    it('should return false when not running', () => {
      expect(runner.isProcessing()).toBe(false);
    });
  });

  describe('runBatchAnalysis', () => {
    it('should analyze all subjects in active scopes', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScope]);
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      riskAnalysisService.analyzeSubject.mockResolvedValue(mockAnalysisResult);

      const result = await runner.runBatchAnalysis();

      expect(result.analyzed).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.scopesProcessed).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(scopeRepo.findAllActive).toHaveBeenCalledTimes(1);
      expect(subjectRepo.findByScope).toHaveBeenCalledWith('scope-1');
      expect(riskAnalysisService.analyzeSubject).toHaveBeenCalledTimes(3);
    });

    it('should skip scopes with Risk Radar disabled', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScopeDisabled]);
      subjectRepo.findByScope.mockResolvedValue([]);

      const result = await runner.runBatchAnalysis();

      expect(result.scopesProcessed).toBe(0);
      expect(result.analyzed).toBe(0);
      expect(subjectRepo.findByScope).not.toHaveBeenCalled();
    });

    it('should skip if previous run is still in progress', async () => {
      scopeRepo.findAllActive.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [mockScope];
      });
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      riskAnalysisService.analyzeSubject.mockResolvedValue(mockAnalysisResult);

      // Start first run
      const firstRun = runner.runBatchAnalysis();

      // Try to start second run while first is in progress
      const secondResult = await runner.runBatchAnalysis();

      // Wait for first run to complete
      await firstRun;

      expect(secondResult.analyzed).toBe(0);
      expect(secondResult.duration).toBe(0);
    });

    it('should handle analysis failures gracefully', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScope]);
      subjectRepo.findByScope.mockResolvedValue(mockSubjects);
      riskAnalysisService.analyzeSubject
        .mockResolvedValueOnce(mockAnalysisResult)
        .mockRejectedValueOnce(new Error('Analysis failed'))
        .mockResolvedValueOnce(mockAnalysisResult);

      const result = await runner.runBatchAnalysis();

      expect(result.analyzed).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should handle empty scopes list', async () => {
      scopeRepo.findAllActive.mockResolvedValue([]);

      const result = await runner.runBatchAnalysis();

      expect(result.analyzed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.scopesProcessed).toBe(0);
    });

    it('should handle scopes with no subjects', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScope]);
      subjectRepo.findByScope.mockResolvedValue([]);

      const result = await runner.runBatchAnalysis();

      expect(result.analyzed).toBe(0);
      expect(result.scopesProcessed).toBe(1);
    });

    it('should process multiple scopes', async () => {
      const secondScope: RiskScope = {
        ...mockScope,
        id: 'scope-3',
        name: 'Crypto Portfolio',
        organization_slug: 'crypto-org',
      };

      scopeRepo.findAllActive.mockResolvedValue([mockScope, secondScope]);
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);
      riskAnalysisService.analyzeSubject.mockResolvedValue(mockAnalysisResult);

      const result = await runner.runBatchAnalysis();

      expect(result.scopesProcessed).toBe(2);
      expect(result.analyzed).toBe(2);
      expect(subjectRepo.findByScope).toHaveBeenCalledTimes(2);
    });

    it('should create execution context with correct org and agent', async () => {
      scopeRepo.findAllActive.mockResolvedValue([mockScope]);
      subjectRepo.findByScope.mockResolvedValue([mockSubject]);
      riskAnalysisService.analyzeSubject.mockResolvedValue(mockAnalysisResult);

      await runner.runBatchAnalysis();

      expect(riskAnalysisService.analyzeSubject).toHaveBeenCalledWith(
        mockSubject,
        mockScope,
        expect.objectContaining({
          orgSlug: 'finance',
          agentSlug: 'investment-risk-agent',
          agentType: 'api',
        }),
      );
    });
  });

  describe('analyzeSubject', () => {
    it('should analyze a single subject by ID', async () => {
      subjectRepo.findByIdOrThrow.mockResolvedValue(mockSubject);
      scopeRepo.findByIdOrThrow.mockResolvedValue(mockScope);
      riskAnalysisService.analyzeSubject.mockResolvedValue(mockAnalysisResult);

      const result = await runner.analyzeSubject('subject-1');

      expect(result).toEqual(mockAnalysisResult);
      expect(subjectRepo.findByIdOrThrow).toHaveBeenCalledWith('subject-1');
      expect(scopeRepo.findByIdOrThrow).toHaveBeenCalledWith('scope-1');
    });

    it('should throw when subject not found', async () => {
      subjectRepo.findByIdOrThrow.mockRejectedValue(
        new Error('Subject not found'),
      );

      await expect(runner.analyzeSubject('nonexistent')).rejects.toThrow(
        'Subject not found',
      );
    });

    it('should throw when scope not found', async () => {
      subjectRepo.findByIdOrThrow.mockResolvedValue(mockSubject);
      scopeRepo.findByIdOrThrow.mockRejectedValue(new Error('Scope not found'));

      await expect(runner.analyzeSubject('subject-1')).rejects.toThrow(
        'Scope not found',
      );
    });
  });

  describe('runScheduledAnalysis', () => {
    it('should call runBatchAnalysis', async () => {
      scopeRepo.findAllActive.mockResolvedValue([]);

      await runner.runScheduledAnalysis();

      expect(scopeRepo.findAllActive).toHaveBeenCalled();
    });
  });
});
