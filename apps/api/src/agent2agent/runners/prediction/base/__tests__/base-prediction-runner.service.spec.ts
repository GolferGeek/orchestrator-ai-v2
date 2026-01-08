/**
 * BasePredictionRunnerService Tests
 *
 * Tests for the abstract base class for prediction runners.
 * Creates a concrete test implementation to test the base functionality.
 */

import { Logger } from '@nestjs/common';
import {
  BasePredictionRunnerService,
  PredictionTool,
  SpecialistContext,
  TriageContext,
  EvaluatorContext,
} from '../base-prediction-runner.service';
import { PostgresCheckpointerService } from '../postgres-checkpointer.service';
import { IClaimProcessor } from '../claim-processor.interface';
import {
  RunnerInput,
  PredictionRunnerType,
  RiskProfile,
  Source,
  Claim,
  EnrichedClaimBundle,
  ClaimBundle,
  Recommendation,
} from '../base-prediction.types';
import { StateGraph } from '@langchain/langgraph';

// Concrete test implementation
class TestPredictionRunner extends BasePredictionRunnerService {
  readonly runnerType: PredictionRunnerType = 'stock-predictor';
  readonly runnerName = 'TestPredictionRunner';

  protected getTools(): PredictionTool[] {
    return [
      {
        name: 'test-tool',
        description: 'Test tool for data collection',
        execute: jest.fn().mockResolvedValue([
          {
            tool: 'test-tool',
            fetchedAt: '2026-01-07T12:00:00Z',
            claims: [
              {
                type: 'price',
                instrument: 'AAPL',
                value: 178.5,
                confidence: 1.0,
                timestamp: '2026-01-07T12:00:00Z',
              },
            ],
          } as Source,
        ]),
      },
    ];
  }

  protected getSpecialistContexts(): SpecialistContext[] {
    return [
      {
        specialist: 'technical-analyst',
        systemPrompt: 'You are a technical analyst',
        userPromptTemplate: (bundle) => `Analyze ${bundle.instrument}`,
      },
    ];
  }

  protected getTriageContexts(): TriageContext[] {
    return [
      {
        agent: 'triage-agent',
        systemPrompt: 'You are a triage agent',
        userPromptTemplate: (bundle) => `Triage ${bundle.instrument}`,
      },
    ];
  }

  protected getEvaluatorContexts(): EvaluatorContext[] {
    return [
      {
        evaluator: 'contrarian-evaluator',
        challengeType: 'contrarian',
        systemPrompt: 'You are a contrarian evaluator',
        userPromptTemplate: (recs, _analyses) =>
          `Challenge ${recs.length} recommendations`,
      },
    ];
  }

  protected getRiskProfiles(): RiskProfile[] {
    return ['conservative', 'moderate', 'aggressive'];
  }
}

// Mock graph type for testing
interface MockCompiledGraph {
  invoke: jest.Mock;
}

describe('BasePredictionRunnerService', () => {
  let service: TestPredictionRunner;
  let checkpointerService: jest.Mocked<PostgresCheckpointerService>;
  let claimProcessor: jest.Mocked<IClaimProcessor>;
  let mockGraph: MockCompiledGraph;

  const mockInput: RunnerInput = {
    agentId: 'test-agent-id',
    agentSlug: 'test-agent',
    orgSlug: 'test-org',
    config: {
      runner: 'stock-predictor',
      instruments: ['AAPL', 'MSFT'],
      riskProfile: 'moderate',
      pollIntervalMs: 60000,
      preFilterThresholds: {
        minPriceChangePercent: 2,
        minSentimentShift: 0.3,
        minSignificanceScore: 0.5,
      },
    },
    executionContext: {
      taskId: 'test-task-id',
      userId: 'test-user-id',
      conversationId: 'test-conversation-id',
    },
  };

  beforeEach(() => {
    // Mock checkpointer service
    const mockSaver = {
      setup: jest.fn().mockResolvedValue(undefined),
    };

    checkpointerService = {
      getSaver: jest.fn().mockReturnValue(mockSaver),
      getPool: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      healthCheck: jest.fn().mockResolvedValue(true),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as any;

    // Mock claim processor
    claimProcessor = {
      groupClaims: jest.fn().mockReturnValue([
        {
          instrument: 'AAPL',
          currentClaims: [
            {
              type: 'price',
              instrument: 'AAPL',
              value: 178.5,
              confidence: 1.0,
              timestamp: '2026-01-07T12:00:00Z',
            } as Claim,
          ],
          sources: ['test-tool'],
        } as ClaimBundle,
      ]),
      enrichWithHistory: jest.fn().mockResolvedValue([
        {
          instrument: 'AAPL',
          currentClaims: [],
          sources: ['test-tool'],
          historicalClaims: [],
          claimsDiff: {
            newClaims: [],
            changedClaims: [],
            removedClaims: [],
            significanceScore: 0.7,
          },
          shouldProceed: true,
          proceedReason: 'High significance score',
        } as EnrichedClaimBundle,
      ]),
      shouldProceedToSpecialists: jest
        .fn()
        .mockImplementation((bundle: EnrichedClaimBundle) => ({
          ...bundle,
          shouldProceed: true,
          proceedReason: 'Passed thresholds',
        })),
      calculateClaimsDiff: jest.fn().mockReturnValue({
        newClaims: [],
        changedClaims: [],
        removedClaims: [],
        significanceScore: 0.5,
      }),
    };

    // Create service instance
    service = new TestPredictionRunner(checkpointerService, claimProcessor);

    // Mock the compiled graph
    mockGraph = {
      invoke: jest.fn().mockResolvedValue({
        runId: 'test-run-id',
        agentId: 'test-agent-id',
        status: 'completed',
        recommendations: [] as Recommendation[],
        datapoint: {
          id: 'test-datapoint-id',
          agentId: 'test-agent-id',
          timestamp: '2026-01-07T12:00:00Z',
          sources: [],
          allClaims: [],
          instruments: [],
          metadata: {
            durationMs: 100,
            toolsSucceeded: 1,
            toolsFailed: 0,
            toolStatus: {},
          },
        },
        metrics: {
          stageDurations: {},
        },
        errors: [],
      }),
    };

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock buildGraph to return our mock graph
      jest.spyOn(service as any, 'buildGraph').mockReturnValue({
        compile: jest.fn().mockReturnValue(mockGraph),
      });
    });

    it('should return RunnerOutput with correct structure', async () => {
      const result = await service.execute(mockInput);

      expect(result).toHaveProperty('runId');
      expect(result).toHaveProperty('agentId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('datapoint');
      expect(result).toHaveProperty('metrics');

      expect(result.agentId).toBe('test-agent-id');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should call buildGraph and compile with checkpointer', async () => {
      const buildGraphSpy = jest.spyOn(service as any, 'buildGraph');

      await service.execute(mockInput);

      expect(buildGraphSpy).toHaveBeenCalled();
      expect(checkpointerService.getSaver).toHaveBeenCalled();
    });

    it('should invoke graph with initial state and thread_id', async () => {
      await service.execute(mockInput);

      expect(mockGraph.invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'test-agent-id',
          agentSlug: 'test-agent',
          orgSlug: 'test-org',
          currentStage: 'init',
          status: 'running',
        }),
        expect.objectContaining({
          configurable: {
            thread_id: expect.stringMatching(/^run-\d+-[a-z0-9]+$/),
          },
        }),
      );
    });

    it('should set status to failed on error', async () => {
      mockGraph.invoke.mockRejectedValueOnce(
        new Error('Graph execution failed'),
      );

      const result = await service.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Graph execution failed');
      expect(result.recommendations).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      mockGraph.invoke.mockRejectedValueOnce('String error');

      const result = await service.execute(mockInput);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('String error');
    });

    it('should include execution duration in metrics', async () => {
      const result = await service.execute(mockInput);

      expect(result.metrics.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate input before execution', async () => {
      const invalidInput = {
        ...mockInput,
        agentId: '',
      };

      const result = await service.execute(invalidInput);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('agentId is required');
    });
  });

  describe('buildGraph', () => {
    it('should create a StateGraph with correct nodes', () => {
      const graph = (service as any).buildGraph();

      expect(graph).toBeInstanceOf(StateGraph);
    });

    it('should have all required nodes', () => {
      const addNodeSpy = jest.spyOn(StateGraph.prototype, 'addNode');

      (service as any).buildGraph();

      const nodeNames = addNodeSpy.mock.calls.map((call) => call[0]);

      expect(nodeNames).toContain('poll_data');
      expect(nodeNames).toContain('group_claims');
      expect(nodeNames).toContain('triage');
      expect(nodeNames).toContain('process_bundles');
      expect(nodeNames).toContain('evaluate');
      expect(nodeNames).toContain('package');
      expect(nodeNames).toContain('store_results');
    });

    it('should connect nodes in correct order', () => {
      const addEdgeSpy = jest.spyOn(StateGraph.prototype, 'addEdge');

      (service as any).buildGraph();

      const edges = addEdgeSpy.mock.calls.map((call) => [call[0], call[1]]);

      expect(edges).toContainEqual(['__start__', 'poll_data']);
      expect(edges).toContainEqual(['poll_data', 'group_claims']);
      expect(edges).toContainEqual(['group_claims', 'triage']);
      expect(edges).toContainEqual(['triage', 'process_bundles']);
      expect(edges).toContainEqual(['process_bundles', 'evaluate']);
      expect(edges).toContainEqual(['evaluate', 'package']);
      expect(edges).toContainEqual(['package', 'store_results']);
      expect(edges).toContainEqual(['store_results', '__end__']);
    });
  });

  describe('validateInput', () => {
    it('should throw error when agentId is missing', () => {
      const invalidInput = { ...mockInput, agentId: '' };

      expect(() => (service as any).validateInput(invalidInput)).toThrow(
        'agentId is required',
      );
    });

    it('should throw error when agentSlug is missing', () => {
      const invalidInput = { ...mockInput, agentSlug: '' };

      expect(() => (service as any).validateInput(invalidInput)).toThrow(
        'agentSlug is required',
      );
    });

    it('should throw error when config is missing', () => {
      const invalidInput = { ...mockInput, config: undefined as any };

      expect(() => (service as any).validateInput(invalidInput)).toThrow(
        'config is required',
      );
    });

    it('should throw error when no instruments configured', () => {
      const invalidInput = {
        ...mockInput,
        config: { ...mockInput.config, instruments: [] },
      };

      expect(() => (service as any).validateInput(invalidInput)).toThrow(
        'At least one instrument must be configured',
      );
    });

    it('should throw error for unsupported risk profile', () => {
      const invalidInput = {
        ...mockInput,
        config: { ...mockInput.config, riskProfile: 'invalid' as any },
      };

      expect(() => (service as any).validateInput(invalidInput)).toThrow(
        'Unsupported risk profile',
      );
    });

    it('should not throw for valid input', () => {
      expect(() => (service as any).validateInput(mockInput)).not.toThrow();
    });
  });

  describe('abstract methods are implemented', () => {
    it('should have getTools implemented', () => {
      const tools = (service as any).getTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0]).toHaveProperty('name');
      expect(tools[0]).toHaveProperty('execute');
    });

    it('should have getSpecialistContexts implemented', () => {
      const contexts = (service as any).getSpecialistContexts();

      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts[0]).toHaveProperty('specialist');
      expect(contexts[0]).toHaveProperty('systemPrompt');
    });

    it('should have getTriageContexts implemented', () => {
      const contexts = (service as any).getTriageContexts();

      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts[0]).toHaveProperty('agent');
    });

    it('should have getEvaluatorContexts implemented', () => {
      const contexts = (service as any).getEvaluatorContexts();

      expect(Array.isArray(contexts)).toBe(true);
      expect(contexts.length).toBeGreaterThan(0);
      expect(contexts[0]).toHaveProperty('evaluator');
      expect(contexts[0]).toHaveProperty('challengeType');
    });

    it('should have getRiskProfiles implemented', () => {
      const profiles = (service as any).getRiskProfiles();

      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
      expect(profiles).toContain('moderate');
    });
  });

  describe('calculateUrgency', () => {
    it('should return critical for significance >= 0.8', () => {
      const bundle: EnrichedClaimBundle = {
        instrument: 'AAPL',
        currentClaims: [],
        sources: [],
        historicalClaims: [],
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.9,
        },
        shouldProceed: true,
      };

      const urgency = (service as any).calculateUrgency(bundle);

      expect(urgency).toBe('critical');
    });

    it('should return high for significance >= 0.6', () => {
      const bundle: EnrichedClaimBundle = {
        instrument: 'AAPL',
        currentClaims: [],
        sources: [],
        historicalClaims: [],
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.7,
        },
        shouldProceed: true,
      };

      const urgency = (service as any).calculateUrgency(bundle);

      expect(urgency).toBe('high');
    });

    it('should return medium for significance >= 0.4', () => {
      const bundle: EnrichedClaimBundle = {
        instrument: 'AAPL',
        currentClaims: [],
        sources: [],
        historicalClaims: [],
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.5,
        },
        shouldProceed: true,
      };

      const urgency = (service as any).calculateUrgency(bundle);

      expect(urgency).toBe('medium');
    });

    it('should return low for significance < 0.4', () => {
      const bundle: EnrichedClaimBundle = {
        instrument: 'AAPL',
        currentClaims: [],
        sources: [],
        historicalClaims: [],
        claimsDiff: {
          newClaims: [],
          changedClaims: [],
          removedClaims: [],
          significanceScore: 0.2,
        },
        shouldProceed: true,
      };

      const urgency = (service as any).calculateUrgency(bundle);

      expect(urgency).toBe('low');
    });
  });

  describe('createEmptyDatapoint', () => {
    it('should create valid empty datapoint', () => {
      const datapoint = (service as any).createEmptyDatapoint('test-agent-id');

      expect(datapoint).toHaveProperty('id');
      expect(datapoint.agentId).toBe('test-agent-id');
      expect(datapoint.sources).toEqual([]);
      expect(datapoint.allClaims).toEqual([]);
      expect(datapoint.instruments).toEqual([]);
      expect(datapoint.metadata.durationMs).toBe(0);
      expect(datapoint.metadata.toolsSucceeded).toBe(0);
      expect(datapoint.metadata.toolsFailed).toBe(0);
    });
  });
});
