import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import {
  DimensionAnalyzerService,
  RelevantArticle,
} from '../dimension-analyzer.service';
import { LLMService } from '@/llms/llm.service';
import { DimensionContextRepository } from '../../repositories/dimension-context.repository';
import { RiskSubject } from '../../interfaces/subject.interface';
import { RiskDimension } from '../../interfaces/dimension.interface';

describe('DimensionAnalyzerService', () => {
  let service: DimensionAnalyzerService;
  let llmService: jest.Mocked<LLMService>;
  let dimensionContextRepo: jest.Mocked<DimensionContextRepository>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'openai',
    model: 'gpt-4',
  });

  const mockSubject: RiskSubject = {
    id: 'subject-123',
    scope_id: 'scope-123',
    subject_type: 'stock',
    identifier: 'AAPL',
    name: 'Apple Inc.',
    metadata: { sector: 'Technology' },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockDimension: RiskDimension = {
    id: 'dim-123',
    scope_id: 'scope-123',
    name: 'Market Risk',
    slug: 'market-risk',
    description: 'Analysis of market-related risks',
    display_name: 'Market Risk',
    icon: 'chart-line',
    color: '#EF4444',
    weight: 1.0,
    display_order: 1,
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockDimensionContext = {
    id: 'ctx-123',
    dimension_id: 'dim-123',
    version: 1,
    system_prompt: 'You are a risk analyst.',
    output_schema: { type: 'object', properties: {} },
    is_active: true,
    is_test: false,
    test_scenario_id: null,
    examples: [
      {
        input: { subject: 'AAPL', data: {} },
        output: { score: 30, confidence: 0.8, reasoning: 'Test', evidence: [] },
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockLLMResponse = {
    content: JSON.stringify({
      score: 35,
      confidence: 0.85,
      reasoning: 'Market conditions are stable with moderate volatility.',
      evidence: ['Stock price stable', 'Low VIX'],
      signals: [
        { name: 'volatility', value: 'low', impact: 'positive', weight: 0.8 },
      ],
    }),
    metadata: {
      provider: 'openai',
      model: 'gpt-4',
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      timing: { startTime: 0, endTime: 100, duration: 100 },
      status: 'completed' as const,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DimensionAnalyzerService,
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue(mockLLMResponse),
          },
        },
        {
          provide: DimensionContextRepository,
          useValue: {
            findActiveForDimension: jest
              .fn()
              .mockResolvedValue(mockDimensionContext),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<DimensionAnalyzerService>(DimensionAnalyzerService);
    llmService = module.get(LLMService);
    dimensionContextRepo = module.get(DimensionContextRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeDimension', () => {
    it('should analyze dimension successfully', async () => {
      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.subject_id).toBe(mockSubject.id);
      expect(result.dimension_id).toBe(mockDimension.id);
      expect(result.score).toBe(35);
      expect(result.confidence).toBe(0.85);
      expect(result.reasoning).toBe(
        'Market conditions are stable with moderate volatility.',
      );
      expect(result.evidence).toEqual(['Stock price stable', 'Low VIX']);
      expect(result.signals).toHaveLength(1);
    });

    it('should call LLM service with correct parameters', async () => {
      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(llmService.generateResponse).toHaveBeenCalledWith(
        mockDimensionContext.system_prompt,
        expect.stringContaining('Analyze the Market Risk risk for AAPL'),
        expect.objectContaining({
          executionContext: mockExecutionContext,
          callerType: 'api',
          callerName: 'dimension-analyzer',
        }),
      );
    });

    it('should include market data in prompt', async () => {
      const marketData = { price: 150.25, volume: 1000000 };

      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
        marketData,
      });

      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Market Data:'),
        expect.any(Object),
      );
    });

    it('should include articles in prompt when provided', async () => {
      const articles: RelevantArticle[] = [
        {
          articleId: 'art-1',
          title: 'Apple Reports Strong Q4',
          content: 'Apple reported better than expected earnings...',
          url: 'https://example.com/article',
          publishedAt: '2024-01-15',
          sentiment: 0.7,
          sentimentLabel: 'positive',
          confidence: 0.9,
          riskIndicators: [{ type: 'financial', keywords: ['earnings', 'revenue'] }],
        },
      ];

      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
        articles,
      });

      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('RELEVANT NEWS ARTICLES'),
        expect.any(Object),
      );
      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Apple Reports Strong Q4'),
        expect.any(Object),
      );
    });

    it('should track token usage in assessment', async () => {
      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.analyst_response?.prompt_tokens).toBe(100);
      expect(result.analyst_response?.completion_tokens).toBe(50);
    });

    it('should include LLM provider and model', async () => {
      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.llm_provider).toBe('openai');
      expect(result.llm_model).toBe('gpt-4');
    });
  });

  describe('default assessment', () => {
    it('should return default assessment when no dimension context', async () => {
      dimensionContextRepo.findActiveForDimension.mockResolvedValue(null);

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(50); // Neutral
      expect(result.confidence).toBe(0.1); // Low
      expect(result.reasoning).toContain('No analysis context configured');
      expect(llmService.generateResponse).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return error assessment on LLM failure', async () => {
      llmService.generateResponse.mockRejectedValue(new Error('LLM error'));

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(50); // Neutral on error
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Analysis failed');
      expect(result.reasoning).toContain('LLM error');
    });

    it('should handle non-Error exceptions', async () => {
      llmService.generateResponse.mockRejectedValue('Unknown error');

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.reasoning).toContain('Unknown error');
    });
  });

  describe('response parsing', () => {
    it('should handle JSON wrapped in markdown code blocks', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: '```json\n{"score": 40, "confidence": 0.9, "reasoning": "Test", "evidence": [], "signals": []}\n```',
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(40);
      expect(result.confidence).toBe(0.9);
    });

    it('should handle malformed JSON with fallback', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: 'This is not valid JSON response about risk analysis.',
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(50); // Default
      expect(result.confidence).toBe(0.3); // Low confidence
      expect(result.reasoning).toContain('This is not valid JSON');
    });

    it('should clamp score to 0-100 range', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 150, // Over 100
          confidence: 0.8,
          reasoning: 'Test',
          evidence: [],
          signals: [],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(100); // Clamped
    });

    it('should clamp confidence to 0-1 range', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 50,
          confidence: 1.5, // Over 1
          reasoning: 'Test',
          evidence: [],
          signals: [],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.confidence).toBe(1); // Clamped
    });

    it('should handle string response from LLM', async () => {
      llmService.generateResponse.mockResolvedValue(
        JSON.stringify({
          score: 45,
          confidence: 0.75,
          reasoning: 'Direct string response',
          evidence: [],
          signals: [],
        }),
      );

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.score).toBe(45);
    });
  });

  describe('signal normalization', () => {
    it('should normalize valid signals', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 50,
          confidence: 0.8,
          reasoning: 'Test',
          evidence: [],
          signals: [
            { name: 'test', value: 'high', impact: 'negative', weight: 0.9 },
          ],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.signals?.[0]).toEqual({
        name: 'test',
        value: 'high',
        impact: 'negative',
        weight: 0.9,
      });
    });

    it('should handle malformed signals', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 50,
          confidence: 0.8,
          reasoning: 'Test',
          evidence: [],
          signals: ['invalid-signal', null, { name: 'valid' }],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.signals).toHaveLength(3);
      expect(result.signals?.[0]?.impact).toBe('neutral'); // Default
    });

    it('should clamp signal weight to 0-1 range', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 50,
          confidence: 0.8,
          reasoning: 'Test',
          evidence: [],
          signals: [{ name: 'test', value: 'x', impact: 'neutral', weight: 5 }],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.signals?.[0]?.weight).toBe(1); // Clamped
    });

    it('should default invalid impact to neutral', async () => {
      llmService.generateResponse.mockResolvedValue({
        ...mockLLMResponse,
        content: JSON.stringify({
          score: 50,
          confidence: 0.8,
          reasoning: 'Test',
          evidence: [],
          signals: [{ name: 'test', impact: 'invalid', weight: 0.5 }],
        }),
      });

      const result = await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(result.signals?.[0]?.impact).toBe('neutral');
    });
  });

  describe('prompt building', () => {
    it('should include subject metadata', async () => {
      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Subject Metadata'),
        expect.any(Object),
      );
    });

    it('should include examples from dimension context', async () => {
      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
      });

      expect(llmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Examples of expected output'),
        expect.any(Object),
      );
    });

    it('should limit articles to 10', async () => {
      const manyArticles: RelevantArticle[] = Array(15)
        .fill(null)
        .map((_, i) => ({
          articleId: `art-${i}`,
          title: `Article ${i}`,
          content: 'Content',
          url: `https://example.com/${i}`,
          publishedAt: '2024-01-15',
          sentiment: 0.5,
          sentimentLabel: 'neutral',
          confidence: 0.8,
          riskIndicators: [],
        }));

      await service.analyzeDimension({
        subject: mockSubject,
        dimension: mockDimension,
        context: mockExecutionContext,
        articles: manyArticles,
      });

      // Should only include first 10 articles
      const promptArg = (llmService.generateResponse as jest.Mock).mock
        .calls[0][1] as string;
      const articleMatches = promptArg.match(/--- Article ---/g) || [];
      expect(articleMatches.length).toBe(10);
    });
  });
});
