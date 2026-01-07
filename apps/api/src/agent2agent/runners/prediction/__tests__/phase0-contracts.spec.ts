/**
 * Phase 0 Contract Tests
 *
 * Validates that core types, interfaces, and registry work correctly.
 * These are "smoke tests" to verify the contracts compile and function.
 */

import { RUNNER_REGISTRY, IPredictionRunner } from '../runner.registry';
import { DefaultClaimProcessor } from '../base/default-claim-processor';
import {
  hasPredictionRunnerConfig,
  extractRunnerConfig,
  getStageModel,
  DEFAULT_PREFILTER_THRESHOLDS,
  DEFAULT_POLL_INTERVALS,
} from '../base/agent-metadata.types';
import type {
  Claim,
  Datapoint,
  PredictionRunnerConfig,
} from '../base/base-prediction.types';

describe('Phase 0: Contracts', () => {
  describe('RUNNER_REGISTRY', () => {
    beforeEach(() => {
      // Clear registry before each test
      RUNNER_REGISTRY.clear();
    });

    it('should register a runner', () => {
      const mockRunner = class MockRunner implements IPredictionRunner {
        readonly runnerType = 'stock-predictor' as const;
        readonly runnerName = 'Mock Stock Predictor';
      };

      RUNNER_REGISTRY.register({
        type: 'stock-predictor',
        runnerClass: mockRunner,
        name: 'Mock Stock Predictor',
        description: 'Test runner',
        requiredTools: ['yahoo-finance'],
        defaultPollIntervalMs: 60000,
        supportedRiskProfiles: ['moderate'],
      });

      expect(RUNNER_REGISTRY.has('stock-predictor')).toBe(true);
      expect(RUNNER_REGISTRY.get('stock-predictor')?.name).toBe(
        'Mock Stock Predictor',
      );
    });

    it('should throw on duplicate registration', () => {
      const mockRunner = class MockRunner implements IPredictionRunner {
        readonly runnerType = 'stock-predictor' as const;
        readonly runnerName = 'Mock';
      };

      RUNNER_REGISTRY.register({
        type: 'stock-predictor',
        runnerClass: mockRunner,
        name: 'First',
        description: 'First',
        requiredTools: [],
        defaultPollIntervalMs: 60000,
        supportedRiskProfiles: [],
      });

      expect(() => {
        RUNNER_REGISTRY.register({
          type: 'stock-predictor',
          runnerClass: mockRunner,
          name: 'Second',
          description: 'Second',
          requiredTools: [],
          defaultPollIntervalMs: 60000,
          supportedRiskProfiles: [],
        });
      }).toThrow(/already registered/);
    });

    it('should list all registered types', () => {
      const mockRunner1 = class Mock1 implements IPredictionRunner {
        readonly runnerType = 'stock-predictor' as const;
        readonly runnerName = 'Mock1';
      };
      const mockRunner2 = class Mock2 implements IPredictionRunner {
        readonly runnerType = 'crypto-predictor' as const;
        readonly runnerName = 'Mock2';
      };

      RUNNER_REGISTRY.register({
        type: 'stock-predictor',
        runnerClass: mockRunner1,
        name: 'Stock',
        description: '',
        requiredTools: [],
        defaultPollIntervalMs: 60000,
        supportedRiskProfiles: [],
      });

      RUNNER_REGISTRY.register({
        type: 'crypto-predictor',
        runnerClass: mockRunner2,
        name: 'Crypto',
        description: '',
        requiredTools: [],
        defaultPollIntervalMs: 30000,
        supportedRiskProfiles: [],
      });

      const types = RUNNER_REGISTRY.getTypes();
      expect(types).toContain('stock-predictor');
      expect(types).toContain('crypto-predictor');
      expect(types.length).toBe(2);
    });
  });

  describe('DefaultClaimProcessor', () => {
    let processor: DefaultClaimProcessor;

    beforeEach(() => {
      processor = new DefaultClaimProcessor();
    });

    it('should group claims by instrument', () => {
      const datapoint: Datapoint = {
        id: 'dp-1',
        agentId: 'agent-1',
        timestamp: new Date().toISOString(),
        sources: [
          {
            tool: 'yahoo-finance',
            fetchedAt: new Date().toISOString(),
            claims: [
              {
                type: 'price',
                instrument: 'AAPL',
                value: 150,
                confidence: 1,
                timestamp: new Date().toISOString(),
              },
              {
                type: 'price',
                instrument: 'MSFT',
                value: 300,
                confidence: 1,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        ],
        allClaims: [
          {
            type: 'price',
            instrument: 'AAPL',
            value: 150,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'volume',
            instrument: 'AAPL',
            value: 1000000,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'price',
            instrument: 'MSFT',
            value: 300,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
        ],
        instruments: ['AAPL', 'MSFT'],
        metadata: {
          durationMs: 100,
          toolsSucceeded: 1,
          toolsFailed: 0,
          toolStatus: { 'yahoo-finance': 'success' },
        },
      };

      const bundles = processor.groupClaims(datapoint);

      expect(bundles.length).toBe(2);

      const aaplBundle = bundles.find((b) => b.instrument === 'AAPL');
      expect(aaplBundle).toBeDefined();
      expect(aaplBundle?.currentClaims.length).toBe(2);

      const msftBundle = bundles.find((b) => b.instrument === 'MSFT');
      expect(msftBundle).toBeDefined();
      expect(msftBundle?.currentClaims.length).toBe(1);
    });

    it('should calculate claims diff', () => {
      const currentClaims: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 155,
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'news',
          instrument: 'AAPL',
          value: 'New product launch',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
        },
      ];

      const historicalClaims: Claim[] = [
        {
          type: 'price',
          instrument: 'AAPL',
          value: 150,
          confidence: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      const diff = processor.calculateClaimsDiff(
        currentClaims,
        historicalClaims,
      );

      expect(diff.newClaims.length).toBe(1); // news claim is new
      expect(diff.newClaims[0]?.type).toBe('news');
      expect(diff.changedClaims.length).toBe(1); // price changed
      expect(diff.changedClaims[0]?.claim.type).toBe('price');
      expect(diff.changedClaims[0]?.changePercent).toBeCloseTo(3.33, 1); // (155-150)/150 * 100
    });

    it('should determine if bundle should proceed to specialists', () => {
      const bundle = {
        instrument: 'AAPL',
        currentClaims: [
          {
            type: 'price' as const,
            instrument: 'AAPL',
            value: 155,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
        ],
        sources: ['yahoo-finance'],
        historicalClaims: [],
        claimsDiff: {
          newClaims: [],
          changedClaims: [
            {
              claim: {
                type: 'price' as const,
                instrument: 'AAPL',
                value: 155,
                confidence: 1,
                timestamp: new Date().toISOString(),
              },
              previousValue: 150,
              changePercent: 3.33,
            },
          ],
          removedClaims: [],
          significanceScore: 0.5,
        },
        shouldProceed: false,
        proceedReason: undefined,
      };

      const thresholds = {
        minPriceChangePercent: 2,
        minSentimentShift: 0.2,
        minSignificanceScore: 0.3,
      };

      const result = processor.shouldProceedToSpecialists(bundle, thresholds);

      expect(result.shouldProceed).toBe(true);
      expect(result.proceedReason).toContain('Significance score');
    });
  });

  describe('Agent Metadata Types', () => {
    it('should validate prediction runner config', () => {
      const validMetadata = {
        description: 'Test agent',
        runnerConfig: {
          runner: 'stock-predictor',
          instruments: ['AAPL'],
          riskProfile: 'moderate',
          pollIntervalMs: 60000,
          preFilterThresholds: {
            minPriceChangePercent: 2,
            minSentimentShift: 0.2,
            minSignificanceScore: 0.3,
          },
        },
      };

      expect(hasPredictionRunnerConfig(validMetadata)).toBe(true);
    });

    it('should reject invalid metadata', () => {
      expect(hasPredictionRunnerConfig(null)).toBe(false);
      expect(hasPredictionRunnerConfig({})).toBe(false);
      expect(hasPredictionRunnerConfig({ runnerConfig: {} })).toBe(false);
      expect(
        hasPredictionRunnerConfig({
          runnerConfig: { runner: 'stock-predictor' },
        }),
      ).toBe(false);
    });

    it('should extract runner config', () => {
      const metadata = {
        runnerConfig: {
          runner: 'stock-predictor',
          instruments: ['AAPL', 'MSFT'],
          riskProfile: 'moderate',
          pollIntervalMs: 60000,
          preFilterThresholds: {
            minPriceChangePercent: 2,
            minSentimentShift: 0.2,
            minSignificanceScore: 0.3,
          },
        },
      };

      const config = extractRunnerConfig(metadata, 'test-agent');
      expect(config.runner).toBe('stock-predictor');
      expect(config.instruments).toEqual(['AAPL', 'MSFT']);
    });

    it('should get stage model config', () => {
      const config: PredictionRunnerConfig = {
        runner: 'stock-predictor',
        instruments: ['AAPL'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.2,
          minSignificanceScore: 0.3,
        },
        modelConfig: {
          triage: {
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            temperature: 0.3,
          },
          specialists: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-20250514',
          },
        },
      };

      const triageModel = getStageModel(config, 'triage');
      expect(triageModel?.provider).toBe('anthropic');
      expect(triageModel?.model).toBe('claude-3-5-haiku-20241022');
      expect(triageModel?.temperature).toBe(0.3);

      const evaluatorModel = getStageModel(config, 'evaluators');
      expect(evaluatorModel).toBeUndefined(); // Not configured
    });

    it('should have default thresholds for all runner types', () => {
      expect(DEFAULT_PREFILTER_THRESHOLDS['stock-predictor']).toBeDefined();
      expect(DEFAULT_PREFILTER_THRESHOLDS['crypto-predictor']).toBeDefined();
      expect(DEFAULT_PREFILTER_THRESHOLDS['market-predictor']).toBeDefined();
      expect(DEFAULT_PREFILTER_THRESHOLDS['election-predictor']).toBeDefined();
    });

    it('should have default poll intervals for all runner types', () => {
      expect(DEFAULT_POLL_INTERVALS['stock-predictor']).toBe(60000);
      expect(DEFAULT_POLL_INTERVALS['crypto-predictor']).toBe(30000);
      expect(DEFAULT_POLL_INTERVALS['market-predictor']).toBe(300000);
      expect(DEFAULT_POLL_INTERVALS['election-predictor']).toBe(3600000);
    });
  });
});
