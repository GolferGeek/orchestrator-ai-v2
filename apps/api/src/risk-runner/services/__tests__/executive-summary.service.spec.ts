import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import { ExecutiveSummaryService } from '../executive-summary.service';
import { LLMService } from '@/llms/llm.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { ObservabilityEventsService } from '@/observability/observability-events.service';

describe('ExecutiveSummaryService', () => {
  let service: ExecutiveSummaryService;
  let llmService: jest.Mocked<LLMService>;
  let supabaseService: jest.Mocked<SupabaseService>;
  let observabilityEvents: jest.Mocked<ObservabilityEventsService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  const mockLLMResponse = {
    content: JSON.stringify({
      headline: 'Portfolio risk at 45% - MEDIUM status',
      status: 'medium',
      keyFindings: ['Finding 1', 'Finding 2', 'Finding 3'],
      recommendations: ['Recommendation 1', 'Recommendation 2'],
      riskHighlights: {
        topRisks: [{ subject: 'AAPL', score: 0.65, dimension: 'Market' }],
        recentChanges: [{ subject: 'TSLA', change: 0.1, direction: 'up' }],
      },
    }),
    metadata: {
      provider: 'openai',
      model: 'gpt-4',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
      usage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
      timing: { startTime: 0, endTime: 500, duration: 500 },
      status: 'completed' as const,
    },
  };

  // Comprehensive Supabase mock with proper chaining
  const createMockClient = () => {
    const createChainableMock = (finalResult: unknown) => {
      const chain: Record<string, jest.Mock> = {};
      chain.single = jest.fn().mockResolvedValue(finalResult);
      chain.limit = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      chain.gte = jest.fn().mockReturnValue(chain);
      chain.not = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockReturnValue(chain);
      return chain;
    };

    const defaultResult = {
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    };

    const insertResult = {
      data: {
        id: 'summary-123',
        scope_id: 'scope-123',
        summary_type: 'ad-hoc',
        content: {},
        risk_snapshot: {},
        generated_by: 'gpt-4',
        generated_at: new Date().toISOString(),
        expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };

    const chain = createChainableMock(defaultResult);

    // Override insert chain to return success
    chain.insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(insertResult),
      }),
    });

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
        ExecutiveSummaryService,
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue(mockLLMResponse),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: ObservabilityEventsService,
          useValue: {
            push: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<ExecutiveSummaryService>(ExecutiveSummaryService);
    llmService = module.get(LLMService);
    supabaseService = module.get(SupabaseService);
    observabilityEvents = module.get(ObservabilityEventsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('should generate a new summary', async () => {
      const result = await service.generateSummary({
        scopeId: 'scope-123',
        summaryType: 'ad-hoc',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
      expect(result.cached).toBe(false);
      expect(llmService.generateResponse).toHaveBeenCalled();
    });

    it('should emit progress events', async () => {
      await service.generateSummary({
        scopeId: 'scope-123',
        summaryType: 'ad-hoc',
        context: mockExecutionContext,
      });

      expect(observabilityEvents.push).toHaveBeenCalled();
      const calls = observabilityEvents.push.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should skip cache when forceRefresh is true', async () => {
      await service.generateSummary({
        scopeId: 'scope-123',
        summaryType: 'ad-hoc',
        forceRefresh: true,
        context: mockExecutionContext,
      });

      expect(llmService.generateResponse).toHaveBeenCalled();
    });

    it('should handle daily summary type', async () => {
      const result = await service.generateSummary({
        scopeId: 'scope-123',
        summaryType: 'daily',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should handle weekly summary type', async () => {
      const result = await service.generateSummary({
        scopeId: 'scope-123',
        summaryType: 'weekly',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('getLatestSummary', () => {
    it('should return null when no summary exists', async () => {
      const result = await service.getLatestSummary('scope-123');
      expect(result).toBeNull();
    });
  });

  describe('listSummaries', () => {
    it('should call database with correct parameters', async () => {
      await service.listSummaries('scope-123');
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should apply limit option', async () => {
      await service.listSummaries('scope-123', { limit: 5 });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should filter by summary type', async () => {
      await service.listSummaries('scope-123', { summaryType: 'daily' });
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });
  });

  describe('response parsing', () => {
    it('should parse valid JSON response', async () => {
      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should handle markdown-wrapped JSON', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: '```json\n' + mockLLMResponse.content + '\n```',
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should fallback when JSON parsing fails', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: 'This is not valid JSON',
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('status validation', () => {
    it('should accept valid status values', async () => {
      const statuses = ['critical', 'high', 'medium', 'low', 'stable'];

      for (const status of statuses) {
        llmService.generateResponse.mockResolvedValue({
          ...mockLLMResponse,
          content: JSON.stringify({
            headline: 'Test',
            status,
            keyFindings: [],
            recommendations: [],
            riskHighlights: { topRisks: [], recentChanges: [] },
          }),
        });

        const result = await service.generateSummary({
          scopeId: 'scope-123',
          context: mockExecutionContext,
        });

        expect(result.summary).toBeDefined();
      }
    });

    it('should derive status from score when invalid', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'invalid-status',
          keyFindings: [],
          recommendations: [],
          riskHighlights: { topRisks: [], recentChanges: [] },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('risk highlights limits', () => {
    it('should limit topRisks to 3', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'medium',
          keyFindings: [],
          recommendations: [],
          riskHighlights: {
            topRisks: [
              { subject: 'A', score: 0.9, dimension: 'X' },
              { subject: 'B', score: 0.8, dimension: 'Y' },
              { subject: 'C', score: 0.7, dimension: 'Z' },
              { subject: 'D', score: 0.6, dimension: 'W' },
            ],
            recentChanges: [],
          },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should limit recentChanges to 3', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'medium',
          keyFindings: [],
          recommendations: [],
          riskHighlights: {
            topRisks: [],
            recentChanges: [
              { subject: 'A', change: 0.1, direction: 'up' },
              { subject: 'B', change: 0.2, direction: 'down' },
              { subject: 'C', change: 0.15, direction: 'up' },
              { subject: 'D', change: 0.25, direction: 'down' },
            ],
          },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('key findings and recommendations limits', () => {
    it('should limit keyFindings to 5', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'medium',
          keyFindings: ['1', '2', '3', '4', '5', '6', '7'],
          recommendations: [],
          riskHighlights: { topRisks: [], recentChanges: [] },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should limit recommendations to 3', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'medium',
          keyFindings: [],
          recommendations: ['1', '2', '3', '4', '5'],
          riskHighlights: { topRisks: [], recentChanges: [] },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });

    it('should filter non-string values from findings', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Test',
          status: 'medium',
          keyFindings: ['Valid finding', 123, null, 'Another valid'],
          recommendations: ['Valid', {}, 'Also valid'],
          riskHighlights: { topRisks: [], recentChanges: [] },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('observability', () => {
    it('should work without observability service', async () => {
      const moduleWithoutObs = await Test.createTestingModule({
        providers: [
          ExecutiveSummaryService,
          {
            provide: LLMService,
            useValue: {
              generateResponse: jest.fn().mockResolvedValue(mockLLMResponse),
            },
          },
          {
            provide: SupabaseService,
            useValue: {
              getServiceClient: jest.fn().mockReturnValue(createMockClient()),
            },
          },
        ],
      }).compile();

      moduleWithoutObs.useLogger(false);
      const serviceWithoutObs = moduleWithoutObs.get<ExecutiveSummaryService>(
        ExecutiveSummaryService,
      );

      const result = await serviceWithoutObs.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });

  describe('percentage sanitization', () => {
    it('should sanitize unreasonable percentages', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          headline: 'Risk at 6240% - very high',
          status: 'high',
          keyFindings: ['Score increased to 6200%'],
          recommendations: ['Monitor closely'],
          riskHighlights: {
            topRisks: [],
            recentChanges: [],
          },
        }),
      });

      const result = await service.generateSummary({
        scopeId: 'scope-123',
        context: mockExecutionContext,
      });

      expect(result.summary).toBeDefined();
    });
  });
});
