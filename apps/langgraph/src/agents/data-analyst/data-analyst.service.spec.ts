import { Test, TestingModule } from '@nestjs/testing';
import { LLMHttpClientService } from '../../services/llm-http-client.service';
import { ObservabilityService } from '../../services/observability.service';
import { DataAnalystInput } from './data-analyst.state';

// Mock PostgresSaver before any imports that need it
jest.mock('@langchain/langgraph-checkpoint-postgres', () => ({
  PostgresSaver: {
    fromConnString: jest.fn(() => ({
      setup: jest.fn().mockResolvedValue(undefined),
      put: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    })),
  },
}));

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  })),
}));

// Now import after mocking
import { PostgresCheckpointerService } from '../../persistence/postgres-checkpointer.service';
import {
  ListTablesTool,
  DescribeTableTool,
  SqlQueryTool,
} from '../../tools/data/database';
import { createMockExecutionContext } from '@orchestrator-ai/transport-types';

// Mock the graph module
jest.mock('./data-analyst.graph', () => ({
  createDataAnalystGraph: jest.fn(() => ({
    invoke: jest.fn().mockResolvedValue({
      status: 'completed',
      summary: 'There are 100 users in the database.',
      generatedSql: 'SELECT COUNT(*) FROM users',
      sqlResults: 'count: 100',
    }),
    getState: jest.fn().mockResolvedValue({
      values: {
        status: 'completed',
        question: 'How many users?',
        summary: 'There are 100 users.',
      },
      next: [],
    }),
    getStateHistory: jest.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { values: { status: 'started' } };
        yield { values: { status: 'completed' } };
      },
    }),
  })),
}));

// Import after mocking
import { DataAnalystService } from './data-analyst.service';

/**
 * Unit tests for DataAnalystService
 *
 * Tests the Data Analyst agent service that manages
 * the tool-calling pattern for database queries.
 */
describe('DataAnalystService', () => {
  let service: DataAnalystService;
  let llmClient: jest.Mocked<LLMHttpClientService>;
  let observability: jest.Mocked<ObservabilityService>;
  let checkpointer: jest.Mocked<PostgresCheckpointerService>;
  const mockContext = createMockExecutionContext();

  const mockSaver = {
    setup: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockReturnValue([]),
  };

  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataAnalystService,
        {
          provide: LLMHttpClientService,
          useValue: {
            callLLM: jest.fn().mockResolvedValue({
              text: 'Mocked LLM response',
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }),
          },
        },
        {
          provide: ObservabilityService,
          useValue: {
            emit: jest.fn().mockResolvedValue(undefined),
            emitStarted: jest.fn().mockResolvedValue(undefined),
            emitProgress: jest.fn().mockResolvedValue(undefined),
            emitToolCalling: jest.fn().mockResolvedValue(undefined),
            emitToolCompleted: jest.fn().mockResolvedValue(undefined),
            emitCompleted: jest.fn().mockResolvedValue(undefined),
            emitFailed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PostgresCheckpointerService,
          useValue: {
            getSaver: jest.fn().mockReturnValue(mockSaver),
            getPool: jest.fn().mockReturnValue(mockPool),
            isReady: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: ListTablesTool,
          useValue: {
            execute: jest.fn().mockResolvedValue('Tables: users, orders'),
            createTool: jest.fn().mockReturnValue({
              invoke: jest.fn().mockResolvedValue('Tables list'),
            }),
          },
        },
        {
          provide: DescribeTableTool,
          useValue: {
            execute: jest.fn().mockResolvedValue('Schema: id INT, name VARCHAR'),
            createTool: jest.fn().mockReturnValue({
              invoke: jest.fn().mockResolvedValue('Schema info'),
            }),
          },
        },
        {
          provide: SqlQueryTool,
          useValue: {
            executeSql: jest.fn().mockResolvedValue('count: 100'),
            createTool: jest.fn().mockReturnValue({
              invoke: jest.fn().mockResolvedValue('Query result'),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DataAnalystService>(DataAnalystService);
    llmClient = module.get(LLMHttpClientService);
    observability = module.get(ObservabilityService);
    checkpointer = module.get(PostgresCheckpointerService);

    // Initialize the service (triggers onModuleInit)
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    const validInput: DataAnalystInput = {
      taskId: 'task-123',
      userId: 'user-456',
      conversationId: 'conv-789',
      organizationSlug: 'org-abc',
      question: 'How many users are there?',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    };

    it('should throw error for missing taskId', async () => {
      const invalidInput = { ...validInput, taskId: '' };

      await expect(service.analyze(invalidInput)).rejects.toThrow(
        'Invalid input',
      );
    });

    it('should throw error for missing userId', async () => {
      const invalidInput = { ...validInput, userId: '' };

      await expect(service.analyze(invalidInput)).rejects.toThrow(
        'Invalid input',
      );
    });

    it('should throw error for missing question', async () => {
      const invalidInput = { ...validInput, question: '' };

      await expect(service.analyze(invalidInput)).rejects.toThrow(
        'Invalid input',
      );
    });

    it('should return result with threadId for valid input', async () => {
      const result = await service.analyze(validInput);

      expect(result.threadId).toBeDefined();
      expect(result.question).toBe(validInput.question);
    });
  });

  describe('getStatus', () => {
    it('should return null for non-existent thread', async () => {
      // Mock getState to return null
      const { createDataAnalystGraph } = require('./data-analyst.graph');
      createDataAnalystGraph.mockReturnValueOnce({
        invoke: jest.fn(),
        getState: jest.fn().mockResolvedValue({ values: null }),
        getStateHistory: jest.fn(),
      });

      await service.onModuleInit();
      const result = await service.getStatus('non-existent-thread');

      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return empty array for non-existent thread', async () => {
      // Mock getStateHistory to return empty iterator
      const { createDataAnalystGraph } = require('./data-analyst.graph');
      createDataAnalystGraph.mockReturnValueOnce({
        invoke: jest.fn(),
        getState: jest.fn(),
        getStateHistory: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            // Empty iterator
          },
        }),
      });

      await service.onModuleInit();
      const result = await service.getHistory('non-existent-thread');

      expect(result).toEqual([]);
    });
  });

  // Note: Input validation is now handled by NestJS DTOs at the controller level
  // No need for separate validation tests here
});

/**
 * Integration tests for DataAnalystService
 *
 * These tests require a running database and should be run
 * against the test environment.
 */
describe.skip('DataAnalystService (Integration)', () => {
  // Integration tests would be marked with a different tag
  // and run separately against the test database

  it.todo('should complete full analysis workflow');
  it.todo('should discover tables from database');
  it.todo('should generate and execute SQL queries');
  it.todo('should handle database connection errors');
  it.todo('should track state through checkpointer');
});
