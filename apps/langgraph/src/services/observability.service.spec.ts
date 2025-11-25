import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import type { AxiosResponse } from 'axios';
import {
  ObservabilityService,
  LangGraphObservabilityEvent,
  LangGraphStatus,
} from './observability.service';

/**
 * Unit tests for ObservabilityService
 *
 * Tests the service that sends observability events to the
 * Orchestrator AI API's webhook endpoint for LangGraph workflows.
 */
describe('ObservabilityService', () => {
  let service: ObservabilityService;
  let httpService: jest.Mocked<HttpService>;

  const createMockAxiosResponse = <T = unknown>(
    data: T,
    status = 200,
  ): AxiosResponse<T> => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: { headers: {} as never },
  });

  const baseEventParams = {
    taskId: 'task-123',
    threadId: 'thread-456',
    agentSlug: 'data-analyst',
    userId: 'user-789',
    conversationId: 'conv-abc',
    organizationSlug: 'org-xyz',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservabilityService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
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

    service = module.get<ObservabilityService>(ObservabilityService);
    httpService = module.get(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error when API_PORT is not configured', async () => {
      const moduleRef = Test.createTestingModule({
        providers: [
          ObservabilityService,
          {
            provide: HttpService,
            useValue: { post: jest.fn() },
          },
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
  });

  describe('emit', () => {
    const validEvent: LangGraphObservabilityEvent = {
      taskId: 'task-123',
      threadId: 'thread-456',
      status: 'started',
      agentSlug: 'data-analyst',
      userId: 'user-789',
      conversationId: 'conv-abc',
      message: 'Workflow started',
    };

    it('should emit event successfully', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emit(validEvent);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://localhost:6100/webhooks/status',
        expect.objectContaining({
          taskId: 'task-123',
          status: 'langgraph.started',
          timestamp: expect.any(String),
          conversationId: 'conv-abc',
          userId: 'user-789',
          agentSlug: 'data-analyst',
          message: 'Workflow started',
          data: expect.objectContaining({
            hook_event_type: 'langgraph.started',
            source_app: 'langgraph',
            session_id: 'conv-abc',
            threadId: 'thread-456',
          }),
        }),
        expect.objectContaining({
          timeout: 2000,
          validateStatus: expect.any(Function),
        }),
      );
    });

    it('should use taskId as session_id when conversationId is missing', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      const eventWithoutConvId: LangGraphObservabilityEvent = {
        ...validEvent,
        conversationId: undefined,
      };

      await service.emit(eventWithoutConvId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.objectContaining({
            session_id: 'task-123',
          }),
        }),
        expect.any(Object),
      );
    });

    it('should not throw on HTTP error (non-blocking)', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.emit(validEvent)).resolves.not.toThrow();
    });

    it('should include metadata in data payload', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      const eventWithMetadata: LangGraphObservabilityEvent = {
        ...validEvent,
        metadata: {
          customField: 'customValue',
          nodeCount: 5,
        },
      };

      await service.emit(eventWithMetadata);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: expect.objectContaining({
            customField: 'customValue',
            nodeCount: 5,
          }),
        }),
        expect.any(Object),
      );
    });

    it.each([
      ['started', 'langgraph.started'],
      ['processing', 'langgraph.processing'],
      ['hitl_waiting', 'langgraph.hitl_waiting'],
      ['hitl_resumed', 'langgraph.hitl_resumed'],
      ['completed', 'langgraph.completed'],
      ['failed', 'langgraph.failed'],
      ['tool_calling', 'langgraph.tool_calling'],
      ['tool_completed', 'langgraph.tool_completed'],
    ])('should map status %s to event type %s', async (status, eventType) => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emit({
        ...validEvent,
        status: status as LangGraphStatus,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: eventType,
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitStarted', () => {
    it('should emit started event with default message', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitStarted(baseEventParams);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.started',
          message: 'Workflow started',
        }),
        expect.any(Object),
      );
    });

    it('should use custom message when provided', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitStarted({
        ...baseEventParams,
        message: 'Custom start message',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: 'Custom start message',
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitProgress', () => {
    it('should emit progress event with step and progress', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitProgress({
        ...baseEventParams,
        message: 'Processing step 2',
        step: 'analyze-data',
        progress: 50,
        metadata: { rowsProcessed: 100 },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.processing',
          message: 'Processing step 2',
          step: 'analyze-data',
          percent: 50,
          data: expect.objectContaining({
            rowsProcessed: 100,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitHitlWaiting', () => {
    it('should emit HITL waiting event with pending content', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      const pendingContent = {
        blogPost: 'Draft blog content...',
        seoDescription: 'SEO text...',
      };

      await service.emitHitlWaiting({
        ...baseEventParams,
        pendingContent,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.hitl_waiting',
          message: 'Awaiting human review',
          data: expect.objectContaining({
            pendingContent,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitHitlResumed', () => {
    it.each(['approve', 'edit', 'reject'] as const)(
      'should emit HITL resumed event with decision: %s',
      async (decision) => {
        const mockResponse = createMockAxiosResponse({ success: true });
        httpService.post.mockReturnValue(of(mockResponse));

        await service.emitHitlResumed({
          ...baseEventParams,
          decision,
        });

        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            status: 'langgraph.hitl_resumed',
            message: `Human review decision: ${decision}`,
            data: expect.objectContaining({
              decision,
            }),
          }),
          expect.any(Object),
        );
      },
    );
  });

  describe('emitToolCalling', () => {
    it('should emit tool calling event with tool info', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitToolCalling({
        ...baseEventParams,
        toolName: 'sql-query',
        toolInput: { query: 'SELECT * FROM users' },
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.tool_calling',
          message: 'Calling tool: sql-query',
          step: 'sql-query',
          data: expect.objectContaining({
            toolName: 'sql-query',
            toolInput: { query: 'SELECT * FROM users' },
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitToolCompleted', () => {
    it('should emit tool completed event on success', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitToolCompleted({
        ...baseEventParams,
        toolName: 'list-tables',
        toolResult: ['users', 'orders', 'products'],
        success: true,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.tool_completed',
          message: 'Tool completed: list-tables',
          data: expect.objectContaining({
            toolName: 'list-tables',
            success: true,
            toolResult: ['users', 'orders', 'products'],
          }),
        }),
        expect.any(Object),
      );
    });

    it('should emit tool completed event on failure', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitToolCompleted({
        ...baseEventParams,
        toolName: 'sql-query',
        success: false,
        error: 'Query syntax error',
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          message: 'Tool failed: sql-query',
          data: expect.objectContaining({
            success: false,
            error: 'Query syntax error',
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitCompleted', () => {
    it('should emit completed event with result and duration', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitCompleted({
        ...baseEventParams,
        result: { summary: 'Analysis complete', rowCount: 42 },
        duration: 5000,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.completed',
          message: 'Workflow completed successfully',
          data: expect.objectContaining({
            result: { summary: 'Analysis complete', rowCount: 42 },
            duration: 5000,
          }),
        }),
        expect.any(Object),
      );
    });
  });

  describe('emitFailed', () => {
    it('should emit failed event with error', async () => {
      const mockResponse = createMockAxiosResponse({ success: true });
      httpService.post.mockReturnValue(of(mockResponse));

      await service.emitFailed({
        ...baseEventParams,
        error: 'Database connection failed',
        duration: 1500,
      });

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'langgraph.failed',
          message: 'Workflow failed: Database connection failed',
          data: expect.objectContaining({
            error: 'Database connection failed',
            duration: 1500,
          }),
        }),
        expect.any(Object),
      );
    });
  });
});
