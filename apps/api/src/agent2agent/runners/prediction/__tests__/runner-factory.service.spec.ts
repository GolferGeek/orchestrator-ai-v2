/**
 * RunnerFactoryService Tests
 *
 * Tests for the runner factory service that creates prediction runner instances.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RunnerFactoryService, AgentRecord } from '../runner-factory.service';
import {
  RUNNER_REGISTRY,
  IPredictionRunner,
  RunnerRegistryEntry,
} from '../runner.registry';
import {
  RunnerInput,
  RunnerOutput,
  PredictionRunnerType,
} from '../base/base-prediction.types';

// Mock runner implementation for testing
class MockFinancialAssetPredictor implements IPredictionRunner {
  readonly runnerType: PredictionRunnerType = 'financial-asset-predictor';
  readonly runnerName = 'MockFinancialAssetPredictor';

  async execute(_input: RunnerInput): Promise<RunnerOutput> {
    return {
      runId: 'test-run-id',
      agentId: 'test-agent',
      status: 'completed',
      recommendations: [],
      datapoint: {
        id: 'dp-123',
        agentId: 'test-agent',
        timestamp: new Date().toISOString(),
        sources: [],
        allClaims: [],
        instruments: [],
        metadata: {
          durationMs: 100,
          toolsSucceeded: 0,
          toolsFailed: 0,
          toolStatus: {},
        },
      },
      metrics: {
        totalDurationMs: 100,
        stageDurations: {},
        claimsProcessed: 0,
        bundlesProceeded: 0,
        recommendationsGenerated: 0,
      },
    };
  }
}

const mockRunnerEntry: RunnerRegistryEntry = {
  type: 'financial-asset-predictor',
  runnerClass: MockFinancialAssetPredictor,
  name: 'Financial Asset Predictor',
  description: 'Unified predictor for stocks, ETFs, crypto, and forex',
  requiredTools: ['yahoo-finance'],
  defaultPollIntervalMs: 60000,
  supportedRiskProfiles: [
    'conservative',
    'moderate',
    'aggressive',
    'hodler',
    'trader',
    'degen',
  ],
  supportedTargetTypes: ['stock', 'etf', 'crypto', 'forex'],
};

describe('RunnerFactoryService', () => {
  let service: RunnerFactoryService;
  let moduleRef: jest.Mocked<ModuleRef>;

  const createAgentRecord = (
    overrides: Partial<AgentRecord> = {},
  ): AgentRecord => ({
    id: 'agent-123',
    slug: 'test-agent',
    org_slug: 'test-org',
    agent_type: 'prediction',
    metadata: {
      description: 'Test agent',
      runnerConfig: {
        runner: 'financial-asset-predictor',
        instruments: ['AAPL', 'MSFT'],
        riskProfile: 'moderate',
        pollIntervalMs: 60000,
        preFilterThresholds: {
          minPriceChangePercent: 2,
          minSentimentShift: 0.3,
          minSignificanceScore: 0.5,
        },
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Clear and re-register runner for each test
    RUNNER_REGISTRY.clear();
    RUNNER_REGISTRY.register(mockRunnerEntry);

    moduleRef = {
      resolve: jest.fn().mockResolvedValue(new MockFinancialAssetPredictor()),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunnerFactoryService,
        { provide: ModuleRef, useValue: moduleRef },
      ],
    }).compile();

    service = module.get<RunnerFactoryService>(RunnerFactoryService);
  });

  afterEach(() => {
    RUNNER_REGISTRY.clear();
  });

  describe('getRunner', () => {
    it('should create runner instance for valid agent config', async () => {
      const agent = createAgentRecord();

      const runner = await service.getRunner(agent);

      expect(runner).toBeInstanceOf(MockFinancialAssetPredictor);
      expect(runner.runnerType).toBe('financial-asset-predictor');
    });

    it('should resolve runner via NestJS ModuleRef', async () => {
      const agent = createAgentRecord();

      await service.getRunner(agent);

      expect(moduleRef.resolve).toHaveBeenCalledWith(
        MockFinancialAssetPredictor,
      );
    });

    it('should auto-migrate stock-predictor to financial-asset-predictor', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            runner: 'stock-predictor', // Legacy type
            instruments: ['AAPL'],
            riskProfile: 'moderate',
            pollIntervalMs: 60000,
            preFilterThresholds: {
              minPriceChangePercent: 2,
              minSentimentShift: 0.3,
              minSignificanceScore: 0.5,
            },
          },
        },
      });

      const runner = await service.getRunner(agent);

      // Should auto-migrate to financial-asset-predictor
      expect(runner.runnerType).toBe('financial-asset-predictor');
    });

    it('should auto-migrate crypto-predictor to financial-asset-predictor', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            runner: 'crypto-predictor', // Legacy type
            instruments: ['BTC', 'ETH'],
            riskProfile: 'degen',
            pollIntervalMs: 30000,
            preFilterThresholds: {
              minPriceChangePercent: 5,
              minSentimentShift: 0.3,
              minSignificanceScore: 0.25,
            },
          },
        },
      });

      const runner = await service.getRunner(agent);

      // Should auto-migrate to financial-asset-predictor
      expect(runner.runnerType).toBe('financial-asset-predictor');
    });

    it('should throw NotFoundException when runner type not registered', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            runner: 'unknown-runner' as PredictionRunnerType,
            instruments: ['AAPL'],
            riskProfile: 'moderate',
            pollIntervalMs: 60000,
            preFilterThresholds: {
              minPriceChangePercent: 2,
              minSentimentShift: 0.3,
              minSignificanceScore: 0.5,
            },
          },
        },
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
      await expect(service.getRunner(agent)).rejects.toThrow(
        /Runner type 'unknown-runner' is not registered/,
      );
    });

    it('should throw NotFoundException when runnerConfig is missing', async () => {
      const agent = createAgentRecord({
        metadata: {
          description: 'No runner config',
        },
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
      await expect(service.getRunner(agent)).rejects.toThrow(
        /does not have runnerConfig/,
      );
    });

    it('should throw NotFoundException when runner field is missing', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            instruments: ['AAPL'],
            riskProfile: 'moderate',
          } as any,
        },
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
      await expect(service.getRunner(agent)).rejects.toThrow(
        /missing 'runner' field/,
      );
    });

    it('should throw NotFoundException when instruments are missing', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            runner: 'financial-asset-predictor',
            instruments: [],
            riskProfile: 'moderate',
            pollIntervalMs: 60000,
            preFilterThresholds: {
              minPriceChangePercent: 2,
              minSentimentShift: 0.3,
              minSignificanceScore: 0.5,
            },
          },
        },
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
      await expect(service.getRunner(agent)).rejects.toThrow(
        /missing 'instruments' array/,
      );
    });

    it('should throw NotFoundException when riskProfile is missing', async () => {
      const agent = createAgentRecord({
        metadata: {
          runnerConfig: {
            runner: 'financial-asset-predictor',
            instruments: ['AAPL'],
            pollIntervalMs: 60000,
            preFilterThresholds: {
              minPriceChangePercent: 2,
              minSentimentShift: 0.3,
              minSignificanceScore: 0.5,
            },
          } as any,
        },
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
      await expect(service.getRunner(agent)).rejects.toThrow(
        /missing 'riskProfile'/,
      );
    });

    it('should throw NotFoundException when metadata is null', async () => {
      const agent = createAgentRecord({
        metadata: null,
      });

      await expect(service.getRunner(agent)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRunnerEntry', () => {
    it('should return entry for registered runner', () => {
      const entry = service.getRunnerEntry('financial-asset-predictor');

      expect(entry).toBeDefined();
      expect(entry?.name).toBe('Financial Asset Predictor');
      expect(entry?.requiredTools).toContain('yahoo-finance');
    });

    it('should return supported target types for financial-asset-predictor', () => {
      const entry = service.getRunnerEntry('financial-asset-predictor');

      expect(entry).toBeDefined();
      expect(entry?.supportedTargetTypes).toBeDefined();
      expect(entry?.supportedTargetTypes).toContain('stock');
      expect(entry?.supportedTargetTypes).toContain('etf');
      expect(entry?.supportedTargetTypes).toContain('crypto');
      expect(entry?.supportedTargetTypes).toContain('forex');
    });

    it('should return undefined for unregistered runner', () => {
      const entry = service.getRunnerEntry(
        'unknown-runner' as PredictionRunnerType,
      );

      expect(entry).toBeUndefined();
    });
  });

  describe('getAvailableRunners', () => {
    it('should return all registered runners', () => {
      const runners = service.getAvailableRunners();

      expect(runners).toHaveLength(1);
      expect(runners[0]?.type).toBe('financial-asset-predictor');
    });

    it('should return empty array when no runners registered', () => {
      RUNNER_REGISTRY.clear();

      const runners = service.getAvailableRunners();

      expect(runners).toEqual([]);
    });
  });

  describe('isRunnerAvailable', () => {
    it('should return true for registered runner', () => {
      const available = service.isRunnerAvailable('financial-asset-predictor');

      expect(available).toBe(true);
    });

    it('should return false for unregistered runner', () => {
      const available = service.isRunnerAvailable(
        'unknown-runner' as PredictionRunnerType,
      );

      expect(available).toBe(false);
    });
  });
});

describe('RUNNER_REGISTRY', () => {
  beforeEach(() => {
    RUNNER_REGISTRY.clear();
  });

  describe('register', () => {
    it('should register a runner entry', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      expect(RUNNER_REGISTRY.has('financial-asset-predictor')).toBe(true);
    });

    it('should throw error when registering duplicate type', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      expect(() => RUNNER_REGISTRY.register(mockRunnerEntry)).toThrow(
        /already registered/,
      );
    });
  });

  describe('get', () => {
    it('should return registered entry', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      const entry = RUNNER_REGISTRY.get('financial-asset-predictor');

      expect(entry).toEqual(mockRunnerEntry);
    });

    it('should return undefined for unregistered type', () => {
      const entry = RUNNER_REGISTRY.get('unknown' as PredictionRunnerType);

      expect(entry).toBeUndefined();
    });
  });

  describe('getTypes', () => {
    it('should return all registered types', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      const types = RUNNER_REGISTRY.getTypes();

      expect(types).toContain('financial-asset-predictor');
    });
  });

  describe('getAll', () => {
    it('should return all registered entries', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      const entries = RUNNER_REGISTRY.getAll();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(mockRunnerEntry);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      RUNNER_REGISTRY.register(mockRunnerEntry);

      RUNNER_REGISTRY.clear();

      expect(RUNNER_REGISTRY.getAll()).toHaveLength(0);
    });
  });
});
