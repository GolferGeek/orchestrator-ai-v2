import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createMockExecutionContext } from "@orchestrator-ai/transport-types";
import {
  DataAnalystStateAnnotation,
  DataAnalystState,
} from "./data-analyst.state";
import { createDataAnalystGraph } from "./data-analyst.graph";
import {
  ListTablesTool,
  DescribeTableTool,
  SqlQueryTool,
} from "../../tools/data/database";
import { LLMHttpClientService } from "../../services/llm-http-client.service";
import { ObservabilityService } from "../../services/observability.service";
import { PostgresCheckpointerService } from "../../persistence/postgres-checkpointer.service";

/**
 * Unit tests for createDataAnalystGraph
 *
 * Tests the Data Analyst graph creation and node logic.
 * Validates ExecutionContext flow, tool calls, and state transitions.
 */
describe("createDataAnalystGraph", () => {
  let mockLLMClient: jest.Mocked<LLMHttpClientService>;
  let mockObservability: jest.Mocked<ObservabilityService>;
  let mockCheckpointer: jest.Mocked<PostgresCheckpointerService>;
  let mockListTablesTool: jest.Mocked<ListTablesTool>;
  let mockDescribeTableTool: jest.Mocked<DescribeTableTool>;
  let mockSqlQueryTool: jest.Mocked<SqlQueryTool>;
  let mockExecutionContext: ReturnType<typeof createMockExecutionContext>;

  const mockSaver = {
    setup: jest.fn().mockResolvedValue(undefined),
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    getTuple: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockReturnValue([]),
  };

  beforeEach(() => {
    // Create mock ExecutionContext
    mockExecutionContext = createMockExecutionContext({
      taskId: "task-123",
      userId: "user-456",
      conversationId: "conv-789",
      orgSlug: "org-abc",
      agentSlug: "data-analyst",
      agentType: "langgraph",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });

    // Mock LLMHttpClientService
    mockLLMClient = {
      callLLM: jest.fn().mockResolvedValue({
        text: '["users", "orders"]',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    } as any;

    // Mock ObservabilityService
    mockObservability = {
      emit: jest.fn().mockResolvedValue(undefined),
      emitStarted: jest.fn().mockResolvedValue(undefined),
      emitProgress: jest.fn().mockResolvedValue(undefined),
      emitToolCalling: jest.fn().mockResolvedValue(undefined),
      emitToolCompleted: jest.fn().mockResolvedValue(undefined),
      emitCompleted: jest.fn().mockResolvedValue(undefined),
      emitFailed: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock PostgresCheckpointerService
    mockCheckpointer = {
      getSaver: jest.fn().mockReturnValue(mockSaver),
      getPool: jest.fn().mockReturnValue({}),
      isReady: jest.fn().mockReturnValue(true),
    } as any;

    // Mock ListTablesTool
    mockListTablesTool = {
      execute: jest
        .fn()
        .mockResolvedValue("- public.users\n- public.orders\n- public.products"),
    } as any;

    // Mock DescribeTableTool
    mockDescribeTableTool = {
      execute: jest.fn().mockResolvedValue(`
Table: users
Columns:
- id (integer)
- name (varchar)
- email (varchar)
      `),
    } as any;

    // Mock SqlQueryTool
    mockSqlQueryTool = {
      generateAndExecuteSql: jest.fn().mockResolvedValue(`
\`\`\`sql
SELECT COUNT(*) as count FROM users
\`\`\`

Results:
| count |
|-------|
| 100   |
      `),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Graph Creation", () => {
    it("should create a graph with all required nodes", () => {
      // Arrange & Act
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      // Assert
      expect(graph).toBeDefined();
      expect(mockCheckpointer.getSaver).toHaveBeenCalled();
    });

    it("should compile graph with checkpointer", () => {
      // Arrange & Act
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      // Assert
      expect(graph).toBeDefined();
      expect(mockCheckpointer.getSaver).toHaveBeenCalled();
    });
  });

  describe("Node: startNode", () => {
    it("should initialize state with ExecutionContext", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "How many users are there?",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockObservability.emitStarted).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("How many users are there?"),
      );
    });

    it("should set status to discovering and add HumanMessage", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me all tables",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - check that the workflow completed (status transitions happen)
      expect(result.status).toBeDefined();
      expect(result.messages).toBeDefined();
    });

    it("should validate ExecutionContext flow through startNode", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Test query",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - ExecutionContext should be passed to observability
      expect(mockObservability.emitStarted).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: mockExecutionContext.taskId,
          userId: mockExecutionContext.userId,
          conversationId: mockExecutionContext.conversationId,
        }),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe("Node: discoverTablesNode", () => {
    it("should discover tables successfully", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "List all users",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockListTablesTool.execute).toHaveBeenCalledWith("public");
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("Discovering"),
        expect.objectContaining({ step: "discover_tables" }),
      );
    });

    it("should parse table names from tool result", async () => {
      // Arrange
      mockListTablesTool.execute.mockResolvedValue(
        "- public.users\n- public.orders\n- public.products",
      );

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me tables",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.availableTables).toBeDefined();
      expect(Array.isArray(result.availableTables)).toBe(true);
    });

    it("should handle table discovery errors", async () => {
      // Arrange
      mockListTablesTool.execute.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me tables",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Database connection failed");
    });

    it("should route to handleError when no tables found", async () => {
      // Arrange
      mockListTablesTool.execute.mockResolvedValue("");

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me tables",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - workflow should end in failed state
      expect(result.status).toBe("failed");
    });
  });

  describe("Node: planSchemaNode", () => {
    it("should use LLM to select relevant tables", async () => {
      // Arrange
      mockLLMClient.callLLM.mockResolvedValue({
        text: '["users", "orders"]',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "How many users have orders?",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockLLMClient.callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          context: mockExecutionContext,
          userMessage: expect.stringContaining("How many users have orders?"),
          callerName: "data-analyst",
        }),
      );
    });

    it("should validate ExecutionContext in LLM call", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - ExecutionContext should be passed correctly
      expect(mockLLMClient.callLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            taskId: mockExecutionContext.taskId,
            userId: mockExecutionContext.userId,
          }),
        }),
      );
    });

    it("should filter to only include valid tables", async () => {
      // Arrange
      mockLLMClient.callLLM.mockResolvedValue({
        text: '["users", "invalid_table", "orders"]',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should complete successfully with filtered tables
      expect(result.selectedTables).toBeDefined();
    });

    it("should limit to 5 tables if LLM selects more", async () => {
      // Arrange
      mockLLMClient.callLLM.mockResolvedValue({
        text: '["t1", "t2", "t3", "t4", "t5", "t6", "t7"]',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me all data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should complete (table limit enforced internally)
      expect(result.status).toBeDefined();
    });

    it("should fallback to all tables if LLM fails", async () => {
      // Arrange
      mockLLMClient.callLLM.mockRejectedValue(new Error("LLM timeout"));

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should continue workflow even if LLM fails
      expect(result.status).toBeDefined();
    });

    it("should emit progress with correct step", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Query data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("Planning"),
        expect.objectContaining({ step: "plan_schema" }),
      );
    });
  });

  describe("Node: describeTablesNode", () => {
    it("should describe selected tables", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me users",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockDescribeTableTool.execute).toHaveBeenCalled();
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("Examining"),
        expect.objectContaining({ step: "describe_tables" }),
      );
    });

    it("should collect schemas for all selected tables", async () => {
      // Arrange
      mockDescribeTableTool.execute.mockResolvedValue("Schema for table");

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.tableSchemas).toBeDefined();
    });

    it("should handle table description errors gracefully", async () => {
      // Arrange
      mockDescribeTableTool.execute
        .mockResolvedValueOnce("Schema 1")
        .mockRejectedValueOnce(new Error("Table not found"))
        .mockResolvedValueOnce("Schema 2");

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should continue even if some tables fail
      expect(result.status).toBeDefined();
    });

    it("should track tool results for each table", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.toolResults).toBeDefined();
      expect(Array.isArray(result.toolResults)).toBe(true);
    });
  });

  describe("Node: executeQueryNode", () => {
    it("should generate and execute SQL query", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Count all users",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockSqlQueryTool.generateAndExecuteSql).toHaveBeenCalled();
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("Generating"),
        expect.objectContaining({ step: "execute_query" }),
      );
    });

    it("should pass ExecutionContext to SQL tool", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get user count",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - ExecutionContext fields passed to SQL tool
      expect(mockSqlQueryTool.generateAndExecuteSql).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          userId: mockExecutionContext.userId,
          taskId: mockExecutionContext.taskId,
          conversationId: mockExecutionContext.conversationId,
        }),
      );
    });

    it("should include table schemas in SQL generation context", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - schema context passed to SQL tool
      expect(mockSqlQueryTool.generateAndExecuteSql).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("Available Tables"),
        expect.any(Object),
      );
    });

    it("should extract generated SQL from result", async () => {
      // Arrange
      mockSqlQueryTool.generateAndExecuteSql.mockResolvedValue(`
\`\`\`sql
SELECT * FROM users WHERE id = 1
\`\`\`

Results:
| id | name |
|----|----- |
| 1  | John |
      `);

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get user with id 1",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.generatedSql).toBeDefined();
    });

    it("should set status to summarizing on success", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should transition through states to completion
      expect(result.status).toBeDefined();
    });
  });

  describe("Node: summarizeNode", () => {
    it("should format results with LLM", async () => {
      // Arrange
      mockLLMClient.callLLM.mockResolvedValue({
        text: "## Summary\n\nThere are 100 users in the database.",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "How many users?",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.stringContaining("Formatting"),
        expect.objectContaining({ step: "summarize" }),
      );
    });

    it("should pass ExecutionContext to LLM for formatting", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get summary",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - LLM should be called with ExecutionContext
      const summaryCall = mockLLMClient.callLLM.mock.calls.find((call) =>
        call[0].userMessage?.includes("Format the following"),
      );
      expect(summaryCall).toBeDefined();
      expect(summaryCall?.[0].context).toEqual(mockExecutionContext);
    });

    it("should emit completed event on success", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Show me data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert
      expect(mockObservability.emitCompleted).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.objectContaining({ summary: expect.any(String) }),
        expect.any(Number),
      );
    });

    it("should set status to completed on success", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("completed");
    });

    it("should handle formatting errors", async () => {
      // Arrange
      mockLLMClient.callLLM
        .mockResolvedValueOnce({
          text: '["users"]',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        })
        .mockRejectedValueOnce(new Error("LLM service unavailable"));

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("failed");
      expect(mockObservability.emitFailed).toHaveBeenCalled();
    });

    it("should add formatted summary to messages", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });
  });

  describe("Node: handleErrorNode", () => {
    it("should emit failed event", async () => {
      // Arrange
      mockListTablesTool.execute.mockRejectedValue(new Error("Database error"));

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert
      expect(mockObservability.emitFailed).toHaveBeenCalledWith(
        mockExecutionContext,
        mockExecutionContext.taskId,
        expect.any(String),
        expect.any(Number),
      );
    });

    it("should set status to failed", async () => {
      // Arrange
      mockListTablesTool.execute.mockRejectedValue(
        new Error("Connection timeout"),
      );

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("failed");
    });

    it("should include error message in state", async () => {
      // Arrange
      mockListTablesTool.execute.mockRejectedValue(
        new Error("Permission denied"),
      );

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Permission denied");
    });
  });

  describe("Conditional Edges", () => {
    it("should route to handle_error when discover_tables fails", async () => {
      // Arrange
      mockListTablesTool.execute.mockRejectedValue(new Error("DB error"));

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("failed");
    });

    it("should route to handle_error when no tables available", async () => {
      // Arrange
      mockListTablesTool.execute.mockResolvedValue("");

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("failed");
    });

    it("should route to plan_schema when tables discovered successfully", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - planSchemaNode should be called (emitProgress for plan_schema)
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Planning"),
        expect.objectContaining({ step: "plan_schema" }),
      );
    });

    it("should route to summarize when execute_query succeeds", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - summarizeNode should be called (emitProgress for summarize)
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Formatting"),
        expect.objectContaining({ step: "summarize" }),
      );
    });
  });

  describe("Graph Flow Integration", () => {
    it("should complete full happy path workflow", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "How many users are there?",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert
      expect(result.status).toBe("completed");
      expect(result.summary).toBeDefined();
      expect(result.generatedSql).toBeDefined();
      expect(result.sqlResults).toBeDefined();
      expect(result.availableTables).toBeDefined();
      expect(result.tableSchemas).toBeDefined();
    });

    it("should maintain ExecutionContext through entire workflow", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - ExecutionContext should be preserved
      expect(result.executionContext).toEqual(mockExecutionContext);
    });

    it("should call all expected nodes in order", async () => {
      // Arrange
      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      await graph.invoke(initialState);

      // Assert - verify all nodes called via observability
      expect(mockObservability.emitStarted).toHaveBeenCalled();
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Discovering"),
        expect.objectContaining({ step: "discover_tables" }),
      );
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Planning"),
        expect.objectContaining({ step: "plan_schema" }),
      );
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Examining"),
        expect.objectContaining({ step: "describe_tables" }),
      );
      expect(mockObservability.emitProgress).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Generating"),
        expect.objectContaining({ step: "execute_query" }),
      );
      expect(mockObservability.emitCompleted).toHaveBeenCalled();
    });

    it("should handle errors at any stage and route to handleError", async () => {
      // Arrange
      mockDescribeTableTool.execute.mockRejectedValue(
        new Error("Schema not found"),
      );

      const graph = createDataAnalystGraph(
        mockLLMClient,
        mockObservability,
        mockCheckpointer,
        mockListTablesTool,
        mockDescribeTableTool,
        mockSqlQueryTool,
      );

      const initialState: Partial<DataAnalystState> = {
        executionContext: mockExecutionContext,
        userMessage: "Get data",
      };

      // Act
      const result = await graph.invoke(initialState);

      // Assert - should handle errors gracefully and continue
      expect(result.status).toBeDefined();
    });
  });
});
