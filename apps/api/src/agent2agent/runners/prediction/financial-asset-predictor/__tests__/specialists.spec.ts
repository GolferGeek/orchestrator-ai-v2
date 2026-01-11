/**
 * Specialist Context Tests
 *
 * Tests for the specialist context provider functions.
 * Verifies that each specialist returns valid SpecialistContext objects
 * with correct prompts and templates.
 */

import {
  getTechnicalAnalystContext,
  getSentimentAnalystContext,
  getFundamentalAnalystContext,
  getNewsAnalystContext,
  getOnChainAnalystContext,
  getDeFiAnalystContext,
} from '../specialists';
import type { EnrichedClaimBundle } from '../../base/base-prediction.types';

describe('Specialist Context Providers', () => {
  const mockBundle: EnrichedClaimBundle = {
    instrument: 'TEST',
    currentClaims: [
      {
        type: 'price',
        instrument: 'TEST',
        value: 100,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
      {
        type: 'volume',
        instrument: 'TEST',
        value: 1000000,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
      {
        type: 'market_cap',
        instrument: 'TEST',
        value: 1000000000,
        confidence: 1,
        timestamp: new Date().toISOString(),
      },
    ],
    sources: ['test-source'],
    historicalClaims: [],
    claimsDiff: {
      newClaims: [],
      changedClaims: [],
      removedClaims: [],
      significanceScore: 0.5,
    },
    shouldProceed: true,
    proceedReason: 'Test',
  };

  describe('getTechnicalAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getTechnicalAnalystContext();

      expect(context.specialist).toBe('technical-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getTechnicalAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
      expect(context.systemPrompt).toContain('conclusion');
      expect(context.systemPrompt).toContain('confidence');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getTechnicalAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
      expect(prompt).toContain('technical');
    });

    it('should mention technical analysis topics', () => {
      const context = getTechnicalAnalystContext();

      expect(context.systemPrompt).toContain('technical');
      expect(context.systemPrompt).toContain('RSI');
      expect(context.systemPrompt).toContain('MACD');
    });
  });

  describe('getSentimentAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getSentimentAnalystContext();

      expect(context.specialist).toBe('sentiment-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getSentimentAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getSentimentAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
      expect(prompt).toContain('sentiment');
    });

    it('should mention sentiment analysis topics', () => {
      const context = getSentimentAnalystContext();

      expect(context.systemPrompt).toContain('sentiment');
      expect(context.systemPrompt).toContain('FOMO');
    });
  });

  describe('getFundamentalAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getFundamentalAnalystContext();

      expect(context.specialist).toBe('fundamental-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getFundamentalAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getFundamentalAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
      expect(prompt).toContain('fundamental');
    });

    it('should mention fundamental analysis topics', () => {
      const context = getFundamentalAnalystContext();

      expect(context.systemPrompt).toContain('valuation');
      expect(context.systemPrompt).toContain('P/E');
    });
  });

  describe('getNewsAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getNewsAnalystContext();

      expect(context.specialist).toBe('news-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getNewsAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getNewsAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
    });

    it('should mention news analysis topics', () => {
      const context = getNewsAnalystContext();

      expect(context.systemPrompt).toContain('news');
      expect(context.systemPrompt.toLowerCase()).toContain('earnings');
    });
  });

  describe('getOnChainAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getOnChainAnalystContext();

      expect(context.specialist).toBe('onchain-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getOnChainAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getOnChainAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
      expect(prompt).toContain('on-chain');
    });

    it('should mention on-chain analysis topics', () => {
      const context = getOnChainAnalystContext();

      expect(context.systemPrompt).toContain('whale');
      expect(context.systemPrompt).toContain('gas');
    });
  });

  describe('getDeFiAnalystContext', () => {
    it('should return a valid specialist context', () => {
      const context = getDeFiAnalystContext();

      expect(context.specialist).toBe('defi-analyst');
      expect(context.systemPrompt).toBeDefined();
      expect(context.systemPrompt.length).toBeGreaterThan(100);
      expect(typeof context.userPromptTemplate).toBe('function');
    });

    it('should include JSON output format in system prompt', () => {
      const context = getDeFiAnalystContext();

      expect(context.systemPrompt).toContain('JSON');
    });

    it('should generate valid user prompt with instrument name', () => {
      const context = getDeFiAnalystContext();
      const prompt = context.userPromptTemplate(mockBundle);

      expect(prompt).toContain('TEST');
      expect(prompt).toContain('DeFi');
    });

    it('should mention DeFi analysis topics', () => {
      const context = getDeFiAnalystContext();

      expect(context.systemPrompt).toContain('TVL');
      expect(context.systemPrompt).toContain('liquidity');
    });
  });

  describe('all specialists', () => {
    const allSpecialists = [
      { name: 'technical-analyst', fn: getTechnicalAnalystContext },
      { name: 'sentiment-analyst', fn: getSentimentAnalystContext },
      { name: 'fundamental-analyst', fn: getFundamentalAnalystContext },
      { name: 'news-analyst', fn: getNewsAnalystContext },
      { name: 'onchain-analyst', fn: getOnChainAnalystContext },
      { name: 'defi-analyst', fn: getDeFiAnalystContext },
    ];

    it.each(allSpecialists)(
      '$name should have required SpecialistContext properties',
      ({ fn }) => {
        const context = fn();

        expect(context).toHaveProperty('specialist');
        expect(context).toHaveProperty('systemPrompt');
        expect(context).toHaveProperty('userPromptTemplate');
        expect(typeof context.specialist).toBe('string');
        expect(typeof context.systemPrompt).toBe('string');
        expect(typeof context.userPromptTemplate).toBe('function');
      },
    );

    it.each(allSpecialists)(
      '$name userPromptTemplate should not throw with valid bundle',
      ({ fn }) => {
        const context = fn();

        expect(() => context.userPromptTemplate(mockBundle)).not.toThrow();
      },
    );
  });
});
