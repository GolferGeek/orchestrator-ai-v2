import { Test, TestingModule } from '@nestjs/testing';
import {
  AnalystPromptBuilderService,
  PromptContext,
  ComposedPromptContext,
} from '../analyst-prompt-builder.service';
import {
  ActiveAnalyst,
  PersonalityAnalyst,
  ContextProvider,
} from '../../interfaces/analyst.interface';
import { Target } from '../../interfaces/target.interface';
import { ActiveLearning } from '../../interfaces/learning.interface';

describe('AnalystPromptBuilderService', () => {
  let service: AnalystPromptBuilderService;

  const mockAnalyst: ActiveAnalyst = {
    analyst_id: 'analyst-123',
    slug: 'momentum-analyst',
    name: 'Momentum Analyst',
    perspective:
      'I analyze price momentum and trend patterns to identify trading opportunities.',
    effective_weight: 1.0,
    effective_tier: 'gold',
    tier_instructions: {
      gold: 'Provide detailed analysis with multiple timeframes and technical indicators.',
      silver: 'Provide balanced analysis with key momentum indicators.',
      bronze: 'Provide quick assessment of momentum direction.',
    },
    learned_patterns: [],
    scope_level: 'runner',
  };

  const mockPersonalityAnalyst: PersonalityAnalyst = {
    analyst_id: 'pa-123',
    slug: 'technical-trader',
    name: 'Technical Trader',
    perspective:
      'I use technical analysis to make trading decisions based on chart patterns and indicators.',
    default_weight: 1.0,
    tier_instructions: {
      gold: 'Comprehensive technical analysis with multiple indicators and patterns.',
      silver: 'Balanced technical analysis with primary indicators.',
      bronze: 'Quick technical assessment.',
    },
  };

  const mockContextProvider: ContextProvider = {
    slug: 'crypto-domain-expert',
    name: 'Crypto Domain Expert',
    scope_level: 'domain',
    perspective:
      'Expert knowledge in cryptocurrency markets and blockchain technology.',
    tier_instructions: {
      gold: 'Deep dive into on-chain metrics and protocol specifics.',
      silver: 'Key market dynamics and protocol overview.',
      bronze: 'Basic crypto market context.',
    },
  };

  const mockTarget: Target = {
    id: 'target-123',
    universe_id: 'universe-123',
    symbol: 'BTC',
    name: 'Bitcoin',
    target_type: 'crypto',
    context: 'Leading cryptocurrency by market cap.',
    metadata: {},
    llm_config_override: null,
    is_active: true,
    is_archived: false,
    current_price: 50000,
    price_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockLearning: ActiveLearning = {
    learning_id: 'learning-123',
    learning_type: 'pattern',
    title: 'Momentum Divergence Pattern',
    description:
      'When price makes higher highs but momentum makes lower highs, consider bearish divergence.',
    config: { indicators: ['RSI', 'MACD'] },
    scope_level: 'domain',
    times_applied: 5,
    times_helpful: 4,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalystPromptBuilderService],
    }).compile();

    module.useLogger(false);
    service = module.get<AnalystPromptBuilderService>(
      AnalystPromptBuilderService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildPrompt', () => {
    it('should build prompt with analyst context', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'gold',
        target: mockTarget,
        learnings: [],
        input: {
          content:
            'BTC showing strong momentum after breaking $50k resistance.',
        },
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Momentum Analyst');
      expect(result.systemPrompt).toContain(mockAnalyst.perspective);
      expect(result.systemPrompt).toContain('BTC');
      expect(result.systemPrompt).toContain('Bitcoin');
      expect(result.userPrompt).toContain('BTC showing strong momentum');
    });

    it('should include tier-specific instructions', () => {
      const goldContext: PromptContext = {
        analyst: mockAnalyst,
        tier: 'gold',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const bronzeContext: PromptContext = {
        analyst: mockAnalyst,
        tier: 'bronze',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const goldResult = service.buildPrompt(goldContext);
      const bronzeResult = service.buildPrompt(bronzeContext);

      expect(goldResult.systemPrompt).toContain('multiple timeframes');
      expect(bronzeResult.systemPrompt).toContain('quick assessment');
    });

    it('should include learnings when provided', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings: [mockLearning],
        input: { content: 'Test signal' },
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Applied Learnings');
      expect(result.systemPrompt).toContain('Momentum Divergence Pattern');
      expect(result.systemPrompt).toContain('indicators');
      expect(result.learningIds).toContain('learning-123');
    });

    it('should include direction in user prompt when provided', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: {
          content: 'Test signal',
          direction: 'bullish',
        },
      };

      const result = service.buildPrompt(context);

      // Direction is no longer included in the prompt - analysts provide independent assessment
      expect(result.userPrompt).toContain('Test signal');
      expect(result.userPrompt).toContain('your independent assessment');
    });

    it('should include metadata in user prompt when provided', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: {
          content: 'Test signal',
          metadata: { source: 'news', importance: 'high' },
        },
      };

      const result = service.buildPrompt(context);

      expect(result.userPrompt).toContain('source');
      expect(result.userPrompt).toContain('news');
    });

    it('should include performance context when provided', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'gold',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
        performanceContext:
          '## Recent Performance\nAccuracy: 75%\nLast 10 predictions: 7 correct',
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Recent Performance');
      expect(result.systemPrompt).toContain('Accuracy: 75%');
    });

    it('should include output format in system prompt', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Output Format');
      expect(result.systemPrompt).toContain('"direction"');
      expect(result.systemPrompt).toContain('"confidence"');
      expect(result.systemPrompt).toContain('"reasoning"');
    });

    it('should include direction decision guidelines', () => {
      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Direction Decision Guidelines');
      expect(result.systemPrompt).toContain(
        'Choose "bullish" if your analysis leans even slightly toward upside',
      );
    });
  });

  describe('buildComposedPrompt', () => {
    it('should build composed prompt with personality and context providers', () => {
      const context: ComposedPromptContext = {
        personalityAnalyst: mockPersonalityAnalyst,
        contextProviders: [mockContextProvider],
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal for BTC' },
      };

      const result = service.buildComposedPrompt(context);

      expect(result.systemPrompt).toContain('Technical Trader');
      expect(result.systemPrompt).toContain('Domain Knowledge');
      expect(result.systemPrompt).toContain('BTC');
    });

    it('should include all context providers', () => {
      const universeProvider: ContextProvider = {
        slug: 'large-cap-crypto',
        name: 'Large Cap Crypto Expert',
        scope_level: 'universe',
        perspective: 'Expert in large cap cryptocurrency dynamics.',
        tier_instructions: {
          gold: 'Detailed large cap analysis.',
          silver: 'Key large cap insights.',
          bronze: 'Quick large cap overview.',
        },
      };

      const context: ComposedPromptContext = {
        personalityAnalyst: mockPersonalityAnalyst,
        contextProviders: [mockContextProvider, universeProvider],
        tier: 'silver',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const result = service.buildComposedPrompt(context);

      expect(result.systemPrompt).toContain('Domain Knowledge');
      expect(result.systemPrompt).toContain('Sector/Universe Knowledge');
    });

    it('should include learnings in composed prompt', () => {
      const context: ComposedPromptContext = {
        personalityAnalyst: mockPersonalityAnalyst,
        contextProviders: [mockContextProvider],
        tier: 'gold',
        target: mockTarget,
        learnings: [mockLearning],
        input: { content: 'Test signal' },
      };

      const result = service.buildComposedPrompt(context);

      expect(result.systemPrompt).toContain('Applied Learnings');
      expect(result.learningIds).toContain('learning-123');
    });

    it('should include performance context in composed prompt', () => {
      const context: ComposedPromptContext = {
        personalityAnalyst: mockPersonalityAnalyst,
        contextProviders: [mockContextProvider],
        tier: 'gold',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
        performanceContext: '## Performance Metrics\nWin rate: 68%',
      };

      const result = service.buildComposedPrompt(context);

      expect(result.systemPrompt).toContain('Performance Metrics');
      expect(result.systemPrompt).toContain('Win rate: 68%');
    });

    it('should fallback to silver tier instructions if requested tier not found', () => {
      const analystWithoutGold = {
        ...mockPersonalityAnalyst,
        tier_instructions: {
          silver: 'Silver tier instructions only.',
          bronze: 'Bronze tier.',
        },
      };

      const context: ComposedPromptContext = {
        personalityAnalyst: analystWithoutGold,
        contextProviders: [],
        tier: 'gold',
        target: mockTarget,
        learnings: [],
        input: { content: 'Test signal' },
      };

      const result = service.buildComposedPrompt(context);

      expect(result.systemPrompt).toContain('Silver tier instructions only');
    });
  });

  describe('buildPredictionPrompt', () => {
    it('should build prediction prompt with predictors', () => {
      const predictors = [
        {
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Strong momentum indicators.',
          analyst_slug: 'momentum-analyst',
        },
        {
          direction: 'bullish',
          strength: 6,
          confidence: 0.7,
          reasoning: 'Positive sentiment from news.',
          analyst_slug: 'sentiment-analyst',
        },
      ];

      const result = service.buildPredictionPrompt({
        target: mockTarget,
        predictors,
        learnings: [],
      });

      expect(result.systemPrompt).toContain('prediction synthesis engine');
      expect(result.systemPrompt).toContain('momentum-analyst');
      expect(result.systemPrompt).toContain('sentiment-analyst');
      expect(result.systemPrompt).toContain('Strength: 7');
      expect(result.systemPrompt).toContain('BTC');
    });

    it('should include learnings in prediction prompt', () => {
      const predictors = [
        {
          direction: 'bullish',
          strength: 7,
          confidence: 0.8,
          reasoning: 'Test reasoning.',
          analyst_slug: 'test-analyst',
        },
      ];

      const result = service.buildPredictionPrompt({
        target: mockTarget,
        predictors,
        learnings: [mockLearning],
      });

      expect(result.systemPrompt).toContain('Applied Learnings');
      expect(result.learningIds).toContain('learning-123');
    });

    it('should include output format for predictions', () => {
      const predictors = [
        {
          direction: 'bullish',
          strength: 5,
          confidence: 0.6,
          reasoning: 'Test.',
          analyst_slug: 'test-analyst',
        },
      ];

      const result = service.buildPredictionPrompt({
        target: mockTarget,
        predictors,
        learnings: [],
      });

      expect(result.systemPrompt).toContain('"direction"');
      expect(result.systemPrompt).toContain('"magnitude"');
      expect(result.systemPrompt).toContain('"timeframe_hours"');
    });

    it('should mention number of predictors in user prompt', () => {
      const predictors = [
        {
          direction: 'bullish',
          strength: 5,
          confidence: 0.6,
          reasoning: 'A',
          analyst_slug: 'a',
        },
        {
          direction: 'bearish',
          strength: 4,
          confidence: 0.5,
          reasoning: 'B',
          analyst_slug: 'b',
        },
        {
          direction: 'neutral',
          strength: 3,
          confidence: 0.4,
          reasoning: 'C',
          analyst_slug: 'c',
        },
      ];

      const result = service.buildPredictionPrompt({
        target: mockTarget,
        predictors,
        learnings: [],
      });

      expect(result.userPrompt).toContain('3 active predictors');
    });
  });

  describe('buildReEvaluationPrompt', () => {
    it('should build re-evaluation prompt', () => {
      const result = service.buildReEvaluationPrompt({
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        originalPrediction: {
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Strong momentum indicators suggested upward movement.',
        },
        actualOutcome: 'Price dropped 5% due to unexpected regulatory news.',
        learnings: [],
      });

      expect(result.systemPrompt).toContain('Momentum Analyst');
      expect(result.systemPrompt).toContain('Re-Evaluation Task');
      expect(result.systemPrompt).toContain('Direction: bullish');
      expect(result.systemPrompt).toContain('Confidence: 0.8');
      expect(result.systemPrompt).toContain('Price dropped 5%');
    });

    it('should include learnings in re-evaluation prompt', () => {
      const result = service.buildReEvaluationPrompt({
        analyst: mockAnalyst,
        tier: 'gold',
        target: mockTarget,
        originalPrediction: {
          direction: 'bullish',
          confidence: 0.7,
          reasoning: 'Test.',
        },
        actualOutcome: 'Correct prediction.',
        learnings: [mockLearning],
      });

      expect(result.systemPrompt).toContain('Applied Learnings');
      expect(result.learningIds).toContain('learning-123');
    });

    it('should include output format for re-evaluation', () => {
      const result = service.buildReEvaluationPrompt({
        analyst: mockAnalyst,
        tier: 'bronze',
        target: mockTarget,
        originalPrediction: {
          direction: 'bearish',
          confidence: 0.6,
          reasoning: 'Test.',
        },
        actualOutcome: 'Incorrect.',
        learnings: [],
      });

      expect(result.systemPrompt).toContain('"was_correct"');
      expect(result.systemPrompt).toContain('"what_was_missed"');
      expect(result.systemPrompt).toContain('"suggested_learning"');
    });

    it('should use tier-specific instructions', () => {
      const goldResult = service.buildReEvaluationPrompt({
        analyst: mockAnalyst,
        tier: 'gold',
        target: mockTarget,
        originalPrediction: {
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Test.',
        },
        actualOutcome: 'Test outcome.',
        learnings: [],
      });

      const bronzeResult = service.buildReEvaluationPrompt({
        analyst: mockAnalyst,
        tier: 'bronze',
        target: mockTarget,
        originalPrediction: {
          direction: 'bullish',
          confidence: 0.8,
          reasoning: 'Test.',
        },
        actualOutcome: 'Test outcome.',
        learnings: [],
      });

      expect(goldResult.systemPrompt).toContain('multiple timeframes');
      expect(bronzeResult.systemPrompt).toContain('quick assessment');
    });
  });

  describe('multiple learnings handling', () => {
    it('should include multiple learnings', () => {
      const learnings: ActiveLearning[] = [
        {
          learning_id: 'learning-1',
          learning_type: 'pattern',
          title: 'Learning One',
          description: 'Description one.',
          config: {},
          scope_level: 'domain',
          times_applied: 0,
          times_helpful: 0,
        },
        {
          learning_id: 'learning-2',
          learning_type: 'rule',
          title: 'Learning Two',
          description: 'Description two.',
          config: { trigger_condition: 'test' },
          scope_level: 'target',
          times_applied: 2,
          times_helpful: 1,
        },
      ];

      const context: PromptContext = {
        analyst: mockAnalyst,
        tier: 'silver',
        target: mockTarget,
        learnings,
        input: { content: 'Test signal' },
      };

      const result = service.buildPrompt(context);

      expect(result.systemPrompt).toContain('Learning One');
      expect(result.systemPrompt).toContain('Learning Two');
      expect(result.learningIds).toEqual(['learning-1', 'learning-2']);
    });
  });
});
