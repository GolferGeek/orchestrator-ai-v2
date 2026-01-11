/**
 * Financial Asset Predictor Runner Service Tests
 *
 * Tests the FinancialAssetPredictorRunnerService domain-specific implementations.
 * Verifies correct tool initialization, specialist contexts, evaluator contexts,
 * and conditional logic for crypto vs traditional instruments.
 */

import { FinancialAssetPredictorRunnerService } from '../financial-asset-predictor-runner.service';
import { PostgresCheckpointerService } from '../../base/postgres-checkpointer.service';
import { ObservabilityEventsService } from '../../../../../observability/observability-events.service';
import { YahooFinanceTool } from '../tools/yahoo-finance.tool';
import { BinanceTool } from '../tools/binance.tool';
import { CoinGeckoTool } from '../tools/coingecko.tool';
import type { EnrichedClaimBundle } from '../../base/base-prediction.types';

// Mock dependencies
jest.mock('../../base/postgres-checkpointer.service');
jest.mock('../../../../../observability/observability-events.service');

// Mock Alpha Vantage factory
jest.mock('../tools/alpha-vantage.tool', () => ({
  ...jest.requireActual('../tools/alpha-vantage.tool'),
  createAlphaVantageTool: jest.fn(() => null), // Default: no API key
}));

// Mock Etherscan factory
jest.mock('../tools/etherscan.tool', () => ({
  ...jest.requireActual('../tools/etherscan.tool'),
  createEtherscanTool: jest.fn(() => null), // Default: no API key
}));

describe('FinancialAssetPredictorRunnerService', () => {
  let service: FinancialAssetPredictorRunnerService;
  let mockCheckpointer: jest.Mocked<PostgresCheckpointerService>;
  let mockObservability: jest.Mocked<ObservabilityEventsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckpointer = new PostgresCheckpointerService(
      null as unknown as ConstructorParameters<
        typeof PostgresCheckpointerService
      >[0],
    ) as jest.Mocked<PostgresCheckpointerService>;
    mockObservability = new ObservabilityEventsService(
      null as unknown as ConstructorParameters<
        typeof ObservabilityEventsService
      >[0],
      null as unknown as ConstructorParameters<
        typeof ObservabilityEventsService
      >[1],
    ) as jest.Mocked<ObservabilityEventsService>;

    service = FinancialAssetPredictorRunnerService.create(
      mockCheckpointer,
      mockObservability,
    );
  });

  describe('basic properties', () => {
    it('should have correct runner type', () => {
      expect(service.runnerType).toBe('financial-asset-predictor');
    });

    it('should have correct runner name', () => {
      expect(service.runnerName).toBe('Financial Asset Predictor');
    });
  });

  describe('instrument type detection', () => {
    it('should detect crypto instruments by symbol', () => {
      service.setCurrentInstruments(['BTC', 'ETH', 'SOL']);
      expect(service.hasCryptoInstruments()).toBe(true);
      expect(service.hasTraditionalInstruments()).toBe(false);
    });

    it('should detect traditional instruments by symbol', () => {
      service.setCurrentInstruments(['AAPL', 'TSLA', 'MSFT']);
      expect(service.hasCryptoInstruments()).toBe(false);
      expect(service.hasTraditionalInstruments()).toBe(true);
    });

    it('should detect mixed instruments', () => {
      service.setCurrentInstruments(['AAPL', 'BTC', 'TSLA', 'ETH']);
      expect(service.hasCryptoInstruments()).toBe(true);
      expect(service.hasTraditionalInstruments()).toBe(true);
    });

    it('should detect crypto by Binance format', () => {
      service.setCurrentInstruments(['BTCUSDT', 'ETHBUSD']);
      expect(service.hasCryptoInstruments()).toBe(true);
    });

    it('should detect crypto by name', () => {
      service.setCurrentInstruments(['bitcoin', 'ethereum']);
      expect(service.hasCryptoInstruments()).toBe(true);
    });
  });

  describe('tools - traditional instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['AAPL', 'TSLA']);
    });

    it('should include Yahoo Finance tool for stocks', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const yahooTool = tools.find(
        (t) => (t as { name: string }).name === 'yahoo-finance',
      );
      expect(yahooTool).toBeDefined();
      expect(yahooTool).toBeInstanceOf(YahooFinanceTool);
    });

    it('should NOT include crypto tools for stocks only', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const binanceTool = tools.find(
        (t) => (t as { name: string }).name === 'binance',
      );
      expect(binanceTool).toBeUndefined();
    });
  });

  describe('tools - crypto instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['BTC', 'ETH']);
    });

    it('should include Binance tool for crypto', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const binanceTool = tools.find(
        (t) => (t as { name: string }).name === 'binance',
      );
      expect(binanceTool).toBeDefined();
      expect(binanceTool).toBeInstanceOf(BinanceTool);
    });

    it('should include CoinGecko tool for crypto', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const coingeckoTool = tools.find(
        (t) => (t as { name: string }).name === 'coingecko',
      );
      expect(coingeckoTool).toBeDefined();
      expect(coingeckoTool).toBeInstanceOf(CoinGeckoTool);
    });

    it('should NOT include stock tools for crypto only', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const yahooTool = tools.find(
        (t) => (t as { name: string }).name === 'yahoo-finance',
      );
      expect(yahooTool).toBeUndefined();
    });
  });

  describe('tools - mixed instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['AAPL', 'BTC', 'TSLA', 'ETH']);
    });

    it('should include both stock and crypto tools', () => {
      const tools = (
        service as unknown as { getTools(): unknown[] }
      ).getTools();

      const yahooTool = tools.find(
        (t) => (t as { name: string }).name === 'yahoo-finance',
      );
      const binanceTool = tools.find(
        (t) => (t as { name: string }).name === 'binance',
      );

      expect(yahooTool).toBeDefined();
      expect(binanceTool).toBeDefined();
    });
  });

  describe('specialist contexts - traditional instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['AAPL', 'TSLA']);
    });

    it('should include technical analyst', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'technical-analyst'),
      ).toBeDefined();
    });

    it('should include sentiment analyst', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'sentiment-analyst'),
      ).toBeDefined();
    });

    it('should include fundamental analyst for stocks', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'fundamental-analyst'),
      ).toBeDefined();
    });

    it('should include news analyst for stocks', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'news-analyst'),
      ).toBeDefined();
    });

    it('should NOT include crypto-specific analysts for stocks', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'onchain-analyst'),
      ).toBeUndefined();
      expect(
        contexts.find((c) => c.specialist === 'defi-analyst'),
      ).toBeUndefined();
    });
  });

  describe('specialist contexts - crypto instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['BTC', 'ETH']);
    });

    it('should include on-chain analyst for crypto', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'onchain-analyst'),
      ).toBeDefined();
    });

    it('should include DeFi analyst for crypto', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'defi-analyst'),
      ).toBeDefined();
    });

    it('should NOT include traditional-only analysts for crypto', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      expect(
        contexts.find((c) => c.specialist === 'fundamental-analyst'),
      ).toBeUndefined();
      expect(
        contexts.find((c) => c.specialist === 'news-analyst'),
      ).toBeUndefined();
    });
  });

  describe('specialist contexts - mixed instruments', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['AAPL', 'BTC']);
    });

    it('should include all specialist types for mixed instruments', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { specialist: string }[];
        }
      ).getSpecialistContexts();

      // Shared specialists
      expect(
        contexts.find((c) => c.specialist === 'technical-analyst'),
      ).toBeDefined();
      expect(
        contexts.find((c) => c.specialist === 'sentiment-analyst'),
      ).toBeDefined();

      // Traditional specialists
      expect(
        contexts.find((c) => c.specialist === 'fundamental-analyst'),
      ).toBeDefined();
      expect(
        contexts.find((c) => c.specialist === 'news-analyst'),
      ).toBeDefined();

      // Crypto specialists
      expect(
        contexts.find((c) => c.specialist === 'onchain-analyst'),
      ).toBeDefined();
      expect(
        contexts.find((c) => c.specialist === 'defi-analyst'),
      ).toBeDefined();
    });
  });

  describe('specialist context prompts', () => {
    beforeEach(() => {
      service.setCurrentInstruments(['AAPL', 'BTC']); // Mixed to get all specialists
    });

    it('should have valid system prompts', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): { systemPrompt: string }[];
        }
      ).getSpecialistContexts();

      for (const context of contexts) {
        expect(context.systemPrompt).toBeDefined();
        expect(context.systemPrompt.length).toBeGreaterThan(100);
        expect(context.systemPrompt).toContain('JSON');
      }
    });

    it('should have valid user prompt templates', () => {
      const contexts = (
        service as unknown as {
          getSpecialistContexts(): {
            userPromptTemplate: (bundle: EnrichedClaimBundle) => string;
          }[];
        }
      ).getSpecialistContexts();

      const mockBundle: EnrichedClaimBundle = {
        instrument: 'AAPL',
        currentClaims: [
          {
            type: 'price',
            instrument: 'AAPL',
            value: 175.5,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'volume',
            instrument: 'AAPL',
            value: 50000000,
            confidence: 1,
            timestamp: new Date().toISOString(),
          },
        ],
        sources: ['yahoo-finance'],
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

      for (const context of contexts) {
        const prompt = context.userPromptTemplate(mockBundle);
        expect(prompt).toBeDefined();
        expect(prompt).toContain('AAPL');
      }
    });
  });

  describe('triage contexts', () => {
    it('should provide 2 triage contexts', () => {
      const contexts = (
        service as unknown as { getTriageContexts(): unknown[] }
      ).getTriageContexts();

      expect(contexts.length).toBe(2);
    });

    it('should include risk triage', () => {
      const contexts = (
        service as unknown as { getTriageContexts(): { agent: string }[] }
      ).getTriageContexts();

      expect(contexts.find((c) => c.agent === 'risk-triage')).toBeDefined();
    });

    it('should include opportunity triage', () => {
      const contexts = (
        service as unknown as { getTriageContexts(): { agent: string }[] }
      ).getTriageContexts();

      expect(
        contexts.find((c) => c.agent === 'opportunity-triage'),
      ).toBeDefined();
    });
  });

  describe('evaluator contexts', () => {
    it('should provide 3 evaluator contexts', () => {
      const contexts = (
        service as unknown as { getEvaluatorContexts(): unknown[] }
      ).getEvaluatorContexts();

      expect(contexts.length).toBe(3);
    });

    it('should include contrarian evaluator', () => {
      const contexts = (
        service as unknown as {
          getEvaluatorContexts(): { evaluator: string }[];
        }
      ).getEvaluatorContexts();

      expect(contexts.find((c) => c.evaluator === 'contrarian')).toBeDefined();
    });

    it('should include risk assessor evaluator', () => {
      const contexts = (
        service as unknown as {
          getEvaluatorContexts(): { evaluator: string }[];
        }
      ).getEvaluatorContexts();

      expect(
        contexts.find((c) => c.evaluator === 'risk-assessor'),
      ).toBeDefined();
    });

    it('should include historical pattern evaluator', () => {
      const contexts = (
        service as unknown as {
          getEvaluatorContexts(): { evaluator: string }[];
        }
      ).getEvaluatorContexts();

      expect(
        contexts.find((c) => c.evaluator === 'historical-pattern'),
      ).toBeDefined();
    });

    it('should have correct challenge types', () => {
      const contexts = (
        service as unknown as {
          getEvaluatorContexts(): {
            evaluator: string;
            challengeType: string;
          }[];
        }
      ).getEvaluatorContexts();

      expect(
        contexts.find((c) => c.evaluator === 'contrarian')?.challengeType,
      ).toBe('contrarian');
      expect(
        contexts.find((c) => c.evaluator === 'risk-assessor')?.challengeType,
      ).toBe('risk_assessment');
      expect(
        contexts.find((c) => c.evaluator === 'historical-pattern')
          ?.challengeType,
      ).toBe('historical_pattern');
    });
  });

  describe('risk profiles', () => {
    it('should support 6 risk profiles (traditional + crypto)', () => {
      const profiles = (
        service as unknown as { getRiskProfiles(): string[] }
      ).getRiskProfiles();

      expect(profiles.length).toBe(6);
    });

    it('should include traditional risk profiles', () => {
      const profiles = (
        service as unknown as { getRiskProfiles(): string[] }
      ).getRiskProfiles();

      expect(profiles).toContain('conservative');
      expect(profiles).toContain('moderate');
      expect(profiles).toContain('aggressive');
    });

    it('should include crypto risk profiles', () => {
      const profiles = (
        service as unknown as { getRiskProfiles(): string[] }
      ).getRiskProfiles();

      expect(profiles).toContain('hodler');
      expect(profiles).toContain('trader');
      expect(profiles).toContain('degen');
    });
  });

  describe('factory method', () => {
    it('should create service with dependencies', () => {
      const created = FinancialAssetPredictorRunnerService.create(
        mockCheckpointer,
        mockObservability,
      );

      expect(created).toBeInstanceOf(FinancialAssetPredictorRunnerService);
      expect(created.runnerType).toBe('financial-asset-predictor');
    });
  });
});
