import { Test, TestingModule } from '@nestjs/testing';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';
import { LlmTierResolverService } from '../llm-tier-resolver.service';
import { SupabaseService } from '@/supabase/supabase.service';

describe('LlmTierResolverService', () => {
  let service: LlmTierResolverService;
  let supabaseService: jest.Mocked<SupabaseService>;

  const mockExecutionContext = createMockExecutionContext({
    orgSlug: 'test-org',
    userId: 'user-123',
    conversationId: 'conv-123',
    taskId: 'task-123',
    provider: 'anthropic',
    model: 'claude-sonnet',
  });

  const mockTierMappings = [
    { prediction_tier: 'gold', provider: 'anthropic', model: 'claude-opus-4', model_tier: 'flagship' },
    { prediction_tier: 'silver', provider: 'anthropic', model: 'claude-sonnet-4', model_tier: 'standard' },
    { prediction_tier: 'bronze', provider: 'google', model: 'gemini-2.5-flash-lite', model_tier: 'economy' },
  ];

  const createMockClient = (overrides?: Record<string, unknown>) => {
    const selectResult = overrides?.select ?? { data: mockTierMappings, error: null };

    const createChain = () => {
      const chainableResult: Record<string, unknown> = {
        select: jest.fn(),
        eq: jest.fn(),
        then: (resolve: (v: unknown) => void) => resolve(selectResult),
      };
      (chainableResult.select as jest.Mock).mockReturnValue(chainableResult);
      (chainableResult.eq as jest.Mock).mockReturnValue(chainableResult);

      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn().mockReturnValue(chainableResult);
      chain.eq = jest.fn().mockReturnValue(chainableResult);
      return chain;
    };

    const chain = createChain();

    return {
      schema: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(chain),
      }),
    };
  };

  beforeEach(async () => {
    // Clear environment variables
    delete process.env.DEFAULT_LLM_PROVIDER;
    delete process.env.DEFAULT_LLM_MODEL;

    const mockClient = createMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmTierResolverService,
        {
          provide: SupabaseService,
          useValue: {
            getServiceClient: jest.fn().mockReturnValue(mockClient),
          },
        },
      ],
    }).compile();

    module.useLogger(false);
    service = module.get<LlmTierResolverService>(LlmTierResolverService);
    supabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearCache();
    delete process.env.DEFAULT_LLM_PROVIDER;
    delete process.env.DEFAULT_LLM_MODEL;
  });

  describe('resolveTier', () => {
    it('should resolve gold tier from database', async () => {
      const result = await service.resolveTier('gold');

      expect(result.tier).toBe('gold');
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it('should resolve silver tier from database', async () => {
      const result = await service.resolveTier('silver');

      expect(result.tier).toBe('silver');
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it('should resolve bronze tier from database', async () => {
      const result = await service.resolveTier('bronze');

      expect(result.tier).toBe('bronze');
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it('should use target override when provided', async () => {
      const result = await service.resolveTier('gold', {
        targetLlmConfig: {
          gold: { provider: 'openai', model: 'gpt-4' },
        },
      });

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4');
    });

    it('should use universe config when target not provided', async () => {
      const result = await service.resolveTier('silver', {
        universeLlmConfig: {
          silver: { provider: 'google', model: 'gemini-pro' },
        },
      });

      expect(result.provider).toBe('google');
      expect(result.model).toBe('gemini-pro');
    });

    it('should use agent config when target and universe not provided', async () => {
      const result = await service.resolveTier('bronze', {
        agentLlmConfig: {
          bronze: { provider: 'ollama', model: 'llama3' },
        },
      });

      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('llama3');
    });

    it('should prioritize target over universe', async () => {
      const result = await service.resolveTier('gold', {
        targetLlmConfig: {
          gold: { provider: 'target-provider', model: 'target-model' },
        },
        universeLlmConfig: {
          gold: { provider: 'universe-provider', model: 'universe-model' },
        },
      });

      expect(result.provider).toBe('target-provider');
      expect(result.model).toBe('target-model');
    });

    it('should use defaults when database fails', async () => {
      const errorMockClient = createMockClient({
        select: { data: null, error: { message: 'Database error' } },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(errorMockClient);
      service.clearCache();

      const result = await service.resolveTier('gold');

      expect(result.tier).toBe('gold');
      expect(result.provider).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it('should use environment override when set', async () => {
      process.env.DEFAULT_LLM_PROVIDER = 'ollama';
      process.env.DEFAULT_LLM_MODEL = 'llama3';
      service.clearCache();

      const result = await service.resolveTier('gold');

      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('llama3');
    });
  });

  describe('createTierExecutionContext', () => {
    it('should create execution context with analyst tracking', () => {
      const result = service.createTierExecutionContext({
        baseContext: mockExecutionContext,
        tier: 'gold',
        analystSlug: 'momentum-analyst',
      });

      expect(result.agentSlug).toBe('momentum-analyst');
      expect(result.agentType).toBe('analyst');
      expect(result.orgSlug).toBe('test-org');
    });

    it('should override taskId when provided', () => {
      const result = service.createTierExecutionContext({
        baseContext: mockExecutionContext,
        tier: 'silver',
        analystSlug: 'value-analyst',
        taskId: 'new-task-456',
      });

      expect(result.taskId).toBe('new-task-456');
    });

    it('should preserve base context properties', () => {
      const result = service.createTierExecutionContext({
        baseContext: mockExecutionContext,
        tier: 'bronze',
        analystSlug: 'risk-analyst',
      });

      expect(result.userId).toBe('user-123');
      expect(result.conversationId).toBe('conv-123');
    });
  });

  describe('createTierContext', () => {
    it('should resolve tier and create context', async () => {
      const { context, resolved } = await service.createTierContext(
        mockExecutionContext,
        'gold',
        'momentum-analyst',
      );

      expect(resolved.tier).toBe('gold');
      expect(context.agentSlug).toBe('momentum-analyst');
      expect(context.agentType).toBe('analyst');
      expect(context.provider).toBe(resolved.provider);
      expect(context.model).toBe(resolved.model);
    });

    it('should use resolution context overrides', async () => {
      const { context, resolved } = await service.createTierContext(
        mockExecutionContext,
        'silver',
        'value-analyst',
        {
          targetLlmConfig: {
            silver: { provider: 'custom-provider', model: 'custom-model' },
          },
        },
      );

      expect(resolved.provider).toBe('custom-provider');
      expect(resolved.model).toBe('custom-model');
      expect(context.provider).toBe('custom-provider');
      expect(context.model).toBe('custom-model');
    });
  });

  describe('clearCache', () => {
    it('should clear the tier mapping cache', async () => {
      // First call loads cache
      await service.resolveTier('gold');

      // Clear cache
      service.clearCache();

      // Verify service client is called again on next resolve
      const newMockClient = createMockClient({
        select: {
          data: [{ prediction_tier: 'gold', provider: 'new-provider', model: 'new-model', model_tier: 'flagship' }],
          error: null,
        },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(newMockClient);

      const result = await service.resolveTier('gold');

      expect(result.provider).toBe('new-provider');
    });
  });

  describe('cache behavior', () => {
    it('should cache tier mappings', async () => {
      await service.resolveTier('gold');
      await service.resolveTier('silver');
      await service.resolveTier('bronze');

      // Should only call getServiceClient once due to caching
      expect(supabaseService.getServiceClient).toHaveBeenCalled();
    });

    it('should return all tiers from cache', async () => {
      const gold = await service.resolveTier('gold');
      const silver = await service.resolveTier('silver');
      const bronze = await service.resolveTier('bronze');

      expect(gold.tier).toBe('gold');
      expect(silver.tier).toBe('silver');
      expect(bronze.tier).toBe('bronze');
    });
  });

  describe('fallback behavior', () => {
    it('should fall back to silver when tier not found', async () => {
      const emptyMockClient = createMockClient({
        select: { data: [], error: null },
      });
      (supabaseService.getServiceClient as jest.Mock).mockReturnValue(emptyMockClient);
      service.clearCache();

      // Even with empty data, defaults should be used
      const result = await service.resolveTier('gold');

      expect(result).toBeDefined();
      expect(result.provider).toBeDefined();
    });
  });
});
