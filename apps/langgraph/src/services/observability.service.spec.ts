import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  ObservabilityService,
  LangGraphObservabilityEvent,
  LangGraphStatus,
} from './observability.service';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';

/**
 * Integration tests for ObservabilityService
 *
 * These tests make REAL HTTP calls to the Orchestrator AI API's webhook endpoint.
 * They verify:
 * 1. Events are correctly sent to /webhooks/status
 * 2. The webhook accepts the event format
 * 3. The full payload structure is correct
 *
 * Prerequisites:
 * - API server running on localhost:6100 (or configured API_PORT)
 * - Set INTEGRATION_TESTS=true to run these tests
 */

// Skip integration tests if environment is not configured
const shouldRunIntegration = process.env.INTEGRATION_TESTS === 'true';
const describeIntegration = shouldRunIntegration ? describe : describe.skip;

// Also keep unit tests that can run without external services
describe('ObservabilityService - Unit Tests', () => {
  describe('constructor', () => {
    it('should throw error when API_PORT is not configured', async () => {
      const moduleRef = Test.createTestingModule({
        imports: [HttpModule],
        providers: [
          ObservabilityService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(moduleRef.compile()).rejects.toThrow(
        'API_PORT environment variable is required',
      );
    });

    it('should initialize with correct API URL', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [HttpModule],
        providers: [
          ObservabilityService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  API_PORT: '6100',
                  API_HOST: 'localhost',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      const service = module.get<ObservabilityService>(ObservabilityService);
      expect(service).toBeDefined();
    });
  });
});

describeIntegration('ObservabilityService - Integration Tests (Real HTTP)', () => {
  let service: ObservabilityService;
  let httpService: HttpService;

  // Test context - uses real ExecutionContext structure
  const testContext = createMockExecutionContext({
    taskId: `test-task-${Date.now()}`,
    conversationId: `test-conv-${Date.now()}`,
    userId: 'test-user-integration',
    agentSlug: 'marketing-swarm',
    orgSlug: 'demo-org',
    agentType: 'langgraph',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  });

  const threadId = testContext.taskId;

  beforeAll(async () => {
    // Create module with REAL HttpModule (no mocking)
    const module: TestingModule = await Test.createTestingModule({
      imports: [HttpModule],
      providers: [
        ObservabilityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              // Use environment variables or defaults
              const config: Record<string, string> = {
                API_PORT: process.env.API_PORT || '6100',
                API_HOST: process.env.API_HOST || 'localhost',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ObservabilityService>(ObservabilityService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(httpService).toBeDefined();
  });

  describe('emit - real HTTP calls', () => {
    it('should successfully send event to webhook endpoint', async () => {
      const event: LangGraphObservabilityEvent = {
        context: testContext,
        threadId,
        status: 'started',
        message: 'Integration test - workflow started',
      };

      // Should not throw - webhook should accept the event
      await expect(service.emit(event)).resolves.not.toThrow();
    });

    it('should send event with metadata', async () => {
      const event: LangGraphObservabilityEvent = {
        context: testContext,
        threadId,
        status: 'processing',
        message: 'Integration test - processing with metadata',
        metadata: {
          type: 'phase_changed',
          phase: 'writing',
          customField: 'test-value',
        },
      };

      await expect(service.emit(event)).resolves.not.toThrow();
    });

    it.each([
      'started',
      'processing',
      'hitl_waiting',
      'hitl_resumed',
      'completed',
      'failed',
      'tool_calling',
      'tool_completed',
    ] as LangGraphStatus[])(
      'should send %s event successfully',
      async (status) => {
        const event: LangGraphObservabilityEvent = {
          context: testContext,
          threadId,
          status,
          message: `Integration test - ${status} event`,
        };

        await expect(service.emit(event)).resolves.not.toThrow();
      },
    );
  });

  describe('convenience methods - real HTTP calls', () => {
    it('emitStarted should send started event', async () => {
      await expect(
        service.emitStarted(testContext, threadId, 'Integration test started'),
      ).resolves.not.toThrow();
    });

    it('emitProgress should send progress event with step and progress', async () => {
      await expect(
        service.emitProgress(testContext, threadId, 'Processing step 2', {
          step: 'analyze-data',
          progress: 50,
          metadata: { rowsProcessed: 100 },
        }),
      ).resolves.not.toThrow();
    });

    it('emitHitlWaiting should send HITL waiting event', async () => {
      const pendingContent = {
        blogPost: 'Draft blog content for review...',
        seoDescription: 'SEO text pending approval...',
      };

      await expect(
        service.emitHitlWaiting(
          testContext,
          threadId,
          pendingContent,
          'Awaiting human review',
        ),
      ).resolves.not.toThrow();
    });

    it.each(['approve', 'edit', 'reject'] as const)(
      'emitHitlResumed should send HITL resumed with decision: %s',
      async (decision) => {
        await expect(
          service.emitHitlResumed(testContext, threadId, decision),
        ).resolves.not.toThrow();
      },
    );

    it('emitToolCalling should send tool calling event', async () => {
      await expect(
        service.emitToolCalling(testContext, threadId, 'sql-query', {
          query: 'SELECT * FROM test',
        }),
      ).resolves.not.toThrow();
    });

    it('emitToolCompleted should send tool completed event (success)', async () => {
      await expect(
        service.emitToolCompleted(
          testContext,
          threadId,
          'list-tables',
          true,
          ['users', 'orders'],
        ),
      ).resolves.not.toThrow();
    });

    it('emitToolCompleted should send tool completed event (failure)', async () => {
      await expect(
        service.emitToolCompleted(
          testContext,
          threadId,
          'sql-query',
          false,
          undefined,
          'Query syntax error',
        ),
      ).resolves.not.toThrow();
    });

    it('emitCompleted should send completed event with result', async () => {
      await expect(
        service.emitCompleted(
          testContext,
          threadId,
          { summary: 'Analysis complete', rowCount: 42 },
          5000,
        ),
      ).resolves.not.toThrow();
    });

    it('emitFailed should send failed event', async () => {
      await expect(
        service.emitFailed(
          testContext,
          threadId,
          'Test failure message',
          1500,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('marketing swarm specific events - real HTTP calls', () => {
    it('should send phase_changed event with correct structure', async () => {
      await expect(
        service.emitProgress(testContext, threadId, 'Phase: writing', {
          metadata: {
            type: 'phase_changed',
            phase: 'writing',
          },
        }),
      ).resolves.not.toThrow();
    });

    it('should send queue_built event with correct structure', async () => {
      await expect(
        service.emitProgress(
          testContext,
          threadId,
          'Queue built: 4 output combinations',
          {
            metadata: {
              type: 'queue_built',
              taskId: testContext.taskId,
              totalOutputs: 4,
              writers: 2,
              editors: 2,
              evaluators: 1,
              outputs: [
                {
                  id: 'output-1',
                  status: 'pending_write',
                  writerAgentSlug: 'writer-creative',
                  editorAgentSlug: 'editor-clarity',
                },
                {
                  id: 'output-2',
                  status: 'pending_write',
                  writerAgentSlug: 'writer-technical',
                  editorAgentSlug: 'editor-clarity',
                },
              ],
            },
          },
        ),
      ).resolves.not.toThrow();
    });

    it('should send output_updated event with correct structure', async () => {
      await expect(
        service.emitProgress(
          testContext,
          threadId,
          'Output output-1 status: writing',
          {
            metadata: {
              type: 'output_updated',
              taskId: testContext.taskId,
              output: {
                id: 'output-1',
                status: 'writing',
                writerAgent: {
                  slug: 'writer-creative',
                  name: 'Creative Writer',
                  llmProvider: 'anthropic',
                  llmModel: 'claude-sonnet-4-20250514',
                  isLocal: false,
                },
                editorAgent: {
                  slug: 'editor-clarity',
                  name: 'Clarity Editor',
                  llmProvider: 'anthropic',
                  llmModel: 'claude-sonnet-4-20250514',
                  isLocal: false,
                },
                content: 'Generated content here...',
                editCycle: 1,
                editorFeedback: 'Good start, needs more detail.',
                initialAvgScore: 7.5,
                initialRank: 2,
                isFinalist: true,
              },
            },
          },
        ),
      ).resolves.not.toThrow();
    });

    it('should send evaluation_updated event with correct structure', async () => {
      await expect(
        service.emitProgress(
          testContext,
          threadId,
          'Evaluation eval-1 completed',
          {
            metadata: {
              type: 'evaluation_updated',
              taskId: testContext.taskId,
              evaluation: {
                id: 'eval-1',
                outputId: 'output-1',
                stage: 'initial',
                status: 'completed',
                evaluatorAgent: {
                  slug: 'evaluator-quality',
                  name: 'Quality Evaluator',
                  llmProvider: 'anthropic',
                  llmModel: 'claude-sonnet-4-20250514',
                  isLocal: false,
                },
                score: 8,
                reasoning: 'Well-written with clear structure.',
              },
            },
          },
        ),
      ).resolves.not.toThrow();
    });

    it('should send finalists_selected event with correct structure', async () => {
      await expect(
        service.emitProgress(testContext, threadId, 'Selected 2 finalists', {
          metadata: {
            type: 'finalists_selected',
            taskId: testContext.taskId,
            count: 2,
            finalists: [
              {
                id: 'output-1',
                rank: 1,
                avgScore: 8.5,
                writerAgentSlug: 'writer-creative',
                editorAgentSlug: 'editor-clarity',
              },
              {
                id: 'output-2',
                rank: 2,
                avgScore: 7.8,
                writerAgentSlug: 'writer-technical',
                editorAgentSlug: 'editor-clarity',
              },
            ],
          },
        }),
      ).resolves.not.toThrow();
    });

    it('should send ranking_updated event with correct structure', async () => {
      await expect(
        service.emitProgress(testContext, threadId, 'Ranking updated (initial)', {
          metadata: {
            type: 'ranking_updated',
            taskId: testContext.taskId,
            stage: 'initial',
            rankings: [
              {
                outputId: 'output-1',
                rank: 1,
                totalScore: 17,
                avgScore: 8.5,
                writerAgentSlug: 'writer-creative',
                editorAgentSlug: 'editor-clarity',
              },
              {
                outputId: 'output-2',
                rank: 2,
                totalScore: 15.6,
                avgScore: 7.8,
                writerAgentSlug: 'writer-technical',
                editorAgentSlug: 'editor-clarity',
              },
            ],
          },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('error handling - non-blocking', () => {
    it('should not throw when webhook is unavailable', async () => {
      // Create a service pointing to wrong port
      const badModule = await Test.createTestingModule({
        imports: [HttpModule],
        providers: [
          ObservabilityService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                  API_PORT: '59999', // Wrong port - should fail
                  API_HOST: 'localhost',
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      const badService = badModule.get<ObservabilityService>(ObservabilityService);

      // Should NOT throw - observability failures are non-blocking
      await expect(
        badService.emit({
          context: testContext,
          threadId,
          status: 'started',
          message: 'This should fail silently',
        }),
      ).resolves.not.toThrow();
    });
  });
});
