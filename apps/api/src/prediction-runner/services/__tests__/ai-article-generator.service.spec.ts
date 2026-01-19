import { Test, TestingModule } from '@nestjs/testing';
import { AiArticleGeneratorService } from '../ai-article-generator.service';
import { LLMService } from '@/llms/llm.service';
import { ExecutionContext } from '@orchestrator-ai/transport-types';
import { TestArticleGenerationRequest } from '../../interfaces/ai-generation.interface';

describe('AiArticleGeneratorService', () => {
  let service: AiArticleGeneratorService;
  let mockLlmService: Partial<LLMService>;

  const mockExecutionContext: ExecutionContext = {
    userId: 'test-user-id',
    orgSlug: 'test-org',
    conversationId: 'test-conversation-id',
    agentSlug: 'test-agent',
    agentType: 'context',
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    taskId: 'task-123',
    deliverableId: 'deliverable-123',
    planId: 'plan-123',
  };

  beforeEach(async () => {
    mockLlmService = {
      generateResponse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiArticleGeneratorService,
        { provide: LLMService, useValue: mockLlmService },
      ],
    }).compile();

    service = module.get<AiArticleGeneratorService>(AiArticleGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateArticles', () => {
    it('should generate articles with valid request', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_AAPL'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
        article_count: 1,
      };

      const mockLlmResponse = JSON.stringify({
        articles: [
          {
            title: 'T_AAPL Beats Earnings Expectations',
            content:
              '[SYNTHETIC TEST ARTICLE]\n\nT_AAPL reported strong quarterly earnings...',
            summary: 'T_AAPL exceeds analyst expectations',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test Financial Times',
          },
        ],
      });

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0]?.title).toBe(
        'T_AAPL Beats Earnings Expectations',
      );
      expect(result.articles[0]?.content).toContain('[SYNTHETIC TEST ARTICLE]');
      expect(result.articles[0]?.target_symbols).toEqual(['T_AAPL']);
      expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          executionContext: mockExecutionContext,
          callerType: 'api',
          callerName: 'ai-article-generator',
          temperature: 0.8,
          max_tokens: 4000,
        }),
      );
    });

    it('should enforce T_ prefix on target symbols (INV-08)', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['AAPL'], // Missing T_ prefix
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain(
        'must start with T_ prefix (INV-08)',
      );
      expect(mockLlmService.generateResponse).not.toHaveBeenCalled();
    });

    it('should reject requests without T_ prefix', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['MSFT', 'GOOGL'],
        scenario_type: 'technical',
        sentiment: 'bearish',
        strength: 'moderate',
      };

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBe(2);
      expect(result.errors?.[0]).toContain('MSFT');
      expect(result.errors?.[1]).toContain('GOOGL');
    });

    it('should add synthetic markers to generated content', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_TSLA'],
        scenario_type: 'scandal',
        sentiment: 'bearish',
        strength: 'strong',
      };

      // Mock response without synthetic marker
      const mockLlmResponse = JSON.stringify({
        articles: [
          {
            title: 'T_TSLA Faces Scandal',
            content: 'T_TSLA is facing controversy...', // No marker
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test Bloomberg',
          },
        ],
      });

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.articles[0]?.content).toContain('[SYNTHETIC TEST ARTICLE]');
    });

    it('should handle different scenario types', async () => {
      const scenarioTypes: TestArticleGenerationRequest['scenario_type'][] = [
        'earnings_beat',
        'earnings_miss',
        'scandal',
        'regulatory',
        'acquisition',
        'macro_shock',
        'technical',
        'custom',
      ];

      for (const scenario_type of scenarioTypes) {
        const request: TestArticleGenerationRequest = {
          target_symbols: ['T_TEST'],
          scenario_type,
          sentiment: 'neutral',
          strength: 'moderate',
          custom_prompt:
            scenario_type === 'custom' ? 'Custom scenario' : undefined,
        };

        const mockLlmResponse = JSON.stringify({
          articles: [
            {
              title: `T_TEST ${scenario_type}`,
              content: `[SYNTHETIC TEST ARTICLE]\n\nTest content for ${scenario_type}`,
              simulated_published_at: '2024-01-01T12:00:00Z',
              simulated_source_name: 'Test News',
            },
          ],
        });

        mockLlmService.generateResponse = jest
          .fn()
          .mockResolvedValue(mockLlmResponse);

        const result = await service.generateArticles(
          request,
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
      }
    });

    it('should handle different sentiments and strengths', async () => {
      const testCases: Array<{
        sentiment: TestArticleGenerationRequest['sentiment'];
        strength: TestArticleGenerationRequest['strength'];
      }> = [
        { sentiment: 'bullish', strength: 'strong' },
        { sentiment: 'bullish', strength: 'moderate' },
        { sentiment: 'bullish', strength: 'weak' },
        { sentiment: 'bearish', strength: 'strong' },
        { sentiment: 'bearish', strength: 'moderate' },
        { sentiment: 'bearish', strength: 'weak' },
        { sentiment: 'neutral', strength: 'moderate' },
        { sentiment: 'mixed', strength: 'moderate' },
      ];

      for (const { sentiment, strength } of testCases) {
        const request: TestArticleGenerationRequest = {
          target_symbols: ['T_TEST'],
          scenario_type: 'technical',
          sentiment,
          strength,
        };

        const mockLlmResponse = JSON.stringify({
          articles: [
            {
              title: 'Test Article',
              content: '[SYNTHETIC TEST ARTICLE]\n\nTest content',
              simulated_published_at: '2024-01-01T12:00:00Z',
              simulated_source_name: 'Test News',
            },
          ],
        });

        mockLlmService.generateResponse = jest
          .fn()
          .mockResolvedValue(mockLlmResponse);

        const result = await service.generateArticles(
          request,
          mockExecutionContext,
        );

        expect(result.success).toBe(true);
        expect(result.articles[0]?.intended_sentiment).toBe(sentiment);
        expect(result.articles[0]?.intended_strength).toBe(strength);
      }
    });

    it('should handle custom prompts', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_CUSTOM'],
        scenario_type: 'custom',
        sentiment: 'bullish',
        strength: 'moderate',
        custom_prompt:
          'Generate an article about a breakthrough in AI technology',
      };

      const mockLlmResponse = JSON.stringify({
        articles: [
          {
            title: 'T_CUSTOM Announces AI Breakthrough',
            content:
              '[SYNTHETIC TEST ARTICLE]\n\nT_CUSTOM revealed a major AI advancement...',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test Tech News',
          },
        ],
      });

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('breakthrough in AI technology'),
        expect.any(Object),
      );
    });

    it('should handle LLM service errors gracefully', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_ERROR'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      mockLlmService.generateResponse = jest
        .fn()
        .mockRejectedValue(new Error('LLM service unavailable'));

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('LLM service unavailable');
      expect(result.articles).toHaveLength(0);
    });

    it('should validate article count parameter', async () => {
      const invalidRequest: TestArticleGenerationRequest = {
        target_symbols: ['T_TEST'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
        article_count: 15, // Exceeds max of 10
      };

      const result = await service.generateArticles(
        invalidRequest,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('article_count must be between 1 and 10');
    });

    it('should require custom_prompt for custom scenario type', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_TEST'],
        scenario_type: 'custom',
        sentiment: 'bullish',
        strength: 'strong',
        // Missing custom_prompt
      };

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'custom_prompt is required when scenario_type is "custom"',
      );
    });

    it('should validate scenario_type', async () => {
      const request = {
        target_symbols: ['T_TEST'],
        scenario_type: 'invalid_type',
        sentiment: 'bullish',
        strength: 'strong',
      } as unknown as TestArticleGenerationRequest;

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid scenario_type');
    });

    it('should validate sentiment', async () => {
      const request = {
        target_symbols: ['T_TEST'],
        scenario_type: 'earnings_beat',
        sentiment: 'super_bullish',
        strength: 'strong',
      } as unknown as TestArticleGenerationRequest;

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid sentiment');
    });

    it('should validate strength', async () => {
      const request = {
        target_symbols: ['T_TEST'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'mega_strong',
      } as unknown as TestArticleGenerationRequest;

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Invalid strength');
    });

    it('should generate multiple articles', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_MULTI'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
        article_count: 3,
      };

      const mockLlmResponse = JSON.stringify({
        articles: [
          {
            title: 'Article 1',
            content: '[SYNTHETIC TEST ARTICLE]\n\nContent 1',
            simulated_published_at: '2024-01-01T10:00:00Z',
            simulated_source_name: 'Source 1',
          },
          {
            title: 'Article 2',
            content: '[SYNTHETIC TEST ARTICLE]\n\nContent 2',
            simulated_published_at: '2024-01-01T11:00:00Z',
            simulated_source_name: 'Source 2',
          },
          {
            title: 'Article 3',
            content: '[SYNTHETIC TEST ARTICLE]\n\nContent 3',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Source 3',
          },
        ],
      });

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.articles).toHaveLength(3);
    });

    it('should handle LLM response with metadata', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_META'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      const mockLlmResponse = {
        content: JSON.stringify({
          articles: [
            {
              title: 'Test Article',
              content: '[SYNTHETIC TEST ARTICLE]\n\nTest content',
              simulated_published_at: '2024-01-01T12:00:00Z',
              simulated_source_name: 'Test News',
            },
          ],
        }),
        metadata: {
          usage: {
            totalTokens: 1500,
            promptTokens: 500,
            completionTokens: 1000,
          },
        },
      };

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(result.generation_metadata.tokens_used).toBe(1500);
      expect(result.generation_metadata.model_used).toBe('claude-opus-4-5');
    });

    it('should handle malformed LLM JSON response', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_MALFORMED'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      const mockLlmResponse = 'This is not JSON at all!';

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true); // No validation errors, but no articles
      expect(result.articles).toHaveLength(0);
    });

    it('should require at least one target symbol', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: [],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('At least one target symbol is required');
    });

    it('should include generation time in metadata', async () => {
      const request: TestArticleGenerationRequest = {
        target_symbols: ['T_TIME'],
        scenario_type: 'earnings_beat',
        sentiment: 'bullish',
        strength: 'strong',
      };

      const mockLlmResponse = JSON.stringify({
        articles: [
          {
            title: 'Test Article',
            content: '[SYNTHETIC TEST ARTICLE]\n\nTest content',
            simulated_published_at: '2024-01-01T12:00:00Z',
            simulated_source_name: 'Test News',
          },
        ],
      });

      mockLlmService.generateResponse = jest
        .fn()
        .mockResolvedValue(mockLlmResponse);

      const result = await service.generateArticles(
        request,
        mockExecutionContext,
      );

      expect(result.success).toBe(true);
      expect(
        result.generation_metadata.generation_time_ms,
      ).toBeGreaterThanOrEqual(0);
    });
  });
});
