import { Annotation } from "@langchain/langgraph";
import { createMockExecutionContext } from "@orchestrator-ai/transport-types";
import {
  DataAnalystStateAnnotation,
  DataAnalystState,
  DataAnalystInput,
  DataAnalystResult,
  DataAnalystStatus,
  ToolResult,
} from "./data-analyst.state";

/**
 * Unit tests for Data Analyst State Annotation
 *
 * Tests state initialization, default values, reducers, and ExecutionContext handling.
 */
describe("DataAnalystStateAnnotation", () => {
  describe("State Default Values", () => {
    it("should have correct default value for executionContext", () => {
      const state = DataAnalystStateAnnotation.State;
      const defaultContext =
        DataAnalystStateAnnotation.spec.executionContext.default?.();

      expect(defaultContext).toBeDefined();
      expect(defaultContext).toEqual({
        orgSlug: "",
        userId: "",
        conversationId: "",
        taskId: "",
        planId: "",
        deliverableId: "",
        agentSlug: "",
        agentType: "",
        provider: "",
        model: "",
      });
    });

    it("should have correct default value for userMessage", () => {
      const defaultMessage =
        DataAnalystStateAnnotation.spec.userMessage.default?.();

      expect(defaultMessage).toBe("");
    });

    it("should have correct default value for availableTables", () => {
      const defaultTables =
        DataAnalystStateAnnotation.spec.availableTables.default?.();

      expect(defaultTables).toEqual([]);
    });

    it("should have correct default value for selectedTables", () => {
      const defaultTables =
        DataAnalystStateAnnotation.spec.selectedTables.default?.();

      expect(defaultTables).toEqual([]);
    });

    it("should have correct default value for tableSchemas", () => {
      const defaultSchemas =
        DataAnalystStateAnnotation.spec.tableSchemas.default?.();

      expect(defaultSchemas).toEqual({});
    });

    it("should have correct default value for generatedSql", () => {
      const defaultSql =
        DataAnalystStateAnnotation.spec.generatedSql.default?.();

      expect(defaultSql).toBeUndefined();
    });

    it("should have correct default value for sqlResults", () => {
      const defaultResults =
        DataAnalystStateAnnotation.spec.sqlResults.default?.();

      expect(defaultResults).toBeUndefined();
    });

    it("should have correct default value for toolResults", () => {
      const defaultToolResults =
        DataAnalystStateAnnotation.spec.toolResults.default?.();

      expect(defaultToolResults).toEqual([]);
    });

    it("should have correct default value for summary", () => {
      const defaultSummary =
        DataAnalystStateAnnotation.spec.summary.default?.();

      expect(defaultSummary).toBeUndefined();
    });

    it("should have correct default value for status", () => {
      const defaultStatus = DataAnalystStateAnnotation.spec.status.default?.();

      expect(defaultStatus).toBe("started");
    });

    it("should have correct default value for error", () => {
      const defaultError = DataAnalystStateAnnotation.spec.error.default?.();

      expect(defaultError).toBeUndefined();
    });

    it("should have correct default value for startedAt", () => {
      const beforeTime = Date.now();
      const defaultStartedAt =
        DataAnalystStateAnnotation.spec.startedAt.default?.();
      const afterTime = Date.now();

      expect(defaultStartedAt).toBeDefined();
      expect(defaultStartedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(defaultStartedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should have correct default value for completedAt", () => {
      const defaultCompletedAt =
        DataAnalystStateAnnotation.spec.completedAt.default?.();

      expect(defaultCompletedAt).toBeUndefined();
    });
  });

  describe("State Field Reducers", () => {
    describe("executionContext reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.executionContext.reducer;
        const prev = createMockExecutionContext({ userId: "old-user" });
        const next = createMockExecutionContext({ userId: "new-user" });

        const result = reducer(prev, next);

        expect(result).toEqual(next);
        expect(result.userId).toBe("new-user");
      });

      it("should handle ExecutionContext with all required fields", () => {
        const reducer = DataAnalystStateAnnotation.spec.executionContext.reducer;
        const context = createMockExecutionContext({
          orgSlug: "test-org",
          userId: "test-user-id",
          conversationId: "test-conversation-id",
          taskId: "test-task-id",
          planId: "test-plan-id",
          deliverableId: "test-deliverable-id",
          agentSlug: "data-analyst",
          agentType: "langgraph",
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        });

        const result = reducer(
          createMockExecutionContext(),
          context,
        );

        expect(result.orgSlug).toBe("test-org");
        expect(result.userId).toBe("test-user-id");
        expect(result.conversationId).toBe("test-conversation-id");
        expect(result.taskId).toBe("test-task-id");
        expect(result.planId).toBe("test-plan-id");
        expect(result.deliverableId).toBe("test-deliverable-id");
        expect(result.agentSlug).toBe("data-analyst");
        expect(result.agentType).toBe("langgraph");
        expect(result.provider).toBe("anthropic");
        expect(result.model).toBe("claude-sonnet-4-20250514");
      });
    });

    describe("userMessage reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.userMessage.reducer;
        const prev = "old message";
        const next = "new message";

        const result = reducer(prev, next);

        expect(result).toBe("new message");
      });
    });

    describe("availableTables reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.availableTables.reducer;
        const prev = ["table1", "table2"];
        const next = ["table3", "table4", "table5"];

        const result = reducer(prev, next);

        expect(result).toEqual(["table3", "table4", "table5"]);
      });
    });

    describe("selectedTables reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.selectedTables.reducer;
        const prev = ["table1"];
        const next = ["table2", "table3"];

        const result = reducer(prev, next);

        expect(result).toEqual(["table2", "table3"]);
      });
    });

    describe("tableSchemas reducer", () => {
      it("should merge previous and next values", () => {
        const reducer = DataAnalystStateAnnotation.spec.tableSchemas.reducer;
        const prev = {
          users: "id (int), name (varchar)",
          posts: "id (int), title (varchar)",
        };
        const next = {
          comments: "id (int), text (text)",
          users: "id (int), name (varchar), email (varchar)", // Updated schema
        };

        const result = reducer(prev, next);

        expect(result).toEqual({
          users: "id (int), name (varchar), email (varchar)", // Updated
          posts: "id (int), title (varchar)", // Preserved
          comments: "id (int), text (text)", // Added
        });
      });

      it("should add new schemas without removing existing ones", () => {
        const reducer = DataAnalystStateAnnotation.spec.tableSchemas.reducer;
        const prev = { table1: "schema1" };
        const next = { table2: "schema2" };

        const result = reducer(prev, next);

        expect(result).toEqual({
          table1: "schema1",
          table2: "schema2",
        });
      });

      it("should handle empty previous value", () => {
        const reducer = DataAnalystStateAnnotation.spec.tableSchemas.reducer;
        const prev = {};
        const next = { table1: "schema1" };

        const result = reducer(prev, next);

        expect(result).toEqual({ table1: "schema1" });
      });
    });

    describe("generatedSql reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.generatedSql.reducer;
        const prev = "SELECT * FROM old_table";
        const next = "SELECT * FROM new_table";

        const result = reducer(prev, next);

        expect(result).toBe("SELECT * FROM new_table");
      });

      it("should handle undefined values", () => {
        const reducer = DataAnalystStateAnnotation.spec.generatedSql.reducer;
        const prev = "SELECT * FROM table";
        const next = undefined;

        const result = reducer(prev, next);

        expect(result).toBeUndefined();
      });
    });

    describe("sqlResults reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.sqlResults.reducer;
        const prev = "old results";
        const next = "new results";

        const result = reducer(prev, next);

        expect(result).toBe("new results");
      });

      it("should handle undefined values", () => {
        const reducer = DataAnalystStateAnnotation.spec.sqlResults.reducer;
        const prev = "results";
        const next = undefined;

        const result = reducer(prev, next);

        expect(result).toBeUndefined();
      });
    });

    describe("toolResults reducer", () => {
      it("should append next values to previous values", () => {
        const reducer = DataAnalystStateAnnotation.spec.toolResults.reducer;
        const prev: ToolResult[] = [
          { toolName: "tool1", result: "result1", success: true },
        ];
        const next: ToolResult[] = [
          { toolName: "tool2", result: "result2", success: true },
          { toolName: "tool3", result: "result3", success: false, error: "error" },
        ];

        const result = reducer(prev, next);

        expect(result).toEqual([
          { toolName: "tool1", result: "result1", success: true },
          { toolName: "tool2", result: "result2", success: true },
          { toolName: "tool3", result: "result3", success: false, error: "error" },
        ]);
      });

      it("should handle empty previous value", () => {
        const reducer = DataAnalystStateAnnotation.spec.toolResults.reducer;
        const prev: ToolResult[] = [];
        const next: ToolResult[] = [
          { toolName: "tool1", result: "result1", success: true },
        ];

        const result = reducer(prev, next);

        expect(result).toEqual([
          { toolName: "tool1", result: "result1", success: true },
        ]);
      });

      it("should accumulate tool results over multiple updates", () => {
        const reducer = DataAnalystStateAnnotation.spec.toolResults.reducer;
        let accumulated: ToolResult[] = [];

        accumulated = reducer(accumulated, [
          { toolName: "list_tables", result: "users, posts", success: true },
        ]);
        accumulated = reducer(accumulated, [
          { toolName: "describe_table", result: "schema", success: true },
        ]);
        accumulated = reducer(accumulated, [
          { toolName: "execute_sql", result: "results", success: true },
        ]);

        expect(accumulated).toHaveLength(3);
        expect(accumulated[0].toolName).toBe("list_tables");
        expect(accumulated[1].toolName).toBe("describe_table");
        expect(accumulated[2].toolName).toBe("execute_sql");
      });
    });

    describe("summary reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.summary.reducer;
        const prev = "old summary";
        const next = "new summary";

        const result = reducer(prev, next);

        expect(result).toBe("new summary");
      });

      it("should handle undefined values", () => {
        const reducer = DataAnalystStateAnnotation.spec.summary.reducer;
        const prev = "summary";
        const next = undefined;

        const result = reducer(prev, next);

        expect(result).toBeUndefined();
      });
    });

    describe("status reducer", () => {
      it("should replace previous status with next status", () => {
        const reducer = DataAnalystStateAnnotation.spec.status.reducer;
        const prev = "started";
        const next = "discovering";

        const result = reducer(prev, next);

        expect(result).toBe("discovering");
      });

      it("should handle all valid status transitions", () => {
        const reducer = DataAnalystStateAnnotation.spec.status.reducer;
        const statuses: Array<
          | "started"
          | "discovering"
          | "querying"
          | "summarizing"
          | "completed"
          | "failed"
        > = [
          "started",
          "discovering",
          "querying",
          "summarizing",
          "completed",
          "failed",
        ];

        for (let i = 0; i < statuses.length - 1; i++) {
          const result = reducer(statuses[i], statuses[i + 1]);
          expect(result).toBe(statuses[i + 1]);
        }
      });
    });

    describe("error reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.error.reducer;
        const prev = "old error";
        const next = "new error";

        const result = reducer(prev, next);

        expect(result).toBe("new error");
      });

      it("should handle undefined values", () => {
        const reducer = DataAnalystStateAnnotation.spec.error.reducer;
        const prev = "error";
        const next = undefined;

        const result = reducer(prev, next);

        expect(result).toBeUndefined();
      });
    });

    describe("startedAt reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.startedAt.reducer;
        const prev = 1000;
        const next = 2000;

        const result = reducer(prev, next);

        expect(result).toBe(2000);
      });
    });

    describe("completedAt reducer", () => {
      it("should replace previous value with next value", () => {
        const reducer = DataAnalystStateAnnotation.spec.completedAt.reducer;
        const prev = 1000;
        const next = 2000;

        const result = reducer(prev, next);

        expect(result).toBe(2000);
      });

      it("should handle undefined values", () => {
        const reducer = DataAnalystStateAnnotation.spec.completedAt.reducer;
        const prev = 1000;
        const next = undefined;

        const result = reducer(prev, next);

        expect(result).toBeUndefined();
      });
    });
  });

  describe("MessagesAnnotation Integration", () => {
    it("should include messages field from MessagesAnnotation", () => {
      expect(DataAnalystStateAnnotation.spec.messages).toBeDefined();
    });
  });

  describe("State Type", () => {
    it("should infer correct state type", () => {
      // This is a type-level test - if it compiles, it passes
      const state: DataAnalystState = {
        messages: [],
        executionContext: createMockExecutionContext(),
        userMessage: "test message",
        availableTables: ["users"],
        selectedTables: ["users"],
        tableSchemas: { users: "schema" },
        generatedSql: "SELECT * FROM users",
        sqlResults: "results",
        toolResults: [],
        summary: "summary",
        status: "completed",
        error: undefined,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };

      expect(state).toBeDefined();
    });
  });
});

describe("DataAnalystInput", () => {
  it("should have correct structure", () => {
    const input: DataAnalystInput = {
      context: createMockExecutionContext(),
      userMessage: "Analyze sales data",
    };

    expect(input.context).toBeDefined();
    expect(input.userMessage).toBe("Analyze sales data");
  });

  it("should accept ExecutionContext with all required fields", () => {
    const context = createMockExecutionContext({
      orgSlug: "test-org",
      userId: "user-123",
      conversationId: "conv-456",
      taskId: "task-789",
      agentSlug: "data-analyst",
    });

    const input: DataAnalystInput = {
      context,
      userMessage: "Query database",
    };

    expect(input.context.orgSlug).toBe("test-org");
    expect(input.context.userId).toBe("user-123");
    expect(input.context.conversationId).toBe("conv-456");
    expect(input.context.taskId).toBe("task-789");
    expect(input.context.agentSlug).toBe("data-analyst");
  });
});

describe("DataAnalystResult", () => {
  it("should have correct structure for completed status", () => {
    const result: DataAnalystResult = {
      taskId: "task-123",
      status: "completed",
      userMessage: "Analyze sales",
      summary: "Analysis complete",
      generatedSql: "SELECT * FROM sales",
      sqlResults: "Results here",
      duration: 5000,
    };

    expect(result.taskId).toBe("task-123");
    expect(result.status).toBe("completed");
    expect(result.summary).toBeDefined();
    expect(result.generatedSql).toBeDefined();
    expect(result.sqlResults).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("should have correct structure for failed status", () => {
    const result: DataAnalystResult = {
      taskId: "task-123",
      status: "failed",
      userMessage: "Analyze sales",
      error: "Database connection failed",
      duration: 1000,
    };

    expect(result.taskId).toBe("task-123");
    expect(result.status).toBe("failed");
    expect(result.error).toBe("Database connection failed");
    expect(result.summary).toBeUndefined();
    expect(result.generatedSql).toBeUndefined();
    expect(result.sqlResults).toBeUndefined();
  });

  it("should calculate duration correctly", () => {
    const startedAt = Date.now();
    const completedAt = startedAt + 3000;

    const result: DataAnalystResult = {
      taskId: "task-123",
      status: "completed",
      userMessage: "test",
      duration: completedAt - startedAt,
    };

    expect(result.duration).toBe(3000);
  });
});

describe("DataAnalystStatus", () => {
  it("should have correct structure", () => {
    const status: DataAnalystStatus = {
      taskId: "task-123",
      status: "discovering",
      userMessage: "Analyze data",
      summary: "Discovering tables...",
    };

    expect(status.taskId).toBe("task-123");
    expect(status.status).toBe("discovering");
    expect(status.userMessage).toBe("Analyze data");
    expect(status.summary).toBe("Discovering tables...");
    expect(status.error).toBeUndefined();
  });

  it("should support all valid statuses", () => {
    const statuses: Array<DataAnalystStatus["status"]> = [
      "started",
      "discovering",
      "querying",
      "summarizing",
      "completed",
      "failed",
    ];

    statuses.forEach((statusValue) => {
      const status: DataAnalystStatus = {
        taskId: "task-123",
        status: statusValue,
        userMessage: "test",
      };

      expect(status.status).toBe(statusValue);
    });
  });

  it("should include error for failed status", () => {
    const status: DataAnalystStatus = {
      taskId: "task-123",
      status: "failed",
      userMessage: "test",
      error: "Connection timeout",
    };

    expect(status.status).toBe("failed");
    expect(status.error).toBe("Connection timeout");
  });
});

describe("ToolResult", () => {
  it("should have correct structure for successful tool execution", () => {
    const toolResult: ToolResult = {
      toolName: "list_tables",
      result: "users, posts, comments",
      success: true,
    };

    expect(toolResult.toolName).toBe("list_tables");
    expect(toolResult.result).toBe("users, posts, comments");
    expect(toolResult.success).toBe(true);
    expect(toolResult.error).toBeUndefined();
  });

  it("should have correct structure for failed tool execution", () => {
    const toolResult: ToolResult = {
      toolName: "execute_sql",
      result: "",
      success: false,
      error: "Syntax error in SQL",
    };

    expect(toolResult.toolName).toBe("execute_sql");
    expect(toolResult.success).toBe(false);
    expect(toolResult.error).toBe("Syntax error in SQL");
  });

  it("should support common data analyst tools", () => {
    const tools = [
      "list_tables",
      "describe_table",
      "execute_sql",
      "query_database",
    ];

    tools.forEach((toolName) => {
      const toolResult: ToolResult = {
        toolName,
        result: "test result",
        success: true,
      };

      expect(toolResult.toolName).toBe(toolName);
    });
  });
});
