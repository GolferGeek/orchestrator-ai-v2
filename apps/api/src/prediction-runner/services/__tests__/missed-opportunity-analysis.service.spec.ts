import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MissedOpportunityAnalysisService } from '../missed-opportunity-analysis.service';
import { SupabaseService } from '@/supabase/supabase.service';
import { LLMService } from '@/llms/llm.service';
import { LearningQueueService } from '../learning-queue.service';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';

describe('MissedOpportunityAnalysisService', () => {
  let service: MissedOpportunityAnalysisService;
  let supabaseService: jest.Mocked<SupabaseService>;
  let llmService: jest.Mocked<LLMService>;
  let learningQueueService: jest.Mocked<LearningQueueService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'anthropic',
    model: 'claude-sonnet',
  });

  const mockMissedOpportunity = {
    id: 'miss-123',
    target_id: 'target-123',
    detected_at: '2024-01-01T16:00:00Z',
    move_start: '2024-01-01T10:00:00Z',
    move_end: '2024-01-01T14:00:00Z',
    move_direction: 'up',
    move_percentage: 5.5,
    significance_score: 0.8,
    analysis_status: 'pending',
    discovered_drivers: [],
    source_gaps: [],
    suggested_learnings: [],
  };

  const mockRejectedSignals = [
    {
      id: 'sig-1',
      signal_type: 'news',
      content: 'Positive earnings report expected',
      direction: 'bullish',
      strength: 7,
      timestamp: '2024-01-01T09:00:00Z',
      rejection_reason: 'Low confidence',
    },
    {
      id: 'sig-2',
      signal_type: 'technical',
      content: 'RSI oversold condition',
      direction: 'bullish',
      strength: 6,
      timestamp: '2024-01-01T11:00:00Z',
      rejection_reason: null,
    },
  ];

  const mockLLMResponse = JSON.stringify({
    discoveredDrivers: ['Earnings beat expectations', 'Positive guidance'],
    signalGaps: ['Earnings preview sentiment', 'Options flow data'],
    sourceGaps: ['Social media sentiment', 'Options data feed'],
    suggestedLearnings: [
      {
        type: 'rule',
        content: 'Lower confidence threshold for earnings-related signals',
        scope: 'target',
      },
      {
        type: 'pattern',
        content: 'RSI oversold during earnings week often precedes upward moves',
        scope: 'universe',
      },
    ],
  });

  const createMockClient = (overrides?: {
    missedOpp?: { data: unknown | null; error: { message: string; code?: string } | null };
    signals?: { data: unknown[] | null; error: { message: string } | null };
    update?: { error: { message: string } | null };
  }) => {
    const missedOppResult = overrides?.missedOpp ?? { data: mockMissedOpportunity, error: null };
    const signalsResult = overrides?.signals ?? { data: mockRejectedSignals, error: null };
    const updateResult = overrides?.update ?? { error: null };

    const createChain = (fromTable: string) => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        update: jest.fn(),
        then: (resolve: (v: unknown) => void) => {
          if (fromTable === 'signals') {
            return resolve(signalsResult);
          }
          return resolve({ data: [], error: null });
        },
      };

      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.gte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.lte as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.order as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.single as jest.Mock).mockReturnValue({
        ...chainableResult,
        then: (resolve: (v: unknown) => void) => resolve(missedOppResult),
      });
      (chainableResult.update as jest.Mock).mockReturnValue({
        ...chainableResult,
        eq: jest.fn().mockReturnValue({
          then: (resolve: (v: unknown) => void) => resolve(updateResult),
        }),
      });

      return chainableResult;
    };

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation((table: string) => createChain(table)),
      }),
    };
  };

  beforeEach(async () => {
    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedOpportunityAnalysisService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn().mockResolvedValue(mockLLMResponse),
          },
        },
        {
          provide: LearningQueueService,
          useValue: {
            createSuggestion: jest.fn().mockResolvedValue({ id: 'queue-123' }),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<MissedOpportunityAnalysisService>(MissedOpportunityAnalysisService);
    supabaseService = module.get(SupabaseService);
    llmService = module.get(LLMService);
    learningQueueService = module.get(LearningQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeMissedOpportunity', () => {
    it('should analyze a missed opportunity', async () => {
      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(result).toBeDefined();
      expect(result.missedOpportunityId).toBe('miss-123');
      expect(result.discoveredDrivers).toBeDefined();
      expect(result.suggestedLearnings).toBeDefined();
    });

    it('should call LLM service with proper prompts', async () => {
      await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(llmService.generateResponse).toHaveBeenCalled();
      const callArgs = (llmService.generateResponse as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('market analyst'); // System prompt
      expect(callArgs[1]).toContain('Direction'); // User prompt contains move details
    });

    it('should queue suggested learnings', async () => {
      await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(learningQueueService.createSuggestion).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent miss', async () => {
      const mockClient = createMockClient({
        missedOpp: { data: null, error: { message: 'Not found', code: 'PGRST116' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        service.analyzeMissedOpportunity('nonexistent', mockExecutionContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include rejected signals in analysis', async () => {
      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(result.signalsWeHad).toContain('sig-1');
      expect(result.signalsWeHad).toContain('sig-2');
    });

    it('should generate tool suggestions based on source gaps', async () => {
      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(result.toolSuggestions).toBeDefined();
      expect(Array.isArray(result.toolSuggestions)).toBe(true);
    });
  });

  describe('generateToolSuggestions', () => {
    it('should generate social media tool suggestion', () => {
      const analysis = {
        sourceGaps: ['Social media sentiment monitoring'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'social_media')).toBe(true);
    });

    it('should generate news tool suggestion', () => {
      const analysis = {
        sourceGaps: ['Real-time news feed'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'news_aggregator')).toBe(true);
    });

    it('should generate technical analysis tool suggestion', () => {
      const analysis = {
        sourceGaps: ['Advanced technical indicators'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'technical_analysis')).toBe(true);
    });

    it('should generate fundamental data tool suggestion', () => {
      const analysis = {
        sourceGaps: ['Fundamental financial metrics'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'fundamental_data')).toBe(true);
    });

    it('should generate macro data tool suggestion', () => {
      const analysis = {
        sourceGaps: ['Macroeconomic data'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'macro_data')).toBe(true);
    });

    it('should generate custom tool suggestion for unknown gaps', () => {
      const analysis = {
        sourceGaps: ['Some unusual data source'],
      };

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions.some((s) => s.tool_type === 'custom')).toBe(true);
    });

    it('should return empty array when no source gaps', () => {
      const analysis = {};

      const suggestions = service.generateToolSuggestions(analysis);

      expect(suggestions).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle LLM service errors', async () => {
      (llmService.generateResponse as jest.Mock).mockRejectedValue(new Error('LLM unavailable'));

      await expect(
        service.analyzeMissedOpportunity('miss-123', mockExecutionContext),
      ).rejects.toThrow('LLM unavailable');
    });

    it('should handle signals fetch errors', async () => {
      const mockClient = createMockClient({
        signals: { data: null, error: { message: 'Signals fetch failed' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(mockClient);

      await expect(
        service.analyzeMissedOpportunity('miss-123', mockExecutionContext),
      ).rejects.toThrow('Failed to fetch rejected signals');
    });

    it('should handle invalid LLM response gracefully', async () => {
      (llmService.generateResponse as jest.Mock).mockResolvedValue('not valid json');

      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      // Should return empty arrays when parsing fails
      expect(result.discoveredDrivers).toEqual([]);
      expect(result.suggestedLearnings).toEqual([]);
    });

    it('should handle LLM response with markdown code blocks', async () => {
      const markdownResponse = '```json\n' + mockLLMResponse + '\n```';
      (llmService.generateResponse as jest.Mock).mockResolvedValue(markdownResponse);

      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(result.discoveredDrivers.length).toBeGreaterThan(0);
    });
  });

  describe('learning queue integration', () => {
    it('should map learning types correctly', async () => {
      await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      const createCalls = (learningQueueService.createSuggestion as jest.Mock).mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);

      // Check that proper types are passed
      const validTypes = ['rule', 'pattern', 'avoid', 'weight_adjustment', 'threshold'];
      for (const call of createCalls) {
        expect(validTypes).toContain(call[0].suggested_learning_type);
      }
    });

    it('should map scope levels correctly', async () => {
      await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      const createCalls = (learningQueueService.createSuggestion as jest.Mock).mock.calls;
      expect(createCalls.length).toBeGreaterThan(0);

      const validScopes = ['runner', 'domain', 'universe', 'target'];
      for (const call of createCalls) {
        expect(validScopes).toContain(call[0].suggested_scope_level);
      }
    });

    it('should handle learning queue errors gracefully', async () => {
      (learningQueueService.createSuggestion as jest.Mock).mockRejectedValue(
        new Error('Queue error'),
      );

      // Should not throw, just log error
      const result = await service.analyzeMissedOpportunity('miss-123', mockExecutionContext);

      expect(result).toBeDefined();
    });
  });
});
